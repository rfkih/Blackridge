'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Loader2, ShieldCheck, TrendingUp } from 'lucide-react';
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
import { usePortfolio } from '@/hooks/usePortfolio';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import type {
  MinNotionalApplyErrorDetails,
  MinNotionalViolation,
  PortfolioOptimizer,
  RebalanceResponse,
} from '@/types/portfolioRebalance';

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

/**
 * Extract the orchestrator's structured 422 envelope for the
 * {@code below_min_notional_floor} guard. Returns null for any other
 * error shape so the caller falls back to the generic toast path.
 *
 * <p>Shape matches the orchestrator's {@code OrchestratorError}
 * serialiser in {@code errors.py} -- both the trading-JVM proxy
 * (ResearchOrchestratorProxyController) and the orchestrator itself
 * preserve the body verbatim, so axios sees the same envelope.
 */
function extractMinNotionalError(
  err: unknown,
): { message: string; details: MinNotionalApplyErrorDetails } | null {
  if (!axios.isAxiosError(err)) return null;
  const body = err.response?.data as
    | { error_code?: string; message?: string; details?: MinNotionalApplyErrorDetails }
    | undefined;
  if (body?.error_code !== 'below_min_notional_floor') return null;
  if (!body.details || !Array.isArray(body.details.violations)) return null;
  return {
    message: body.message ?? 'Apply refused: projected entries below floor.',
    details: body.details,
  };
}

