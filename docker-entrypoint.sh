#!/bin/sh
set -e

if [ "${SKIP_DB_MIGRATE:-false}" != "true" ]; then
  echo "Applying database migrations..."
  npx prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma
fi

cd /app/apps/api
exec node dist/main.js
