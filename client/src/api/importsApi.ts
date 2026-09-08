// Decklist import endpoints, used by ImportPage. Import is a two-step flow: preview (parse
// only, nothing saved) then confirm (write the reviewed lines into a deck).
import { apiFetch } from "./client";
import type { Board } from "./decksApi";
import type { ScryfallCard } from "./cardsApi";
import type { DeckFormat } from "../constants/formats";

// How the server recognized the input. The `-link` variants mean it came from fetching a
// deck-site link directly rather than parsing pasted text (see server urlImport.ts).
export type ImportFormat =
  | "plain"
  | "arena"
  | "moxfield"
  | "archidekt"
  | "moxfield-link"
  | "archidekt-link"
  | "mtggoldfish-link";
export type ImportLineStatus = "matched" | "unresolved" | "skipped";

// One line in the import preview — a confirmed match, a name that needs manual disambiguation
// (see `suggestions`), or an unparseable line.
export interface ImportPreviewLine {
  rawLine: string;
  quantity: number;
  board: Board;
  foil: boolean;
  status: ImportLineStatus;
  parsedName: string;
  nameCorrected?: boolean;
  matchedCard?: ScryfallCard;
  suggestions?: ScryfallCard[];
}

export interface ImportPreview {
  detectedFormat: ImportFormat;
  lines: ImportPreviewLine[];
}

// Parses `rawText` — either pasted decklist text or a supported deck-site link — into a
// reviewable preview. Nothing is saved until confirmImport/importAsNewDeck is called.
export function previewImport(rawText: string) {
  return apiFetch<ImportPreview>("/imports/preview", {
    method: "POST",
    body: JSON.stringify({ rawText }),
  });
}

export interface ConfirmLine {
  scryfallId: string;
  quantity: number;
  board: Board;
  foil: boolean;
}

// Overwrites an existing deck's cards with the reviewed import lines.
export function confirmImport(deckId: string, lines: ConfirmLine[]) {
  return apiFetch<{ ok: true }>(`/decks/${deckId}/import/confirm`, {
    method: "POST",
    body: JSON.stringify({ lines }),
  });
}

// Creates a new deck and imports the reviewed lines into it in one step.
export function importAsNewDeck(name: string, format: DeckFormat, lines: ConfirmLine[]) {
  return apiFetch<{ deck: { id: string } }>("/decks/import/new", {
    method: "POST",
    body: JSON.stringify({ name, format, lines }),
  });
}
