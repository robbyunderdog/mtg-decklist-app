// Entry point for the "paste a deck link" side of decklist import: recognizes a Moxfield,
// Archidekt, or MTGGoldfish deck URL, fetches that site's own data for the deck, and turns it
// into the same ImportPreview shape produced by parsing pasted text (see ./index.ts).
//
// Moxfield and Archidekt hand back each card's exact scryfallId, so those two are resolved
// directly (no fuzzy name matching, no risk of picking the wrong printing). MTGGoldfish's
// export is plain text with card names only, so it's converted into decklist text and run
// through the normal text-parsing pipeline instead.
import https from "node:https";
import { BadRequestError } from "../../utils/params.js";
import * as cardCache from "../scryfall/cache.js";
import { ScryfallNotFoundError } from "../scryfall/client.js";
import { parseImportText } from "./index.js";
import type { ResolvedLine } from "./resolveCards.js";
import type { Board } from "./types.js";
import type { ImportPreview } from "./index.js";

type Provider = "moxfield" | "archidekt" | "mtggoldfish";

// A card as reported by a deck site's own API, before it's been resolved against our local
// card cache. `scryfallId` is present for Moxfield/Archidekt (exact printing, no guessing).
interface DeckSourceCard {
  scryfallId?: string;
  name: string;
  quantity: number;
  board: Board;
  foil: boolean;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

const FETCH_TIMEOUT_MS = 10_000;

// Moxfield sits behind Cloudflare bot detection that fingerprints the TLS client and blocks
// Node's default fetch (undici) even with full browser headers — curl and real browsers get
// through fine. Restricting the cipher list to a common browser suite via the core `https`
// module (rather than fetch) avoids the fingerprint that gets flagged.
const BROWSER_CIPHERS = [
  "ECDHE-ECDSA-AES128-GCM-SHA256",
  "ECDHE-RSA-AES128-GCM-SHA256",
  "ECDHE-ECDSA-AES256-GCM-SHA384",
  "ECDHE-RSA-AES256-GCM-SHA384",
].join(":");

// Fetches JSON using Node's raw `https` module with a curated cipher list, for hosts (only
// Moxfield today) that block Node's default `fetch` client by TLS fingerprint.
function fetchJsonViaBrowserLikeTls(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { headers: BROWSER_HEADERS, minVersion: "TLSv1.2", ciphers: BROWSER_CIPHERS },
      (res) => {
        if (res.statusCode === 404) {
          res.resume();
          reject(new BadRequestError("Deck not found. Double-check the link and make sure the deck is public."));
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          const status = res.statusCode;
          res.resume();
          reject(new BadRequestError(`Failed to fetch that deck (status ${status}). Make sure it's public.`));
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new BadRequestError("Couldn't parse that deck's data."));
          }
        });
      }
    );
    req.on("error", () => reject(new BadRequestError("Couldn't reach that site to fetch the deck. Try again in a moment.")));
    req.setTimeout(FETCH_TIMEOUT_MS, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

// Fetches a URL with a browser-like User-Agent and a timeout, translating network/HTTP
// failures into a BadRequestError with a message that's safe to show the user directly.
async function fetchFromSite(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
    if (res.status === 404) {
      throw new BadRequestError("Deck not found. Double-check the link and make sure the deck is public.");
    }
    if (!res.ok) {
      throw new BadRequestError(`Failed to fetch that deck (status ${res.status}). Make sure it's public.`);
    }
    return res;
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError("Couldn't reach that site to fetch the deck. Try again in a moment.");
  } finally {
    clearTimeout(timeout);
  }
}

interface ParsedDeckUrl {
  provider: Provider;
  id: string;
}

/**
 * Only matches when the *entire* trimmed input is a single deck-site URL — a multi-line
 * pasted decklist that happens to contain a URL somewhere should still be parsed as text.
 */
