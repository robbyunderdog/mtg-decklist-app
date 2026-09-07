import type { Request, Response } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/pool.js";
import { cards, deckCards } from "../db/schema.js";
import { getOwnedDeck, touchDeck } from "../services/decks/deckAccess.js";
import { applyCheapestPrinting, swapToCard } from "../services/decks/cheapestPrinting.js";
import { findCardById, listPrintings } from "../services/scryfall/cache.js";
import { ScryfallNotFoundError } from "../services/scryfall/client.js";
import { requireParam } from "../utils/params.js";

const BOARD_VALUES = ["main", "side", "maybe", "commander"] as const;

const addCardSchema = z.object({
  scryfallId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99).default(1),
  board: z.enum(BOARD_VALUES).default("main"),
  foil: z.boolean().default(false),
});

const updateCardSchema = z.object({
  quantity: z.number().int().min(1).max(99).optional(),
  checkedQuantity: z.number().int().min(0).max(99).optional(),
  board: z.enum(BOARD_VALUES).optional(),
  foil: z.boolean().optional(),
});

export async function addCard(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const parsed = addCardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { scryfallId, quantity, board, foil } = parsed.data;

  try {
    await findCardById(scryfallId);
  } catch (err) {
    if (err instanceof ScryfallNotFoundError) {
      res.status(400).json({ error: "Unknown card" });
      return;
    }
    throw err;
  }

  const [row] = await db
    .insert(deckCards)
    .values({ deckId: deck.id, cardId: scryfallId, quantity, board, foil })
    .onConflictDoUpdate({
      target: [deckCards.deckId, deckCards.cardId, deckCards.board, deckCards.foil],
      set: { quantity: sql`${deckCards.quantity} + ${quantity}` },
    })
    .returning();

  await touchDeck(deck.id);
  res.status(201).json({ deckCard: row });
}

export async function updateCard(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const parsed = updateCardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const cardRowId = requireParam(req.params.cardRowId, "card row id");
  const current = await db.query.deckCards.findFirst({
    where: and(eq(deckCards.id, cardRowId), eq(deckCards.deckId, deck.id)),
  });
  if (!current) {
    res.status(404).json({ error: "Card not found in deck" });
    return;
  }

  const nextQuantity = parsed.data.quantity ?? current.quantity;
  let nextChecked = parsed.data.checkedQuantity ?? current.checkedQuantity;
  if (nextChecked > nextQuantity) {
    if (parsed.data.checkedQuantity !== undefined) {
      res.status(400).json({ error: "checkedQuantity cannot exceed quantity" });
      return;
    }
    // Quantity was lowered below the previously checked-off count; clamp it down instead of erroring.
    nextChecked = nextQuantity;
  }

  const [row] = await db
    .update(deckCards)
    .set({ ...parsed.data, checkedQuantity: nextChecked })
    .where(eq(deckCards.id, cardRowId))
    .returning();

  await touchDeck(deck.id);
  res.json({ deckCard: row });
}

export async function useCheapestPrinting(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const cardRowId = requireParam(req.params.cardRowId, "card row id");
  const current = await db
    .select({ row: deckCards, oracleId: cards.oracleId })
    .from(deckCards)
    .innerJoin(cards, eq(cards.scryfallId, deckCards.cardId))
    .where(and(eq(deckCards.id, cardRowId), eq(deckCards.deckId, deck.id)))
    .then((rows) => rows[0]);

  if (!current) {
    res.status(404).json({ error: "Card not found in deck" });
    return;
  }

  const result = await applyCheapestPrinting(deck.id, current.row, current.oracleId);
  if (!result) {
    res.status(404).json({ error: "No pricing data available for this card" });
    return;
  }

  await touchDeck(deck.id);
  res.json(result);
}

export async function listPrintingsForCard(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const cardRowId = requireParam(req.params.cardRowId, "card row id");
  const current = await db
    .select({ cardId: deckCards.cardId, oracleId: cards.oracleId })
    .from(deckCards)
    .innerJoin(cards, eq(cards.scryfallId, deckCards.cardId))
    .where(and(eq(deckCards.id, cardRowId), eq(deckCards.deckId, deck.id)))
    .then((rows) => rows[0]);

  if (!current) {
    res.status(404).json({ error: "Card not found in deck" });
    return;
  }

  const printings = await listPrintings(current.oracleId);
  res.json({ printings, currentScryfallId: current.cardId });
}

const setPrintingSchema = z.object({ scryfallId: z.string().uuid() });

export async function setPrinting(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const parsed = setPrintingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const cardRowId = requireParam(req.params.cardRowId, "card row id");
  const current = await db.query.deckCards.findFirst({
    where: and(eq(deckCards.id, cardRowId), eq(deckCards.deckId, deck.id)),
  });
  if (!current) {
    res.status(404).json({ error: "Card not found in deck" });
    return;
  }

  let target;
  try {
    target = await findCardById(parsed.data.scryfallId);
  } catch (err) {
    if (err instanceof ScryfallNotFoundError) {
      res.status(400).json({ error: "Unknown printing" });
      return;
    }
    throw err;
  }

  const result = await swapToCard(deck.id, current, target);
  await touchDeck(deck.id);
  res.json(result);
}

export async function useCheapestPrintingForDeck(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const rows = await db
    .select({ row: deckCards, oracleId: cards.oracleId })
    .from(deckCards)
    .innerJoin(cards, eq(cards.scryfallId, deckCards.cardId))
    .where(eq(deckCards.deckId, deck.id));

  let updated = 0;
  let failed = 0;
  for (const { row, oracleId } of rows) {
    try {
      // Re-fetch: an earlier iteration in this same loop may have merged/deleted this row already.
      const stillExists = await db.query.deckCards.findFirst({ where: eq(deckCards.id, row.id) });
      if (!stillExists) continue;

      const result = await applyCheapestPrinting(deck.id, stillExists, oracleId);
      if (result?.changed) updated++;
    } catch {
      // One card's lookup failing (rate limit, transient Scryfall error) shouldn't abort the
      // whole sweep and strand the cards already swapped before it in a stale response.
      failed++;
    }
  }

  await touchDeck(deck.id);
  res.json({ updated, failed, total: rows.length });
}

export async function deleteCard(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const [row] = await db
    .delete(deckCards)
    .where(and(eq(deckCards.id, requireParam(req.params.cardRowId, "card row id")), eq(deckCards.deckId, deck.id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Card not found in deck" });
    return;
  }

  await touchDeck(deck.id);
  res.status(204).send();
}
