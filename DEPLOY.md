# Deployment

The app runs as a single service: NestJS serves both the API and the React frontend as static files. One URL handles everything — REST, WebSocket, and the dashboard UI.

## Stack

- **Platform**: Railway
- **Database**: Railway PostgreSQL plugin
- **Frontend**: served as static files by NestJS from `/public`

## Railway deployment

1. Create a new Railway project and connect your GitHub repository (root directory, no subdirectory).
2. Railway detects the `Dockerfile` automatically.
3. Add a **PostgreSQL** plugin — Railway wires `DATABASE_URL` into the service automatically.
4. Deploy. The container runs `prisma migrate deploy` then starts the server.
5. In Railway's service settings, generate a public domain.

That's it. No environment variables need to be set manually for a basic deployment — defaults work out of the box.

### Optional environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PING_URL` | `https://httpbin.org/anything` | Target URL to ping |
| `PING_CRON` | `*/5 * * * *` | Cron schedule (every 5 min) |
| `REQUEST_TIMEOUT_MS` | `10000` | HTTP request timeout in ms |

## Local development with Docker

Run the full stack (app + PostgreSQL) locally without needing a local Postgres install:

```bash
docker compose up --build
```

Open http://localhost:3000 — the dashboard loads and pings run on schedule.

To stop:

```bash
docker compose down
```

To wipe the database volume:

```bash
docker compose down -v
```

## Local development without Docker

Run backend and frontend separately with hot-reload:

```bash
# terminal 1 — backend (requires a local or remote DATABASE_URL in monitor-backend/.env)
npm run dev -w monitor-backend

# terminal 2 — frontend
npm run dev -w monitor-frontend
```

Frontend dev server proxies `/api` and `/socket.io` to the backend at port 3000.
