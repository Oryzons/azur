type BarPoint = { label: string; value: number };

export function MiniBarChart({ points, formatValue }: Readonly<{ points: BarPoint[]; formatValue?: (n: number) => string }>) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const fmt = formatValue ?? ((n: number) => String(Math.round(n)));

  if (points.length === 0) {
    return <p className="py-8 text-center text-xs text-zinc-500">Aucune donnée sur la période.</p>;
  }

  return (
    <div className="flex h-40 items-end gap-1 sm:gap-1.5">
      {points.map((p) => {
        const h = Math.max(4, Math.round((p.value / max) * 100));
        return (
          <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[9px] font-semibold tabular-nums text-zinc-500 sm:text-[10px]">
              {p.value > 0 ? fmt(p.value) : ''}
            </span>
            <div
              className="w-full max-w-[2.5rem] rounded-t-md bg-[#416B9F] transition-all"
              style={{ height: `${h}%` }}
              title={`${p.label} : ${fmt(p.value)}`}
            />
            <span className="max-w-full truncate text-[9px] font-medium text-zinc-500">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}
