// Global Express error handler — must be the last `app.use()` call (see app.ts). Express 5
// automatically forwards thrown errors and rejected promises from route handlers here, so
// controllers can just `throw` instead of wrapping every handler in try/catch.
import type { NextFunction, Request, Response } from "express";
import { BadRequestError } from "../utils/params.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Anything that throws BadRequestError is a "safe to show the user" message (bad input,
  // an unreachable third-party deck link, etc.) — everything else is an unexpected bug, so
  // it's logged server-side but hidden from the client behind a generic message.
  if (err instanceof BadRequestError) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
