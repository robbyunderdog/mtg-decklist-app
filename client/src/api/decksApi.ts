// Deck and deck-card endpoints — the bulk of the app's API surface. Used by DashboardPage,
// DeckEditorPage, and the printing picker/card search components.
import { apiFetch } from "./client";
import type { ScryfallCard } from "./cardsApi";
import type { DeckFormat } from "../constants/formats";

// The shape returned by listDecks() — enough to render a deck card on the dashboard without
// fetching each deck's full card list.
export interface DeckSummary {
  id: string;
  name: string;
  format: string | null;
  status: "in_progress" | "complete" | "archived";
  tags: string[];
  updatedAt: string;
  priceTotal: string;
  quantityTotal: number;
  checkedTotal: number;
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

// Creates an empty deck. Currently unused by the UI — the dashboard's manual "create deck"
// form was removed in favor of always importing a decklist — but left here since the server
// endpoint still supports it.
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

// Adds a card to a deck (or merges into an existing row of the same printing/board/foil —
// see the server's addCard controller).
export function addCardToDeck(
  deckId: string,
  input: { scryfallId: string; quantity?: number; board?: Board; foil?: boolean }
) {
  return apiFetch<{ deckCard: DeckCardRow }>(`/decks/${deckId}/cards`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Edits one deck card row — quantity, checked-off count, board, and/or foil (any subset).
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

// Swaps one card row to its cheapest known printing.
export function useCheapestPrinting(deckId: string, cardRowId: string) {
  return apiFetch<{ deckCard: DeckCardRow; changed: boolean }>(
    `/decks/${deckId}/cards/${cardRowId}/cheapest-printing`,
    { method: "POST" }
  );
}

// Sweeps every card in the deck to its cheapest known printing.
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
  imageNormal: string | null;
}

// Lists known printings of a card row's underlying card, for the "change printing" picker.
export function listPrintings(deckId: string, cardRowId: string) {
  return apiFetch<{ printings: PrintingOption[]; currentScryfallId: string }>(
    `/decks/${deckId}/cards/${cardRowId}/printings`
  );
}

// Swaps a card row to a specific printing the user picked.
export function setPrinting(deckId: string, cardRowId: string, scryfallId: string) {
  return apiFetch<{ deckCard: DeckCardRow; changed: boolean }>(
    `/decks/${deckId}/cards/${cardRowId}/printing`,
    { method: "POST", body: JSON.stringify({ scryfallId }) }
  );
}
