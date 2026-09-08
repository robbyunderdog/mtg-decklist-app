// Shared types for the decklist-import pipeline (text paste and deck-link import both
// produce these same shapes so the rest of the app doesn't need to care which path a card
// came from).

// Which section of the deck a card belongs to.
export type Board = "main" | "side" | "maybe" | "commander";

// How the raw input was recognized. The `-link` variants mean the deck came from fetching a
// site's API/export directly (see urlImport.ts) rather than from parsing pasted text.
export type ImportFormat =
  | "plain"
  | "arena"
  | "moxfield"
  | "archidekt"
  | "moxfield-link"
  | "archidekt-link"
  | "mtggoldfish-link";

// One decklist line after parsing, before it's been matched against a real card.
export interface ParsedLine {
  rawLine: string;
  quantity: number;
  parsedName: string;
  board: Board;
  foil: boolean;
  // Set/collector-number hint pulled from Arena/Moxfield-style "(SET) 123" suffixes, used to
  // resolve the exact printing rather than whatever printing Scryfall's fuzzy match prefers.
  setCode?: string;
}

// A line that didn't match the "N Card Name" pattern at all (garbage input, a stray header
// line the format detector didn't recognize, etc.) — kept around so the preview UI can show
// the user what got skipped instead of silently dropping it.
export interface SkippedLine {
  rawLine: string;
}
