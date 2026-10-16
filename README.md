# MTG Decklist App

Import, store, and track Magic: The Gathering decklists, with card data/images/pricing from [Scryfall](https://scryfall.com).

## Structure

- `client/` — React + Vite + TypeScript frontend
- `server/` — Express + TypeScript API, PostgreSQL via Drizzle ORM
- `Dockerfile`, `docker-compose.yml` — production build and self-hosted deployment

| Doc | What's in it |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How the app works: data model, request flow, import pipeline |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Running it on your own Linux box with Docker + Cloudflare Tunnel |

## Environment files

| File | Copy to | Used for |
|---|---|---|
| `server/.env.example` | `server/.env` | Local development |
| `.env.example` (repo root) | `.env` (repo root) | Production via `docker compose` |

Both `.env` files are gitignored — never commit real values.

## Local setup

Requires Node.js 20+.

### 1. Database

This project uses a hosted PostgreSQL database ([Neon](https://neon.tech), free tier). Create a project there and copy its connection string.

### 2. Server

```bash
cd server
cp .env.example .env     # then fill in DATABASE_URL and JWT_SECRET
npm install
npm run db:migrate       # apply the committed migrations to your database
npm run dev              # starts on http://localhost:4000
```

### 3. Client

```bash
cd client
npm install
npm run dev              # starts on http://localhost:5173, proxies /api to the server
```

Open http://localhost:5173.

## Scripts

| Where | Command | What it does |
|---|---|---|
| `server/` | `npm run dev` | API with auto-reload |
| `server/` | `npm test` | Run the test suite (Vitest) |
| `server/` | `npm run db:generate` | Create a new migration after editing `src/db/schema.ts` |
| `server/` | `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `client/` | `npm run dev` | Vite dev server |
| `client/` | `npm run lint` | Lint with Oxlint |
| `client/` | `npm run build` | Type-check and build to `client/dist` |

## Deploying

See [DEPLOYMENT.md](./DEPLOYMENT.md). Once set up, shipping a change is:

```bash
git push                                  # from your dev machine
git pull && docker compose up -d --build  # on the server
```
