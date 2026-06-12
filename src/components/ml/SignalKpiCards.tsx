import { cn } from '@/lib/utils';
import { formatRelativeTime, parseIsoUtc } from '@/lib/formatters';
import type { SignalHealth, SignalStatus } from '@/types/ml';
import { CoverageBar } from './CoverageBar';
import { HealthDot } from './HealthDot';
import { SignalStatusPill } from './SignalStatusPill';

function fmtBarTime(ts: string | null): string {
  if (!ts) return '';
  // Invalid Date doesn't throw — getUTC*() returns NaN — so guard explicitly
  // instead of try/catch, or we'd render "NaN-NaN-NaN NaN:NaN UTC".
  const ms = parseIsoUtc(ts);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${d.getUTCFullYear()}-${mo}-${dd} ${hh}:${mm} UTC`;
}
function fmtRatio(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
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
    <div className={cn('rounded-md border border-zinc-800 bg-zinc-950/40 p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
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
        {health.healthReason && <p className="mt-2 text-xs text-zinc-500">{health.healthReason}</p>}
      </Card>

      <Card label="Last written">
        <p className="text-lg font-medium tabular-nums text-zinc-100">
          {formatRelativeTime(health.lastProducedAt, 'never')}
        </p>
        {health.lastFireTs && (
          <p className="mt-1 text-xs text-zinc-500">candle: {fmtBarTime(health.lastFireTs)}</p>
        )}
        {health.expectedFireSeconds != null && health.expectedFireSeconds > 0 && (
          <p className="mt-1 text-xs text-zinc-500">
            Expected every {Math.round(health.expectedFireSeconds / 60)}m
          </p>
        )}
      </Card>

      <Card label="Fires 24h">
        <p className="font-mono text-lg tabular-nums text-zinc-100">{health.fires24h}</p>
        <p className="mt-1 text-xs text-zinc-500">
          7d total: <span className="tabular-nums">{health.fires7d}</span>
        </p>
      </Card>

      <Card label="Coverage 7d">
        <div className="flex items-center gap-3">
          <CoverageBar ratio={health.coverage7dRatio} />
          <span className="font-mono text-lg tabular-nums text-zinc-100">
            {fmtRatio(health.coverage7dRatio)}
          </span>
        </div>
        {health.walkforwardAuc !== null && (
          <p className="mt-2 text-xs text-zinc-500">
            WF AUC{' '}
            <span className="font-mono tabular-nums">{health.walkforwardAuc.toFixed(3)}</span>
          </p>
        )}
      </Card>
    </div>
  );
}
