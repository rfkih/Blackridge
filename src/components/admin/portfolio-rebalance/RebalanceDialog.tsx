'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRebalancePortfolio } from '@/hooks/usePortfolioRebalance';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type { PortfolioOptimizer, RebalanceResponse } from '@/types/portfolioRebalance';

/**
 * Two-step portfolio-rebalance dialog: <strong>Preview</strong> calls
 * the orchestrator with {@code dry_run: true}, renders the proposed
 * weight diff plus diagnostics, then <strong>Apply</strong> commits.
 *
 * <p>Preview is required before Apply so the operator always sees the
 * numbers before they go live -- mirrors the pattern the symbol-approval
 * 422 inline render uses (no toast on failure, dialog stays open with
 * the form preserved).
 */

interface RebalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Account whose book to rebalance. REQUIRED -- the orchestrator
   * rejects rebalance requests without it (multi-tenancy boundary).
   * Caller (Section) gates the entry-point button on a non-null value.
   */
  accountId: string;
}

export function RebalanceDialog({ open, onOpenChange, accountId }: RebalanceDialogProps) {
  const [optimizer, setOptimizer] = useState<PortfolioOptimizer>('HRP');
  const [preview, setPreview] = useState<RebalanceResponse | null>(null);
  const mutation = useRebalancePortfolio();

  /**
   * Invalidate any cached preview when the operator switches the
   * active account mid-dialog (via the top-bar AccountSwitcher).
   * Without this guard, a Preview shown for account A could be Applied
   * against account B's id -- the request body would use the fresh
   * accountId prop while the visible diff still describes A.
   */
  useEffect(() => {
    setPreview(null);
    mutation.reset();
    // mutation.reset is stable from the hook; intentionally only depend
    // on accountId so a re-render with a fresh mutation object does
    // not nuke an in-flight preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  function reset() {
    setOptimizer('HRP');
    setPreview(null);
    mutation.reset();
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handlePreview() {
    mutation.mutate(
      { account_id: accountId, optimizer, dry_run: true },
      {
        onSuccess: (response) => setPreview(response),
        onError: (err) => {
          toast.error({
            title: 'Preview failed',
            description: normalizeError(err),
          });
        },
      },
    );
  }

  function handleApply() {
    mutation.mutate(
      { account_id: accountId, optimizer, dry_run: false },
      {
        onSuccess: (response) => {
          toast.success({
            title: 'Rebalance applied',
            description: `${response.n_updated} row${response.n_updated === 1 ? '' : 's'} updated · journal ${response.journal_id?.slice(0, 8) ?? '—'}`,
          });
          handleClose(false);
        },
        onError: (err) => {
          toast.error({
            title: 'Apply failed',
            description: normalizeError(err),
          });
        },
      },
    );
  }

  const busy = mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp size={16} strokeWidth={1.75} />
            Portfolio rebalance
          </DialogTitle>
          <DialogDescription>
            Compute new <span className="font-mono">portfolio_weight</span> per live AccountStrategy
            row from the protected book&rsquo;s recent backtest daily returns. Preview first, then
            apply.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="optimizer">Optimizer</Label>
            <Select
              value={optimizer}
              onValueChange={(v) => {
                setOptimizer(v as PortfolioOptimizer);
                setPreview(null);
              }}
              disabled={busy}
            >
              <SelectTrigger id="optimizer" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HRP">
                  HRP &mdash; hierarchical risk parity (recommended)
                </SelectItem>
                <SelectItem value="EQUAL_WEIGHT">EQUAL_WEIGHT &mdash; 1/N baseline</SelectItem>
                <SelectItem value="MEAN_VARIANCE">
                  MEAN_VARIANCE &mdash; classic Markowitz min-variance
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-text-muted">
              HRP is robust to ill-conditioned covariance. MV without a
              <span className="font-mono"> mu </span>vector returns the global minimum-variance
              allocation.
            </p>
          </div>

          {preview && <PreviewPanel response={preview} />}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
            Cancel
          </Button>
          {!preview ? (
            <Button onClick={handlePreview} disabled={busy} className="gap-1.5">
              {busy && <Loader2 size={12} className="animate-spin" />}
              Preview
            </Button>
          ) : (
            <Button
              onClick={handleApply}
              disabled={busy || preview.codes.length === 0}
              className="gap-1.5"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              <ShieldCheck size={12} />
              Apply rebalance
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewPanel({ response }: { response: RebalanceResponse }) {
  const codes = Object.keys({
    ...response.weights_before,
    ...response.weights_after,
  }).sort();
  const skippedCodes = Object.keys(response.skipped);

  if (codes.length === 0) {
    return (
      <div className="rounded-md border border-bd-subtle bg-bg-elevated p-3">
        <p className="text-[12px] text-text-secondary">
          No eligible strategies. {response.diagnostics.reason ?? 'Nothing to rebalance.'}
        </p>
        {skippedCodes.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-[11px] text-text-muted">
            {skippedCodes.map((c) => (
              <li key={c}>
                {c}: {response.skipped[c]}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-bd-subtle bg-bg-elevated">
        <div className="flex items-center justify-between border-b border-bd-subtle px-3 py-2">
          <span className="label-caps">Proposed weights</span>
          <span className="font-mono text-[10px] text-text-muted">
            {response.optimizer} · n_eff={response.summary?.n_effective?.toFixed(2) ?? '—'}
          </span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-bd-subtle">
              {['Code', 'Before', '→', 'After', 'Δ'].map((col) => (
                <th key={col} className="label-caps whitespace-nowrap px-3 py-1.5 text-left">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <WeightDiffRow
                key={c}
                code={c}
                before={response.weights_before[c]}
                after={response.weights_after[c]}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-text-muted">
        <DiagChip label="clamped low" value={response.diagnostics.n_clamped_low ?? 0} />
        <DiagChip label="clamped high" value={response.diagnostics.n_clamped_high ?? 0} />
        <DiagChip label="renorm" value={response.diagnostics.renorm_factor ?? 1} digits={4} />
      </div>

      {skippedCodes.length > 0 && (
        <div className="rounded-md border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] p-2.5">
          <p className="text-[11px] font-semibold text-[var(--color-warning)]">
            Skipped {skippedCodes.length}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-[10px] text-text-secondary">
            {skippedCodes.map((c) => (
              <li key={c}>
                {c}: {response.skipped[c]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function WeightDiffRow({ code, before, after }: { code: string; before?: number; after?: number }) {
  const delta = (after ?? 0) - (before ?? 0);
  const deltaCls =
    delta > 0.0001
      ? 'text-[var(--color-profit)]'
      : delta < -0.0001
        ? 'text-[var(--color-loss)]'
        : 'text-text-muted';
  return (
    <tr className="border-b border-bd-subtle last:border-b-0">
      <td className="px-3 py-1.5 font-mono text-[11px] font-semibold text-text-primary">{code}</td>
      <td className="num px-3 py-1.5 font-mono text-[11px] tabular-nums text-text-secondary">
        {fmtPct(before)}
      </td>
      <td className="px-3 py-1.5 text-[11px] text-text-muted">→</td>
      <td className="num px-3 py-1.5 font-mono text-[11px] tabular-nums text-text-primary">
        {fmtPct(after)}
      </td>
      <td className={cn('num px-3 py-1.5 font-mono text-[11px] tabular-nums', deltaCls)}>
        {fmtDeltaPct(delta)}
      </td>
    </tr>
  );
}

function DiagChip({ label, value, digits = 0 }: { label: string; value: number; digits?: number }) {
  return (
    <div className="rounded-sm bg-bg-base px-2 py-1">
      <span className="text-text-muted">{label}</span>{' '}
      <span className="text-text-primary">
        {Number.isFinite(value) ? value.toFixed(digits) : '—'}
      </span>
    </div>
  );
}

function fmtPct(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

function fmtDeltaPct(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const s = (v * 100).toFixed(2);
  return `${(v > 0 ? '+' : '') + s}%`;
}