export function parseDeckUrl(input: string): ParsedDeckUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "moxfield.com" && segments[0] === "decks" && segments[1]) {
    return { provider: "moxfield", id: segments[1] };
  }
  if (host === "archidekt.com" && segments[0] === "decks" && segments[1] && /^\d+$/.test(segments[1])) {
    return { provider: "archidekt", id: segments[1] };
  }
  if (host === "mtggoldfish.com" && segments[0] === "deck" && segments[1] && /^\d+$/.test(segments[1])) {
    return { provider: "mtggoldfish", id: segments[1] };
  }

  return null;
}

export function isSupportedDeckUrl(input: string): boolean {
  return parseDeckUrl(input) !== null;
}

// Recognized deck sites we don't fetch from yet — surfaced as a clear error instead of
// silently treating the pasted link as an unparseable decklist line.
const KNOWN_UNSUPPORTED_HOSTS = new Set(["tappedout.net", "deckstats.net", "aetherhub.com"]);

export function describeUnsupportedDeckUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (KNOWN_UNSUPPORTED_HOSTS.has(host)) {
    return `${host} deck links aren't supported yet — copy the decklist text from the site and paste it here instead.`;
  }
  return null;
}

interface MoxfieldBoardEntry {
  quantity: number;
  isFoil?: boolean;
  card?: { scryfall_id?: string; name?: string };
}

// Moxfield's public API returns the whole deck as separate keyed objects per board
// (mainboard/sideboard/maybeboard/commanders/companions), each entry keyed by card name and
// carrying that printing's own scryfall_id — so no name-guessing is needed on this path.
async function fetchMoxfieldDeck(deckId: string): Promise<DeckSourceCard[]> {
  const data = (await fetchJsonViaBrowserLikeTls(`https://api.moxfield.com/v2/decks/all/${deckId}`)) as Record<
    string,
    Record<string, MoxfieldBoardEntry> | undefined
  >;

  const cards: DeckSourceCard[] = [];
  const addBoard = (board: Record<string, MoxfieldBoardEntry> | undefined, target: Board) => {
    for (const entry of Object.values(board ?? {})) {
      cards.push({
        scryfallId: entry.card?.scryfall_id,
        name: entry.card?.name ?? "Unknown card",
        quantity: entry.quantity,
        board: target,
        foil: Boolean(entry.isFoil),
      });
    }
  };

  addBoard(data.mainboard, "main");
  addBoard(data.sideboard, "side");
  addBoard(data.maybeboard, "maybe");
  addBoard(data.commanders, "commander");
  // No dedicated "companion" board in this app — closest fit is sideboard, since a companion
  // is deckbuilding tech that isn't part of the physical 60/100-card decklist to collect.
  addBoard(data.companions, "side");

  if (cards.length === 0) {
    throw new BadRequestError("This Moxfield deck appears to be empty.");
  }
  return cards;
}

interface ArchidektCardEntry {
  quantity: number;
  categories?: string[] | null;
  modifier?: string;
  // `card.uid` is Archidekt's field name for the exact Scryfall printing id (verified against
  // Scryfall directly — it's not an Archidekt-internal id despite the generic name).
  card?: { uid?: string; oracleCard?: { name?: string } };
}

// Archidekt tags each card with the user-visible category names it belongs to (its default
// categories are literally "Commander"/"Sideboard"/"Maybeboard", matching the bracket-header
// names in the plain-text export this app already parses — see detectFormat.ts).
function archidektBoard(categories: string[] | null | undefined): Board {
  const cats = (categories ?? []).map((c) => c.toLowerCase());
  if (cats.includes("maybeboard")) return "maybe";
  if (cats.includes("sideboard")) return "side";
  if (cats.includes("commander")) return "commander";
  return "main";
}

async function fetchArchidektDeck(deckId: string): Promise<DeckSourceCard[]> {
  const res = await fetchFromSite(`https://archidekt.com/api/decks/${deckId}/`);
  const data = (await res.json()) as { cards?: ArchidektCardEntry[] };

  const cards: DeckSourceCard[] = (data.cards ?? []).map((entry) => ({
    scryfallId: entry.card?.uid,
    name: entry.card?.oracleCard?.name ?? "Unknown card",
    quantity: entry.quantity,
    board: archidektBoard(entry.categories),
    foil: typeof entry.modifier === "string" && entry.modifier.toLowerCase().includes("foil"),
  }));

  if (cards.length === 0) {
    throw new BadRequestError("This Archidekt deck appears to be empty.");
  }
  return cards;
}

