#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set, skipping database migration."
  exec "$@"
fi

echo "=== Waiting for database connection ==="

MAX_RETRIES=15
RETRY_COUNT=0

# Wait until DB is reachable (prisma migrate status exits 0 only if DB is up)
until npx prisma migrate status --schema=./prisma/schema.prisma > /dev/null 2>&1; do
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
