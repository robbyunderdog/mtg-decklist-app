// Entry point for the "pasted text" side of decklist import: detect the format, split it
// into lines, then resolve each line against a real card. (The "deck link" side lives in
// urlImport.ts, which calls back into this module for the MTGGoldfish text-export case.)
import { detectFormat } from "./detectFormat.js";
import { parseLines } from "./parseLines.js";
import { resolveCards, type ResolvedLine } from "./resolveCards.js";
import type { ImportFormat } from "./types.js";

export interface ImportPreview {
  detectedFormat: ImportFormat;
  lines: ResolvedLine[];
}

export async function parseImportText(text: string): Promise<ImportPreview> {
  const detectedFormat = detectFormat(text);
  const { lines, skipped } = parseLines(text, detectedFormat);
  const resolved = await resolveCards(lines, skipped);
  return { detectedFormat, lines: resolved };
}

export { detectFormat } from "./detectFormat.js";
export { parseLines } from "./parseLines.js";
export type { Board, ImportFormat, ParsedLine } from "./types.js";
