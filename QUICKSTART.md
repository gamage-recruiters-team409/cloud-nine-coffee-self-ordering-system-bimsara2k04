# Quick Start Guide - Cloud Nine Cafe Bar

This guide will help you get the system running locally in under 5 minutes.

## Prerequisites Check

Before starting, verify you have:

```bash
node --version   # Should be v22+
npm --version    # Should be 10+
```

If PostgreSQL is not installed, install it:

```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt install postgresql-16

# Windows
# Download from https://www.postgresql.org/download/windows/
```

## Installation Steps

### 1. Clone and Install Dependencies

```bash
cd /Users/megatron/Projects/CloudeNine
npm install
```

This installs all dependencies for both frontend and backend.

### 2. Setup Environment

```bash
cp .env.example .env
```

The default `.env` file works for local development. No changes needed unless you have a different PostgreSQL setup.

### 3. Create Database

```bash
# Using createdb (recommended)
createdb cloud_nine

# OR using psql
psql postgres -c "CREATE DATABASE cloud_nine;"
```

### 4. Generate Prisma Client

```bash
cd apps/backend
npx prisma generate
cd ../..
```

### 5. Run Migrations

```bash
cd apps/backend
npx prisma migrate deploy
cd ../..
```

### 6. Seed Database

```bash
npm run db:seed
```

This creates sample data including:
- Admin user: `admin@cloudnine.com` / `admin123`
- Barista user: `barista@cloudnine.com` / `barista123`
- 16 drinks across 4 categories
- 15 ingredients
- 5 modifier groups

### 7. Start Development Servers

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

Backend will start on http://localhost:3001

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

Frontend will start on http://localhost:3000

### 8. Access the Application

Open your browser and navigate to:
- **Customer Kiosk**: http://localhost:3000
- **Staff Login**: http://localhost:3000/staff/login

## Testing the Complete Flow

### Customer Flow

1. Go to http://localhost:3000
2. Click "Start Ordering"
3. Browse the menu and select a drink (e.g., "Latte")
4. Customize your drink:
   - Select size: Medium
   - Select milk: Oat Milk
   - Add syrup: Vanilla
5. Click "Add to Cart"
6. Go to cart and click "Place Order"
7. You'll receive an order number and QR code
8. Click "Track Your Order" to see live status

### Staff Flow

1. Open a new tab: http://localhost:3000/staff/login
2. Login with:
   - Email: `barista@cloudnine.com`
   - Password: `barista123`
3. You'll see the order from the customer flow
4. Click "Mark as Preparing"
5. Switch back to the customer tracking page - it updates automatically!
6. Continue advancing the order status

### Test Ingredient Availability

1. In the staff interface, click "Manage Ingredients"
2. Toggle "Oat Milk" to unavailable
3. Go back to the customer kiosk
4. Try to order a Latte with Oat Milk - it will be disabled!
5. Toggle Oat Milk back to available

## Common Issues

### "Environment variable not found: DATABASE_URL"

**Solution:** Make sure you created the `.env` file:
```bash
cp .env.example .env
```

### "Database 'cloud_nine' does not exist"

**Solution:** Create the database:
```bash
createdb cloud_nine
```

### "Port 3000 is already in use"

**Solution:** Kill the process using port 3000:
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Prisma Client Not Generated

**Solution:** Generate the client manually:
```bash
cd apps/backend
npx prisma generate
```

### Migration Errors

**Solution:** Reset the database (⚠️ deletes all data):
```bash
cd apps/backend
npx prisma migrate reset
```

## Next Steps

- Explore the menu and add more drinks
- Test real-time updates by opening multiple browser windows
- Review the API documentation in `README.md`
- Customize the seed data in `apps/backend/prisma/seed.ts`

## Development Commands

```bash
# Start both servers
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test

# Database GUI
npm run db:studio

# View logs
# Backend logs appear in Terminal 1
# Frontend logs appear in Terminal 2 and browser console
```

## Production Deployment

For production deployment instructions, see the main `README.md` file.

## Support

If you encounter issues not covered here, check:
1. The main `README.md` for detailed troubleshooting
2. Prisma logs for database issues
3. Browser console for frontend errors
4. Backend terminal for API errors
