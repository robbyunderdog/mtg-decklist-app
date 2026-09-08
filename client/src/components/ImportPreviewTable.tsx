// Editable list of cards on the import preview screen — lets the user fix quantities, resolve
// unmatched card names via suggestions, or exclude individual lines before confirming import.
import type { ScryfallCard } from "../api/cardsApi";
import type { Board } from "../api/decksApi";

// One row in the preview table, derived from an ImportPreviewLine by ImportPage's toDraftRows
// (merging duplicate cards, defaulting excluded/board, etc. — see ImportPage.tsx).
export interface DraftRow {
  key: string;
  rawLine: string;
  parsedName: string;
  quantity: number;
  board: Board;
  foil: boolean;
  card: ScryfallCard | null;
  nameCorrected?: boolean;
  suggestions?: ScryfallCard[];
  excluded: boolean;
}

interface Props {
  rows: DraftRow[];
  onChange: (key: string, patch: Partial<DraftRow>) => void;
}

export function ImportPreviewTable({ rows, onChange }: Props) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.key}
          className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
            row.excluded
              ? "border-neutral-800 bg-neutral-900/20 opacity-50"
              : row.card
                ? "border-neutral-800 bg-neutral-900/50"
                : "border-amber-800 bg-amber-950/20"
          }`}
        >
          {row.card?.imageSmall && (
            <img src={row.card.imageSmall} alt="" className="h-12 w-auto rounded" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-100">
              {row.card?.name ?? row.parsedName}
              {row.nameCorrected && (
                <span className="ml-2 text-xs text-amber-400">
                  (corrected from "{row.parsedName}")
                </span>
              )}
            </p>
            <p className="text-xs text-neutral-500">{row.rawLine}</p>

            {!row.card && row.suggestions && row.suggestions.length > 0 && (
              <select
                className="mt-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
                value=""
                onChange={(e) => {
                  const chosen = row.suggestions!.find((s) => s.scryfallId === e.target.value);
                  if (chosen) onChange(row.key, { card: chosen });
                }}
              >
                <option value="" disabled>
                  Pick a match...
                </option>
                {row.suggestions.map((s) => (
                  <option key={s.scryfallId} value={s.scryfallId}>
                    {s.name} ({s.setCode.toUpperCase()})
                  </option>
                ))}
              </select>
            )}
            {!row.card && (!row.suggestions || row.suggestions.length === 0) && (
              <p className="mt-1 text-xs text-red-400">No match found — will be skipped</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={row.excluded}
              onClick={() => onChange(row.key, { quantity: Math.max(1, row.quantity - 1) })}
              className="h-7 w-7 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-6 text-center text-sm text-neutral-100">{row.quantity}</span>
            <button
              type="button"
              disabled={row.excluded}
              onClick={() => onChange(row.key, { quantity: row.quantity + 1 })}
              className="h-7 w-7 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={() => onChange(row.key, { excluded: !row.excluded })}
            className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            {row.excluded ? "Include" : "Exclude"}
          </button>
        </div>
      ))}
    </div>
  );
}
