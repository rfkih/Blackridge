'use client';

import { useMemo, useState } from 'react';
import { useCarryPairs } from '@/hooks/useCarryPairs';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import type { CarryPair } from '@/types/trading';
import { CarryBookTable } from './CarryBookTable';

const LIVE_STATES = new Set(['PENDING', 'OPENING', 'OPEN', 'REBALANCING', 'CLOSING', 'UNKNOWN']);
const isLive = (p: CarryPair) => LIVE_STATES.has(p.status);

type Tone = 'profit' | 'loss' | 'warning' | 'neutral';
interface Kpi {
  label: string;
  value: string;
  tone: Tone;
  hero?: boolean;
  hint?: string;
}

/** Live = real pairs (default — the book shows real positions); Paper = simulated; All = both. */
type CarryMode = 'LIVE' | 'PAPER' | 'ALL';
const MODES: { key: CarryMode; label: string }[] = [
  { key: 'LIVE', label: 'Live' },
  { key: 'PAPER', label: 'Paper' },
  { key: 'ALL', label: 'All' },
];

/**
 * The Carry Book. A book-summary KPI strip (funding is the hero — that's the edge)
 * over the per-pair table. Funding vs basis are deliberately split so the operator
 * reads "earning funding, basis ≈ 0" at a glance — the whole point of delta-neutral
 * carry, which a directional trades table can't express.
 */
export function CarryBookTab() {
  const { data, isLoading, isError, refetch } = useCarryPairs();
  const rows = useMemo(() => data ?? [], [data]);
  const formatCurrency = useCurrencyFormatter();
  const [mode, setMode] = useState<CarryMode>('LIVE');

  // Default to LIVE so the book shows only real positions; paper (simulated) pairs are one click away.
  const filtered = useMemo(
    () =>
      mode === 'ALL' ? rows : rows.filter((p) => (mode === 'LIVE' ? !p.simulated : p.simulated)),
    [rows, mode],
  );
  const paperCount = useMemo(() => rows.filter((p) => p.simulated).length, [rows]);

  const kpis = useMemo<Kpi[]>(() => {
    const open = filtered.filter(isLive);
    const funding = filtered.reduce((s, p) => s + (p.fundingPnl ?? 0), 0);
    const total = filtered.reduce((s, p) => s + (p.totalPnl ?? p.fundingPnl ?? 0), 0);
    const notional = open.reduce(
      (s, p) => s + Math.abs(p.perpQty) * (p.markPrice ?? p.perpEntryPrice ?? 0),
      0,
    );
    const netDeltaUsd = open.reduce(
      (s, p) =>
        s + (p.netDeltaBase ?? p.spotQty - p.perpQty) * (p.markPrice ?? p.perpEntryPrice ?? 0),
      0,
    );
    const liveCount = open.filter((p) => !p.simulated).length;
    const driftTone: Tone =
      notional > 0 && Math.abs(netDeltaUsd) > notional * 0.02 ? 'warning' : 'neutral';
    return [
      {
        label: 'Funding Earned',
        value: formatCurrency(funding),
        tone: toneOf(funding),
        hero: true,
        hint: 'the carry edge',
      },
      {
        label: 'Net P&L',
        value: formatCurrency(total),
        tone: toneOf(total),
        hint: 'funding + basis',
      },
      {
        label: 'Notional Deployed',
        value: formatCurrency(notional),
        tone: 'neutral',
        hint: `${open.length} open`,
      },
      {
        label: 'Net Delta',
        value: formatCurrency(netDeltaUsd),
        tone: driftTone,
        hint: 'hedge residual',
      },
      {
        label: 'Live / Paper',
        value: `${liveCount} / ${open.length - liveCount}`,
        tone: 'neutral',
        hint: 'open pairs',
      },
    ];
  }, [filtered, formatCurrency]);

  return (
    <div className="flex flex-col gap-4">
      <ModeFilter mode={mode} onChange={setMode} paperCount={paperCount} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>
      <CarryBookTable rows={filtered} isLoading={isLoading} isError={isError} onRetry={refetch} />
    </div>
  );
}

function ModeFilter({
  mode,
  onChange,
  paperCount,
}: {
  mode: CarryMode;
  onChange: (m: CarryMode) => void;
  paperCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {MODES.map((m) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className="rounded-sm px-2.5 py-1 text-[13px] transition-colors"
            style={{
              background: active ? 'var(--bg-hover)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: active ? 'var(--border-default)' : 'transparent',
            }}
            aria-pressed={active}
          >
            {m.label}
            {m.key === 'PAPER' && paperCount > 0 ? ` (${paperCount})` : ''}
          </button>
        );
      })}
      {mode === 'LIVE' && paperCount > 0 && (
        <span className="ml-1 text-[12px] text-text-muted">{paperCount} paper hidden</span>
      )}
    </div>
  );
}

function KpiCard({ label, value, tone, hero, hint }: Kpi) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : tone === 'warning'
          ? 'var(--color-warning)'
          : undefined;
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-bd-subtle bg-bg-surface p-3',
        hero && 'shadow-sm',
      )}
      style={hero ? { borderColor: 'var(--color-profit)' } : undefined}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span
        className="font-mono text-[18px] font-semibold tabular-nums text-text-primary"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      {hint ? <span className="text-[10px] text-text-muted">{hint}</span> : null}
    </div>
  );
}

function toneOf(v: number): Tone {
  if (v > 0) return 'profit';
  if (v < 0) return 'loss';
  return 'neutral';
}
