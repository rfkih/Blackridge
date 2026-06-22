'use client';

import { useMemo } from 'react';
import { useCarryPairs } from '@/hooks/useCarryPairs';
import { cn } from '@/lib/utils';
import type { CarryPair } from '@/types/trading';
import { CarryBookTable } from './CarryBookTable';

const LIVE_STATES = new Set(['PENDING', 'OPENING', 'OPEN', 'REBALANCING', 'CLOSING']);
const isLive = (p: CarryPair) => LIVE_STATES.has(p.status);

type Tone = 'profit' | 'loss' | 'warning' | 'neutral';
interface Kpi {
  label: string;
  value: string;
  tone: Tone;
  hero?: boolean;
  hint?: string;
}

/**
 * The Carry Book. A book-summary KPI strip (funding is the hero — that's the edge)
 * over the per-pair table. Funding vs basis are deliberately split so the operator
 * reads "earning funding, basis ≈ 0" at a glance — the whole point of delta-neutral
 * carry, which a directional trades table can't express.
 */
export function CarryBookTab() {
  const { data, isLoading, isError, refetch } = useCarryPairs();
  const rows = useMemo(() => data ?? [], [data]);

  const kpis = useMemo<Kpi[]>(() => {
    const open = rows.filter(isLive);
    const funding = rows.reduce((s, p) => s + (p.fundingPnl ?? 0), 0);
    const total = rows.reduce((s, p) => s + (p.totalPnl ?? p.fundingPnl ?? 0), 0);
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
        value: usd(funding),
        tone: toneOf(funding),
        hero: true,
        hint: 'the carry edge',
      },
      { label: 'Net P&L', value: usd(total), tone: toneOf(total), hint: 'funding + basis' },
      {
        label: 'Notional Deployed',
        value: usd(notional, 0),
        tone: 'neutral',
        hint: `${open.length} open`,
      },
      { label: 'Net Delta', value: usd(netDeltaUsd), tone: driftTone, hint: 'hedge residual' },
      {
        label: 'Live / Paper',
        value: `${liveCount} / ${open.length - liveCount}`,
        tone: 'neutral',
        hint: 'open pairs',
      },
    ];
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>
      <CarryBookTable rows={rows} isLoading={isLoading} isError={isError} onRetry={refetch} />
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

function usd(v: number, decimals = 2): string {
  const sign = v < 0 ? '−' : '';
  return `${sign}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function toneOf(v: number): Tone {
  if (v > 0) return 'profit';
  if (v < 0) return 'loss';
  return 'neutral';
}
