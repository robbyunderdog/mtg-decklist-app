// Password hashing and JWT session token helpers used by authController.ts.
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const BCRYPT_COST = 12;
// Short-lived on purpose — there's no refresh flow yet, so a session simply expires after
// 15 minutes of the cookie being issued and the user has to log in again.
const TOKEN_TTL = "15m";
export const AUTH_COOKIE_NAME = "token";

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Issues a JWT with the user id as the `sub` claim.
export function signAuthToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Verifies and decodes a JWT; throws if it's invalid, tampered with, or expired.
export function verifyAuthToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_SECRET) as { sub: string };
}

// Cookie options for the auth token: httpOnly (not readable from JS, mitigates XSS token
// theft), secure in production only (plain HTTP in local dev has no TLS), sameSite lax so it
// still round-trips on top-level navigation between the client and API's different ports/origins.
export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 15 * 60 * 1000,
  };
}
