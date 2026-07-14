# Ticket Booking System -- Deployment Guide

## Table of Contents

- [Docker Compose (Full Stack)](#docker-compose-full-stack)
- [Manual Deployment](#manual-deployment)
- [Production Checklist](#production-checklist)
- [Environment Configuration](#environment-configuration)
- [Scaling](#scaling)
- [Monitoring](#monitoring)
- [Backup & Recovery](#backup--recovery)

---

## Docker Compose (Full Stack)

The easiest way to deploy the full application stack is with Docker Compose.

```bash
# Build and start all services
docker compose up --build -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

This starts:
| Service | Container | Port |
|---------|-----------|------|
| PostgreSQL 16 | `postgres` | `5433` |
| Redis 7 | `redis` | `6379` |
| Backend (Express) | `backend` | `4000` |
| Frontend (Next.js) | `frontend` | `3000` |

### Health checks

All services have Docker health checks configured. The backend waits for PostgreSQL and Redis to be healthy before starting. The frontend waits for the backend to be healthy before starting.

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' ticket-booking-backend-1
```

### Rebuild a single service

```bash
docker compose up -d --build backend
```

---

## Manual Deployment

### Backend

```bash
cd backend

# Install dependencies
npm install --production

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Start server
NODE_ENV=production npm start
```

For process management, use a production process manager:

```bash
npm install -g pm2

# Start with PM2
pm2 start src/server.js --name ticket-booking-api -i 2

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build static files
npm run build

# Start production server
npm start
```

For static hosting (e.g., Nginx + CDN):

```bash
# Build produces static files in frontend/.next/
# Serve these with any static file server or CDN

# Alternative: export static HTML
npx next build
npx next export
```

---

## Production Checklist

### Security

1. **Change JWT secrets**: Generate strong random secrets for both `JWT_SECRET` and `JWT_REFRESH_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Database**: Use strong PostgreSQL credentials, restrict network access, enable SSL.

3. **Redis**: Set a `requirepass` in production Redis config, use TLS if possible.

4. **HTTPS**: Place a reverse proxy (Nginx, Caddy, Traefik) in front of both frontend and backend:
   ```nginx
   server {
       listen 443 ssl;
       server_name api.ticketbooking.com;

       ssl_certificate /etc/ssl/certs/ticketbooking.crt;
       ssl_certificate_key /etc/ssl/private/ticketbooking.key;

       location / {
           proxy_pass http://127.0.0.1:4000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # WebSocket support
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

5. **CORS**: Set `FRONTEND_URL` to the exact production frontend origin.

6. **Helmet**: Content Security Policy (CSP) headers are set by Helmet. Adjust CSP in `app.js` if needed for external resources (CDN fonts, images).

7. **Rate limiting**: Auth endpoints are limited to 20 req/min, general API to 100 req/min. Adjust in `routes/index.js` for production load.

8. **SMTP**: Use a production email service (SendGrid, AWS SES, Mailgun) instead of Gmail SMTP.

### Environment Variables

Create a `.env` file in `backend/` with production values:

```env
# Database
DATABASE_URL="postgresql://ticketuser:STRONG_PASSWORD@prod-db-host:5432/ticketdb?schema=public&ssl=true"

# Auth secrets (generate with crypto.randomBytes)
JWT_SECRET="<64-char-hex>"
JWT_REFRESH_SECRET="<64-char-hex>"

# Server
PORT=4000
FRONTEND_URL="https://ticketbooking.com"

# Redis
REDIS_URL="redis://:password@prod-redis-host:6379"

# SMTP (production provider)
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASS="SG.xxxxx"
EMAIL_FROM="noreply@ticketbooking.com"

# BullMQ
BULLMQ_JOB_ATTEMPTS=3
BULLMQ_BACKOFF_DELAY_MS=5000

# TTLs
SEAT_HOLD_TTL_MINUTES=10
WAITLIST_OFFER_TTL_MINUTES=15

# Logging
LOG_LEVEL=info

# Scraper (Parse.bot or equivalent)
PARSE_API_KEY=""
PARSE_BASE_URL=""
```

### Database

```bash
# Run migrations
npx prisma migrate deploy

# Seed production data (if needed)
npx prisma db seed
```

### Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://api.ticketbooking.com/api
NEXT_PUBLIC_WS_URL=https://api.ticketbooking.com
```

---

## Scaling

### Horizontal Scaling (Backend)

The backend is stateless (JWT auth, no session affinity needed) and can be scaled horizontally:

```bash
# PM2 cluster mode
pm2 start src/server.js -i max

# Or with Docker Compose
docker compose up -d --scale backend=3
```

#### Considerations for multi-instance:

- **Redis**: Required for distributed locks and BullMQ. All instances share the same Redis.
- **Socket.IO**: Use Redis adapter for cross-instance WebSocket communication:
  ```js
  const { createAdapter } = require('@socket.io/redis-adapter');
  const { createClient } = require('redis');
  const pubClient = createClient({ url: env.REDIS_URL });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
  ```
- **BullMQ**: Already uses Redis for job coordination -- works across instances.
- **Idempotency**: Database-backed, works across instances.
- **Rate limiting**: Currently in-memory (per-instance). In production, use Redis-backed rate limiting.

### Database

- **Read replicas**: Configure Prisma to use read replicas for query-heavy endpoints
  (seat maps, movie listings, search).
- **Connection pooling**: Use PgBouncer or the built-in `@prisma/adapter-pg` pool.

### Caching

- Add Redis caching for frequently-read data (movie listings, venue lists, seat maps).
- Add in-memory caching with TTL for static reference data.

---

## Monitoring

### Health Endpoint

```
GET /api/health

Response: { "success": true, "data": { "uptime": 1234.56 }, "message": "Ticket Booking API running" }
```

Configure your load balancer or container orchestrator to use this as the health check path.

### Logging

- Set `LOG_LEVEL=info` in production for standard operational logging.
- Set `LOG_LEVEL=debug` temporarily when troubleshooting.
- Logs go to stdout. Use a log aggregator (Datadog, Grafana Loki, ELK) for collection.

### BullMQ Monitoring

BullMQ provides a monitoring UI:

```bash
npm install -g @bull-board/api @bull-board/express

# Mount at /admin/queues in development only
```

### Database Monitoring

```bash
# Check active connections
npx prisma studio

# Or via PostgreSQL
SELECT count(*) FROM pg_stat_activity WHERE datname = 'ticketdb';
```

---

## Backup & Recovery

### PostgreSQL

```bash
# Backup
pg_dump -h localhost -p 5433 -U ticketuser ticketdb > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
psql -h localhost -p 5433 -U ticketuser -d ticketdb < backup.sql
```

### Docker Volume Backup

```bash
# Backup PostgreSQL data
docker run --rm -v ticket-booking_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Backup Redis data
docker run --rm -v ticket-booking_redis_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/redis-backup.tar.gz -C /data .
```

### Automated Backup (Cron)

```bash
# Daily at 3 AM
0 3 * * * /usr/local/bin/pg_dump -h localhost -U ticketuser ticketdb | gzip > /backups/ticketdb_$(date +\%Y\%m\%d).sql.gz
```

---

## Troubleshooting Production Issues

### Application won't start

1. Check environment variables are set correctly.
2. Verify database connectivity: `psql $DATABASE_URL`
3. Check Prisma migrations are applied: `npx prisma migrate status`
4. Check logs: `docker compose logs backend`

### Redis unavailable

If Redis is down, the system falls back gracefully:
- Seat holds expire via database-based fallback cron
- BullMQ jobs are disabled (no emails, no waitlist promotion)
- Socket.IO still works but only broadcasts within a single instance

### Database connection pool exhausted

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
-- Increase pool size in Prisma config if needed
```

### Socket.IO connection issues

Ensure the reverse proxy is configured for WebSocket upgrades (see Nginx config above). Without proper WebSocket support, Socket.IO falls back to long-polling.

---

## CI/CD Pipeline (Recommended)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd backend && npm install && npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          docker compose pull
          docker compose up -d --build
```

---

## Architecture Diagram (Deployment)

```
                         Internet
                            |
                     [Cloudflare/CDN]
                            |
                 +----------+----------+
                 |                     |
          ticketbooking.com     api.ticketbooking.com
                 |                     |
         [Nginx Proxy]           [Nginx Proxy]
                 |                     |
         Next.js Frontend        Express Backend
          (port 3000)              (port 4000)
                 |                     |
                 +---------+-----------+
                           |
                  +--------+--------+
                  |                  |
            PostgreSQL            Redis
           (primary data)      (cache + queues)
```
