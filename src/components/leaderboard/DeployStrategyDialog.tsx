'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Rocket, Square, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeployStrategy } from '@/hooks/useLeaderboard';
import { useStrategies } from '@/hooks/useStrategies';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { ALLOC_MAX_PCT } from '@/lib/constants';
import type { AccountSummary } from '@/types/account';
import type { LeaderboardEntry } from '@/types/leaderboard';

interface DeployStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LeaderboardEntry | null;
  accounts: AccountSummary[];
  defaultAccountId?: string;
}

/** Conservative default — the user can raise it before committing. */
const DEFAULT_ALLOC_PCT = '5';

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return '—';
  return `${v.toFixed(digits)}%`;
}

export function DeployStrategyDialog({
  open,
  onOpenChange,
  entry,
  accounts,
  defaultAccountId,
}: DeployStrategyDialogProps) {
  const activeAccounts = useMemo(() => accounts.filter((a) => a.active), [accounts]);
  const [accountId, setAccountId] = useState('');
  const [allocPct, setAllocPct] = useState(DEFAULT_ALLOC_PCT);
  const [keepExisting, setKeepExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deployMutation = useDeployStrategy();
  const {
    data: ownedStrategies,
    isError: strategiesError,
    refetch: refetchStrategies,
  } = useStrategies();
  // A definitive list (possibly empty) means the conflict check is trustworthy.
  // Until then we must not let a LIVE deploy silently deactivate an unseen sibling.
  const strategiesKnown = ownedStrategies !== undefined;

  useEffect(() => {
    if (open) {
      const firstActive = activeAccounts[0]?.id ?? '';
      setAccountId(
        defaultAccountId && activeAccounts.some((a) => a.id === defaultAccountId)
          ? defaultAccountId
          : firstActive,
      );
      setAllocPct(DEFAULT_ALLOC_PCT);
      setKeepExisting(false);
      setError(null);
      // Refresh so the conflict check sees current preset state, not a stale cache.
      refetchStrategies();
    }
  }, [open, defaultAccountId, activeAccounts, refetchStrategies]);

  // The enabled preset this deploy would collide with on the chosen account.
  // The backend allows ONE enabled preset per (account, strategy, symbol,
  // interval) and silently deactivates any sibling — LIVE *or* paper (both are
  // enabled=true) — so we surface the choice first.
  const conflict = useMemo(() => {
    if (!entry || !accountId) return null;
    return (
      (ownedStrategies ?? []).find(
        (s) =>
          s.accountId === accountId &&
          s.symbol === entry.symbol &&
          s.strategyCode === entry.strategyCode &&
          s.interval === entry.interval &&
          (s.status === 'LIVE' || s.status === 'PAPER'),
      ) ?? null
    );
  }, [ownedStrategies, accountId, entry]);

  if (!entry) return null;

  const hasConflict = conflict !== null;
  const conflictMode = conflict?.status === 'PAPER' ? 'paper' : 'LIVE';
  // When there's no conflict we always land LIVE. With a conflict the user
  // picks: replace (LIVE, deactivate the sibling) or keep (this one STOPPED).
  const willActivate = !hasConflict || !keepExisting;

  const allocNum = Number(allocPct);
  const allocValid = Number.isFinite(allocNum) && allocNum > 0 && allocNum <= ALLOC_MAX_PCT;
  const canSubmit =
    Boolean(accountId) && allocValid && !deployMutation.isPending && strategiesKnown;

  const handleConfirm = () => {
    if (!canSubmit) return;
    setError(null);
    deployMutation.mutate(
      {
        accountId,
        symbol: entry.symbol,
        strategyCode: entry.strategyCode,
        capitalAllocationPct: allocNum,
        activate: willActivate,
      },
      {
        onSuccess: (created) => {
          toast.success(
            willActivate
              ? {
                  title: `Deployed ${created.strategyCode} on ${created.symbol} — LIVE`,
                  description: hasConflict
                    ? 'Your previous preset was deactivated. Open Strategies to manage it or flip it to paper.'
                    : 'A live preset was created on your account. Open Strategies to manage it or flip it to paper.',
                }
              : {
                  title: `Deployed ${created.strategyCode} on ${created.symbol} — stopped`,
                  description:
                    'Your existing preset keeps running. This one landed stopped — enable it on the Strategies page when ready.',
                },
          );
          onOpenChange(false);
        },
        onError: (err) => {
          const message = normalizeError(err);
          // Replace fails server-side when the existing preset has open trades
          // (it can't be deactivated). Steer the user to the stopped path.
          if (hasConflict && !keepExisting && /open trade/i.test(message)) {
            setKeepExisting(true);
            setError(
              `${conflict?.presetName ?? 'The existing preset'} has open trades, so it can't be ` +
                'deactivated. Switched to “Keep existing” — deploy this one stopped, or close those ' +
                'trades first to replace it.',
            );
            return;
          }
          setError(message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Rocket size={18} style={{ color: 'var(--color-profit)' }} />
            Deploy strategy
          </DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            One-click adopt this ranked strategy onto one of your accounts. The interval, direction,
            and winning parameters are replayed from its approved backtest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
          <p className="font-mono text-sm">
            <span className="text-[var(--text-muted)]">Strategy:</span>{' '}
            <span className="text-[var(--text-primary)]">
              {entry.strategyCode} · {entry.symbol} · {entry.interval}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Stat label="CAGR" value={fmtPct(entry.cagrPct)} positive />
            <Stat label="Max drawdown" value={fmtPct(entry.maxDrawdownPct)} negative />
            <Stat label="PSR" value={entry.psr == null ? '—' : entry.psr.toFixed(3)} />
            <Stat label="Trades" value={String(entry.trades)} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
            Account
          </Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              {activeAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label} · {a.exchange}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeAccounts.length === 0 && (
            <p className="text-[12px] text-[var(--color-warning)]">
              No active account to deploy onto. Add or activate an account first.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
            Capital allocation (% of cash)
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={String(ALLOC_MAX_PCT)}
            value={allocPct}
            onChange={(e) => setAllocPct(e.target.value)}
            className="font-mono tabular-nums"
          />
          <p className="text-[12px] text-[var(--text-muted)]">
            Position-size cap as a % of account cash. Default is conservative — raise it if you want
            a larger allocation.
          </p>
          {!allocValid && (
            <p className="text-[12px] text-[var(--color-warning)]">
              Allocation must be between 0.01% and {ALLOC_MAX_PCT}%.
            </p>
          )}
        </div>

        {!strategiesKnown && !strategiesError && (
          <p className="text-[12px] text-[var(--text-muted)]">
            Checking your account for a conflicting preset…
          </p>
        )}
        {!strategiesKnown && strategiesError && (
          <p className="flex items-center justify-between gap-2 rounded border border-[rgba(229,167,77,0.32)] bg-[rgba(229,167,77,0.08)] px-3 py-2 text-xs text-[var(--color-warning)]">
            <span>Couldn’t load your strategies to check for conflicts.</span>
            <button
              type="button"
              onClick={() => refetchStrategies()}
              className="shrink-0 rounded border border-[var(--border-default)] px-2 py-0.5 text-[12px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              Retry
            </button>
          </p>
        )}

        {hasConflict && (
          <div className="space-y-2 rounded-md border border-[rgba(229,167,77,0.32)] bg-[rgba(229,167,77,0.08)] p-3">
            <p className="flex items-start gap-1.5 text-xs text-[var(--color-warning)]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                You already run a {conflictMode} preset for {entry.strategyCode} · {entry.symbol} ·{' '}
                {entry.interval} on this account
                {conflict?.presetName ? ` (“${conflict.presetName}”)` : ''}. Only one can be enabled
                at a time — choose what happens to it.
              </span>
            </p>
            <div className="flex flex-col gap-1.5">
              <ConflictOption
                selected={!keepExisting}
                onClick={() => setKeepExisting(false)}
                title="Replace — run this one LIVE"
                detail="Deactivates the existing preset; this one trades on the next closed candle."
              />
              <ConflictOption
                selected={keepExisting}
                onClick={() => setKeepExisting(true)}
                title="Keep existing — deploy this stopped"
                detail="The existing preset keeps running. This one lands stopped; enable it later on the Strategies page."
              />
            </div>
          </div>
        )}

        {willActivate ? (
          <p className="flex items-start gap-1.5 rounded border border-[rgba(22,179,100,0.32)] bg-[rgba(22,179,100,0.08)] px-3 py-2 text-xs text-[var(--color-profit)]">
            <TrendingUp size={14} className="mt-0.5 shrink-0" />
            <span>
              Deploys straight to LIVE — real Binance orders fire on the next closed candle. You can
              flip it to paper afterwards on the Strategies page.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            <Square size={14} className="mt-0.5 shrink-0" />
            <span>
              Lands stopped — no orders fire. Your existing {conflictMode} preset keeps running.
              Enable this one on the Strategies page whenever you want to switch.
            </span>
          </p>
        )}

        {error && (
          <p className="rounded border border-[rgba(229,72,77,0.3)] bg-[rgba(229,72,77,0.08)] px-3 py-2 text-xs text-[var(--color-loss)]">
            {error}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={deployMutation.isPending}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={
              willActivate
                ? 'rounded-md bg-[var(--color-profit)] px-3 py-1.5 text-xs font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
                : 'rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'
            }
          >
            {deployMutation.isPending
              ? 'Deploying…'
              : willActivate
                ? hasConflict
                  ? 'Replace & Deploy LIVE'
                  : 'Deploy LIVE'
                : 'Deploy stopped'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConflictOption({
  selected,
  onClick,
  title,
  detail,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
        selected
          ? 'border-[var(--color-warning)] bg-[rgba(229,167,77,0.12)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
      }`}
    >
      <span
        className={`mt-0.5 h-3 w-3 shrink-0 rounded-full border ${
          selected
            ? 'border-[var(--color-warning)] bg-[var(--color-warning)]'
            : 'border-[var(--border-default)]'
        }`}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-[var(--text-primary)]">{title}</span>
        <span className="text-[12px] text-[var(--text-muted)]">{detail}</span>
      </span>
    </button>
  );
}

function Stat({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const color = positive
    ? 'var(--color-profit)'
    : negative
      ? 'var(--color-loss)'
      : 'var(--text-primary)';
  return (
    <div>
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
