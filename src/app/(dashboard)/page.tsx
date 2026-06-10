'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  Zap,
  Plus,
  ArrowUpFromLine,
  Bot,
  Shield,
} from 'lucide-react';
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
import { MlHealthStrip } from '@/components/ml/MlHealthStrip';
import { HedgingDashboard } from '@/components/hedging/HedgingDashboard';
import { AccountTypeBadge } from '@/components/account/AccountTypeBadge';
import type { LivePosition } from '@/types/trading';
import type { EquityPoint } from '@/types/market';
import type { AccountSummary } from '@/types/account';

export default function DashboardPage() {
  const { scopedAccountId, isAll, activeAccount, accountsByType, setSelection } =
    useActiveAccount();
  const { user } = useAuth();
  const { data: strategies = [] } = useStrategies();
  const { data: openTrades = [] } = useOpenTrades(scopedAccountId);
  const { data: pnlSummary } = usePnlSummary('today');
  const { data: portfolio } = usePortfolio();
  const equityCurve = useEquityCurve();

  useLivePnl(scopedAccountId);
  useSyncOpenPositions(openTrades);

  const firstName = (user?.name ?? 'Trader').split(' ')[0];

  const balance = portfolio?.totalUsdt ?? 0;
  const availableUsdt = portfolio?.availableUsdt ?? 0;
  const lockedUsdt = portfolio?.lockedUsdt ?? 0;
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

  // Account-type branch: a single HEDGING account active renders the hedging
  // widget set. TRADING and the "All" aggregate keep today's layout unchanged
  // (per-type sectioning of the All view is a later phase). All hooks above run
  // unconditionally, so this guarded early return is Rules-of-Hooks-safe.
  if (!isAll && activeAccount?.accountType === 'HEDGING' && scopedAccountId) {
    return <HedgingDashboard accountId={scopedAccountId} />;
  }

  return (
    <div className="br flex flex-col gap-4">
      {}
      <EmailVerificationBanner />

      {}
      <KillSwitchBanner />

      {}
      <OnboardingPanel />

      {}
      <section
        className="dashboard-hero-row grid gap-4"
        style={{
          gridTemplateColumns:
            'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
        }}
      >
        <CompactBalanceCard
          firstName={firstName}
          balance={balance}
          availableUsdt={availableUsdt}
          lockedUsdt={lockedUsdt}
          changeToday={changeToday}
          changePct={changePct}
          scopeLabel={scopeLabel}
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
          label="Today's P&L"
          value={(changeToday >= 0 ? '+' : '−') + formatAbsCurrency(changeToday)}
          sub={`${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% vs yesterday`}
          tone={changeToday >= 0 ? 'profit' : 'loss'}
          icon={<TrendingUp size={16} strokeWidth={2} />}
        />
        <StatCard
          label="Win rate (30d)"
          value={`${winRate.toFixed(1)}%`}
          sub={`${activeBots} of ${totalBots} strategies live`}
          tone="neutral"
          icon={<Zap size={16} strokeWidth={2} />}
        />
      </section>

      {}
      <section
        className="dashboard-two-col grid gap-4"
        style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}
      >
        <EquityPanel
          balance={balance}
          changeToday={changeToday}
          changePct={changePct}
          points={equityCurve.points}
          period={equityCurve.period}
          setPeriod={equityCurve.setPeriod}
        />
        <PromoTileColumn />
      </section>

      {}
      <QuickActionRow />

      {}
      <PositionsPanel trades={openTrades} profitableCount={profitableCount} />

      {}
      <MlHealthStrip />

      {}
      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}
      >
        <DailyPnlPanel todayPnl={changeToday} />
        <WatchlistPanel />
      </section>

      {}
      {isAll && (accountsByType?.HEDGING.length ?? 0) > 0 && (
        <AllViewHedgingSection
          accounts={accountsByType.HEDGING}
          onOpen={(id) => setSelection?.(id)}
        />
      )}
    </div>
  );
}

/**
 * Additive "All accounts" hedging block. Appended below the trading aggregate
 * only when the user actually owns ≥1 HEDGING account, so a trading-only user
 * sees the dashboard byte-for-byte unchanged.
 *
 * Each card is deliberately minimal: the live BTC/cash allocation read
 * (`useAllocation`/`usePortfolio`) is scoped to the *active* account, not an
 * arbitrary one, so in the "All" aggregate context there is no per-account
 * allocation to show without fabricating it. The card therefore surfaces the
 * account label + type and an "Open" affordance that scopes the active account
 * to it — at which point the full HedgingDashboard (with the real allocation)
 * renders.
 */
