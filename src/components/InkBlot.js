export default function InkBlot({ x, y }) {
  if (x == null || y == null) return null;

  return (
    <div
      className="pointer-events-none absolute z-[500] h-14 w-14 animate-ink-splat"
      style={{
        left: x - 28,
        top: y - 28,
        background: [
          "radial-gradient(circle 12px at 40% 35%, var(--wax-red) 0%, transparent 100%)",
          "radial-gradient(circle 8px at 65% 60%, var(--wax-red) 0%, transparent 100%)",
          "radial-gradient(circle 15px at 50% 50%, var(--wax-red) 0%, transparent 100%)",
          "radial-gradient(circle 6px at 30% 70%, var(--wax-red) 0%, transparent 100%)",
        ].join(", "),
      }}
    />
  );
}
