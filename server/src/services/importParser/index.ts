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
