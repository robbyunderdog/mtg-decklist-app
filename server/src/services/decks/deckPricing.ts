// SQL fragments and helpers for the dollar totals and collection-progress counts shown on
// the dashboard and deck editor. Only the "main" board counts — sideboard/maybeboard/
// commander cards aren't part of what a user is actually trying to collect for the deck.
//
// Note: raw SQL SUM()/COUNT() results come back from `pg` as strings (Postgres numeric/bigint
// types aren't safely representable as JS numbers), so callers that compare these values
// numerically (e.g. "is the deck fully checked off?") must `Number(...)` them first — compare
// two of these as strings and "9" > "10" lexicographically, which is wrong.
import { sql } from "drizzle-orm";
import { cards, deckCards } from "../../db/schema.js";

export const MAIN_TOTAL_SQL = sql<string>`COALESCE(SUM(${deckCards.quantity} * CASE WHEN ${deckCards.foil} THEN ${cards.priceUsdFoil} ELSE ${cards.priceUsd} END) FILTER (WHERE ${deckCards.board} = 'main'), 0)`;

export const MAIN_QUANTITY_TOTAL_SQL = sql<number>`COALESCE(SUM(${deckCards.quantity}) FILTER (WHERE ${deckCards.board} = 'main'), 0)`;

export const MAIN_CHECKED_TOTAL_SQL = sql<number>`COALESCE(SUM(${deckCards.checkedQuantity}) FILTER (WHERE ${deckCards.board} = 'main'), 0)`;

// JS-side equivalent of MAIN_TOTAL_SQL for totaling rows already loaded in memory rather than
// making a second database round-trip. Currently unused — decksController.ts's getDeck
// computes its total with an inline reduce instead — but kept here as the shared
// implementation for any future caller that needs the same math.
export function computeBoardTotal(
  rows: { quantity: number; board: string; foil: boolean; priceUsd: string | null; priceUsdFoil: string | null }[],
  board: string
) {
  return rows
    .filter((r) => r.board === board)
    .reduce((sum, r) => {
      const price = r.foil ? r.priceUsdFoil : r.priceUsd;
      return sum + r.quantity * Number(price ?? 0);
    }, 0);
}
