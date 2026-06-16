# Azur — MVP (auth + dashboard)

## Structure

```text
apps/admin   — Interface staff (React + Vite + Tailwind v4)
apps/api     — API NestJS (JWT, auth)
packages/db  — Schéma Prisma (SQLite fichier local)
packages/shared — Types & schémas Zod partagés
```

## Développement

```bash
npm install          # compile shared + prisma generate (postinstall)
cd packages/db && npx prisma migrate deploy && npm run seed
cd ../..             # racine repo
npm run dev          # API (3001) puis admin quand TCP 3001 prêt
```

- Admin : http://localhost:5173 — compte démo après seed : `admin@bleu-calanque.local` / `admin123`
- SQLite : fichier `packages/db/prisma/dev.db` (voir `DATABASE_URL` dans [.env.example](.env.example) et [`apps/api/.env`](apps/api/.env))

## Scripts

| Script | Effet |
|--------|-------|
| `npm run dev` | API + Vite admin (avec `wait-on`) |
| `npm run dev:api` | Nest seul |
| `npm run dev:admin` | Vite seul |
| `npm run db:migrate` | `prisma migrate dev` depuis `packages/db` |
| `npm run db:seed` | utilisateur démo ADMIN |
