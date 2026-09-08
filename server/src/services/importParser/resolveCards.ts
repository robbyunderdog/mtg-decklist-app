// Matches each parsed decklist line against a real Scryfall card (by name, optionally
// narrowed by set), turning a ParsedLine into a ResolvedLine the import preview UI can render.
import * as cardCache from "../scryfall/cache.js";
import { ScryfallNotFoundError } from "../scryfall/client.js";
import type { ParsedLine, SkippedLine } from "./types.js";

type CardRow = Awaited<ReturnType<typeof cardCache.findCardById>>;

// One line in the import preview: either a confirmed match, a name Scryfall couldn't find
// (with suggestions to pick from), or a line that failed to parse at all.
export interface ResolvedLine {
  rawLine: string;
  quantity: number;
  board: ParsedLine["board"];
  foil: boolean;
  status: "matched" | "unresolved" | "skipped";
  parsedName: string;
  // True if Scryfall's fuzzy match returned a different name than what was typed (e.g. a
  // typo) — surfaced in the UI so the user can double check the correction.
  nameCorrected?: boolean;
  matchedCard?: CardRow;
  suggestions?: CardRow[];
}

async function resolveLine(line: ParsedLine): Promise<ResolvedLine> {
  try {
    const { card, exactNameMatch } = await cardCache.resolveCardByName(line.parsedName, line.setCode);
    return {
      rawLine: line.rawLine,
      quantity: line.quantity,
      board: line.board,
      foil: line.foil,
      status: "matched",
      parsedName: line.parsedName,
      nameCorrected: !exactNameMatch,
      matchedCard: card,
    };
  } catch (err) {
    if (err instanceof ScryfallNotFoundError) {
      // No exact/fuzzy match — offer a handful of live search results so the user can pick
      // the intended card manually in the preview table instead of the line being dropped.
      let suggestions: CardRow[] = [];
      try {
        suggestions = await cardCache.searchCardsLive(line.parsedName);
      } catch {
        suggestions = [];
      }
      return {
        rawLine: line.rawLine,
        quantity: line.quantity,
        board: line.board,
        foil: line.foil,
        status: "unresolved",
        parsedName: line.parsedName,
        suggestions: suggestions.slice(0, 5),
      };
    }
    throw err;
  }
}

// Resolves every parsed line against Scryfall (sequentially, to stay within the shared rate
// limiter — see services/scryfall/client.ts) and appends the unparseable lines as "skipped"
// so the caller gets one combined list to render.
export async function resolveCards(
  lines: ParsedLine[],
  skipped: SkippedLine[]
): Promise<ResolvedLine[]> {
  const resolved: ResolvedLine[] = [];
  for (const line of lines) {
    resolved.push(await resolveLine(line));
  }
  for (const s of skipped) {
    resolved.push({
      rawLine: s.rawLine,
      quantity: 0,
      board: "main",
      foil: false,
      status: "skipped",
      parsedName: s.rawLine.trim(),
    });
  }
  return resolved;
}
