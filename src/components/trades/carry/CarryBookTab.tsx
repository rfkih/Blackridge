'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCarryPairs, useCloseCarryPair } from '@/hooks/useCarryPairs';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import type { CarryPair } from '@/types/trading';
import { CarryActivateDialog } from './CarryActivateDialog';
import { CarryBookTable } from './CarryBookTable';
import { CarryOpenDialog } from './CarryOpenDialog';

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
  const [openDialog, setOpenDialog] = useState(false);
  const [activateDialog, setActivateDialog] = useState(false);
  const [closing, setClosing] = useState<CarryPair | null>(null);
  const closeMutation = useCloseCarryPair();

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ModeFilter mode={mode} onChange={setMode} paperCount={paperCount} />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActivateDialog(true)}
            className="h-8 rounded-md border px-3 text-[13px] font-semibold"
            style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => setOpenDialog(true)}
            className="h-8 rounded-md px-3 text-[13px] font-semibold text-white"
            style={{ background: 'var(--accent-primary)' }}
          >
            + Open pair
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>
      <CarryBookTable
        rows={filtered}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        onClose={setClosing}
      />
      <CarryOpenDialog open={openDialog} onOpenChange={setOpenDialog} />
      <CarryActivateDialog open={activateDialog} onOpenChange={setActivateDialog} />
      <CarryCloseConfirm
        pair={closing}
        isPending={closeMutation.isPending}
        onOpenChange={(o) => {
          if (!o) setClosing(null);
        }}
        onConfirm={() => {
          if (!closing) return;
          closeMutation.mutate(closing.id, { onSuccess: () => setClosing(null) });
        }}
      />
    </div>
  );
}

/** Confirm dialog for the manual close (kill-switch) of a live carry pair. */
function CarryCloseConfirm({
  pair,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  pair: CarryPair | null;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={pair != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Close carry pair?</DialogTitle>
          <DialogDescription>
            {pair
              ? `Unwinds the ${pair.symbol} pair — buys back the perp short and sells the spot long to flat.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md border border-[var(--border-default)] px-4 text-sm text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="h-9 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--color-loss)' }}
          >
            {isPending ? 'Closing…' : 'Close pair'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onChange(m.key)}
          className={cn('mm-pill', mode === m.key && 'mm-pill-active')}
          style={{ padding: '5px 12px', fontSize: 13 }}
          aria-pressed={mode === m.key}
        >
          {m.label}
          {m.key === 'PAPER' && paperCount > 0 ? ` (${paperCount})` : ''}
        </button>
      ))}
      {mode === 'LIVE' && paperCount > 0 && (
        <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--mm-ink-2)' }}>
          {paperCount} paper hidden
        </span>
      )}
    </div>
  );
}

function KpiCard({ label, value, tone, hero, hint }: Kpi) {
  const color =
    tone === 'profit'
      ? 'var(--mm-up)'
      : tone === 'loss'
        ? 'var(--mm-dn)'
        : tone === 'warning'
          ? 'var(--color-warning)'
          : 'var(--mm-ink-0)';
  return (
    <div
      className="mm-card"
      style={{
        padding: '16px 18px',
        ...(hero ? { borderColor: 'color-mix(in oklab, var(--mm-up) 32%, var(--mm-hair))' } : {}),
      }}
    >
      <div className="mm-kicker">{label}</div>
      <div
        style={{
          fontSize: hero ? 24 : 20,
          marginTop: 8,
          fontFamily: 'var(--font-num)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          color,
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--mm-ink-3)' }}>{hint}</div>
      ) : null}
    </div>
  );
}

function toneOf(v: number): Tone {
  if (v > 0) return 'profit';
  if (v < 0) return 'loss';
  return 'neutral';
}
