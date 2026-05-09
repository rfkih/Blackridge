'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, TrendingUp, Zap } from 'lucide-react';
import { useOpenTrades, usePnlSummary } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useEquityCurve } from '@/hooks/useEquityCurve';
import { useLivePnl, useSyncOpenPositions } from '@/hooks/useLivePnl';
import { usePositionStore } from '@/store/positionStore';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { OnboardingPanel } from '@/components/dashboard/OnboardingPanel';
import { EmailVerificationBanner } from '@/components/dashboard/EmailVerificationBanner';
import { KillSwitchBanner } from '@/components/dashboard/KillSwitchBanner';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import type { LivePosition } from '@/types/trading';
import type { AccountStrategy } from '@/types/strategy';
import type { EquityPoint } from '@/types/market';

export default function DashboardPage() {
  const { scopedAccountId, isAll, activeAccount } = useActiveAccount();
  const { user } = useAuth();
  const { data: strategies = [] } = useStrategies();
  const { data: openTrades = [] } = useOpenTrades(scopedAccountId);
  const { data: pnlSummary } = usePnlSummary('today');
  const { data: portfolio } = usePortfolio();
  const equityCurve = useEquityCurve();

  useLivePnl(scopedAccountId);
  useSyncOpenPositions(openTrades);

  const firstName = (user?.name ?? 'Trader').split(' ')[0];

  const balance = portfolio?.totalUsdt ?? pnlSummary?.totalPnl ?? 0;
  const realizedToday = pnlSummary?.realizedPnl ?? 0;
  const unrealizedToday = pnlSummary?.unrealizedPnl ?? 0;
  const changeToday = realizedToday + unrealizedToday;
  const changePct =
    balance > 0 && changeToday !== 0 ? (changeToday / (balance - changeToday)) * 100 : 0;

  const visibleStrategies = scopedAccountId
    ? strategies.filter((s) => s.accountId === scopedAccountId)
    : strategies;

  const profitableCount = openTrades.filter((t) => (t.unrealizedPnl ?? 0) >= 0).length;
  const activeBots = visibleStrategies.filter((s) => s.status === 'LIVE').length;
  const totalBots = visibleStrategies.length;
  const bestOpen = pickBestOpen(openTrades);
  const winRate = pnlSummary?.winRate ?? 0;
  const scopeLabel = isAll ? 'All accounts' : (activeAccount?.label ?? '');

  return (
    <div className="flex flex-col gap-5">
      {/* Email-verification reminder — auto-hides once verified. */}
      <EmailVerificationBanner />

      {/* Drawdown kill-switch alerts — auto-hides when no strategy is tripped. */}
      <KillSwitchBanner />

      {/* Onboarding ladder — auto-hides when the user is fully set up. */}
      <OnboardingPanel />

      {/* Hero row — emerald balance card + two stat cards. Mirrors the
          design pack's dashboard.html `.hero-row` (1.5fr 1fr 1fr). */}
      <section
        className="dashboard-hero-row grid gap-4"
        style={{
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr)',
        }}
      >
        <BalanceHero
          firstName={firstName}
          balance={balance}
          changeToday={changeToday}
          changePct={changePct}
          scopeLabel={scopeLabel}
          points={equityCurve.points}
          period={equityCurve.period}
          setPeriod={equityCurve.setPeriod}
        />
        <StatCard
          label="Open positions"
          value={String(openTrades.length)}
          sub={
            bestOpen
              ? `${bestOpen.symbol.replace(/USDT$/, '')} +${bestOpen.pct.toFixed(2)}%`
              : `${profitableCount} in profit`
          }
          tone="profit"
          icon={<TrendingUp size={16} strokeWidth={2} />}
        />
        <StatCard
          label="Active strategies"
          value={`${activeBots}`}
          sub={`of ${totalBots} · ${winRate.toFixed(0)}% win rate`}
          tone="neutral"
          icon={<Zap size={16} strokeWidth={2} />}
        />
      </section>

      {/* Positions + Top performer */}
      <section
        className="dashboard-two-col grid gap-5"
        style={{ gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)' }}
      >
        <PositionsPanel trades={openTrades} profitableCount={profitableCount} />
        <div className="flex min-h-0 flex-col gap-4">
          <TopPerformerCard strategies={visibleStrategies} realizedToday={realizedToday} />
          <RecentActivityFeed />
        </div>
      </section>
    </div>
  );
}

