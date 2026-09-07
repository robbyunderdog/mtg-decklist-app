import { apiFetch } from "./client";

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
