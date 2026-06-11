'use client';

import type { ExecutionSummary, FailureCategory } from '@/lib/api/tradeExecutions';

export const CATEGORY_LABEL: Record<FailureCategory, string> = {
  MIN_NOTIONAL: 'Min-notional',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  QUANTITY_PRECISION: 'Quantity/precision',
  NO_FILL_TIMEOUT: 'No-fill / timeout',
  EXCHANGE_API_ERROR: 'Exchange/API',
  OTHER: 'Other',
};

const CATEGORY_COLOR: Record<FailureCategory, string> = {
  MIN_NOTIONAL: '#ef4444',
  INSUFFICIENT_BALANCE: '#f59e0b',
  NO_FILL_TIMEOUT: '#eab308',
  QUANTITY_PRECISION: '#84cc16',
  EXCHANGE_API_ERROR: '#22c55e',
  OTHER: '#6b7280',
};

interface Props {
  summary: ExecutionSummary | undefined;
  isLoading: boolean;
  activeCategory: FailureCategory | null;
  onSelectCategory: (c: FailureCategory | null) => void;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="mm-card" style={{ flex: 1, padding: '9px 12px' }}>
      <div className="mm-kicker" style={{ fontSize: 10 }}>{label}</div>
      <div className="font-num" style={{ fontSize: 18, color: tone ?? 'var(--mm-ink-1)' }}>{value}</div>
    </div>
  );
}

export function FailureBreakdownPanel({ summary, isLoading, activeCategory, onSelectCategory }: Props) {
  if (isLoading && !summary) {
    return <div className="mm-card" style={{ padding: 16, color: 'var(--mm-ink-3)' }}>Loading breakdown…</div>;
  }
  if (!summary) return null;
  const maxCount = summary.byCategory.reduce((m, c) => Math.max(m, c.count), 0) || 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Stat label="Executions" value={String(summary.totalExecutions)} />
        <Stat label="Failed" value={String(summary.failedCount)} tone="var(--mm-dn)" />
        <Stat label="Success rate" value={`${Math.round(summary.successRatePct)}%`} tone="var(--mm-up)" />
        <Stat label="Top cause" value={summary.topCategory ?? '—'} />
      </div>

      <div className="mm-card" style={{ padding: 12 }}>
        <div className="mm-kicker" style={{ marginBottom: 9 }}>Why trades failed · click to filter</div>
        {summary.byCategory.length === 0 ? (
          <div style={{ color: 'var(--mm-ink-3)', fontSize: 13 }}>No failures in this range 🎉</div>
        ) : (
          <div className="flex flex-col gap-2">
            {summary.byCategory.map((c) => {
              const active = activeCategory === c.category;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => onSelectCategory(active ? null : c.category)}
                  aria-pressed={active}
                  className="flex items-center gap-2 text-left"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <span style={{ width: 132, color: 'var(--mm-ink-1)', fontSize: 12 }}>
                    {CATEGORY_LABEL[c.category]}
                  </span>
                  <span style={{ flex: 1, height: 13, background: 'var(--mm-hair)', borderRadius: 3, position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${(c.count / maxCount) * 100}%`,
                      background: CATEGORY_COLOR[c.category], borderRadius: 3,
                      outline: active ? '1.5px solid var(--mm-ink-2)' : 'none', outlineOffset: 1,
                    }} />
                  </span>
                  <span className="font-num" style={{ width: 70, textAlign: 'right', color: 'var(--mm-ink-2)', fontSize: 12 }}>
                    {c.count} · {Math.round(c.pct)}%
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
