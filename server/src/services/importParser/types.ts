export type Board = "main" | "side" | "maybe" | "commander";
export type ImportFormat = "plain" | "arena" | "moxfield" | "archidekt";

export interface ParsedLine {
  rawLine: string;
  quantity: number;
  parsedName: string;
  board: Board;
  foil: boolean;
  setCode?: string;
}

export interface SkippedLine {
  rawLine: string;
}
