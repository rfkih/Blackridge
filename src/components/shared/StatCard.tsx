'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ValueColor = 'profit' | 'loss' | 'info' | 'warning' | 'neutral';

interface StatCardProps {
  label: string;
  value: string;
  valueColor?: ValueColor;
  sub?: string;
  subColor?: 'profit' | 'loss' | 'neutral';
  icon?: React.ElementType;
  isLoading?: boolean;
  className?: string;
  /** Optional explanatory copy. When provided, the label gets a help
   *  icon and a 2-second-delay tooltip. Implementation drives `open`
   *  manually because Radix's delayDuration silently no-ops on some
   *  trigger types in this codebase — see ParamField for the pattern. */
  help?: React.ReactNode;
}

const VALUE_COLOR_MAP: Record<ValueColor, string> = {
  profit: 'var(--color-profit)',
  loss: 'var(--color-loss)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  neutral: 'var(--text-primary)',
};

const SUB_COLOR_MAP = {
  profit: 'var(--color-profit)',
  loss: 'var(--color-loss)',
  neutral: 'var(--text-muted)',
};

const HOVER_DELAY_MS = 2000;

export function StatCard({
  label,
  value,
  valueColor = 'neutral',
  sub,
  subColor = 'neutral',
  icon: Icon,
  isLoading,
  className,
  help,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-md border border-bd-subtle bg-bg-surface px-4 py-4',
        'transition-colors duration-base ease-out-quart hover:border-bd',
        className,
      )}
    >
      <span aria-hidden="true" className="card-topline" />

      <div className="flex items-center justify-between">
        {help ? (
          <HelpfulLabel label={label} help={help} />
        ) : (
          <span className="label-caps">{label}</span>
        )}
        {Icon && (
          <Icon size={13} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          {sub !== undefined && <Skeleton className="h-3 w-16" />}
        </div>
      ) : (
        <div>
          <span
            className="num block text-[26px] font-semibold leading-none tracking-tighter"
            style={{ color: VALUE_COLOR_MAP[valueColor] }}
          >
            {value}
          </span>
          {sub && (
            <p
              className="num mt-2 text-[11px] leading-none"
              style={{ color: SUB_COLOR_MAP[subColor] }}
            >
              {sub}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Label with a 2-second-delay hover tooltip. Drives Radix's `open` state
 * manually with a setTimeout because the codebase's existing pattern
 * (see {@code ParamField.tsx}) found `delayDuration` unreliable across
 * trigger types. Click also opens the tooltip immediately — useful for
 * touch devices where hover doesn't exist.
 */
function HelpfulLabel({ label, help }: { label: string; help: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    cancelTimer();
    timerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  };

  useEffect(() => () => cancelTimer(), []);

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${label} — explanation`}
            onMouseEnter={startTimer}
            onMouseLeave={() => {
              cancelTimer();
              setOpen(false);
            }}
            onFocus={startTimer}
            onBlur={() => {
              cancelTimer();
              setOpen(false);
            }}
            onClick={(e) => {
              e.preventDefault();
              cancelTimer();
              setOpen((prev) => !prev);
            }}
            className="label-caps inline-flex cursor-help items-center gap-1 bg-transparent p-0 transition-colors hover:text-[var(--text-secondary)]"
          >
            {label}
            <HelpCircle
              size={10}
              strokeWidth={1.75}
              className="text-text-muted"
              aria-hidden="true"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          collisionPadding={8}
          className="max-w-xs bg-bg-elevated text-[11px] leading-relaxed text-text-primary"
        >
          {help}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
