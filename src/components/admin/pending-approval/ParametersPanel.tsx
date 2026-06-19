'use client';

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EffectiveParams } from '@/types/pendingApproval';

const COLLAPSE_THRESHOLD = 15;

interface ParametersPanelProps {
  params: EffectiveParams;
}

interface RenderedRow {
  key: string;
  /** "" if no prefix (key has no "."); else the segment before the first "." */
  group: string;
  /** Stringified value -- never display [object Object]. */
  value: string;
  /** Used to keep order stable inside a group. */
  originalIndex: number;
}

function valueToString(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // Nested objects (rare in V104 effective_params): serialize compactly.
  try {
    return JSON.stringify(v);
  } catch {
    return '[unserializable]';
  }
}

function flatten(params: EffectiveParams): RenderedRow[] {
  return Object.entries(params).map(([key, value], i) => {
    const dot = key.indexOf('.');
    const group = dot === -1 ? '' : key.slice(0, dot);
    return { key, group, value: valueToString(value), originalIndex: i };
  });
}

/**
 * Frozen effectiveParams from the curator's cited backtest_run
 * (V104 effective_params_snapshot). Renders as a single sortable column;
 * collapses past COLLAPSE_THRESHOLD entries; copy-to-clipboard per row.
 *
 * Display order: group ascending (alphabetical, "" group first as it's
 * the "general" bucket), then originalIndex within group (preserves the
 * backend's natural ordering of related fields).
 */
export function ParametersPanel({ params }: ParametersPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const flat = flatten(params);
    flat.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.originalIndex - b.originalIndex;
    });
    return flat;
  }, [params]);

  const visible =
    expanded || rows.length <= COLLAPSE_THRESHOLD ? rows : rows.slice(0, COLLAPSE_THRESHOLD);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(`${key}=${value}`);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    } catch {
      // Older browsers / Safari without clipboard permission -- silently no-op.
    }
  };

  if (rows.length === 0) {
    return (
      <p className="text-[14px] text-text-secondary">
        No effective parameters captured. (Curator copies from backtest_run.effectiveParamsSnapshot
        -- empty means the snapshot field was null on the cited backtest, likely a pre-V104 row.)
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-1 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((row) => (
          <div
            key={row.key}
            className="bg-bg-surface-2 flex items-center justify-between gap-2 rounded border border-bd-subtle px-2 py-1"
          >
            <span className="truncate font-mono text-text-secondary" title={row.key}>
              {row.key}
            </span>
            <span className="truncate font-mono tabular-nums text-text-primary" title={row.value}>
              {row.value}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(row.key, row.value)}
              aria-label={`Copy ${row.key}=${row.value}`}
              className="text-text-tertiary hover:text-text-primary"
            >
              {copiedKey === row.key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        ))}
      </div>
      {rows.length > COLLAPSE_THRESHOLD && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
          {expanded
            ? `Hide ${rows.length - COLLAPSE_THRESHOLD} parameters`
            : `Show all ${rows.length} parameters`}
        </Button>
      )}
    </div>
  );
}
