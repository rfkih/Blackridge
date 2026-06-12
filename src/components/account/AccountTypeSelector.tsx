import { cn } from '@/lib/utils';
import { ACCOUNT_TYPE_VIEW } from '@/lib/accountType/registry';
import { ACCOUNT_TYPES, type AccountType } from '@/types/accountType';

interface AccountTypeSelectorProps {
  value: AccountType;
  onChange: (type: AccountType) => void;
  disabled?: boolean;
}

/**
 * Segmented toggle over the account types — used by the create-account dialog
 * to pick TRADING vs HEDGING (default TRADING). Account type is immutable post
 * create, so this only ever drives the create path. Presentational + control:
 * it owns no state, reflecting `value` and reporting via `onChange`.
 */
export function AccountTypeSelector({
  value,
  onChange,
  disabled = false,
}: AccountTypeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Account type"
      className="inline-flex rounded-md border border-border bg-muted p-0.5"
    >
      {ACCOUNT_TYPES.map((type) => {
        const view = ACCOUNT_TYPE_VIEW[type];
        const Icon = view.icon;
        const selected = type === value;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => {
              if (disabled || selected) return;
              onChange(type);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={14} strokeWidth={2} aria-hidden />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
