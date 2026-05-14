import { cn } from '@/lib/utils';

interface BlackridgeMarkProps {
  size?: number;
  className?: string;
  /**
   * `tile` (default) — brand gradient tile with white glyph.
   * `inverse` — white tile with brand glyph; for use on brand surfaces.
   * `plain` — no tile, glyph in currentColor; inline use at small sizes.
   */
  tone?: 'tile' | 'inverse' | 'plain';
  radius?: number;
}

function BridgePath({ fill }: { fill: string }) {
  // Stylized "B" with a small ridge accent — matches the prototype's glyph.
  return (
    <>
      <path
        d="M5 18V6h7a3.5 3.5 0 0 1 1.5 6.7A3.5 3.5 0 0 1 12 18z"
        stroke={fill}
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="m17 8 3-3" stroke={fill} strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="5" r="1.2" fill={fill} />
    </>
  );
}

export function BlackridgeMark({
  size = 32,
  className,
  tone = 'tile',
  radius,
}: BlackridgeMarkProps) {
  const r = radius ?? (tone === 'plain' ? 0 : Math.round(size * 0.28));
  const tileBg =
    tone === 'inverse' ? '#FFFFFF' : tone === 'tile' ? 'var(--brand-500)' : 'transparent';
  const glyphFill =
    tone === 'inverse' ? 'var(--brand-700)' : tone === 'tile' ? '#FFFFFF' : 'currentColor';

  if (tone === 'plain') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        <BridgePath fill={glyphFill} />
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
        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
      }}
    >
      <svg
        width={size * 0.7}
        height={size * 0.7}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <BridgePath fill={glyphFill} />
      </svg>
    </div>
  );
}

interface BlackridgeWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showMark?: boolean;
}

export function BlackridgeWordmark({
  className,
  size = 'md',
  showMark = true,
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
      {showMark && <BlackridgeMark size={markSize} />}
      <span aria-hidden="true" className="leading-none">
        <span
          className={cn(
            'block font-display font-extrabold leading-none tracking-[-0.01em]',
            nameClass,
          )}
          style={{ color: 'var(--text-primary)' }}
        >
          Blackridge
        </span>
      </span>
    </span>
  );
}
