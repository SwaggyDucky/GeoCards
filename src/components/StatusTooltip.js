export default function StatusTooltip({ message }) {
  return (
    <div className="absolute left-4 right-4 top-4 z-[400]">
      <div className="rounded border border-parchment-dark bg-parchment/90 px-4 py-2.5 font-cormorant text-sm italic text-ink shadow-[1px_2px_6px_rgba(0,0,0,0.2)] backdrop-blur-sm">
        {message}
      </div>
    </div>
  );
}
