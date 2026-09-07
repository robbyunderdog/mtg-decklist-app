import type { DeckCardRow as DeckCardRowData } from "../api/decksApi";
import { HoverZoomImage } from "./HoverZoomImage";
import { PrintingPicker } from "./PrintingPicker";

interface Props {
  deckId: string;
  row: DeckCardRowData;
  onUpdate: (patch: Partial<{ checkedQuantity: number }>) => void;
  onRemove: () => void;
  onUseCheapestPrinting: () => void;
  onSetPrinting: (scryfallId: string) => void;
  isFindingCheapest?: boolean;
}

export function DeckCardRow({
  deckId,
  row,
  onUpdate,
  onRemove,
  onUseCheapestPrinting,
  onSetPrinting,
  isFindingCheapest,
}: Props) {
  const { card } = row;
  const price = row.foil ? card.priceUsdFoil : card.priceUsd;
  const priceValue = price != null ? Number(price) : null;
  const pulled = row.checkedQuantity >= row.quantity;

  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2">
      {row.quantity > 1 ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdate({ checkedQuantity: Math.max(0, row.checkedQuantity - 1) })}
            className="h-6 w-6 cursor-pointer rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            −
          </button>
          <span className={`w-10 text-center text-sm font-semibold ${pulled ? "text-emerald-400" : "text-neutral-100"}`}>
            {row.checkedQuantity}/{row.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdate({ checkedQuantity: Math.min(row.quantity, row.checkedQuantity + 1) })}
            className="h-6 w-6 cursor-pointer rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          >
            +
          </button>
        </div>
      ) : (
        <label className="flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={pulled}
            onChange={(e) => onUpdate({ checkedQuantity: e.target.checked ? row.quantity : 0 })}
            className="h-5 w-5 cursor-pointer rounded accent-emerald-500"
          />
        </label>
      )}

      {card.imageSmall && (
        <HoverZoomImage
          small={card.imageSmall}
          large={card.imageNormal}
          alt={card.name}
          className="h-14 w-auto shrink-0 cursor-zoom-in rounded"
        />
      )}

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${pulled ? "text-neutral-500 line-through" : "text-neutral-100"}`}>
          {row.quantity > 1 && <span className="text-neutral-400">{row.quantity}× </span>}
          {card.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-xs text-neutral-400">
            {card.setCode.toUpperCase()} #{card.collectorNumber}
          </p>
          <button
            type="button"
            onClick={onUseCheapestPrinting}
            disabled={isFindingCheapest}
            className="text-xs text-neutral-400 underline decoration-dotted hover:text-emerald-400 disabled:opacity-50"
          >
            {isFindingCheapest ? "Finding cheapest…" : "Use cheapest printing"}
          </button>
          <PrintingPicker deckId={deckId} cardRowId={row.id} foil={row.foil} onSelect={onSetPrinting} />
        </div>
      </div>

      <div className="flex w-24 shrink-0 flex-col items-center justify-center text-center">
        <span className="text-lg font-bold text-emerald-400">
          {priceValue != null ? `$${priceValue.toFixed(2)}` : "—"}
        </span>
        {row.quantity > 1 && priceValue != null && (
          <span className="text-xs text-neutral-500">${(priceValue * row.quantity).toFixed(2)} total</span>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove card"
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-3xl leading-none text-red-500 hover:text-red-400"
      >
        ×
      </button>
    </div>
  );
}
