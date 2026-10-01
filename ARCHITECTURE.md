# Architecture Overview - Cloud Nine Cafe Bar

## System Design Principles

### 1. Real-Time First
All critical state changes (orders, ingredient availability) propagate via WebSockets. The system never relies on polling for operational updates.

### 2. Ingredient-Based Availability
Availability cascades from ingredients → drinks and modifiers. When an ingredient becomes unavailable, all dependent items are automatically disabled. This prevents invalid orders at the source.

### 3. Server-Side Validation
All business logic lives in the backend:
- Price calculation
- Availability checks
- Order validation
- Status transition rules

The frontend is treated as an untrusted client.

### 4. Immutable Order Snapshots
Orders store drink names, prices, and modifier details at order time. Menu changes don't affect historical orders. This supports accurate reporting and repricing.

### 5. Secure Tracking
Order tracking uses cryptographically random tokens stored separately from orders. Tokens expire after 24 hours. No sensitive data appears in tracking URLs.

## Data Flow Diagrams

### Order Placement Flow

```
Customer Kiosk                    Backend                    Database
     |                                |                          |
     |-- POST /orders --------------->|                          |
     |   (items with modifiers)       |                          |
     |                                |-- Validate availability->|
     |                                |                          |
     |                                |<- Check ingredients -----|
     |                                |                          |
     |                                |-- Calculate total ------>|
     |                                |                          |
     |                                |-- Create order --------->|
     |                                |                          |
     |                                |-- Generate token ------->|
     |                                |                          |
     |                                |-- Generate QR code ----->|
     |                                |                          |
     |<-- Order + tracking token -----|                          |
     |                                |                          |
     |                                |-- WebSocket: order.created -> Barista Display
```

### Real-Time Status Update Flow

```
Barista Display                   Backend                    Customer Tracking
     |                                |                          |
     |-- PATCH /orders/:id/status --->|                          |
     |   (new status)                 |                          |
     |                                |-- Validate transition -->|
     |                                |                          |
     |                                |-- Update order --------->|
     |                                |                          |
     |                                |-- Log status history --->|
     |                                |                          |
     |<-- Updated order --------------|                          |
     |                                |                          |
     |                                |-- WebSocket: order.statusChanged ->|
     |                                |                          |
     |                                |<-------------------------|
     |                                |   (status updates live)  |
```

### Ingredient Availability Cascade

```
Staff Interface                   Backend                    Customer Kiosk
     |                                |                          |
     |-- PATCH /ingredients/:id ------>|                          |
     |   (isAvailable: false)         |                          |
     |                                |-- Update ingredient ---->|
     |                                |                          |
     |<-- Updated ingredient ---------|                          |
     |                                |                          |
     |                                |-- WebSocket: ingredient.availabilityChanged ->|
     |                                |                          |
     |                                |-- WebSocket: menu.availabilityChanged -------->|
     |                                |                          |
     |                                |                          |<-- Re-fetch menu --|
     |                                |                          |
     |                                |<-- GET /drinks ----------|
     |                                |                          |
     |                                |-- Resolve availability ->|
     |                                |   (server-side)          |
     |                                |                          |
     |                                |--> Drinks with unavailable ingredients disabled ->|
```

## Database Schema Design

### Core Relationships

```
DrinkCategory (1) ----< (N) Drink
Drink (N) ----< (N) Ingredient [via DrinkIngredient]
Drink (N) ----< (N) ModifierGroup [via DrinkModifierGroup]
ModifierGroup (1) ----< (N) ModifierOption
ModifierOption (N) ----< (N) Ingredient [via ModifierOptionIngredient]

Order (1) ----< (N) OrderItem
OrderItem (1) ----< (N) OrderItemModifier
Order (1) ----< (N) OrderStatusHistory
Order (1) ---- (1) OrderTrackingToken
```

### Denormalization Strategy

**OrderItem** denormalizes:
- `drinkName` - drink name at order time
- `drinkPrice` - drink price at order time
- `quantity` - number of this item

**OrderItemModifier** denormalizes:
- `optionName` - modifier name at order time
- `priceAdjustment` - modifier price at order time

**Why?** Menu prices change. Historical orders must reflect what the customer actually paid.

### Indexing Strategy

