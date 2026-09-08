// The list of deck formats shown in format dropdowns.
// Kept in sync with server/src/constants/formats.ts. Values match Scryfall's
// legality keys so they line up with the `legalities` data already cached per card.
export const DECK_FORMATS = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "oathbreaker",
  "brawl",
  "pauper",
  "historic",
  "alchemy",
  "penny",
  "other",
] as const;

export type DeckFormat = (typeof DECK_FORMATS)[number];

// Human-readable labels for each format value, for <select> options.
export const DECK_FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: "Standard",
  pioneer: "Pioneer",
  modern: "Modern",
  legacy: "Legacy",
  vintage: "Vintage",
  commander: "Commander",
  oathbreaker: "Oathbreaker",
  brawl: "Brawl",
  pauper: "Pauper",
  historic: "Historic",
  alchemy: "Alchemy",
  penny: "Penny Dreadful",
  other: "Other",
};
