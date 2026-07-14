# Ticket Booking System -- Setup Guide

## Prerequisites

- **Node.js** 22+ (tested with 22.x)
- **npm** 10+
- **Docker & Docker Compose** (for PostgreSQL and Redis)
- **Git** (optional, for version control)

---

## Quick Start (Local Development)

### 1. Clone and install dependencies

```bash
cd ticket-booking

# Backend
cd backend
npm install
npx prisma generate

# Frontend
cd ../frontend
npm install
```

### 2. Start infrastructure services

```bash
# From ticket-booking/
docker compose up -d postgres redis
```

This starts:
- **PostgreSQL 16** on port `5433` (mapped from container port `5432`)
- **Redis 7** on port `6379`

### 3. Configure environment

The backend `.env` file is pre-configured for local development:

```env
# Database
DATABASE_URL="postgresql://ticketuser:ticketpass@localhost:5433/ticketdb?schema=public"

# Auth secrets (change in production)
JWT_SECRET="dev-jwt-secret-change-in-production"
JWT_REFRESH_SECRET="dev-refresh-secret-change-in-production"

# Server
PORT=4000
FRONTEND_URL="http://localhost:3000"

# Redis
REDIS_URL="redis://localhost:6379"

# SMTP (optional, for email features)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="ticket_booking@ticketbooking.com"

# BullMQ
BULLMQ_JOB_ATTEMPTS=3
BULLMQ_BACKOFF_DELAY_MS=5000

# Seat hold / waitlist TTL
SEAT_HOLD_TTL_MINUTES=10
WAITLIST_OFFER_TTL_MINUTES=15

# Logging
LOG_LEVEL=debug
```

**Note:** The PostgreSQL port in Docker Compose is `5433:5432` to avoid conflicts with a local PostgreSQL instance on the default port `5432`. The `DATABASE_URL` in `.env` uses `localhost:5433`.

### 4. Run database migrations

```bash
cd backend
npx prisma migrate dev --name init
```

### 5. Seed demo data

```bash
cd backend
npm run prisma:seed
```

This creates:
- **Admin**: admin@ticketbook.com / admin123
- **Organizer**: organizer@ticketbook.com / organizer123
- **Customer**: customer@ticketbook.com / customer123
- Sample venues (Mumbai, Delhi, Bangalore, Chennai, Hyderabad)
- Sample movies with events and auto-generated seats

### 6. Start the application

```bash
# Terminal 1 -- Backend (port 4000)
cd backend && npm run dev

# Terminal 2 -- Frontend (port 3000)
cd frontend && npm run dev
```

### 7. Open the app

Navigate to [http://localhost:3000](http://localhost:3000).

---

## Configuration Reference

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend server port |
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `JWT_SECRET` | `dev-jwt-secret` | Secret for signing access tokens (15-min expiry) |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret` | Secret for signing refresh tokens (7-day expiry) |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | (empty) | SMTP username |
| `SMTP_PASS` | (empty) | SMTP password or app password |
| `EMAIL_FROM` | `noreply@ticketbooking.com` | From address for emails |
| `BULLMQ_JOB_ATTEMPTS` | `3` | Max retry attempts for failed jobs |
| `BULLMQ_BACKOFF_DELAY_MS` | `5000` | Delay between job retries |
| `SEAT_HOLD_TTL_MINUTES` | `10` | Duration seats stay on hold |
| `WAITLIST_OFFER_TTL_MINUTES` | `15` | Duration waitlist promoted user has to book |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `PARSE_API_KEY` | (empty) | API key for Parse.bot scraper |
| `PARSE_BASE_URL` | (empty) | Base URL for Parse.bot scraper |

### Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | Backend API base URL |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:4000` | Socket.IO server URL |

These are set in `frontend/.env.local` (create if needed):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

---

## Running Without Docker

### PostgreSQL

Install PostgreSQL locally and create the database:

```bash
psql -U postgres -c "CREATE USER ticketuser WITH PASSWORD 'ticketpass';"
psql -U postgres -c "CREATE DATABASE ticketdb OWNER ticketuser;"
```

Update `DATABASE_URL` in `.env` to use your local PostgreSQL port (usually `5432`).

### Redis

Install Redis locally and start the server:

```bash
redis-server
```

The application will gracefully degrade if Redis is unavailable (falls back to database-only seat cleanup, no caching/locking).

---

## Database Migrations

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name describe_change

# Apply migrations in production
npx prisma migrate deploy

# Reset database (drops all data)
npx prisma migrate reset

# Open Prisma Studio (GUI database browser)
npx prisma studio
```

The project uses Prisma 7 with the `@prisma/adapter-pg` driver adapter for optimal PostgreSQL performance.

---

## Available Scripts

### Backend (`cd backend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with nodemon (auto-restart on changes) |
| `npm start` | Start in production mode |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run development migrations |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:seed` | Seed demo data |
| `npm run worker:bullmq` | Start BullMQ worker process separately |
| `npm test` | Run tests (Jest) |

### Frontend (`cd frontend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm start` | Start production server |

---

## Common Issues

### Port already in use

```bash
# Kill processes on common ports
npx kill-port 3000 4000

# Or manually on Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Redis unavailable warning

The app logs `Redis unavailable, running without caching/locking` if Redis is not reachable. The system continues to work:
- Seat holds use database TTL checks instead of Redis
- Fallback cron (`setInterval` at 30s) handles expired seat cleanup
- BullMQ job queues are unavailable (email sending, waitlist promotion)

Start Redis with `docker compose up -d redis` to restore full functionality.

### Database connection refused

Ensure PostgreSQL is running and the port in `DATABASE_URL` matches the mapped port in `docker-compose.yml` (default: `5433`).

### Prisma client not found

Run `npx prisma generate` from the `backend/` directory after installing dependencies.

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ticketbook.com | admin123 |
| Organizer | organizer@ticketbook.com | organizer123 |
| Customer | customer@ticketbook.com | customer123 |