export function RebalanceDialog({ open, onOpenChange, accountId }: RebalanceDialogProps) {
  const [optimizer, setOptimizer] = useState<PortfolioOptimizer>('HRP');
  const [preview, setPreview] = useState<RebalanceResponse | null>(null);
  const [applyError, setApplyError] = useState<{
    message: string;
    details: MinNotionalApplyErrorDetails;
  } | null>(null);
  const mutation = useRebalancePortfolio();
  // FREE USDT (NOT total equity) is read at submission time and re-
  // read on Apply so a stale preview can't be committed against a
  // moved balance. The JVM executor sizes LONG entries against the
  // per-asset free balance (Portfolio.balance), so the orchestrator's
  // min-notional guard must compare against the same number --
  // passing totalUsdt here would overstate the executor's sizing
  // surface by the locked-USDT fraction. Phase A.6 also has the
  // orchestrator re-read this value from the trading JVM directly
  // (and Kelly per row), so the caller-provided number is a fallback
  // / cross-check rather than the source of truth. The guard refuses
  // when available_usdt × cap_alloc × kelly × weight < $8.40 at the
  // pinned defaults.
  const { data: portfolio } = usePortfolio();
  const availableUsdt = portfolio?.availableUsdt ?? 0;

  /**
   * Invalidate any cached preview when the operator switches the
   * active account mid-dialog (via the top-bar AccountSwitcher).
   * Without this guard, a Preview shown for account A could be Applied
   * against account B's id -- the request body would use the fresh
   * accountId prop while the visible diff still describes A.
   */
  useEffect(() => {
    setPreview(null);
    setApplyError(null);
    mutation.reset();
    // mutation.reset is stable from the hook; intentionally only depend
    // on accountId so a re-render with a fresh mutation object does
    // not nuke an in-flight preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  function reset() {
    setOptimizer('HRP');
    setPreview(null);
    setApplyError(null);
    mutation.reset();
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handlePreview() {
    setApplyError(null);
    mutation.mutate(
      {
        account_id: accountId,
        available_usdt: availableUsdt,
        optimizer,
        dry_run: true,
      },
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
    setApplyError(null);
    mutation.mutate(
      {
        account_id: accountId,
        available_usdt: availableUsdt,
        optimizer,
        dry_run: false,
      },
      {
        onSuccess: (response) => {
          toast.success({
            title: 'Rebalance applied',
            description: `${response.n_updated} row${response.n_updated === 1 ? '' : 's'} updated · journal ${response.journal_id?.slice(0, 8) ?? '—'}`,
          });
          handleClose(false);
        },
        onError: (err) => {
          // Below-min-notional refusal renders inline; the dialog
          // stays open with the preview visible so the operator can
          // adjust without losing context. Other errors fall through
          // to the generic toast path.
          const guardErr = extractMinNotionalError(err);
          if (guardErr) {
            setApplyError(guardErr);
            return;
          }
          toast.error({
            title: 'Apply failed',
            description: normalizeError(err),
          });
        },
      },
    );
  }

  const busy = mutation.isPending;
  const canSubmit = availableUsdt > 0;

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
                // Both preview AND any stale apply-error get cleared --
                // the previously refused weights are no longer the
                // ones the operator is proposing, so leaving the error
                // panel up would misrepresent the new optimizer choice.
                setPreview(null);
                setApplyError(null);
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

          {!canSubmit && (
            <div
              className="rounded-md border px-3 py-2 text-[11px]"
              style={{
                borderColor: 'rgba(245,158,11,0.35)',
                backgroundColor: 'rgba(245,158,11,0.08)',
                color: 'var(--color-warning)',
              }}
            >
              Available USDT is loading or zero. Preview is disabled until the portfolio balance
              resolves.
            </div>
          )}

          {preview && <PreviewPanel response={preview} />}

          {applyError && <ApplyErrorPanel error={applyError} />}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
            Cancel
          </Button>
          {!preview ? (
            <Button onClick={handlePreview} disabled={busy || !canSubmit} className="gap-1.5">
              {busy && <Loader2 size={12} className="animate-spin" />}
              Preview
            </Button>
          ) : (
            <Button
              onClick={handleApply}
              disabled={busy || preview.codes.length === 0 || !canSubmit}
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
  const violations = response.diagnostics.below_min_notional ?? [];

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

      {violations.length > 0 && (
        <MinNotionalWarningPanel
          violations={violations}
          availableUsdt={response.diagnostics.available_usdt}
          floorUsd={response.diagnostics.effective_floor_usd}
          availableUsdtSource={response.diagnostics.available_usdt_source}
          kellySource={response.diagnostics.kelly_source}
          kind="preview"
        />
      )}

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

/**
 * Inline-rendered apply-time refusal. Shown when the orchestrator
 * returns HTTP 422 {@code below_min_notional_floor} -- the dialog
 * stays open with the preview visible so the operator can adjust
 * cap_alloc / account equity / strategy count and re-preview without
 * losing the diff context.
 */
function ApplyErrorPanel({
  error,
}: {
  error: { message: string; details: MinNotionalApplyErrorDetails };
}) {
  return (
    <MinNotionalWarningPanel
      violations={error.details.violations}
      availableUsdt={error.details.available_usdt}
      floorUsd={error.details.effective_floor_usd}
      availableUsdtSource={error.details.available_usdt_source}
      kellySource={error.details.kelly_source}
      kind="apply-refused"
      message={error.message}
    />
  );
}

/**
 * Shared warning panel for the two surfaces that need it: Preview
 * (informational -- "you'll hit this if you Apply") and Apply error
 * (terminal -- "we refused; here's why"). Same data, slightly
 * different framing.
 */
function MinNotionalWarningPanel({
  violations,
  availableUsdt,
  floorUsd,
  availableUsdtSource,
  kellySource,
  kind,
  message,
}: {
  violations: MinNotionalViolation[];
  availableUsdt?: number;
  floorUsd?: number;
  /** Phase A.6: where the available USDT figure came from. */
  availableUsdtSource?: 'trading_jvm' | 'caller_provided';
  /** Phase A.6: live JVM read vs fallback assumption. */
  kellySource?: 'trading_jvm' | 'fallback_kelly=1.0';
  kind: 'preview' | 'apply-refused';
  message?: string;
}) {
  const isRefused = kind === 'apply-refused';
  const borderColor = isRefused ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.35)';
  const bgColor = isRefused ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
  const tintColor = isRefused ? 'var(--color-loss)' : 'var(--color-warning)';

  return (
    <div className="rounded-md border p-2.5" style={{ borderColor, backgroundColor: bgColor }}>
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={14}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0"
          style={{ color: tintColor }}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-[11px] font-semibold" style={{ color: tintColor }}>
            {isRefused
              ? `Apply refused — ${violations.length} strategy row${violations.length === 1 ? '' : 's'} below min-notional`
              : `Warning — ${violations.length} strategy row${violations.length === 1 ? '' : 's'} would land below min-notional`}
          </p>
          {message && <p className="mt-1 text-[10px] text-text-secondary">{message}</p>}
          {!message && (
            <p className="mt-1 text-[10px] text-text-secondary">
              The JVM executor silently rejects orders below this floor; the flagged strategies
              would carry their post-rebalance weight on the dashboard but never enter trades.
            </p>
          )}

          <table className="mt-2 w-full">
            <thead>
              <tr className="border-b border-bd-subtle">
                {['Code', 'Symbol', 'Weight', 'Cap%', 'Projected', 'Floor', 'Short'].map((col) => (
                  <th
                    key={col}
                    className="label-caps whitespace-nowrap px-2 py-1 text-left text-[9px]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => (
                <tr
                  key={`${v.strategy_code}-${v.symbol}`}
                  className="border-b border-bd-subtle last:border-b-0"
                >
                  <td className="px-2 py-1 font-mono text-[10px] font-semibold">
                    {v.strategy_code}
                  </td>
                  <td className="px-2 py-1 font-mono text-[10px] text-text-secondary">
                    {v.symbol}
                  </td>
                  <td className="num px-2 py-1 font-mono text-[10px] tabular-nums">
                    {(v.weight * 100).toFixed(2)}%
                  </td>
                  <td className="num px-2 py-1 font-mono text-[10px] tabular-nums text-text-secondary">
                    {v.capital_allocation_pct.toFixed(1)}%
                  </td>
                  <td
                    className="num px-2 py-1 font-mono text-[10px] tabular-nums"
                    style={{ color: tintColor }}
                  >
                    ${v.projected_entry_usd.toFixed(2)}
                  </td>
                  <td className="num px-2 py-1 font-mono text-[10px] tabular-nums text-text-muted">
                    ${v.floor_usd.toFixed(2)}
                  </td>
                  <td
                    className="num px-2 py-1 font-mono text-[10px] tabular-nums"
                    style={{ color: tintColor }}
                  >
                    {v.shortfall_usd != null ? `−$${v.shortfall_usd.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 font-mono text-[9px] text-text-muted">
            available=${availableUsdt?.toFixed(2) ?? '—'}
            {availableUsdtSource && (
              <> ({availableUsdtSource === 'trading_jvm' ? 'live' : 'caller-provided'})</>
            )}
            · floor=${floorUsd?.toFixed(2) ?? '—'} · kelly={' '}
            {kellySource === 'trading_jvm'
              ? 'live (per-row)'
              : kellySource === 'fallback_kelly=1.0'
                ? '1.0 (fallback)'
                : '1.0 (assumed)'}
          </div>
        </div>
      </div>
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
