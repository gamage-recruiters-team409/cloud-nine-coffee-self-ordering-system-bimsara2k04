# Cloud Nine Cafe Bar - Self-Ordering System

A production-ready self-ordering system for Cloud Nine Cafe Bar, built with Next.js, NestJS, PostgreSQL, and real-time WebSockets.

## Features

### Customer Experience
- **Kiosk ordering interface** - Browse menu, customize drinks with modifiers
- **Real-time availability** - Unavailable ingredients automatically disable affected drinks
- **QR order tracking** - Scan QR code to track order status in real-time
- **Touch-optimized UI** - Large buttons and clear navigation

### Staff Features
- **Live order queue** - New orders appear instantly on barista display
- **Order status management** - Move orders through workflow (Received → Preparing → Ready → Collected)
- **Ingredient availability control** - Toggle ingredient status to affect menu availability
- **Real-time synchronization** - All screens update instantly via WebSockets

### Technical Highlights
- **Ingredient-based availability** - Automatic cascade when ingredients become unavailable
- **Order workflow validation** - Enforces valid status transitions
- **Secure order tracking** - Token-based access with expiration
- **QR code generation** - Server-side QR generation for order tracking
- **JWT authentication** - Role-based access control (Admin, Barista)

## Architecture

### Monorepo Structure
```
cloud-nine-cafe/
├── apps/
│   ├── backend/          # NestJS API
│   │   ├── src/
│   │   │   ├── auth/           # JWT authentication
│   │   │   ├── users/          # User management
│   │   │   ├── drinks/         # Drinks CRUD
│   │   │   ├── categories/     # Categories CRUD
│   │   │   ├── modifiers/      # Modifier groups & options
│   │   │   ├── ingredients/    # Ingredient management
│   │   │   ├── orders/         # Order creation & workflow
│   │   │   ├── tracking/       # QR tracking & token validation
│   │   │   ├── availability/   # Availability resolution service
│   │   │   ├── realtime/       # WebSocket gateway
│   │   │   ├── reports/        # Sales & order reports
│   │   │   └── prisma/         # Database service
│   │   └── prisma/
│   │       ├── schema.prisma   # Database schema
│   │       └── seed.ts         # Seed data
│   │
│   └── frontend/         # Next.js app
│       └── src/
│           ├── app/
│           │   ├── kiosk/            # Customer ordering flow
│           │   ├── tracking/         # Order tracking page
│           │   └── staff/            # Staff/barista interface
│           ├── contexts/             # React contexts (Cart)
│           ├── hooks/                # Custom hooks (WebSocket)
│           ├── lib/                  # API utilities
│           └── types/                # TypeScript types
│
├── docker-compose.yml    # Docker orchestration
└── .env.example          # Environment template
```

### Technology Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: NestJS 11, TypeScript, Passport JWT
- **Database**: PostgreSQL 16, Prisma ORM
- **Real-time**: Socket.IO (WebSockets)
- **QR Generation**: qrcode library
- **Validation**: class-validator, Zod

## Setup

### Prerequisites
- Node.js 22+
- npm 10+
- PostgreSQL 16
- Docker & Docker Compose (optional, for containerized setup)

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update the following variables as needed:

```env
# PostgreSQL
DATABASE_URL="postgresql://cloud_nine:cloud_nine@localhost:5434/cloud_nine?schema=public"

# Backend
PORT=3001
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="8h"
CORS_ORIGIN="http://localhost:3000"
PUBLIC_URL="http://localhost:3000"
TRACKING_TOKEN_EXPIRES_HOURS="24"

# PayHere Sandbox
PAYHERE_MERCHANT_ID="your-sandbox-merchant-id"
PAYHERE_MERCHANT_SECRET="your-sandbox-merchant-secret"
PAYHERE_SANDBOX="true"
BACKEND_URL="http://localhost:3001"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Installation

Install all dependencies:

```bash
npm install
```

This will install dependencies for both frontend and backend workspaces.

### Database Setup

#### Option 1: Using Docker Compose

Start PostgreSQL:

```bash
docker compose up -d postgres
```

#### Option 2: Local PostgreSQL

Ensure PostgreSQL is running locally and create the database:

```bash
createdb cloud_nine
```

### Run Migrations

Apply database migrations:

```bash
npm run db:migrate
```

### Seed Database

Populate the database with sample data:

```bash
npm run db:seed
```

This creates:
- 2 users (admin, barista)
- 15 ingredients
- 4 drink categories
- 16 drinks
- 5 modifier groups with options
- Ingredient-drink-modifier relationships

## Development

### Run Backend

```bash
npm run dev:backend
```

Backend will start on `http://localhost:3001`

### Run Frontend

```bash
npm run dev:frontend
```

Frontend will start on `http://localhost:3000`

### Run Both Concurrently

```bash
npm run dev
```

### Other Commands

```bash
# Type checking
npm run typecheck

# Run tests
npm test

# Database studio (Prisma GUI)
npm run db:studio

# Build for production
npm run build
```

## Production Deployment

### Using Docker Compose

Build and start all services:

```bash
docker compose up -d
```

This will:
1. Start PostgreSQL
2. Build and start the backend (with auto-migrations)
3. Build and start the frontend

Access the application at `http://localhost:3000`

### Vercel Multi-Services Deployment

This project is configured to deploy as a unified multi-service project on Vercel using `vercel.json`:

1. **Routing Architecture**:
   - `/api/(.*)` routes to the NestJS `backend` service (`apps/backend`)
   - `/(.*)` routes to the Next.js `frontend` service (`apps/frontend`)

