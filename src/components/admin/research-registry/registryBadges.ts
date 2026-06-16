import type {
  PromiseTier,
  RegistryLifecycleStatus,
  RegistryVerdictTag,
} from '@/types/research';

/** Token-driven badge palette (fg = --color-*, bg = low-opacity tint). All via
 *  CSS vars so light/dark theming stays correct — never hardcode hex. */
export interface BadgeStyle {
  fg: string;
  bg: string;
  label: string;
}

const PROFIT = { fg: 'var(--color-profit)', bg: 'var(--tint-profit)' };
const INFO = { fg: 'var(--color-info)', bg: 'var(--tint-info)' };
const WARN = { fg: 'var(--color-warning)', bg: 'var(--tint-warning)' };
const LOSS = { fg: 'var(--color-loss)', bg: 'var(--tint-loss)' };
const MUTED = { fg: 'var(--text-muted)', bg: 'var(--bg-hover)' };

export const TIER_LABEL: Record<PromiseTier, string> = {
  TIER_A: 'Tier A — real edge / strongest leads',
  TIER_B: 'Tier B — live-but-uncertified / thin / parked',
  TIER_C: 'Tier C — falsified / dead',
};

export const TIER_ORDER: PromiseTier[] = ['TIER_A', 'TIER_B', 'TIER_C'];

export function tierStyle(tier: PromiseTier): BadgeStyle {
  switch (tier) {
    case 'TIER_A':
      return { ...PROFIT, label: 'A' };
    case 'TIER_B':
      return { ...INFO, label: 'B' };
    case 'TIER_C':
    default:
      return { ...MUTED, label: 'C' };
  }
}

export function statusStyle(status: RegistryLifecycleStatus): BadgeStyle {
  switch (status) {
    case 'LIVE':
      return { ...PROFIT, label: 'LIVE' };
    case 'LEAD':
      return { ...INFO, label: 'LEAD' };
    case 'DATA_GATED':
      return { ...WARN, label: 'DATA-GATED' };
    case 'PARKED':
      return { ...MUTED, label: 'PARKED' };
    case 'FALSIFIED':
    default:
      return { ...LOSS, label: 'FALSIFIED' };
  }
}

export function verdictStyle(verdict: RegistryVerdictTag): BadgeStyle {
  switch (verdict) {
    case 'REAL_LEAD':
      return { ...PROFIT, label: 'REAL LEAD' };
    case 'REAL_UNCERTIFIABLE':
      return { ...INFO, label: 'REAL · UNCERTIFIABLE' };
    case 'BETA_NOT_ALPHA':
      return { ...WARN, label: 'BETA, NOT ALPHA' };
    case 'DATA_GATED':
      return { ...WARN, label: 'DATA-GATED' };
    case 'PARKED':
      return { ...MUTED, label: 'PARKED' };
    case 'FALSIFIED_OOS':
      return { ...LOSS, label: 'FALSIFIED (OOS)' };
    case 'EXHAUSTED':
      return { ...MUTED, label: 'EXHAUSTED' };
    case 'FALSIFIED':
    default:
      return { ...LOSS, label: 'FALSIFIED' };
  }
}

/** Short label for a walk-forward stability verdict (or em-dash). */
export function shortWf(v: string | null): string {
  if (!v) return '—';
  return v
    .replace('INSUFFICIENT_EVIDENCE', 'INSUFFICIENT')
    .replace('NO_EDGE', 'NO EDGE');
}

export function fmtDsr(v: number | null): string {
  return v == null ? '—' : v.toFixed(3);
}

export function fmtPct(v: number | null): string {
  if (v == null) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

export function fmtInt(v: number | null): string {
  return v == null ? '—' : String(v);
}
