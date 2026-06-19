'use client';

import { useMemo } from 'react';
import { AlertCircle, RefreshCw, Wallet } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { PortfolioRebalanceSection } from '@/components/admin/portfolio-rebalance/PortfolioRebalanceSection';
import { usePortfolio } from '@/hooks/usePortfolio';
import { usePnlSummary, useOpenTrades } from '@/hooks/useTrades';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { usePositionStore } from '@/store/positionStore';
import { useAccountView } from '@/lib/accountType/registry';
import { aggregateTradeRisk, computeTradeRisk, AGGREGATE_RISK_WARN_PCT } from '@/lib/risk';
import type { PortfolioAsset } from '@/types/portfolio';

/** Stablecoin tickers treated as "cash" for allocation framing. Single source
 *  so the allocation donut and the RiskCard never drift apart. */
const STABLE_TICKERS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD']);

interface EnrichedAsset extends PortfolioAsset {
  total: number;
  portfolioPct: number;
}

export default function PortfolioPage() {
  const { data, isLoading, isError, refetch, isFetching } = usePortfolio();
  const { data: pnlToday } = usePnlSummary('today');
  const { accounts } = useActiveAccount();
  const formatCurrency = useCurrencyFormatter();
  const isAdmin = useIsAdmin();
  const accountView = useAccountView();
  const isHedgingAccount = accountView.type === 'HEDGING';

  const totalUsdt = data?.totalUsdt ?? 0;
  const availableUsdt = data?.availableUsdt ?? 0;
  const lockedUsdt = data?.lockedUsdt ?? 0;

  // Open-trade stop-loss exposure across the active account. markMap feeds live
  // prices; signal-exit trades contribute notional but no $-at-risk.
  const { data: openTrades = [] } = useOpenTrades();
  const markMap = usePositionStore((s) => s.markMap);
  const openTradeRisk = useMemo(() => {
    const perTrade = openTrades.map((p) =>
      computeTradeRisk(p, markMap[p.tradeId] ?? p.markPrice ?? null, availableUsdt),
    );
    return aggregateTradeRisk(perTrade, availableUsdt);
  }, [openTrades, markMap, availableUsdt]);

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

  const realizedToday = pnlToday?.realizedPnl ?? 0;
  const unrealizedOpen = pnlToday?.unrealizedPnl ?? 0;

  const allocation = useMemo(() => {
    const lockedCash = Math.max(0, lockedUsdt);

    if (isHedgingAccount) {
      // For a 2-asset BTC/USDT spot tilt: BTC vs Cash (USDT/stables) — no
      // "Crypto/Stable" framing since only two sleeves matter here.
      const hedgeTotal = Math.max(1, totalUsdt);
      let btcValue = 0;
      let cashValue = 0;
      for (const a of rows) {
        if (STABLE_TICKERS.has(a.asset.toUpperCase())) cashValue += a.usdtValue;
        else btcValue += a.usdtValue;
      }
      cashValue += lockedCash;
      return [
        { label: 'BTC', pct: (btcValue / hedgeTotal) * 100, color: 'var(--color-btc)' },
        { label: 'Cash (USDT)', pct: (cashValue / hedgeTotal) * 100, color: 'var(--mm-ink-0)' },
      ].filter((s) => s.pct > 0);
    }

    let stableValue = 0;
    let cryptoValue = 0;
    for (const a of rows) {
      if (STABLE_TICKERS.has(a.asset)) stableValue += a.usdtValue;
      else cryptoValue += a.usdtValue;
    }
    // Denominator stays the component sum (crypto + stable + locked) — the
    // original trading behaviour, NOT totalUsdt — so trading percentages are
    // byte-for-byte unchanged.
    const total = Math.max(1, cryptoValue + stableValue + lockedCash);
    return [
      { label: 'Crypto', pct: (cryptoValue / total) * 100, color: 'var(--brand-500)' },
      { label: 'Stable', pct: (stableValue / total) * 100, color: 'var(--mm-ink-0)' },
      { label: 'Locked', pct: (lockedCash / total) * 100, color: 'var(--mm-ink-3)' },
    ].filter((s) => s.pct > 0);
  }, [rows, lockedUsdt, totalUsdt, isHedgingAccount]);

  if (isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn't load portfolio"
        description="The balances endpoint returned an error."
        action={
          <button
            type="button"
            onClick={() => refetch()}
            className="mm-btn mm-btn-mint"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={12} strokeWidth={2} /> Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {}
      <section
        className="mm-card mm-card-lift"
        style={{
          padding: '28px 32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {}
        <div className="mm-band" />

        {}
        <div>
          <div className="mm-kicker">TOTAL VALUE · ALL DESKS</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
            {isLoading ? (
              <Skeleton className="h-[72px] w-[360px]" />
            ) : (
              <span
                className="font-display"
                style={{
                  fontSize: 72,
                  lineHeight: 0.95,
                  letterSpacing: '-0.035em',
                  color: 'var(--mm-ink-0)',
                }}
              >
                {formatCurrency(totalUsdt)}
              </span>
            )}
          </div>

          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <DeltaChip value={realizedToday + unrealizedOpen} period="today" />
          </div>

          <div
            style={{
              marginTop: 28,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 18,
            }}
          >
            <HeroStat
              label="Cash buying power"
              value={isLoading ? '—' : formatCurrency(availableUsdt)}
              sub={
                rows.length > 0 ? `${rows.length} asset${rows.length === 1 ? '' : 's'}` : undefined
              }
            />
            <HeroStat
              label="Locked"
              value={isLoading ? '—' : formatCurrency(lockedUsdt)}
              sub={
                totalUsdt > 0
                  ? `${((lockedUsdt / totalUsdt) * 100).toFixed(1)}% of total`
                  : undefined
              }
            />
            <HeroStat
              label="Accounts"
              value={accounts.length.toString()}
              sub={
                accounts.filter((a) => a.active).length > 0
                  ? `${accounts.filter((a) => a.active).length} active`
                  : 'none active'
              }
            />
            <HeroStat
              label="Day P&L"
              value={formatCurrency(realizedToday, { withSign: true })}
              sub={
                unrealizedOpen !== 0
                  ? `${formatCurrency(unrealizedOpen, { withSign: true })} unrealized`
                  : undefined
              }
              tone={realizedToday >= 0 ? 'up' : 'down'}
            />
          </div>
        </div>
      </section>

      {}
      <section
        className="grid gap-5"
        style={{
          gridTemplateColumns: isHedgingAccount
            ? 'repeat(2, minmax(0, 1fr))'
            : 'repeat(3, minmax(0, 1fr))',
        }}
      >
        <AllocationCard slices={allocation} isLoading={isLoading} isHedging={isHedgingAccount} />
        <RiskCard
          totalUsdt={totalUsdt}
          rows={rows}
          lockedUsdt={lockedUsdt}
          isHedging={isHedgingAccount}
          openTradeRisk={openTradeRisk}
          formatCurrency={formatCurrency}
        />
        {!isHedgingAccount && <PerformanceCard />}
      </section>

      {isAdmin && <PortfolioRebalanceSection />}

      {}
      <section
        className="mm-card"
        style={{
          padding: '18px 22px 8px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            paddingRight: 4,
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 className="font-display" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
              Holdings
            </h2>
            <span style={{ fontSize: 14, color: 'var(--mm-ink-2)' }}>
              {isLoading
                ? 'Loading…'
                : rows.length === 0
                  ? 'No assets'
                  : `${rows.length} asset${rows.length === 1 ? '' : 's'}${
                      isFetching ? ' · refreshing' : ''
                    }`}
            </span>
          </div>
          <button
            type="button"
            className="mm-btn"
            onClick={() => refetch()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={12} strokeWidth={1.75} /> Refresh
          </button>
        </div>

        <div
          className="font-mono"
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: '36px 1.4fr 1fr 1fr 1fr 1fr 110px',
            gap: 14,
            padding: '10px 8px',
            borderTop: '1px solid var(--mm-hair)',
            borderBottom: '1px solid var(--mm-hair)',
            fontSize: 12,
            letterSpacing: '0.12em',
            color: 'var(--mm-ink-3)',
          }}
        >
          <span />
          <span>ASSET</span>
          <span style={{ textAlign: 'right' }}>FREE</span>
          <span style={{ textAlign: 'right' }}>LOCKED</span>
          <span style={{ textAlign: 'right' }}>TOTAL</span>
          <span style={{ textAlign: 'right' }}>MARKET VALUE</span>
          <span style={{ textAlign: 'right' }}>ALLOC</span>
        </div>

        {isLoading ? (
          <div style={{ padding: '18px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[44px] w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              color: 'var(--mm-ink-2)',
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            <Wallet
              size={24}
              strokeWidth={1.5}
              style={{ margin: '0 auto 8px', color: 'var(--mm-ink-3)' }}
            />
            No balances on the active account yet. Fund the account or add a broker in{' '}
            <strong style={{ color: 'var(--mm-ink-0)' }}>Settings</strong>.
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {rows.map((r, i) => (
              <HoldingRow key={r.asset} row={r} last={i === rows.length - 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'up' | 'down';
}) {
  const color =
    tone === 'up' ? 'var(--mm-up)' : tone === 'down' ? 'var(--mm-dn)' : 'var(--mm-ink-0)';
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--mm-ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          marginTop: 6,
          fontFamily: 'var(--font-num)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          color,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 13, color: 'var(--mm-ink-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function DeltaChip({ value, period }: { value: number; period: string }) {
  const formatCurrency = useCurrencyFormatter();
  const up = value >= 0;
  return (
    <span
      className="mm-chip"
      style={{
        background: up ? 'var(--mm-up-soft)' : 'var(--mm-dn-soft)',
        color: up ? 'var(--mm-up)' : 'var(--mm-dn)',
        padding: '5px 12px',
        fontSize: 14,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
      }}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      {formatCurrency(value, { withSign: true })} {period}
    </span>
  );
}

interface Slice {
  label: string;
  pct: number;
  color: string;
}

function AllocationCard({
  slices,
  isLoading,
  isHedging = false,
}: {
  slices: Slice[];
  isLoading: boolean;
  isHedging?: boolean;
}) {
  return (
    <div className="mm-card" style={{ padding: '24px 26px' }}>
      <div className="mm-kicker">{isHedging ? 'TILT ALLOCATION' : 'ALLOCATION'}</div>
      <h2 className="font-display" style={{ fontSize: 22, marginTop: 6, letterSpacing: '-0.02em' }}>
        {isHedging ? 'BTC vs Cash' : 'Mix by sleeve'}
      </h2>
      {isLoading ? (
        <Skeleton className="mt-[18px] h-[108px] w-full" />
      ) : slices.length === 0 ? (
        <p style={{ marginTop: 18, fontSize: 14, color: 'var(--mm-ink-3)' }}>
          Fund the account to see allocation.
        </p>
      ) : (
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 22 }}>
          <Donut slices={slices} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slices.map((s) => (
              <div
                key={s.label}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}
              >
                <span
                  style={{ width: 8, height: 8, borderRadius: 2, background: s.color }}
                  aria-hidden="true"
                />
                <span style={{ flex: 1, color: 'var(--mm-ink-1)' }}>{s.label}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-num)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 14,
                  }}
                >
                  {s.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskCard({
  totalUsdt,
  rows,
  lockedUsdt,
  isHedging = false,
  openTradeRisk,
  formatCurrency,
}: {
  totalUsdt: number;
  rows: EnrichedAsset[];
  lockedUsdt: number;
  isHedging?: boolean;
  openTradeRisk: ReturnType<typeof aggregateTradeRisk>;
  formatCurrency: (amount: number, opts?: { withSign?: boolean }) => string;
}) {
  const topPosition = rows[0];
  const concentrationPct = topPosition && totalUsdt > 0 ? topPosition.portfolioPct : 0;
  const lockedPct = totalUsdt > 0 ? (lockedUsdt / totalUsdt) * 100 : 0;
  const cashPct =
    totalUsdt > 0
      ? Math.max(
          0,
          100 - rows.filter((r) => !isStable(r.asset)).reduce((acc, r) => acc + r.portfolioPct, 0),
        )
      : 0;

  // For a HEDGING account, compute BTC-specific stats: BTC weight and cash
  // (USDT/stables) weight are the two meaningful exposure numbers.
  const btcRow = isHedging ? rows.find((r) => r.asset.toUpperCase() === 'BTC') : null;
  const btcPct = btcRow && totalUsdt > 0 ? btcRow.portfolioPct : 0;
  const cashOnlyPct =
    isHedging && totalUsdt > 0
      ? rows
          .filter((r) => STABLE_TICKERS.has(r.asset.toUpperCase()))
          .reduce((acc, r) => acc + r.portfolioPct, 0)
      : 0;

  const items: Array<{ label: string; value: string; bar: number; tone: 'warn' | 'mint' | null }> =
    isHedging
      ? [
          {
            label: 'BTC weight',
            value: `${btcPct.toFixed(1)}%`,
            bar: Math.min(100, btcPct),
            tone: null,
          },
          {
            label: 'Cash (USDT) weight',
            value: `${cashOnlyPct.toFixed(1)}%`,
            bar: Math.min(100, cashOnlyPct),
            tone: 'mint',
          },
          {
            label: 'Locked',
            value: `${lockedPct.toFixed(1)}%`,
            bar: Math.min(100, lockedPct),
            tone: null,
          },
        ]
      : [
          {
            label: 'Largest position',
            value: topPosition ? `${topPosition.asset} · ${concentrationPct.toFixed(1)}%` : '—',
            bar: Math.min(100, concentrationPct),
            tone: concentrationPct >= 60 ? 'warn' : null,
          },
          {
            label: 'Cash buffer',
            value: `${cashPct.toFixed(1)}%`,
            bar: Math.min(100, cashPct),
            tone: 'mint',
          },
          {
            label: 'Locked',
            value: `${lockedPct.toFixed(1)}%`,
            bar: Math.min(100, lockedPct),
            tone: null,
          },
        ];

  return (
    <div className="mm-card" style={{ padding: '24px 26px' }}>
      <div className="mm-kicker">RISK</div>
      <h2 className="font-display" style={{ fontSize: 22, marginTop: 6, letterSpacing: '-0.02em' }}>
        Exposure profile
      </h2>
      <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
        {items.map((r) => (
          <div key={r.label}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              <span style={{ color: 'var(--mm-ink-2)' }}>{r.label}</span>
              <span
                style={{
                  fontFamily: 'var(--font-num)',
                  fontVariantNumeric: 'tabular-nums',
                  color:
                    r.tone === 'warn'
                      ? 'var(--mm-warn)'
                      : r.tone === 'mint'
                        ? 'var(--brand-500)'
                        : 'var(--mm-ink-0)',
                }}
              >
                {r.value}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: 'var(--mm-hair)' }}>
              <div
                style={{
                  width: `${r.bar}%`,
                  height: '100%',
                  borderRadius: 999,
                  background:
                    r.tone === 'warn'
                      ? 'var(--mm-warn)'
                      : r.tone === 'mint'
                        ? 'var(--brand-500)'
                        : 'var(--mm-ink-1)',
                  transition: 'width 160ms ease-out',
                }}
              />
            </div>
          </div>
        ))}

        {}
        <OpenTradeRiskRow risk={openTradeRisk} formatCurrency={formatCurrency} />
      </div>
    </div>
  );
}

/**
 * Live stop-loss exposure across all open trades — total $-at-risk and its % of
 * account cash. Amber when the aggregate crosses the over-exposure line.
 * Signal-exit trades (no fixed stop) contribute no $-at-risk, so this can read
 * "$0.00" while trades are open — that is correct, not a bug.
 */
function OpenTradeRiskRow({
  risk,
  formatCurrency,
}: {
  risk: ReturnType<typeof aggregateTradeRisk>;
  formatCurrency: (amount: number, opts?: { withSign?: boolean }) => string;
}) {
  const warn = risk.pctAtRisk != null && risk.pctAtRisk >= AGGREGATE_RISK_WARN_PCT;
  const color = warn ? 'var(--mm-warn)' : 'var(--mm-ink-0)';
  return (
    <div style={{ borderTop: '1px solid var(--mm-hair)', paddingTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <span style={{ color: 'var(--mm-ink-2)' }}>
          Open-trade risk
          <span style={{ color: 'var(--mm-ink-3)', marginLeft: 6 }}>
            {risk.n} trade{risk.n === 1 ? '' : 's'}
          </span>
        </span>
        <span
          style={{
            fontFamily: 'var(--font-num)',
            fontVariantNumeric: 'tabular-nums',
            color,
          }}
        >
          {formatCurrency(risk.totalAtRisk)}
          {risk.pctAtRisk != null && (
            <span style={{ color: warn ? 'var(--mm-warn)' : 'var(--mm-ink-2)', marginLeft: 6 }}>
              ({risk.pctAtRisk.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function PerformanceCard() {
  const { data: today } = usePnlSummary('today');
  const { data: week } = usePnlSummary('week');
  const { data: month } = usePnlSummary('month');
  const formatCurrency = useCurrencyFormatter();

  const items: Array<{ l: string; v: string; t?: 'mint' | 'dn' }> = [
    {
      l: 'Today',
      v: formatCurrency(today?.realizedPnl ?? 0, { withSign: true }),
      t: (today?.realizedPnl ?? 0) >= 0 ? 'mint' : 'dn',
    },
    {
      l: 'Week',
      v: formatCurrency(week?.realizedPnl ?? 0, { withSign: true }),
      t: (week?.realizedPnl ?? 0) >= 0 ? 'mint' : 'dn',
    },
    {
      l: 'Month',
      v: formatCurrency(month?.realizedPnl ?? 0, { withSign: true }),
      t: (month?.realizedPnl ?? 0) >= 0 ? 'mint' : 'dn',
    },
    {
      l: 'Trades · month',
      v: month?.tradeCount != null ? month.tradeCount.toLocaleString() : '—',
    },
    {
      l: 'Win rate · month',
      v: month?.winRate != null ? `${(month.winRate * 100).toFixed(0)}%` : '—',
    },
    {
      l: 'Open · today',
      v: today?.openCount != null ? today.openCount.toString() : '—',
    },
    {
      l: 'Avg trade · month',
      v:
        month?.avgTradeReturnPct != null
          ? `${month.avgTradeReturnPct >= 0 ? '+' : ''}${month.avgTradeReturnPct.toFixed(3)}%`
          : '—',
      t:
        month?.avgTradeReturnPct == null ? undefined : month.avgTradeReturnPct >= 0 ? 'mint' : 'dn',
    },
    {
      l: 'Compound @ 90% · month',
      v:
        month?.geometricReturnPctAtAlloc90 != null
          ? `${month.geometricReturnPctAtAlloc90 >= 0 ? '+' : ''}${month.geometricReturnPctAtAlloc90.toFixed(2)}%`
          : '—',
      t:
        month?.geometricReturnPctAtAlloc90 == null
          ? undefined
          : month.geometricReturnPctAtAlloc90 >= 0
            ? 'mint'
            : 'dn',
    },
  ];

  return (
    <div className="mm-card" style={{ padding: '24px 26px' }}>
      <div className="mm-kicker">PERFORMANCE</div>
      <h2 className="font-display" style={{ fontSize: 22, marginTop: 6, letterSpacing: '-0.02em' }}>
        Realized P&amp;L
      </h2>
      <div
        style={{
          marginTop: 18,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          rowGap: 14,
          columnGap: 10,
        }}
      >
        {items.map((it) => (
          <div key={it.l}>
            <div style={{ fontSize: 13, color: 'var(--mm-ink-3)' }}>{it.l}</div>
            <div
              style={{
                fontSize: 17,
                marginTop: 2,
                fontFamily: 'var(--font-num)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
                color:
                  it.t === 'mint'
                    ? 'var(--brand-500)'
                    : it.t === 'dn'
                      ? 'var(--mm-dn)'
                      : 'var(--mm-ink-0)',
              }}
            >
              {it.v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoldingRow({ row, last }: { row: EnrichedAsset; last: boolean }) {
  const initial = row.asset.charAt(0).toUpperCase() || '·';
  const formatCurrency = useCurrencyFormatter();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1.4fr 1fr 1fr 1fr 1fr 110px',
        gap: 14,
        padding: '12px 8px',
        alignItems: 'center',
        borderBottom: last ? 'none' : '1px solid var(--mm-hair)',
        fontSize: 14,
      }}
    >
      <div
        className="font-display"
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          background: 'var(--mm-surface-2)',
          color: 'var(--mm-ink-1)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {initial}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.asset}
          {row.asset !== 'USDT' && (
            <span
              style={{
                color: 'var(--mm-ink-3)',
                marginLeft: 6,
                fontWeight: 400,
              }}
            >
              {describeAsset(row.asset)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'var(--mm-ink-3)', marginTop: 2 }}>
          {isStable(row.asset) ? 'Stablecoin' : 'Crypto · spot'}
        </div>
      </div>
      <NumCell value={row.free} decimals={row.asset === 'USDT' ? 2 : 6} />
      <NumCell
        value={row.locked}
        decimals={row.asset === 'USDT' ? 2 : 6}
        muted={row.locked === 0}
      />
      <NumCell value={row.total} decimals={row.asset === 'USDT' ? 2 : 6} />
      <div
        style={{
          fontFamily: 'var(--font-num)',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
          fontSize: 14,
        }}
      >
        {formatCurrency(row.usdtValue)}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontFamily: 'var(--font-num)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 14,
          }}
        >
          {row.portfolioPct.toFixed(1)}%
        </div>
        <div
          style={{
            marginTop: 4,
            height: 2,
            borderRadius: 999,
            background: 'var(--mm-hair)',
          }}
        >
          <div
            style={{
              width: `${Math.min(row.portfolioPct, 100)}%`,
              height: '100%',
              borderRadius: 999,
              background: 'var(--mm-ink-2)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function NumCell({ value, decimals, muted }: { value: number; decimals: number; muted?: boolean }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-num)',
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
        fontSize: 14,
        color: muted ? 'var(--mm-ink-3)' : 'var(--mm-ink-0)',
      }}
    >
      {value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      })}
    </div>
  );
}

function Donut({ slices }: { slices: Slice[] }) {
  const size = 108;
  const r = 44;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx={cx} cy={cy} r={r} stroke="var(--mm-hair)" strokeWidth="10" fill="none" />
      {slices.map((it) => {
        const len = (it.pct / 100) * C;
        const seg = (
          <circle
            key={it.label}
            cx={cx}
            cy={cy}
            r={r}
            stroke={it.color}
            strokeWidth="10"
            fill="none"
            strokeDasharray={`${len} ${C}`}
            strokeDashoffset={-off}
          />
        );
        off += len;
        return seg;
      })}
    </svg>
  );
}

function isStable(asset: string): boolean {
  return STABLE_TICKERS.has(asset.toUpperCase());
}

function describeAsset(asset: string): string {
  const named: Record<string, string> = {
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    SOL: 'Solana',
    BNB: 'BNB',
    AVAX: 'Avalanche',
    ADA: 'Cardano',
    XRP: 'XRP',
    DOGE: 'Dogecoin',
    MATIC: 'Polygon',
    LINK: 'Chainlink',
  };
  return named[asset.toUpperCase()] ?? asset;
}
