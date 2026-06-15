import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import type { SignalHealth, SignalStatus } from '@/types/ml';
import { CoverageBar } from './CoverageBar';
import { HealthDot } from './HealthDot';
import { SignalStatusPill } from './SignalStatusPill';

function fmtRelative(ts: string | null): string {
  if (!ts) return 'never';
  try {
    return `${formatDistanceToNowStrict(new Date(ts))} ago`;
  } catch {
    return '—';
  }
}

function fmtBarTime(ts: string | null): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = d.getUTCDate().toString().padStart(2, '0');
    return `${d.getUTCFullYear()}-${mo}-${dd} ${hh}:${mm} UTC`;
  } catch {
    return '';
  }
}
function fmtRatio(v: number | null): string {
  if (v === null) return '—';
  return `${Math.round(v * 100)}%`;
}

function Card({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-bd-subtle bg-bg-elevated p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function SignalKpiCards({ status, health }: { status: SignalStatus; health: SignalHealth }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Status">
        <div className="flex items-center gap-2">
          <HealthDot health={health.health} reason={health.healthReason} />
          <SignalStatusPill status={status} />
        </div>
        {health.healthReason && <p className="mt-2 text-xs text-text-muted">{health.healthReason}</p>}
      </Card>

      <Card label="Last written">
        <p className="text-lg font-medium tabular-nums text-text-primary">
          {fmtRelative(health.lastProducedAt)}
        </p>
        {health.lastFireTs && (
          <p className="mt-1 text-xs text-text-muted">
            candle: {fmtBarTime(health.lastFireTs)}
          </p>
        )}
        {health.expectedFireSeconds && (
          <p className="mt-1 text-xs text-text-muted">
            Expected every {Math.round(health.expectedFireSeconds / 60)}m
          </p>
        )}
      </Card>

      <Card label="Fires 24h">
        <p className="font-mono text-lg tabular-nums text-text-primary">{health.fires24h}</p>
        <p className="mt-1 text-xs text-text-muted">
          7d total: <span className="tabular-nums">{health.fires7d}</span>
        </p>
      </Card>

      <Card label="Coverage 7d">
        <div className="flex items-center gap-3">
          <CoverageBar ratio={health.coverage7dRatio} />
          <span className="font-mono text-lg tabular-nums text-text-primary">
            {fmtRatio(health.coverage7dRatio)}
          </span>
        </div>
        {health.walkforwardAuc !== null && (
          <p className="mt-2 text-xs text-text-muted">
            WF AUC{' '}
            <span className="font-mono tabular-nums">{health.walkforwardAuc.toFixed(3)}</span>
          </p>
        )}
      </Card>
    </div>
  );
}
