// Builds the Express app: global middleware, route mounting, and the error handler.
// Kept separate from index.ts so tests can import `createApp()` without also starting
// a listening server or the background jobs.
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import cardsRouter from "./routes/cards.js";
import decksRouter from "./routes/decks.js";
import importsRouter from "./routes/imports.js";
import { errorHandler } from "./middleware/errorHandler.js";

// In production the built client (client/dist) is copied to server/public — see the
// Dockerfile — and this same Express process serves it alongside the API, so there's only
// one origin to deploy/point a domain at. In local dev this directory doesn't exist (the
// client instead runs its own Vite dev server and proxies /api to this one), so it's skipped.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_BUILD_DIR = path.join(__dirname, "../public");
const SERVE_CLIENT = fs.existsSync(CLIENT_BUILD_DIR);

export function createApp() {
  const app = express();

  // `credentials: true` + an explicit origin (not "*") is required for the browser to
  // send/receive the httpOnly auth cookie cross-origin (client and API run on different ports).
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/cards", cardsRouter);
  app.use("/api/decks", decksRouter);
  app.use("/api/imports", importsRouter);

  if (SERVE_CLIENT) {
    app.use(express.static(CLIENT_BUILD_DIR));
    // React Router handles client-side routes (e.g. /decks/:id) that don't exist as real
    // files, so any GET that isn't a static asset or an API route falls through to
    // index.html and the client's own router takes it from there.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(CLIENT_BUILD_DIR, "index.html"));
    });
  }

  // Must be registered last — Express only treats a 4-arg middleware as an error handler.
  app.use(errorHandler);

  return app;
}
