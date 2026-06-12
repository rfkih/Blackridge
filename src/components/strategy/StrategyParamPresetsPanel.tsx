'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Plus, Power, PowerOff, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/useToast';
import {
  useActivateStrategyParam,
  useCreateStrategyParam,
  useDeactivateStrategyParam,
  useDeleteStrategyParam,
  useStrategyParamPresets,
} from '@/hooks/useStrategyParams';
import { normalizeError } from '@/lib/api/client';
import type { StrategyParamPreset } from '@/types/strategy';

interface Props {
  accountStrategyId: string;
}

/**
 * Saved-preset management for one account_strategy. Strictly additive — does
 * not replace the live edit form. Backend invariant: the live edit form writes
 * into the *active* preset row, so flipping which preset is active here also
 * changes what the live form will load on next open.
 */
export function StrategyParamPresetsPanel({ accountStrategyId }: Props) {
  const { data: presets, isLoading, isError } = useStrategyParamPresets(accountStrategyId);
  const [createOpen, setCreateOpen] = useState(false);

  const sorted = useMemo(() => {
    if (!presets) return [];
    return [...presets].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [presets]);

  return (
    <section className="rounded-xl border border-bd-subtle bg-bg-surface p-5 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg text-text-primary">Saved presets</h2>
          <p className="mt-1 text-xs text-text-muted">
            Each preset is a named override map. Only one is active at a time — the live executor
            reads the active preset; backtests can pin any preset by ID.
          </p>
        </div>
        <Button
          size="sm"
          variant="default"
          className="shrink-0 whitespace-nowrap"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={14} className="mr-1 shrink-0" />
          New preset
        </Button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-[var(--color-loss)]">Failed to load presets.</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-text-muted">No presets yet. Create one to get started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Override keys</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((preset) => (
                <PresetRow
                  key={preset.paramId}
                  preset={preset}
                  accountStrategyId={accountStrategyId}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreatePresetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accountStrategyId={accountStrategyId}
      />
    </section>
  );
}

function PresetRow({
  preset,
  accountStrategyId,
}: {
  preset: StrategyParamPreset;
  accountStrategyId: string;
}) {
  const toast = useToast();
  const activate = useActivateStrategyParam(accountStrategyId);
  const deactivate = useDeactivateStrategyParam(accountStrategyId);
  const remove = useDeleteStrategyParam(accountStrategyId);

  const overrideKeys = Object.keys(preset.overrides ?? {});
  const updatedLabel = formatIso(preset.updatedAt);

  const handleActivate = async () => {
    try {
      await activate.mutateAsync(preset.paramId);
      toast.success({ title: `Activated "${preset.name}"` });
    } catch (e) {
      toast.error({ title: 'Activate failed', description: normalizeError(e) });
    }
  };
  const handleDeactivate = async () => {
    try {
      await deactivate.mutateAsync(preset.paramId);
      toast.success({ title: `Deactivated "${preset.name}"` });
    } catch (e) {
      toast.error({ title: 'Deactivate failed', description: normalizeError(e) });
    }
  };
  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete preset "${preset.name}"? Historical backtests can still resolve it by ID.`,
      )
    ) {
      return;
    }
    try {
      await remove.mutateAsync(preset.paramId);
      toast.success({ title: `Deleted "${preset.name}"` });
    } catch (e) {
      toast.error({ title: 'Delete failed', description: normalizeError(e) });
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium text-text-primary">
        <div className="flex flex-col">
          <span>{preset.name}</span>
          {preset.sourceBacktestRunId && (
            <span
              className="font-mono text-[10px] text-text-muted"
              title={`Saved from backtest run ${preset.sourceBacktestRunId}`}
            >
              from run #{preset.sourceBacktestRunId.slice(0, 8)}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {preset.active ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 size={12} /> Active
          </Badge>
        ) : (
          <Badge variant="outline">Inactive</Badge>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-text-muted">
        {overrideKeys.length === 0 ? 'defaults only' : `${overrideKeys.length} key(s)`}
      </TableCell>
      <TableCell className="font-mono text-xs text-text-muted">{updatedLabel}</TableCell>
      <TableCell className="text-right">
        <div className="inline-flex gap-1">
          {preset.active ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeactivate}
              disabled={deactivate.isPending}
              title="Deactivate"
            >
              <PowerOff size={14} />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleActivate}
              disabled={activate.isPending}
              title="Activate"
            >
              <Power size={14} />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={remove.isPending}
            title="Delete"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CreatePresetDialog({
  open,
  onOpenChange,
  accountStrategyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountStrategyId: string;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [activate, setActivate] = useState(false);
  const create = useCreateStrategyParam(accountStrategyId);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error({ title: 'Name required' });
      return;
    }
    try {
      await create.mutateAsync({
        accountStrategyId,
        name: trimmed,
        overrides: {},
        activate,
      });
      toast.success({ title: `Created "${trimmed}"` });
      setName('');
      setActivate(false);
      onOpenChange(false);
    } catch (e) {
      toast.error({ title: 'Create failed', description: normalizeError(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New preset</DialogTitle>
          <DialogDescription>
            Creates an empty preset (defaults only). Edit overrides via the existing strategy params
            form once the preset is active.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="preset-name">Name</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. conservative-1h"
              maxLength={120}
              autoFocus
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
            />
            Activate immediately
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso ?? '—';
  return format(new Date(ms), 'yyyy-MM-dd HH:mm');
}
