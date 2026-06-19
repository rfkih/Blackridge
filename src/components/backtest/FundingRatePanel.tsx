'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { getFundingRateSummary, type FundingRateSummary } from '@/lib/api/funding-rate';

interface FundingRatePanelProps {
  symbol: string;
  fromDate: string;
  toDate: string;
  /** Flat funding stub captured on the run (bps per 8h). Null on legacy runs. */
  configuredBpsPer8h: number | null;
}

export function FundingRatePanel({
  symbol,
  fromDate,
  toDate,
  configuredBpsPer8h,
}: FundingRatePanelProps) {
  const query = useQuery({
    queryKey: ['funding-rate', symbol, fromDate, toDate],
    queryFn: () =>
      getFundingRateSummary({
        symbol,
        startTime: fromDate,
        endTime: toDate,
      }),
    staleTime: 5 * 60_000,
    retry: 0,
    enabled: Boolean(symbol && fromDate && toDate),
  });

  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
        <h3 className="font-display text-[14px] font-semibold text-text-primary">
          Funding rate
          <span className="ml-2 font-mono text-[13px] font-normal text-text-muted">
            {symbol} · realized over run window
          </span>
        </h3>
        {configuredBpsPer8h != null && (
          <span className="font-mono text-[12px] uppercase tracking-wider text-text-muted">
            run config:{' '}
            <span className="text-text-secondary">
              {configuredBpsPer8h.toFixed(2)} bps/8h
            </span>
          </span>
        )}
      </div>

      {query.isLoading ? (
        <div className="flex items-center gap-2 px-4 py-6 text-text-secondary">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[14px]">Loading funding history…</span>
        </div>
      ) : query.isError || !query.data ? (
        <div className="px-4 py-6 text-[14px] text-text-secondary">
          Could not load funding history.
        </div>
      ) : query.data.count === 0 ? (
        <div className="px-4 py-6 text-[14px] text-text-secondary">
          No funding events recorded for {symbol} in this window.
          <div className="mt-1 text-[13px] text-text-muted">
            Spot symbols and pre-Phase-4 history return empty here.
          </div>
        </div>
      ) : (
        <FundingBody data={query.data} />
      )}
    </section>
  );
}

function FundingBody({ data }: { data: FundingRateSummary }) {
  const meanPct = data.mean != null ? Number(data.mean) * 100 : null;
  const minPct = data.min != null ? Number(data.min) * 100 : null;
  const maxPct = data.max != null ? Number(data.max) * 100 : null;
  const latestPct = data.latestRate != null ? Number(data.latestRate) * 100 : null;
  const annualizedPct = data.annualizedPct != null ? Number(data.annualizedPct) : null;
  const meanIsPositive = meanPct != null && meanPct >= 0;

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        <Stat
          label="Events"
          value={data.count.toLocaleString()}
        />
        <Stat
          label="Mean (8h)"
          value={fmtPct(meanPct, 4)}
          tone={meanPct == null ? 'neutral' : meanIsPositive ? 'profit' : 'loss'}
          icon={
            meanPct == null ? null : meanIsPositive ? (
              <TrendingUp size={11} strokeWidth={2} />
            ) : (
              <TrendingDown size={11} strokeWidth={2} />
            )
          }
        />
        <Stat
          label="Range"
          value={`${fmtPct(minPct, 4)} – ${fmtPct(maxPct, 4)}`}
        />
        <Stat
          label="Annualized"
          value={fmtPct(annualizedPct, 2)}
          tone={
            annualizedPct == null ? 'neutral' : annualizedPct >= 0 ? 'profit' : 'loss'
          }
        />
        <Stat
          label="Latest"
          value={fmtPct(latestPct, 4)}
          sub={data.latestTime ?? undefined}
        />
      </div>

      <div className="text-[13px] text-text-muted">
        Funding settles every 8h on Binance perpetuals. Longs pay shorts when
        the rate is positive; shorts pay longs when negative. Annualized figure
        is mean × 3 settlements/day × 365, informational only.
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'profit' | 'loss';
  icon?: React.ReactNode;
}) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--text-primary)';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[12px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span
        className="inline-flex items-center gap-1 font-mono tabular-nums text-[14px]"
        style={{ color }}
      >
        {icon}
        {value}
      </span>
      {sub && (
        <span className="font-mono text-[12px] text-text-muted">{sub}</span>
      )}
    </div>
  );
}

function fmtPct(n: number | null | undefined, dp: number): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(dp)}%`;
}
