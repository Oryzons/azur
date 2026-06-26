#!/bin/sh
set -e

echo "Starting Bleu Calanque API..."

# Attendre que PostgreSQL soit disponible
echo "Waiting for PostgreSQL..."
until nc -z postgresql 5432; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done
echo "PostgreSQL is up!"

# Appliquer les migrations
if [ "${SKIP_DB_MIGRATE:-false}" != "true" ]; then
  echo "Applying database migrations..."
  npx prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma || true
fi

# Lancer l'app
cd /app/apps/api
echo "Starting NestJS application..."
exec node dist/main.js