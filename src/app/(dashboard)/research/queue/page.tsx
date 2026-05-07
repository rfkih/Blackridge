'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Inbox,
  Loader2,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  useCancelQueueItem,
  useCreateQueueItem,
  useResearchQueue,
  useUpdateQueuePriority,
} from '@/hooks/useResearchQueue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import { formatDate } from '@/lib/formatters';
import type {
  CreateQueueItemRequest,
  ResearchQueueItem,
  ResearchQueueStatus,
} from '@/types/research-queue';

/**
 * Admin-only research queue manager. Mirrors `queue-strategy.sh` so the
 * operator can schedule sweeps without shell access. Backend is the source
 * of truth — this page only marshals validated payloads.
 */
const STATUS_TABS: Array<{ key: 'ACTIVE' | ResearchQueueStatus; label: string }> = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'RUNNING', label: 'Running' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'PARKED', label: 'Parked' },
];

export default function ResearchQueuePage() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]['key']>('ACTIVE');
  const [creating, setCreating] = useState(false);

  const statusFilter = tab === 'ACTIVE' ? ['PENDING', 'RUNNING'] : [tab];
  const { data: rows = [], isLoading, isError } = useResearchQueue({
    status: statusFilter,
  });

  if (!isAdmin) {
    return (
      <div className="space-y-3 rounded-xl border border-bd-subtle bg-bg-surface p-8 text-center">
        <ShieldCheck size={28} className="mx-auto text-text-muted" />
        <h1 className="font-display text-[20px] font-semibold tracking-tight text-text-primary">
          Admin only
        </h1>
        <p className="text-[13px] text-text-muted">
          The research queue drives token spend and JVM CPU on the research
          host. Sign in with an admin account to manage it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps">RESEARCH · QUEUE</div>
          <h1 className="font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Research queue
          </h1>
          <p className="mt-1 text-[12px] text-text-muted">
            Schedule sweeps for the unattended-research orchestrator. Lower
            priority numbers run sooner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/research"
            className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
          >
            Ops <ChevronRight size={12} />
          </Link>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent-primary)] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[var(--accent-primary)]/90"
          >
            <Plus size={12} /> Queue strategy
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => {
          const selected = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors"
              style={{
                borderColor: selected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                background: selected ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: selected ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <div className="rounded-sm border border-bd-subtle bg-bg-base/40 p-8 text-center text-[12px] text-text-muted">
          Could not load queue. The research JVM may be down.
        </div>
      ) : rows.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <QueueTable rows={rows} />
      )}

      {creating && <NewQueueItemDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────

function QueueTable({ rows }: { rows: ResearchQueueItem[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-bd-subtle">
      <table className="w-full min-w-[820px] text-[11px]">
        <thead>
          <tr className="border-b border-bd-subtle bg-bg-base">
            <Th align="right">Pri</Th>
            <Th>Status</Th>
            <Th>Strategy</Th>
            <Th>Symbol · Int</Th>
            <Th align="right">Iter</Th>
            <Th align="right">Budget</Th>
            <Th>Hypothesis</Th>
            <Th>Created</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <QueueRow key={r.queueId} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueRow({ row }: { row: ResearchQueueItem }) {
  const cancel = useCancelQueueItem();
  const update = useUpdateQueuePriority();
  const [editing, setEditing] = useState(false);
  const [draftPriority, setDraftPriority] = useState(row.priority);

  const isTerminal =
    row.status === 'COMPLETED' || row.status === 'FAILED' || row.status === 'PARKED';

  const handleCancel = () => {
    if (
      !window.confirm(
        `Cancel queue item for ${row.strategyCode} ${row.intervalName}? The orchestrator will skip it on the next tick.`,
      )
    ) {
      return;
    }
    cancel.mutate(row.queueId, {
      onSuccess: () =>
        toast.show({
          title: 'Queue item cancelled',
          description: `${row.strategyCode} ${row.intervalName} marked CANCELLED.`,
          variant: 'success',
        }),
      onError: (err) =>
        toast.error({ title: 'Cancel failed', description: normalizeError(err) }),
    });
  };

  const handleSavePriority = () => {
    if (draftPriority === row.priority) {
      setEditing(false);
      return;
    }
    update.mutate(
      { queueId: row.queueId, payload: { priority: draftPriority } },
      {
        onSuccess: () => {
          setEditing(false);
          toast.show({
            title: 'Priority updated',
            description: `${row.strategyCode} → priority ${draftPriority}`,
            variant: 'success',
          });
        },
        onError: (err) => {
          toast.error({
            title: 'Update failed',
            description: normalizeError(err),
          });
        },
      },
    );
  };

  return (
    <tr className="border-b border-bd-subtle bg-bg-surface last:border-b-0 hover:bg-bg-hover">
      <Td align="right" className="num">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              min={1}
              max={1000}
              value={draftPriority}
              onChange={(e) => setDraftPriority(Number(e.target.value))}
              className="w-16 rounded-sm border border-bd-subtle bg-bg-base px-1.5 py-0.5 text-right font-mono text-[11px] text-text-primary"
            />
            <button
              type="button"
              onClick={handleSavePriority}
              disabled={update.isPending}
              className="rounded-sm border border-bd-default px-1.5 py-0.5 font-mono text-[10px] text-text-secondary hover:bg-bg-hover disabled:opacity-40"
            >
              {update.isPending ? <Loader2 size={10} className="animate-spin" /> : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraftPriority(row.priority);
              }}
              className="rounded-sm border border-bd-subtle px-1 py-0.5 text-text-muted hover:bg-bg-hover"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !isTerminal && setEditing(true)}
            disabled={isTerminal}
            className="rounded-sm font-mono hover:underline disabled:cursor-default disabled:no-underline"
            title={isTerminal ? 'Terminal — priority frozen' : 'Click to edit'}
          >
            {row.priority}
          </button>
        )}
      </Td>
      <Td>
        <StatusBadge status={row.status} verdict={row.finalVerdict} />
      </Td>
      <Td className="font-mono">{row.strategyCode}</Td>
      <Td className="font-mono">
        {row.instrument} <span className="text-text-muted">{row.intervalName}</span>
      </Td>
      <Td align="right" className="num">
        {row.iterationNumber}
      </Td>
      <Td align="right" className="num">
        {row.iterBudget}
      </Td>
      <Td className="max-w-[220px] truncate text-text-secondary" title={row.hypothesis ?? undefined}>
        {row.hypothesis || <span className="text-text-muted">—</span>}
      </Td>
      <Td className="font-mono text-text-muted">
        {row.createdTime ? formatDate(Date.parse(row.createdTime)) : '—'}
      </Td>
      <Td align="right">
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancel.isPending || isTerminal}
          className="rounded-sm border border-bd-default bg-bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
          title={isTerminal ? 'Already terminal' : 'Soft-cancel — preserves audit trail'}
        >
          {cancel.isPending && cancel.variables === row.queueId ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            'Cancel'
          )}
        </button>
      </Td>
    </tr>
  );
}

