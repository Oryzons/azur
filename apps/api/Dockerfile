# Monorepo : NestJS (apps/api) + React/Vite (apps/admin) + Prisma (packages/db)
#
# Build depuis la racine :
#   docker build -f apps/api/Dockerfile -t oryzons/azur:latest .
#   docker push oryzons/azur:latest
#
# Pas de secrets ici — tout passe par les variables d'environnement au runtime.

# ===== Build stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Installer les dépendances (sans postinstall : le code source n'est pas encore copié)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/admin/package.json ./apps/admin/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --ignore-scripts

# 2. Copier le code source
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY apps/admin ./apps/admin
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared

# 3. Générer Prisma + construire shared, frontend Vite et backend NestJS
RUN npm run db:generate
RUN npm run build

# ===== Production stage =====
FROM node:20-alpine AS runner

# Chromium pour Puppeteer (génération PDF des contrats)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV NODE_ENV=production
ENV API_PORT=3001
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Dépendances runtime uniquement
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --omit=dev --ignore-scripts

# Artefacts du builder (dist + client Prisma pré-généré)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/admin/dist ./apps/admin/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Client Prisma + CLI (migrations au démarrage)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 4. Préparer /data pour SQLite (DATABASE_URL=file:/data/azur.db)
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3001

ENTRYPOINT ["/docker-entrypoint.sh"]
