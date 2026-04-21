'use client';

import { useMemo } from 'react';
import { AlertCircle, RefreshCw, Wallet } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortfolio } from '@/hooks/usePortfolio';
import { formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { PortfolioAsset } from '@/types/portfolio';

interface EnrichedAsset extends PortfolioAsset {
  total: number;
  portfolioPct: number;
}

export default function PortfolioPage() {
  const { data, isLoading, isError, refetch, isFetching } = usePortfolio();

  const totalUsdt = data?.totalUsdt ?? 0;
  const availableUsdt = data?.availableUsdt ?? 0;
  const lockedUsdt = data?.lockedUsdt ?? 0;

  // Enrich + sort descending by USDT value. Tiny dust rows stay at the bottom
  // but still render so users can see what's in the account.
  const rows = useMemo<EnrichedAsset[]>(() => {
    const assets = data?.assets ?? [];
    if (!assets.length) return [];
    return assets
      .map((a) => ({
        ...a,
        total: a.free + a.locked,
        portfolioPct: totalUsdt > 0 ? (a.usdtValue / totalUsdt) * 100 : 0,
      }))
      .sort((a, b) => b.usdtValue - a.usdtValue);
  }, [data?.assets, totalUsdt]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Portfolio</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Balances
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            Live account balances, refreshing every 30 seconds.
          </p>
        </div>
        <LiveIndicator active={isFetching && !isLoading} />
      </header>

      <HeroValue
        totalUsdt={totalUsdt}
        availableUsdt={availableUsdt}
        lockedUsdt={lockedUsdt}
        isLoading={isLoading}
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No balances yet"
          description="Your Binance account has no assets, or hasn't been synced yet."
        />
      ) : (
        <BalanceTable rows={rows} />
      )}
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroValue({
  totalUsdt,
  availableUsdt,
  lockedUsdt,
  isLoading,
}: {
  totalUsdt: number;
  availableUsdt: number;
  lockedUsdt: number;
  isLoading: boolean;
}) {
  const availableShare = totalUsdt > 0 ? (availableUsdt / totalUsdt) * 100 : 0;
  const lockedShare = totalUsdt > 0 ? (lockedUsdt / totalUsdt) * 100 : 0;

  return (
    <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-6 px-6 py-5">
        <div className="min-w-0">
          <p className="label-caps">Total Account Value</p>
          <div className="mt-2">
            {isLoading ? (
              <Skeleton className="h-10 w-52" />
            ) : (
              <p className="font-display text-[36px] font-semibold leading-none tracking-tighter text-text-primary">
                <span className="mr-2 text-[20px] text-text-muted">$</span>
                {formatPrice(totalUsdt)}
                <span className="ml-2 text-[14px] font-normal text-text-muted">USDT</span>
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <BalanceStat label="Available" value={availableUsdt} share={availableShare} tone="info" />
          <BalanceStat label="Locked" value={lockedUsdt} share={lockedShare} tone="warning" />
        </div>
      </div>
      {/* Split bar visualising available vs locked */}
      {totalUsdt > 0 && !isLoading && (
        <div className="flex h-1.5 w-full overflow-hidden bg-bg-elevated">
          <div
            className="h-full"
            style={{ width: `${availableShare}%`, background: 'var(--color-info)' }}
            aria-label={`Available ${availableShare.toFixed(1)}%`}
          />
          <div
            className="h-full"
            style={{ width: `${lockedShare}%`, background: 'var(--color-warning)' }}
            aria-label={`Locked ${lockedShare.toFixed(1)}%`}
          />
        </div>
      )}
    </section>
  );
}

function BalanceStat({
  label,
  value,
  share,
  tone,
}: {
  label: string;
  value: number;
  share: number;
  tone: 'info' | 'warning';
}) {
  const color = tone === 'info' ? 'var(--color-info)' : 'var(--color-warning)';
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-mono text-[14px] font-semibold tabular-nums text-text-primary">
        {formatPrice(value)}
      </p>
      <p className="font-mono text-[10px] tabular-nums" style={{ color }}>
        {share.toFixed(1)}%
      </p>
    </div>
  );
}

// ─── Balance table ───────────────────────────────────────────────────────────

function BalanceTable({ rows }: { rows: EnrichedAsset[] }) {
  // Header percentages are keyed off the leader so the bars render at a
  // consistent visual scale (100% = largest holding, not 100% of the account).
  const leaderUsdt = rows[0]?.usdtValue ?? 0;

  return (
    <div className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bd-subtle bg-bg-surface">
              {['Asset', 'Free', 'Locked', 'Total', 'USDT Value', '% of Portfolio'].map((col) => (
                <th key={col} className="label-caps whitespace-nowrap px-4 py-2.5 text-left">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <AssetRow key={row.asset} row={row} leaderUsdt={leaderUsdt} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssetRow({ row, leaderUsdt }: { row: EnrichedAsset; leaderUsdt: number }) {
  const isDust = row.usdtValue < 0.01;
  // Scale bar width to the leader — keeps tiny rows from becoming invisible
  // but still communicates relative weight.
  const barWidth = leaderUsdt > 0 ? Math.max(2, (row.usdtValue / leaderUsdt) * 100) : 0;

  return (
    <tr className="border-b border-bd-subtle last:border-b-0 hover:bg-bg-elevated">
      <td className="whitespace-nowrap px-4 py-2.5">
        <span
          className={cn(
            'font-mono text-[13px] font-semibold',
            isDust ? 'text-text-muted' : 'text-text-primary',
          )}
        >
          {row.asset}
        </span>
        {isDust && <span className="label-caps ml-1.5 !text-[9px]">dust</span>}
      </td>
      <td className="num whitespace-nowrap px-4 py-2.5 text-[12px] text-text-primary">
        {formatPrice(row.free, 6)}
      </td>
      <td className="num whitespace-nowrap px-4 py-2.5 text-[12px] text-text-secondary">
        {formatPrice(row.locked, 6)}
      </td>
      <td className="num whitespace-nowrap px-4 py-2.5 text-[12px] text-text-primary">
        {formatPrice(row.total, 6)}
      </td>
      <td className="num whitespace-nowrap px-4 py-2.5 text-[12px] text-text-primary">
        ${formatPrice(row.usdtValue)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-24 overflow-hidden rounded-full bg-bg-elevated"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${barWidth}%`,
                background:
                  row.portfolioPct >= 50
                    ? 'var(--color-profit)'
                    : row.portfolioPct >= 10
                      ? 'var(--color-info)'
                      : 'var(--color-neutral)',
              }}
            />
          </div>
          <span className="num min-w-[44px] text-right font-mono text-[11px] tabular-nums text-text-secondary">
            {row.portfolioPct.toFixed(2)}%
          </span>
        </div>
      </td>
    </tr>
  );
}

// ─── Supporting UI ───────────────────────────────────────────────────────────

function LiveIndicator({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
      <span
        aria-hidden="true"
        className="inline-block size-1.5 rounded-full"
        style={{
          background: active ? 'var(--color-profit)' : 'var(--text-muted)',
          animation: active ? 'pulse 2s ease-in-out infinite' : 'none',
        }}
      />
      Live · 30s
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-0 rounded-md border border-bd-subtle bg-bg-surface p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-bd-subtle py-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-4 w-24" />
          <Skeleton className="h-1.5 w-24" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-bd-subtle bg-bg-surface px-6 py-10 text-center">
      <AlertCircle size={20} className="text-text-muted" />
      <p className="text-sm text-text-secondary">Could not load portfolio balances.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1.5 text-[11px] text-text-primary transition-colors hover:bg-bg-hover"
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}
