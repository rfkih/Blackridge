'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, Plus, X } from 'lucide-react';
import { useCreateSweep, useListSweeps, useStrategyDefaults } from '@/hooks/useResearch';
import { useStrategies } from '@/hooks/useStrategies';
import { useStrategyDefinitions } from '@/hooks/useStrategyDefinitions';
import type { AccountStrategy } from '@/types/strategy';
import type { SweepState } from '@/types/research';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import { formatDate } from '@/lib/formatters';
import type { SweepSpec } from '@/types/research';

/**
 * Sweep list + create form.
 *
 * <p>Sweeps run server-side on a single-thread executor; the list poll
 * picks up progress as combos finish. Clicking a row goes to the
 * per-sweep leaderboard.
 */
export default function ResearchSweepsPage() {
  const router = useRouter();
  const sweeps = useListSweeps();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps">RESEARCH · SWEEPS</div>
          <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Parameter sweeps
          </h1>
          <p className="mt-1 text-[12px] text-text-muted">
            Define a grid of TPR params → run all combos → rank by outcome.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent-primary)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--accent-primary)]/90"
        >
          {formOpen ? <X size={12} /> : <Plus size={12} />}
          {formOpen ? 'Cancel' : 'New sweep'}
        </button>
      </header>

      {formOpen && (
        <NewSweepForm
          onSubmitted={(sweepId) => {
            setFormOpen(false);
            router.push(`/research/sweeps/${sweepId}`);
          }}
        />
      )}

      {sweeps.isLoading ? (
        <Skeleton className="h-60 w-full" />
      ) : !sweeps.data || sweeps.data.length === 0 ? (
        <div className="rounded-md border border-bd-subtle bg-bg-surface p-8 text-center text-sm text-text-muted">
          No sweeps yet. Click “New sweep” to start one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
          <table className="w-full min-w-[800px] text-[12px]">
            <thead>
              <tr className="border-b border-bd-subtle bg-bg-elevated">
                <Th>Created</Th>
                <Th>Strategy</Th>
                <Th>Symbol · Int</Th>
                <Th align="right">Combos</Th>
                <Th align="right">Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {sweeps.data.map((s: SweepState) => {
                const progress =
                  s.totalCombos > 0 ? Math.round((s.finishedCombos / s.totalCombos) * 100) : 0;
                return (
                  <tr key={s.sweepId} className="border-b border-bd-subtle last:border-b-0">
                    <Td className="font-mono text-text-muted">
                      {s.createdAt ? formatDate(Date.parse(s.createdAt)) : '—'}
                    </Td>
                    <Td className="font-mono">{s.spec.strategyCode}</Td>
                    <Td className="font-mono">
                      {s.spec.asset}
                      <span className="ml-1 text-text-muted">{s.spec.interval}</span>
                    </Td>
                    <Td align="right" className="num">
                      {s.finishedCombos}/{s.totalCombos}
                      {s.status === 'RUNNING' && (
                        <span className="ml-2 text-text-muted">· {progress}%</span>
                      )}
                    </Td>
                    <Td align="right">
                      <StatusPill status={s.status} />
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/research/sweeps/${s.sweepId}`}
                        className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent-primary)] hover:underline"
                      >
                        Open →
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; fg: string }> = {
    PENDING: { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' },
    RUNNING: { bg: 'rgba(78,158,255,0.15)', fg: 'var(--color-info)' },
    COMPLETED: { bg: 'rgba(0,200,150,0.15)', fg: 'var(--color-profit)' },
    FAILED: { bg: 'rgba(255,77,106,0.15)', fg: 'var(--color-loss)' },
    CANCELLED: { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' },
  };
  const c = cfg[status] ?? cfg.PENDING;
  return (
    <span
      className="font-mono text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: c.bg, color: c.fg, padding: '2px 8px', borderRadius: 4 }}
    >
      {status}
    </span>
  );
}

// ─── New-sweep form ─────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const ONE_YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

interface GridEntry {
  key: string;
  values: string; // comma-separated, parsed to number[] on submit
}

/** Strategies whose backend param service consumes BacktestParamOverrideContext.
 *  Kept in sync with the backend's ResearchSweepService#RESEARCH_CAPABLE_CODES. */
const RESEARCHABLE_CODES = new Set(['TPR', 'VCB', 'LSR']);

/** Curated starter dimensions per strategy. Each entry's value list is built
 *  at runtime as 3 candidates around the param's actual default (default ±15%).
 *  Keeps TPR-only keys out of VCB/LSR sweeps and tracks backend default
 *  changes automatically. */
const STARTER_KEYS_BY_CODE: Record<string, string[]> = {
  TPR: ['adxEntryMin', 'clvMin'],
  VCB: ['adxEntryMax', 'relVolBreakoutMin'],
  LSR: ['adxEntryMin', 'longSweepRsiMin'],
};

function gridEqual(a: GridEntry[], b: GridEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].key !== b[i].key) return false;
    if (a[i].values !== b[i].values) return false;
  }
  return true;
}

/** Build a 3-candidate value list centered on a param's default value:
 *  [default × 0.85, default, default × 1.15], rounded to a sensible
 *  precision based on magnitude. Returns a comma-separated string for the
 *  free-text values input. */
function deriveValuesFromDefault(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0, 0.5, 1';
  const abs = Math.abs(value);
  const decimals = abs >= 50 ? 0 : abs >= 5 ? 1 : abs >= 1 ? 2 : 3;
  const lo = (value * 0.85).toFixed(decimals);
  const mid = value.toFixed(decimals);
  const hi = (value * 1.15).toFixed(decimals);
  return `${lo}, ${mid}, ${hi}`;
}

function formatDefault(v: number): string {
  const abs = Math.abs(v);
  const decimals = abs >= 50 ? 0 : abs >= 5 ? 1 : abs >= 1 ? 2 : 3;
  return v.toFixed(decimals);
}

function NewSweepForm({ onSubmitted }: { onSubmitted: (sweepId: string) => void }) {
  // Only show AccountStrategy rows whose strategyCode is (a) ACTIVE in the
  // StrategyDefinition catalogue and (b) research-capable on the backend.
  const strategiesQ = useStrategies();
  const definitionsQ = useStrategyDefinitions();
  const activeDefCodes = new Set(
    (definitionsQ.data ?? [])
      .filter((d) => (d.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE')
      .map((d) => d.strategyCode),
  );
  const eligibleStrategies: AccountStrategy[] = (strategiesQ.data ?? []).filter(
    (s) => activeDefCodes.has(s.strategyCode) && RESEARCHABLE_CODES.has(s.strategyCode),
  );
  const [asset, setAsset] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1h');
  const [fromDate, setFromDate] = useState(ONE_YEAR_AGO);
  const [toDate, setToDate] = useState(TODAY);
  const [initialCapital, setInitialCapital] = useState('10000');
  const [label, setLabel] = useState('');
  const [accountStrategyId, setAccountStrategyId] = useState<string>('');
  const [rankMetric, setRankMetric] =
    useState<NonNullable<SweepSpec['rankMetric']>>('avgR');
  const [grid, setGrid] = useState<GridEntry[]>([]);

  const selectedStrategy = eligibleStrategies.find((s) => s.id === accountStrategyId);
  const selectedCode = selectedStrategy?.strategyCode ?? null;
  const defaultsQ = useStrategyDefaults(selectedCode);
  const defaults = defaultsQ.data ?? {};
  const availableKeys = Object.keys(defaults).sort();

  // Auto-build the starter grid for the selected strategy, with each row's
  // candidate values derived from the actual default value of that key.
  // Only auto-rebuilds when the form is empty or matches the previous auto
  // state, so manual edits survive a strategy switch.
  const prevAutoRef = useRef<GridEntry[] | null>(null);
  useEffect(() => {
    if (!selectedCode || !defaultsQ.data) return;
    const starters = STARTER_KEYS_BY_CODE[selectedCode] ?? [];
    const built: GridEntry[] = starters
      .filter((k) => Number.isFinite(defaults[k]))
      .map((k) => ({ key: k, values: deriveValuesFromDefault(defaults[k]) }));

    const formIsEmpty = grid.length === 0;
    const matchesPrevAuto =
      prevAutoRef.current && gridEqual(grid, prevAutoRef.current);

    if (formIsEmpty || matchesPrevAuto) {
      setGrid(built);
      prevAutoRef.current = built;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode, defaultsQ.data]);

  const create = useCreateSweep();

  const totalCombos = grid.reduce((acc, g) => {
    const n = g.values.split(',').filter((v) => v.trim().length > 0).length;
    return acc * Math.max(1, n);
  }, 1);

  const onSubmit = async () => {
    if (!accountStrategyId) {
      toast.error({ title: 'Pick an account strategy' });
      return;
    }
    const selected = eligibleStrategies.find((s) => s.id === accountStrategyId);
    if (!selected) {
      toast.error({ title: 'Selected account strategy is not in the eligible list' });
      return;
    }
    const paramGrid: Record<string, number[]> = {};
    for (const g of grid) {
      const key = g.key.trim();
      if (!key) continue;
      const values = g.values
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v));
      if (values.length === 0) continue;
      paramGrid[key] = values;
    }
    if (Object.keys(paramGrid).length === 0) {
      toast.error({ title: 'Grid must have at least one varied key' });
      return;
    }

    const spec: SweepSpec = {
      strategyCode: selected.strategyCode,
      accountStrategyId,
      asset,
      interval,
      fromDate: `${fromDate}T00:00:00`,
      toDate: `${toDate}T00:00:00`,
      initialCapital: Number(initialCapital),
      label: label || undefined,
      paramGrid,
      rankMetric,
    };

    try {
      const state = await create.mutateAsync(spec);
      toast.success({
        title: 'Sweep started',
        description: `${state.totalCombos} combos queued`,
      });
      onSubmitted(state.sweepId);
    } catch (err) {
      toast.error({ title: 'Could not start sweep', description: normalizeError(err) });
    }
  };

  return (
    <section className="space-y-4 rounded-md border border-bd-subtle bg-bg-surface p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Asset">
          <input
            className="mm-input"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          />
        </Field>
        <Field label="Interval">
          <input
            className="mm-input"
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
          />
        </Field>
        <Field label="Account strategy (registered + researchable)">
          <select
            className="mm-input"
            value={accountStrategyId}
            onChange={(e) => setAccountStrategyId(e.target.value)}
          >
            <option value="">— pick one —</option>
            {eligibleStrategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.strategyCode} · {s.symbol} {s.interval}
                {s.presetName ? ` · ${s.presetName}` : ''}
              </option>
            ))}
          </select>
          {eligibleStrategies.length === 0 && (
            <span className="mt-1 text-[11px] text-[var(--color-warning)]">
              No eligible strategies. Need an AccountStrategy whose code is both
              ACTIVE in /admin/strategies and research-capable (TPR today).
            </span>
          )}
        </Field>
        <Field label="From date">
          <DatePicker value={fromDate} onChange={setFromDate} />
        </Field>
        <Field label="To date">
          <DatePicker value={toDate} onChange={setToDate} />
        </Field>
        <Field label="Initial capital (USDT)">
          <input
            className="mm-input"
            type="number"
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
          />
        </Field>
        <Field label="Rank metric">
          <select
            className="mm-input"
            value={rankMetric}
            onChange={(e) =>
              setRankMetric(e.target.value as NonNullable<SweepSpec['rankMetric']>)
            }
          >
            <option value="avgR">avg R</option>
            <option value="profitFactor">profit factor</option>
            <option value="netPnl">net PnL</option>
            <option value="winRate">win rate</option>
          </select>
        </Field>
        <Field label="Label (optional)">
          <input
            className="mm-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. adx-sweep-1"
          />
        </Field>
      </div>

      <div>
        <div className="label-caps">Param grid</div>
        <p className="text-[11px] text-text-muted">
          One row per varied parameter. Values comma-separated. The server expands the
          cross-product. Cap: 64 combos.
        </p>
        <div className="mt-2 space-y-2">
          {grid.map((g, idx) => {
            const usedElsewhere = new Set(
              grid.filter((_, i) => i !== idx).map((x) => x.key).filter(Boolean),
            );
            const def = Number.isFinite(defaults[g.key]) ? defaults[g.key] : null;
            return (
              <div key={idx} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <div className="flex flex-col">
                  <select
                    className="mm-input font-mono"
                    value={g.key}
                    disabled={!selectedCode || availableKeys.length === 0}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      const dv = Number.isFinite(defaults[newKey])
                        ? defaults[newKey]
                        : null;
                      setGrid((prev) =>
                        prev.map((x, i) => {
                          if (i !== idx) return x;
                          if (dv != null) {
                            return { key: newKey, values: deriveValuesFromDefault(dv) };
                          }
                          return { ...x, key: newKey };
                        }),
                      );
                    }}
                  >
                    <option value="">— pick param —</option>
                    {availableKeys
                      .filter((k) => !usedElsewhere.has(k) || k === g.key)
                      .map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                  </select>
                  {def != null && (
                    <span className="mt-0.5 font-mono text-[10px] text-text-muted">
                      default {formatDefault(def)}
                    </span>
                  )}
                </div>
                <input
                  className="mm-input font-mono"
                  value={g.values}
                  onChange={(e) =>
                    setGrid((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, values: e.target.value } : x)),
                    )
                  }
                  placeholder="comma-separated values"
                />
                <button
                  type="button"
                  onClick={() => setGrid((prev) => prev.filter((_, i) => i !== idx))}
                  className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 text-[12px] text-text-secondary hover:bg-bg-hover"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!selectedCode || defaultsQ.isLoading}
          onClick={() => setGrid((prev) => [...prev, { key: '', values: '' }])}
          className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1 text-[11px] text-text-secondary hover:bg-bg-hover disabled:opacity-50"
        >
          <Plus size={12} /> Add param
        </button>
        {selectedCode && defaultsQ.isLoading && (
          <div className="mt-2 text-[11px] text-text-muted">
            Loading {selectedCode} defaults…
          </div>
        )}
        {selectedCode && defaultsQ.isError && (
          <div className="mt-2 text-[11px] text-[var(--color-loss)]">
            Could not load defaults for {selectedCode}.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-bd-subtle pt-3">
        <div className="text-[12px] text-text-muted">
          Total combos: <span className="font-mono text-text-primary">{totalCombos}</span>
          {totalCombos > 64 && (
            <span className="ml-2 text-[var(--color-loss)]">exceeds 64 cap</span>
          )}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={create.isPending || totalCombos > 64}
          className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent-primary)] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-60"
        >
          {create.isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Start sweep
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-caps">{label}</span>
      {children}
    </label>
  );
}

// ─── Table primitives ───────────────────────────────────────────────────────

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
