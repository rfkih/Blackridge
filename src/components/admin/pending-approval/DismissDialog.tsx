'use client';

import { useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useDismissPendingApproval } from '@/hooks/usePendingApprovals';
import { useToast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/errorMap';
import type { PendingApproval } from '@/types/pendingApproval';

/** Must match the backend DTO @Size(min=8) on DismissPendingApprovalRequest.reason. */
const MIN_REASON_LEN = 8;

interface DismissDialogProps {
  /** When non-null the dialog is open; the row drives the dismiss mutation. */
  row: PendingApproval | null;
  onOpenChange: (open: boolean) => void;
}

export function DismissDialog({ row, onOpenChange }: DismissDialogProps) {
  const [reason, setReason] = useState('');
  const toast = useToast();
  const dismiss = useDismissPendingApproval();

  const open = row !== null;
  const isValid = reason.trim().length >= MIN_REASON_LEN;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setReason('');
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleCancel = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handleReasonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReason(e.target.value);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!row || !isValid) return;

    dismiss.mutate(
      { id: row.id, request: { reason: reason.trim() } },
      {
        onSuccess: () => {
          toast.success({
            title: 'Dismissed',
            description: `Approval for ${row.strategyCode} / ${row.symbol} dismissed.`,
          });
          handleOpenChange(false);
        },
        onError: (err) => {
          toast.error({
            title: 'Dismiss failed',
            description: normalizeError(err),
          });
        },
      },
    );
  }, [row, isValid, dismiss, reason, toast, handleOpenChange]);

  const shortfall = MIN_REASON_LEN - reason.trim().length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dismiss pending approval</DialogTitle>
          <DialogDescription>
            {row ? `${row.strategyCode} · ${row.symbol} · ${row.interval}` : 'No item selected.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="dismiss-reason">
            Reason{' '}
            <span className="text-text-tertiary font-normal">
              (min {MIN_REASON_LEN} characters)
            </span>
          </Label>
          {/* textarea shadcn component not scaffolded — bare element styled to match <Input /> */}
          <textarea
            id="dismiss-reason"
            rows={4}
            placeholder="Explain why this candidate is being dismissed…"
            value={reason}
            onChange={handleReasonChange}
            className="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {reason.length > 0 && !isValid && (
            <p className="text-danger text-[14px]">
              {shortfall} more character{shortfall === 1 ? '' : 's'} required.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={dismiss.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isValid || dismiss.isPending}
          >
            {dismiss.isPending ? 'Dismissing…' : 'Dismiss'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
