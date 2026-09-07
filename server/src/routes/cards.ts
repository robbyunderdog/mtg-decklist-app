import { Router } from "express";
import { getById, search } from "../controllers/cardsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.get("/search", search);
router.get("/:scryfallId", getById);

export default router;
