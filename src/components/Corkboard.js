import CluePhoto from "./CluePhoto";

export default function Corkboard({
  clueImages,
  totalClues,
  cluesShown,
  canRevealMore,
  onReveal,
  onNext,
  selected,
  isCorrect,
  correctCountry,
  isCompactLayout,
}) {
  const showLabels = Boolean(selected);

  return (
    <div className="animate-cork-slide flex flex-col">
      <div className="cork-texture rounded border-[3px] border-desk shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between px-3 pt-3">
          <h2 className="font-fell text-sm tracking-wide text-parchment-dark">Evidence Board</h2>
          <span className="font-courier text-xs text-parchment-dark">
            {totalClues > 0 ? `${cluesShown}/${totalClues}` : "\u2014"}
          </span>
        </div>

        <div className={`gap-3 p-3 ${isCompactLayout ? "grid grid-cols-3" : "flex flex-col"}`}>
          {clueImages.map((img, idx) => (
            <CluePhoto
              key={`${img.url}-${idx}`}
              image={img}
              index={idx}
              showLabel={showLabels}
            />
          ))}
        </div>

        {canRevealMore && (
          <div className="px-3 pb-3">
            <button
              onClick={onReveal}
              className="w-full rounded border border-dashed border-brass/50 bg-parchment/10 px-3 py-2 font-cormorant text-sm italic text-parchment transition-colors hover:bg-parchment/20"
            >
              Reveal another clue
            </button>
          </div>
        )}
      </div>

      {selected && (
        <p className={`mt-2 text-center font-cormorant text-sm italic ${isCorrect ? "text-green-300" : "text-red-300"}`}>
          {isCorrect ? "Well navigated!" : <>The correct port was <strong>{correctCountry}</strong></>}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onNext}
          className="flex-1 rounded border-2 border-brass bg-parchment px-4 py-2 font-fell text-sm tracking-wide text-ink shadow-[1px_2px_4px_rgba(0,0,0,0.3)] transition-all hover:bg-parchment-dark hover:shadow-[1px_2px_8px_rgba(0,0,0,0.4)]"
        >
          Next Question
        </button>
      </div>
    </div>
  );
}
