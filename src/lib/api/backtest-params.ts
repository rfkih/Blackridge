import { nanoid } from 'nanoid';
import type { BacktestParamPreset } from '@/types/backtest';

const STORAGE_KEY = 'blackheart:backtest-presets';

function readAll(): BacktestParamPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as BacktestParamPreset[];
  } catch {
    return [];
  }
}

function writeAll(presets: BacktestParamPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore quota / Safari private mode — preset save silently fails.
  }
}

export function listPresets(strategyCode?: string): BacktestParamPreset[] {
  const all = readAll();
  const filtered = strategyCode ? all.filter((p) => p.strategyCode === strategyCode) : all;
  return [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function savePreset(input: {
  name: string;
  strategyCode: string;
  overrides: Record<string, unknown>;
}): BacktestParamPreset {
  const preset: BacktestParamPreset = {
    id: nanoid(),
    name: input.name.trim(),
    strategyCode: input.strategyCode,
    overrides: { ...input.overrides },
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  writeAll([...all, preset]);
  return preset;
}

export function deletePreset(id: string): void {
  const all = readAll();
  writeAll(all.filter((p) => p.id !== id));
}
