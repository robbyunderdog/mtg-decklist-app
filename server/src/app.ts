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

export function createApp() {
  const app = express();

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

  app.use(errorHandler);

  return app;
}
