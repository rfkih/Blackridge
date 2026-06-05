'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccountTypeBadge } from './AccountTypeBadge';
import { SwitchAccountTypeDialog } from './SwitchAccountTypeDialog';
import type { AccountSummary } from '@/types/account';

/**
 * Account-type badge plus a "Change type" affordance that opens the guarded
 * TRADING<->HEDGING switch dialog. The badge alone is read-only; this adds the
 * switch entry point next to it.
 */
export function AccountTypeControl({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <AccountTypeBadge type={account.accountType} />
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-[var(--text-secondary)]"
        onClick={() => setOpen(true)}
      >
        Change type
      </Button>
      <SwitchAccountTypeDialog account={account} open={open} onOpenChange={setOpen} />
    </div>
  );
}
