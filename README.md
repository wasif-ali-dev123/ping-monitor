# HTTP Monitor

A full-stack application that pings `https://httpbin.org/anything` on a configurable schedule, stores each result, and streams live updates to a real-time dashboard with analytics and anomaly detection.

---

## Setup

### Prerequisites

- Node.js 22+
- PostgreSQL 16+ (or Docker)

### Local development (hot-reload)

```bash
# Install all dependencies (npm workspaces — single install from root)
npm install

# Copy env template and fill in DATABASE_URL
cp monitor-backend/.env.example monitor-backend/.env

# Apply migrations and generate Prisma client
cd monitor-backend && npx prisma migrate dev && cd ..

# Start backend (port 3000) in one terminal
npm run dev -w monitor-backend

# Start frontend dev server (port 5173, proxies /api and /socket.io) in another
npm run dev -w monitor-frontend
```

Open http://localhost:5173.

### Local development with Docker

Spins up the app and a PostgreSQL container — no local Postgres needed.

```bash
docker compose up --build
```

Open http://localhost:3000. Migrations run automatically on startup.

To stop:

```bash
docker compose down
```

To also wipe the database volume:

```bash
docker compose down -v
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | required | PostgreSQL connection string |
| `PING_URL` | `https://httpbin.org/anything` | Target URL |
| `PING_CRON` | `*/5 * * * *` | Cron expression for the ping schedule |
| `REQUEST_TIMEOUT_MS` | `10000` | HTTP request timeout in milliseconds |

---

## Architecture

The system is a monorepo (`npm workspaces`) with two packages: a NestJS backend and a React frontend. In production, NestJS serves the compiled React build as static files — one process, one port, one deployment.

```
┌─────────────────────────────────────────┐
│              Browser client             │
│  REST (fetch /api/*)                    │
│  WebSocket (socket.io)                  │
└────────────┬───────────────┬────────────┘
             │               │
     HTTP/REST            WebSocket
             │               │
┌────────────▼───────────────▼────────────┐
│            NestJS (port 3000)           │
│                                         │
│  PingsController   GET /api/pings       │
│                    GET /api/pings/stats │
│                    GET /api/pings/:id   │
│                    POST /api/pings/trigger │
│                                         │
│  AnalyticsController  GET /api/analytics│
│                                         │
│  PingsGateway      emit new_ping        │
│                    emit anomaly_detected│
│                                         │
│  SchedulerService  CronJob every 5 min  │
│    → PingsService.executePing()         │
│    → PingsGateway.broadcastNewPing()    │
│    → AnalyticsService (anomaly check)  │
│    → PingsGateway.broadcastAnomaly()   │
│                                         │
│  ServeStaticModule  GET / (React SPA)  │
└────────────────────────┬────────────────┘
                         │ Prisma ORM
                         ▼
                   PostgreSQL
                   (ping_records table)
```

### Backend modules

| Module | Responsibility |
|---|---|
| `PingsModule` | Execute HTTP pings, persist results, serve history/stats |
| `SchedulerModule` | Register and run the CronJob; wire ping → broadcast → anomaly check |
| `GatewayModule` | Socket.io gateway; broadcast `new_ping` and `anomaly_detected` |
| `AnalyticsModule` | Compute rolling stats, EWMA forecast, z-score anomaly detection |
| `DatabaseModule` | Global Prisma client with lifecycle hooks |

### Frontend components

| Component / Hook | Responsibility |
|---|---|
| `useSocket` | Manages the Socket.io connection; calls back on `new_ping` / `anomaly_detected` |
| `usePings` | Fetches paginated ping history; exposes `prependPing` for live updates |
| `useStats` | Fetches and refreshes aggregate stats |
| `useAnalytics` | Fetches analytics for the selected time window |
| `StatsCards` | Displays total, success rate, avg/min/max response time |
| `ResponseChart` | Recharts ComposedChart — response times, rolling mean, confidence band, forecast reference line, anomaly dots |
| `PingTable` | Paginated table of ping records with status badges and row highlight on new arrivals |

---

## Technology choices

**NestJS** — chosen for its module system and first-class support for scheduling (`@nestjs/schedule`), WebSockets (`@nestjs/websockets`), configuration, and static file serving. The decorator-driven approach keeps each concern in its own module without boilerplate.

**Prisma** — straightforward schema-to-type generation with good PostgreSQL support. Migration management via `prisma migrate dev` / `prisma migrate deploy` covers both local and production workflows cleanly.

**Socket.io** — reliable WebSocket library with automatic reconnection and fallback. The frontend receives `new_ping` events without polling; the server pushes `anomaly_detected` separately so the UI can surface an alert without the dashboard needing to re-fetch.

**React + Vite + Tailwind CSS v4** — fast dev cycle. Tailwind v4 drops the config file; styles are imported directly in CSS. Vite proxies `/api` and `/socket.io` to the backend during development so there are no CORS concerns locally.

**Recharts** — composable chart library for React. `ComposedChart` lets a `Line`, `Area`, `Scatter`, and `ReferenceLine` share the same axes and dataset without custom SVG.

