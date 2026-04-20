'use client';

import { useSyncExternalStore } from 'react';

export type ToastVariant = 'default' | 'success' | 'error';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let toasts: Toast[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function remove(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return toasts;
}

function getServerSnapshot(): Toast[] {
  return [];
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
  toasts = [...toasts, toast];
  emit();
  const duration = input.durationMs ?? 4000;
  setTimeout(() => remove(id), duration);
  return id;
}

export const toast = {
  show,
  success: (input: Omit<ShowToastInput, 'variant'>) => show({ ...input, variant: 'success' }),
  error: (input: Omit<ShowToastInput, 'variant'>) => show({ ...input, variant: 'error' }),
  dismiss: remove,
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useToast() {
  return toast;
}
