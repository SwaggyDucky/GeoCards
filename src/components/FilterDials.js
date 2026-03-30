import { useState } from "react";

export default function FilterDials({
  regionOptions,
  itemTypeOptions,
  regionLabel,
  itemTypeLabel,
  onRegionChange,
  onItemTypeChange,
  isCompactLayout,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectClasses =
    "w-full rounded-lg border-2 border-brass bg-parchment px-3 py-1.5 font-cormorant text-sm text-ink outline-none transition-shadow focus:shadow-[0_0_0_2px_var(--brass)]";

  const selects = (
    <>
      <div className="flex flex-col gap-1">
        <label className="font-fell text-[10px] tracking-widest text-parchment-dark">Region</label>
        <select
          className={selectClasses}
          value={regionLabel}
          onChange={(e) => onRegionChange(e.target.value)}
          disabled={regionOptions.length <= 1}
        >
          {regionOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-fell text-[10px] tracking-widest text-parchment-dark">Clue Type</label>
        <select
          className={selectClasses}
          value={itemTypeLabel}
          onChange={(e) => onItemTypeChange(e.target.value)}
          disabled={itemTypeOptions.length <= 1}
        >
          {itemTypeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
    </>
  );

  if (isCompactLayout) {
    return (
      <div className="relative">
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-brass bg-parchment shadow-[1px_2px_4px_rgba(0,0,0,0.3)] transition-colors hover:bg-parchment-dark"
          aria-label="Filters"
        >
          <svg className="h-4 w-4 text-ink" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>

        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-[600]" onClick={() => setMobileOpen(false)} />
            <div className="absolute right-0 top-full z-[601] mt-2 flex w-56 flex-col gap-3 rounded-lg border border-parchment-dark bg-parchment p-4 shadow-[2px_4px_12px_rgba(0,0,0,0.3)]">
              {selects}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3">
      {selects}
    </div>
  );
}
