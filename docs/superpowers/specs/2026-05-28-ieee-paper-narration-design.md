# IEEE Paper Narration Design

## Goal

Upgrade Blackheart research papers from a data dashboard (charts + tables) into publication-quality IEEE academic papers with AI-generated chapter prose, proper LaTeX/PDF export via `IEEEtran`, and client-side Word export.

## Architecture

**Cross-repo feature** spanning two codebases:

- `blackheart-research-orchestrator` (Python) — LLM chapter generation, LaTeX template upgrade, new PDF compilation endpoint
- `blackheart-frontend` (Next.js 14) — chapter rendering, Word export, export button changes

## Data Model

### New field on `PaperDetail`

```typescript
sections: PaperSection[] | null;

interface PaperSection {
  chapter: number;   // 1, 2, 3…
  title: string;     // e.g. "Introduction", "Methodology", "Results"
  body: string;      // Full prose, markdown-compatible (200–600 words per chapter)
}
```

Added to `src/types/papers.ts` alongside the existing `PaperDetail` fields.

### Backend storage

New JSONB column `sections` on the `research_paper` table in the orchestrator DB. Populated by the `generate` endpoint. Old papers have `sections = null` — the frontend falls back to the current data-only layout gracefully.

---

## Backend Changes (`blackheart-research-orchestrator`)

### 1. Chapter generation

`POST /api/v1/research-orch/papers/{queueId}/generate` is extended to run a second LLM call after writing the abstract.

**LLM prompt context includes:**
- `strategy_code`, `instrument`, `interval_name`, `hypothesis`
- All `best_iteration.metrics` (CAGR, Sharpe, DSR, PF, drawdown, trade count)
- `best_iteration.params`
- `metadata.sweep_type`, `metadata.n_iterations`, `metadata.backtest_period`
- `best_iteration.regime_breakdown`, `best_iteration.slippage_sensitivity`
- `verdict_gate` pass/fail results
- `journal_entries` (quant audit trail)
- `best_iteration.statistical_verdict` and `best_iteration.quant_audit_notes`

**LLM instruction:** "Write an IEEE-quality research paper in JSON format with appropriate chapters for this quantitative strategy research. Use as many chapters as the material warrants — typically Introduction, Methodology, Results, Discussion, Conclusion, but add domain-specific chapters (e.g. Walk-Forward Validation, Robustness Analysis) when the data supports them. Return a JSON array of `{ chapter: number, title: string, body: string }`. Each body should be 200–600 words of rigorous academic prose."

**Storage:** The returned array is stored in `research_paper.sections` (JSONB). Included in the `PaperDetail` API response.

### 2. LaTeX template upgrade

The existing LaTeX generator (used by `GET /papers/{paperId}/export/latex`) is updated to:
- Use `\documentclass[journal]{IEEEtran}` (official IEEE two-column class)
- Render each `sections[]` chapter as `\section{title}` + body prose
- Embed charts as `\figure` environments with captions (PNG images fetched from chart data)
- Render `citations[]` as IEEE `\bibitem` entries
- Exclude gate tables, parameter tables, top iterations, robustness tables — these are web-only additional info

### 3. New PDF endpoint

`GET /api/v1/research-orch/papers/{paperId}/export/pdf`

