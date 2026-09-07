import type { Request, Response } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/pool.js";
import { cards, deckCards, decks } from "../db/schema.js";
import { getOwnedDeck } from "../services/decks/deckAccess.js";
import { MAIN_TOTAL_SQL } from "../services/decks/deckPricing.js";
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
    })
    .from(decks)
    .leftJoin(deckCards, eq(deckCards.deckId, decks.id))
    .leftJoin(cards, eq(cards.scryfallId, deckCards.cardId))
    .where(eq(decks.userId, req.userId!))
    .groupBy(decks.id)
    .orderBy(desc(decks.updatedAt));

  res.json({ decks: rows });
}

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

export async function deleteDeck(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  await db.delete(decks).where(eq(decks.id, deck.id));
  res.status(204).send();
}