Performance-critical queries and their indexes:

```sql
-- Active order queue (barista display)
SELECT * FROM "Order" 
WHERE status != 'COLLECTED' 
ORDER BY createdAt DESC;
-- Index: Order(status, createdAt)

-- Order lookup by number
SELECT * FROM "Order" WHERE orderNumber = ?;
-- Index: Order(orderNumber) UNIQUE

-- Tracking token lookup
SELECT * FROM "OrderTrackingToken" WHERE tokenHash = ?;
-- Index: OrderTrackingToken(tokenHash) UNIQUE

-- Ingredient availability check
SELECT * FROM "DrinkIngredient" WHERE drinkId = ?;
-- Index: DrinkIngredient(drinkId, ingredientId) PRIMARY
-- Index: DrinkIngredient(ingredientId) for reverse lookup
```

## Service Architecture

### Availability Service

**Responsibility:** Resolve drink and modifier availability based on ingredient state.

**Key Methods:**
- `isDrinkAvailable(drinkId)` - Check if drink is orderable
- `isModifierOptionAvailable(optionId)` - Check if modifier is selectable
- `validateModifierSelection(drinkId, optionIds)` - Bulk validation

**Algorithm:**
```typescript
function isDrinkAvailable(drink):
  if not drink.isAvailable:
    return false
  
  for each ingredient in drink.ingredients:
    if not ingredient.isAvailable:
      return false
  
  return true
```

**Caching Strategy:** No caching. Availability must be checked at transaction time. Ingredient state can change between page load and order submission.

### Order Workflow Service

**Responsibility:** Enforce valid status transitions and prevent invalid state changes.

**State Machine:**
```
RECEIVED ──> PREPARING ──> READY_FOR_PICKUP ──> COLLECTED
    ↑           ↑                ↑                  ↑
    └───────────┴────────────────┴──────────────────┘
              (no backward transitions)
```

**Transition Matrix:**
| From             | To               | Valid? |
|------------------|------------------|--------|
| RECEIVED         | PREPARING        | ✓      |
| RECEIVED         | READY_FOR_PICKUP | ✗      |
| PREPARING        | READY_FOR_PICKUP | ✓      |
| PREPARING        | RECEIVED         | ✗      |
| READY_FOR_PICKUP | COLLECTED        | ✓      |
| READY_FOR_PICKUP | PREPARING        | ✗      |
| COLLECTED        | *                | ✗      |

### Tracking Service

**Responsibility:** Generate and validate order tracking tokens.

**Security Model:**
- Token: 32-character cryptographically random string
- Storage: SHA-256 hash stored in database (not the token itself)
- Expiration: 24 hours from order creation
- Scope: One token per order, read-only access

**Token Generation:**
```typescript
function generateSecureToken(): string {
  const chars = 'A-Za-z0-9'
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return array.map(byte => chars[byte % chars.length]).join('')
}
```

## Frontend Architecture

### State Management

**Cart State:** React Context (`CartContext`)
- Local-only, not persisted
- Cleared after order placement
- No server synchronization

**Order State:** Fetched on-demand, updated via WebSocket

**Authentication State:** localStorage
- Token stored as `staff_token`
- User info stored as `staff_user`
- Cleared on logout

### Real-Time Updates

**WebSocket Connection:**
- Established once per session
- Reconnects automatically on disconnect
- Listens for relevant events based on current page

**Event Handlers by Page:**

| Page             | Events Listened                           | Action                    |
|------------------|-------------------------------------------|---------------------------|
| Barista Queue    | order.created, order.statusChanged        | Update order list         |
| Tracking Page    | order.statusChanged (filtered by orderId) | Update status display     |
| Kiosk Menu       | menu.availabilityChanged                  | Re-fetch drinks           |

### API Client Design

**Separation of Concerns:**
- `fetchAPI()` - Public endpoints, no auth
- `fetchWithAuth()` - Staff endpoints, JWT required

**Error Handling:**
```typescript
try {
  const data = await fetchAPI('/endpoint')
} catch (error) {
  // Network errors, 4xx/5xx responses
  alert(error.message)
}
```

**No Retry Logic:** Failures are surfaced to the user immediately. This is a kiosk system, not a background sync service.

## Security Considerations