function AllViewHedgingSection({
  accounts,
  onOpen,
}: {
  accounts: AccountSummary[];
  onOpen: (accountId: string) => void;
}) {
  return (
    <section className="br flex flex-col gap-3" data-testid="all-view-hedging-section">
      <div className="flex items-baseline justify-between gap-3">
        <h3
          className="font-display"
          style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}
        >
          Hedging accounts
        </h3>
        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {accounts.length} account{accounts.length === 1 ? '' : 's'} · spot allocation
        </span>
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
      >
        {accounts.map((acc) => (
          <button
            key={acc.id}
            type="button"
            onClick={() => onOpen(acc.id)}
            className="br-card transition-all"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: 18,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                className="text-[14px] font-semibold"
                style={{
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {acc.label}
              </div>
              <div className="mt-1">
                <AccountTypeBadge type={acc.accountType} />
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1 text-[13px] font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              Open <ArrowRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function formatAbsCurrency(n: number): string {
  return (
    '$' +
    Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function PromoTileColumn() {
  return (
    <section className="grid gap-4" style={{ gridTemplateRows: '1fr 1fr' }}>
      <PromoTile
        href="/strategies"
        tone="brand"
        eyebrow="New · Just launched"
        title="TPSE strategy is now public"
        cta="Enable on your account"
      />
      <PromoTile
        href="/backtest"
        tone="dark"
        eyebrow="Earn more"
        title="Backtest before you go live"
        cta="Run a backtest"
      />
    </section>
  );
}

interface CompactBalanceCardProps {
  firstName: string;
  balance: number;
  availableUsdt: number;
  lockedUsdt: number;
  changeToday: number;
  changePct: number;
  scopeLabel: string;
}

function CompactBalanceCard({
  balance,
  availableUsdt,
  lockedUsdt,
  changeToday,
  changePct,
  scopeLabel,
}: CompactBalanceCardProps) {
  const formatCurrency = useCurrencyFormatter();
  const isUp = changeToday >= 0;
  const balanceText = formatCurrency(balance);
  const marginUsedPct = balance > 0 ? (lockedUsdt / balance) * 100 : 0;

  return (
    <section
      className="br-balance"
      style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column' }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: 'rgba(255,255,255,0.7)' }}
      >
        Total equity
      </div>
      <div
        className="num"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 44,
          letterSpacing: '-0.025em',
          marginTop: 4,
          lineHeight: 1,
          color: '#fff',
        }}
        title={balanceText}
      >
        {balanceText}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold"
          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
        >
          <ArrowUpRight
            size={12}
            strokeWidth={2.5}
            style={{ transform: isUp ? undefined : 'rotate(90deg)' }}
          />
          {isUp ? '+' : '−'}
          {formatCurrency(Math.abs(changeToday))} ({Math.abs(changePct).toFixed(2)}%) today
        </span>
        {scopeLabel && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{scopeLabel}</span>
        )}
      </div>
      <div
        className="mt-5 flex gap-6 pt-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}
      >
        <BalanceMini label="Available" value={formatCurrency(availableUsdt)} />
        <BalanceMini label="In positions" value={formatCurrency(lockedUsdt)} />
        <BalanceMini label="Margin used" value={`${marginUsedPct.toFixed(1)}%`} />
      </div>
    </section>
  );
}

function BalanceMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'rgba(255,255,255,0.65)' }}
      >
        {label}
      </div>
      <div
        className="num"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 17,
          marginTop: 2,
          color: '#fff',
        }}
      >
        {value}
      </div>
    </div>
  );
}

interface EquityPanelProps {
  balance: number;
  changeToday: number;
  changePct: number;
  points: EquityPoint[];
  period: ReturnType<typeof useEquityCurve>['period'];
  setPeriod: ReturnType<typeof useEquityCurve>['setPeriod'];
}

