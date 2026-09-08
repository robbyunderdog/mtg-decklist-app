// Decklist import preview — parses pasted text or a deck-site link into a reviewable list of
// cards without saving anything. Confirming the import happens on the decks routes instead
// (POST /decks/:id/import/confirm or /decks/import/new), once the user has reviewed this preview.
import { Router } from "express";
import { preview } from "../controllers/importsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.post("/preview", preview);

export default router;
