import { useState } from "react";

export default function HelpBadge() {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brass font-fell text-sm text-ink shadow-[1px_2px_4px_rgba(0,0,0,0.3)] transition-transform hover:scale-110"
        aria-label="Keyboard shortcuts"
        onClick={() => setShowTooltip((s) => !s)}
      >
        ?
      </button>

      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 w-44 rounded border border-parchment-dark bg-parchment p-3 shadow-[2px_3px_8px_rgba(0,0,0,0.25)]">
          <p className="mb-2 font-fell text-xs tracking-wide text-ink">Shortcuts</p>
          <div className="space-y-1 font-cormorant text-xs text-ink-faded">
            <div className="flex justify-between">
              <span>Next question</span>
              <kbd className="rounded border border-parchment-dark bg-parchment-dark/30 px-1 font-courier text-[10px]">Enter</kbd>
            </div>
            <div className="flex justify-between">
              <span>Reveal clue</span>
              <kbd className="rounded border border-parchment-dark bg-parchment-dark/30 px-1 font-courier text-[10px]">H</kbd>
            </div>
            <div className="flex justify-between">
              <span>Reset map</span>
              <kbd className="rounded border border-parchment-dark bg-parchment-dark/30 px-1 font-courier text-[10px]">R</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
