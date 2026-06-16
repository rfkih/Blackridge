'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, RefreshCcw, Search } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useDebouncedSearchPage } from '@/hooks/useDebouncedSearchPage';
import { normalizeError } from '@/lib/api/client';
import {
  archiveRegistryEntry,
  createRegistryEntry,
  listRegistry,
  updateRegistryEntry,
  type RegistryWriteInput,
} from '@/lib/api/researchRegistry';
import type {
  PromiseTier,
  RegistryLifecycleStatus,
  ResearchRegistryEntry,
} from '@/types/research';
import { RegistryTable } from '@/components/admin/research-registry/RegistryTable';
import { RegistryDetailDialog } from '@/components/admin/research-registry/RegistryDetailDialog';
import { RegistryEditDialog } from '@/components/admin/research-registry/RegistryEditDialog';

const TIER_FILTERS: { label: string; value: PromiseTier | 'ALL' }[] = [
  { label: 'All tiers', value: 'ALL' },
  { label: 'A', value: 'TIER_A' },
  { label: 'B', value: 'TIER_B' },
  { label: 'C', value: 'TIER_C' },
];

const STATUS_FILTERS: { label: string; value: RegistryLifecycleStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Lead', value: 'LEAD' },
  { label: 'Parked', value: 'PARKED' },
  { label: 'Data-gated', value: 'DATA_GATED' },
  { label: 'Falsified', value: 'FALSIFIED' },
];

const STAT_TILES: { key: RegistryLifecycleStatus; label: string; color: string }[] = [
  { key: 'LIVE', label: 'Live', color: 'var(--color-profit)' },
  { key: 'LEAD', label: 'Leads', color: 'var(--color-info)' },
  { key: 'PARKED', label: 'Parked', color: 'var(--text-secondary)' },
  { key: 'DATA_GATED', label: 'Data-gated', color: 'var(--color-warning)' },
  { key: 'FALSIFIED', label: 'Falsified', color: 'var(--color-loss)' },
];

type EditState = { mode: 'create' | 'edit'; entry: ResearchRegistryEntry | null; open: boolean };

