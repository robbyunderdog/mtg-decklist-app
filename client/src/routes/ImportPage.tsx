// Two-step decklist import screen: paste a link or decklist text and preview it (nothing
// saved yet), review/edit the resulting card list, then confirm to actually write it into a
// deck. Handles both "import into a new deck" (/import) and "re-import into an existing deck"
// (/decks/:id/import) — see App.tsx — branching on whether `deckId` is present.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as importsApi from "../api/importsApi";
import { ImportPreviewTable, type DraftRow } from "../components/ImportPreviewTable";
import { ApiError } from "../api/client";
import { DECK_FORMATS, DECK_FORMAT_LABELS, type DeckFormat } from "../constants/formats";

// Deck-link import (Moxfield/Archidekt/MTGGoldfish URLs) is hidden for now because Moxfield
// blocks all automated requests. The server-side support (urlImport.ts) is left in place —
// flip this to true to bring the link input back.
const DECK_LINK_IMPORT_ENABLED = false;

function toDraftRows(preview: importsApi.ImportPreview): DraftRow[] {
  // Imports no longer distinguish main/commander vs. side/maybe — everything that survives
  // lands in one list. Sideboard and maybeboard cards (e.g. Moxfield's "Considering" pile)
  // aren't part of the actual deck, so they're dropped here rather than imported alongside it.
  // A card that appeared in what used to be separate sections (e.g. main + commander) would
  // otherwise show up as two rows and collide on insert, so matched cards are merged by id.
  const rows: DraftRow[] = [];
  const rowIndexByCardId = new Map<string, number>();

  preview.lines.forEach((line, i) => {
    if (line.board === "side" || line.board === "maybe") return;

    const cardId = line.matchedCard?.scryfallId;
    if (cardId) {
      const existingIndex = rowIndexByCardId.get(cardId);
      if (existingIndex !== undefined) {
        rows[existingIndex].quantity += line.quantity;
        return;
      }
      rowIndexByCardId.set(cardId, rows.length);
    }

    rows.push({
      key: `${i}-${line.rawLine}`,
      rawLine: line.rawLine,
      parsedName: line.parsedName,
      quantity: line.quantity,
      board: "main",
      foil: false,
      card: line.matchedCard ?? null,
      nameCorrected: line.nameCorrected,
      suggestions: line.suggestions,
      excluded: line.status === "skipped",
    });
  });

  return rows;
}

export function ImportPage() {
  const { id: deckId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [deckLink, setDeckLink] = useState("");
  const [rawText, setRawText] = useState("");
  const [deckName, setDeckName] = useState("");
  const [format, setFormat] = useState<DeckFormat | "">("");
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whichever of the two inputs has content wins — the two fields clear each other on typing
  // (see the textarea/input onChange below), so in practice at most one is ever non-empty.
  async function handlePreview() {
    setError(null);
    setIsPreviewing(true);
    try {
      const preview = await importsApi.previewImport(deckLink.trim() || rawText);
      setDetectedFormat(preview.detectedFormat);
      setRows(toDraftRows(preview));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to parse decklist");
    } finally {
      setIsPreviewing(false);
    }
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  }

  // Writes the reviewed (non-excluded, matched) lines into a deck — either the existing one
  // being re-imported into, or a brand new one created on the spot.
  async function handleConfirm() {
    if (!rows) return;
    setError(null);
    setIsConfirming(true);
    try {
      const lines = rows
        .filter((r) => !r.excluded && r.card)
        .map((r) => ({
          scryfallId: r.card!.scryfallId,
          quantity: r.quantity,
          board: r.board,
          foil: r.foil,
        }));

      if (deckId) {
        await importsApi.confirmImport(deckId, lines);
        navigate(`/decks/${deckId}`);
      } else {
        if (!deckName.trim()) {
          setError("Deck name is required");
          setIsConfirming(false);
          return;
        }
        if (!format) {
          setError("Format is required");
          setIsConfirming(false);
          return;
        }
        const { deck } = await importsApi.importAsNewDeck(deckName.trim(), format, lines);
        navigate(`/decks/${deck.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import decklist");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-8 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <Link to={deckId ? `/decks/${deckId}` : "/"} className="text-sm text-neutral-400 hover:underline">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {deckId ? "Re-import decklist" : "Import decklist"}
        </h1>

        {!rows && (
          <div className="mt-6 space-y-4">
            {!deckId && (
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Deck name"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none focus:border-neutral-500"
                />
                <select
                  required
                  value={format}
                  onChange={(e) => setFormat(e.target.value as DeckFormat)}
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
              </div>
            )}
            {DECK_LINK_IMPORT_ENABLED && (
              <>
                <input
                  type="text"
                  placeholder="Paste a Moxfield, Archidekt, or MTGGoldfish deck link"
                  value={deckLink}
                  onChange={(e) => {
                    setDeckLink(e.target.value);
                    if (e.target.value) setRawText("");
                  }}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                />

                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <div className="h-px flex-1 bg-neutral-800" />
                  or
                  <div className="h-px flex-1 bg-neutral-800" />
                </div>
              </>
            )}

            <textarea
              rows={14}
              placeholder="Paste your decklist here (plain text, Moxfield, Archidekt, or MTG Arena export format)"
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (e.target.value) setDeckLink("");
              }}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-neutral-500"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="button"
              disabled={isPreviewing || (!deckLink.trim() && !rawText.trim()) || (!deckId && !format)}
              onClick={handlePreview}
              className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isPreviewing ? "Parsing..." : "Preview import"}
            </button>
          </div>
        )}

        {rows && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-neutral-400">
              Detected format: <span className="text-neutral-200">{detectedFormat}</span> ·{" "}
              {rows.filter((r) => !r.excluded && r.card).reduce((sum, r) => sum + r.quantity, 0)} of{" "}
              {rows.reduce((sum, r) => sum + r.quantity, 0)} cards will be imported
            </p>
            <ImportPreviewTable rows={rows} onChange={updateRow} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRows(null)}
                className="rounded-md border border-neutral-700 px-4 py-2 text-neutral-300 hover:bg-neutral-900"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleConfirm}
                className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {isConfirming ? "Importing..." : "Confirm import"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
