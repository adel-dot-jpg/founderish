// The facts a draft relies on, as hoverable chips. Shared by approvals and posts.
export function ReceiptChips({ facts }: { facts: string[] }) {
  if (!facts.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-zinc-500">Receipts:</span>
      {facts.map((f, i) => (
        <span key={i} title={f} className="cursor-help rounded border border-emerald-800 bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-200">
          ✓ {f.length > 48 ? `${f.slice(0, 48)}…` : f}
        </span>
      ))}
    </div>
  );
}
