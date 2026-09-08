// Shared fetch wrapper every api/* module builds on — handles the API base path, the auth
// cookie, JSON parsing, and turning non-2xx responses into a typed error.
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// `credentials: "include"` is what makes the browser send the httpOnly auth cookie on
// cross-origin requests to the API (client and server run on different ports in dev).
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(body.error ?? "Request failed", res.status);
  }

  return body as T;
}
