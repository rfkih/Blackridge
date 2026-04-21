'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  ChevronDown,
  RotateCcw,
  Trash2,
  Check as CheckIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listPresets, savePreset, deletePreset } from '@/lib/api/backtest-params';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNowStrict } from 'date-fns';
import type { BacktestParamPreset } from '@/types/backtest';

interface BacktestParamPresetBarProps {
  strategyCode: string;
  overrideCount: number;
  currentOverrides: Record<string, unknown>;
  activePresetName: string | null;
  onLoad: (preset: BacktestParamPreset) => void;
  onReset: () => void;
  className?: string;
}

export function BacktestParamPresetBar({
  strategyCode,
  overrideCount,
  currentOverrides,
  activePresetName,
  onLoad,
  onReset,
  className,
}: BacktestParamPresetBarProps) {
  const [presets, setPresets] = useState<BacktestParamPreset[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const refresh = useCallback(() => {
    setPresets(listPresets(strategyCode));
  }, [strategyCode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset = savePreset({
      name: trimmed,
      strategyCode,
      overrides: currentOverrides,
    });
    toast.success({
      title: 'Preset saved',
      description: `${preset.name} · ${strategyCode}`,
    });
    setName('');
    setSaveOpen(false);
    refresh();
  }, [name, strategyCode, currentOverrides, refresh]);

  const handleDelete = useCallback(
    (id: string) => {
      deletePreset(id);
      refresh();
    },
    [refresh],
  );

  const handleReset = useCallback(() => {
    onReset();
    setResetOpen(false);
  }, [onReset]);

  const saveDisabled = overrideCount === 0;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border border-bd-subtle bg-bg-surface px-3 py-2',
        className,
      )}
    >
      {/* Load preset dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-sm border border-bd-subtle px-2 text-[11px]',
              'bg-bg-base text-text-primary transition-colors duration-fast',
              'hover:border-bd hover:bg-bg-elevated',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <span className="label-caps !text-[9px] !text-text-muted">Preset</span>
            <span className="truncate font-mono text-[11px]">
              {activePresetName ?? 'Load…'}
            </span>
            <ChevronDown size={11} strokeWidth={1.75} className="opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[260px]">
          <DropdownMenuLabel className="label-caps !text-[10px]">
            {strategyCode} presets
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {presets.length === 0 ? (
            <div className="px-2 py-3 text-center font-mono text-[11px] text-text-muted">
              No saved presets yet
            </div>
          ) : (
            presets.map((p) => (
              <PresetRow
                key={p.id}
                preset={p}
                isActive={activePresetName === p.name}
                onLoad={() => onLoad(p)}
                onDelete={() => handleDelete(p.id)}
              />
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save current — popover with name input */}
      <Popover open={saveOpen} onOpenChange={setSaveOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={saveDisabled}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-sm border border-bd-subtle px-2 text-[11px]',
              'bg-bg-base text-text-secondary transition-colors duration-fast',
              'hover:border-bd hover:bg-bg-elevated hover:text-text-primary',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
            title={saveDisabled ? 'Make an override first' : 'Save current overrides as preset'}
          >
            <BookmarkPlus size={12} strokeWidth={1.75} />
            Save preset
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 border-bd bg-bg-surface">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="label-caps !text-[9px]">Preset name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. ${strategyCode}-tight-stops`}
                autoFocus
                className="h-8 text-[12px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
              <p className="label-caps !text-[9px]">
                {overrideCount} override{overrideCount === 1 ? '' : 's'} will be saved
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                className="rounded-sm border border-bd-subtle bg-bg-elevated px-2 py-1 text-[11px] text-text-secondary transition-colors duration-fast hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!name.trim()}
                className="rounded-sm bg-profit px-2 py-1 text-[11px] font-semibold text-text-inverse transition-opacity duration-fast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Reset */}
      <button
        type="button"
        disabled={overrideCount === 0}
        onClick={() => setResetOpen(true)}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-sm border border-bd-subtle px-2 text-[11px]',
          'bg-bg-base text-text-secondary transition-colors duration-fast',
          'hover:border-bd hover:bg-bg-elevated hover:text-loss',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <RotateCcw size={12} strokeWidth={1.75} />
        Reset
      </button>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm border-bd-subtle bg-bg-surface">
          <DialogHeader>
            <DialogTitle className="font-display text-[15px]">Reset overrides?</DialogTitle>
            <DialogDescription className="text-text-secondary">
              This clears {overrideCount} override{overrideCount === 1 ? '' : 's'} on{' '}
              <span className="font-mono text-text-primary">{strategyCode}</span> and restores
              backend defaults. Presets are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setResetOpen(false)}
              className="rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1.5 text-[11px] text-text-primary transition-colors duration-fast hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-sm bg-loss px-3 py-1.5 text-[11px] font-semibold text-text-inverse transition-opacity duration-fast hover:opacity-90"
            >
              Reset to defaults
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PresetRow({
  preset,
  isActive,
  onLoad,
  onDelete,
}: {
  preset: BacktestParamPreset;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const overrideCount = Object.keys(preset.overrides).length;
  const createdDate = new Date(preset.createdAt);
  const relative = formatDistanceToNowStrict(createdDate, { addSuffix: true });
  const absolute = format(createdDate, 'yyyy-MM-dd HH:mm');

  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        onLoad();
      }}
      className={cn('flex items-center gap-2.5 px-2 py-2', isActive && 'bg-bg-elevated')}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm',
          isActive ? 'bg-profit text-text-inverse' : 'border border-bd-subtle',
        )}
      >
        {isActive && <CheckIcon size={10} strokeWidth={2.5} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12px] font-medium text-text-primary">{preset.name}</span>
        <span className="truncate font-mono text-[9px] text-text-muted" title={absolute}>
          {relative} · {overrideCount} override{overrideCount === 1 ? '' : 's'}
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-fast hover:bg-bg-hover hover:text-loss"
        aria-label={`Delete preset ${preset.name}`}
      >
        <Trash2 size={11} strokeWidth={1.75} />
      </button>
    </DropdownMenuItem>
  );
}
