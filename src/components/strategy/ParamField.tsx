'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ParamMeta } from '@/lib/constants';

interface ParamFieldProps {
  name: string;
  meta: ParamMeta;
  value: unknown;
  defaultValue: unknown;
  /** Last value persisted by the backend (before any edits in this session). */
  savedValue?: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

function formatValue(value: unknown, meta: ParamMeta): string {
  if (meta.kind === 'toggle') return value ? 'on' : 'off';
  if (typeof value === 'number') {
    const n = meta.kind === 'integer' ? value.toFixed(0) : value.toString();
    return meta.unit ? `${n} ${meta.unit}` : n;
  }
  return String(value);
}

function isModified(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) > 1e-9;
  }
  return a !== b;
}

export function ParamField({
  name,
  meta,
  value,
  defaultValue,
  savedValue,
  onChange,
  disabled,
}: ParamFieldProps) {
  const id = useId();
  const modifiedFromDefault = useMemo(
    () => isModified(value, defaultValue),
    [value, defaultValue],
  );
  // If savedValue wasn't supplied, treat the default as the saved value.
  const effectiveSaved = savedValue === undefined ? defaultValue : savedValue;
  const savedDiffersFromDefault = useMemo(
    () => savedValue !== undefined && isModified(effectiveSaved, defaultValue),
    [savedValue, effectiveSaved, defaultValue],
  );
  const unsavedEdit = useMemo(
    () => isModified(value, effectiveSaved),
    [value, effectiveSaved],
  );
  const readOnly = disabled || meta.readOnly;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border-l-2 py-2 pl-3 pr-3 transition-colors',
        modifiedFromDefault ? 'border-[var(--color-warning)]' : 'border-transparent',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <label
          htmlFor={id}
          className={cn(
            'truncate text-sm',
            readOnly ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]',
          )}
        >
          {meta.label}
        </label>
        <HelpPopover label={meta.label} description={meta.description} />
        {unsavedEdit && (
          <span
            className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: 'var(--color-warning)' }}
            aria-label="Unsaved change"
            title="Unsaved change from saved value"
          />
        )}
      </div>

      <div className="flex w-[260px] shrink-0 flex-col items-end gap-1">
        <FieldInput
          id={id}
          meta={meta}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          name={name}
        />
        <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--text-muted)]">
          {savedDiffersFromDefault && (
            <span className="text-[var(--color-info)]">
              saved: {formatValue(effectiveSaved, meta)}
            </span>
          )}
          <span>default: {formatValue(defaultValue, meta)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * HelpCircle icon with a tooltip that opens on hover AND click.
 * Radix Tooltip only does hover/focus by default; we control `open` to support
 * click-to-pin behavior that stays open until the user clicks out or leaves.
 */
function HelpPopover({ label, description }: { label: string; description: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!pinned) return undefined;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPinned(false);
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [pinned]);

  return (
    <span ref={containerRef} className="inline-flex">
      <TooltipProvider delayDuration={150}>
        <Tooltip open={open} onOpenChange={(o) => (pinned ? setOpen(true) : setOpen(o))}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${label} help`}
              aria-expanded={open}
              onMouseEnter={() => !pinned && setOpen(true)}
              onMouseLeave={() => !pinned && setOpen(false)}
              onFocus={() => !pinned && setOpen(true)}
              onBlur={() => !pinned && setOpen(false)}
              onClick={(e) => {
                e.preventDefault();
                setPinned((prev) => {
                  const next = !prev;
                  setOpen(next);
                  return next;
                });
              }}
              className="rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            >
              <HelpCircle size={12} />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-xs bg-[var(--bg-overlay)] text-[var(--text-primary)]"
          >
            <p className="text-xs">{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

interface FieldInputProps {
  id: string;
  name: string;
  meta: ParamMeta;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
}

function FieldInput({ id, name, meta, value, onChange, readOnly }: FieldInputProps) {
  if (meta.kind === 'toggle') {
    return (
      <Switch
        id={id}
        checked={Boolean(value)}
        disabled={readOnly}
        onCheckedChange={(v) => onChange(v)}
      />
    );
  }

  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;

  if (meta.kind === 'percent' || meta.kind === 'rmultiple') {
    return (
      <SliderWithNumber
        id={id}
        name={name}
        value={num}
        meta={meta}
        onChange={onChange}
        readOnly={readOnly}
      />
    );
  }

  // integer / decimal
  return (
    <NumberInput
      id={id}
      name={name}
      value={num}
      meta={meta}
      onChange={onChange}
      readOnly={readOnly}
    />
  );
}

function clamp(v: number, min?: number, max?: number): number {
  let next = v;
  if (typeof min === 'number' && next < min) next = min;
  if (typeof max === 'number' && next > max) next = max;
  return next;
}

/** Stacked up/down chevron buttons that replace the ugly native spinner arrows. */
function Stepper({
  onStep,
  disabled,
  disableUp,
  disableDown,
}: {
  onStep: (direction: 1 | -1) => void;
  disabled?: boolean;
  disableUp?: boolean;
  disableDown?: boolean;
}) {
  const btnBase =
    'flex h-1/2 w-full items-center justify-center text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex h-8 w-5 shrink-0 flex-col overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Increment"
        disabled={disabled || disableUp}
        onClick={() => onStep(1)}
        className={cn(btnBase, 'border-b border-[var(--border-subtle)]')}
      >
        <ChevronUp size={10} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Decrement"
        disabled={disabled || disableDown}
        onClick={() => onStep(-1)}
        className={btnBase}
      >
        <ChevronDown size={10} />
      </button>
    </div>
  );
}

function NumberInput({
  id,
  name,
  value,
  meta,
  onChange,
  readOnly,
}: {
  id: string;
  name: string;
  value: number;
  meta: ParamMeta;
  onChange: (value: number) => void;
  readOnly?: boolean;
}) {
  const step = meta.step ?? (meta.kind === 'integer' ? 1 : 0.1);
  const stepValue = (dir: 1 | -1) => {
    const raw = value + dir * step;
    const rounded = meta.kind === 'integer' ? Math.round(raw) : Number(raw.toFixed(6));
    onChange(clamp(rounded, meta.min, meta.max));
  };
  const disableUp = typeof meta.max === 'number' && value >= meta.max;
  const disableDown = typeof meta.min === 'number' && value <= meta.min;
  return (
    <div className="flex items-center gap-1.5">
      <input
        id={id}
        name={name}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={meta.min}
        max={meta.max}
        disabled={readOnly}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return;
          const parsed =
            meta.kind === 'integer' ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        className={cn(
          'no-native-spinners h-8 w-24 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-right font-mono text-sm tabular-nums text-[var(--text-primary)] transition-colors',
          'focus:border-[var(--accent-primary)] focus:outline-none',
          readOnly && 'opacity-60',
        )}
      />
      <Stepper
        onStep={stepValue}
        disabled={readOnly}
        disableUp={disableUp}
        disableDown={disableDown}
      />
      {meta.unit && (
        <span className="w-10 text-left text-[10px] text-[var(--text-muted)]">{meta.unit}</span>
      )}
    </div>
  );
}

function SliderWithNumber({
  id,
  name,
  value,
  meta,
  onChange,
  readOnly,
}: {
  id: string;
  name: string;
  value: number;
  meta: ParamMeta;
  onChange: (value: number) => void;
  readOnly?: boolean;
}) {
  const min = meta.min ?? 0;
  const max = meta.max ?? 1;
  const step = meta.step ?? 0.1;
  return (
    <div className="flex w-full items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={readOnly}
        onChange={(e) => {
          const parsed = Number.parseFloat(e.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded bg-[var(--bg-elevated)] accent-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-labelledby={id}
      />
      <input
        id={id}
        name={name}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        disabled={readOnly}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return;
          const parsed = Number.parseFloat(raw);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        className={cn(
          'no-native-spinners h-8 w-20 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-right font-mono text-sm tabular-nums text-[var(--text-primary)]',
          'focus:border-[var(--accent-primary)] focus:outline-none',
          readOnly && 'opacity-60',
        )}
      />
      {meta.unit && (
        <span className="w-6 text-left text-[10px] text-[var(--text-muted)]">{meta.unit}</span>
      )}
    </div>
  );
}
