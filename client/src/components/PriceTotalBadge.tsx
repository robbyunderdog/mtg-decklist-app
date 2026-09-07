export function PriceTotalBadge({ total }: { total: number | string }) {
  const value = typeof total === "string" ? Number(total) : total;
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-medium text-emerald-300">
      ${value.toFixed(2)}
    </span>
  );
}
