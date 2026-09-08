// Turns raw decklist text into a flat list of "N copies of Card Name, on this board" lines,
// given the format detectFormat.ts already identified. Doesn't touch Scryfall — purely
// string parsing. Card names are matched against real cards afterwards in resolveCards.ts.
import type { Board, ImportFormat, ParsedLine, SkippedLine } from "./types.js";

const BASE_LINE = /^(\d+)x?\s+(.+)$/;
const ARCHIDEKT_HEADER = /^\[(maybeboard|commander|sideboard)\]$/i;
const MOXFIELD_HEADER = /^(sideboard|maybeboard|commander)\s*:$/i;
const ARENA_HEADER = /^(sideboard|commander)$/i;
const TRAILING_SET_ANNOTATION = /\s*\(([A-Za-z0-9]{2,4})\)\s*[A-Za-z0-9-]*\s*$/;
const ARCHIDEKT_FOIL_TOKEN = /\^foil\^|\*f\*/i;
const TRAILING_FOIL_TOKEN = /\s*\*f\*\s*$/i;

const HEADER_BOARD: Record<string, Board> = {
  sideboard: "side",
  maybeboard: "maybe",
  commander: "commander",
};

export interface ParseResult {
  lines: ParsedLine[];
  skipped: SkippedLine[];
}

// Walks the text line by line, tracking which board section we're currently in (starts as
// "main" and switches on a recognized header line for the given format) and turning each
// "4 Lightning Bolt"-style line into a ParsedLine.
export function parseLines(text: string, format: ImportFormat): ParseResult {
  const rawLines = text.split(/\r?\n/);
  const lines: ParsedLine[] = [];
  const skipped: SkippedLine[] = [];

  let currentBoard: Board = "main";
  let arenaHasToggled = false;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (trimmed === "") {
      // Arena's plain-text export has no explicit "Sideboard" header — it just separates
      // main and sideboard with one blank line — so the *first* blank line is the signal.
      if (format === "arena" && !arenaHasToggled) {
        currentBoard = "side";
        arenaHasToggled = true;
      }
      continue;
    }

    if (format === "moxfield") {
      const headerMatch = trimmed.match(MOXFIELD_HEADER);
      if (headerMatch) {
        currentBoard = HEADER_BOARD[headerMatch[1].toLowerCase()];
        continue;
      }
    }

    if (format === "archidekt") {
      const headerMatch = trimmed.match(ARCHIDEKT_HEADER);
      if (headerMatch) {
        currentBoard = HEADER_BOARD[headerMatch[1].toLowerCase()];
        continue;
      }
    }

    if (format === "arena") {
      const headerMatch = trimmed.match(ARENA_HEADER);
      if (headerMatch) {
        currentBoard = HEADER_BOARD[headerMatch[1].toLowerCase()];
        arenaHasToggled = true;
        continue;
      }
    }

    // "// comment" lines and a bare "Deck" header (both common in exported files) are just noise.
    if (trimmed.startsWith("//") || trimmed.toLowerCase() === "deck") {
      continue;
    }

    const match = trimmed.match(BASE_LINE);
    if (!match) {
      skipped.push({ rawLine });
      continue;
    }

    const quantity = parseInt(match[1], 10);
    let name = match[2].trim();
    let setCode: string | undefined;

    // Foil markers are stripped purely so they don't pollute the parsed card name / set
    // annotation below — imported decks are never flagged as foil (see types.ts).
    if (format === "archidekt" && ARCHIDEKT_FOIL_TOKEN.test(name)) {
      name = name.replace(ARCHIDEKT_FOIL_TOKEN, "").trim();
    }

    if (format === "arena" || format === "moxfield") {
      if (TRAILING_FOIL_TOKEN.test(name)) {
        name = name.replace(TRAILING_FOIL_TOKEN, "").trim();
      }

      // Pulls the set code out of a trailing "(SET) 123" annotation so resolveCards.ts can
      // resolve the exact printing instead of whatever printing Scryfall's fuzzy name match
      // happens to prefer.
      const setMatch = name.match(TRAILING_SET_ANNOTATION);
      if (setMatch) {
        setCode = setMatch[1].toLowerCase();
        name = name.replace(TRAILING_SET_ANNOTATION, "").trim();
      }
    }

    lines.push({ rawLine, quantity, parsedName: name, board: currentBoard, foil: false, setCode });
  }

  return { lines, skipped };
}
