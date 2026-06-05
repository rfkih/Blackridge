'use client';

import { AlertTriangle, ArrowRight, Loader2, PowerOff, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAccountTypeSwitchPreview, useSwitchAccountType } from '@/hooks/useAccounts';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import type { AccountType } from '@/types/accountType';
import type { AccountSummary } from '@/types/account';

interface SwitchAccountTypeDialogProps {
  account: AccountSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function otherType(t: AccountType): AccountType {
  return t === 'TRADING' ? 'HEDGING' : 'TRADING';
}

export function SwitchAccountTypeDialog({ account, open, onOpenChange }: SwitchAccountTypeDialogProps) {
  const target: AccountType | null = account ? otherType(account.accountType) : null;
  const { data: preview, isLoading, isError, error } = useAccountTypeSwitchPreview(
    open && account ? account.id : null,
    open ? target : null,
  );
  const switchMutation = useSwitchAccountType();

  function handleConfirm() {
    if (!account || !target) return;
    switchMutation.mutate(
      { accountId: account.id, target },
      {
        onSuccess: (res) => {
          toast.success({
            title: `Switched to ${res.accountType}`,
            description:
              `${res.strategiesDisabled} disabled · ${res.tradesClosed} position(s) closed · ` +
              `${res.strategiesRestored} restored`,
          });
          onOpenChange(false);
        },
        onError: (e) => {
          toast.error({ title: 'Switch failed', description: normalizeError(e) });
        },
      },
    );
  }

  const disables = preview?.strategiesToDisable ?? [];
  const closes = preview?.openTradesToClose ?? [];
  const restores = preview?.strategiesToRestore ?? [];
  const nothingAffected =
    !isLoading && !isError && disables.length === 0 && closes.length === 0 && restores.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Switch account to {target}
          </DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            {account ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-mono">{account.label || account.id.slice(0, 8)}</span>
                <span className="inline-flex items-center gap-1">
                  {account.accountType}
                  <ArrowRight className="h-3.5 w-3.5" />
                  {target}
                </span>
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking what will change…
            </div>
          )}

          {isError && (
            <div className="rounded-md border border-[var(--border-danger,#7f1d1d)] bg-[var(--bg-danger,#2a1414)] p-3 text-sm text-[var(--text-danger,#fca5a5)]">
              {normalizeError(error)}
            </div>
          )}

          {/* Real-money close warning — most important. */}
          {closes.length > 0 && (
            <div className="rounded-md border border-[#7f1d1d] bg-[#2a1414] p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 font-medium text-[#fca5a5]">
                <AlertTriangle className="h-4 w-4" />
                {closes.length} open position{closes.length > 1 ? 's' : ''} will be closed at market
              </div>
              {preview?.hasLivePositions && (
                <p className="mb-1 text-[#fca5a5]">
                  This executes <strong>real trades on Binance</strong> and cannot be undone.
                </p>
              )}
              <ul className="font-mono text-xs text-[var(--text-secondary)]">
                {closes.map((t) => (
                  <li key={t.tradeId}>
                    {t.side} {t.asset}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {disables.length > 0 && (
            <div className="rounded-md border border-[#78550f] bg-[#241c0d] p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 font-medium text-[#fcd34d]">
                <PowerOff className="h-4 w-4" />
                {disables.length} strateg{disables.length > 1 ? 'ies' : 'y'} will be disabled
              </div>
              <ul className="text-xs text-[var(--text-secondary)]">
                {disables.map((s) => (
                  <li key={s.accountStrategyId}>
                    <span className="font-mono">{s.strategyCode}</span>
                    {s.presetName ? ` — ${s.presetName}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {restores.length > 0 && (
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-muted,#161616)] p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 font-medium text-[var(--text-secondary)]">
                <RotateCcw className="h-4 w-4" />
                {restores.length} previously auto-disabled strateg{restores.length > 1 ? 'ies' : 'y'} will be re-enabled
              </div>
              <ul className="text-xs text-[var(--text-secondary)]">
                {restores.map((s) => (
                  <li key={s.accountStrategyId}>
                    <span className="font-mono">{s.strategyCode}</span>
                    {s.presetName ? ` — ${s.presetName}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {nothingAffected && (
            <p className="text-sm text-[var(--text-secondary)]">
              No strategies or open positions are affected — only the account type changes.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={switchMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant={closes.length > 0 ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isLoading || isError || switchMutation.isPending}
          >
            {switchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Switch to {target}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
