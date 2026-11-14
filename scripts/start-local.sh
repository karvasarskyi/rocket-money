#!/usr/bin/env bash
# Start Rocket Money on this machine: PostgreSQL (5433) + one Node process (port 3000) that serves
# the API, the Telegram webhook, the admin panel (/admin/) and the Mini App (/).
# Usage: scripts/start-local.sh [--rebuild] [--webhook]
#   --rebuild  rebuild backend + frontend before starting
#   --webhook  (re)register the Telegram webhook, commands and menu button
# Secrets live in backend/.env (git-ignored). It is created on first run; existing values are kept.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
LOG_DIR="${LOG_DIR:-/home/ubuntu/rocket-money-logs}"
PORT="${PORT:-3000}"
PG_DATA="${PG_DATA:-/home/ubuntu/pg_data}"     # version-agnostic data directory
PG_SOCK="${PG_SOCK:-/home/ubuntu/pgsockets}"   # avoids /var/run/postgresql permission issues
PG_PORT=5433
mkdir -p "$LOG_DIR" "$PG_SOCK"

# 1. PostgreSQL on port 5433. Binaries: $PG_BIN if set, else auto-detect version 18, then 17.
#    If the data dir already exists, use the binaries matching its PG_VERSION.
pg_bin_for() { [ -x "/usr/lib/postgresql/$1/bin/pg_ctl" ] && echo "/usr/lib/postgresql/$1/bin"; }
if [ -z "${PG_BIN:-}" ]; then
  if [ -f "$PG_DATA/PG_VERSION" ]; then
    PG_BIN="$(pg_bin_for "$(cat "$PG_DATA/PG_VERSION")" || true)"
  fi
  for v in 18 17; do [ -n "${PG_BIN:-}" ] && break; PG_BIN="$(pg_bin_for "$v" || true)"; done
fi
[ -n "${PG_BIN:-}" ] && [ -x "$PG_BIN/pg_ctl" ] || { echo "PostgreSQL 18 or 17 not found (set PG_BIN)"; exit 1; }
PG_VER="$("$PG_BIN/pg_ctl" --version | grep -oE '[0-9]+' | head -1)"

if ! pg_isready -q -h localhost -p "$PG_PORT"; then
  if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    # Reuse a data dir from an older layout (pg18data / pg17data) of the same major version.
    for legacy in "/home/ubuntu/pg${PG_VER}data"; do
      if [ -f "$legacy/PG_VERSION" ] && [ "$(cat "$legacy/PG_VERSION")" = "$PG_VER" ]; then
        echo "Moving existing data directory $legacy -> $PG_DATA"
        rm -rf "$PG_DATA"; mv "$legacy" "$PG_DATA"
      fi
    done
  fi
  if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    echo "Initialising PostgreSQL $PG_VER data directory $PG_DATA ..."
    rm -rf "$PG_DATA"
    "$PG_BIN/initdb" -D "$PG_DATA" -U postgres --auth=trust --encoding=UTF8 >/dev/null
  fi
  # Remove a stale lock left behind when the VM was stopped (only if that PID is not alive).
  if [ -f "$PG_DATA/postmaster.pid" ] && ! kill -0 "$(head -1 "$PG_DATA/postmaster.pid")" 2>/dev/null; then
    rm -f "$PG_DATA/postmaster.pid"
  fi
  echo "Starting PostgreSQL $PG_VER ..."
  "$PG_BIN/pg_ctl" -D "$PG_DATA" -o "-p $PG_PORT -k $PG_SOCK" -l "$LOG_DIR/postgres.log" -w start
else
  echo "PostgreSQL already running on port $PG_PORT"
fi
psql -h localhost -p "$PG_PORT" -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='rocketmoney'" | grep -q 1 \
  || psql -h localhost -p "$PG_PORT" -U postgres -d postgres -qc "CREATE DATABASE rocketmoney"

# 2. Environment (generate once, never print secrets)
if [ ! -f "$ENV_FILE" ] || ! grep -q '^TELEGRAM_WEBHOOK_SECRET=.\+' "$ENV_FILE"; then
  echo "Creating $ENV_FILE ..."
  BOT_TOKEN="$(python3 -c "
import json
c=json.load(open('/home/ubuntu/.config/abacusai_auth_secrets.json'))
s={k.lower():v for k,v in c.items()}.get('telegram',{}).get('secrets',{})
s={k.lower():v for k,v in s.items()}
print(s.get('bot_token',{}).get('value',''))")"
  [ -n "$BOT_TOKEN" ] || { echo "Telegram bot token not found in secrets file"; exit 1; }
  umask 077
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:$PG_PORT/rocketmoney
DIRECT_URL=postgresql://postgres:postgres@localhost:$PG_PORT/rocketmoney
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
TELEGRAM_BOT_USERNAME=RocketMX_bot
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 24)
ADMIN_TELEGRAM_IDS=
SUPPORT_CONTACT=
JWT_SECRET=$(openssl rand -hex 32)
APP_URL=${APP_URL:-${PREVIEW_URL:-https://141ea314b8.na124.preview.abacusai.app}}
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
ADMIN_RESET_PASSWORD=false
CORS_ORIGINS=
PORT=$PORT
EOF
fi

# Load backend/.env, overriding the sandbox's own DATABASE_URL / NODE_ENV etc.
unset VITE_API_URL
set -a; . "$ENV_FILE"; set +a
export PORT

# 3. Build (first run or --rebuild)
cd "$ROOT"
if [[ " $* " == *" --rebuild "* ]] || [ ! -f backend/dist/main.js ] || [ ! -f frontend/dist/index.html ]; then
  echo "Building..."
  (cd backend && npx prisma generate >/dev/null && npm run build >/dev/null)
  (cd frontend && npm run build >/dev/null)
fi

# 4. Migrate + seed (idempotent)
(cd backend && npx prisma migrate deploy && node dist/seed.js)

# 5. (Re)start the app
if [ -f "$LOG_DIR/app.pid" ] && kill -0 "$(cat "$LOG_DIR/app.pid")" 2>/dev/null; then
  kill "$(cat "$LOG_DIR/app.pid")"; sleep 2
fi
fuser -k "$PORT/tcp" >/dev/null 2>&1 || true
cd "$ROOT/backend"
nohup node dist/main.js >> "$LOG_DIR/app.log" 2>&1 &
echo $! > "$LOG_DIR/app.pid"
for _ in $(seq 1 30); do
  curl -sf "http://localhost:$PORT/api/health" >/dev/null && break; sleep 1
done
curl -sf "http://localhost:$PORT/api/health" >/dev/null || { echo "App failed to start; see $LOG_DIR/app.log"; exit 1; }
echo "App running (PID $(cat "$LOG_DIR/app.pid")) on port $PORT, logs: $LOG_DIR/app.log"

# 6. Telegram webhook (optional)
if [[ " $* " == *" --webhook "* ]]; then
  node "$ROOT/scripts/set-webhook.js"
fi
echo "Public URL: $APP_URL  (admin: $APP_URL/admin/)"