function EquityPanel({ balance, changeToday, changePct, points, period, setPeriod }: EquityPanelProps) {
  const formatCurrency = useCurrencyFormatter();
  const chartData = useMemo(() => points.map((p) => p.equity), [points]);
  const isUp = changeToday >= 0;

  return (
    <div className="br-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-[12px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--text-muted)' }}
          >
            Account equity
          </div>
          <div
            className="num mt-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 32,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            {formatCurrency(balance)}
          </div>
          <div
            className="num mt-0.5 text-[14px] font-semibold"
            style={{ color: isUp ? 'var(--color-profit)' : 'var(--color-loss)' }}
          >
            {isUp ? '+' : '−'}
            {formatCurrency(Math.abs(changeToday))} ({Math.abs(changePct).toFixed(2)}%) today
          </div>
        </div>

        <div
          className="inline-flex gap-0.5 rounded-[10px] p-1"
          style={{ background: 'var(--bg-hover)' }}
        >
          {(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const).map((p) => {
            const mapped = mapPeriod(p);
            const active = period === mapped;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(mapped)}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors"
                style={{
                  background: active ? 'var(--bg-elevated)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: active ? 'var(--shadow-panel)' : 'none',
                  border: 'none',
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 220 }}>
        <MiniEquityChart
          data={chartData.length ? chartData : fallbackCurve()}
          height={220}
        />
      </div>
    </div>
  );
}

function DailyPnlPanel({ todayPnl }: { todayPnl: number }) {
  const formatCurrency = useCurrencyFormatter();

  return (
    <div className="br-card" style={{ padding: 24 }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3
            className="font-display"
            style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}
          >
            Daily P&amp;L
          </h3>
          <div className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Realized + unrealized · today
          </div>
        </div>
        <div
          className="num text-[14px] font-semibold"
          style={{ color: todayPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
        >
          {todayPnl >= 0 ? '+ ' : '− '}
          {formatCurrency(Math.abs(todayPnl))}
        </div>
      </div>
      <div
        className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-subtle)' }}
      >
        <TrendingUp size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        <div className="text-center">
          <div className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Per-day breakdown coming soon
          </div>
          <div className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Daily P&L history will appear here once the endpoint is available
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchlistPanel() {
  return (
    <div className="br-card" style={{ padding: 24 }}>
      <div className="mb-3 flex items-center justify-between">
        <h3
          className="font-display"
          style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}
        >
          Watchlist
        </h3>
      </div>
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg"
        style={{
          minHeight: 200,
          background: 'var(--bg-elevated)',
          border: '1px dashed var(--border-subtle)',
        }}
      >
        <Zap size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        <div className="text-center px-4">
          <div className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Live market data coming soon
          </div>
          <div className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Real-time prices will appear here once the market data endpoint is wired up
          </div>
        </div>
      </div>
    </div>
  );
}

function PromoTile({
  href,
  tone,
  eyebrow,
  title,
  cta,
}: {
  href: string;
  tone: 'brand' | 'dark' | 'green';
  eyebrow: string;
  title: string;
  cta: string;
}) {
  const toneClass =
    tone === 'brand' ? 'br-promo-brand' : tone === 'dark' ? 'br-promo-dark' : 'br-promo-green';
  return (
    <Link href={href} className={`br-promo br-promo-shape ${toneClass}`}>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ opacity: 0.8 }}>
          {eyebrow}
        </div>
        <h4
          className="mt-1.5 font-display"
          style={{
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            margin: 0,
            color: 'inherit',
          }}
        >
          {title}
        </h4>
      </div>
      <div
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
        style={{ opacity: 0.95 }}
      >
        {cta} <ArrowRight size={14} />
      </div>
    </Link>
  );
}

function QuickActionRow() {
  return (
    <section className="br grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
      <QuickAction
        icon={<Plus size={20} />}
        title="Deposit"
        sub="Fund USDT, BTC, ETH"
        href="/portfolio"
      />
      <QuickAction
        icon={<ArrowUpFromLine size={20} />}
        title="Withdraw"
        sub="To external wallet"
        href="/portfolio"
      />
      <QuickAction
        icon={<Bot size={20} />}
        title="Run strategy"
        sub="Pick from your library"
        href="/strategies"
      />
      <QuickAction
        icon={<Shield size={20} />}
        title="Set limits"
        sub="Per-account risk caps"
        href="/settings"
      />
    </section>
  );
}

function QuickAction({
  icon,
  title,
  sub,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="br-card transition-all"
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        padding: 18,
        textDecoration: 'none',
      }}
    >
      <div
        className="grid place-items-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'var(--brand-50)',
          color: 'var(--brand-700)',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </div>
      </div>
    </Link>
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
  const n = 60;
  const out: number[] = [];
  let v = 100;
  for (let i = 0; i < n; i++) {
    const noise = Math.sin(i / 2.3) * 1.4 + Math.sin(i / 7.1 + 1.2) * 1.9;
    v += Math.sin(i / 5) * 2 + noise;
    out.push(v);
  }
  return out;
}

function MiniEquityChart({
  data,
  height,
  color = 'var(--text-secondary)',
}: {
  data: number[];
  height: number;
  color?: string;
}) {
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
      style={{ display: 'block', width: '100%', height, color }}
    >
      <defs>
        <linearGradient id="br-mini-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#br-mini-area)" />
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const livePnl = usePositionStore((s) => s.pnlMap[trade.tradeId]);
  const liveMark = usePositionStore((s) => s.markMap[trade.tradeId]);
  const formatCurrency = useCurrencyFormatter();
  const pnl = livePnl ?? trade.unrealizedPnl ?? 0;
  const pnlPct = trade.unrealizedPnlPct ?? 0;
  const isUp = pnl >= 0;
  const color = isUp ? 'var(--mm-mint)' : 'var(--mm-dn)';
  const softBg = isUp ? 'var(--mm-mint-soft)' : 'var(--mm-dn-soft)';

  const markPrice = liveMark ?? trade.markPrice ?? null;
  const value = markPrice != null ? markPrice * trade.quantity : null;

  const spark = useMemo(() => buildSpark(trade.tradeId), [trade.tradeId]);

  const logo = trade.symbol.slice(0, 1);
  const displaySym = trade.symbol.replace(/USDT$/, '');

  return (
    <Link
      href={`/trades/${trade.tradeId}`}

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