2. **Deploy with Vercel CLI**:
   ```bash
   vercel
   ```

3. **Configure Environment Variables on Vercel**:
   - `DATABASE_URL`: Hosted PostgreSQL connection string (e.g. Supabase, Neon)
   - `JWT_SECRET`: Random secure string
   - `CORS_ORIGIN`: `https://<your-project>.vercel.app`
   - `PUBLIC_URL`: `https://<your-project>.vercel.app`
   - `BACKEND_URL`: `https://<your-project>.vercel.app/api`
   - `NEXT_PUBLIC_API_URL`: `/api` (or `https://<your-project>.vercel.app/api`)
   - `PAYHERE_MERCHANT_ID`: Your PayHere Merchant ID
   - `PAYHERE_MERCHANT_SECRET`: Your PayHere Merchant Secret

### Manual Deployment

1. Build both applications:
```bash
npm run build
```

2. Run migrations:
```bash
cd apps/backend && npx prisma migrate deploy
```

3. Seed database:
```bash
npm run db:seed
```

4. Start backend:
```bash
cd apps/backend && npm run start:prod
```

5. Start frontend:
```bash
cd apps/frontend && npm start
```

## Default Login Credentials

### Admin
- Email: `admin@cloudnine.com`
- Password: `admin123`

### Barista
- Email: `barista@cloudnine.com`
- Password: `barista123`

**⚠️ Change these credentials in production!**

## API Endpoints

### Public Endpoints
- `GET /categories` - List all drink categories with drinks
- `GET /drinks` - List all drinks with modifiers
- `GET /drinks/:id` - Get drink details
- `POST /orders` - Place an order (PENDING payment)
- `POST /payments/payhere/init/:orderId` - Initialize PayHere checkout payload & hash
- `POST /payments/payhere/notify` - Server-to-server PayHere payment confirmation webhook
- `POST /payments/payhere/sandbox/approve/:token` - Instant sandbox approval for return flow (Sandbox only)
- `GET /payments/payhere/status/:orderId` - Query payment confirmation status by order ID or order number
- `GET /payments/payhere/status/by-token/:token` - Query payment confirmation status by tracking token
- `GET /payments/payhere/status/latest` - Recovery lookup for most recent order
- `GET /tracking/:token` - Get sanitized order details by safe tracking token
- `GET /tracking/:token/qr` - Get QR code image for tracking

### Staff/Admin Endpoints (JWT Required)
- `POST /auth/login` - Staff login
- `GET /orders` - List orders (with optional status filter)
- `GET /orders/:id` - Get order details
- `PATCH /orders/:id/status` - Update order status (Workflow transitions)
- `GET /ingredients` - List all ingredients
- `PATCH /ingredients/:id/availability` - Toggle ingredient availability
- `GET /reports/summary` - Sales summary (Admin only)
- `GET /reports/recent` - Recent orders (Admin only)

### WebSocket Events

**Emitted by server:**
- `order.created` - New order placed
- `order.statusChanged` - Order status updated
- `ingredient.availabilityChanged` - Ingredient availability toggled
- `menu.availabilityChanged` - Menu availability recalculated

## Data Model

### Core Entities
- **User** - Staff users (Admin, Barista)
- **DrinkCategory** - Menu categories (Espresso, Iced, Specialty, Tea)
- **Drink** - Individual beverages with prices
- **Ingredient** - Raw ingredients with availability status
- **ModifierGroup** - Customization groups (Size, Milk, Syrup, etc.)
- **ModifierOption** - Individual options within groups
- **Order** - Customer orders with items and status
- **OrderTrackingToken** - Secure tokens for order tracking

### Key Relationships
- Drinks belong to categories
- Drinks have many ingredients (many-to-many)
- Drinks have many modifier groups (many-to-many)
- Modifier options can require specific ingredients
- Orders contain items with selected modifiers

### Order Status Flow
```
RECEIVED → PREPARING → READY_FOR_PICKUP → COLLECTED
```

Invalid transitions are rejected by the backend.

## Testing

### Backend Tests

Run unit tests:
```bash
cd apps/backend
npm test
```

Run specific test file:
```bash
npm test -- availability.service.spec.ts
```

### Key Test Coverage
- Availability service (ingredient-based drink/modifier availability)
- Order service (creation validation, status transitions)

## Troubleshooting

### Database Connection Errors

Check that PostgreSQL is running:
```bash
# Docker
docker compose ps

# Local (macOS)
brew services list
```

Verify `DATABASE_URL` in `.env` matches your setup.

### CORS Errors

Ensure `CORS_ORIGIN` in backend `.env` matches your frontend URL.

### WebSocket Connection Issues

Check that:
1. Backend is running and accessible
2. `NEXT_PUBLIC_API_URL` in frontend points to backend
3. No firewall blocking WebSocket connections

### Migration Errors

Reset database (⚠️ deletes all data):
```bash
cd apps/backend
npx prisma migrate reset
```

## Project Structure Decisions

### Why Monorepo?
- Shared TypeScript types between frontend and backend
- Coordinated dependency management
- Simpler local development workflow

### Why Prisma?
- Type-safe database queries
- Automatic migrations
- Built-in seeding support
- Excellent TypeScript integration

### Why WebSockets?
- Real-time order updates for barista display
- Live order tracking for customers
- Ingredient availability cascades instantly

### Why JWT for Auth?
- Stateless authentication
- Role-based access control
- Standard industry practice for APIs

## License

This project is private and proprietary to Cloud Nine Cafe Bar.

## Support

For issues or questions, contact the development team.
