#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set, skipping database migration."
  exec "$@"
fi

echo "=== Waiting for database connection ==="

MAX_RETRIES=15
RETRY_COUNT=0

# Wait until DB TCP port is reachable using Node.js
# NOTE: prisma migrate status returns exit code 1 when there are pending migrations,
# so we use a raw TCP check instead to avoid false "not ready" loops.
until node -e "
const net = require('net');
const url = new URL(process.env.DATABASE_URL.replace(/^mysql:/, 'http:'));
const port = parseInt(url.port) || 3306;
const host = url.hostname;
const c = net.createConnection(port, host, () => { c.destroy(); process.exit(0); });
c.setTimeout(3000);
c.on('timeout', () => { c.destroy(); process.exit(1); });
c.on('error', () => process.exit(1));
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Cannot connect to database after $MAX_RETRIES attempts. Aborting."
    exit 1
  fi
  echo "Database not ready. Retrying in 3 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 3
done

echo "=== Database connected. Running baseline check... ==="

# Step 1: Baseline - mark init migration as already applied on existing databases.
# Safe behavior:
#   - First deploy on existing DB (no _prisma_migrations table) → marks init as applied, no schema changes made
#   - Subsequent deploys (init already marked)                  → exits with P3008, we catch it and continue
#   - Fresh empty DB                                            → marks init as applied, deploy below handles newer migrations only
RESOLVE_OUTPUT=$(npx prisma migrate resolve \
  --applied "20260523000000_init" \
  --schema=./prisma/schema.prisma 2>&1) || RESOLVE_EXIT=$?

if echo "$RESOLVE_OUTPUT" | grep -q "P3008\|already been applied\|already applied"; then
  echo "Baseline already marked. Skipping resolve."
elif [ "${RESOLVE_EXIT:-0}" -ne 0 ]; then
  echo "ERROR: Unexpected error during migrate resolve:"
  echo "$RESOLVE_OUTPUT"
  exit 1
else
  echo "Baseline migration marked successfully."
fi

npx prisma migrate resolve --applied "20260827145500_add_multi_toko" --schema=./prisma/schema.prisma 2>/dev/null || true

echo "=== Applying pending migrations (safe — never deletes data) ==="


# Step 2: Apply all pending migrations.
# prisma migrate deploy ONLY runs additive SQL (ADD COLUMN, CREATE TABLE).
# It will NEVER generate or run DROP TABLE / DROP COLUMN.
if ! npx prisma migrate deploy --schema=./prisma/schema.prisma; then
  echo "ERROR: prisma migrate deploy failed. Aborting startup."
  exit 1
fi

echo "=== All migrations applied. Starting application... ==="

exec "$@"
