// Registration, login, logout, and the "who am I" check the client runs on app load.
import type { Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/pool.js";
import { users } from "../db/schema.js";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  hashPassword,
  signAuthToken,
  verifyPassword,
} from "../services/auth.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Creates a new user account and immediately logs them in (sets the auth cookie).
export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, password, displayName } = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, displayName })
    .returning({ id: users.id, email: users.email, displayName: users.displayName });

  const token = signAuthToken(user.id);
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  res.status(201).json({ user });
}

// Verifies credentials and sets the auth cookie. Uses one generic error message for both
// "no such email" and "wrong password" so a failed login can't be used to enumerate accounts.
export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signAuthToken(user.id);
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  res.status(204).send();
}

// Returns the currently logged-in user, or 401 if the session is missing/expired. The client
// calls this once on load to decide whether to show the app or redirect to /login.
export async function me(req: Request, res: Response) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.userId!),
    columns: { id: true, email: true, displayName: true },
  });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user });
}
