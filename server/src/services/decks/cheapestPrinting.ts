import { and, eq } from "drizzle-orm";
import { db } from "../../db/pool.js";
import { deckCards, cards } from "../../db/schema.js";
import { findCheapestPrinting } from "../scryfall/cache.js";

export interface CheapestPrintingResult {
  changed: boolean;
  deckCard: typeof deckCards.$inferSelect;
}

/**
 * Swaps a single deck card row to a specific printing, merging into an existing row of the
 * same card/board/foil if one already exists (e.g. two different printings of a card that
 * both end up pointing at the same target printing).
 */
export async function swapToCard(
  deckId: string,
  row: typeof deckCards.$inferSelect,
  target: typeof cards.$inferSelect
): Promise<CheapestPrintingResult> {
  if (target.scryfallId === row.cardId) {
    return { changed: false, deckCard: row };
  }

  const updated = await db.transaction(async (tx) => {
    const existing = await tx.query.deckCards.findFirst({
      where: and(
        eq(deckCards.deckId, deckId),
        eq(deckCards.cardId, target.scryfallId),
        eq(deckCards.board, row.board),
        eq(deckCards.foil, row.foil)
      ),
    });

    if (existing && existing.id !== row.id) {
      const mergedQuantity = existing.quantity + row.quantity;
      const [merged] = await tx
        .update(deckCards)
        .set({
          quantity: mergedQuantity,
          checkedQuantity: Math.min(existing.checkedQuantity + row.checkedQuantity, mergedQuantity),
        })
        .where(eq(deckCards.id, existing.id))
        .returning();
      await tx.delete(deckCards).where(eq(deckCards.id, row.id));
      return merged;
    }

    const [saved] = await tx
      .update(deckCards)
      .set({ cardId: target.scryfallId })
      .where(eq(deckCards.id, row.id))
      .returning();
    return saved;
  });

  return { changed: true, deckCard: updated };
}

/**
 * Swaps a single deck card row to its cheapest known printing (matching foil/non-foil pricing).
 */
export async function applyCheapestPrinting(
  deckId: string,
  row: typeof deckCards.$inferSelect,
  oracleId: string
): Promise<CheapestPrintingResult | null> {
  const cheapest = await findCheapestPrinting(oracleId, row.foil);
  if (!cheapest) return null;
  return swapToCard(deckId, row, cheapest);
}
