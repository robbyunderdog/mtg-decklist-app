import { sql } from "drizzle-orm";
import { cards, deckCards } from "../../db/schema.js";

export const MAIN_TOTAL_SQL = sql<string>`COALESCE(SUM(${deckCards.quantity} * CASE WHEN ${deckCards.foil} THEN ${cards.priceUsdFoil} ELSE ${cards.priceUsd} END) FILTER (WHERE ${deckCards.board} = 'main'), 0)`;

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
