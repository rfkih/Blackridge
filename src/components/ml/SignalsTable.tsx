'use client';

import Link from 'next/link';
import { AlertTriangle, Search } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { useSignals, useStreamingStatus } from '@/lib/api/ml';
import { formatRelativeTime } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
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
import { useDebouncedSearchPage } from '@/hooks/useDebouncedSearchPage';
import type { SignalStatus } from '@/types/ml';
import { SignalStatusPill } from './SignalStatusPill';

const PAGE_SIZE = 50;

function StreamingBanner() {
  const { data } = useStreamingStatus();
  if (!data || data.status === 'ok') return null;

  const isOffline = data.status === 'offline';
  const msg = isOffline
    ? 'Streaming worker offline — no predictions written to any signal. Restart the inference service.'
    : `Streaming worker lagging — ${data.stalledSignals.length} signal${data.stalledSignals.length === 1 ? '' : 's'} behind: ${data.stalledSignals.join(', ')}.`;

  return (
    <div
      className="flex items-start gap-2 rounded-md border px-4 py-3 text-sm"
      style={{
        background: isOffline ? 'rgba(239,68,68,0.08)' : 'rgba(250,204,21,0.08)',
        borderColor: isOffline ? 'rgba(239,68,68,0.3)' : 'rgba(250,204,21,0.3)',
        color: isOffline ? 'var(--color-loss)' : '#facc15',
      }}
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

export function SignalsTable() {
  const { searchInput, setSearchInput, debouncedSearch, page, setPage } = useDebouncedSearchPage();
  const [status, setStatus] = useState<SignalStatus | 'all'>('all');

  const { data, isLoading, isError, isFetching, refetch } = useSignals({
    q: debouncedSearch || undefined,
    status: status === 'all' ? undefined : status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-4">
      <StreamingBanner />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            value={searchInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
            placeholder="Search by name…"
            className="w-64 pl-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as SignalStatus | 'all');
            setPage(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="shadow">Shadow</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-zinc-500">
          {isLoading ? '…' : `${total} signal${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
          Failed to load signals.{' '}
          <button type="button" onClick={() => refetch()} className="underline">
            Retry
          </button>
        </div>
      ) : (data?.signals.length ?? 0) === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          No signals match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Signal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Symbol / Iv</TableHead>
                <TableHead>Bound strategies</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.signals.map((s) => {
                const isFail = s.gauntletVerdict === 'FAIL';
                return (
                  <TableRow
                    key={s.signalId}
                    className="hover:bg-zinc-900/40"
                    style={isFail ? { opacity: 0.45 } : undefined}
                  >
                    <TableCell>
                      <Link
                        href={`/ml/signals/${s.signalId}`}
                        className="font-medium text-zinc-100 hover:underline"
                      >
                        {s.signalName}
                      </Link>
                      {isFail && (
                        <span
                          className="ml-2 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                          style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-loss)' }}
                        >
                          FAIL
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SignalStatusPill status={s.status} />
                    </TableCell>
                    <TableCell className="text-sm text-zinc-300">
                      {s.symbol ?? '—'} <span className="text-zinc-500">·</span>{' '}
                      {s.intervalName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.boundStrategyCodes.length === 0 ? (
                        <span className="text-zinc-500">none</span>
                      ) : (
                        <span className="font-mono text-zinc-300">
                          {s.boundStrategyCodes.join(', ')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/ml/models/${s.modelId}`}
                        className="text-zinc-400 hover:text-zinc-200 hover:underline"
                      >
                        {s.modelSpecName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-xs text-zinc-400">
                      {formatRelativeTime(s.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
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
