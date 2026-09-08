// Ownership check used by every deck-scoped controller — every route handler that touches a
// deck calls this first so a user can never read or modify another user's deck by guessing
// its id.
import { and, eq } from "drizzle-orm";
import { db } from "../../db/pool.js";
import { decks } from "../../db/schema.js";
import { requireParam } from "../../utils/params.js";

// Returns the deck only if it exists AND belongs to `userId`; otherwise undefined (callers
// treat that identically to "not found", which is also correct behavior for "not yours").
export async function getOwnedDeck(deckIdParam: string | string[] | undefined, userId: string) {
  const deckId = requireParam(deckIdParam, "deck id");
  return db.query.decks.findFirst({
    where: and(eq(decks.id, deckId), eq(decks.userId, userId)),
  });
}

// Bumps `updatedAt` on the deck — called after any change to a deck's cards so the dashboard's
// "most recently updated" sort order reflects card-level edits, not just deck-level ones.
export async function touchDeck(deckId: string) {
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId));
}
