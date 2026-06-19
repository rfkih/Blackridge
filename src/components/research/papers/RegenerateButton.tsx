'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generatePaper } from '@/lib/api/researchPapers';
import { toneColor } from '@/lib/tones';

interface RegenerateButtonProps {
  paperId: string;
  queueId: string;
  currentVersion: number;
}

export function RegenerateButton({ paperId, queueId, currentVersion }: RegenerateButtonProps) {
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () => generatePaper(queueId, crypto.randomUUID()),
    onSuccess: () => {
      setFlash('ok');
      queryClient.invalidateQueries({ queryKey: ['paper', paperId] });
      queryClient.invalidateQueries({ queryKey: ['paper-charts', paperId] });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
    onError: () => setFlash('err'),
  });

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  if (flash === 'ok') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[14px] font-semibold"
        style={{ color: toneColor('profit') }}
      >
        <CheckCircle2 size={12} />
        Regenerated
      </span>
    );
  }

  if (flash === 'err') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[14px] font-semibold"
        style={{ color: toneColor('loss') }}
      >
        <XCircle size={12} />
        Failed — check orchestrator
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => mutate()}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[14px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-60"
    >
      <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
      {isPending ? 'Regenerating…' : `Regenerate (v${currentVersion})`}
    </button>
  );
}
