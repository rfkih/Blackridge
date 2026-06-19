'use client';

import { ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WizardStep = 'config' | 'params' | 'run';

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: 'config', label: 'Config' },
  { id: 'params', label: 'Parameters' },
  { id: 'run', label: 'Run' },
];

interface WizardBreadcrumbProps {
  current: WizardStep;
  /** Called with the clicked step. Implementers decide whether to confirm before navigating backwards. */
  onStepClick?: (step: WizardStep) => void;
  className?: string;
}

export function WizardBreadcrumb({ current, onStepClick, className }: WizardBreadcrumbProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Wizard progress" className={cn('flex items-center gap-1.5', className)}>
      {STEPS.map((step, i) => {
        const isCurrent = i === currentIndex;
        const isDone = i < currentIndex;
        const isFuture = i > currentIndex;
        const clickable = !isFuture && !isCurrent && Boolean(onStepClick);
        return (
          <div key={step.id} className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStepClick?.(step.id) : undefined}
              className={cn(
                'group inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors duration-fast',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                clickable ? 'cursor-pointer hover:bg-bg-hover' : 'cursor-default',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[12px] font-semibold',
                  isCurrent && 'border-profit bg-tint-profit text-profit',
                  isDone && 'border-profit bg-profit text-text-inverse',
                  isFuture && 'border-bd text-text-muted',
                )}
              >
                {isDone ? <Check size={10} strokeWidth={2.5} /> : i + 1}
              </span>
              <span
                className={cn(
                  'label-caps !text-[12px]',
                  isCurrent && '!text-text-primary',
                  isDone && '!text-text-secondary',
                )}
              >
                {step.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight
                size={12}
                strokeWidth={1.75}
                className="text-text-muted"
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
