import { useState } from "react";

export default function StatsEnvelope({ score, answered, streak, regionLabel, itemTypeLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const accuracy = answered ? Math.round((score / answered) * 100) : 0;

  return (
    <div className="animate-envelope-drop relative w-44 select-none">
      {/* Stats card — slides up from behind envelope */}
      <div
        className={`absolute bottom-full left-0 w-full rounded-t border border-b-0 border-parchment-dark bg-parchment shadow-[0_-2px_8px_rgba(0,0,0,0.15)] transition-all duration-300 ${
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        }`}
      >
        <div className="ruled-lines px-3 py-2">
          <div className="space-y-1 font-courier text-xs text-ink">
            <div className="flex justify-between"><span>Score</span><span className="font-bold">{score}</span></div>
            <div className="flex justify-between"><span>Answered</span><span className="font-bold">{answered}</span></div>
            <div className="flex justify-between"><span>Streak</span><span className="font-bold">{streak}</span></div>
            <div className="flex justify-between"><span>Accuracy</span><span className="font-bold">{accuracy}%</span></div>
          </div>
          <div className="my-1.5 border-t border-ink-faded/30" />
          <div className="space-y-0.5 font-cormorant text-[11px] italic text-ink-faded">
            <div>Region: {regionLabel}</div>
            <div>Filter: {itemTypeLabel}</div>
          </div>
        </div>
      </div>

      {/* Envelope body */}
      <div
        className="relative cursor-pointer rounded-b rounded-t-sm border border-parchment-dark bg-parchment shadow-[2px_3px_8px_rgba(0,0,0,0.3)]"
        onClick={() => setIsOpen((o) => !o)}
      >
        {/* Flap */}
        <div
          className="absolute inset-x-0 top-0 -translate-y-full"
          style={{ perspective: "200px" }}
        >
          <div
            className={`h-6 origin-bottom transition-transform duration-300 ${isOpen ? "[transform:rotateX(180deg)]" : ""}`}
            style={{
              background: "var(--parchment-dark)",
              clipPath: "polygon(0% 100%, 50% 0%, 100% 100%)",
            }}
          />
        </div>

        {/* Wax seal on flap */}
        <div className="absolute left-1/2 top-0 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-wax-red shadow-[inset_0_-1px_2px_rgba(0,0,0,0.3)]">
          <span className="font-fell text-[8px] text-parchment">S</span>
        </div>

        {/* Envelope surface */}
        <div className="flex h-10 items-center justify-center">
          <span className="font-cormorant text-xs italic text-ink-faded">
            {isOpen ? "Close" : "Expedition Log"}
          </span>
        </div>
      </div>
    </div>
  );
}
