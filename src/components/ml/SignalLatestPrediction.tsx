'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSignalFirings } from '@/lib/api/ml';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * "Latest prediction" headline for a signal: turns the most recent
 * signal_history firing into the bullish / neutral / bearish read the
 * operator reasons about, plus a conviction score.
 *
 * The thresholds mirror the production entry gate
 * ({@code MLRegimeGateGuard} in the trading JVM) so this panel never
 * disagrees with how the signal actually gates live trades:
 *   value > 0.70  → model predicts BULLISH (gate blocks SHORT)
 *   value < 0.30  → model predicts BEARISH (gate blocks LONG)
 *   0.30–0.70     → model abstains → NEUTRAL
 *
 * `value` is P(risk-on) for binary regime models (the common case);
 * `confidence` is intentionally null on those rows — the JVM reasons
 * about distance from 0.5, which is exactly the conviction we surface
 * here (|value − 0.5| × 2, so 0.5 → 0% and the extremes → 100%).
 */

// Mirror MLRegimeGateGuard.DEFAULT_SHORT_BLOCK_ABOVE / DEFAULT_LONG_BLOCK_BELOW.
const BULLISH_ABOVE = 0.7;
const BEARISH_BELOW = 0.3;

type Direction = 'bullish' | 'bearish' | 'neutral';

interface PredictionRead {
  /** false when the value isn't a directional probability (regression / multiclass / out-of-range). */
  directional: boolean;
  direction: Direction | null;
  /** [0,1] — distance from a coin-flip. */
  conviction: number;
}

/** Pure classifier — exported for unit tests. */
export function readPrediction(
  value: number,
  objective: string | null | undefined,
): PredictionRead {
  // Only binary regime classifiers emit a P(risk-on) we can read directionally.
  // Multiclass collapses to argmax-class prob (not directional); regression is a
  // raw forecast. Unknown objective (model metadata absent) defaults to the
  // binary read since every shipped regime signal is binary.
  const isProbability = (objective == null || objective === 'binary') && value >= 0 && value <= 1;
  if (!isProbability) {
    return { directional: false, direction: null, conviction: 0 };
  }
  const direction: Direction =
    value > BULLISH_ABOVE ? 'bullish' : value < BEARISH_BELOW ? 'bearish' : 'neutral';
  const conviction = Math.min(1, Math.abs(value - 0.5) * 2);
  return { directional: true, direction, conviction };
}

const DIRECTION_STYLE: Record<
  Direction,
  { label: string; pill: string; meter: string; Icon: typeof TrendingUp }
> = {
  bullish: {
    label: 'BULLISH',
    pill: 'bg-tint-profit text-profit ring-1 ring-profit',
    meter: 'bg-profit',
    Icon: TrendingUp,
  },
  bearish: {
    label: 'BEARISH',
    pill: 'bg-tint-loss text-loss ring-1 ring-loss',
    meter: 'bg-loss',
    Icon: TrendingDown,
  },
  neutral: {
    label: 'NEUTRAL',
    pill: 'bg-bg-overlay text-text-secondary ring-1 ring-bd',
    meter: 'bg-neutral',
    Icon: Minus,
  },
};

function fmtRelative(ts: string | null): string {
  if (!ts) return '—';
  try {
    return `${formatDistanceToNowStrict(new Date(ts))} ago`;
  } catch {
    return '—';
  }
}

function fmtBarTime(ts: string | null): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(
      d.getUTCHours(),
    )}:${p(d.getUTCMinutes())} UTC`;
  } catch {
    return '—';
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-bd-subtle bg-bg-elevated p-5">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">
        Latest prediction
      </h2>
      {children}
    </div>
  );
}

export function SignalLatestPrediction({
  signalId,
  objective,
}: {
  signalId: string;
  objective?: string | null;
}) {
  const { data, isLoading, isError } = useSignalFirings(signalId, { limit: 1, offset: 0 });

  if (isLoading) {
    return (
      <Shell>
        <Skeleton className="h-16 w-full" />
      </Shell>
    );
  }

  const latest = data?.firings[0];
  if (isError || !latest) {
    return (
      <Shell>
        <p className="text-sm text-text-muted">
          No prediction yet — the inference pipeline hasn&apos;t written a signal for this model.
        </p>
      </Shell>
    );
  }

  const { directional, direction, conviction } = readPrediction(latest.value, objective);
  const convictionPct = Math.round(conviction * 100);

  return (
    <Shell>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Direction */}
        {directional && direction ? (
          (() => {
            const s = DIRECTION_STYLE[direction];
            return (
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-lg font-semibold tracking-wide',
                    s.pill,
                  )}
                >
                  <s.Icon className="h-5 w-5" aria-hidden />
                  {s.label}
                </span>
                {direction === 'neutral' && (
                  <span className="text-xs text-text-muted">
                    model abstains ({BEARISH_BELOW.toFixed(2)}–{BULLISH_ABOVE.toFixed(2)} band)
                  </span>
                )}
              </div>
            );
          })()
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-lg font-semibold tabular-nums text-text-primary">
              {latest.value.toFixed(4)}
            </span>
            <span className="text-xs text-text-muted">
              raw forecast — directional read available for binary regime models only
            </span>
          </div>
        )}

        {/* Conviction */}
        {directional && (
          <div className="w-full sm:w-56">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                Conviction
              </span>
              <span className="font-mono text-lg tabular-nums text-text-primary">
                {convictionPct}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-overlay">
              <div
                className={cn(
                  'h-full rounded-full',
                  direction ? DIRECTION_STYLE[direction].meter : 'bg-neutral',
                )}
                style={{ width: `${convictionPct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[11px] text-text-muted">distance from coin-flip</p>
          </div>
        )}
      </div>

      {/* Supporting detail */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-bd-subtle pt-3 text-xs text-text-muted">
        {directional && (
          <span>
            P(risk-on){' '}
            <span className="font-mono tabular-nums text-text-secondary">
              {latest.value.toFixed(4)}
            </span>
          </span>
        )}
        <span>
          candle{' '}
          <span className="font-mono tabular-nums text-text-secondary">
            {fmtBarTime(latest.ts)}
          </span>
        </span>
        <span>
          written{' '}
          <span className="font-mono tabular-nums text-text-secondary">
            {fmtRelative(latest.producedAt)}
          </span>
        </span>
        <span>
          source <span className="font-mono text-text-secondary">{latest.source}</span>
        </span>
      </div>
    </Shell>
  );
}
