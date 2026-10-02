# Cloud Nine Cafe Bar - Self-Ordering System

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat&logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011-ea2849?style=flat&logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![Socket.IO](https://img.shields.io/badge/RealTime-Socket.IO-010101?style=flat&logo=socket.io)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

A production-ready, full-stack self-ordering and kitchen display system engineered for **Cloud Nine Cafe Bar**. Built with Next.js (App Router), NestJS, PostgreSQL, Prisma ORM, and WebSocket real-time synchronization.

---

## Table of Contents

- [1. System Architecture](#1-system-architecture)
- [2. End-to-End Workflow & Diagrams](#2-end-to-end-workflow--diagrams)
  - [Order Lifecycle Flow](#order-lifecycle-flow)
  - [Payment Processing Architecture (Sandbox & PayHere Live)](#payment-processing-architecture-sandbox--payhere-live)
  - [Ingredient Cascade & Availability Engine](#ingredient-cascade--availability-engine)
  - [Dynamic QR Code & LAN Mobile Tracking](#dynamic-qr-code--lan-mobile-tracking)
- [3. Data Model & Entity Relationships (ERD)](#3-data-model--entity-relationships-erd)
- [4. Features](#4-features)
  - [Customer Kiosk Experience](#customer-kiosk-experience)
  - [Staff Barista Display & Kitchen Queue](#staff-barista-display--kitchen-queue)
  - [Admin & Menu Management](#admin--menu-management)
- [5. Monorepo Structure](#5-monorepo-structure)
- [6. Setup & Installation](#6-setup--installation)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Database Initialization](#database-initialization)
  - [Running Locally](#running-locally)
- [7. API Reference](#7-api-reference)
  - [Public Endpoints](#public-endpoints)
  - [Staff/Admin Endpoints (JWT Required)](#staffadmin-endpoints-jwt-required)
  - [WebSocket Events](#websocket-events)
- [8. Deployment Guide](#8-deployment-guide)
  - [Docker Compose](#docker-compose)
  - [Vercel Deployment](#vercel-deployment)
- [9. Testing](#9-testing)
- [10. Default Credentials](#10-default-credentials)
- [11. Troubleshooting](#11-troubleshooting)

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Clients["Clients Layer"]
        Kiosk["Customer Kiosk Screen<br/>(Next.js App Router)"]
        Mobile["Customer Mobile Tracking<br/>(Scanned via QR / Phone Browser)"]
        KDS["Staff Kitchen Display (KDS)<br/>(Live Barista Queue)"]
        AdminUI["Admin Dashboard & Menu Management<br/>(Analytics & Pricing)"]
    end

    subgraph Gateway["Routing & Gateway"]
        VercelRoute["Reverse Proxy / API Gateway<br/>(Port 3000 / /api/*)"]
    end

    subgraph Backend["NestJS Backend Application (Port 3001)"]
        AuthModule["Auth & Roles Module<br/>(Passport JWT)"]
        OrdersModule["Orders & Workflow Engine"]
        DrinksModule["Drinks & Modifiers Engine"]
        AvailabilityModule["Availability Cascading Service"]
        TrackingModule["Tracking Token & QR Service"]
        PaymentsModule["PayHere & Sandbox Payments Module"]
        RealtimeGateway["Socket.IO WebSocket Gateway"]
    end

    subgraph Persistence["Persistence & External Services"]
        Postgres[("PostgreSQL 16 Database<br/>Prisma ORM")]
        PayHereGateway["PayHere Payment Gateway<br/>(Hosted Checkout & Webhook)"]
    end

    Kiosk -->|REST & WebSockets| VercelRoute
    Mobile -->|REST & WebSockets| VercelRoute
    KDS -->|REST & WebSockets| VercelRoute
    AdminUI -->|REST & JWT Auth| VercelRoute

    VercelRoute --> AuthModule
    VercelRoute --> OrdersModule
    VercelRoute --> DrinksModule
    VercelRoute --> AvailabilityModule
    VercelRoute --> TrackingModule
    VercelRoute --> PaymentsModule
    VercelRoute --> RealtimeGateway

    Backend --> Postgres
    PaymentsModule -->|Signed Hash / Webhook Verification| PayHereGateway
    RealtimeGateway -.->|Broadcast Order & Menu State| Clients
```

---

## 2. End-to-End Workflow & Diagrams

### Order Lifecycle Flow

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Customer browses Menu & customizes Modifiers
    DRAFT --> PENDING: Kiosk submits Order (Items & Dining Option)
    
    state PaymentChoice <<choice>>
    PENDING --> PaymentChoice: Select Payment Mode
    PaymentChoice --> PAID: Sandbox Mode (Instant Local Approval)
    PaymentChoice --> PAID: Live Mode (PayHere Webhook Verified)
    PaymentChoice --> CANCELLED: Payment Cancelled / Failed

    PAID --> RECEIVED: Barista Display notifies new Order via WebSocket
    RECEIVED --> PREPARING: Barista starts brewing
    PREPARING --> READY_FOR_PICKUP: Order completed, Customer tracking notifies
    READY_FOR_PICKUP --> COLLECTED: Customer picks up drink
    COLLECTED --> [*]
    CANCELLED --> [*]
```

---

### Payment Processing Architecture (Sandbox & PayHere Live)

The system supports two checkout paradigms:
1. **Self-Contained Sandbox**: Zero external dependencies. Immediate auto-approval with test cards simulation.
2. **PayHere Production**: MD5-signature encrypted server-to-server webhook verification.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Kiosk)
    participant Front as Next.js Frontend
    participant API as NestJS Backend
    participant DB as PostgreSQL
    participant PayHere as PayHere Gateway
    actor Barista as Barista (KDS)

    Customer->>Front: Checkout (Cart + Dining Option)
    Front->>API: POST /orders
    API->>DB: Create Order (Status: PENDING) + Mint Tracking Token
    DB-->>API: Order Created (ID, Token)
    API-->>Front: { orderId, orderNumber, trackingToken }
    
    Front->>API: POST /payments/payhere/init/:orderId
    
    alt Sandbox Mode (PAYHERE_SANDBOX=true)
        API-->>Front: { provider: 'local', action: '/kiosk/sandbox-checkout?token=...' }
        Front->>Customer: Render Sandbox Checkout Page
        Customer->>Front: Click "Pay"
        Front->>API: POST /payments/payhere/sandbox/approve/:token
        API->>DB: Update Order Status -> PAID, status -> RECEIVED
        API->>Barista: Emit WebSocket 'order.created'
        API-->>Front: Payment Confirmed
        Front->>Customer: Redirect to /kiosk/success/:token (Displays Tracking QR)
    else Live PayHere Hosted Checkout
        API-->>Front: { provider: 'payhere', action: 'https://www.payhere.lk/pay/checkout', fields: { hash, merchant_id, ... } }
        Front->>PayHere: POST Form Submit with MD5 Hash
        Customer->>PayHere: Enter Card / Bank Info
        PayHere-->>Front: Redirect to return_url (/kiosk/success/:token)
        PayHere->>API: POST /payments/payhere/notify (Server-to-Server Webhook)
        API->>API: Verify MD5 Signature (merchant_secret, order_id, amount)
        API->>DB: Update Order Status -> PAID, status -> RECEIVED
        API->>Barista: Emit WebSocket 'order.created'
        API-->>PayHere: 200 "ok"
    end
```

---

### Ingredient Cascade & Availability Engine

When ingredients run out (e.g. Oat Milk, Espresso Beans), all dependent drinks and modifier options are automatically marked unavailable in real-time across all kiosk screens.

```mermaid
flowchart TD
    Staff[Barista / Staff on KDS] -->|PATCH /ingredients/:id/availability| Backend[NestJS Backend API]
    Backend -->|Update ingredient.isAvailable| DB[(PostgreSQL)]
    
    Backend --> Cascade[Availability Resolution Engine]
    Cascade --> Calc1{Does Drink depend on unavailable ingredient?}
    Calc1 -->|Yes| DisableDrink[Mark Drink isAvailable = false]
    Calc1 -->|No| KeepDrink[Keep Drink Available]
    
    Cascade --> Calc2{Does Modifier Option depend on unavailable ingredient?}
    Calc2 -->|Yes| DisableMod[Mark Modifier Option isAvailable = false]
    Calc2 -->|No| KeepMod[Keep Modifier Option Available]

    Cascade --> Gateway[Realtime Gateway]
    Gateway -->|Broadcast 'menu.availabilityChanged'| Kiosks[All Active Customer Kiosks]
    Kiosks --> UIUpdate[UI Instantly Disables Item & Prevents Ordering]
```

---

### Dynamic QR Code & LAN Mobile Tracking

Customers can scan the order confirmation QR code with their personal smartphones to track brewing progress in real time without creating an account.

```mermaid
sequenceDiagram
    autonumber
    actor CustomerPhone as Customer Mobile Phone
    participant Front as Customer Tracking Page (/tracking/:token)
    participant API as NestJS Backend API
    participant WS as Socket.IO Gateway

    CustomerPhone->>Front: Scan QR Code (Loads /tracking/:token)
    Front->>Front: resolveApiUrl() detects actual host (e.g. 192.168.1.50:3001)
    Front->>API: GET /tracking/:token
    API-->>Front: Sanitized Tracking Data (Order #, Status, First Name, Items)
    Front->>WS: Connect WebSocket & Subscribe to Order Updates
    
    Note over Front,WS: Customer tracks progress live as Barista updates status
    
    WS-->>Front: 'order.statusChanged' (RECEIVED -> PREPARING -> READY_FOR_PICKUP)
    Front->>CustomerPhone: Displays "Your Drink is Ready for Pickup!" Banner
```

---

## 3. Data Model & Entity Relationships (ERD)

```mermaid
erDiagram
    USER ||--o{ ORDER : manages
    USER {
        string id PK
        string email UK
        string password
        enum role "ADMIN | BARISTA"
        datetime createdAt
    }

    DRINK_CATEGORY ||--o{ DRINK : contains
    DRINK_CATEGORY {
        string id PK
        string name
        int sortOrder
        datetime createdAt
    }

    DRINK ||--o{ DRINK_INGREDIENT : requires
    DRINK ||--o{ DRINK_MODIFIER_GROUP : offers
    DRINK ||--o{ ORDER_ITEM : ordered_as
    DRINK {
        string id PK
        string name
        string description
        decimal price
        boolean isAvailable
        int sortOrder
        string categoryId FK
    }

    INGREDIENT ||--o{ DRINK_INGREDIENT : used_in
    INGREDIENT ||--o{ MODIFIER_OPTION_INGREDIENT : used_in
    INGREDIENT {
        string id PK
        string name
        boolean isAvailable
        datetime createdAt
    }

    MODIFIER_GROUP ||--o{ DRINK_MODIFIER_GROUP : assigned_to
    MODIFIER_GROUP ||--o{ MODIFIER_OPTION : options
    MODIFIER_GROUP {
        string id PK
        string name
        boolean isRequired
        int minSelections
        int maxSelections
    }

    MODIFIER_OPTION ||--o{ MODIFIER_OPTION_INGREDIENT : depends_on
    MODIFIER_OPTION ||--o{ ORDER_ITEM_MODIFIER : selected_in
    MODIFIER_OPTION {
        string id PK
        string name
        decimal priceModifier
        boolean isDefault
        int sortOrder
        string groupId FK
    }

    ORDER ||--o{ ORDER_ITEM : contains
    ORDER ||--o| ORDER_TRACKING_TOKEN : issues
    ORDER {
        string id PK
        int orderNumber UK
        enum diningOption "DINE_IN | TAKEAWAY"
        string customerName
        decimal subtotal
        decimal total
        enum paymentStatus "PENDING | PAID | FAILED"
        string paymentMethod
        enum status "RECEIVED | PREPARING | READY_FOR_PICKUP | COLLECTED | CANCELLED"
        datetime createdAt
    }

    ORDER_ITEM ||--o{ ORDER_ITEM_MODIFIER : customized_with
    ORDER_ITEM {
        string id PK
        string orderId FK
        string drinkId FK
        string drinkName
        decimal unitPrice
        int quantity
        decimal subtotal
    }

    ORDER_TRACKING_TOKEN {
        string id PK
        string orderId FK,UK
        string tokenHash UK
        datetime expiresAt
        datetime createdAt
    }
```

---

## 4. Features

### Customer Kiosk Experience
- **Fluid Menu Browsing**: Categorized by Espresso, Iced, Specialty Drinks, and Artisanal Teas.
- **Dynamic Customization Engine**: Select drink sizes, dairy alternatives (Oat, Almond, Whole), syrup flavours, and sweetness levels.
- **Visual Feedback & Fallback Imagery**: Reusable `DrinkImage` component with high-resolution photography and instant SVG fallbacks.
- **Cart & Dining Selection**: Seamless toggle between *Dine-in* and *Takeaway*.
- **Touch-First Design**: Accessible, high-contrast, responsive layout designed for tablet kiosks and touch terminals.

### Staff Barista Display & Kitchen Queue
- **Real-Time Order Feed**: New paid orders pop up instantly on the Kitchen Display System (KDS) via WebSockets without page refreshes.
- **Stage Progression Controls**: Baristas can progress tickets with single-tap controls: `RECEIVED` → `PREPARING` → `READY_FOR_PICKUP` → `COLLECTED`.
- **Ingredient Inventory Toggles**: Real-time ingredient availability switches to immediately reflect kitchen shortages.

### Admin & Menu Management
- **Menu & Price Configuration**: Edit drink titles, descriptions, and prices with instant WebSocket propagation to all open kiosks (`/admin/menu`).
- **Revenue & Order Reporting**: Sales analytics, revenue summaries, and peak order metrics.
- **Role-Based Access Control**: Protected administrative routes with JWT authentication.

---

## 5. Monorepo Structure

```
cloud-nine-cafe/
├── apps/
│   ├── backend/                     # NestJS API Application
│   │   ├── src/
│   │   │   ├── auth/                # JWT Auth, guards, strategies
│   │   │   ├── users/               # Staff user management
│   │   │   ├── drinks/              # Drinks CRUD & Admin endpoints
│   │   │   ├── categories/          # Menu category management
│   │   │   ├── modifiers/           # Modifier groups & options
│   │   │   ├── ingredients/         # Inventory & ingredient status
│   │   │   ├── orders/              # Order lifecycle & state machine
│   │   │   ├── payments/            # PayHere & Sandbox checkout handlers
│   │   │   ├── tracking/            # QR code & token resolution
│   │   │   ├── availability/        # Dynamic cascade resolution engine
│   │   │   ├── realtime/            # Socket.IO WebSocket gateway
│   │   │   ├── reports/             # Sales summary & analytics
│   │   │   └── prisma/              # Prisma database client wrapper
│   │   └── prisma/
│   │       ├── schema.prisma        # Complete database schema
│   │       ├── seed.ts              # Database seeding script
│   │       └── migrations/          # SQL database migrations
│   │
│   └── frontend/                    # Next.js 16 Web Application
│       └── src/
│           ├── app/
│           │   ├── kiosk/           # Customer ordering & payment flow
│           │   │   ├── menu/        # Interactive menu catalog
│           │   │   ├── drink/[id]/  # Modifier customization
│           │   │   ├── cart/        # Cart review & payment init
│           │   │   ├── sandbox-checkout/ # In-app sandbox payment terminal
│           │   │   └── success/[token]/  # QR code confirmation
│           │   ├── tracking/[token]/# Mobile order tracker
│           │   ├── staff/           # Barista queue & ingredient toggles
│           │   └── admin/           # Dashboard & Menu management
│           ├── components/          # Reusable UI components
│           ├── contexts/            # Cart & App State contexts
│           ├── hooks/               # WebSocket connection hooks
│           └── lib/                 # Network & dynamic host resolution
│
├── docker-compose.yml               # Containerized stack orchestration
├── vercel.json                      # Vercel multi-service routing config
└── .env.example                     # Environment template
```

---

## 6. Setup & Installation

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10+`
- **PostgreSQL**: `v16+` (or Docker)

### Environment Variables

Copy the environment template:
```bash
cp .env.example .env
```

Configure the following values in `.env`:
```env
# Database
DATABASE_URL="postgresql://cloud_nine:cloud_nine@localhost:5434/cloud_nine?schema=public"

# Backend Configuration
PORT=3001
JWT_SECRET="generate-a-secure-random-secret-key"
JWT_EXPIRES_IN="8h"
CORS_ORIGIN="http://localhost:3000"
PUBLIC_URL="http://localhost:3000"
BACKEND_URL="http://localhost:3001"
TRACKING_TOKEN_EXPIRES_HOURS="24"

# PayHere Gateway Configuration (Sandbox / Production)
PAYHERE_MERCHANT_ID="your-merchant-id"
PAYHERE_MERCHANT_SECRET="your-merchant-secret"
PAYHERE_SANDBOX="true"

# Frontend Configuration
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Database Initialization

1. **Start PostgreSQL (via Docker)**:
   ```bash
   docker compose up -d postgres
   ```
2. **Apply Migrations**:
   ```bash
   npm run db:migrate
   ```
3. **Seed Default Menu & Accounts**:
   ```bash
   npm run db:seed
   ```

### Running Locally

Run both Frontend and Backend concurrently:
```bash
npm run dev
```

- **Customer Kiosk**: [http://localhost:3000/kiosk/menu](http://localhost:3000/kiosk/menu)
- **Barista Kitchen Display**: [http://localhost:3000/staff/orders](http://localhost:3000/staff/orders)
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

---

## 7. API Reference

### Public Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/categories` | Retrieve all categories with available drinks & modifiers |
| `GET` | `/drinks` | List all drinks with ingredient availability status |
| `GET` | `/drinks/:id` | Get single drink details and modifier configuration |
| `POST` | `/orders` | Submit a new customer order (creates `PENDING` order) |
| `POST` | `/payments/payhere/init/:orderId` | Generate checkout payload & hash for PayHere or Sandbox |
| `POST` | `/payments/payhere/notify` | Server-to-server payment confirmation webhook (MD5 signed) |
| `POST` | `/payments/payhere/sandbox/approve/:token` | Sandbox auto-approval endpoint (Sandbox mode only) |
| `GET` | `/payments/payhere/status/:orderId` | Query payment confirmation status by order ID or number |
| `GET` | `/payments/payhere/status/by-token/:token` | Query payment confirmation status by tracking token |
| `GET` | `/payments/payhere/status/latest` | Recovery status query for redirect fallbacks |
| `GET` | `/tracking/:token` | Fetch sanitized order status for public mobile tracking |
| `GET` | `/tracking/:token/qr` | Generate QR code PNG image for order tracking |

### Staff/Admin Endpoints (JWT Required)

| Method | Endpoint | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public | Staff & Admin authentication |
| `GET` | `/orders` | Barista / Admin | List all orders (filterable by status) |
| `GET` | `/orders/:id` | Barista / Admin | Get detailed order summary |
| `PATCH` | `/orders/:id/status` | Barista / Admin | Transition order status (`RECEIVED` → `PREPARING` → ...) |
| `POST` | `/drinks` | Admin | Create a new drink item on the menu |
| `PATCH` | `/drinks/:id` | Admin | Update drink name, price, description, or availability |
| `GET` | `/ingredients` | Barista / Admin | List all inventory ingredients |
| `PATCH` | `/ingredients/:id/availability` | Barista / Admin | Toggle ingredient availability state |
| `GET` | `/reports/summary` | Admin | Aggregate sales revenue and item counts |
| `GET` | `/reports/recent` | Admin | Recent transaction logs |

### WebSocket Events

```mermaid
classDiagram
    class ServerEmittedEvents {
        +order.created(Order)
        +order.statusChanged({ orderId, status })
        +ingredient.availabilityChanged({ ingredientId, isAvailable })
        +menu.availabilityChanged()
    }
```

---

## 8. Deployment Guide

### Docker Compose
Run the entire stack in isolated production containers:
```bash
docker compose up -d --build
```
This starts PostgreSQL, runs migrations automatically, seeds initial data, and brings up the Next.js frontend and NestJS backend.

### Vercel Deployment
The project is architected with a unified `vercel.json` routing configuration:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "apps/backend/dist/main" },
    { "source": "/(.*)", "destination": "apps/frontend" }
  ]
}
```

---

## 9. Testing

The repository contains end-to-end automated unit and integration tests across both frontend and backend:

```bash
# Run all tests across the monorepo
npm test

# Run backend unit tests specifically
cd apps/backend && npm test

# Type checking
npm run typecheck

# Production build verification
npm run build
```

**Test Coverage Highlights**:
- Payment hash generation and MD5 signature verification.
- PayHere webhook amount and currency tampering protection.
- Ingredient-to-drink cascade resolution algorithms.
- Valid & invalid finite order status transitions.
- Admin menu mutation permissions & input validation.

---

## 10. Default Credentials

Seed data provisions default accounts for immediate testing:

| Role | Email | Password | Access Area |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@cloudnine.com` | `admin123` | Full Dashboard, Menu Editor (`/admin/menu`), Reports |
| **Barista** | `barista@cloudnine.com` | `barista123` | Kitchen Queue (`/staff/orders`), Ingredients (`/staff/ingredients`) |

> ⚠️ *Ensure these credentials are rotated before production deployment.*

---

## 11. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Database Connection Refused** | PostgreSQL is not running or incorrect port | Ensure PostgreSQL is running on port `5434` (Docker) or update `DATABASE_URL` in `.env`. |
| **Mobile QR Tracking Shows Blank** | Client attempted to fetch `localhost` from phone | `resolveApiUrl()` automatically resolves the server IP. Ensure phone is on the same Wi-Fi network as the server. |
| **PayHere Sandbox "Unauthorized"** | Third-party PayHere sandbox gateway instability | In development, set `PAYHERE_SANDBOX=true` to automatically use the built-in local sandbox checkout. |
| **WebSocket Connection Failed** | CORS or mismatch in ports | Ensure `CORS_ORIGIN` in `.env` matches your frontend domain. |

---

## License

Private and proprietary. Developed for Cloud Nine Cafe Bar.
