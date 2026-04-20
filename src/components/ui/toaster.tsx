'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToasts, toast, type Toast } from '@/hooks/useToast';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  default: Info,
} as const;

const COLORS = {
  success: 'var(--color-profit)',
  error: 'var(--color-loss)',
  default: 'var(--color-info)',
} as const;

function ToastItem({ t }: { t: Toast }) {
  const Icon = ICONS[t.variant];
  const color = COLORS[t.variant];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="pointer-events-auto flex w-80 items-start gap-3 rounded-md border p-3 shadow-panel"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border-default)',
      }}
      role="status"
    >
      <Icon size={16} style={{ color }} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {t.title && <p className="text-sm font-medium text-[var(--text-primary)]">{t.title}</p>}
        {t.description && (
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{t.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <X size={12} />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
