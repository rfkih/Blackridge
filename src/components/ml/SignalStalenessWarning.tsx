import { AlertTriangle, XCircle } from 'lucide-react';
import type { SignalHealth } from '@/types/ml';

// The gate's fail-open contract (DEFAULT_MAX_AGE) scales with the signal's
// bar interval: it fails open when the latest bar is 2 intervals old. We warn
// at 1.5 intervals so the operator has a window to intervene. For a 1h signal
// that's warn=90m / stale=2h; a 4h signal gets warn=6h / stale=8h instead of
// permanently false-alarming on the old hardcoded 1h thresholds.
const WARN_INTERVALS = 1.5;
const STALE_INTERVALS = 2;

// Fallback when the API doesn't report expectedFireSeconds: assume 1h bars.
const FALLBACK_INTERVAL_SECONDS = 3600;

function fmtAge(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function SignalStalenessWarning({ health }: { health: SignalHealth }) {
  // lastFireAgeSeconds is the age of the latest signal BAR (candle open), not
  // the wall-clock write time — that is exactly what the gate's max-age check
  // compares, so it is the right input here. Copy below says "bar" for the
  // same reason.
  const age = health.lastFireAgeSeconds;
  const intervalSeconds =
    health.expectedFireSeconds != null && health.expectedFireSeconds > 0
      ? health.expectedFireSeconds
      : FALLBACK_INTERVAL_SECONDS;
  const warnSeconds = WARN_INTERVALS * intervalSeconds;
  const staleSeconds = STALE_INTERVALS * intervalSeconds;

  if (age === null || age < warnSeconds) return null;

  const isFailOpen = age >= staleSeconds;

  if (isFailOpen) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-rose-500/50 bg-rose-500/10 p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-rose-300">
            ML gate is failing open — trades running ungated
          </p>
          <p className="text-xs text-rose-400/80">
            Latest signal bar is <span className="font-mono font-medium">{fmtAge(age)}</span> old,
            past the {fmtAge(staleSeconds)} fail-open threshold for this {fmtAge(intervalSeconds)}{' '}
            signal. The ML regime gate is no longer filtering entries — the strategy is trading
            without ML oversight.
          </p>
          <p className="text-xs text-rose-400/80">
            Fix: check the inference streaming worker{' '}
            <span className="font-mono">GET :8000/streaming/status</span> and the bar event consumer{' '}
            <span className="font-mono">docker logs blackheart-ingest</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-amber-300">
          Signal is late — ML gate will fail open in ~{fmtAge(staleSeconds - age)}
        </p>
        <p className="text-xs text-amber-400/80">
          Latest signal bar is <span className="font-mono font-medium">{fmtAge(age)}</span> old. The
          gate fails open (trades run ungated) once the bar is {fmtAge(staleSeconds)} old. Inference
          pipeline needs attention before that window closes.
        </p>
      </div>
    </div>
  );
}
