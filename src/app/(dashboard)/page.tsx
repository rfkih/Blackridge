'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { useOpenTrades, usePnlSummary } from '@/hooks/useTrades';
import { useStrategies } from '@/hooks/useStrategies';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useEquityCurve } from '@/hooks/useEquityCurve';
import { useLivePnl, useSyncOpenPositions } from '@/hooks/useLivePnl';
import { usePositionStore } from '@/store/positionStore';
import { formatPnl, formatPrice } from '@/lib/formatters';
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

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <HeroCard
        firstName={firstName}
        balance={balance}
        changeToday={changeToday}
        changePct={changePct}
        scopeLabel={isAll ? 'All accounts' : (activeAccount?.label ?? '')}
        points={equityCurve.points}
        period={equityCurve.period}
        setPeriod={equityCurve.setPeriod}
      />

      {/* Positions + Insights column */}
      <section
        className="grid gap-5"
        style={{ gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)' }}
      >
        <PositionsPanel trades={openTrades} profitableCount={profitableCount} />
        <div className="flex min-h-0 flex-col gap-4">
          <AtAGlance
            balance={balance}
            activeBots={visibleStrategies.filter((s) => s.status === 'LIVE').length}
            totalBots={visibleStrategies.length}
            winRate={pnlSummary?.winRate ?? 0}
            bestOpen={pickBestOpen(openTrades)}
          />
          <TopPerformerCard strategies={visibleStrategies} realizedToday={realizedToday} />
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

// ─────────────────────── Hero ───────────────────────

interface HeroCardProps {
  firstName: string;
  balance: number;
  changeToday: number;
  changePct: number;
  scopeLabel: string;
  points: EquityPoint[];
  period: ReturnType<typeof useEquityCurve>['period'];
  setPeriod: ReturnType<typeof useEquityCurve>['setPeriod'];
}

function HeroCard({
  firstName,
  balance,
  changeToday,
  changePct,
  scopeLabel,
  points,
  period,
  setPeriod,
}: HeroCardProps) {
  const isUp = changeToday >= 0;
  const chartData = useMemo(() => points.map((p) => p.equity), [points]);

  const [whole, decimals] = splitMoney(balance);
  const now = useMemo(
    () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    [],
  );

  const greeting = timeGreeting();

  return (
    <section
      className="mm-card mm-card-lift"
      style={{
        padding: '36px 40px 32px',
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
        gap: 32,
        alignItems: 'start',
      }}
    >
      <div style={{ position: 'relative', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span className="mm-eyebrow" suppressHydrationWarning>
            {greeting}, {firstName}
          </span>
          <span style={{ color: 'var(--mm-ink-3)' }}>·</span>
          <span
            className="mm-mono"
            style={{
              fontSize: 11,
              color: 'var(--mm-ink-2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <span className="mm-dot" />
            Live · <span suppressHydrationWarning>{now}</span>
          </span>
          {scopeLabel && (
            <>
              <span style={{ color: 'var(--mm-ink-3)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--mm-ink-2)' }}>{scopeLabel}</span>
            </>
          )}
        </div>

        <div
          className="mm-display"
          style={{
            fontSize: 'clamp(64px, 7vw, 104px)',
            lineHeight: 0.92,
            letterSpacing: '-0.04em',
            color: 'var(--mm-ink-0)',
          }}
        >
          ${whole}
          <span
            style={{
              color: 'var(--mm-ink-2)',
              fontSize: 'clamp(36px, 4vw, 56px)',
            }}
          >
            .{decimals}
          </span>
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
          <div
            className="mm-chip"
            style={{
              background: isUp ? 'var(--mm-mint-soft)' : 'var(--mm-dn-soft)',
              color: isUp ? 'var(--mm-mint)' : 'var(--mm-dn)',
              fontFamily: 'var(--mm-sans)',
              fontSize: 13,
              fontWeight: 500,
              padding: '6px 12px',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: isUp ? undefined : 'rotate(180deg)' }}
            >
              <path d="M7 17l5-5 5 5" />
            </svg>
            {isUp ? 'Up' : 'Down'} {formatPnl(Math.abs(changeToday))}
          </div>
          <span style={{ fontSize: 14, color: 'var(--mm-ink-2)' }}>
            {isUp ? '+' : '−'}
            {Math.abs(changePct).toFixed(2)}% today · since this morning
          </span>
        </div>

        <div
          style={{ display: 'flex', gap: 8, marginTop: 26, alignItems: 'center', flexWrap: 'wrap' }}
        >
          {(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const).map((p) => {
            const mapped = mapPeriod(p);
            const active = period === mapped;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(mapped)}
                className={active ? 'mm-pill mm-pill-active' : 'mm-pill'}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'relative', minWidth: 0 }}>
        <BigMintChart
          data={chartData.length ? chartData : fallbackCurve()}
          height={220}
          tag={`$${formatPrice(balance, 2)}`}
        />
      </div>
    </section>
  );
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function splitMoney(n: number): [string, string] {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const whole = `${sign}${Math.floor(abs).toLocaleString()}`;
  const decs = (abs - Math.floor(abs)).toFixed(2).slice(2);
  return [whole, decs];
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

function BigMintChart({ data, height, tag }: { data: number[]; height: number; tag: string }) {
  const width = 560;
  if (!data.length) return null;
  const { min, max } = minMax(data);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / (max - min + 1e-6)) * (height - 20) - 10,
  ]);
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [px, py] = pts[i - 1];
    d += ` Q ${px.toFixed(1)} ${py.toFixed(1)} ${((px + x) / 2).toFixed(1)} ${((py + y) / 2).toFixed(1)}`;
  }
  d += ` T ${pts[pts.length - 1][0].toFixed(1)} ${pts[pts.length - 1][1].toFixed(1)}`;
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height }}
      >
        <defs>
          <linearGradient id="mm-hero-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--mm-mint)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--mm-mint)" stopOpacity="0" />
          </linearGradient>
          <filter id="mm-hero-glow">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <path d={area} fill="url(#mm-hero-area)" />
        <path
          d={d}
          stroke="var(--mm-mint)"
          strokeWidth="5"
          fill="none"
          opacity="0.25"
          filter="url(#mm-hero-glow)"
          strokeLinecap="round"
        />
        <path d={d} stroke="var(--mm-mint)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle
          cx={lx}
          cy={ly}
          r="6"
          fill="var(--mm-bg)"
          stroke="var(--mm-mint)"
          strokeWidth="2.5"
        />
        <line
          x1="0"
          x2={width}
          y1={height - 10}
          y2={height - 10}
          stroke="var(--mm-hair)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: `${((lx / width) * 100).toFixed(1)}%`,
          top: ly - 16,
          transform: 'translate(12px, -100%)',
          background: 'var(--mm-mint)',
          color: 'var(--mm-bg)',
          padding: '4px 10px',
          borderRadius: 8,
          fontFamily: 'var(--mm-num)',
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {tag}
      </div>
    </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((t) => (
            <PositionRow key={t.tradeId} trade={t} />
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

function PositionRow({ trade }: { trade: LivePosition }) {
  // Live WS frames update pnlMap + markMap in the store. Prefer those over
  // the REST snapshot so the row doesn't lag the ticker by ~15s.
  const livePnl = usePositionStore((s) => s.pnlMap[trade.tradeId]);
  const liveMark = usePositionStore((s) => s.markMap[trade.tradeId]);
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
      style={{
        display: 'grid',
        gridTemplateColumns: '44px minmax(0, 1.3fr) 120px minmax(0, 1fr) minmax(0, 1fr)',
        gap: 16,
        alignItems: 'center',
        padding: '12px 16px',
        borderRadius: 16,
        background: 'var(--mm-surface-2)',
        border: '1px solid var(--mm-hair)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: softBg,
          color,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--mm-display)',
          fontSize: 18,
          fontWeight: 600,
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
          {value != null ? `$${formatPrice(value, 2)}` : '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--mm-ink-3)', marginTop: 2 }}>value</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="mm-num" style={{ fontSize: 16, fontWeight: 500, color }}>
          {isUp ? '+' : '−'}${formatPrice(Math.abs(pnl), 2)}
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

// ─────────────────────── At a glance ───────────────────────

function AtAGlance({
  balance,
  activeBots,
  totalBots,
  winRate,
  bestOpen,
}: {
  balance: number;
  activeBots: number;
  totalBots: number;
  winRate: number;
  bestOpen: { symbol: string; pct: number } | null;
}) {
  const stats: Array<{
    label: string;
    value: string;
    sub?: string;
    tone?: 'mint' | 'warn' | 'neutral';
  }> = [
    { label: 'Buying power', value: `$${formatPrice(balance, 0)}` },
    bestOpen
      ? {
          label: 'Best today',
          value: bestOpen.symbol.replace(/USDT$/, ''),
          sub: `${bestOpen.pct >= 0 ? '+' : ''}${bestOpen.pct.toFixed(2)}%`,
          tone: 'mint',
        }
      : { label: 'Best today', value: '—' },
    { label: 'Active bots', value: String(activeBots), sub: `of ${totalBots}` },
    {
      label: 'Win rate · 30d',
      value: `${winRate.toFixed(0)}%`,
      sub: winRate >= 50 ? 'above 50%' : 'below 50%',
      tone: winRate >= 50 ? 'mint' : 'warn',
    },
  ];

  const toneColor = (t?: 'mint' | 'warn' | 'neutral') => {
    if (t === 'mint') return 'var(--mm-mint)';
    if (t === 'warn') return 'var(--mm-warn)';
    return 'var(--mm-ink-0)';
  };

  return (
    <div className="mm-card" style={{ padding: '22px 24px' }}>
      <div
        className="mm-display"
        style={{ fontSize: 22, marginBottom: 16, color: 'var(--mm-ink-0)' }}
      >
        At a glance
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          rowGap: 18,
          columnGap: 14,
        }}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 12, color: 'var(--mm-ink-2)' }}>{s.label}</div>
            <div
              className="mm-num"
              style={{ fontSize: 22, marginTop: 4, color: toneColor(s.tone) }}
            >
              {s.value}
            </div>
            {s.sub && (
              <div style={{ fontSize: 11, color: 'var(--mm-ink-3)', marginTop: 2 }}>{s.sub}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────── Top Performer ───────────────────────

function TopPerformerCard({
  strategies,
  realizedToday,
}: {
  strategies: AccountStrategy[];
  realizedToday: number;
}) {
  const top = strategies.find((s) => s.status === 'LIVE') ?? strategies[0];

  if (!top) {
    return (
      <div
        className="mm-card"
        style={{
          padding: '22px 24px',
          background: 'linear-gradient(135deg, var(--mm-surface) 0%, var(--mm-surface-2) 100%)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          className="mm-chip"
          style={{
            background: 'var(--mm-mint-soft)',
            color: 'var(--mm-mint)',
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
      className="mm-card"
      style={{
        padding: '22px 24px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--mm-surface) 0%, var(--mm-surface-2) 100%)',
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
          {isUp ? '+' : '−'}${formatPrice(Math.abs(realizedToday), 0)}
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
