'use client';

import { Download, Printer } from 'lucide-react';
import { paperLatexHref } from '@/lib/api/researchPapers';

interface ExportButtonsProps {
  paperId: string;
}

export function ExportButtons({ paperId }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={paperLatexHref(paperId)}
        download
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
      >
        <Download size={12} />
        LaTeX
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover"
      >
        <Printer size={12} />
        Print PDF
      </button>
    </div>
  );
}
