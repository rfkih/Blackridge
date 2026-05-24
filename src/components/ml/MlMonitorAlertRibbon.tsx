import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { MlMonitorRow } from '@/types/ml';

/**
 * Top-of-page banner that surfaces red signals at-a-glance. Renders
 * nothing when there are no red rows — empty state is "no banner",
 * not "all-green pill" (less visual noise).
 */
export function MlMonitorAlertRibbon({ rows }: { rows: MlMonitorRow[] }) {
  const reds = rows.filter((r) => r.health === 'red');
  if (reds.length === 0) return null;

  const visible = reds.slice(0, 3);
  const overflow = reds.length - visible.length;

  return (
    <div className="flex items-start gap-3 rounded-md border border-rose-500/30 bg-rose-500/5 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-300" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-rose-200">
          {reds.length} signal{reds.length === 1 ? '' : 's'} in red.
        </p>
        <p className="text-xs text-rose-200/80">
          {visible.map((r, i) => (
            <span key={r.signalId}>
              <Link
                href={`/ml/signals/${r.signalId}`}
                className="font-mono underline-offset-2 hover:underline"
              >
                {r.signalName}
              </Link>
              <span className="text-rose-200/60"> ({r.healthReason ?? 'unknown'})</span>
              {i < visible.length - 1 && '; '}
            </span>
          ))}
          {overflow > 0 && <span className="text-rose-200/60"> + {overflow} more</span>}
        </p>
      </div>
    </div>
  );
}