async function fetchMtgGoldfishDecklistText(deckId: string): Promise<string> {
  const res = await fetchFromSite(`https://www.mtggoldfish.com/deck/download/${deckId}`);
  const text = await res.text();
  if (!text.trim()) {
    throw new BadRequestError("This MTGGoldfish deck appears to be empty.");
  }

  // MTGGoldfish separates mainboard/sideboard with a single blank line and no header, so
  // inject an explicit "Sideboard:" header the shared moxfield-style parser already knows.
  const blocks = text.split(/\r?\n\r?\n/).filter((b) => b.trim() !== "");
  if (blocks.length <= 1) return text;
  return `${blocks[0]}\n\nSideboard:\n${blocks.slice(1).join("\n\n")}`;
}

// Turns each site-provided card into a ResolvedLine. When a scryfallId is available (Moxfield/
// Archidekt) it's looked up directly — an exact-printing match, skipping name resolution
// entirely. Otherwise (MTGGoldfish, or a scryfallId Scryfall no longer recognizes) it falls
// back to the same name-based matching pasted text goes through, suggestions included.
async function resolveDeckSourceCards(sourceCards: DeckSourceCard[]): Promise<ResolvedLine[]> {
  const resolved: ResolvedLine[] = [];

  for (const sc of sourceCards) {
    const rawLine = `${sc.quantity} ${sc.name}`;

    if (sc.scryfallId) {
      try {
        const card = await cardCache.findCardById(sc.scryfallId);
        resolved.push({
          rawLine,
          quantity: sc.quantity,
          board: sc.board,
          foil: sc.foil,
          status: "matched",
          parsedName: sc.name,
          nameCorrected: false,
          matchedCard: card,
        });
        continue;
      } catch (err) {
        if (!(err instanceof ScryfallNotFoundError)) throw err;
        // Fall through to name-based resolution below.
      }
    }

    try {
      const { card, exactNameMatch } = await cardCache.resolveCardByName(sc.name);
      resolved.push({
        rawLine,
        quantity: sc.quantity,
        board: sc.board,
        foil: sc.foil,
        status: "matched",
        parsedName: sc.name,
        nameCorrected: !exactNameMatch,
        matchedCard: card,
      });
    } catch (err) {
      if (!(err instanceof ScryfallNotFoundError)) throw err;
      let suggestions: Awaited<ReturnType<typeof cardCache.searchCardsLive>> = [];
      try {
        suggestions = await cardCache.searchCardsLive(sc.name);
      } catch {
        suggestions = [];
      }
      resolved.push({
        rawLine,
        quantity: sc.quantity,
        board: sc.board,
        foil: sc.foil,
        status: "unresolved",
        parsedName: sc.name,
        suggestions: suggestions.slice(0, 5),
      });
    }
  }

  return resolved;
}

// Main entry point called from importsController.ts once it's confirmed the input is a
// supported deck link — dispatches to the right site-specific fetcher and resolver.
export async function previewDeckUrl(input: string): Promise<ImportPreview> {
  const parsed = parseDeckUrl(input);
  if (!parsed) {
    throw new BadRequestError(
      "Unsupported deck link. Paste a decklist instead, or use a Moxfield, Archidekt, or MTGGoldfish deck link."
    );
  }

  switch (parsed.provider) {
    case "moxfield": {
      const cards = await fetchMoxfieldDeck(parsed.id);
      return { detectedFormat: "moxfield-link", lines: await resolveDeckSourceCards(cards) };
    }
    case "archidekt": {
      const cards = await fetchArchidektDeck(parsed.id);
      return { detectedFormat: "archidekt-link", lines: await resolveDeckSourceCards(cards) };
    }
    case "mtggoldfish": {
      const text = await fetchMtgGoldfishDecklistText(parsed.id);
      const preview = await parseImportText(text);
      return { ...preview, detectedFormat: "mtggoldfish-link" };
    }
  }
}
