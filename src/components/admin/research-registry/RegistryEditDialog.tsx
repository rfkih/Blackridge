'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ResearchRegistryEntry } from '@/types/research';
import type { RegistryWriteInput } from '@/lib/api/researchRegistry';

const TIERS = ['TIER_A', 'TIER_B', 'TIER_C'];
const VERDICTS = [
  'REAL_LEAD', 'REAL_UNCERTIFIABLE', 'BETA_NOT_ALPHA', 'DATA_GATED',
  'PARKED', 'FALSIFIED', 'FALSIFIED_OOS', 'EXHAUSTED',
];
const STATUSES = ['LIVE', 'LEAD', 'PARKED', 'DATA_GATED', 'FALSIFIED'];

interface FormState {
  slug: string;
  rank: string;
  promise_tier: string;
  display_name: string;
  signal_family: string;
  strategy_code: string;
  symbol: string;
  interval_name: string;
  verdict_tag: string;
  lifecycle_status: string;
  thesis: string;
  detail: string;
  memory_ref: string;
  evidence_iteration_id: string;
  evidence_walk_forward_id: string;
  evidence_backtest_run_id: string;
  journal_id: string;
  is_offline_lead: boolean;
}

const EMPTY: FormState = {
  slug: '', rank: '', promise_tier: 'TIER_A', display_name: '', signal_family: '',
  strategy_code: '', symbol: '', interval_name: '', verdict_tag: 'REAL_LEAD',
  lifecycle_status: 'LEAD', thesis: '', detail: '', memory_ref: '',
  evidence_iteration_id: '', evidence_walk_forward_id: '', evidence_backtest_run_id: '',
  journal_id: '', is_offline_lead: false,
};

function fromEntry(e: ResearchRegistryEntry): FormState {
  return {
    slug: e.slug,
    rank: e.rank == null ? '' : String(e.rank),
    promise_tier: e.promiseTier,
    display_name: e.displayName,
    signal_family: e.signalFamily ?? '',
    strategy_code: e.strategyCode ?? '',
    symbol: e.symbol ?? '',
    interval_name: e.intervalName ?? '',
    verdict_tag: e.verdictTag,
    lifecycle_status: e.lifecycleStatus,
    thesis: e.thesis,
    detail: e.detail ?? '',
    memory_ref: e.memoryRef ?? '',
    evidence_iteration_id: e.evidence.iterationId ?? '',
    evidence_walk_forward_id: e.evidence.walkForwardId ?? '',
    evidence_backtest_run_id: e.evidence.backtestRunId ?? '',
    journal_id: e.evidence.journalId ?? '',
    is_offline_lead: e.isOfflineLead,
  };
}

/** Empty optional string -> null; trimmed otherwise. */
function s(v: string): string | null {
  const t = v.trim();
  return t === '' ? null : t;
}

function buildBody(f: FormState): RegistryWriteInput {
  return {
    slug: f.slug.trim(),
    rank: f.rank.trim() === '' ? null : Number(f.rank),
    promise_tier: f.promise_tier,
    display_name: f.display_name.trim(),
    signal_family: s(f.signal_family),
    strategy_code: s(f.strategy_code),
    symbol: s(f.symbol),
    interval_name: s(f.interval_name),
    verdict_tag: f.verdict_tag,
    lifecycle_status: f.lifecycle_status,
    thesis: f.thesis.trim(),
    detail: s(f.detail),
    memory_ref: s(f.memory_ref),
    evidence_iteration_id: s(f.evidence_iteration_id),
    evidence_walk_forward_id: s(f.evidence_walk_forward_id),
    evidence_backtest_run_id: s(f.evidence_backtest_run_id),
    journal_id: s(f.journal_id),
    is_offline_lead: f.is_offline_lead,
  };
}

