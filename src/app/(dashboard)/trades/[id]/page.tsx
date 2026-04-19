// SLICE 4: Trade detail — show all TradePosition legs (TP1 / TP2 / RUNNER), fees, net P&L.
export default function TradeDetailPage({ params }: { params: { id: string } }) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-md rounded-md border border-bd-subtle bg-bg-surface p-8 text-center shadow-panel">
        <p className="font-mono text-xs uppercase tracking-widest text-text-muted">Slice 4</p>
        <h1 className="mt-3 font-display text-2xl text-text-primary">Trade Detail</h1>
        <p className="mt-2 text-sm text-text-secondary">Coming soon</p>
        <p className="mt-3 font-mono text-xs text-text-muted">id: {params.id}</p>
      </div>
    </section>
  );
}
