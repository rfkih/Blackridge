import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FieldRowProps {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function FieldRow({ label, error, hint, className, children }: FieldRowProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] text-[var(--color-loss)]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
