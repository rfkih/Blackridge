'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
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
import { useRevokeSymbolApproval } from '@/hooks/useSymbolApprovals';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import type { SymbolApproval } from '@/types/symbolApproval';

/**
 * Revoke a symbol-strategy approval. Reason is required — the audit row
 * is durable, so we capture *why* up front rather than letting the
 * operator click through. Mirrors the deprecation pattern on
 * {@code /admin/strategies}. Revoke is reversible (re-approve creates a
 * new active row).
 */
interface RevokeApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: SymbolApproval | null;
}

export function RevokeApprovalDialog({
  open,
  onOpenChange,
  approval,
}: RevokeApprovalDialogProps) {
  const [reason, setReason] = useState('');
  const revoke = useRevokeSymbolApproval();

  useEffect(() => {
    if (open) {
      setReason('');
      revoke.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!approval) return null;

  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !revoke.isPending;

  async function handleSubmit() {
    if (!approval || !canSubmit) return;
    try {
      await revoke.mutateAsync({ id: approval.id, payload: { reason: trimmed } });
      toast.success({
        title: 'Approval revoked',
        description: `${approval.symbol} · ${approval.strategyCode}`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error({ title: 'Could not revoke', description: normalizeError(err) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !revoke.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-sm border-bd-subtle bg-bg-surface">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <AlertTriangle size={14} className="text-[var(--color-loss)]" />
            Revoke approval
          </DialogTitle>
          <DialogDescription className="text-[14px] text-text-secondary">
            Revoking{' '}
            <span className="font-mono text-text-primary">
              {approval.symbol} · {approval.strategyCode}
            </span>{' '}
            removes it from the New Strategy picker. Existing live strategies are not affected.
            Reversible — re-approve any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label className="label-caps !text-[12px]">Reason</Label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. CAGR floor raised, this combo no longer clears"
            maxLength={500}
            rows={3}
            autoFocus
            className="flex w-full rounded-md border border-bd bg-bg-base px-3 py-2 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {reason.length > 0 && trimmed.length === 0 && (
            <p className="text-[12px] text-[var(--color-warning)]">Reason cannot be blank.</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={revoke.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-[var(--color-loss)] hover:opacity-90"
          >
            {revoke.isPending && <Loader2 size={12} className="mr-1.5 animate-spin" />}
            Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
