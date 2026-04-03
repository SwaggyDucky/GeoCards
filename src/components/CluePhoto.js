import { assetUrl, deriveImageName } from "../utils";

export default function CluePhoto({ image, index, showLabel, featured = false, animate = false }) {
  return (
    <div
      className={`${featured ? "" : "clue-photo"} relative ${animate ? "animate-photo-pin" : ""}`}
      style={animate ? { animationDelay: `${550 + index * 100}ms` } : undefined}
    >
      {featured && (
        <div
          className="pushpin absolute left-1/2 top-0 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[inset_0_-2px_3px_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.4)]"
        />
      )}
      <div className="overflow-hidden border-4 border-white bg-white shadow-[2px_3px_8px_rgba(0,0,0,0.35)]">
        <div className={featured ? "aspect-[4/3] overflow-hidden" : "aspect-square overflow-hidden"}>
          <img
            src={assetUrl(image.url)}
            alt={`Clue ${index + 1} — ${image.type}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
      {showLabel && featured && (
        <p className="mt-1 text-center font-cormorant text-xs italic text-parchment-dark">
          {deriveImageName(image.url) || image.type}
        </p>
      )}
    </div>
  );
}
