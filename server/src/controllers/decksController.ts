// Deck-level CRUD: list a user's decks, create/rename/archive one, fetch one deck's full card
// list, delete a deck. Card-level operations (add/remove/check off a card) live in
// deckCardsController.ts instead.
import type { Request, Response } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/pool.js";
import { cards, deckCards, decks } from "../db/schema.js";
import { getOwnedDeck } from "../services/decks/deckAccess.js";
import { MAIN_CHECKED_TOTAL_SQL, MAIN_QUANTITY_TOTAL_SQL, MAIN_TOTAL_SQL } from "../services/decks/deckPricing.js";
import { DECK_FORMATS } from "../constants/formats.js";

const createDeckSchema = z.object({
  name: z.string().min(1).max(200),
  format: z.enum(DECK_FORMATS),
});

const updateDeckSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  format: z.enum(DECK_FORMATS).optional(),
  status: z.enum(["in_progress", "complete", "archived"]).optional(),
  notes: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
});

// Dashboard data: every deck the logged-in user owns, with just enough aggregated info
// (price total, collected-vs-total card counts) to render the deck cards without a second
// request per deck. Sorted most-recently-updated first.
export async function listDecks(req: Request, res: Response) {
  const rows = await db
    .select({
      id: decks.id,
      name: decks.name,
      format: decks.format,
      status: decks.status,
      tags: decks.tags,
      updatedAt: decks.updatedAt,
      priceTotal: MAIN_TOTAL_SQL,
      quantityTotal: MAIN_QUANTITY_TOTAL_SQL,
      checkedTotal: MAIN_CHECKED_TOTAL_SQL,
    })
    .from(decks)
    .leftJoin(deckCards, eq(deckCards.deckId, decks.id))
    .leftJoin(cards, eq(cards.scryfallId, deckCards.cardId))
    .where(eq(decks.userId, req.userId!))
    .groupBy(decks.id)
    .orderBy(desc(decks.updatedAt));

  res.json({
    // Postgres SUM() comes back over the wire as a string, not a number (see deckPricing.ts) —
    // converted here so the client's "is this deck fully collected?" comparison is numeric,
    // not a lexicographic string comparison (which broke on decks with 100+ cards: "99" > "100").
    decks: rows.map((row) => ({
      ...row,
      quantityTotal: Number(row.quantityTotal),
      checkedTotal: Number(row.checkedTotal),
    })),
  });
}

// Creates an empty deck (cards are added afterward, one at a time or via import).
export async function createDeck(req: Request, res: Response) {
  const parsed = createDeckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const [deck] = await db
    .insert(decks)
    .values({ userId: req.userId!, name: parsed.data.name, format: parsed.data.format })
    .returning();

  res.status(201).json({ deck });
}

// Full deck detail for the deck editor: every card row (every board, not just main) plus the
// main-board dollar total.
export async function getDeck(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const cardRows = await db
    .select({
      id: deckCards.id,
      quantity: deckCards.quantity,
      checkedQuantity: deckCards.checkedQuantity,
      board: deckCards.board,
      foil: deckCards.foil,
      card: cards,
    })
    .from(deckCards)
    .innerJoin(cards, eq(cards.scryfallId, deckCards.cardId))
    .where(eq(deckCards.deckId, deck.id));

  const priceTotal = cardRows
    .filter((r) => r.board === "main")
    .reduce((sum, r) => {
      const price = r.foil ? r.card.priceUsdFoil : r.card.priceUsd;
      return sum + r.quantity * Number(price ?? 0);
    }, 0);

  res.json({ deck, cards: cardRows, priceTotal });
}

// Partial update of deck metadata (name, format, status, notes, tags) — any subset of fields.
export async function updateDeck(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const parsed = updateDeckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const [updated] = await db
    .update(decks)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(decks.id, deck.id))
    .returning();

  res.json({ deck: updated });
}

// Deletes a deck; its deck_cards rows cascade-delete via the FK in schema.ts.
export async function deleteDeck(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  await db.delete(decks).where(eq(decks.id, deck.id));
  res.status(204).send();
}
