import PQueue from "p-queue";
import { env } from "../../config/env.js";

const SCRYFALL_BASE = "https://api.scryfall.com";

// Scryfall asks integrators to stay under 10 requests/second; a single shared queue
// throttles every outbound call app-wide regardless of caller. 120ms keeps us under
// that ceiling with margin instead of riding exactly at the limit.
const queue = new PQueue({ concurrency: 1, interval: 120, intervalCap: 1 });

export class ScryfallNotFoundError extends Error {}

async function scryfallFetch(path: string, init?: RequestInit): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${SCRYFALL_BASE}${path}`;
  return queue.add(async () => {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": `mtg-decklist-app/0.1 (contact: ${env.SCRYFALL_CONTACT_EMAIL})`,
        Accept: "application/json",
        ...init?.headers,
      },
    });

    if (res.status === 404) {
      throw new ScryfallNotFoundError(`Not found: ${url}`);
    }
    if (!res.ok) {
      throw new Error(`Scryfall request failed (${res.status}): ${url}`);
    }
    return res.json();
  });
}

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  collector_number: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  cmc?: number;
  image_uris?: { small?: string; normal?: string; art_crop?: string };
  card_faces?: { image_uris?: { small?: string; normal?: string; art_crop?: string } }[];
  prices: { usd: string | null; usd_foil: string | null; eur: string | null; tix: string | null };
  legalities: Record<string, string>;
  scryfall_uri: string;
}

export function fetchCardByFuzzyName(name: string, set?: string) {
  const params = new URLSearchParams({ fuzzy: name });
  if (set) params.set("set", set);
  return scryfallFetch(`/cards/named?${params}`) as Promise<ScryfallCard>;
}

export function fetchCardById(scryfallId: string) {
  return scryfallFetch(`/cards/${scryfallId}`) as Promise<ScryfallCard>;
}

export interface ScryfallSearchResult {
  data: ScryfallCard[];
  has_more: boolean;
  next_page?: string;
}

export interface SearchOptions {
  unique?: "cards" | "art" | "prints";
  order?: string;
  dir?: "asc" | "desc";
}

export function searchCards(query: string, opts?: SearchOptions) {
  const params = new URLSearchParams({ q: query });
  if (opts?.unique) params.set("unique", opts.unique);
  if (opts?.order) params.set("order", opts.order);
  if (opts?.dir) params.set("dir", opts.dir);
  return scryfallFetch(`/cards/search?${params}`) as Promise<ScryfallSearchResult>;
}

/** Follows a `next_page` URL from a previous search result page. */
export function fetchSearchPage(url: string) {
  return scryfallFetch(url) as Promise<ScryfallSearchResult>;
}

export interface ScryfallCollectionResult {
  data: ScryfallCard[];
  not_found: { id?: string }[];
}

export function fetchCardsByIds(scryfallIds: string[]) {
  return scryfallFetch("/cards/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifiers: scryfallIds.map((id) => ({ id })) }),
  }) as Promise<ScryfallCollectionResult>;
}
