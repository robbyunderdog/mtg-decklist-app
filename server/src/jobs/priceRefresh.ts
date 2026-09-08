// Keeps cached card prices from going stale. Cards are fetched from Scryfall on demand and
// cached indefinitely (see services/scryfall/cache.ts); this job is what re-fetches them
// once they're more than 24h old so displayed prices don't drift too far from reality.
import cron from "node-cron";
import * as cardCache from "../services/scryfall/cache.js";

// Re-fetches every card whose cached price is more than 24h old, in batches.
export async function refreshStalePrices() {
  let totalRefreshed = 0;
  // Loop in batches of 75 (the /cards/collection limit) until the stale backlog is drained.
  for (;;) {
    const staleIds = await cardCache.findStaleCardIds(75);
    if (staleIds.length === 0) break;

    await cardCache.refreshCardsById(staleIds);
    totalRefreshed += staleIds.length;

    if (staleIds.length < 75) break;
  }
  console.log(`[priceRefresh] refreshed ${totalRefreshed} stale card(s)`);
  return totalRefreshed;
}

// Registers the nightly cron job; call once at server startup.
export function scheduleNightlyPriceRefresh() {
  // Runs once a day at 03:00 server time, well outside typical usage hours.
  cron.schedule("0 3 * * *", () => {
    refreshStalePrices().catch((err) => console.error("[priceRefresh] failed:", err));
  });
}
