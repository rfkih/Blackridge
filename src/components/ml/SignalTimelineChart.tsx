'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { useSignalDailyCounts } from '@/lib/api/ml';
import { Skeleton } from '@/components/ui/skeleton';

interface TooltipPayloadItem {
  value: number;
}

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-zinc-200">{label}</p>
      <p className="font-mono tabular-nums text-zinc-400">
        {payload[0].value} fire{payload[0].value === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/** Format a YYYY-MM-DD calendar date as "MMM d" without a UTC round-trip.
 *  `new Date('2026-06-12')` parses as UTC midnight, so date-fns would render
 *  the PREVIOUS day for operators west of UTC. Constructing from local parts
 *  keeps the label on the calendar day the backend counted. */
function fmtDayLabel(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  if (!y || !m || !d) return isoDay;
  return format(new Date(y, m - 1, d), 'MMM d');
}

export function SignalTimelineChart({ signalId }: { signalId: string }) {
  const { data, isLoading, isError, refetch } = useSignalDailyCounts(signalId, 30);

  if (isLoading) {
    return <Skeleton className="h-44 w-full rounded-md" />;
  }

  if (isError) {
    return (
      <div className="flex h-44 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/5 text-sm text-rose-200">
        Failed to load firing history.&nbsp;
        <button type="button" onClick={() => refetch()} className="underline">
          Retry
        </button>
      </div>
    );
  }

  const days = data?.days ?? [];
  if (days.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-md border border-dashed border-zinc-800 text-sm text-zinc-500">
        No firings in the last 30 days.
      </div>
    );
  }

  const chartData = days.map((d) => ({
    date: fmtDayLabel(d.date),
    count: d.fireCount,
  }));

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Fires per day (last 30d)
      </h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickLine={{ stroke: '#3f3f46' }}
              axisLine={{ stroke: '#3f3f46' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickLine={{ stroke: '#3f3f46' }}
              axisLine={{ stroke: '#3f3f46' }}
              allowDecimals={false}
            />
            <Tooltip cursor={{ fill: 'rgba(82,82,91,0.2)' }} content={<TooltipContent />} />
            <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
