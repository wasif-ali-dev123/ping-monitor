#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/monitor-backend/.env"
ENV_EXAMPLE="$ROOT/monitor-backend/.env.example"

# ── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
info() { echo -e "${GREEN}[dev]${RESET} $*"; }
warn() { echo -e "${YELLOW}[dev]${RESET} $*"; }

# ── env file ──────────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  warn ".env not found — copying from .env.example"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  warn "Edit $ENV_FILE with your DATABASE_URL before re-running."
  exit 1
fi

# ── deps ──────────────────────────────────────────────────────────────────────
info "Cleaning and installing dependencies…"
rm -rf "$ROOT/node_modules" "$ROOT/monitor-backend/node_modules" "$ROOT/monitor-frontend/node_modules" "$ROOT/package-lock.json"
cd "$ROOT" && npm install

# ── db ────────────────────────────────────────────────────────────────────────
info "Running database migrations…"
(cd "$ROOT/monitor-backend" && npx prisma migrate dev --skip-seed)

# ── start ─────────────────────────────────────────────────────────────────────
info "Starting backend + frontend…"
npm run dev
