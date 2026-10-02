# Cloud Nine Cafe Bar - Self-Ordering System
## Comprehensive Project Report & Assignment Submission

**Candidate / Developer**: Bimsara Rathnayake  
**Project**: Cloud Nine Cafe Bar - Self-Ordering & Kitchen Display System  
**Repository**: [https://github.com/gamage-recruiters-team409/cloud-nine-coffee-self-ordering-system-bimsara2k04](https://github.com/gamage-recruiters-team409/cloud-nine-coffee-self-ordering-system-bimsara2k04)  
**Tech Stack**: Next.js 16 (App Router), NestJS 11, PostgreSQL 16, Prisma ORM, Socket.IO, Tailwind CSS, TypeScript

---

## 1. Executive Summary

The **Cloud Nine Cafe Bar Self-Ordering System** is an end-to-end, production-grade software solution engineered to digitize the customer ordering experience and streamline back-of-house kitchen operations for modern cafes. 

The system provides a touch-first kiosk interface for customers, an instant mobile order tracker accessible via dynamic QR codes, a real-time Barista Kitchen Display System (KDS), and an administrative suite for menu, pricing, inventory, and revenue analytics.

---

## 2. Features Implemented in the Project

### 📱 2.1 Customer Self-Ordering Kiosk
- **Category-Driven Menu Catalog**: Structured categorization across *Espresso*, *Iced Drinks*, *Specialty Concoctions*, and *Artisanal Teas*.
- **Comprehensive Modifier Customization**:
  - Drink size selections with dynamic pricing updates (e.g., Small, Regular, Large).
  - Milk alternatives (Whole Milk, Oat Milk, Almond Milk, Soy Milk).
  - Sweetness level adjustments (0%, 50%, 100%) and syrup flavor add-ons (Vanilla, Caramel, Hazelnut).
- **Interactive Cart & Dining Preference**: Real-time subtotal calculation, quantity adjustment, and *Dine-In* vs. *Takeaway* selection.
- **Dynamic Image Rendering with Fallbacks**: Custom `DrinkImage` component providing high-resolution product photography with automated SVG/CSS visual placeholders.

### 💳 2.2 Payment Gateway Integration & Sandbox Checkout
- **PayHere Payment Integration**:
  - Secure server-side MD5 signature hashing incorporating merchant secret, order ID, amount, and currency.
  - Server-to-server IPN webhook endpoint (`POST /payments/payhere/notify`) validating payment status and preventing amount tampering.
- **In-App Sandbox Checkout Mode**:
  - Built-in local payment terminal (`/kiosk/sandbox-checkout`) for testing without third-party gateway friction.
  - Instant sandbox auto-approval (`POST /payments/payhere/sandbox/approve/:token`) transitioning orders immediately to kitchen queue for smooth live demos.
- **Resilient Path Routing**: Return URL routing (`/kiosk/success/:token`) preserves order context even when external gateways strip query parameters.

### 📲 2.3 Dynamic QR Code & Mobile Order Tracking
- **Public Tokenized Tracking**: Secure, time-expiring UUID tokens (`OrderTrackingToken`) allow customers to track their drinks without authentication.
- **Dynamic LAN Host Resolution (`resolveApiUrl`)**: Ensures mobile devices scanning the QR code over local Wi-Fi or tunnels communicate with the correct backend host rather than deadlocking on `localhost`.
- **Live Status Push via WebSockets**: Real-time progress updates with automatic REST polling fallback.

### ☕ 2.4 Staff Barista Kitchen Display (KDS)
- **Live Order Feed**: Instant order dispatch pushed to the barista display via WebSockets as soon as payment is confirmed.
- **Strict Workflow State Machine**: Validates status progression:
  $$\text{RECEIVED} \longrightarrow \text{PREPARING} \longrightarrow \text{READY\_FOR\_PICKUP} \longrightarrow \text{COLLECTED}$$
  *Invalid transitions or backward jumps are strictly rejected by the backend.*
- **Ingredient Inventory Management**: One-tap toggles for ingredient availability with immediate visual indicators.

### ⚡ 2.5 Real-Time Cascading Availability Engine
- **Automated Cascade Resolution**:
  - When an ingredient (e.g., *Oat Milk*) is toggled out of stock, all dependent modifier options and drinks automatically disable across all open kiosks.
  - Independent menu visibility (`isAvailable`) vs sellability (`isOrderable`), ensuring admin controls remain functional even when raw ingredients run low.
- **Instant WebSocket Synchronization**: Emits `menu.availabilityChanged` and `ingredient.availabilityChanged` events.

### 🛠️ 2.6 Admin Dashboard & Menu Management
- **Menu & Price Editor (`/admin/menu`)**: Full administrative interface for creating drinks (`POST /drinks`), updating prices, descriptions, sort orders, and toggling menu visibility (`PATCH /drinks/:id`).
- **Revenue Analytics & Reporting**: Summarized metrics on daily revenue, order volumes, and top-selling beverages.
- **Role-Based Access Control (RBAC)**: Guarded via Passport JWT authentication (`ADMIN` and `BARISTA` roles).

---

## 3. Learning Outcomes from this Assignment

1. **Monorepo Architecture & Type Sharing**:
   - Mastered managing multi-package workspaces with npm workspaces, sharing TypeScript interfaces across frontend and backend packages without code duplication.
2. **Real-Time Distributed State Synchronization**:
   - Gained deep practical expertise in WebSockets (Socket.IO) for cross-client event broadcasting, handling disconnections, client reconnection lifecycles, and synchronization fallbacks.
3. **Payment Gateway Security Engineering**:
   - Implemented cryptographic payload hashing (MD5 checksums), server-to-server webhook verification, replay attack prevention, and payment idempotency.
4. **Prisma ORM & Relational Schema Modeling**:
   - Designed normalized relational models featuring many-to-many join tables with explicit cascade deletes, composite indexes, and decimal precision handling for financial values.
5. **Production Build & Prerendering Optimization**:
   - Navigated Next.js 16 App Router streaming, client boundary segregation, dynamic routing, and `<Suspense>` wrapper requirements for client query parameters during static generation.

---

## 4. Challenges Faced & Solutions

### Challenge 1: The "Localhost Trap" on Mobile QR Code Tracking
* **Problem**: In local testing and cafe LAN environments, generating a tracking URL containing `http://localhost:3000/tracking/...` worked on the kiosk machine but failed completely when customers scanned the QR code on their mobile smartphones (since their phone attempted to resolve its own loopback).
* **Solution**: Engineered a dynamic host resolution utility (`resolveApiUrl` and client-side runtime origin detection). The backend generates QR URLs based on the server's network-accessible address (`PUBLIC_URL`), and the frontend dynamically inspects `window.location` to connect REST and WebSocket requests to the originating server host.

### Challenge 2: PayHere Redirect Query Parameter Stripping
* **Problem**: PayHere hosted checkout redirects often strip query parameters upon returning to `return_url`, losing the customer's `orderId` or `orderNumber` and causing the success screen to show an empty state.
* **Solution**: Refactored the tracking architecture to embed the secure tracking token directly into the **URL path segment** (`/kiosk/success/:token`) rather than query parameters. Added a fallback lookup endpoint (`GET /payments/payhere/status/by-token/:token`) and client-side `sessionStorage` backup (`rememberPendingOrder`) to ensure 100% reliability.

### Challenge 3: Third-Party Sandbox Gateway Downtime & Latency
* **Problem**: The external PayHere sandbox environment intermittently failed with "Unauthorized payment request" errors and required public webhook tunnels (ngrok) for local development demos.
* **Solution**: Developed a dual-mode payment architecture. When `PAYHERE_SANDBOX=true`, the backend seamlessly serves an internal test checkout page (`/kiosk/sandbox-checkout`) with card simulation and instant backend approval (`POST /payments/payhere/sandbox/approve/:token`), completely decoupling local testing from external gateway downtime while keeping live PayHere code intact for production.

### Challenge 4: Availability Overwrite vs Admin Menu Visibility
* **Problem**: When a drink's ingredient was out of stock, the backend combined check previously overwrote the database `isAvailable` flag. When the admin tried to toggle the drink back on, the API response still returned `false`, making the UI button appear unclickable.
* **Solution**: Decoupled menu visibility from sellability:
  - `isAvailable`: Controls whether the admin wants the item displayed on the menu.
  - `isOrderable`: Dynamically computed boolean verifying if all required ingredients are in stock.

---

## 5. System Verification & Quality Evidence

### 🧪 5.1 Test Suite Results
The project contains comprehensive unit and integration test coverage across all domain services:

```bash
> npm test

PASS src/drinks/drinks.service.spec.ts
PASS src/realtime/realtime.gateway.spec.ts
PASS src/drinks/dto/update-drink.dto.spec.ts
PASS src/payments/payments.service.spec.ts
PASS src/availability/availability.service.spec.ts
PASS src/orders/orders.service.spec.ts
PASS src/payments/payhere.util.spec.ts

Test Suites: 7 passed, 7 total
Tests:       107 passed, 107 total
Snapshots:   0 total
Time:        1.808 s
Ran all test suites.
```

### ⚡ 5.2 Next.js Production Build
```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /admin/menu
├ ○ /kiosk
├ ○ /kiosk/cart
├ ƒ /kiosk/drink/[id]
├ ○ /kiosk/menu
├ ○ /kiosk/payment-cancelled
├ ○ /kiosk/sandbox-checkout
├ ƒ /kiosk/success
├ ƒ /kiosk/success/[token]
├ ○ /staff/ingredients
├ ○ /staff/login
├ ○ /staff/orders
└ ƒ /tracking/[token]

✓ Compiled successfully (13 routes generated)
```

---

## 6. GitHub Repository & Deployment Details

- **GitHub Repository**: [https://github.com/gamage-recruiters-team409/cloud-nine-coffee-self-ordering-system-bimsara2k04](https://github.com/gamage-recruiters-team409/cloud-nine-coffee-self-ordering-system-bimsara2k04)
- **Active Development Branch**: `dev`
- **Main Production Branch**: `main`

---

## 7. Important Notes & Credentials

### Default Credentials (Seed Data)
| Role | Email | Password | Access Routes |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@cloudnine.com` | `admin123` | `/admin`, `/admin/menu`, `/staff/*` |
| **Barista** | `barista@cloudnine.com` | `barista123` | `/staff/orders`, `/staff/ingredients` |

### Quick Start Commands
```bash
# 1. Install all monorepo dependencies
npm install

# 2. Start PostgreSQL container
docker compose up -d postgres

# 3. Apply schema migrations and seed initial data
npm run db:migrate
npm run db:seed

# 4. Start both Backend (Port 3001) & Frontend (Port 3000)
npm run dev
```

---
*Report prepared for the Cloud Nine Cafe Bar Self-Ordering System evaluation.*
