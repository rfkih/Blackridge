'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { Concern } from '@/types/pendingApproval';

interface ConcernsPanelProps {
  concerns: Concern[];
  /** When true, the panel renders open. Pass true for HOLD rows. */
  defaultOpen?: boolean;
}

/**
 * Collapsible list of curator-attached concerns. Each entry came from a
 * specialist's CONCERN verdict on the iteration (Lens D in the curator
 * workflow). Hard vetos from specialists collapse upstream into curator
 * REJECT, which never reaches the inbox -- so this list only ever shows
 * CONCERN-severity entries in practice.
 */
export function ConcernsPanel({ concerns, defaultOpen = false }: ConcernsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (concerns.length === 0) {
    return null;
  }

  return (
    <div className="border-warning/30 bg-warning/5 rounded-lg border p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left text-[13px] font-semibold text-warning"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <AlertTriangle className="h-3 w-3" />
        {concerns.length} {concerns.length === 1 ? 'concern' : 'concerns'}
      </button>
      {open && (
        <ul className="mt-2 space-y-2 text-[12px]">
          {concerns.map((c, i) => (
            <li
              key={`${c.source}-${i}`}
              className="border-warning/40 flex flex-col gap-0.5 border-l-2 pl-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-text-secondary">{c.source}</span>
                <span className="text-warning">{c.severity}</span>
              </div>
              <p className="text-text-primary">{c.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