const labelCls = 'mb-1 block text-[12px] uppercase tracking-widest text-text-muted';
const inputCls =
  'h-8 w-full rounded-sm border border-bd-subtle bg-bg-base px-2 font-mono text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function RegistryEditDialog({
  mode,
  entry,
  open,
  saving,
  errorMessage,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit';
  entry: ResearchRegistryEntry | null;
  open: boolean;
  saving: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSave: (body: RegistryWriteInput) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(mode === 'edit' && entry ? fromEntry(entry) : EMPTY);
  }, [open, mode, entry]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const valid =
    form.slug.trim() !== '' && form.display_name.trim() !== '' && form.thesis.trim() !== '';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-bd-default bg-bg-surface text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {mode === 'create' ? 'Add registry entry' : `Edit · ${entry?.displayName ?? ''}`}
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Curated editorial layer. Live metrics (DSR / walk-forward / return) are joined
            automatically from the orchestrator by strategy code + symbol + interval.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Slug *">
            <input
              className={inputCls}
              value={form.slug}
              disabled={mode === 'edit'}
              placeholder="top-trader-lsr-fade"
              onChange={(e) => set('slug', e.target.value)}
            />
          </Field>
          <Field label="Rank">
            <input
              className={inputCls}
              value={form.rank}
              inputMode="numeric"
              placeholder="1"
              onChange={(e) => set('rank', e.target.value)}
            />
          </Field>
          <Field label="Display name *">
            <input
              className={inputCls}
              value={form.display_name}
              onChange={(e) => set('display_name', e.target.value)}
            />
          </Field>
          <Field label="Signal family">
            <input
              className={inputCls}
              value={form.signal_family}
              placeholder="positioning / trend / vrp …"
              onChange={(e) => set('signal_family', e.target.value)}
            />
          </Field>
          <Field label="Promise tier">
            <select
              className={inputCls}
              value={form.promise_tier}
              onChange={(e) => set('promise_tier', e.target.value)}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Lifecycle status">
            <select
              className={inputCls}
              value={form.lifecycle_status}
              onChange={(e) => set('lifecycle_status', e.target.value)}
            >
              {STATUSES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Verdict tag">
            <select
              className={inputCls}
              value={form.verdict_tag}
              onChange={(e) => set('verdict_tag', e.target.value)}
            >
              {VERDICTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Strategy code">
            <input
              className={inputCls}
              value={form.strategy_code}
              placeholder="VRP_BTC (null = offline)"
              onChange={(e) => set('strategy_code', e.target.value)}
            />
          </Field>
          <Field label="Symbol">
            <input
              className={inputCls}
              value={form.symbol}
              placeholder="BTCUSDT"
              onChange={(e) => set('symbol', e.target.value)}
            />
          </Field>
          <Field label="Interval">
            <input
              className={inputCls}
              value={form.interval_name}
              placeholder="1d"
              onChange={(e) => set('interval_name', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Thesis * (one line)">
          <input
            className={inputCls}
            value={form.thesis}
            onChange={(e) => set('thesis', e.target.value)}
          />
        </Field>
        <Field label="Detail (the nuance — evidence, why it passes/fails)">
          <textarea
            className={`${inputCls} h-28 resize-y py-1.5 leading-relaxed`}
            value={form.detail}
            onChange={(e) => set('detail', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Memory ref">
            <input
              className={inputCls}
              value={form.memory_ref}
              placeholder="project_…"
              onChange={(e) => set('memory_ref', e.target.value)}
            />
          </Field>
          <label className="flex items-end gap-2 pb-1.5 text-[14px] text-text-secondary">
            <input
              type="checkbox"
              checked={form.is_offline_lead}
              onChange={(e) => set('is_offline_lead', e.target.checked)}
            />
            Offline lead (never ran through the orchestrator)
          </label>
          <Field label="Evidence · iteration id">
            <input
              className={inputCls}
              value={form.evidence_iteration_id}
              onChange={(e) => set('evidence_iteration_id', e.target.value)}
            />
          </Field>
          <Field label="Evidence · walk-forward id">
            <input
              className={inputCls}
              value={form.evidence_walk_forward_id}
              onChange={(e) => set('evidence_walk_forward_id', e.target.value)}
            />
          </Field>
          <Field label="Evidence · backtest run id">
            <input
              className={inputCls}
              value={form.evidence_backtest_run_id}
              onChange={(e) => set('evidence_backtest_run_id', e.target.value)}
            />
          </Field>
          <Field label="Journal id">
            <input
              className={inputCls}
              value={form.journal_id}
              onChange={(e) => set('journal_id', e.target.value)}
            />
          </Field>
        </div>

        {errorMessage && (
          <p className="text-[14px]" style={{ color: 'var(--color-loss)' }}>
            {errorMessage}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onSave(buildBody(form))} disabled={!valid || saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
