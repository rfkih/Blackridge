import { cn } from '@/lib/utils';

/**
 * Blackridge logo — Ridge Stack.
 *
 * A mountain silhouette on a 14px-radius tile. The "Black" in Blackridge is
 * the ink tile; the "ridge" is the three-peak mountain. Theme behavior:
 *
 *   light  →  ink tile (#0E1116) + white mountain
 *   dark   →  white tile + brand-color mountain (--brand-500)
 *
 * Colors are wired through `--brand-mark-tile` / `--brand-mark-fg` in
 * `globals.css`, so the live theme and the active palette
 * (midnight / slate / oxford / emerald) drive the mountain color
 * without prop plumbing.
 */

interface BlackridgeMarkProps {
  size?: number;
  className?: string;
  /**
   * `tile` (default) — theme-driven via CSS vars.
   * `inverse` — forces the dark-theme treatment (white tile, brand mountain)
   *   regardless of active theme. Used on brand-color hero panels.
   */
  tone?: 'tile' | 'inverse';
  radius?: number;
}

export function BlackridgeMark({
  size = 32,
  className,
  tone = 'tile',
  radius,
}: BlackridgeMarkProps) {
  const tile = tone === 'inverse' ? '#FFFFFF' : 'var(--brand-mark-tile)';
  const fg = tone === 'inverse' ? 'var(--brand-500)' : 'var(--brand-mark-fg)';
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
      style={{ borderRadius: r }}
    >
      <rect width="64" height="64" rx="14" style={{ fill: tile }} />
      <path d="M10 46 L22 28 L28 36 L38 22 L46 32 L54 46 Z" style={{ fill: fg }} />
      <rect x="10" y="46" width="44" height="3" style={{ fill: fg }} />
    </svg>
  );
}
