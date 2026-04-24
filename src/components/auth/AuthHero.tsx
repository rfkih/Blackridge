import { LogoMark } from '@/components/brand/Logo';

interface AuthHeroProps {
  /** Small uppercase kicker above the hero heading. Defaults to "MERIDIAN · EDGE". */
  kicker?: string;
  /**
   * The hero line. Supports simple inline newlines via `\n`; each line renders
   * with the serif + the brand's tight tracking. Defaults to the pack copy.
   */
  heading?: string;
  /** Paragraph sub-copy below the heading. */
  subcopy?: string;
  /** Small mono tag above the bottom stat strip. */
  tag?: string;
  /**
   * Bottom stat strip — exactly three entries for design balance. Pass your
   * own or rely on the pack defaults.
   */
  stats?: ReadonlyArray<{ value: string; label: string }>;
}

/**
 * Left hero panel shared by the login + signup screens. Matches the MONO-MINT
 * design pack: faint mint grid backdrop, logo + kicker, big serif headline,
 * sub-copy, and a hairline-divided stat strip at the bottom.
 *
 * Kept in `components/auth/` because it's only ever used by the two auth
 * routes; no other surface in the app uses this composition.
 */
export function AuthHero({
  kicker = 'MERIDIAN · EDGE',
  heading = 'The desk behind your algorithms.',
  subcopy = 'Meridian Edge is a research and execution environment for systematic traders. Backtest, simulate, deploy. One account. One ledger.',
  tag = 'v 4.2.0 · SOC-2 TYPE II · FINRA CAT-REPORTING READY',
  stats = DEFAULT_STATS,
}: AuthHeroProps) {
  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        padding: '40px 44px',
        background: 'var(--mm-bg-2, var(--bg-surface))',
        borderRight: '1px solid var(--mm-hair, var(--border-subtle))',
        color: 'var(--mm-ink-0, var(--text-primary))',
        minHeight: '100%',
      }}
    >
      {/* Faint mint grid backdrop — the design pack's signature for auth. */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.05,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <pattern id="mm-auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="var(--mm-mint)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mm-auth-grid)" />
      </svg>

      <div style={{ position: 'relative' }}>
        <div className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mm-ink-2, var(--text-muted))',
            }}
          >
            {kicker}
          </span>
        </div>

        <h1
          className="font-display"
          style={{
            marginTop: 80,
            fontSize: 56,
            lineHeight: 1.02,
            letterSpacing: '-0.035em',
            whiteSpace: 'pre-line',
          }}
        >
          {heading.replace(/\s/g, ' ')}
        </h1>

        <p
          style={{
            marginTop: 18,
            maxWidth: 400,
            fontSize: 15,
            lineHeight: 1.5,
            color: 'var(--mm-ink-2, var(--text-secondary))',
          }}
        >
          {subcopy}
        </p>
      </div>

      {/* Bottom stat strip. Pushed to the bottom via mt-auto so the hero fills
       *  the remaining viewport regardless of height. */}
      <div style={{ marginTop: 'auto', position: 'relative' }}>
        <div
          aria-hidden="true"
          style={{
            height: 1,
            background: 'var(--mm-hair, var(--border-subtle))',
            margin: '28px 0 22px',
          }}
        />
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
          }}
        >
          {stats.map((s) => (
            <div key={s.label}>
              <dd
                className="font-display"
                style={{
                  fontSize: 22,
                  color: 'var(--mm-ink-0, var(--text-primary))',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                {s.value}
              </dd>
              <dt
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--mm-ink-3, var(--text-muted))',
                }}
              >
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
        {tag && (
          <div
            className="font-mono"
            style={{
              marginTop: 16,
              fontSize: 10,
              color: 'var(--mm-ink-3, var(--text-muted))',
              letterSpacing: '0.15em',
            }}
          >
            {tag}
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_STATS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '$4.2B', label: 'simulated volume' },
  { value: '1,840', label: 'strategies' },
  { value: '64%', label: 'median win rate' },
];
