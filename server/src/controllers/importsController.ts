import type { Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/pool.js";
import { decks, deckCards } from "../db/schema.js";
import { parseImportText } from "../services/importParser/index.js";
import { getOwnedDeck } from "../services/decks/deckAccess.js";
import { cacheAllPrintingsForCardIds } from "../services/scryfall/cache.js";
import { DECK_FORMATS } from "../constants/formats.js";

const previewSchema = z.object({ rawText: z.string().min(1) });

export async function preview(req: Request, res: Response) {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const result = await parseImportText(parsed.data.rawText);
  res.json(result);
}

const confirmLineSchema = z.object({
  scryfallId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  board: z.enum(["main", "side", "maybe", "commander"]),
  foil: z.boolean().default(false),
});

const confirmSchema = z.object({
  lines: z.array(confirmLineSchema),
});

async function commitImport(deckId: string, lines: z.infer<typeof confirmSchema>["lines"]) {
  await db.transaction(async (tx) => {
    await tx.delete(deckCards).where(eq(deckCards.deckId, deckId));

    if (lines.length > 0) {
      await tx.insert(deckCards).values(
        lines.map((l) => ({
          deckId,
          cardId: l.scryfallId,
          quantity: l.quantity,
          board: l.board,
          foil: l.foil,
        }))
      );
    }

    await tx.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId));
  });
}

export async function confirm(req: Request, res: Response) {
  const deck = await getOwnedDeck(req.params.id, req.userId!);
  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  await commitImport(deck.id, parsed.data.lines);
  res.status(201).json({ ok: true });

  // Warm the printings cache in the background so "change printing" doesn't have to hit
  // Scryfall live later; the client doesn't wait on this.
  void cacheAllPrintingsForCardIds(parsed.data.lines.map((l) => l.scryfallId));
}

const importNewSchema = z.object({
  name: z.string().min(1).max(200),
  format: z.enum(DECK_FORMATS),
  lines: z.array(confirmLineSchema),
});

export async function importAsNewDeck(req: Request, res: Response) {
  const parsed = importNewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const [deck] = await db
    .insert(decks)
    .values({ userId: req.userId!, name: parsed.data.name, format: parsed.data.format })
    .returning();

  await commitImport(deck.id, parsed.data.lines);
  res.status(201).json({ deck });

  void cacheAllPrintingsForCardIds(parsed.data.lines.map((l) => l.scryfallId));
}
