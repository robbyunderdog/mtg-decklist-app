# MTG Decklist App

Import, store, and track Magic: The Gathering decklists, with card data/images/pricing from [Scryfall](https://scryfall.com).

## Structure

- `client/` — React + Vite + TypeScript frontend
- `server/` — Express + TypeScript API, PostgreSQL via Drizzle ORM

## Local setup

### 1. Database

This project uses a hosted PostgreSQL database (e.g. [Neon](https://neon.tech), free tier). Create a project there and copy its connection string.

### 2. Server

```
cd server
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET
npm install
npm run db:generate     # generate migrations from schema
npm run db:migrate       # apply migrations
npm run dev              # starts on http://localhost:4000
```

### 3. Client

```
cd client
npm install
npm run dev              # starts on http://localhost:5173, proxies /api to the server
```
