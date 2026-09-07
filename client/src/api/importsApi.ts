import { apiFetch } from "./client";
import type { Board } from "./decksApi";
import type { ScryfallCard } from "./cardsApi";
import type { DeckFormat } from "../constants/formats";

export type ImportFormat = "plain" | "arena" | "moxfield" | "archidekt";
export type ImportLineStatus = "matched" | "unresolved" | "skipped";

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

export function confirmImport(deckId: string, lines: ConfirmLine[]) {
  return apiFetch<{ ok: true }>(`/decks/${deckId}/import/confirm`, {
    method: "POST",
    body: JSON.stringify({ lines }),
  });
}

export function importAsNewDeck(name: string, format: DeckFormat, lines: ConfirmLine[]) {
  return apiFetch<{ deck: { id: string } }>("/decks/import/new", {
    method: "POST",
    body: JSON.stringify({ name, format, lines }),
  });
}
