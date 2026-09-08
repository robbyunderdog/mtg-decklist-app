// Express middleware that gates a route behind a valid auth cookie.
import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "../services/auth.js";

// Augments Express's Request type so `req.userId` (set below) type-checks in controllers.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Reads the JWT from the auth cookie, verifies it, and attaches the user id to the request
// as `req.userId`. Responds 401 and stops the chain if the cookie is missing or invalid.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const payload = verifyAuthToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
}
