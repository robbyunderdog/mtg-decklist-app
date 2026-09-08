// Sniffs which decklist text format was pasted, so parseLines.ts knows which header/foil
// conventions to expect. Order matters: more specific/unambiguous signals are checked first.
import type { ImportFormat } from "./types.js";

const ARCHIDEKT_BRACKET_HEADER = /\[(maybeboard|commander|sideboard)\]/i;
// "*F*" also shows up as a foil marker in Arena/MTGO-style exports (e.g. Moxfield's
// "Copy for Arena"), so it's only a reliable Archidekt signal when nothing more
// specific (bracket headers, moxfield colon headers, arena set annotations) matched.
const ARCHIDEKT_FOIL_MARKER = /\^foil\^|\*f\*/i;
const ARENA_SET_SUFFIX = /^\d+x?\s+.+\([A-Za-z0-9]{2,4}\)\s+\S+\s*$/m;
const MOXFIELD_HEADER = /^(sideboard|maybeboard|commander)\s*:/im;

export function detectFormat(text: string): ImportFormat {
  if (ARCHIDEKT_BRACKET_HEADER.test(text)) return "archidekt";
  if (MOXFIELD_HEADER.test(text)) return "moxfield";
  if (ARENA_SET_SUFFIX.test(text)) return "arena";
  if (ARCHIDEKT_FOIL_MARKER.test(text)) return "archidekt";
  return "plain";
}
