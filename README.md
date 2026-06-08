# HTTP Monitor

A full-stack application that pings `https://httpbin.org/anything` on a configurable schedule, stores each result in PostgreSQL, and streams live updates to a real-time dashboard with rolling analytics and anomaly detection.

**Live app: [Ping Monitor](https://ping-monitor-production-6110.up.railway.app/)**

---

## Quick start

### Prerequisites

- Node.js 22+
- PostgreSQL 16+

### One command

```bash
npm run setup
```

This script (`dev.sh`) does everything in order:

1. Checks for `monitor-backend/.env` — if missing, copies `.env.example` and exits so you can fill in `DATABASE_URL` first
2. Wipes all `node_modules` and the root `package-lock.json`, then runs a clean `npm install` from the workspace root
3. Runs `prisma migrate dev` to apply any pending migrations (creates the database if it does not exist)
4. Starts the backend (port 3000) and frontend dev server (port 5173) side by side via `concurrently`

Open http://localhost:5173 — the Vite dev server proxies `/api` and `/socket.io` to the backend.

### First run only

```bash
cp monitor-backend/.env.example monitor-backend/.env
# edit monitor-backend/.env — set DATABASE_URL
npm run setup
```

### Subsequent runs

```bash
npm run dev
```

---

## Local development with Docker

No local PostgreSQL needed — spins up the app and a database container together.

```bash
docker compose up --build
```

Open http://localhost:3000. Migrations run automatically on container start.

```bash
docker compose down        # stop
docker compose down -v     # stop and wipe the database volume
```

> Credentials in `docker-compose.yml` are local-only defaults. If you change them, update the `DATABASE_URL` in the `app` service and URL-encode any special characters (`@` → `%40`).

---

## Project structure

```
.
├── monitor-backend/        NestJS API, scheduler, WebSocket gateway
│   ├── prisma/             Schema and migrations
│   ├── src/
│   │   ├── analytics/      Rolling stats, EWMA forecast, anomaly detection
│   │   ├── common/         Shared utilities (payload generator)
│   │   ├── config/         Typed configuration factory
│   │   ├── database/       Prisma service
│   │   ├── gateway/        Socket.io gateway
│   │   ├── pings/          HTTP ping execution, history, stats
│   │   └── scheduler/      CronJob wiring
│   └── test/               E2E tests
├── monitor-frontend/       React + Vite dashboard
│   └── src/
│       ├── api/            REST client
│       ├── components/     UI components
│       ├── hooks/          Data-fetching and socket hooks
│       └── types/
├── dev.sh                  One-command local setup script
├── Dockerfile              Multi-stage build (builder → production)
├── docker-compose.yml      Local full-stack with PostgreSQL
└── .github/workflows/      CI pipeline
```

---

## Architecture

Single deployment unit: NestJS serves the compiled React build as static files. One process, one port, one Railway service.

```
Browser
  │
  ├── HTTP  GET /api/*       NestJS controllers
  ├── HTTP  POST /api/*
  ├── WS    /socket.io       Socket.io gateway
  └── HTTP  GET /            React SPA (served by ServeStaticModule)

NestJS (port 3000)
  ├── SchedulerService       CronJob every 5 min
  │     ├── PingsService     POST to httpbin, persist result
  │     ├── PingsGateway     broadcast new_ping + anomaly_detected
  │     └── AnalyticsService anomaly check after each ping
  ├── PingsController        GET /api/pings, /stats, /:id  POST /trigger
  ├── AnalyticsController    GET /api/analytics?window=1-24
  └── PrismaService          PostgreSQL via Prisma ORM
```

---

## Database schema

Single table. `payload` and `responseBody` store arbitrary JSON — the request body sent to httpbin and the echoed response.

```
PingRecord
─────────────────────────────────────────────────
id            String    PK, UUID
url           String    target that was pinged
method        String    always "POST"
payload       Json      request body
statusCode    Int?      HTTP status (null on network error)
responseBody  Json?     response body (null on failure)
responseTime  Int       elapsed time in ms
success       Boolean   false if request failed or timed out
errorMessage  String?   set only on failure
createdAt     DateTime  auto timestamp

Indexes: createdAt DESC, success
```

Migrations live in `monitor-backend/prisma/migrations/` and are applied via `prisma migrate deploy` in the production container start command.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | required | PostgreSQL connection string |
| `PORT` | `3000` | HTTP server port |
| `PING_URL` | `https://httpbin.org/anything` | Target URL to ping |
| `PING_CRON` | `*/5 * * * *` | Cron expression for the ping schedule |
| `REQUEST_TIMEOUT_MS` | `10000` | HTTP request timeout in ms |
| `NODE_ENV` | `development` | Set to `production` in the Docker image |

---

## Technology choices

**NestJS** — module system with first-class support for scheduling (`@nestjs/schedule`), WebSockets (`@nestjs/websockets`), and static file serving. Each concern lives in its own module with minimal boilerplate.

**Prisma** — schema-to-type generation with straightforward migration management. `prisma migrate dev` for local, `prisma migrate deploy` for production.

**Socket.io** — reliable WebSocket library with automatic reconnection. The scheduler pushes `new_ping` and `anomaly_detected` events separately so the dashboard can surface an alert banner without the table needing to re-fetch.

**React + Vite + Tailwind CSS v4** — fast dev cycle. Tailwind v4 uses a single CSS import with no config file. Vite proxies `/api` and `/socket.io` to the backend during development.

**Recharts** — `ComposedChart` lets a `Line`, `Area`, `Scatter`, and `ReferenceLine` share the same axes and dataset without custom SVG.

**EWMA forecasting (α = 0.3)** — exponentially weighted moving average over the selected window. Chosen over linear regression because HTTP response time reverts to a baseline rather than trending. α = 0.3 gives meaningful weight to roughly the last 10 observations.

**Z-score anomaly detection** — `z = |x − μ| / max(σ, 50ms)`. The σ floor prevents false positives when variance is very low. Threshold 2.5 flags the outer ~1% of a normal distribution. Failed pings are unconditionally anomalous.

**npm workspaces** — single `node_modules` at root, single `package-lock.json`. One `npm install` from root covers both packages. CI and Docker both use this.

---

## Testing

```bash
npm run test:cov   # unit tests with coverage
npm run test:e2e   # e2e tests
```

**Unit tests** (`monitor-backend/src/pings/pings.service.spec.ts`) — `PingsService` is the core component. Prisma and axios are mocked. Coverage: `generatePayload` structure and uniqueness, `executePing` success and failure paths (network error, 5xx, non-Axios errors), `getHistory` pagination, `getStats` aggregates including null and zero-total edge cases.

**E2E tests** (`monitor-backend/test/app.e2e-spec.ts`) — Supertest against a real NestJS instance with all infrastructure providers mocked. No database required. Coverage: all `/api/pings` routes, pagination validation, 404 handling, WebSocket broadcast on trigger.

**CI** (`.github/workflows/ci.yml`) — runs on every push and PR to `main`: lint → unit tests with coverage upload → e2e tests.

---

## Deployment

The app runs as a single Railway service — NestJS serves the API, WebSocket, and React frontend from one URL.

1. Create a new Railway project and connect the GitHub repository (root directory, no subdirectory)
2. Railway detects the `Dockerfile` automatically
3. Add a **PostgreSQL** plugin — Railway injects `DATABASE_URL` into the service automatically
4. Deploy — the container runs `prisma migrate deploy` then `node dist/main`
5. Generate a public domain in Railway service settings

No environment variables need to be set manually for a basic deployment.

---

## Future improvements

- **Multi-target monitoring** — configure multiple URLs with per-URL stats and charts
- **Alerting** — email or webhook notification on anomaly or when success rate drops below a threshold
- **Authentication** — API key or OAuth to protect the dashboard and trigger endpoint
- **Smarter anomaly detection** — sliding-window z-score or seasonal decomposition to handle daily traffic patterns
- **Retention policy** — auto-delete or archive records older than N days to keep the table size bounded
- **Frontend tests** — React Testing Library for hooks and chart components
- **Database aggregations** — SQL windowing functions for windows larger than 24 h instead of loading all rows into memory

---

## Assumptions

- The target URL always accepts a POST with a JSON body and echoes it back. The payload generator produces varied objects that resemble realistic API traffic.
- A single table is sufficient — no multi-tenancy or per-user isolation.
- The WebSocket gateway is unauthenticated; all connected clients receive all events.
- Rolling analytics are computed in application memory from a DB query. At 5-minute ping intervals this is at most a few hundred rows per 24-hour window, well within acceptable memory and latency bounds.
