# Client

React + Vite + TypeScript frontend, styled with Tailwind, server state via TanStack Query.

```bash
npm install
npm run dev     # http://localhost:5173 — proxies /api to the server on :4000
npm run lint
npm run build   # outputs to dist/ (the Dockerfile copies this into the server image)
```

The client has no environment variables of its own: in dev it talks to the API through the
Vite proxy, and in production Express serves the built client from the same origin.

See the root [README](../README.md) for full setup and [ARCHITECTURE.md](../ARCHITECTURE.md)
for how the pieces fit together.
