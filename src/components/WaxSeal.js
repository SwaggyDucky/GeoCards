export default function WaxSeal({ x, y }) {
  if (x == null || y == null) return null;

  return (
    <div
      className="pointer-events-none absolute z-[500] animate-seal-stamp"
      style={{ left: x - 24, top: y - 24 }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[radial-gradient(circle,var(--wax-green)_60%,#1E4030_100%)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.4)]">
        <div className="h-3 w-5 -translate-y-px rotate-[-45deg] border-b-[2.5px] border-l-[2.5px] border-[#6FCF97]" />
      </div>
    </div>
  );
}
