import { cn } from '@/lib/utils';

/**
 * Machiavelli Technology brand marks — chess-knight glyph on an emerald tile.
 *
 * The wordmark is "Machiavelli" + a small uppercase "Technology" eyebrow,
 * matching the design pack's sidebar lockup. The chess knight motif ties
 * directly to the brand name (Machiavelli, strategy, chess) and reads at
 * favicon sizes as a recognizable silhouette.
 */

interface LogoMarkProps {
  size?: number;
  className?: string;
  /**
   * `tile` (default) — emerald gradient tile with white knight glyph.
   * `inverse` — white tile with emerald knight; for use on emerald surfaces.
   * `plain` — no tile, knight in currentColor; inline use at small sizes.
   */
  tone?: 'tile' | 'inverse' | 'plain';
  radius?: number;
}

function KnightPath({ fill }: { fill: string }) {
  return (
    <path
      d="M22 50 H46 L46 47 C44 46 42.5 44.5 42 42 L41 35 C41 30 39 26 35.5 23 C36.8 21.5 37.5 19.5 37 17.5 L34.5 18 C33.8 16 32 14.5 30 14.5 C27.5 14.5 26 16.5 26 18 C26 18 24 19 22.5 21 C21 23 20.5 25 21 26.5 L24 25.5 C24.5 27 25 28.5 24 30 C22.5 32.5 19.5 33 18 35 L18 37 L21 36.5 L20.5 39 C20.5 41 21.5 43.5 22 46 L22 50 Z"
      fill={fill}
    />
  );
}

export function LogoMark({ size = 32, className, tone = 'tile', radius }: LogoMarkProps) {
  const r = radius ?? (tone === 'plain' ? 0 : Math.round(size * 0.28));
  const tileBg =
    tone === 'inverse'
      ? '#FFFFFF'
      : tone === 'tile'
        ? 'linear-gradient(135deg, #16B364 0%, #0A7E3F 100%)'
        : 'transparent';
  const glyphFill = tone === 'inverse' ? '#0E9F50' : tone === 'tile' ? '#FFFFFF' : 'currentColor';
  const eyeFill = tone === 'tile' ? '#0A7E3F' : tone === 'inverse' ? '#0A7E3F' : 'currentColor';

  if (tone === 'plain') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        <KnightPath fill={glyphFill} />
        <circle cx="29" cy="20" r="1.5" fill={eyeFill} />
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
        viewBox="0 0 64 64"
        fill="none"
        style={{ display: 'block' }}
        aria-hidden="true"
        focusable="false"
      >
        <KnightPath fill={glyphFill} />
        <circle cx="29" cy="20" r="1.5" fill={eyeFill} />
      </svg>
    </div>
  );
}

interface LogotypeProps {
  className?: string;
  /** When false, renders only the wordmark without the mark. */
  showMark?: boolean;
  /** Visually-hidden label for screen readers. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** When true, "Technology" eyebrow renders in muted ink. */
  showEyebrow?: boolean;
}

/**
 * Horizontal lockup: emerald knight tile + "Machiavelli / TECHNOLOGY"
 * wordmark. Eyebrow is sentence-uppercase, tight tracking, mono-feel.
 */
export function Logotype({
  className,
  showMark = true,
  label = 'Machiavelli Technology',
  size = 'md',
  showEyebrow = true,
}: LogotypeProps) {
  const markSize = size === 'sm' ? 26 : size === 'lg' ? 40 : 32;
  const nameClass = size === 'sm' ? 'text-[14px]' : size === 'lg' ? 'text-[22px]' : 'text-[17px]';
  const tagClass =
    size === 'sm'
      ? 'text-[8px] mt-[2px]'
      : size === 'lg'
        ? 'text-[10px] mt-[3px]'
        : 'text-[9px] mt-[2px]';
  const gap = size === 'sm' ? 'gap-2' : 'gap-2.5';

  return (
    <span className={cn('inline-flex items-center', gap, className)} role="img" aria-label={label}>
      {showMark && <LogoMark size={markSize} />}
      <span aria-hidden="true" className="leading-none">
        <span
          className={cn(
            'block font-display font-extrabold leading-none tracking-[-0.015em]',
            nameClass,
          )}
          style={{ color: 'var(--text-primary)' }}
        >
          Machiavelli
        </span>
        {showEyebrow && (
          <span
            className={cn('block font-semibold uppercase tracking-[0.2em]', tagClass)}
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
          >
            Technology
          </span>
        )}
      </span>
    </span>
  );
}
