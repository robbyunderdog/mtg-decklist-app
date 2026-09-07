import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as decksApi from "../api/decksApi";
import type { DeckCardRow as DeckCardRowData } from "../api/decksApi";
import { CardSearchBox } from "../components/CardSearchBox";
import { DeckCardRow } from "../components/DeckCardRow";
import { ApiError } from "../api/client";
import { DECK_FORMATS, DECK_FORMAT_LABELS } from "../constants/formats";

type SortKey = "name" | "price-desc" | "price-asc" | "cmc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "price-desc", label: "Price (high to low)" },
  { value: "price-asc", label: "Price (low to high)" },
  { value: "cmc", label: "Mana value" },
];

function priceOf(row: DeckCardRowData) {
  const price = row.foil ? row.card.priceUsdFoil : row.card.priceUsd;
  return price != null ? Number(price) : 0;
}

function sortRows(rows: DeckCardRowData[], sort: SortKey) {
  const sorted = [...rows];
  switch (sort) {
    case "price-desc":
      sorted.sort((a, b) => priceOf(b) - priceOf(a));
      break;
    case "price-asc":
      sorted.sort((a, b) => priceOf(a) - priceOf(b));
      break;
    case "cmc":
      sorted.sort((a, b) => Number(a.card.cmc ?? 0) - Number(b.card.cmc ?? 0));
      break;
    case "name":
    default:
      sorted.sort((a, b) => a.card.name.localeCompare(b.card.name));
      break;
  }
  return sorted;
}

export function DeckEditorPage() {
  const { id } = useParams<{ id: string }>();
  const deckId = id!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<SortKey>("name");

  const { data, isLoading } = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => decksApi.getDeck(deckId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["deck", deckId] });

  const addCardMutation = useMutation({
    mutationFn: (scryfallId: string) => decksApi.addCardToDeck(deckId, { scryfallId, board: "main" }),
    onSuccess: invalidate,
  });

  const updateCardMutation = useMutation({
    mutationFn: ({ cardRowId, patch }: { cardRowId: string; patch: Parameters<typeof decksApi.updateDeckCard>[2] }) =>
      decksApi.updateDeckCard(deckId, cardRowId, patch),
    onSuccess: invalidate,
  });

  const removeCardMutation = useMutation({
    mutationFn: (cardRowId: string) => decksApi.deleteDeckCard(deckId, cardRowId),
    onSuccess: invalidate,
  });

  const cheapestPrintingMutation = useMutation({
    mutationFn: (cardRowId: string) => decksApi.useCheapestPrinting(deckId, cardRowId),
    onSuccess: invalidate,
  });

  const setPrintingMutation = useMutation({
    mutationFn: ({ cardRowId, scryfallId }: { cardRowId: string; scryfallId: string }) =>
      decksApi.setPrinting(deckId, cardRowId, scryfallId),
    onSuccess: invalidate,
  });

  const cheapestPrintingForDeckMutation = useMutation({
    mutationFn: () => decksApi.useCheapestPrintingForDeck(deckId),
    onSuccess: invalidate,
  });

  const updateDeckMutation = useMutation({
    mutationFn: (patch: Parameters<typeof decksApi.updateDeck>[1]) =>
      decksApi.updateDeck(deckId, patch),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["decks"] });
    },
  });

  const deleteDeckMutation = useMutation({
    mutationFn: () => decksApi.deleteDeck(deckId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decks"] });
      navigate("/");
    },
  });

  function handleDeleteDeck() {
    if (data && window.confirm(`Delete "${data.deck.name}"? This can't be undone.`)) {
      deleteDeckMutation.mutate();
    }
  }

  const sortedRows = useMemo(() => (data ? sortRows(data.cards, sort) : []), [data, sort]);

  const { checkedTotal, quantityTotal, totalCost, remainingCost } = useMemo(() => {
    const empty = { checkedTotal: 0, quantityTotal: 0, totalCost: 0, remainingCost: 0 };
    if (!data) return empty;
    return data.cards.reduce((acc, r) => {
      const unit = priceOf(r);
      const remainingQty = Math.max(0, r.quantity - r.checkedQuantity);
      return {
        checkedTotal: acc.checkedTotal + r.checkedQuantity,
        quantityTotal: acc.quantityTotal + r.quantity,
        totalCost: acc.totalCost + unit * r.quantity,
        remainingCost: acc.remainingCost + unit * remainingQty,
      };
    }, empty);
  }, [data]);

  if (isLoading || !data) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-8 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm text-neutral-400 hover:underline">
          ← Back to decks
        </Link>

        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{data.deck.name}</h1>
          <button
            type="button"
            onClick={handleDeleteDeck}
            disabled={deleteDeckMutation.isPending}
            className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40 disabled:opacity-50"
          >
            {deleteDeckMutation.isPending ? "Deleting…" : "Delete deck"}
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400">Format</label>
            <select
              value={data.deck.format ?? ""}
              onChange={(e) => updateDeckMutation.mutate({ format: e.target.value })}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
            >
              {!data.deck.format && (
                <option value="" disabled>
                  Select...
                </option>
              )}
              {DECK_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {DECK_FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <Link to={`/decks/${deckId}/import`} className="text-sm text-neutral-400 hover:underline">
            Re-import / bulk update
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <CardSearchBox onSelect={(card) => addCardMutation.mutate(card.scryfallId)} />
          <button
            type="button"
            onClick={() => cheapestPrintingForDeckMutation.mutate()}
            disabled={cheapestPrintingForDeckMutation.isPending}
            className="shrink-0 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
          >
            {cheapestPrintingForDeckMutation.isPending
              ? "Finding cheapest printings…"
              : "Use cheapest printing for entire deck"}
          </button>
        </div>
        {cheapestPrintingForDeckMutation.isError && (
          <p className="mt-2 text-sm text-red-400">
            {cheapestPrintingForDeckMutation.error instanceof ApiError
              ? cheapestPrintingForDeckMutation.error.message
              : "Failed to update printings"}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900/50 px-4 py-3">
          <div>
            <p className="text-2xl font-bold text-neutral-100">
              {checkedTotal}
              <span className="text-neutral-500">/{quantityTotal}</span>
            </p>
            <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${quantityTotal > 0 ? (checkedTotal / quantityTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-400">${totalCost.toFixed(2)}</p>
            <p className="text-xs text-neutral-400">${remainingCost.toFixed(2)} remaining</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-neutral-400">{data.cards.length} cards</p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400">Sort by</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {sortedRows.length === 0 && <p className="text-neutral-400">No cards in this deck yet.</p>}
          {sortedRows.map((row) => (
            <DeckCardRow
              key={row.id}
              deckId={deckId}
              row={row}
              onUpdate={(patch) => updateCardMutation.mutate({ cardRowId: row.id, patch })}
              onRemove={() => removeCardMutation.mutate(row.id)}
              onUseCheapestPrinting={() => cheapestPrintingMutation.mutate(row.id)}
              onSetPrinting={(scryfallId) => setPrintingMutation.mutate({ cardRowId: row.id, scryfallId })}
              isFindingCheapest={cheapestPrintingMutation.isPending && cheapestPrintingMutation.variables === row.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
