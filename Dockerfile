# Multi-stage build: compiles the client and server separately, then assembles a small
# runtime image containing only the compiled output and production dependencies.
#
#   docker build -t mtg-decklist-app .
#   docker run --env-file .env.production -p 4000:4000 mtg-decklist-app

# --- Build the client (React/Vite) ---
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- Build the server (TypeScript -> JS) ---
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# --- Runtime image ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=server-build /app/server/dist ./dist
# app.ts looks for the built client at ../public relative to dist/ — see server/src/app.ts.
COPY --from=client-build /app/client/dist ./public

EXPOSE 4000
CMD ["node", "dist/index.js"]
