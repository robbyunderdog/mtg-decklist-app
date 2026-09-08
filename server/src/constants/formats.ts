// The list of deck formats a user can pick when creating/importing a deck.
// Kept in sync with client/src/constants/formats.ts. Values match Scryfall's
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

// Narrows DeckFormat to exactly the string literals in DECK_FORMATS above.
export type DeckFormat = (typeof DECK_FORMATS)[number];
