import { AlertTriangle, XCircle } from 'lucide-react';
import type { SignalHealth } from '@/types/ml';

// Thresholds that match the gate's fail-open contract:
//   WARN_SECONDS  = alert fires at 90 min (before gate starts failing open)
//   STALE_SECONDS = gate fails open at 2h for 1h strategies (DEFAULT_MAX_AGE)
const WARN_SECONDS  = 5400;   // 90 min — inference is late, intervention needed
const STALE_SECONDS = 7200;   // 2h    — gate is failing open right now

function fmtAge(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function SignalStalenessWarning({ health }: { health: SignalHealth }) {
  const age = health.lastFireAgeSeconds;
  if (age === null || age < WARN_SECONDS) return null;

  const isFailOpen = age >= STALE_SECONDS;

  if (isFailOpen) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-rose-500/50 bg-rose-500/10 p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-rose-300">
            ML gate is failing open — trades running ungated
          </p>
          <p className="text-xs text-rose-400/80">
            Signal last written <span className="font-mono font-medium">{fmtAge(age)}</span> ago,
            past the {fmtAge(STALE_SECONDS)} fail-open threshold. The ML regime gate is
            no longer filtering entries — the strategy is trading without ML oversight.
          </p>
          <p className="text-xs text-rose-400/80">
            Fix: check the inference streaming worker{' '}
            <span className="font-mono">GET :8000/streaming/status</span> and the bar event
            consumer <span className="font-mono">docker logs blackheart-ingest</span>.
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
          Signal is late — ML gate will fail open in ~{fmtAge(STALE_SECONDS - age)}
        </p>
        <p className="text-xs text-amber-400/80">
          Signal last written <span className="font-mono font-medium">{fmtAge(age)}</span> ago.
          The gate fails open (trades run ungated) after {fmtAge(STALE_SECONDS)}. Inference
          pipeline needs attention before that window closes.
        </p>
      </div>
    </div>
  );
}
