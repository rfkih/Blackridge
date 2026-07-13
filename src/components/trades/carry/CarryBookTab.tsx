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
import { useActiveAccount } from '@/hooks/useAccounts';
import { useCarryBalance, useCarryPairs, useCloseCarryPair } from '@/hooks/useCarryPairs';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { summarizeCarryBook } from '@/lib/carry/summary';
import { cn } from '@/lib/utils';
import type { CarryPair, CarryStatus } from '@/types/trading';
import { CarryActivateDialog } from './CarryActivateDialog';
import { CarryBestDialog } from './CarryBestDialog';
import { CarryBookTable } from './CarryBookTable';
import { CarryCapitalCard } from './CarryCapitalCard';
import { CarryOpenDialog } from './CarryOpenDialog';

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
 * Display order: open/active pairs float to the top, terminal (closed/failed) sink.
 * The operator watches live positions first; closed/failed history is reference below.
 */
const STATUS_PRIORITY: Record<CarryStatus, number> = {
  OPEN: 0,
  REBALANCING: 1,
  OPENING: 2,
  PENDING: 3,
  CLOSING: 4,
  UNKNOWN: 5,
  CLOSED: 6,
  FAILED: 7,
};

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

  // Consolidated balance is per-account: prefer the active account, else the account
  // that actually holds carry pairs (so the card works even on the "All accounts" view).
  const { scopedAccountId } = useActiveAccount();
  const balanceAccountId = scopedAccountId ?? rows.find((r) => r.accountId)?.accountId;
  const { data: balance, isLoading: balanceLoading } = useCarryBalance(balanceAccountId);
  const [mode, setMode] = useState<CarryMode>('LIVE');
  const [openDialog, setOpenDialog] = useState(false);
  const [activateDialog, setActivateDialog] = useState(false);
  const [bestDialog, setBestDialog] = useState(false);
  const [closing, setClosing] = useState<CarryPair | null>(null);
  const closeMutation = useCloseCarryPair();

  // Default to LIVE so the book shows only real positions; paper (simulated) pairs are one click away.
  const filtered = useMemo(
    () =>
      mode === 'ALL' ? rows : rows.filter((p) => (mode === 'LIVE' ? !p.simulated : p.simulated)),
    [rows, mode],
  );
  const paperCount = useMemo(() => rows.filter((p) => p.simulated).length, [rows]);

  // Open/active pairs first, terminal (closed/failed) last. Array.sort is stable, so
  // the backend's within-status order (newest-opened first) is preserved inside each tier.
  const ordered = useMemo(
    () => [...filtered].sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]),
    [filtered],
  );

  const kpis = useMemo<Kpi[]>(() => {
    const s = summarizeCarryBook(filtered);
    const driftTone: Tone =
      s.notional > 0 && Math.abs(s.netDeltaUsd) > s.notional * 0.02 ? 'warning' : 'neutral';
    return [
      {
        label: 'Funding Earned',
        value: formatCurrency(s.funding),
        tone: toneOf(s.funding),
        hero: true,
        hint: 'the carry edge',
      },
      {
        label: 'Net P&L',
        value: formatCurrency(s.total),
        tone: toneOf(s.total),
        hint: 'funding + basis',
      },
      {
        label: 'Notional Deployed',
        value: formatCurrency(s.notional),
        tone: 'neutral',
        hint: `${s.openCount} open`,
      },
      {
        label: 'Net Delta',
        value: formatCurrency(s.netDeltaUsd),
        tone: driftTone,
        hint: 'hedge residual',
      },
      {
        label: 'Live / Paper',
        value: `${s.liveCount} / ${s.paperCount}`,
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
            style={{ borderColor: 'var(--border-default)', color: 'var(--mm-ink-1)' }}
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => setOpenDialog(true)}
            className="h-8 rounded-md border px-3 text-[13px] font-semibold"
            style={{ borderColor: 'var(--border-default)', color: 'var(--mm-ink-1)' }}
          >
            + Open pair
          </button>
          <button
            type="button"
            onClick={() => setBestDialog(true)}
            title="Open the single highest-funding carry pair, sized to your free USDT"
            className="h-8 rounded-md px-3 text-[13px] font-semibold text-white"
            style={{ background: 'var(--accent-primary)' }}
          >
            ⚡ Best carry
          </button>
        </div>
      </div>
      <CarryCapitalCard balance={balance} isLoading={balanceLoading} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>
      <CarryBookTable
        rows={ordered}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        onClose={setClosing}
      />
      <CarryOpenDialog open={openDialog} onOpenChange={setOpenDialog} />
      <CarryActivateDialog open={activateDialog} onOpenChange={setActivateDialog} />
      <CarryBestDialog
        accountId={balanceAccountId}
        open={bestDialog}
        onOpenChange={setBestDialog}
      />
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
