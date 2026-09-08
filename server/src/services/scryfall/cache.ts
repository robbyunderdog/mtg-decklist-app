// Local Postgres cache in front of the Scryfall API (see scryfall/client.ts). Almost
// everything else in the app that needs card data — search, printings, deck cards — goes
// through this module rather than calling Scryfall directly, so a card is only ever fetched
// live once and reused from the `cards` table after that (until it goes stale, see isStale).
import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../../db/pool.js";
import { cards } from "../../db/schema.js";
import * as scryfall from "./client.js";
import { ScryfallNotFoundError } from "./client.js";
import type { ScryfallCard } from "./client.js";

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// Maps a Scryfall API card object onto this app's `cards` table row shape.
function toRow(card: ScryfallCard) {
  const faceImages = card.card_faces?.[0]?.image_uris;
  const images = card.image_uris ?? faceImages;

  return {
    scryfallId: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    setCode: card.set,
    collectorNumber: card.collector_number,
    manaCost: card.mana_cost ?? null,
    typeLine: card.type_line ?? null,
    oracleText: card.oracle_text ?? null,
    colors: card.colors ?? null,
    cmc: card.cmc?.toString() ?? null,
    imageNormal: images?.normal ?? null,
    imageSmall: images?.small ?? null,
    imageArtCrop: images?.art_crop ?? null,
    priceUsd: card.prices.usd,
    priceUsdFoil: card.prices.usd_foil,
    priceEur: card.prices.eur,
    priceTix: card.prices.tix,
    legalities: card.legalities,
    scryfallUri: card.scryfall_uri,
    fetchedAt: new Date(),
  };
}

// Inserts or refreshes one card row, keyed by its Scryfall id (so re-caching an already-known
// printing just updates its price/data in place instead of erroring on the primary key).
async function upsertCard(card: ScryfallCard) {
  const row = toRow(card);
  const [saved] = await db
    .insert(cards)
    .values(row)
    .onConflictDoUpdate({ target: cards.scryfallId, set: row })
    .returning();
  return saved;
}

export async function upsertCards(cardList: ScryfallCard[]) {
  return Promise.all(cardList.map(upsertCard));
}

// Looks up one exact printing by Scryfall id — cache first, live Scryfall fetch on a miss.
// Throws ScryfallNotFoundError if Scryfall doesn't recognize the id either.
export async function findCardById(scryfallId: string) {
  const cached = await db.query.cards.findFirst({ where: eq(cards.scryfallId, scryfallId) });
  if (cached) return cached;

  const card = await scryfall.fetchCardById(scryfallId);
  return upsertCard(card);
}

export interface ResolvedCard {
  card: typeof cards.$inferSelect;
  exactNameMatch: boolean;
}

// Looks up a card by name (optionally narrowed to a set) — cache first (case-insensitive
// exact match), falling back to Scryfall's fuzzy-name search on a miss. `exactNameMatch` is
// false when Scryfall's fuzzy match corrected a typo, so callers can flag that to the user.
export async function resolveCardByName(name: string, set?: string): Promise<ResolvedCard> {
  const cached = await db.query.cards.findFirst({
    where: set
      ? and(ilike(cards.name, name), eq(cards.setCode, set.toLowerCase()))
      : ilike(cards.name, name),
  });
  if (cached) {
    return { card: cached, exactNameMatch: true };
  }

  const card = await scryfall.fetchCardByFuzzyName(name, set);
  const saved = await upsertCard(card);
  return { card: saved, exactNameMatch: saved.name.toLowerCase() === name.toLowerCase() };
}

// Always hits Scryfall directly (used for the card search box, where results need to reflect
// a live text search rather than only what's already cached) and caches whatever comes back.
export async function searchCardsLive(query: string) {
  const result = await scryfall.searchCards(query);
  return upsertCards(result.data);
}

// Picks whichever cached price applies (foil vs. non-foil), falling back to the other one if
// the requested variant has no price — better to show an approximate price than none at all.
function cachedPrice(row: typeof cards.$inferSelect, foil: boolean): number | null {
  const primary = foil ? row.priceUsdFoil : row.priceUsd;
  const value = primary ?? row.priceUsd ?? row.priceUsdFoil;
  return value != null ? Number(value) : null;
}

/**
 * Finds the cheapest known printing of a card, checking the local Neon cache (warmed at
 * import time by {@link cacheAllPrintings}) before ever touching Scryfall. Only falls back to
 * a live search when the cache doesn't yet have more than the single printing already in the
 * deck — e.g. a card added via the search box rather than import.
 */