function pickBestOpen(trades: LivePosition[]): { symbol: string; pct: number } | null {
  if (!trades.length) return null;
  return trades.reduce(
    (acc, t) => {
      const pct = t.unrealizedPnlPct ?? 0;
      return pct > (acc?.pct ?? -Infinity) ? { symbol: t.symbol, pct } : acc;
    },
    null as { symbol: string; pct: number } | null,
  );
}

// ─────────────────────── BalanceHero ───────────────────────
// Emerald-gradient balance card. Mirrors the design pack's `.balance` —
// a small, punchy, white-on-green card with eyebrow, big balance number,
// translucent delta chip, white-tinted period filter, and a thin equity
// curve in the bottom band.

interface BalanceHeroProps {
  firstName: string;
  balance: number;
  changeToday: number;
  changePct: number;
  scopeLabel: string;
  points: EquityPoint[];
  period: ReturnType<typeof useEquityCurve>['period'];
  setPeriod: ReturnType<typeof useEquityCurve>['setPeriod'];
}

function BalanceHero({
  firstName,
  balance,
  changeToday,
  changePct,
  scopeLabel,
  points,
  period,
  setPeriod,
}: BalanceHeroProps) {
  const formatCurrency = useCurrencyFormatter();
  const isUp = changeToday >= 0;
  const chartData = useMemo(() => points.map((p) => p.equity), [points]);
  const lastUpdatedAt = usePositionStore((s) => s.lastUpdatedAt);
  const updatedLabel = useUpdatedAgo(lastUpdatedAt);
  const greeting = timeGreeting();

  const balanceText = formatCurrency(balance);
  const balanceLen = balanceText.length;
  const [minPx, maxPx] =
    balanceLen <= 8
      ? [40, 56]
      : balanceLen <= 11
        ? [34, 46]
        : balanceLen <= 14
          ? [28, 38]
          : [24, 32];

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        padding: '24px 28px 22px',
        color: '#fff',
        background: 'linear-gradient(135deg, #0A7E3F 0%, #16B364 100%)',
        boxShadow: '0 8px 28px rgba(22,179,100, 0.22)',
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Grid backdrop with radial mask — fades out toward bottom-left */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at 100% 0%, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 100% 0%, #000 30%, transparent 75%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          suppressHydrationWarning
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.78)',
          }}
        >
          {greeting}, {firstName}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.7)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: '#fff',
              boxShadow: '0 0 8px rgba(255,255,255,0.8)',
            }}
            className="pulse-dot"
          />
          Live{updatedLabel ? ` · ${updatedLabel}` : ''}
        </span>
      </div>

      <div
        className="mm-display"
        title={balanceText}
        style={{
          position: 'relative',
          marginTop: 10,
          fontSize: `clamp(${minPx}px, 4vw, ${maxPx}px)`,
          lineHeight: 0.95,
          letterSpacing: '-0.03em',
          fontWeight: 800,
          color: '#fff',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {balanceText}
      </div>

      <div
        style={{
          position: 'relative',
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(4px)',
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
          }}
        >
          <ArrowUpRight
            size={12}
            strokeWidth={2.5}
            style={{ transform: isUp ? undefined : 'rotate(90deg)' }}
          />
          {isUp ? '+' : '−'}
          {formatCurrency(Math.abs(changeToday))} ({Math.abs(changePct).toFixed(2)}%)
        </span>
        {scopeLabel && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{scopeLabel}</span>
        )}
      </div>

      {/* Period filter — pills tinted white over the green */}
      <div
        style={{
          position: 'relative',
          marginTop: 14,
          display: 'inline-flex',
          gap: 4,
          padding: 4,
          background: 'rgba(255,255,255,0.14)',
          borderRadius: 999,
          backdropFilter: 'blur(4px)',
          alignSelf: 'flex-start',
        }}
      >
        {(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const).map((p) => {
          const mapped = mapPeriod(p);
          const active = period === mapped;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(mapped)}
              style={{
                background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                padding: '5px 12px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.02em',
                transition: 'all 120ms',
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div style={{ position: 'relative', marginTop: 'auto', paddingTop: 14, height: 80 }}>
        <MiniEquityChart data={chartData.length ? chartData : fallbackCurve()} height={80} />
      </div>
    </section>
  );
}

// ─────────────────────── StatCard ───────────────────────
// White (or theme-elevated) stat card with eyebrow, big value, and a
// muted sub-line. Used as the right two cards in the hero row.

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'profit' | 'loss' | 'neutral';
  icon?: React.ReactNode;
}

function StatCard({ label, value, sub, tone = 'neutral', icon }: StatCardProps) {
  const valueColor =
    tone === 'profit' ? 'var(--mm-mint)' : tone === 'loss' ? 'var(--mm-dn)' : 'var(--mm-ink-0)';
  const iconBg =
    tone === 'profit'
      ? 'var(--mm-mint-soft)'
      : tone === 'loss'
        ? 'var(--mm-dn-soft)'
        : 'var(--mm-surface-3)';
  const iconColor =
    tone === 'profit' ? 'var(--mm-mint)' : tone === 'loss' ? 'var(--mm-dn)' : 'var(--mm-ink-1)';

  return (
    <div
      className="mm-card"
      style={{
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 240,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'var(--mm-ink-2)',
          }}
        >
          {label}
        </div>
        {icon && (
          <span
            aria-hidden="true"
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: iconBg,
              color: iconColor,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className="mm-display"
        style={{
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          marginTop: 4,
          color: valueColor,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="font-mono" style={{ fontSize: 12, color: 'var(--mm-ink-2)', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function useUpdatedAgo(ts: number | null): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (ts == null) {
      setLabel('');
      return;
    }
    const tick = () => {
      const s = Math.floor((Date.now() - ts) / 1000);
      if (s < 5) setLabel('just now');
      else if (s < 60) setLabel(`${s}s ago`);
      else setLabel(`${Math.floor(s / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [ts]);
  return label;
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function minMax(data: number[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

type UiPeriod = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';
const PERIOD_MAP: Record<UiPeriod, ReturnType<typeof useEquityCurve>['period']> = {
  '1D': '7D',
  '1W': '7D',
  '1M': '30D',
  '3M': '90D',
  YTD: 'ALL',
  '1Y': 'ALL',
  ALL: 'ALL',
};
function mapPeriod(p: UiPeriod): ReturnType<typeof useEquityCurve>['period'] {
  return PERIOD_MAP[p];
}

function fallbackCurve(): number[] {
  // Smooth ascending fallback — matches the gentle mint curve in the mock.
  // Intentionally deterministic: the previous version used Math.random() which
  // produced different paths on server vs. client, tripping React's hydration
  // mismatch warning on every dashboard load. A seeded noise term keeps the
  // shape visually varied without introducing non-determinism.
  const n = 60;
  const out: number[] = [];
  let v = 100;
  for (let i = 0; i < n; i++) {
    // Two offset sines give a richer curve than a single wave; no random input.
    const noise = Math.sin(i / 2.3) * 1.4 + Math.sin(i / 7.1 + 1.2) * 1.9;
    v += Math.sin(i / 5) * 2 + noise;
    out.push(v);
  }
  return out;
}

// ─────────────────────── Chart ───────────────────────
// Compact equity sparkline rendered as a white line over the emerald
// balance card. No tag or terminator dot — the surrounding card carries
// the value, the chart just shows the trajectory.

function MiniEquityChart({ data, height }: { data: number[]; height: number }) {
  const width = 480;
  if (!data.length) return null;
  const { min, max } = minMax(data);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / (max - min + 1e-6)) * (height - 8) - 4,
  ]);
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [px, py] = pts[i - 1];
    d += ` Q ${px.toFixed(1)} ${py.toFixed(1)} ${((px + x) / 2).toFixed(1)} ${((py + y) / 2).toFixed(1)}`;
  }
  d += ` T ${pts[pts.length - 1][0].toFixed(1)} ${pts[pts.length - 1][1].toFixed(1)}`;
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height }}
    >
      <defs>
        <linearGradient id="mm-mini-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#mm-mini-area)" />
      <path d={d} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ─────────────────────── Positions Panel ───────────────────────

function PositionsPanel({
  trades,
  profitableCount,
}: {
  trades: LivePosition[];
  profitableCount: number;
}) {
  const rows = trades.slice(0, 6);

  return (
    <div
      className="mm-card"
      style={{
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 18,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="mm-display" style={{ fontSize: 26, color: 'var(--mm-ink-0)' }}>
            Your positions
          </div>
          <div style={{ fontSize: 13, color: 'var(--mm-ink-2)', marginTop: 4 }}>
            {trades.length} open{' '}
            {trades.length > 0 && (
              <>
                · <span style={{ color: 'var(--mm-mint)' }}>{profitableCount} making money</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="mm-pill mm-pill-active"
            style={{ padding: '5px 12px', fontSize: 11 }}
          >
            All
          </button>
          <button type="button" className="mm-pill" style={{ padding: '5px 12px', fontSize: 11 }}>
            Crypto
          </button>
          <button type="button" className="mm-pill" style={{ padding: '5px 12px', fontSize: 11 }}>
            Bots
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyPositions />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((t, idx) => (
            <PositionRow key={t.tradeId} trade={t} isLast={idx === rows.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyPositions() {
  return (
    <div
      style={{
        padding: '44px 16px',
        textAlign: 'center',
        border: '1px dashed var(--mm-hair-2)',
        borderRadius: 20,
      }}
    >
      <div className="mm-display" style={{ fontSize: 20, color: 'var(--mm-ink-1)' }}>
        No open positions
      </div>
      <p style={{ color: 'var(--mm-ink-2)', fontSize: 13, marginTop: 6 }}>
        Strategies will appear here when they open a trade.
      </p>
      <Link
        href="/strategies"
        className="mm-btn mm-btn-mint"
        style={{ display: 'inline-flex', marginTop: 16 }}
      >
        Manage strategies
      </Link>
    </div>
  );
}

function PositionRow({ trade, isLast }: { trade: LivePosition; isLast?: boolean }) {
  // Live WS frames update pnlMap + markMap in the store. Prefer those over
  // the REST snapshot so the row doesn't lag the ticker by ~15s.
  const livePnl = usePositionStore((s) => s.pnlMap[trade.tradeId]);
  const liveMark = usePositionStore((s) => s.markMap[trade.tradeId]);
  const formatCurrency = useCurrencyFormatter();
  const pnl = livePnl ?? trade.unrealizedPnl ?? 0;
  const pnlPct = trade.unrealizedPnlPct ?? 0;
  const isUp = pnl >= 0;
  const color = isUp ? 'var(--mm-mint)' : 'var(--mm-dn)';
  const softBg = isUp ? 'var(--mm-mint-soft)' : 'var(--mm-dn-soft)';

  // Never silently substitute entryPrice for mark — that masks "no live tick"
  // as "no movement since open". Show `—` until a real mark arrives.
  const markPrice = liveMark ?? trade.markPrice ?? null;
  const value = markPrice != null ? markPrice * trade.quantity : null;

  const spark = useMemo(() => buildSpark(trade.tradeId), [trade.tradeId]);

  const logo = trade.symbol.slice(0, 1);
  const displaySym = trade.symbol.replace(/USDT$/, '');

  return (
    <Link
      href={`/trades/${trade.tradeId}`}
      // Borderless row matching the design pack's `.bot-row` — flush cells
      // with a hairline separator between rows. Hover bg lifts subtly.
      className="position-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '36px minmax(0, 1.3fr) 120px minmax(0, 1fr) minmax(0, 1fr)',
        gap: 16,
        alignItems: 'center',
        padding: '14px 4px',
        borderBottom: isLast ? 'none' : '1px solid var(--mm-hair)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 120ms',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: softBg,
          color,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--mm-display)',
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        {logo}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--mm-ink-0)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displaySym}
        </div>
        <div style={{ fontSize: 12, color: 'var(--mm-ink-2)', marginTop: 2 }}>
          {trade.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} {displaySym} ·{' '}
          {trade.direction}
        </div>
      </div>
      <Sparkline values={spark} color={color} />
      <div style={{ textAlign: 'right', minWidth: 0 }}>
        <div className="mm-num" style={{ fontSize: 16, color: 'var(--mm-ink-0)' }}>
          {value != null ? formatCurrency(value) : '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--mm-ink-3)', marginTop: 2 }}>value</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="mm-num" style={{ fontSize: 16, fontWeight: 500, color }}>
          {formatCurrency(pnl, { withSign: true })}
        </div>
        <div style={{ fontSize: 12, marginTop: 2, color }}>
          {isUp ? '▲' : '▼'} {Math.abs(pnlPct).toFixed(2)}%
        </div>
      </div>
    </Link>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 120;
  const h = 36;
  const { min, max } = minMax(values);
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - ((v - min) / (max - min + 1e-6)) * (h - 4) - 2,
  ]);
  const d = pts.reduce(
    (acc, [x, y], i) =>
      acc + (i ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`),
    '',
  );
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path
        d={d}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildSpark(seed: string): number[] {
  // Deterministic sparkline from the seed. Stable across PnL sign flips —
  // the stroke colour already conveys direction; reshaping the curve on every
  // zero-cross made the row visually jitter on scalping symbols.
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) % 2147483647;
  }
  const rnd = (() => {
    let n = (s % 1000) / 1000 || 0.37;
    return () => {
      n = (n * 9301 + 49297) % 233280;
      return n / 233280;
    };
  })();
  const out: number[] = [];
  let v = 30;
  for (let i = 0; i < 14; i++) {
    v += (rnd() - 0.5) * 5;
    out.push(v);
  }
  return out;
}

// ─────────────────────── Top Performer ───────────────────────

function TopPerformerCard({
  strategies,
  realizedToday,
}: {
  strategies: AccountStrategy[];
  realizedToday: number;
}) {
  const formatCurrency = useCurrencyFormatter();
  const top = strategies.find((s) => s.status === 'LIVE') ?? strategies[0];

  if (!top) {
    return (
      <div
        data-theme="dark"
        className="mm"
        style={{
          padding: '22px 24px',
          background: 'linear-gradient(180deg, #171B22 0%, #11151B 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          className="mm-chip"
          style={{
            background: 'rgba(22,179,100,0.18)',
            color: '#5FCB8B',
            marginBottom: 4,
            fontWeight: 500,
            alignSelf: 'flex-start',
          }}
        >
          <Zap size={11} strokeWidth={2} /> Start with a strategy
        </div>
        <div className="mm-display" style={{ fontSize: 22, color: 'var(--mm-ink-0)' }}>
          No strategies yet
        </div>
        <p style={{ fontSize: 13, color: 'var(--mm-ink-2)' }}>
          Add a bot to start trading automatically.
        </p>
        <Link
          href="/strategies"
          className="mm-btn mm-btn-mint"
          style={{ marginTop: 'auto', textAlign: 'center' }}
        >
          Browse strategies
        </Link>
      </div>
    );
  }

  const allocation = top.capitalAllocationPct ?? 0;
  const isUp = realizedToday >= 0;

  return (
    <div
      data-theme="dark"
      className="mm"
      style={{
        padding: '22px 24px',
        position: 'relative',
        overflow: 'hidden',
        // Pinned dark gradient — the "Top performer" card stays a premium
        // dark panel even in light mode, matching the design pack's
        // perf-card. Children inherit dark mm-* tokens via data-theme="dark".
        background: 'linear-gradient(180deg, #171B22 0%, #11151B 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 14 }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            className="mm-chip"
            style={{
              background: 'var(--mm-mint-soft)',
              color: 'var(--mm-mint)',
              marginBottom: 12,
              fontWeight: 500,
            }}
          >
            <Zap size={11} strokeWidth={2} /> Top performer
          </div>
          <div
            className="mm-display"
            style={{ fontSize: 24, letterSpacing: '-0.02em', color: 'var(--mm-ink-0)' }}
          >
            {top.strategyCode}
          </div>
          <div style={{ fontSize: 13, color: 'var(--mm-ink-2)', marginTop: 4 }}>
            {top.symbol} · {top.interval}
          </div>
        </div>
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'var(--mm-mint-soft)',
            color: 'var(--mm-mint)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Zap size={22} strokeWidth={1.7} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 20 }}>
        <span
          className="mm-num"
          style={{
            fontSize: 36,
            color: isUp ? 'var(--mm-mint)' : 'var(--mm-dn)',
          }}
        >
          {formatCurrency(realizedToday, { withSign: true })}
        </span>
        <span style={{ fontSize: 13, color: 'var(--mm-ink-2)' }}>today</span>
      </div>

      <div style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--mm-ink-2)',
            marginBottom: 6,
          }}
        >
          <span>Allocation</span>
          <span className="mm-num" style={{ color: 'var(--mm-ink-1)' }}>
            {allocation.toFixed(0)}%
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--mm-hair)' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, allocation)}%`,
              borderRadius: 999,
              background: 'linear-gradient(90deg, var(--mm-mint), var(--mm-mint-2))',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 18 }}>
        <Link
          href={`/strategies/${top.id}`}
          className="mm-btn mm-btn-mint"
          style={{ flex: 1, textAlign: 'center', padding: '10px' }}
        >
          Tune settings
        </Link>
        <Link href={`/strategies/${top.id}`} className="mm-btn" style={{ padding: '10px 16px' }}>
          Details →
        </Link>
      </div>
    </div>
  );
}
