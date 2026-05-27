'use client';

import { useState } from 'react';
import { Download, FileCode, FileText } from 'lucide-react';
import { paperLatexHref, paperPdfHref } from '@/lib/api/researchPapers';
import { buildIeeeDocx } from '@/lib/export/buildIeeeDocx';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import type { PaperDetail } from '@/types/papers';

interface ExportButtonsProps {
  paperId: string;
  paper: PaperDetail;
}

export function ExportButtons({ paperId, paper }: ExportButtonsProps) {
  const [wordPending, setWordPending] = useState(false);

  async function handleWord() {
    setWordPending(true);
    try {
      const blob = await buildIeeeDocx(paper);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${paperId}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error({ title: 'Word export failed', description: normalizeError(err) });
    } finally {
      setWordPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={paperLatexHref(paperId)}
        download
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
      >
        <FileCode size={12} strokeWidth={1.75} />
        LaTeX
      </a>
      <a
        href={paperPdfHref(paperId)}
        download
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
      >
        <FileText size={12} strokeWidth={1.75} />
        PDF
      </a>
      <button
        type="button"
        onClick={handleWord}
        disabled={wordPending}
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-50"
      >
        <Download size={12} strokeWidth={1.75} />
        {wordPending ? 'Exporting…' : 'Word'}
      </button>
    </div>
  );
}
