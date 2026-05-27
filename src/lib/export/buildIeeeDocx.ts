import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { PaperDetail } from '@/types/papers';

export async function buildIeeeDocx(paper: PaperDetail): Promise<Blob> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: paper.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
  );

  // Author line
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: paper.created_by ? `${paper.created_by} — Blackheart Research` : 'Blackheart Research',
          italics: true,
          size: 20,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
  );

  // Metadata line
  const meta = paper.metadata;
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${meta.strategy_code} · ${meta.instrument} · ${meta.interval_name} · v${paper.version}`,
          size: 18,
          color: '888888',
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
  );

  // Spacer
  children.push(new Paragraph({ text: '' }));

  // Abstract
  if (paper.abstract) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Abstract', bold: true, size: 22 })],
        alignment: AlignmentType.CENTER,
      }),
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: paper.abstract, italics: true, size: 20 })],
        alignment: AlignmentType.BOTH,
      }),
    );
    children.push(new Paragraph({ text: '' }));
  }

  // Chapters
  if (paper.sections?.length) {
    for (const section of paper.sections) {
      children.push(
        new Paragraph({
          text: `${section.chapter}. ${section.title}`,
          heading: HeadingLevel.HEADING_1,
        }),
      );
      const paragraphs = section.body.split('\n\n').filter(Boolean);
      for (const para of paragraphs) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: para, size: 20 })],
            alignment: AlignmentType.BOTH,
          }),
        );
      }
      children.push(new Paragraph({ text: '' }));
    }
  }

  // References
  if (paper.citations.length > 0) {
    children.push(
      new Paragraph({
        text: 'References',
        heading: HeadingLevel.HEADING_1,
      }),
    );
    paper.citations.forEach((c, i) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `[${i + 1}] ${c.text}`, size: 18 })],
        }),
      );
    });
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          column: { space: 708, count: 2 },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
