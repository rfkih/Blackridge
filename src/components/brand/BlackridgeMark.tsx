import { cn } from '@/lib/utils';

/**
 * Blackridge logo system.
 *
 * The new mark is `Peak` — a confident chevron/peak silhouette with a
 * green-shaded face. Replaces the legacy stylized-B glyph. Six concepts
 * ship as named exports for variant use (favicon, marketing illustration,
 * dark-mode chrome). The wordmark splits `Black` + `ridge` with the
 * "ridge" half tinted Blackridge-green — this is identity, fixed regardless
 * of palette.
 */

// Identity colors — fixed, not palette-driven. The Blackridge green is the
// brand's foundational accent; palette switching shouldn't recolor the logo.
const BR_GREEN = '#16B364';
const BR_INK = '#0E1116';

interface BlackridgeMarkProps {
  size?: number;
  className?: string;
  /**
   * `tile` (default) — dark ink tile, white peak, green shaded face.
   * `inverse` — white tile, dark ink peak, green accent. For brand-color surfaces.
   * `plain` — no tile; peak in currentColor, green accent preserved. Inline use.
   */
  tone?: 'tile' | 'inverse' | 'plain';
  radius?: number;
}

// ── Default mark: Peak ───────────────────────────────────────────────────

function PeakGlyph({ tile, peak, accent }: { tile: string; peak: string; accent: string }) {
  return (
    <>
      {tile !== 'transparent' && <rect width="64" height="64" rx="14" fill={tile} />}
      <path d="M14 46 L32 16 L50 46 Z" fill={peak} />
      <path d="M32 16 L50 46 L40 46 L32 30 Z" fill={accent} opacity="0.95" />
      {tile !== 'transparent' && (
        <path d="M14 46 L50 46" stroke={tile} strokeWidth="2" />
      )}
    </>
  );
}

export function BlackridgeMark({
  size = 32,
  className,
  tone = 'tile',
  radius,
}: BlackridgeMarkProps) {
  const tile =
    tone === 'tile' ? BR_INK : tone === 'inverse' ? '#FFFFFF' : 'transparent';
  const peak = tone === 'inverse' ? BR_INK : '#FFFFFF';
  const accent = BR_GREEN;
  const r = radius ?? Math.round(size * 0.22);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={
        tone === 'plain'
          ? undefined
          : {
              borderRadius: r,
              boxShadow: tone === 'tile' ? '0 1px 2px rgba(0,0,0,0.12)' : undefined,
            }
      }
    >
      <PeakGlyph tile={tile} peak={tone === 'plain' ? 'currentColor' : peak} accent={accent} />
    </svg>
  );
}

// ── Additional logo concepts ─────────────────────────────────────────────
// Available as named exports for variant use (e.g. favicon size, brand
// hero illustrations, alternate marketing surfaces). All share the
// {size, color, accent} signature from the design pack.

interface LogoVariantProps {
  size?: number;
  color?: string;
  accent?: string;
  className?: string;
}

/** Three ascending peaks on a green background. Reads at small sizes. */
export function LogoRidgeStack({
  size = 32,
  color = BR_GREEN,
  accent = '#fff',
  className,
}: LogoVariantProps) {
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
      <rect width="64" height="64" rx="14" fill={color} />
      <path d="M10 46 L22 28 L28 36 L38 22 L46 32 L54 46 Z" fill={accent} />
      <rect x="10" y="46" width="44" height="3" fill={accent} />
    </svg>
  );
}

/** Architectural B with a sliver of ridge inside the upper counter. */
export function LogoMonogramB({
  size = 32,
  color = BR_INK,
  accent = BR_GREEN,
  className,
}: LogoVariantProps) {
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
      <rect width="64" height="64" rx="14" fill={color} />
      <path
        d="M18 14 H36 a8 8 0 0 1 0 16 H18 Z M18 30 H40 a9 9 0 0 1 0 18 H18 Z"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinejoin="miter"
      />
      <path d="M22 26 L28 20 L32 24 L36 18 L34 26 Z" fill={accent} />
    </svg>
  );
}

