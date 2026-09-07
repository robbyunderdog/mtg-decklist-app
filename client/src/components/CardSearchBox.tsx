import { useEffect, useRef, useState } from "react";
import { searchCards, type ScryfallCard } from "../api/cardsApi";

export function CardSearchBox({ onSelect }: { onSelect: (card: ScryfallCard) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { cards } = await searchCards(query);
        setResults(cards.slice(0, 8));
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

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
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        type="text"
        placeholder="Search for a card to add..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none focus:border-neutral-500"
      />
      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg">
          {isLoading && <div className="px-3 py-2 text-sm text-neutral-400">Searching...</div>}
          {!isLoading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-neutral-400">No cards found</div>
          )}
          {results.map((card) => (
            <button
              key={card.scryfallId}
              type="button"
              onClick={() => {
                onSelect(card);
                setQuery("");
                setResults([]);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-800"
            >
              {card.imageSmall && (
                <img src={card.imageSmall} alt="" className="h-10 w-auto rounded" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-100">{card.name}</p>
                <p className="text-xs text-neutral-400">
                  {card.setCode.toUpperCase()} · ${card.priceUsd ?? "—"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
