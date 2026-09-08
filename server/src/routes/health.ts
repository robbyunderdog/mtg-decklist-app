// Unauthenticated liveness check — useful for uptime monitors / container health checks.
import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
