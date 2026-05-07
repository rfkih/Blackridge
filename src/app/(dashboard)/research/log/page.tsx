'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { useSearchResearchLog } from '@/hooks/useResearch';
import { useDebouncedSearchPage } from '@/hooks/useDebouncedSearchPage';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/formatters';

type SortKey =
  | 'createdAt'
  | 'strategyVersion'
  | 'asset'
  | 'tradeCount'
  | 'winRate'
  | 'profitFactor'
  | 'maxDrawdown';

const PAGE_SIZE = 25;

/**
 * Progression view across every completed research run. One row per run,
 * headline metrics flattened. Filters, sort, and pagination are all
 * evaluated backend-side.
 */
export default function ResearchLogPage() {
  const [strategyFilter, setStrategyFilter] = useState('TPR');
  const [assetFilter, setAssetFilter] = useState('');
  const [intervalFilter, setIntervalFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { searchInput, setSearchInput, debouncedSearch, page, setPage } = useDebouncedSearchPage();

  // Reset to page 0 whenever any filter or sort changes.
  useEffect(() => {
    setPage(0);
  }, [strategyFilter, assetFilter, intervalFilter, sortKey, sortDir, setPage]);

  const { data, isLoading, isFetching } = useSearchResearchLog({
    strategyCode: strategyFilter || undefined,
    asset: assetFilter || undefined,
    interval: intervalFilter || undefined,
    search: debouncedSearch || undefined,
    sort: `${sortKey},${sortDir}`,
    page,
    size: PAGE_SIZE,
  });

  const rows = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps">RESEARCH · LOG</div>
          <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Progression
          </h1>
          <p className="mt-1 text-[12px] text-text-muted">
            One row per completed run with an analysis snapshot.
          </p>
        </div>
        {isFetching && !isLoading && <Loader2 size={14} className="animate-spin text-text-muted" />}
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={11}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Search strategy or asset…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="num h-7 w-52 rounded-sm border border-bd-subtle bg-bg-base pl-6 pr-2 text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
          />
        </div>

        <FilterSelect
          label="Strategy"
          value={strategyFilter}
          onChange={setStrategyFilter}
          options={[
            { value: '', label: 'All' },
            { value: 'TPR', label: 'TPR' },
            { value: 'VCB', label: 'VCB' },
            { value: 'LSR', label: 'LSR' },
          ]}
        />

        <input
          type="text"
          placeholder="Asset…"
          value={assetFilter}
          onChange={(e) => {
            setAssetFilter(e.target.value);
            setPage(0);
          }}
          className="num h-7 w-28 rounded-sm border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />

        <FilterSelect
          label="Interval"
          value={intervalFilter}
          onChange={(v) => {
            setIntervalFilter(v);
            setPage(0);
          }}
          options={[
            { value: '', label: 'All' },
            { value: '1m', label: '1m' },
            { value: '5m', label: '5m' },
            { value: '15m', label: '15m' },
            { value: '1h', label: '1h' },
            { value: '4h', label: '4h' },
            { value: '1d', label: '1d' },
          ]}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface p-8 text-center text-sm text-text-muted">
          No completed runs match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead>
                <tr className="border-b border-bd-subtle bg-bg-base">
                  <SortTh
                    label="Version"
                    sortKey="strategyVersion"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortTh
                    label="Created"
                    sortKey="createdAt"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortTh
                    label="Asset"
                    sortKey="asset"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Th>Int</Th>
                  <SortTh
                    label="Trades"
                    sortKey="tradeCount"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <SortTh
                    label="WR"
                    sortKey="winRate"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <SortTh
                    label="PF"
                    sortKey="profitFactor"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th align="right">Avg R</Th>
                  <Th align="right">Net PnL</Th>
                  <SortTh
                    label="Max DD"
                    sortKey="maxDrawdown"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="right"
                  />
                  <Th align="right">Consec L</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const wrColor = row.winRate >= 0.5 ? 'var(--color-profit)' : 'var(--color-loss)';
                  const rColor =
                    row.avgR > 0
                      ? 'var(--color-profit)'
                      : row.avgR < 0
                        ? 'var(--color-loss)'
                        : 'var(--text-muted)';
                  const pnlColor =
                    row.netPnl > 0
                      ? 'var(--color-profit)'
                      : row.netPnl < 0
                        ? 'var(--color-loss)'
                        : 'var(--text-muted)';
                  const pfStr = row.profitFactor == null ? '∞' : row.profitFactor.toFixed(2);
                  return (
                    <tr
                      key={row.runId}
                      className="border-b border-bd-subtle last:border-b-0 hover:bg-bg-hover"
                    >
                      <Td className="font-mono">
                        {row.strategyVersion ?? '—'}
                        <span className="ml-2 text-text-muted">{row.strategyCode}</span>
                      </Td>
                      <Td className="font-mono text-text-muted">
                        {row.createdAt ? formatDate(Date.parse(row.createdAt)) : '—'}
                      </Td>
                      <Td className="font-mono">{row.asset}</Td>
                      <Td className="font-mono text-text-muted">{row.interval}</Td>
                      <Td align="right" className="num">
                        {row.tradeCount}
                      </Td>
                      <Td align="right" className="num" style={{ color: wrColor }}>
                        {(row.winRate * 100).toFixed(1)}%
                      </Td>
                      <Td align="right" className="num">
                        {pfStr}
                      </Td>
                      <Td align="right" className="num" style={{ color: rColor }}>
                        {row.avgR.toFixed(3)}
                      </Td>
                      <Td align="right" className="num" style={{ color: pnlColor }}>
                        {row.netPnl > 0 ? '+' : ''}
                        {row.netPnl.toFixed(2)}
                      </Td>
                      <Td align="right" className="num text-[var(--color-loss)]">
                        {row.maxDrawdown.toFixed(2)}
                      </Td>
                      <Td align="right" className="num">
                        {row.maxConsecutiveLosses}
                      </Td>
                      <Td align="right">
                        <Link
                          href={`/backtest/${row.runId}`}
                          className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent-primary)] hover:underline"
                        >
                          View →
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-text-muted">
          <span>
            {totalElements} run{totalElements !== 1 ? 's' : ''} · page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="label-caps !text-[9px]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="num h-7 rounded-sm border border-bd-subtle bg-bg-base px-2 text-[12px] text-text-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SortTh({
  label,
  sortKey,
  current,
  dir,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  align?: 'right';
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`label-caps cursor-pointer select-none whitespace-nowrap px-3 py-2 !text-[9px] hover:text-text-primary ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${active ? 'text-text-primary' : ''}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active ? (
          dir === 'desc' ? (
            <ChevronDown size={9} />
          ) : (
            <ChevronUp size={9} />
          )
        ) : (
          <ChevronsUpDown size={9} className="opacity-40" />
        )}
      </span>
    </th>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: 'right' }) {
  return (
    <th
      className={`label-caps whitespace-nowrap px-3 py-2 !text-[9px] ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
  style,
}: {
  children: React.ReactNode;
  align?: 'right';
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2 ${
        align === 'right' ? 'text-right tabular-nums' : ''
      } ${className ?? ''}`}
      style={style}
    >
      {children}
    </td>
  );
}
