import { and, eq } from "drizzle-orm";
import { db } from "../../db/pool.js";
import { decks } from "../../db/schema.js";
import { requireParam } from "../../utils/params.js";

export async function getOwnedDeck(deckIdParam: string | string[] | undefined, userId: string) {
  const deckId = requireParam(deckIdParam, "deck id");
  return db.query.decks.findFirst({
    where: and(eq(decks.id, deckId), eq(decks.userId, userId)),
  });
}

export async function touchDeck(deckId: string) {
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId));
}
