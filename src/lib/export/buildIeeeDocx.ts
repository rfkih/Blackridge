import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  SectionType,
  TextRun,
} from 'docx';
import type { PaperDetail } from '@/types/papers';

// IEEE Times Roman 10pt body. docx `size` is in half-points: 20 = 10pt,
// 24 = 12pt (headings), 36 = 18pt (title).
const SIZE_BODY = 20;
const SIZE_META = 18;
const SIZE_HEADING = 24;
const SIZE_TITLE = 36;
const SIZE_ABSTRACT_HEADING = 22;

export async function buildIeeeDocx(paper: PaperDetail): Promise<Blob> {
  // Section 1 — single-column header (title + author + abstract span the page).
  const headerChildren: Paragraph[] = [];

  headerChildren.push(
    new Paragraph({
      children: [new TextRun({ text: paper.title, bold: true, size: SIZE_TITLE })],
      alignment: AlignmentType.CENTER,
    }),
  );

  headerChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: paper.created_by
            ? `${paper.created_by} — Blackheart Research`
            : 'Blackheart Research',
          italics: true,
          size: SIZE_BODY,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
  );

  const meta = paper.metadata;
  headerChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${meta.strategy_code} · ${meta.instrument} · ${meta.interval_name} · v${paper.version}`,
          size: SIZE_META,
          color: '888888',
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
  );

  headerChildren.push(new Paragraph({ text: '' }));

  if (paper.abstract) {
    headerChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'Abstract', bold: true, size: SIZE_ABSTRACT_HEADING })],
        alignment: AlignmentType.CENTER,
      }),
    );
    headerChildren.push(
      new Paragraph({
        children: [new TextRun({ text: paper.abstract, italics: true, size: SIZE_BODY })],
        alignment: AlignmentType.BOTH,
      }),
    );
  }

  // Section 2 — continuous 2-column body (chapters + references). Starting
  // this as `continuous` keeps it on the same page as the header section,
  // matching the IEEE convention of a one-column header above a two-column
  // body.
  const bodyChildren: Paragraph[] = [];

  for (const section of paper.sections) {
    bodyChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${section.chapter}. ${section.title}`,
            bold: true,
            size: SIZE_HEADING,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
      }),
    );
    const paragraphs = section.body.split('\n\n').filter(Boolean);
    for (const para of paragraphs) {
      bodyChildren.push(
        new Paragraph({
          children: [new TextRun({ text: para, size: SIZE_BODY })],
          alignment: AlignmentType.BOTH,
        }),
      );
    }
    bodyChildren.push(new Paragraph({ text: '' }));
  }

  if (paper.citations.length > 0) {
    bodyChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'References', bold: true, size: SIZE_HEADING })],
        heading: HeadingLevel.HEADING_1,
      }),
    );
    paper.citations.forEach((c, i) => {
      bodyChildren.push(
        new Paragraph({
          children: [new TextRun({ text: `[${i + 1}] ${c.text}`, size: SIZE_META })],
        }),
      );
    });
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: SIZE_BODY },
        },
      },
    },
    sections: [
      {
        properties: {
          column: { count: 1 },
        },
        children: headerChildren,
      },
      {
        properties: {
          type: SectionType.CONTINUOUS,
          column: { space: 708, count: 2 },
        },
        children: bodyChildren,
      },
    ],
  });

  return Packer.toBlob(doc);
}
