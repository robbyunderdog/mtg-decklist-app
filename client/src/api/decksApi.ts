import { apiFetch } from "./client";
import type { ScryfallCard } from "./cardsApi";
import type { DeckFormat } from "../constants/formats";

export interface DeckSummary {
  id: string;
  name: string;
  format: string | null;
  status: "in_progress" | "complete" | "archived";
  tags: string[];
  updatedAt: string;
  priceTotal: string;
}

export interface Deck {
  id: string;
  userId: string;
  name: string;
  format: string | null;
  status: "in_progress" | "complete" | "archived";
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type Board = "main" | "side" | "maybe" | "commander";

export interface DeckCardRow {
  id: string;
  quantity: number;
  checkedQuantity: number;
  board: Board;
  foil: boolean;
  card: ScryfallCard;
}

export interface DeckDetail {
  deck: Deck;
  cards: DeckCardRow[];
  priceTotal: number;
}

export function listDecks() {
  return apiFetch<{ decks: DeckSummary[] }>("/decks");
}

export function createDeck(name: string, format: DeckFormat) {
  return apiFetch<{ deck: Deck }>("/decks", {
    method: "POST",
    body: JSON.stringify({ name, format }),
  });
}

export function getDeck(id: string) {
  return apiFetch<DeckDetail>(`/decks/${id}`);
}

export function updateDeck(id: string, patch: Partial<Pick<Deck, "name" | "format" | "status" | "notes" | "tags">>) {
  return apiFetch<{ deck: Deck }>(`/decks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteDeck(id: string) {
  return apiFetch<void>(`/decks/${id}`, { method: "DELETE" });
}

export function addCardToDeck(
  deckId: string,
  input: { scryfallId: string; quantity?: number; board?: Board; foil?: boolean }
) {
  return apiFetch<{ deckCard: DeckCardRow }>(`/decks/${deckId}/cards`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDeckCard(
  deckId: string,
  cardRowId: string,
  patch: Partial<{ quantity: number; checkedQuantity: number; board: Board; foil: boolean }>
) {
  return apiFetch<{ deckCard: DeckCardRow }>(`/decks/${deckId}/cards/${cardRowId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteDeckCard(deckId: string, cardRowId: string) {
  return apiFetch<void>(`/decks/${deckId}/cards/${cardRowId}`, { method: "DELETE" });
}

export function useCheapestPrinting(deckId: string, cardRowId: string) {
  return apiFetch<{ deckCard: DeckCardRow; changed: boolean }>(
    `/decks/${deckId}/cards/${cardRowId}/cheapest-printing`,
    { method: "POST" }
  );
}

export function useCheapestPrintingForDeck(deckId: string) {
  return apiFetch<{ updated: number; total: number }>(`/decks/${deckId}/cheapest-printings`, {
    method: "POST",
  });
}

export interface PrintingOption {
  scryfallId: string;
  setCode: string;
  collectorNumber: string;
  priceUsd: string | null;
  priceUsdFoil: string | null;
  imageSmall: string | null;
}

export function listPrintings(deckId: string, cardRowId: string) {
  return apiFetch<{ printings: PrintingOption[]; currentScryfallId: string }>(
    `/decks/${deckId}/cards/${cardRowId}/printings`
  );
}

export function setPrinting(deckId: string, cardRowId: string, scryfallId: string) {
  return apiFetch<{ deckCard: DeckCardRow; changed: boolean }>(
    `/decks/${deckId}/cards/${cardRowId}/printing`,
    { method: "POST", body: JSON.stringify({ scryfallId }) }
  );
}