Runs `pdflatex` on the LaTeX output via subprocess, returns the compiled `.pdf` with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="paper-{paperId}.pdf"`.

The existing `/export/latex` endpoint is unchanged — still available for users who want the raw `.tex`.

---

## Frontend Changes (`blackheart-frontend`)

### 1. Type update

Add `PaperSection` interface and `sections: PaperSection[] | null` to `PaperDetail` in `src/types/papers.ts`.

### 2. Paper detail page rendering (`src/app/(dashboard)/research/papers/[id]/page.tsx`)

**When `paper.sections` is present (new papers):**

Page structure becomes:

```
Title + metadata header
│
├── Chapter 1: Introduction          ← prose from sections[0]
├── Chapter 2: Methodology           ← prose from sections[1]
├── Chapter N-1: Results             ← prose + equity curve + monthly heatmap embedded inline
├── Chapter N: Conclusion            ← prose from sections[last]
│
├── [Additional Information header]  ← collapsible, web-only
│   ├── Statistical Gate Results
│   ├── Best Parameters
│   ├── Top Iterations
│   ├── Robustness
│   └── Research Notes
│
└── References                       ← IEEE-numbered, always shown
```

Charts (equity curve, monthly returns, trade P&L, walk-forward) are embedded immediately after the chapter whose `title` contains "result" (case-insensitive match). If no chapter matches, charts appear after the last chapter, before Additional Information. Charts are placed as a block below that chapter's prose — no prose parsing required.

**When `paper.sections` is null (old papers):** current layout is preserved exactly — no regression.

**Chapter prose styling:**
- Chapter number + title: `font-display` heading, consistent with existing section heading style
- Body: `text-[14px] leading-relaxed text-text-primary` — readable prose weight
- Figure captions: `font-mono text-[11px] text-text-muted` centered below each chart

**Sidebar table of contents:** updated to list `sections[].title` dynamically when chapters are present.

**Print/PDF via browser:** `@media print` hides the Additional Information block entirely. Only chapters + inline charts + References print. (Browser print is secondary — the real PDF comes from the backend endpoint.)

### 3. Additional Information section

The existing data-only sections (Statistical Gate Results, Best Parameters, Top Iterations, Robustness, Research Notes) are grouped under a clearly labelled "Additional Information" collapsible block:
- Visible on the web page, expanded by default
- `print:hidden` — excluded from browser print
- Not included in Word or PDF downloads

### 4. Word export (`src/components/research/papers/ExportButtons.tsx` + new helper)

New `buildIeeeDocx(paper: PaperDetail): Promise<Blob>` function in `src/lib/export/buildIeeeDocx.ts` using the `docx` npm package.

**`.docx` structure:**
- Title paragraph (bold, centered, 14pt)
- Author line: `{paper.created_by} — Blackheart Research` (centered, 10pt)
- Abstract (italic block)
- Each chapter: `Heading1` style (numbered `1. Introduction`), body as `Normal` paragraphs
- Charts: captured as PNG via `html2canvas` from the rendered DOM, embedded as inline `ImageRun` with figure captions
- References: numbered list matching `citations[]` in IEEE style `[1] key — text`

**Word styles used:**
- Body: Times New Roman 10pt
- Headings: Times New Roman 12pt bold
- Two-column layout via Word `SectionType.CONTINUOUS` with two equal columns
- Margins: 1 inch all sides

Excludes Additional Information sections (gates, params, iterations, robustness, notes) — same rule as PDF.

"Export Word" button triggers `buildIeeeDocx(paper)`, saves via `URL.createObjectURL` + `<a download>`.

### 5. Export buttons update (`src/components/research/papers/ExportButtons.tsx`)

Three export buttons (replacing current two):

| Button | Action | What it produces |
|--------|--------|-----------------|
| Export LaTeX | Direct download link to `/export/latex` | `.tex` source file |
| Export PDF | Direct download link to `/export/pdf` | Compiled IEEE PDF via `IEEEtran` |
| Export Word | Client-side `buildIeeeDocx()` | `.docx` file |

---

## Fallback Behaviour

| Condition | Behaviour |
|-----------|-----------|
| `paper.sections === null` (old paper) | Current data-only layout, no chapters shown |
| `paper.sections === []` (generation failed) | Same as null — data-only layout |
| Chapter body is empty string | Chapter heading still shown, body omitted |
| PDF endpoint unavailable | Button shows error toast; LaTeX button still works |
| `html2canvas` fails for a chart | That chart is omitted from Word; others proceed |

---

## Scope Boundaries

**In scope:**
- Backend: chapter LLM generation, LaTeX template upgrade to IEEEtran, new PDF compilation endpoint
- Frontend: type update, chapter rendering, Additional Information grouping, Word export, export button changes

**Out of scope:**
- Editing chapter text in the UI (read-only display)
- Per-chapter regeneration (full paper regenerate via existing button)
- Figure cross-referencing automation (chapters reference figures by prose, not `\ref{}` keys)
- Real publisher submission tooling (the output is IEEE-compatible, not guaranteed accepted)
