'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useModels } from '@/lib/api/ml';
import { formatRelativeTime } from '@/lib/formatters';
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
import type { ModelStatus } from '@/types/ml';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

const STATUS_STYLES: Record<string, string> = {
  trained: 'bg-emerald-500/15 text-emerald-300',
  live: 'bg-emerald-500/15 text-emerald-300',
  shadow: 'bg-amber-500/15 text-amber-300',
  staged: 'bg-sky-500/15 text-sky-300',
  cooling_down: 'bg-zinc-500/15 text-zinc-300',
  training: 'bg-blue-500/15 text-blue-300',
  awaiting_operator_review: 'bg-violet-500/15 text-violet-300',
  retired: 'bg-zinc-700/20 text-zinc-400',
  rejected_by_operator: 'bg-rose-500/15 text-rose-300',
};

export function ModelsTable() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<string>('all');

  const { data, isLoading, isError, isFetching } = useModels({
    status: status === 'all' ? undefined : status,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="trained">Trained</SelectItem>
            <SelectItem value="shadow">Shadow</SelectItem>
            <SelectItem value="staged">Staged</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="cooling_down">Cooling down</SelectItem>
            <SelectItem value="training">Training</SelectItem>
            <SelectItem value="awaiting_operator_review">Awaiting review</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
            <SelectItem value="rejected_by_operator">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-zinc-500">
          {isLoading ? '…' : `${total} model${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
          Failed to load models.
        </div>
      ) : (data?.models.length ?? 0) === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          No models. Train one via the research loop.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Symbol / Iv</TableHead>
                <TableHead className="text-right">Version</TableHead>
                <TableHead>Artifact</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.models.map((m) => (
                <TableRow key={m.id} className="hover:bg-zinc-900/40">
                  <TableCell>
                    <Link
                      href={`/ml/models/${m.id}`}
                      className="font-medium text-zinc-100 hover:underline"
                    >
                      {m.family}/{m.purpose}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs',
                        STATUS_STYLES[m.status] ?? 'bg-zinc-700/30 text-zinc-300',
                      )}
                    >
                      {(m.status as ModelStatus).replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-300">
                    {m.symbol ?? '—'} <span className="text-zinc-500">·</span> {m.interval ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">v{m.version}</TableCell>
                  <TableCell className="font-mono text-xs text-zinc-500">
                    {m.artifactSha256 ? `${m.artifactSha256.slice(0, 12)}…` : '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs text-zinc-400">
                    {formatRelativeTime(m.createdTime)}
                  </TableCell>
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
