// Auth endpoints — thin wrappers over the server's /auth/* routes. Consumed by
// state/AuthContext.tsx rather than called directly from components.
import { apiFetch } from "./client";

export interface User {
  id: string;
  email: string;
  displayName: string;
}

// "Am I logged in, and as whom?" — 401s if the session cookie is missing/expired.
export function getMe() {
  return apiFetch<{ user: User }>("/auth/me");
}

export function login(email: string, password: string) {
  return apiFetch<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string, displayName: string) {
  return apiFetch<{ user: User }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
}

export function logout() {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}
