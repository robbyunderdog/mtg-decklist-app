// Small pill showing a dollar total. Accepts a string because the API sends SQL SUM() results
// as strings (see server deckPricing.ts) — this is the one place that converts it for display.
export function PriceTotalBadge({ total }: { total: number | string }) {
  const value = typeof total === "string" ? Number(total) : total;
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-medium text-emerald-300">
      ${value.toFixed(2)}
    </span>
  );
}
