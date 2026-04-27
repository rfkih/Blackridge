'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, ChevronRight, Hash } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { StrategyStatusBadge } from '@/components/strategy/StrategyStatusBadge';
import { LsrParamsForm } from '@/components/strategy/LsrParamsForm';
import { VcbParamsForm } from '@/components/strategy/VcbParamsForm';
import {
  useAccountStrategy,
  useLsrDefaults,
  useLsrParams,
  useRearmKillSwitch,
  useVcbDefaults,
  useVcbParams,
} from '@/hooks/useStrategies';
import { useTradesList } from '@/hooks/useTrades';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AccountStrategy } from '@/types/strategy';
import type { Trades } from '@/types/trading';

interface PageProps {
  params: { accountStrategyId: string };
}

const VCB_CODES = new Set(['VCB']);

function isVcbStrategy(code: string): boolean {
  return VCB_CODES.has(code);
}

function formatIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso ?? '—';
  return format(new Date(ms), 'yyyy-MM-dd HH:mm:ss');
}

export default function StrategyDetailPage({ params }: PageProps) {
  const { accountStrategyId } = params;
  const { data: strategy, isLoading, isError } = useAccountStrategy(accountStrategyId);
  const { data: accounts = [] } = useAccounts();
  const account = strategy ? accounts.find((a) => a.id === strategy.accountId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link
          href="/strategies"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={12} />
          Strategies
        </Link>
        {strategy && (
          <>
            <ChevronRight size={11} className="opacity-60" />
            <span className="font-mono text-[var(--text-secondary)]">
              {account?.label ?? strategy.accountId.slice(0, 8)}
            </span>
            {account && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                {account.exchange}
              </span>
            )}
            <ChevronRight size={11} className="opacity-60" />
            <span className="text-[var(--text-primary)]">
              {strategy.strategyCode} · {strategy.symbol}
            </span>
          </>
        )}
      </div>

      {isError ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-sm text-[var(--color-loss)]">Could not load strategy.</p>
        </div>
      ) : isLoading || !strategy ? (
        <StrategyDetailSkeleton />
      ) : (
        <StrategyDetail strategy={strategy} />
      )}
    </div>
  );
}

function StrategyDetail({ strategy }: { strategy: AccountStrategy }) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-panel">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <StrategyBadge code={strategy.strategyCode} />
            <StrategyStatusBadge status={strategy.status} size="md" />
          </div>
          <h1 className="font-display text-2xl text-[var(--text-primary)]">
            {strategy.symbol}
            <span className="ml-2 rounded bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-sm font-normal text-[var(--text-muted)]">
              {strategy.interval}
            </span>
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-4 text-right sm:grid-cols-3">
          <MetaStat label="Allocation" value={`${strategy.capitalAllocationPct.toFixed(1)}%`} />
          <MetaStat label="Priority" value={`#${strategy.priorityOrder}`} />
          <MetaStat
            label="Direction"
            value={
              <span className="font-mono text-sm">
                <span
                  className={cn(
                    strategy.allowLong ? 'text-[var(--color-profit)]' : 'text-[var(--text-muted)]',
                  )}
                >
                  L
                </span>
                <span className="mx-0.5 text-[var(--text-muted)]">/</span>
                <span
                  className={cn(
                    strategy.allowShort ? 'text-[var(--color-loss)]' : 'text-[var(--text-muted)]',
                  )}
                >
                  S
                </span>
              </span>
            }
          />
        </div>
      </header>

      <RiskGuardPanel strategy={strategy} />

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList className="bg-[var(--bg-surface)]">
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          <LiveTab strategy={strategy} />
        </TabsContent>

        <TabsContent value="overview">
          <OverviewTab strategy={strategy} />
        </TabsContent>

        <TabsContent value="parameters">
          <ParametersTab strategy={strategy} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Drawdown kill-switch state. Two visual states:
 *  - Tripped: prominent loss-tinted banner with reason + re-arm button.
 *  - Armed: muted strip showing the threshold so the user knows the line.
 *
 * Re-arm is a single click — the trip state itself is the safety; clearing
 * it is a deliberate "I've looked at the reason and accept it" action.
 */
