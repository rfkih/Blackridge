'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { ModelInfo } from '@/types/ml';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-bd-subtle pt-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function MetricRow({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-right font-mono text-sm text-text-primary">{value}</span>
      {sub && <span className="text-right text-xs text-text-muted">{sub}</span>}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-text-muted">—</span>;
  const ok = verdict === 'PASS';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${ok ? 'text-profit' : 'text-loss'}`}>
      {ok ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {verdict}
    </span>
  );
}

function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`;
}
function fmt4(v: number | null): string {
  return v === null ? '—' : v.toFixed(4);
}

export function SignalModelCard({ model }: { model: ModelInfo }) {
  const totalGain = Object.values(model.featureImportance).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="space-y-4 rounded-md border border-bd-subtle bg-bg-elevated p-5">
      <h2 className="text-sm font-semibold text-text-primary">Model</h2>

      {/* What it predicts */}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">What it predicts</p>
        <p className="text-sm text-text-secondary">{model.predicts}</p>
        <p className="font-mono text-xs text-text-muted">label: {model.labelFeature}</p>
      </div>

      {/* Training overview */}
      <Section title="Training">
        <div className="divide-y divide-bd-subtle">
          <MetricRow label="Algorithm"     value={model.algorithm} />
          <MetricRow label="Objective"     value={model.objective} />
          <MetricRow label="Trained at"    value={model.trainedAt ? model.trainedAt.slice(0, 10) : '—'} />
          <MetricRow label="Train rows"    value={model.nTrainRows?.toLocaleString() ?? '—'} />
          <MetricRow label="Val rows"      value={model.nValRows?.toLocaleString() ?? '—'} />
          {model.trainStart && model.trainEnd && (
            <MetricRow
              label="Window"
              value={`${model.trainStart.slice(0, 10)} → ${model.trainEnd.slice(0, 10)}`}
            />
          )}
        </div>
      </Section>

      {/* Hold-out metrics */}
      <Section title="Hold-out metrics (final fold)">
        <div className="divide-y divide-bd-subtle">
          <MetricRow label="AUC"           value={fmt4(model.auc)} />
          <MetricRow label="Accuracy"      value={pct(model.accuracy)} />
          <MetricRow label="Log loss"      value={fmt4(model.logLoss)} />
          <MetricRow
            label="Adversarial AUC"
            value={
              <span className={model.adversarialAuc !== null && model.adversarialAuc > 0.90 ? 'text-warning' : ''}>
                {fmt4(model.adversarialAuc)}
              </span>
            }
          />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Adversarial AUC &gt; 0.90 indicates train/val covariate drift (not necessarily a defect, but worth monitoring).
        </p>
      </Section>

      {/* Walk-forward */}
      {model.walkForward && (
        <Section title={`Walk-forward (${model.walkForward.nFolds} folds)`}>
          <div className="divide-y divide-bd-subtle">
            <MetricRow label="Mean AUC"   value={fmt4(model.walkForward.primaryMean)} />
            <MetricRow label="Median AUC" value={fmt4(model.walkForward.primaryMedian)} />
            <MetricRow label="Std AUC"    value={fmt4(model.walkForward.primaryStd)} />
          </div>
          {model.walkForward.primaryStd > 0.10 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="h-3 w-3" />
              High fold variance (std {fmt4(model.walkForward.primaryStd)}) — performance is not stable across time periods.
            </p>
          )}
        </Section>
      )}

      {/* Gauntlet + leakage */}
      <Section title="Quality gates">
        <div className="divide-y divide-bd-subtle">
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-text-muted">Gauntlet</span>
            <VerdictBadge verdict={model.gauntletVerdict} />
          </div>
          {model.gauntletGates.length > 0 && (
            <div className="py-1">
              <p className="text-xs text-text-muted">Gates passed</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {model.gauntletGates.map(g => (
                  <span key={g} className="rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-text-muted">Leakage check</span>
            <VerdictBadge verdict={model.leakageVerdict} />
          </div>
          {model.leakageMaxPearson !== null && (
            <MetricRow label="Max |Pearson| feature↔label" value={model.leakageMaxPearson.toFixed(4)} />
          )}
        </div>
      </Section>

      {/* Feature importance */}
      <Section title={`Feature importance (${model.features.length} features)`}>
        <div className="space-y-1.5">
          {Object.entries(model.featureImportance).map(([name, gain]) => {
            const pctVal = gain / totalGain;
            return (
              <div key={name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-text-secondary">{name}</span>
                  <span className="tabular-nums text-text-secondary">{pct(pctVal)}</span>
                </div>
                <div className="mt-0.5 h-1 rounded-full bg-bg-overlay">
                  <div
                    className="h-1 rounded-full bg-info"
                    style={{ width: `${(pctVal * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Hyperparams */}
      <Section title="Hyperparameters">
        <div className="divide-y divide-bd-subtle">
          {Object.entries(model.hyperparams)
            .filter(([, v]) => v !== null && v !== -1)
            .map(([k, v]) => (
              <MetricRow key={k} label={k} value={String(v)} />
            ))}
        </div>
      </Section>
    </div>
  );
}
