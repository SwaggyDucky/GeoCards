import L from "leaflet";
import { Marker } from "react-leaflet";

const sealIcon = L.divIcon({
  className: "",
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  html: `<div class="wax-seal-marker animate-seal-stamp">
    <div style="
      width: 48px; height: 48px; border-radius: 50%;
      background: radial-gradient(circle, var(--wax-green) 60%, #1E4030 100%);
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        width: 20px; height: 12px;
        border-bottom: 2.5px solid #6FCF97;
        border-left: 2.5px solid #6FCF97;
        transform: rotate(-45deg) translateY(-1px);
      "></div>
    </div>
  </div>`,
});

export default function WaxSeal({ latLng }) {
  if (!latLng) return null;

  return (
    <Marker position={latLng} icon={sealIcon} interactive={false} />
  );
}
