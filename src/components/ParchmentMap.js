import { MapContainer, GeoJSON } from "react-leaflet";
import StatusTooltip from "./StatusTooltip";
import WaxSeal from "./WaxSeal";
import InkBlot from "./InkBlot";

const TORN_EDGES = `polygon(
  0.3% 0.8%, 4% 0.2%, 8% 1.1%, 12% 0.4%, 18% 0.9%, 24% 0.1%, 30% 0.7%,
  36% 0.3%, 42% 1%, 48% 0.2%, 54% 0.8%, 60% 0.1%, 66% 0.6%, 72% 0.3%,
  78% 0.9%, 84% 0.2%, 90% 0.7%, 96% 0.4%, 99.7% 0.6%,
  99.5% 6%, 100% 12%, 99.3% 18%, 99.8% 24%, 99.4% 32%, 100% 40%,
  99.6% 48%, 99.2% 56%, 99.7% 64%, 99.4% 72%, 100% 80%, 99.5% 88%, 99.8% 94%, 99.3% 99.2%,
  96% 99.6%, 90% 99.1%, 84% 99.7%, 78% 99.3%, 72% 99.8%, 66% 99.2%,
  60% 99.6%, 54% 99.1%, 48% 99.5%, 42% 99%, 36% 99.7%, 30% 99.3%,
  24% 99.8%, 18% 99.2%, 12% 99.6%, 6% 99.1%, 0.5% 99.4%,
  0.2% 94%, 0.7% 88%, 0.3% 80%, 0.8% 72%, 0.1% 64%, 0.6% 56%,
  0.2% 48%, 0.9% 40%, 0.4% 32%, 0.7% 24%, 0.1% 18%, 0.5% 12%, 0.3% 6%
)`;

export default function ParchmentMap({
  mapRef,
  worldGeo,
  question,
  getFeatureStyle,
  onEachCountry,
  statusMessage,
  mapWrapperRef,
  isCompactLayout,
  isMapOpen,
  sealLatLng,
  blotLatLng,
  selected,
  isCorrect,
}) {
  const wrapperClasses = [
    "relative min-w-0 overflow-hidden shadow-[4px_6px_20px_rgba(0,0,0,0.5)] transition-[max-height,height,opacity,transform] duration-300 ease-out",
    isCompactLayout
      ? isMapOpen
        ? "h-[60vh] max-h-[75vh] min-h-[360px] opacity-100 pointer-events-auto translate-y-0"
        : "max-h-0 h-0 opacity-0 pointer-events-none -translate-y-2"
      : "h-full min-h-[360px] opacity-100 pointer-events-auto animate-map-unroll",
  ].join(" ");

  return (
    <div
      ref={mapWrapperRef}
      className={wrapperClasses}
      style={{ clipPath: TORN_EDGES, transform: isCompactLayout ? undefined : "rotate(0.5deg)" }}
      aria-hidden={isCompactLayout && !isMapOpen}
    >
      {(!isCompactLayout || isMapOpen) && (
        <>
          <StatusTooltip message={statusMessage} />

          <MapContainer
            ref={mapRef}
            center={[20, 0]}
            zoom={2}
            minZoom={1}
            zoomControl={false}
            attributionControl={false}
            className="h-full w-full"
            scrollWheelZoom={true}
            style={{ background: "var(--ocean)" }}
          >
            <GeoJSON
              key={question?.correctCountry || "init"}
              data={worldGeo}
              style={getFeatureStyle}
              onEachFeature={onEachCountry}
            />
            {selected && isCorrect && <WaxSeal latLng={sealLatLng} />}
            {selected && !isCorrect && (
              <>
                <InkBlot latLng={blotLatLng} />
                <WaxSeal latLng={sealLatLng} />
              </>
            )}
          </MapContainer>
        </>
      )}
    </div>
  );
}
