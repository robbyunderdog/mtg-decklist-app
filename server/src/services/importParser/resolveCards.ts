import * as cardCache from "../scryfall/cache.js";
import { ScryfallNotFoundError } from "../scryfall/client.js";
import type { ParsedLine, SkippedLine } from "./types.js";

type CardRow = Awaited<ReturnType<typeof cardCache.findCardById>>;

export interface ResolvedLine {
  rawLine: string;
  quantity: number;
  board: ParsedLine["board"];
  foil: boolean;
  status: "matched" | "unresolved" | "skipped";
  parsedName: string;
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
