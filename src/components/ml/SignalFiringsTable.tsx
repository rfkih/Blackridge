'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useSignalFirings } from '@/lib/api/ml';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SignalSource } from '@/types/ml';

const PAGE_SIZE = 50;

function fmtTs(ts: string): string {
  try {
    return format(new Date(ts), 'yyyy-MM-dd HH:mm');
  } catch {
    return ts;
  }
}

const SOURCE_STYLES: Record<SignalSource, string> = {
  stream: 'text-emerald-300',
  catchup_scan: 'text-sky-300',
  historical_replay: 'text-zinc-400',
};

export function SignalFiringsTable({ signalId }: { signalId: string }) {
  const [page, setPage] = useState(0);
  const [source, setSource] = useState<SignalSource | 'all'>('all');

  const { data, isLoading, isError, isFetching, refetch } = useSignalFirings(signalId, {
    source: source === 'all' ? undefined : source,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Recent firings ({total})
        </h3>
        <Select
          value={source}
          onValueChange={(v) => {
            setSource(v as SignalSource | 'all');
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="stream">stream</SelectItem>
            <SelectItem value="catchup_scan">catchup_scan</SelectItem>
            <SelectItem value="historical_replay">historical_replay</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-4 py-8 text-center text-sm text-rose-200">
          Failed to load firings.{' '}
          <button type="button" onClick={() => refetch()} className="underline">
            Retry
          </button>
        </div>
      ) : (data?.firings.length ?? 0) === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          No firings.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candle (bar open)</TableHead>
                <TableHead>Written</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.firings.map((f) => (
                // The same bar/symbol can appear twice with different sources
                // (stream + catchup_scan) — source + producedAt disambiguate.
                <TableRow
                  key={`${f.ts}-${f.symbol}-${f.source}-${f.producedAt}`}
                  className="hover:bg-zinc-900/40"
                >
                  <TableCell className="font-mono text-xs tabular-nums text-zinc-300">
                    {fmtTs(f.ts)}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-zinc-400">
                    {fmtTs(f.producedAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-300">{f.symbol}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-zinc-100">
                    {f.value.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-zinc-400">
                    {f.confidence === null ? '—' : f.confidence.toFixed(4)}
                  </TableCell>
                  <TableCell className={`text-xs ${SOURCE_STYLES[f.source]}`}>{f.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {lastPage > 0 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <button
            type="button"
            disabled={page === 0 || isFetching}
            onClick={() => setPage(Math.max(0, page - 1))}
            className="rounded-md border border-zinc-800 px-3 py-1 hover:bg-zinc-900 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>
            Page {page + 1} of {lastPage + 1}
          </span>
          <button
            type="button"
            disabled={page >= lastPage || isFetching}
            onClick={() => setPage(Math.min(lastPage, page + 1))}
            className="rounded-md border border-zinc-800 px-3 py-1 hover:bg-zinc-900 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
