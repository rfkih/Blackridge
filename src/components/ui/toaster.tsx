'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToasts, toast, type Toast, type ToastVariant } from '@/hooks/useToast';

const ICONS: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  default: Info,
};

/**
 * Variant accent colour. Used for both the icon AND a left border strip so
 * state is visible to users who can't distinguish green from red — rule:
 * colour is never the only cue.
 */
const ACCENTS: Record<ToastVariant, string> = {
  success: 'var(--color-profit)',
  error: 'var(--color-loss)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
  default: 'var(--color-info)',
};

const ROLE_FOR_VARIANT: Record<ToastVariant, 'status' | 'alert'> = {
  success: 'status',
  info: 'status',
  default: 'status',
  warning: 'alert',
  error: 'alert',
};

function ToastItem({ t }: { t: Toast }) {
  const Icon = ICONS[t.variant];
  const accent = ACCENTS[t.variant];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="pointer-events-auto relative flex w-80 items-start gap-3 overflow-hidden rounded-md border p-3 pl-4 shadow-panel"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: accent,
      }}
      role={ROLE_FOR_VARIANT[t.variant]}
      aria-live={t.variant === 'error' || t.variant === 'warning' ? 'assertive' : 'polite'}
    >
      {/* Left accent strip — non-colour cue doubled up with the icon. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
      />
      <Icon size={16} style={{ color: accent }} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {t.title && <p className="text-sm font-medium text-[var(--text-primary)]">{t.title}</p>}
        {t.description && (
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{t.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
