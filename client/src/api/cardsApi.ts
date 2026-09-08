// Card search — used by CardSearchBox (adding a card to a deck by name).
import { apiFetch } from "./client";

// Mirrors the server's cached card row shape (server/src/db/schema.ts `cards` table).
export interface ScryfallCard {
  scryfallId: string;
  oracleId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  colors: string[] | null;
  cmc: string | null;
  imageNormal: string | null;
  imageSmall: string | null;
  imageArtCrop: string | null;
  priceUsd: string | null;
  priceUsdFoil: string | null;
  priceEur: string | null;
  priceTix: string | null;
  scryfallUri: string | null;
}

export function searchCards(query: string) {
  return apiFetch<{ cards: ScryfallCard[] }>(`/cards/search?q=${encodeURIComponent(query)}`);
}