function StatusBadge({
  status,
  verdict,
}: {
  status: string;
  verdict: string | null;
}) {
  const tone =
    status === 'PENDING'
      ? 'muted'
      : status === 'RUNNING'
        ? 'info'
        : status === 'FAILED'
          ? 'loss'
          : status === 'COMPLETED' && verdict === 'CANCELLED'
            ? 'warning'
            : status === 'COMPLETED'
              ? 'profit'
              : 'muted';
  const label = status === 'COMPLETED' && verdict === 'CANCELLED' ? 'CANCELLED' : status;
  return (
    <span
      className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
      style={{ background: 'rgba(0,0,0,0.25)', color: toneColor(tone) }}
    >
      {label}
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-bd-subtle bg-bg-surface p-10 text-center">
      <Inbox size={28} className="mx-auto text-text-muted" />
      <p className="text-[13px] text-text-muted">
        No queue items in this view. Create one to schedule the next sweep.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent-primary)] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[var(--accent-primary)]/90"
      >
        <Plus size={12} /> Queue strategy
      </button>
    </div>
  );
}

// ── Create dialog ─────────────────────────────────────────────────────────

const SAMPLE_SWEEP =
  '{\n  "params": [\n    { "name": "longRsiMin", "values": [50, 52, 54, 56] }\n  ]\n}';

const INTERVAL_OPTIONS = ['5m', '15m', '1h', '4h'] as const;

function NewQueueItemDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateQueueItem();
  const [strategyCode, setStrategyCode] = useState('');
  const [intervalName, setIntervalName] = useState<string>('1h');
  const [instrument, setInstrument] = useState('BTCUSDT');
  const [hypothesis, setHypothesis] = useState('');
  const [iterBudget, setIterBudget] = useState(4);
  const [priority, setPriority] = useState(100);
  const [earlyStopOnNoEdge, setEarlyStopOnNoEdge] = useState(true);
  const [requireWalkForward, setRequireWalkForward] = useState(true);
  const [sweepConfigText, setSweepConfigText] = useState(SAMPLE_SWEEP);

  const submit = async () => {
    if (!strategyCode.trim()) {
      toast.warning({ title: 'Strategy code required' });
      return;
    }
    if (!intervalName.trim()) {
      toast.warning({ title: 'Interval required' });
      return;
    }
    if (!Number.isFinite(iterBudget) || iterBudget < 1 || iterBudget > 64) {
      toast.warning({ title: 'Iter budget must be 1..64' });
      return;
    }
    let parsedSweep: unknown;
    try {
      parsedSweep = JSON.parse(sweepConfigText);
    } catch {
      toast.warning({
        title: 'Sweep config must be JSON',
        description: 'Expected shape: { "params": [{ "name": "X", "values": [...] }] }',
      });
      return;
    }

    const payload: CreateQueueItemRequest = {
      strategyCode: strategyCode.trim().toUpperCase(),
      intervalName: intervalName.trim(),
      instrument: instrument.trim().toUpperCase() || undefined,
      sweepConfig: parsedSweep,
      hypothesis: hypothesis.trim() || undefined,
      iterBudget,
      priority,
      earlyStopOnNoEdge,
      requireWalkForward,
    };

    try {
      await create.mutateAsync(payload);
      toast.success({
        title: 'Queued',
        description: `${payload.strategyCode} ${payload.intervalName} added to queue.`,
      });
      onClose();
    } catch (err) {
      toast.error({ title: 'Queue failed', description: normalizeError(err) });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Queue strategy for research</DialogTitle>
          <DialogDescription>
            Mirrors <code>queue-strategy.sh</code>. The orchestrator picks rows
            in priority order on its next tick.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Strategy code">
            <input
              type="text"
              value={strategyCode}
              onChange={(e) => setStrategyCode(e.target.value)}
              placeholder="e.g. VCB"
              className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary uppercase placeholder:text-text-muted focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </Field>
          <Field label="Interval">
            <select
              value={intervalName}
              onChange={(e) => setIntervalName(e.target.value)}
              className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Instrument">
            <input
              type="text"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              placeholder="BTCUSDT"
              list="research-instrument-options"
              className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary uppercase placeholder:text-text-muted focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <datalist id="research-instrument-options">
              <option value="BTCUSDT" />
              <option value="ETHUSDT" />
            </datalist>
          </Field>
          <Field label="Iter budget (1..64)">
            <input
              type="number"
              min={1}
              max={64}
              value={iterBudget}
              onChange={(e) => setIterBudget(Number(e.target.value))}
              className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </Field>
          <Field label="Priority (1..1000, lower = sooner)">
            <input
              type="number"
              min={1}
              max={1000}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </Field>
          <Field label="Gates">
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={earlyStopOnNoEdge}
                  onChange={(e) => setEarlyStopOnNoEdge(e.target.checked)}
                />
                Early-stop on NO_EDGE
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={requireWalkForward}
                  onChange={(e) => setRequireWalkForward(e.target.checked)}
                />
                Require walk-forward
              </label>
            </div>
          </Field>
        </div>
        <Field label="Hypothesis (optional, written to journal)">
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            rows={2}
            placeholder="e.g. Loosening longRsiMin from 58 → 50..56 should rescue iter 33 boundary case"
            className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </Field>
        <Field label="Sweep config (JSON)">
          <textarea
            value={sweepConfigText}
            onChange={(e) => setSweepConfigText(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </Field>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--accent-primary)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--accent-primary)]/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {create.isPending && <Loader2 size={11} className="animate-spin" />}
            Queue
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  className = '',
  title,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  title?: string;
}) {
  return (
    <td
      className={`px-2.5 py-1.5 ${className}`}
      style={{ textAlign: align }}
      title={title}
    >
      {children}
    </td>
  );
}

type Tone = 'profit' | 'loss' | 'warning' | 'info' | 'muted';

function toneColor(tone: Tone): string {
  switch (tone) {
    case 'profit':
      return 'var(--color-profit)';
    case 'loss':
      return 'var(--color-loss)';
    case 'warning':
      return 'var(--color-warning)';
    case 'info':
      return 'var(--color-info)';
    default:
      return 'var(--text-muted)';
  }
}
