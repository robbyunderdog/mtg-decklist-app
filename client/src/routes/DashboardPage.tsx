import { useState, type FormEvent, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../state/AuthContext";
import * as decksApi from "../api/decksApi";
import { PriceTotalBadge } from "../components/PriceTotalBadge";
import { DECK_FORMATS, DECK_FORMAT_LABELS, type DeckFormat } from "../constants/formats";

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-amber-900/40 text-amber-300",
  complete: "bg-emerald-900/40 text-emerald-300",
  archived: "bg-neutral-800 text-neutral-400",
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckFormat, setNewDeckFormat] = useState<DeckFormat | "">("");

  const { data, isLoading } = useQuery({
    queryKey: ["decks"],
    queryFn: decksApi.listDecks,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, format }: { name: string; format: DeckFormat }) =>
      decksApi.createDeck(name, format),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decks"] });
      setNewDeckName("");
      setNewDeckFormat("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (deckId: string) => decksApi.deleteDeck(deckId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["decks"] }),
  });

  function handleDelete(e: MouseEvent, deckId: string, deckName: string) {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Delete "${deckName}"? This can't be undone.`)) {
      deleteMutation.mutate(deckId);
    }
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newDeckName.trim() || !newDeckFormat) return;
    createMutation.mutate({ name: newDeckName.trim(), format: newDeckFormat });
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

        <form onSubmit={handleCreate} className="mt-6 flex gap-2">
          <input
            type="text"
            placeholder="New deck name"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none focus:border-neutral-500"
          />
          <select
            required
            value={newDeckFormat}
            onChange={(e) => setNewDeckFormat(e.target.value as DeckFormat)}
            className="w-44 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none focus:border-neutral-500"
          >
            <option value="" disabled>
              Format...
            </option>
            {DECK_FORMATS.map((f) => (
              <option key={f} value={f}>
                {DECK_FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createMutation.isPending || !newDeckFormat}
            className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Create deck
          </button>
        </form>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isLoading && <p className="text-neutral-400">Loading decks...</p>}
          {data?.decks.length === 0 && (
            <p className="text-neutral-400">No decks yet. Create one above.</p>
          )}
          {data?.decks.map((deck) => (
            <Link
              key={deck.id}
              to={`/decks/${deck.id}`}
              className="relative block rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:border-neutral-600"
            >
              <div className="flex items-center justify-between gap-2 pr-8">
                <h2 className="truncate font-medium text-neutral-100">{deck.name}</h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[deck.status]}`}
                >
                  {deck.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-neutral-400">{deck.format ?? "No format"}</p>
                <PriceTotalBadge total={deck.priceTotal} />
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
          ))}
        </div>
      </div>
    </div>
  );
}