function RiskGuardPanel({ strategy }: { strategy: AccountStrategy }) {
  const rearmMut = useRearmKillSwitch();

  const onRearm = async () => {
    try {
      await rearmMut.mutateAsync(strategy.id);
      toast.success({ title: 'Kill-switch re-armed' });
    } catch (err) {
      toast.error({ title: 'Could not re-arm', description: normalizeError(err) });
    }
  };

  if (strategy.isKillSwitchTripped) {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-lg border border-[var(--color-loss)]/40 bg-[var(--bg-surface)] p-4 shadow-panel">
        <ShieldAlert
          size={18}
          className="mt-0.5 shrink-0 text-[var(--color-loss)]"
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[12px] text-[var(--text-primary)]">
            <span className="font-semibold text-[var(--color-loss)]">
              Kill-switch tripped.
            </span>{' '}
            New entries are blocked for this strategy until re-armed.
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {strategy.killSwitchReason ?? 'Drawdown threshold breached.'}
            {strategy.killSwitchTrippedAt && (
              <>
                {' · tripped '}
                {formatIso(strategy.killSwitchTrippedAt)}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onRearm}
          disabled={rearmMut.isPending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors duration-fast hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck size={11} strokeWidth={1.75} />
          {rearmMut.isPending ? 'Re-arming…' : 'Re-arm kill-switch'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-bd-subtle bg-bg-surface px-4 py-2.5">
      <ShieldCheck
        size={14}
        className="shrink-0 text-[var(--text-muted)]"
        aria-hidden="true"
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        Risk guard armed
      </span>
      <span className="font-mono text-[11px] text-text-secondary">
        DD threshold {strategy.ddKillThresholdPct.toFixed(0)}% · 30d window
      </span>
    </div>
  );
}

function MetaStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <span className="mt-0.5 font-mono text-sm tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

// Backend trade filter doesn't accept `accountStrategyId` yet; we pull
// (accountId, strategyCode, symbol) — the closest filter combo — and
// post-filter for safety under multi-interval-per-symbol. Page size is
// the hard cap until the API supports per-strategy filtering.
const LIVE_TAB_TRADE_WINDOW = 200;

function LiveTab({ strategy }: { strategy: AccountStrategy }) {
  const { data, isLoading, isError } = useTradesList({
    accountId: strategy.accountId,
    strategyCode: strategy.strategyCode,
    symbol: strategy.symbol,
    size: LIVE_TAB_TRADE_WINDOW,
  });

  const trades: Trades[] = (data?.content ?? []).filter(
    (t) => t.accountStrategyId === strategy.id,
  );
  const open = trades.filter((t) => t.status === 'OPEN' || t.status === 'PARTIALLY_CLOSED');
  const closed = trades.filter((t) => t.status === 'CLOSED');
  const realized = closed.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const unrealized = open.reduce((sum, t) => sum + (t.unrealizedPnl ?? 0), 0);
  const winners = closed.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const winRate = closed.length === 0 ? null : winners / closed.length;
  const lastClosed = closed[0];
  // The backend may have more rows than we fetched. Without a per-strategy
  // total, we treat "fetched == window size" as a likely-truncated signal
  // and label the realized stats accordingly so users don't read them as
  // lifetime totals.
  const truncated = (data?.content?.length ?? 0) >= LIVE_TAB_TRADE_WINDOW;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Stat strip */}
      <div className="md:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Open trades"
          value={open.length.toString()}
          tone={open.length > 0 ? 'profit' : 'neutral'}
        />
        <StatCard
          label="Unrealized"
          value={formatPnl(unrealized)}
          tone={unrealized >= 0 ? 'profit' : 'loss'}
        />
        <StatCard
          label={truncated ? `Realized · last ${LIVE_TAB_TRADE_WINDOW}` : 'Realized'}
          value={formatPnl(realized)}
          tone={realized >= 0 ? 'profit' : 'loss'}
        />
        <StatCard
          label={truncated ? `Win rate · last ${LIVE_TAB_TRADE_WINDOW}` : 'Win rate'}
          value={winRate === null ? '—' : `${(winRate * 100).toFixed(0)}%`}
          tone="neutral"
        />
      </div>

      {/* Open positions */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-panel">
        <header className="mb-3 flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Open positions
          </h3>
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
            {open.length} active
          </span>
        </header>
        {isLoading ? (
          <ActivitySkeleton rows={2} />
        ) : isError ? (
          <p className="text-xs text-[var(--color-loss)]">Could not load.</p>
        ) : open.length === 0 ? (
          <EmptyTradesRow text="No open positions for this strategy right now." />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {open.slice(0, 5).map((t) => (
              <TradeRow key={t.id} trade={t} variant="open" />
            ))}
          </ul>
        )}
      </section>

      {/* Recent closed */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-panel">
        <header className="mb-3 flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Recent closes
          </h3>
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
            {lastClosed ? `last ${formatRelative(lastClosed.exitTime ?? lastClosed.entryTime)}` : '—'}
          </span>
        </header>
        {isLoading ? (
          <ActivitySkeleton rows={3} />
        ) : isError ? (
          <p className="text-xs text-[var(--color-loss)]">Could not load.</p>
        ) : closed.length === 0 ? (
          <EmptyTradesRow text="No closed trades yet for this strategy." />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {closed.slice(0, 5).map((t) => (
              <TradeRow key={t.id} trade={t} variant="closed" />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'profit' | 'loss' | 'neutral';
}) {
  const colour =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--text-primary)';
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className="mt-1 font-display text-lg tabular-nums"
        style={{ color: colour }}
      >
        {value}
      </div>
    </div>
  );
}

function TradeRow({ trade, variant }: { trade: Trades; variant: 'open' | 'closed' }) {
  const pnl = variant === 'open' ? trade.unrealizedPnl ?? 0 : trade.realizedPnl ?? 0;
  const tone = pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';
  const dirColour = trade.direction === 'LONG' ? 'var(--color-profit)' : 'var(--color-loss)';
  const ts = variant === 'open' ? trade.entryTime : trade.exitTime ?? trade.entryTime;
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-xs">
      <Link
        href={`/trades/${trade.id}`}
        className="flex min-w-0 items-center gap-3 hover:text-[var(--text-primary)]"
      >
        <span
          className="font-mono uppercase"
          style={{ color: dirColour, fontSize: 10, width: 28, flexShrink: 0 }}
        >
          {trade.direction === 'LONG' ? 'LONG' : 'SHORT'}
        </span>
        <span className="font-mono text-[var(--text-primary)]">{trade.symbol}</span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          {trade.entryPrice ? `@${trade.entryPrice.toFixed(2)}` : ''}
        </span>
      </Link>
      <div className="flex items-center gap-3 text-right">
        <span className="font-mono tabular-nums" style={{ color: tone, fontSize: 12 }}>
          {formatPnl(pnl)}
        </span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]" style={{ minWidth: 70 }}>
          {ts ? formatRelative(ts) : '—'}
        </span>
      </div>
    </li>
  );
}

function ActivitySkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}

function EmptyTradesRow({ text }: { text: string }) {
  return (
    <p className="rounded border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center text-[11px] text-[var(--text-muted)]">
      {text}
    </p>
  );
}

function formatPnl(value: number): string {
  if (value === 0) return '0.00';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatRelative(epochMs: number | null | undefined): string {
  if (!epochMs) return '—';
  const diffMs = Date.now() - epochMs;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  return `${day}d`;
}

function OverviewTab({ strategy }: { strategy: AccountStrategy }) {
  const rows: Array<{ label: string; value: React.ReactNode; icon?: React.ElementType }> = [
    { label: 'Account Strategy ID', value: strategy.id, icon: Hash },
    { label: 'Account ID', value: strategy.accountId, icon: Hash },
    { label: 'Strategy Code', value: strategy.strategyCode },
    { label: 'Symbol', value: strategy.symbol },
    { label: 'Interval', value: strategy.interval },
    { label: 'Status', value: <StrategyStatusBadge status={strategy.status} /> },
    {
      label: 'Capital Allocation',
      value: `${strategy.capitalAllocationPct.toFixed(2)}%`,
    },
    {
      label: 'Max Open Positions',
      value: strategy.maxOpenPositions || '—',
    },
    { label: 'Allow Long', value: strategy.allowLong ? 'Yes' : 'No' },
    { label: 'Allow Short', value: strategy.allowShort ? 'Yes' : 'No' },
    { label: 'Priority Order', value: `#${strategy.priorityOrder}` },
    { label: 'Created', value: formatIso(strategy.createdAt), icon: Calendar },
    { label: 'Updated', value: formatIso(strategy.updatedAt), icon: Calendar },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-panel">
      <table className="w-full">
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.map(({ label, value, icon: Icon }) => (
            <tr key={label}>
              <td className="w-1/3 px-4 py-2.5 align-top">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  {Icon && <Icon size={12} />}
                  {label}
                </div>
              </td>
              <td className="px-4 py-2.5 font-mono text-sm text-[var(--text-primary)]">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParametersTab({ strategy }: { strategy: AccountStrategy }) {
  const isVcb = isVcbStrategy(strategy.strategyCode);
  return isVcb ? (
    <VcbParametersEditor strategyId={strategy.id} strategyCode={strategy.strategyCode} />
  ) : (
    <LsrParametersEditor strategy={strategy} />
  );
}

function LsrParametersEditor({ strategy }: { strategy: AccountStrategy }) {
  const { data: defaults, isLoading: loadingDefaults, isError: defaultsError } = useLsrDefaults();
  const { data: current, isLoading: loadingParams } = useLsrParams(strategy.id);

  if (defaultsError) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--color-loss)]">
        Could not load LSR parameter defaults.
      </div>
    );
  }
  if (loadingDefaults || !defaults || loadingParams) {
    return <ParametersSkeleton />;
  }

  return (
    <LsrParamsForm
      mode="live"
      accountStrategyId={strategy.id}
      strategyCode={strategy.strategyCode}
      initialValues={current ?? {}}
      defaultValues={defaults}
    />
  );
}

function VcbParametersEditor({
  strategyId,
  strategyCode,
}: {
  strategyId: string;
  strategyCode: string;
}) {
  const { data: defaults, isLoading: loadingDefaults, isError: defaultsError } = useVcbDefaults();
  const { data: current, isLoading: loadingParams } = useVcbParams(strategyId);

  if (defaultsError) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--color-loss)]">
        Could not load VCB parameter defaults.
      </div>
    );
  }
  if (loadingDefaults || !defaults || loadingParams) {
    return <ParametersSkeleton />;
  }

  return (
    <VcbParamsForm
      mode="live"
      accountStrategyId={strategyId}
      strategyCode={strategyCode}
      initialValues={current ?? {}}
      defaultValues={defaults}
    />
  );
}

function ParametersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function StrategyDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-9 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
