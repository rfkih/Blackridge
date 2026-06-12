'use client';

import { Check, AlertTriangle, Clock, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ApprovalStatus } from '@/types/symbolApproval';
import { cn } from '@/lib/utils';

/**
 * Glyph + dot + label for a symbol-strategy approval row. Mirrors the
 * shape of the existing {@code StatusBadge} on {@code /admin/strategies}
 * so the page reads as one cohesive surface. Color alone is never the
 * signal — the glyph carries the meaning for colorblind operators.
 */

interface BadgeMeta {
  icon: LucideIcon;
  label: string;
  bg: string;
  fg: string;
}

const META: Record<ApprovalStatus, BadgeMeta> = {
  approved: { icon: Check, label: 'approved', bg: 'var(--tint-profit)', fg: 'var(--color-profit)' },
  grandfathered: {
    icon: AlertTriangle,
    label: 'grandfathered',
    bg: 'var(--tint-warning)',
    fg: 'var(--color-warning)',
  },
  stale: { icon: Clock, label: 'stale', bg: 'var(--tint-warning)', fg: 'var(--color-warning)' },
  revoked: { icon: X, label: 'revoked', bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' },
};

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  title?: string;
  className?: string;
}

export function ApprovalStatusBadge({ status, title, className }: ApprovalStatusBadgeProps) {
  const meta = META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
        className,
      )}
      style={{ backgroundColor: meta.bg, color: meta.fg }}
      title={title}
    >
      <Icon size={9} strokeWidth={2.5} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
