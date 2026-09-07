import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as decksApi from "../api/decksApi";
import { HoverZoomImage } from "./HoverZoomImage";

interface Props {
  deckId: string;
  cardRowId: string;
  foil: boolean;
  onSelect: (scryfallId: string) => void;
}

export function PrintingPicker({ deckId, cardRowId, foil, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["printings", deckId, cardRowId],
    queryFn: () => decksApi.listPrintings(deckId, cardRowId),
    enabled: isOpen,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="text-xs text-neutral-400 underline decoration-dotted hover:text-emerald-400"
      >
        Change printing
      </button>
      {isOpen && (
        <div className="absolute left-0 z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg">
          {isLoading && <div className="px-3 py-2 text-sm text-neutral-400">Loading printings...</div>}
          {!isLoading && data?.printings.length === 0 && (
            <div className="px-3 py-2 text-sm text-neutral-400">No printings found</div>
          )}
          {data?.printings.map((p) => {
            const price = foil ? p.priceUsdFoil : p.priceUsd;
            const isCurrent = p.scryfallId === data.currentScryfallId;
            return (
              <button
                key={p.scryfallId}
                type="button"
                disabled={isCurrent}
                onClick={() => {
                  onSelect(p.scryfallId);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800 disabled:cursor-default disabled:bg-neutral-800/50 ${
                  isCurrent ? "opacity-60" : ""
                }`}
              >
                {p.imageSmall && (
                  <HoverZoomImage
                    small={p.imageSmall}
                    large={p.imageNormal}
                    alt={`${p.setCode.toUpperCase()} #${p.collectorNumber}`}
                    className="h-10 w-auto shrink-0 cursor-zoom-in rounded"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-100">
                    {p.setCode.toUpperCase()} #{p.collectorNumber}
                    {isCurrent && <span className="ml-1 text-xs text-emerald-400">(current)</span>}
                  </p>
                  <p className="text-xs text-neutral-400">{price != null ? `$${Number(price).toFixed(2)}` : "—"}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
