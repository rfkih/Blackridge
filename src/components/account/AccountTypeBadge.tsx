import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ACCOUNT_TYPE_VIEW } from '@/lib/accountType/registry';
import type { AccountType } from '@/types/accountType';

interface AccountTypeBadgeProps {
  type: AccountType;
  className?: string;
}

/**
 * Small presentational badge for an account's type — the registry's icon +
 * label. Used in the account switcher and account headers so a HEDGING account
 * reads as such at a glance. Purely derived from the view registry; no state.
 */
export function AccountTypeBadge({ type, className }: AccountTypeBadgeProps) {
  const view = ACCOUNT_TYPE_VIEW[type];
  const Icon = view.icon;
  return (
    <Badge variant="secondary" className={cn('gap-1', className)}>
      <Icon size={12} strokeWidth={2} aria-hidden />
      {view.label}
    </Badge>
  );
}
