'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { AlertTriangle, Search } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { useSignals, useStreamingStatus } from '@/lib/api/ml';
import { parseIsoUtc } from '@/lib/formatters';
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

function fmtRelative(ts: string | null): string {
  if (!ts) return '—';
  try {
    // parseIsoUtc: zone-less orchestrator timestamps are UTC, not local.
    return `${formatDistanceToNowStrict(parseIsoUtc(ts))} ago`;
  } catch {
    return '—';
  }
}

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
        background: isOffline
          ? 'color-mix(in oklab, var(--color-loss) 8%, transparent)'
          : 'color-mix(in oklab, var(--color-warning) 8%, transparent)',
        borderColor: isOffline
          ? 'color-mix(in oklab, var(--color-loss) 30%, transparent)'
          : 'color-mix(in oklab, var(--color-warning) 30%, transparent)',
        color: isOffline ? 'var(--color-loss)' : 'var(--color-warning)',
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

  const { data, isLoading, isError } = useSignals({
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
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
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
        <span className="ml-auto text-xs text-text-muted">
          {total} signal{total === 1 ? '' : 's'}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-md border border-loss bg-tint-loss p-4 text-sm text-loss">
          Failed to load signals.
        </div>
      ) : (data?.signals.length ?? 0) === 0 ? (
        <div className="rounded-md border border-dashed border-bd-subtle px-4 py-8 text-center text-sm text-text-muted">
          No signals match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-bd-subtle">
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
                    className="hover:bg-bg-hover"
                    style={isFail ? { opacity: 0.45 } : undefined}
                  >
                    <TableCell>
                      <Link
                        href={`/ml/signals/${s.signalId}`}
                        className="font-medium text-text-primary hover:underline"
                      >
                        {s.signalName}
                      </Link>
                      {isFail && (
                        <span
                          className="ml-2 rounded px-1 py-0.5 text-[12px] font-bold uppercase tracking-wider"
                          style={{
                            background: 'color-mix(in oklab, var(--color-loss) 12%, transparent)',
                            color: 'var(--color-loss)',
                          }}
                        >
                          FAIL
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SignalStatusPill status={s.status} />
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      {s.symbol ?? '—'} <span className="text-text-muted">·</span>{' '}
                      {s.intervalName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.boundStrategyCodes.length === 0 ? (
                        <span className="text-text-muted">none</span>
                      ) : (
                        <span className="font-mono text-text-secondary">
                          {s.boundStrategyCodes.join(', ')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link
                        href={`/ml/models/${s.modelId}`}
                        className="text-text-secondary hover:text-text-primary hover:underline"
                      >
                        {s.modelSpecName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-xs text-text-secondary">
                      {fmtRelative(s.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {lastPage > 0 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(Math.max(0, page - 1))}
            className="rounded-md border border-bd-subtle px-3 py-1 hover:bg-bg-hover disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>
            Page {page + 1} of {lastPage + 1}
          </span>
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => setPage(Math.min(lastPage, page + 1))}
            className="rounded-md border border-bd-subtle px-3 py-1 hover:bg-bg-hover disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