### Authentication
- JWT tokens with 8-hour expiration
- Tokens transmitted via Authorization header (not cookies)
- No refresh tokens (staff re-login after expiration)

### Authorization
- Role-based access control (ADMIN, BARISTA)
- Middleware enforces role requirements per endpoint
- Customer endpoints are public (no PII collected)

### Input Validation
- DTOs validate all request bodies (class-validator)
- Prisma prevents SQL injection
- Price calculations happen server-side only

### Rate Limiting
Not implemented. Recommended for production:
- Customer order endpoint: 10 orders per IP per hour
- Staff login: 5 attempts per IP per 15 minutes

### Secrets Management
- JWT secret in environment variable
- Database credentials in environment variable
- No secrets in code or version control

## Performance Characteristics

### Expected Load
- 1-5 concurrent kiosks
- 50-200 orders per day
- 2-5 staff users

### Optimization Opportunities
1. **Database Connection Pooling** - Prisma default (10 connections)
2. **Index Coverage** - All queries use indexes (see schema design)
3. **WebSocket Scaling** - Socket.IO supports horizontal scaling with Redis adapter
4. **Frontend Bundling** - Next.js automatic code splitting

### Bottlenecks
1. **QR Code Generation** - Synchronous, ~50ms per order
2. **Availability Checks** - N+1 queries (could batch)
3. **Order Creation** - Multiple inserts in transaction

None are problematic at expected scale.

## Deployment Architecture

### Development
```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│  Next.js    │────────>│  NestJS     │────────>│ PostgreSQL  │
│  :3000      │ fetch   │  :3001      │         │  :5432      │
│             │<───────>│             │         │             │
└─────────────┘WebSocket└─────────────┘         └─────────────┘
```

### Production (Docker Compose)
```
┌────────────────────────────────────────────────┐
│                Docker Network                  │
│                                                │
│  ┌──────────────┐   ┌──────────────┐         │
│  │   frontend   │──>│   backend    │         │
│  │   :3000      │   │   :3001      │         │
│  └──────────────┘   └──────────────┘         │
│         ↓                  ↓                  │
│  ┌────────────────────────────────┐          │
│  │         postgres:5432           │          │
│  │      (persistent volume)        │          │
│  └────────────────────────────────┘          │
└────────────────────────────────────────────────┘
          ↓
   ┌──────────────┐
   │ Host :3000   │ (frontend exposed)
   └──────────────┘
```

## Testing Strategy

### Unit Tests (Backend)
- Services: Business logic isolated from database
- Mocked dependencies: PrismaService, RealtimeGateway
- Focus: Availability rules, order validation, status transitions

### Integration Tests (Backend)
- E2E: HTTP requests through NestJS test client
- Real database: In-memory or test PostgreSQL instance
- Focus: API contracts, database constraints, WebSocket events

### Frontend Tests (Not Implemented)
Recommended:
- Component tests: React Testing Library
- E2E tests: Playwright or Cypress
- Focus: User flows, real-time updates, error states

## Monitoring & Observability

### Logging (Current)
- Console output only
- Includes: Connection events, order creation, status changes

### Recommended for Production
1. **Structured Logging**: Winston or Pino
2. **Error Tracking**: Sentry
3. **Metrics**: Prometheus + Grafana
4. **APM**: New Relic or DataDog

### Key Metrics to Track
- Order placement rate (orders/hour)
- Average order preparation time (created → collected)
- Ingredient availability toggle frequency
- WebSocket connection stability
- API response times (p50, p95, p99)

## Scalability Considerations

### Current Limitations
- Single-server architecture
- In-memory WebSocket connections (no Redis)
- No CDN for static assets

### Scaling to 10x Load
1. **Backend**: Add load balancer + Redis for Socket.IO
2. **Database**: Read replicas for reporting queries
3. **Frontend**: Serve via CDN (Vercel, Netlify)
4. **Cache**: Redis for menu data (invalidate on ingredient change)

### Scaling to 100x Load
1. **Microservices**: Split orders, menu, tracking into separate services
2. **Event Bus**: Replace WebSocket with pub/sub (Redis, RabbitMQ)
3. **Database**: Sharding by location (multi-cafe deployment)
4. **Queue**: Background job processing for reports, QR generation
