import { Router } from "express";
import {
  createDeck,
  deleteDeck,
  getDeck,
  listDecks,
  updateDeck,
} from "../controllers/decksController.js";
import {
  addCard,
  deleteCard,
  listPrintingsForCard,
  setPrinting,
  updateCard,
  useCheapestPrinting,
  useCheapestPrintingForDeck,
} from "../controllers/deckCardsController.js";
import { confirm, importAsNewDeck } from "../controllers/importsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", listDecks);
router.post("/", createDeck);
router.post("/import/new", importAsNewDeck);
router.get("/:id", getDeck);
router.patch("/:id", updateDeck);
router.delete("/:id", deleteDeck);

router.post("/:id/cards", addCard);
router.patch("/:id/cards/:cardRowId", updateCard);
router.delete("/:id/cards/:cardRowId", deleteCard);
router.post("/:id/cards/:cardRowId/cheapest-printing", useCheapestPrinting);
router.post("/:id/cheapest-printings", useCheapestPrintingForDeck);
router.get("/:id/cards/:cardRowId/printings", listPrintingsForCard);
router.post("/:id/cards/:cardRowId/printing", setPrinting);

router.post("/:id/import/confirm", confirm);

export default router;
