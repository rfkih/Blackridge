'use client';

import { useState } from 'react';
import { Download, FileCode, FileText } from 'lucide-react';
import { downloadPaperExport } from '@/lib/api/researchPapers';
import { buildIeeeDocx } from '@/lib/export/buildIeeeDocx';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import type { PaperDetail } from '@/types/papers';

interface ExportButtonsProps {
  paperId: string;
  paper: PaperDetail;
}

type Format = 'latex' | 'pdf' | 'word';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    document.body.removeChild(a);
    // Defer revoke so the browser finishes streaming the blob to disk
    // before the URL is invalidated.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function ExportButtons({ paperId, paper }: ExportButtonsProps) {
  const [pending, setPending] = useState<Format | null>(null);

  async function handleServerExport(format: 'latex' | 'pdf') {
    if (pending) return;
    setPending(format);
    try {
      const blob = await downloadPaperExport(paperId, format);
      const ext = format === 'pdf' ? 'pdf' : 'tex';
      triggerDownload(blob, `${paperId}.${ext}`);
    } catch (err) {
      const label = format === 'pdf' ? 'PDF' : 'LaTeX';
      toast.error({ title: `${label} export failed`, description: normalizeError(err) });
    } finally {
      setPending(null);
    }
  }

  async function handleWord() {
    if (pending) return;
    setPending('word');
    try {
      const blob = await buildIeeeDocx(paper);
      triggerDownload(blob, `${paperId}.docx`);
    } catch (err) {
      toast.error({ title: 'Word export failed', description: normalizeError(err) });
    } finally {
      setPending(null);
    }
  }

  const buttonClass =
    'inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-50';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handleServerExport('latex')}
        disabled={pending !== null}
        className={buttonClass}
      >
        <FileCode size={12} strokeWidth={1.75} />
        {pending === 'latex' ? 'Exporting…' : 'LaTeX'}
      </button>
      <button
        type="button"
        onClick={() => handleServerExport('pdf')}
        disabled={pending !== null}
        className={buttonClass}
      >
        <FileText size={12} strokeWidth={1.75} />
        {pending === 'pdf' ? 'Exporting…' : 'PDF'}
      </button>
      <button
        type="button"
        onClick={handleWord}
        disabled={pending !== null}
        className={buttonClass}
      >
        <Download size={12} strokeWidth={1.75} />
        {pending === 'word' ? 'Exporting…' : 'Word'}
      </button>
    </div>
  );
}
