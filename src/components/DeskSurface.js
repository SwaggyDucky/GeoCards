export default function DeskSurface({ children }) {
  return (
    <div className="desk-surface fixed inset-0 h-full w-full overflow-hidden animate-desk-fade lg:overflow-hidden">
      {children}
    </div>
  );
}
