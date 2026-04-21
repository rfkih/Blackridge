'use client';

import { useSyncExternalStore } from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
}

type Listener = () => void;

/** Max toasts visible at once — newer ones push older ones out the top. */
const MAX_VISIBLE = 3;
const DEFAULT_DURATION_MS = 4_000;

const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let toasts: Toast[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function clearTimer(id: string) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

function remove(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  clearTimer(id);
  emit();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return toasts;
}

/**
 * SSR must return the same reference every render — a fresh `[]` literal per
 * call makes React's store-hydration bail and log a mismatch warning.
 */
const EMPTY_TOASTS: Toast[] = [];
function getServerSnapshot(): Toast[] {
  return EMPTY_TOASTS;
}

export interface ShowToastInput {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

function show(input: ShowToastInput) {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toast: Toast = {
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? 'default',
  };
  // Push and cap. Drop oldest so the newest always wins attention — a late
  // error toast shouldn't be hidden behind a stale success toast.
  const next = [...toasts, toast];
  while (next.length > MAX_VISIBLE) {
    const dropped = next.shift();
    if (dropped) clearTimer(dropped.id);
  }
  toasts = next;
  emit();

  const duration = input.durationMs ?? DEFAULT_DURATION_MS;
  if (duration > 0 && Number.isFinite(duration)) {
    const timer = setTimeout(() => remove(id), duration);
    timers.set(id, timer);
  }
  return id;
}

type ShortInput = Omit<ShowToastInput, 'variant'> | string;

function normaliseShort(input: ShortInput): Omit<ShowToastInput, 'variant'> {
  return typeof input === 'string' ? { title: input } : input;
}

/**
 * Imperative handle usable outside React (mutations, event handlers, etc.).
 * Accepts either a string (shorthand) or a full ShowToastInput.
 */
export const toast = {
  show,
  success: (input: ShortInput) => show({ ...normaliseShort(input), variant: 'success' }),
  error: (input: ShortInput) => show({ ...normaliseShort(input), variant: 'error' }),
  warning: (input: ShortInput) => show({ ...normaliseShort(input), variant: 'warning' }),
  info: (input: ShortInput) => show({ ...normaliseShort(input), variant: 'info' }),
  dismiss: remove,
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useToast() {
  return toast;
}
