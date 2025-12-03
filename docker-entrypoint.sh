#!/bin/sh
set -e

# Wait for DATABASE_URL to be available -- simple loop
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL is set, attempting prisma migrate deploy..."
  # Run prisma migrate deploy to apply migrations (if any)
  npx prisma migrate deploy --schema=./prisma/schema.prisma || true
  echo "Prisma migrate deploy finished (or skipped)."
else
  echo "DATABASE_URL not set, skipping prisma migrate deploy."
fi

# Start the app
exec "$@"