**EWMA forecasting (α = 0.3)** — exponentially weighted moving average over the selected window. Chosen over linear regression because HTTP response time reverts to a baseline rather than trending monotonically. α = 0.3 weights roughly the last 10 observations meaningfully without over-reacting to individual spikes.

**Z-score anomaly detection** — `z = |x − μ| / max(σ, 50ms)`. The σ floor of 50 ms prevents false positives when variance is low. Threshold of 2.5 flags roughly the outer 1.2% of a normal distribution. Failed pings are unconditionally anomalous regardless of response time.

**npm workspaces** — single `node_modules` at root with hoisted packages, single `package-lock.json`. Avoids duplicated installs and keeps CI and Docker straightforward: `npm ci` from root installs everything.

**Railway** — supports Dockerfile deployments with automatic PostgreSQL plugins and injects `DATABASE_URL` automatically. Single service means no cross-origin complexity.

---

## Database schema

Single table `PingRecord`. The `payload` and `responseBody` columns store arbitrary JSON — `payload` is the request body sent to httpbin, `responseBody` is the echoed response.

```
PingRecord
──────────────────────────────────────────────────────────
id            String   PK, UUID, auto-generated
url           String   target URL that was pinged
method        String   HTTP method (always "POST")
payload       Json     request body sent to the target
statusCode    Int?     HTTP response code (null on network error)
responseBody  Json?    response body (null on failure)
responseTime  Int      elapsed time in milliseconds
success       Boolean  false if the request failed or timed out
errorMessage  String?  populated only on failure
createdAt     DateTime auto-set to insertion time

Indexes: createdAt DESC, success
```

Migrations live in `monitor-backend/prisma/migrations/` and are applied automatically in production via `npx prisma migrate deploy` in the container startup command.

---

## Testing strategy

### Unit tests (`monitor-backend/src/pings/pings.service.spec.ts`)

`PingsService` is the core component — it executes the HTTP ping, handles both success and error paths, persists the result, and provides all the data the rest of the system reads. Its tests use Jest with Prisma and axios mocked.

Test coverage areas:
- `generatePayload()` — structure, uniqueness, ISO timestamp validity, varied output
- `executePing()` success path — correct HTTP call, persisted `success=true`, non-negative response time, payload stored
- `executePing()` failure paths — network error, 5xx response with status code captured, non-Axios errors handled without re-throwing
- `getHistory()` — pagination metadata, defaults, `totalPages` calculation including empty result
- `getStats()` — success rate, failed count, rounding, null aggregates when no successful pings, zero-total edge case

### E2E tests (`monitor-backend/test/app.e2e-spec.ts`)

HTTP-level tests using Supertest against a real NestJS application instance. `PrismaService`, `PingsService`, `PingsGateway`, and `SchedulerService` are all mocked so the suite runs without a database.

Coverage: all routes (`GET /health`, `GET /api/pings`, `GET /api/pings/stats`, `GET /api/pings/:id`, `POST /api/pings/trigger`) including pagination validation, 404 handling, and WebSocket broadcast on trigger.

### CI (`/.github/workflows/ci.yml`)

Three sequential steps on every push and pull request to `main`:
1. **Lint** — ESLint with TypeScript strict rules
2. **Unit tests with coverage** — Jest coverage report uploaded as an artifact
3. **E2E tests** — full application integration against mocked dependencies

---

## Assumptions

- The target URL (`httpbin.org/anything`) is always a POST endpoint that echoes the request body. The payload generator produces varied JSON objects that look like realistic API traffic.
- Response times above ~500 ms from httpbin are normal occasionally. The z-score floor of 50 ms and threshold of 2.5 are tuned for this baseline.
- A single database table is sufficient. There is no multi-tenancy or per-user isolation.
- The WebSocket connection is unauthenticated. All connected clients receive all events.
- The rolling analytics window is computed in application memory from a DB query rather than in SQL. For the data volumes involved (288 records/day at 5-minute intervals) this is fast enough and simpler.

---

## Future improvements

**Configurable target URLs** — allow monitoring multiple endpoints from the same instance, with per-URL stats and charts.

**Alerting** — email or webhook notification when an anomaly is detected or when success rate drops below a threshold.

**Authentication** — basic API key or OAuth to protect the dashboard and trigger endpoint.

**Smarter anomaly detection** — the current z-score is computed over the full selected window. A sliding-window z-score or seasonal decomposition would handle daily traffic patterns better.

**Retention policy** — automatic deletion or archiving of records older than N days to keep the table size bounded.

**Frontend tests** — React Testing Library unit tests for the custom hooks and chart components.

**Database-side aggregations** — for windows larger than 24 h, computing stats in SQL with windowing functions would be more efficient than loading all records into memory.

---

## Deployment

See [DEPLOY.md](DEPLOY.md) for Railway deployment steps.

The short version: connect the repository to a new Railway project, add the PostgreSQL plugin, and deploy. Migrations run automatically on container start. No environment variables need to be set manually — Railway injects `DATABASE_URL` from the plugin and `PORT` is handled by NestJS defaults.
