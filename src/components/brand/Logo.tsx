import { cn } from '@/lib/utils';

/**
 * Meridian Edge brand marks — MONO-MINT chart-tick glyph.
 *
 * Design rationale (from the MONO-MINT handoff):
 *  - A minimal "chart tick" — a rising polyline terminating at a filled dot.
 *    Reads simultaneously as a breakout, an ascending edge, a summit.
 *  - Geometric and quiet; the single filled dot is the signature beat.
 *  - Renders inside a tinted tile by default so it stands alone against any
 *    surface; `tone="plain"` drops the tile for use on already-tinted chrome
 *    (e.g. inline in a badge).
 */

interface LogoMarkProps {
  size?: number;
  className?: string;
  /**
   * `tile` (default) — mint-tinted tile with dark glyph; matches the sidebar
   *   wordmark on the design pack.
   * `inverse` — inverted: ink tile with mint glyph. Use on loud mint
   *   surfaces.
   * `plain` — no tile, glyph in currentColor; inline use at small sizes.
   */
  tone?: 'tile' | 'inverse' | 'plain';
  /** Corner radius for the tile. Ignored for `plain`. */
  radius?: number;
}

/** Standalone icon — 1:1 aspect, great in tight toolbar slots. */
export function LogoMark({
  size = 20,
  className,
  tone = 'tile',
  radius,
}: LogoMarkProps) {
  const r = radius ?? (tone === 'plain' ? 0 : Math.round(size * 0.3));
  const tileBg =
    tone === 'inverse'
      ? 'var(--text-primary)'
      : tone === 'tile'
        ? 'var(--color-profit)'
        : 'transparent';
  const glyphStroke =
    tone === 'inverse'
      ? 'var(--color-profit)'
      : tone === 'tile'
        ? 'var(--bg-base)'
        : 'currentColor';

  if (tone === 'plain') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        <path
          d="M9 28 L20 17 L28 23 L31 11"
          stroke={glyphStroke}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="31" cy="11" r="2.6" fill={glyphStroke} />
      </svg>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: tileBg,
        display: 'inline-grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        style={{ display: 'block' }}
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M9 28 L20 17 L28 23 L31 11"
          stroke={glyphStroke}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="31" cy="11" r="2.6" fill={glyphStroke} />
      </svg>
    </div>
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
 * Horizontal lockup: mint tile + "Meridian / Edge" wordmark in the Fraunces
 * serif — matches the sidebar and hero treatments in the design pack.
 */
export function Logotype({
  className,
  showMark = true,
  label = 'Meridian Edge',
  size = 'md',
}: LogotypeProps) {
  const markSize = size === 'sm' ? 22 : size === 'lg' ? 40 : 30;
  const nameClass =
    size === 'sm'
      ? 'text-[13px]'
      : size === 'lg'
        ? 'text-[22px]'
        : 'text-[17px]';
  const tagClass =
    size === 'sm'
      ? 'text-[9px] mt-[1px]'
      : size === 'lg'
        ? 'text-[12px] mt-[3px]'
        : 'text-[10.5px] mt-[2px]';
  const gap = size === 'sm' ? 'gap-2' : 'gap-2.5';

  return (
    <span
      className={cn('inline-flex items-center', gap, className)}
      role="img"
      aria-label={label}
    >
      {showMark && <LogoMark size={markSize} />}
      <span aria-hidden="true" className="leading-none">
        <span
          className={cn('font-display block leading-none tracking-[-0.015em]', nameClass)}
          style={{ color: 'var(--text-primary)' }}
        >
          Meridian
        </span>
        <span
          className={cn('block uppercase tracking-[0.12em]', tagClass)}
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
        >
          Edge
        </span>
      </span>
    </span>
  );
}