export async function findCheapestPrinting(oracleId: string, foil: boolean) {
  const cached = await db.query.cards.findMany({ where: eq(cards.oracleId, oracleId) });
  if (cached.length > 1) {
    const priced = cached
      .map((row) => ({ row, price: cachedPrice(row, foil) }))
      .filter((p): p is { row: typeof cards.$inferSelect; price: number } => p.price != null);
    if (priced.length > 0) {
      priced.sort((a, b) => a.price - b.price);
      return priced[0].row;
    }
  }

  let result;
  try {
    result = await scryfall.searchCards(`oracleid:${oracleId}`, {
      unique: "prints",
      order: "usd",
      dir: "asc",
    });
  } catch (err) {
    if (err instanceof ScryfallNotFoundError) return null;
    throw err;
  }

  const priceKey = foil ? "usd_foil" : "usd";
  const priced = (card: ScryfallCard) => card.prices[priceKey] ?? card.prices.usd ?? card.prices.usd_foil;
  const pool = result.data.filter((card) => priced(card) != null);
  if (pool.length === 0) return null;

  pool.sort((a, b) => Number(priced(a)) - Number(priced(b)));
  return upsertCard(pool[0]);
}

export interface PrintingOption {
  scryfallId: string;
  setCode: string;
  collectorNumber: string;
  priceUsd: string | null;
  priceUsdFoil: string | null;
  imageSmall: string | null;
  imageNormal: string | null;
}

// Trims a full cached card row down to just what the "change printing" picker needs to render.
function toPrintingOption(row: typeof cards.$inferSelect): PrintingOption {
  return {
    scryfallId: row.scryfallId,
    setCode: row.setCode,
    collectorNumber: row.collectorNumber,
    priceUsd: row.priceUsd,
    priceUsdFoil: row.priceUsdFoil,
    imageSmall: row.imageSmall,
    imageNormal: row.imageNormal,
  };
}

// Printings with no known price sort last rather than first (Infinity), not by pushing
// unpriced cards above cheap ones.
function byPriceAsc(a: PrintingOption, b: PrintingOption) {
  const pa = a.priceUsd != null ? Number(a.priceUsd) : Infinity;
  const pb = b.priceUsd != null ? Number(b.priceUsd) : Infinity;
  return pa - pb;
}

// Scryfall's search paginates ~175 cards/page; basic lands can have 1000+ printings, so cap
// how many pages we're willing to walk for one card rather than fetching every page forever.
const MAX_PRINTING_PAGES = 5;

/** Fetches every printing of a card from Scryfall and upserts them all into the local cache. */
export async function cacheAllPrintings(oracleId: string): Promise<void> {
  let result;
  try {
    result = await scryfall.searchCards(`oracleid:${oracleId}`, { unique: "prints" });
  } catch (err) {
    if (err instanceof ScryfallNotFoundError) return;
    throw err;
  }
  await upsertCards(result.data);

  let page = 1;
  while (result.has_more && result.next_page && page < MAX_PRINTING_PAGES) {
    result = await scryfall.fetchSearchPage(result.next_page);
    await upsertCards(result.data);
    page++;
  }
}

/** Same as {@link cacheAllPrintings}, but for a batch of deck cards' oracle ids at once. */
export async function cacheAllPrintingsForCardIds(scryfallIds: string[]): Promise<void> {
  if (scryfallIds.length === 0) return;
  const rows = await db
    .selectDistinct({ oracleId: cards.oracleId })
    .from(cards)
    .where(inArray(cards.scryfallId, scryfallIds));

  for (const { oracleId } of rows) {
    try {
      await cacheAllPrintings(oracleId);
    } catch (err) {
      console.error(`[printingsCache] failed to warm printings for oracle ${oracleId}:`, err);
    }
  }
}

/**
 * Lists known printings for a card, served entirely from the local cache warmed at import
 * time by {@link cacheAllPrintings} — deliberately never falls back to a live Scryfall call.
 * That live fallback used to queue behind whatever else was hitting Scryfall's shared rate
 * limiter (e.g. a deck-wide cheapest-printing sweep), making "Change printing" hang and then
 * come back empty. A card added outside of import (search box) may only show its own printing
 * here until some deck import warms the rest of its printings into the cache.
 */
export async function listPrintings(oracleId: string): Promise<PrintingOption[]> {
  const cached = await db.query.cards.findMany({ where: eq(cards.oracleId, oracleId) });
  return cached.map(toPrintingOption).sort(byPriceAsc);
}

// True once a cached card's data is more than 24h old — the threshold the nightly price
// refresh job (jobs/priceRefresh.ts) uses to decide what needs re-fetching.
export function isStale(fetchedAt: Date) {
  return Date.now() - fetchedAt.getTime() > STALE_AFTER_MS;
}

// Finds up to `limit` cards whose cached data is stale, for the price refresh job to re-fetch.
export async function findStaleCardIds(limit = 75) {
  const rows = await db
    .select({ scryfallId: cards.scryfallId })
    .from(cards)
    .where(sql`${cards.fetchedAt} < now() - interval '24 hours'`)
    .limit(limit);
  return rows.map((r) => r.scryfallId);
}

// Re-fetches a batch of cards from Scryfall (regardless of staleness) and overwrites their
// cached rows — used by the nightly refresh job once it already knows which ids are stale.
export async function refreshCardsById(scryfallIds: string[]) {
  if (scryfallIds.length === 0) return [];
  const result = await scryfall.fetchCardsByIds(scryfallIds);
  return upsertCards(result.data);
}
