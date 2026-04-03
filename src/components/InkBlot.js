import L from "leaflet";
import { Marker } from "react-leaflet";

const blotIcon = L.divIcon({
  className: "",
  iconSize: [56, 56],
  iconAnchor: [28, 28],
  html: `<div class="animate-ink-splat" style="
    width: 56px; height: 56px;
    background:
      radial-gradient(circle 12px at 40% 35%, var(--wax-red) 0%, transparent 100%),
      radial-gradient(circle 8px at 65% 60%, var(--wax-red) 0%, transparent 100%),
      radial-gradient(circle 15px at 50% 50%, var(--wax-red) 0%, transparent 100%),
      radial-gradient(circle 6px at 30% 70%, var(--wax-red) 0%, transparent 100%);
  "></div>`,
});

export default function InkBlot({ latLng }) {
  if (!latLng) return null;

  return (
    <Marker position={latLng} icon={blotIcon} interactive={false} />
  );
}
