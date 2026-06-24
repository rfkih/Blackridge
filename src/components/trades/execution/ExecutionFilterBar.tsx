'use client';

import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import type { ExecutionStatusFilter } from '@/lib/api/tradeExecutions';

export interface ExecutionFilterState {
  status: ExecutionStatusFilter;
  symbol: string;
  strategyName: string;
  executionType: 'OPEN' | 'CLOSE' | 'ALL';
  from: string;
  to: string;
}

const STATUS: { key: ExecutionStatusFilter; label: string }[] = [
  { key: 'REAL', label: 'Real' },
  { key: 'SUCCESS', label: 'Success' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'PAPER', label: 'Paper' },
];
const TYPES: { key: 'ALL' | 'OPEN' | 'CLOSE'; label: string }[] = [
  { key: 'ALL', label: 'Open+Close' },
  { key: 'OPEN', label: 'Open' },
  { key: 'CLOSE', label: 'Close' },
];

export function ExecutionFilterBar({
  filters,
  strategyCodes,
  onPatch,
}: {
  filters: ExecutionFilterState;
  strategyCodes: string[];
  onPatch: (patch: Partial<ExecutionFilterState>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onPatch({ status: s.key })}
          className={cn('mm-pill', filters.status === s.key && 'mm-pill-active')}
          style={{ padding: '5px 12px', fontSize: 13 }}
          aria-pressed={filters.status === s.key}
        >
          {s.label}
        </button>
      ))}
      <input
        type="text"
        value={filters.symbol}
        onChange={(e) => onPatch({ symbol: e.target.value.toUpperCase() })}
        placeholder="symbol"
        aria-label="Filter by symbol"
        className="mm-btn"
        style={{
          padding: '5px 10px',
          fontSize: 14,
          width: 110,
          background: 'var(--mm-surface-2)',
          color: 'var(--mm-ink-1)',
        }}
      />
      <select
        aria-label="Filter by strategy"
        value={filters.strategyName}
        onChange={(e) => onPatch({ strategyName: e.target.value })}
        className="mm-btn"
        style={{ fontSize: 14 }}
      >
        <option value="">any strategy</option>
        {strategyCodes.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by execution type"
        value={filters.executionType}
        onChange={(e) =>
          onPatch({ executionType: e.target.value as ExecutionFilterState['executionType'] })
        }
        className="mm-btn"
        style={{ fontSize: 14 }}
      >
        {TYPES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <DatePicker
        id="exec-from"
        value={filters.from}
        onChange={(v) => onPatch({ from: v })}
        placeholder="From"
        clearable
        className="h-7 px-2 py-0 text-[14px]"
      />
      <DatePicker
        id="exec-to"
        value={filters.to}
        onChange={(v) => onPatch({ to: v })}
        placeholder="To"
        clearable
        className="h-7 px-2 py-0 text-[14px]"
      />
    </div>
  );
}
