import { Router } from "express";
import { preview } from "../controllers/importsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.post("/preview", preview);

export default router;