/** Single bold chevron with a shaded ridge face — the new default. */
export function LogoPeak({
  size = 32,
  color = BR_INK,
  accent = BR_GREEN,
  className,
}: LogoVariantProps) {
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
      <rect width="64" height="64" rx="14" fill={color} />
      <path d="M14 46 L32 16 L50 46 Z" fill="#fff" />
      <path d="M32 16 L50 46 L40 46 L32 30 Z" fill={accent} opacity="0.95" />
      <path d="M14 46 L50 46" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/** Topographic contour lines with a single accent peak. */
export function LogoTopo({
  size = 32,
  color = BR_INK,
  accent = BR_GREEN,
  className,
}: LogoVariantProps) {
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
      <rect width="64" height="64" rx="14" fill={color} />
      <g stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M10 50 Q22 42 32 44 T54 38" />
        <path d="M12 42 Q24 32 32 34 T54 28" />
        <path d="M16 34 Q26 24 32 26 T52 20" />
      </g>
      <path
        d="M22 18 Q32 8 42 18"
        stroke={accent}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="32" cy="12" r="2" fill={accent} />
    </svg>
  );
}

/** Two-tone BR monogram where the R's leg becomes a peak. */
export function LogoBR({
  size = 32,
  color = BR_INK,
  accent = BR_GREEN,
  className,
}: LogoVariantProps) {
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
      <rect width="64" height="64" rx="14" fill={color} />
      <g fill="#fff">
        <rect x="14" y="14" width="5" height="36" />
        <path d="M19 14 H30 a7 7 0 0 1 0 14 H19 Z" />
        <path d="M19 28 H32 a8 8 0 0 1 0 16 H19 Z" />
      </g>
      <g fill={accent}>
        <rect x="36" y="14" width="5" height="36" />
        <path d="M41 14 H46 a7 7 0 0 1 0 14 H41 Z" />
        <path d="M41 28 L51 50 L46 50 L37 32 Z" />
      </g>
    </svg>
  );
}

/** Ski-trail black diamond with a green horizon ridge inside. */
export function LogoDiamond({
  size = 32,
  color = BR_INK,
  accent = BR_GREEN,
  className,
}: LogoVariantProps) {
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
      <rect width="64" height="64" rx="14" fill="#fff" stroke={color} strokeWidth="1.5" />
      <path d="M32 8 L56 32 L32 56 L8 32 Z" fill={color} />
      <path d="M14 32 L26 22 L34 30 L44 18 L50 32 Z" fill={accent} />
      <circle cx="44" cy="18" r="2.4" fill="#fff" />
    </svg>
  );
}

// ── Wordmark ─────────────────────────────────────────────────────────────

interface BlackridgeWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showMark?: boolean;
  /** Force light-on-dark color treatment (e.g. on the brand gradient panel). */
  inverse?: boolean;
}

export function BlackridgeWordmark({
  className,
  size = 'md',
  showMark = true,
  inverse = false,
}: BlackridgeWordmarkProps) {
  const markSize = size === 'sm' ? 26 : size === 'lg' ? 40 : 32;
  const nameClass = size === 'sm' ? 'text-[15px]' : size === 'lg' ? 'text-[22px]' : 'text-[18px]';
  const gap = size === 'sm' ? 'gap-2' : 'gap-2.5';

  return (
    <span
      className={cn('inline-flex items-center', gap, className)}
      role="img"
      aria-label="Blackridge"
    >
      {showMark && <BlackridgeMark size={markSize} tone={inverse ? 'inverse' : 'tile'} />}
      <span aria-hidden="true" className="leading-none">
        <span
          className={cn(
            'block font-display font-extrabold leading-none tracking-[-0.02em]',
            nameClass,
          )}
        >
          {/* Identity split: "Black" in primary text, "ridge" always green —
              brand color stays fixed even under palette changes. */}
          <span style={{ color: inverse ? '#fff' : 'var(--text-primary)' }}>Black</span>
          <span style={{ color: BR_GREEN }}>ridge</span>
        </span>
      </span>
    </span>
  );
}
