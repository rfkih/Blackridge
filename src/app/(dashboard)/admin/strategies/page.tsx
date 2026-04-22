'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Archive,
  Edit3,
  FlaskConical,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { StrategyDefinitionDialog } from '@/components/admin/StrategyDefinitionDialog';
import {
  useDeprecateStrategyDefinition,
  useStrategyDefinitions,
} from '@/hooks/useStrategyDefinitions';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuthStore } from '@/store/authStore';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { StrategyDefinition } from '@/types/strategyDefinition';

export default function AdminStrategiesPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  // The route is client-gated: non-admins get redirected to the dashboard
  // on render. The backend still enforces ROLE_ADMIN on every write — this
  // redirect is UX, not security.
  const user = useAuthStore((s) => s.user);
  const userResolved = user !== undefined;

  useEffect(() => {
    if (userResolved && !isAdmin) {
      router.replace('/');
    }
  }, [userResolved, isAdmin, router]);

  const { data: rows = [], isLoading, isError, refetch } = useStrategyDefinitions();
  const deprecateMutation = useDeprecateStrategyDefinition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StrategyDefinition | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (row: StrategyDefinition) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleDeprecate = (row: StrategyDefinition) => {
    // window.confirm is the right primitive here — soft-delete is
    // reversible (flip status back via edit), so a heavy modal is overkill.
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      `Deprecate "${row.strategyCode}"? It will no longer appear in pickers. Historical rows still resolve.`,
    );
    if (!ok) return;
    deprecateMutation.mutate(row.id, {
      onSuccess: (updated) => {
        toast.success({
          title: 'Strategy deprecated',
          description: `${updated.strategyCode} · ${updated.status}`,
        });
      },
      onError: (err) => {
        toast.error({ title: 'Could not deprecate', description: normalizeError(err) });
      },
    });
  };

  const { active, inactive, deprecated } = useMemo(() => {
    const a: StrategyDefinition[] = [];
    const i: StrategyDefinition[] = [];
    const d: StrategyDefinition[] = [];
    for (const r of rows) {
      if (r.status === 'DEPRECATED') d.push(r);
      else if (r.status === 'INACTIVE') i.push(r);
      else a.push(r);
    }
    return { active: a, inactive: i, deprecated: d };
  }, [rows]);

  // Before we know the user's role, render nothing — prevents a flash of
  // admin chrome for a regular user who lands here by typing the URL.
  if (!userResolved) return null;
  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps inline-flex items-center gap-1.5">
            <ShieldCheck size={10} strokeWidth={1.75} />
            Admin
          </p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
            Strategy catalogue
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-text-secondary">
            Register new strategy definitions, edit display metadata, or deprecate obsolete ones.
            Codes are immutable once created — downstream tables (account_strategy, backtest_run,
            LSR/VCB params) key on the string.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus size={14} strokeWidth={2} />
          Register strategy
        </Button>
      </header>

      <AdminNotice />

      {isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Could not load strategy definitions"
          description="The catalogue endpoint returned an error."
          action={
            <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw size={12} /> Retry
            </Button>
          }
        />
      ) : isLoading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No strategies registered yet"
          description="The catalogue is empty. Register your first strategy to unlock account configuration."
          action={
            <Button onClick={openCreate} className="gap-1.5">
              <Sparkles size={13} />
              Register first strategy
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <StrategyTable
            label="Active"
            rows={active}
            onEdit={openEdit}
            onDeprecate={handleDeprecate}
          />
          {inactive.length > 0 && (
            <StrategyTable
              label="Inactive"
              rows={inactive}
              onEdit={openEdit}
              onDeprecate={handleDeprecate}
            />
          )}
          {deprecated.length > 0 && (
            <StrategyTable
              label="Deprecated"
              rows={deprecated}
              onEdit={openEdit}
              onDeprecate={handleDeprecate}
              hideDeprecateAction
            />
          )}
        </div>
      )}

      <StrategyDefinitionDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

interface StrategyTableProps {
  label: string;
  rows: StrategyDefinition[];
  onEdit: (row: StrategyDefinition) => void;
  onDeprecate: (row: StrategyDefinition) => void;
  hideDeprecateAction?: boolean;
}

function StrategyTable({
  label,
  rows,
  onEdit,
  onDeprecate,
  hideDeprecateAction,
}: StrategyTableProps) {
  return (
    <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
        <h3 className="font-display text-[13px] font-semibold text-text-primary">
          {label}
          <span className="ml-2 font-mono text-[11px] text-text-muted">{rows.length}</span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bd-subtle">
              {['Code', 'Name', 'Type', 'Status', 'Updated', ''].map((col) => (
                <th
                  key={col || 'actions'}
                  className="label-caps whitespace-nowrap px-4 py-2.5 text-left"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-bd-subtle last:border-b-0 hover:bg-bg-elevated"
              >
                <td className="num whitespace-nowrap px-4 py-3">
                  <span className="font-mono text-[12px] font-semibold text-text-primary">
                    {row.strategyCode}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[13px] text-text-primary">
                  {row.strategyName}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="rounded-sm bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                    {row.strategyType}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="num whitespace-nowrap px-4 py-3 text-[11px] text-text-muted">
                  {safeDateFmt(row.updatedAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-primary transition-colors hover:bg-bg-hover"
                      aria-label={`Edit ${row.strategyCode}`}
                    >
                      <Edit3 size={11} strokeWidth={1.75} /> Edit
                    </button>
                    {!hideDeprecateAction && (
                      <button
                        type="button"
                        onClick={() => onDeprecate(row)}
                        className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 text-[11px] text-[var(--color-loss)] transition-colors hover:bg-[rgba(255,77,106,0.12)]"
                        aria-label={`Deprecate ${row.strategyCode}`}
                      >
                        <Archive size={11} strokeWidth={1.75} /> Deprecate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Supporting UI ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const meta = resolveStatus(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
      )}
      style={{ backgroundColor: meta.bg, color: meta.fg }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.fg }}
      />
      {status}
    </span>
  );
}

function resolveStatus(status: string): { bg: string; fg: string } {
  const up = status.toUpperCase();
  if (up === 'ACTIVE') return { bg: 'var(--tint-profit)', fg: 'var(--color-profit)' };
  if (up === 'INACTIVE') return { bg: 'var(--tint-warning)', fg: 'var(--color-warning)' };
  if (up === 'DEPRECATED') return { bg: 'var(--tint-loss)', fg: 'var(--color-loss)' };
  return { bg: 'var(--bg-elevated)', fg: 'var(--text-muted)' };
}

function safeDateFmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'yyyy-MM-dd HH:mm');
}

function AdminNotice() {
  return (
    <div
      className="flex items-start gap-2.5 rounded-md border px-3 py-2.5"
      style={{
        borderColor: 'rgba(78,158,255,0.35)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <ShieldAlert
        size={14}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0 text-[var(--color-info)]"
        aria-hidden="true"
      />
      <div className="text-[12px] leading-relaxed text-text-secondary">
        <span className="font-semibold text-text-primary">Admin action</span> — changes here surface
        everywhere downstream. Deprecating a strategy hides it from new selections but keeps
        historical backtests and live trades resolvable.
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-md border border-bd-subtle bg-bg-surface p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-bd-subtle py-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
