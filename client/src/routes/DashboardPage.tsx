// Home screen: every deck the user owns, with collection progress, and entry points to
// import a new deck or delete an existing one. No manual "create empty deck" flow anymore —
// decks are always created by importing a decklist (see ImportPage.tsx).
import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../state/AuthContext";
import * as decksApi from "../api/decksApi";
import { PriceTotalBadge } from "../components/PriceTotalBadge";

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-amber-900/40 text-amber-300",
  complete: "bg-emerald-900/40 text-emerald-300",
  archived: "bg-neutral-800 text-neutral-400",
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["decks"],
    queryFn: decksApi.listDecks,
  });

  const deleteMutation = useMutation({
    mutationFn: (deckId: string) => decksApi.deleteDeck(deckId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["decks"] }),
  });

  // Deck cards are wrapped in a <Link>, so the delete button has to stop the click from
  // bubbling into a navigation before confirming.
  function handleDelete(e: MouseEvent, deckId: string, deckName: string) {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Delete "${deckName}"? This can't be undone.`)) {
      deleteMutation.mutate(deckId);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-8 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Welcome, {user?.displayName}</h1>
          <div className="flex items-center gap-2">
            <Link
              to="/import"
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-900"
            >
              Import deck
            </Link>
            <button
              onClick={() => logout()}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-900"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isLoading && <p className="text-neutral-400">Loading decks...</p>}
          {data?.decks.length === 0 && (
            <p className="text-neutral-400">No decks yet. Import one to get started.</p>
          )}
          {data?.decks.map((deck) => {
            // "Complete" is computed live from checked-vs-total quantity rather than trusted
            // from the stored `status` column, so it automatically flips back to "in progress"
            // the moment a card gets unchecked — see server decksController.ts listDecks.
            const isComplete = deck.quantityTotal > 0 && deck.checkedTotal >= deck.quantityTotal;
            const displayStatus = isComplete ? "complete" : deck.status;
            return (
            <Link
              key={deck.id}
              to={`/decks/${deck.id}`}
              className="relative block rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:border-neutral-600"
            >
              <div className="flex items-center justify-between gap-2 pr-8">
                <h2 className="truncate font-medium text-neutral-100">{deck.name}</h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[displayStatus]}`}
                >
                  {displayStatus.replace("_", " ")}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-neutral-400">{deck.format ?? "No format"}</p>
                <PriceTotalBadge total={deck.priceTotal} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <p className="shrink-0 text-xs text-neutral-400">
                  {deck.checkedTotal}/{deck.quantityTotal}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${deck.quantityTotal > 0 ? (deck.checkedTotal / deck.quantityTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => handleDelete(e, deck.id, deck.name)}
                aria-label={`Delete ${deck.name}`}
                className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center text-xl leading-none text-red-500 hover:text-red-400"
              >
                ×
              </button>
            </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
