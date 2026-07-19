'use client';

import { useMemo, useState } from 'react';
import { StatCard } from '@/components/shared/StatCard';
import { EquityPositionsTable } from '@/components/equities/EquityPositionsTable';
import { EquityOrdersTable } from '@/components/equities/EquityOrdersTable';
import { useEquityPositions, useEquityOrders } from '@/hooks/useEquity';
import type { EquityProfile } from '@/types/equity';

const PROFILES: EquityProfile[] = ['PAPER', 'LIVE'];

export default function EquitiesPositionsPage() {
  const [profile, setProfile] = useState<EquityProfile>('PAPER');

  const positionsQuery = useEquityPositions(profile);
  const ordersQuery = useEquityOrders(profile);

  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  // Gross market value = Σ qty · avgPrice (cost-basis; live prices not wired yet)
  const grossMarketValue = useMemo(
    () =>
      positions.reduce((sum, p) => {
        const price = p.avgPrice ?? 0;
        return sum + p.qty * price;
      }, 0),
    [positions],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <section
        className="mm-card"
        style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div className="mm-kicker">EQUITY POSITIONS</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <h1
            className="font-display"
            style={{ fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1 }}
          >
            Positions &amp; Orders
          </h1>

          {/* Profile toggle — PAPER / LIVE read-only switch */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
            {PROFILES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProfile(p)}
                aria-pressed={profile === p}
                className={[
                  'rounded-lg px-3 py-1 text-[13px] font-medium transition-colors',
                  profile === p
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Summary StatCards */}
      <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <StatCard
          label="Positions"
          value={positionsQuery.isLoading ? '…' : String(positions.length)}
          valueColor="neutral"
          isLoading={positionsQuery.isLoading}
        />
        <StatCard
          label="Cost Basis"
          value={
            positionsQuery.isLoading
              ? '…'
              : `$${grossMarketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
          valueColor="info"
          sub="Σ qty · avg price — live mark not wired yet"
          isLoading={positionsQuery.isLoading}
        />
      </section>

      {/* Positions table */}
      <section className="flex flex-col gap-2">
        <h2 className="label-caps px-1 text-[var(--text-muted)]">Positions · {profile}</h2>
        <EquityPositionsTable
          positions={positions}
          isLoading={positionsQuery.isLoading}
          isError={positionsQuery.isError}
          onRetry={() => positionsQuery.refetch()}
        />
      </section>

      {/* Orders table */}
      <section className="flex flex-col gap-2">
        <h2 className="label-caps px-1 text-[var(--text-muted)]">Orders · {profile}</h2>
        <EquityOrdersTable
          orders={orders}
          isLoading={ordersQuery.isLoading}
          isError={ordersQuery.isError}
          onRetry={() => ordersQuery.refetch()}
        />
      </section>
    </div>
  );
}