export default function ResearchStrategiesPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();

  const [tier, setTier] = useState<PromiseTier | 'ALL'>('ALL');
  const [status, setStatus] = useState<RegistryLifecycleStatus | 'ALL'>('ALL');
  const [family, setFamily] = useState<string>('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);
  const { searchInput, setSearchInput, debouncedSearch, setPage } = useDebouncedSearchPage();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ mode: 'create', entry: null, open: false });
  const [saveError, setSaveError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['research-registry', tier, status, family, debouncedSearch, includeArchived],
    queryFn: () =>
      listRegistry({
        tier: tier === 'ALL' ? undefined : tier,
        status: status === 'ALL' ? undefined : status,
        family: family === 'ALL' ? undefined : family,
        search: debouncedSearch || undefined,
        includeArchived,
      }),
    // Real-time: poll every 30s (each request reads live DB + resolves the
    // LATEST run server-side) and refetch on tab focus. placeholderData keeps
    // the previous rows on screen during a refetch so the table never blanks.
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
    enabled: isAdmin,
  });

  const saveMut = useMutation({
    mutationFn: (vars: { mode: 'create' | 'edit'; id?: string; body: RegistryWriteInput }) =>
      vars.mode === 'create'
        ? createRegistryEntry(vars.body)
        : updateRegistryEntry(vars.id as string, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research-registry'] });
      setEdit((s) => ({ ...s, open: false }));
      setSaveError(null);
    },
    onError: (e) => setSaveError(normalizeError(e)),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveRegistryEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['research-registry'] }),
  });

  const items = query.data?.items ?? [];
  const statusCounts = query.data?.statusCounts;
  const families = useMemo(
    () => Array.from(new Set(items.map((i) => i.signalFamily).filter(Boolean) as string[])).sort(),
    [items],
  );
  // Resolve the open detail row from the LIVE list each render (not a click-time
  // snapshot) so an open dialog reflects the latest polled metrics.
  const selectedEntry = selectedId
    ? (items.find((i) => i.registryId === selectedId) ?? null)
    : null;

  if (!isAdmin) {
    return <div className="px-6 py-12 text-center text-text-secondary">Admin access required.</div>;
  }

  function openCreate() {
    setSaveError(null);
    setEdit({ mode: 'create', entry: null, open: true });
  }
  function openEdit(entry: ResearchRegistryEntry) {
    setSaveError(null);
    setEdit({ mode: 'edit', entry, open: true });
  }
  function onArchive(entry: ResearchRegistryEntry) {
    if (window.confirm(`Archive "${entry.displayName}"? It will be hidden from the registry (reversible).`)) {
      archiveMut.mutate(entry.registryId);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            Strategy Research Registry
          </h1>
          <p className="text-sm text-text-secondary">
            Ranked roster of every researched strategy — most → least promising — with live DSR /
            walk-forward / return joined from the orchestrator, the qualitative verdict, and
            provenance. ⚠ flags where the curated narrative diverges from a fresh DB number.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => query.refetch()} className="mm-pill" style={{ padding: '8px 12px', fontSize: 12 }}>
            {query.isFetching && !query.isLoading ? (
              <Loader2 size={13} strokeWidth={1.7} className="animate-spin" />
            ) : (
              <RefreshCcw size={13} strokeWidth={1.7} />
            )}
            <span>Refresh</span>
          </button>
          <button type="button" onClick={openCreate} className="mm-pill" style={{ padding: '8px 12px', fontSize: 12 }}>
            <Plus size={13} strokeWidth={1.7} />
            <span>Add entry</span>
          </button>
        </div>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-widest text-text-muted">Total</div>
          <div className="mt-0.5 font-mono text-xl tabular-nums text-text-primary">
            {query.data?.total ?? '—'}
          </div>
        </div>
        {STAT_TILES.map((t) => (
          <div key={t.key} className="rounded-xl border border-bd-subtle bg-bg-surface px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-widest text-text-muted">{t.label}</div>
            <div className="mt-0.5 font-mono text-xl tabular-nums" style={{ color: t.color }}>
              {statusCounts?.[t.key] ?? '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 rounded-xl border border-bd-subtle bg-bg-surface px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] uppercase tracking-widest text-text-muted">Tier</span>
          {TIER_FILTERS.map((f) => (
            <FilterPill key={f.value} active={tier === f.value} label={f.label} onClick={() => { setTier(f.value); setPage(0); }} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] uppercase tracking-widest text-text-muted">Status</span>
          {STATUS_FILTERS.map((f) => (
            <FilterPill key={f.value} active={status === f.value} label={f.label} onClick={() => { setStatus(f.value); setPage(0); }} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-16 shrink-0 text-[11px] uppercase tracking-widest text-text-muted">Search</span>
          <div className="relative">
            <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="name / code / thesis…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-7 w-64 rounded-sm border border-bd-subtle bg-bg-base pl-6 pr-2 font-mono text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            className="h-7 rounded-sm border border-bd-subtle bg-bg-base px-2 font-mono text-[12px] text-text-primary"
          >
            <option value="ALL">All families</option>
            {families.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-text-secondary">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
      </div>

      {/* Body */}
      {query.isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : query.isError ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center" style={{ color: 'var(--color-loss)' }}>
          {normalizeError(query.error)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-text-secondary">
          No strategies match the current filters.
        </div>
      ) : (
        <RegistryTable
          items={items}
          isAdmin={isAdmin}
          onSelect={(e) => setSelectedId(e.registryId)}
          onEdit={openEdit}
          onArchive={onArchive}
        />
      )}

      <RegistryDetailDialog entry={selectedEntry} onClose={() => setSelectedId(null)} />
      <RegistryEditDialog
        mode={edit.mode}
        entry={edit.entry}
        open={edit.open}
        saving={saveMut.isPending}
        errorMessage={saveError}
        onClose={() => setEdit((s) => ({ ...s, open: false }))}
        onSave={(body) => saveMut.mutate({ mode: edit.mode, id: edit.entry?.registryId, body })}
      />
    </div>
  );
}

function FilterPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm px-2 py-1 text-[12px] transition-colors"
      style={{
        background: active ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        border: '1px solid',
        borderColor: active ? 'var(--border-default)' : 'transparent',
      }}
    >
      {label}
    </button>
  );
}
