// SLICE 6: Strategy detail — show config + summary metrics; link to /params for editing.
export default function StrategyDetailPage({ params }: { params: { accountStrategyId: string } }) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-md rounded-md border border-bd-subtle bg-bg-surface p-8 text-center shadow-panel">
        <p className="font-mono text-xs uppercase tracking-widest text-text-muted">Slice 6</p>
        <h1 className="mt-3 font-display text-2xl text-text-primary">Strategy</h1>
        <p className="mt-2 text-sm text-text-secondary">Coming soon</p>
        <p className="mt-3 font-mono text-xs text-text-muted">id: {params.accountStrategyId}</p>
      </div>
    </section>
  );
}
