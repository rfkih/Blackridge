import { cn } from '@/lib/utils';

/**
 * Meridian Edge brand marks.
 *
 * Design rationale:
 *  - The "meridian" is a horizontal baseline at the bottom of the mark.
 *  - The "edge" is an ascending triangular peak piercing upward through it.
 *  - A small filled notch at the apex doubles as a pulse / up-tick cue,
 *    echoing the live-indicator dot used elsewhere in the UI.
 *  - Everything uses `currentColor` so the mark inherits the nearest text
 *    colour — no hard-coded hex so theme tokens flow through automatically.
 */

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Optional accent fill for the apex notch. Defaults to currentColor. */
  accentClassName?: string;
}

/** Standalone icon — 1:1 aspect, great in tight toolbar slots. */
export function LogoMark({ size = 20, className, accentClassName }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Meridian — the horizon */}
      <path d="M2.5 18.5 H21.5" strokeWidth="1.25" opacity="0.65" />
      {/* Edge — ascending peak rising through the meridian */}
      <path d="M6.5 18.5 L12 4.25 L17.5 18.5" strokeWidth="1.6" />
      {/* Apex accent — echoes the live-indicator dot */}
      <circle
        cx="12"
        cy="4.25"
        r="1.35"
        fill="currentColor"
        stroke="none"
        className={cn(accentClassName)}
      />
    </svg>
  );
}

interface LogotypeProps {
  className?: string;
  /** When false, renders only the wordmark without the mark. */
  showMark?: boolean;
  /** Visually-hidden label for screen readers. Defaults to "Meridian Edge". */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Horizontal lockup: mark + wordmark. Use this anywhere the name is being
 * *presented* (sidebar header, auth pages, splash). Use {@link LogoMark}
 * alone when icon-only is enough (favicon-adjacent slots, tight toolbars).
 */
export function Logotype({
  className,
  showMark = true,
  label = 'Meridian Edge',
  size = 'md',
}: LogotypeProps) {
  const markSize = size === 'sm' ? 16 : size === 'lg' ? 28 : 20;
  const textSize = size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-[18px]' : 'text-[13px]';
  const gap = size === 'sm' ? 'gap-1.5' : 'gap-2';

  return (
    <span className={cn('inline-flex items-center', gap, className)} role="img" aria-label={label}>
      {showMark && <LogoMark size={markSize} className="text-[var(--color-profit)]" />}
      <span
        aria-hidden="true"
        className={cn('font-mono font-semibold tracking-[0.18em] text-text-primary', textSize)}
      >
        <span className="text-[var(--color-profit)]">MERIDIAN</span>
        <span className="mx-1 text-text-muted">/</span>
        <span>EDGE</span>
      </span>
    </span>
  );
}
