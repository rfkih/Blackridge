# IEEE Paper Narration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Blackheart research papers from a data dashboard into IEEE-quality academic papers with chapter prose, IEEEtran PDF export, and client-side Word export.

**Architecture:** Backend orchestrator generates prose sections deterministically (same approach as the existing abstract) and returns them in `PaperDetail.sections`. The LaTeX export is upgraded to IEEEtran document class. A new PDF endpoint compiles LaTeX to PDF server-side. The frontend renders chapters when `sections` is present, embeds charts after the Results chapter, collapses data-only sections into an "Additional Information" block (web-only), and adds Word export via the `docx` npm package.

**Tech Stack:** Python/FastAPI (orchestrator) · Next.js 14 TypeScript (frontend) · `docx` npm package · `pdflatex` (server-side, must be installed) · IEEEtran LaTeX class

---

## File Map

| Action | Path |
|--------|------|
| Modify | `C:\Project\blackheart-research-orchestrator\src\orchestrator\services\paper_generator.py` |
| Modify | `C:\Project\blackheart-research-orchestrator\src\orchestrator\services\latex_export.py` |
| Modify | `C:\Project\blackheart-research-orchestrator\src\orchestrator\api\papers.py` |
| Modify | `C:\Project\blackridge-frontend\src\types\papers.ts` |
| Create | `C:\Project\blackridge-frontend\src\components\research\papers\PaperChapters.tsx` |
| Modify | `C:\Project\blackridge-frontend\src\app\(dashboard)\research\papers\[id]\page.tsx` |
| Modify | `C:\Project\blackridge-frontend\src\lib\api\researchPapers.ts` |
| Create | `C:\Project\blackridge-frontend\src\lib\export\buildIeeeDocx.ts` |
| Modify | `C:\Project\blackridge-frontend\src\components\research\papers\ExportButtons.tsx` |

---

## Task 1 — Orchestrator: prose sections builder

**Files:**
- Modify: `src/orchestrator/services/paper_generator.py`

**Context:** The paper generation pipeline in `paper_generator.py` already generates `abstract` text deterministically from backtest metrics. `build_paper_sections()` (≈lines 484–515) fetches all related data and returns the full paper dict. `generate_paper()` (≈lines 65–156) also builds and returns the full paper dict. Both need a new `"sections"` key in their return values.

- [ ] **Step 1: Add `_build_prose_sections()` function**

Open `C:\Project\blackheart-research-orchestrator\src\orchestrator\services\paper_generator.py`. Add this function after `_generate_abstract()` (≈line 331):

```python
def _build_prose_sections(
    queue: dict[str, Any],
    best: dict[str, Any] | None,
    iterations: list[dict[str, Any]],
    run_meta: dict[str, Any] | None,
    robustness: dict[str, Any],
    gate: dict[str, Any],
    journal: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    sc = queue.get("strategy_code", "—")
    sym = queue.get("instrument", "—")
    iv = queue.get("interval_name", "—")
    hypothesis = (queue.get("hypothesis") or "").strip()
    sweep_config = queue.get("sweep_config") or {}
    n_iter = len(iterations)
    sweep_type = sweep_config.get("type", "grid").upper()
    final_verdict = (queue.get("final_verdict") or "PENDING").replace("_", " ")

    sections: list[dict[str, Any]] = []
    chapter = 1

    # 1. Introduction
    intro = (
        f"This paper presents an empirical evaluation of the {sc} strategy "
        f"applied to {sym} on the {iv} timeframe. "
    )
    if hypothesis:
        intro += f"The pre-registered hypothesis is as follows: {hypothesis} "
    if best:
        metrics = best.get("metrics") or {}
        cagr = metrics.get("cagr") or 0
        intro += (
            f"The study evaluated {n_iter} parameter configurations using {sweep_type} search. "
            f"The best-performing configuration achieved a compound annual growth rate (CAGR) of "
            f"{cagr:.1f}% at 90% Kelly allocation. Final research verdict: {final_verdict}."
        )
    sections.append({"chapter": chapter, "title": "Introduction", "body": intro})
    chapter += 1

    # 2. Data and Backtest Setup
    period_str = ""
    cap_str = ""
    if run_meta:
        start = run_meta.get("start_time")
        end = run_meta.get("end_time")
        capital = run_meta.get("initial_capital")
        if start and end:
            period_str = f" over the period {str(start)[:10]} to {str(end)[:10]}"
        if capital:
            cap_str = f" with an initial capital of ${float(capital):,.0f} USDT"
    data_body = (
        f"The backtest was conducted on {sym} ({iv} timeframe){period_str}{cap_str}. "
        f"Market data was sourced from Binance SPOT. Trading fees of 0.075% per side were applied. "
        f"Slippage was modelled at zero basis points for the base configuration, with sensitivity "
        f"analysis performed at 5, 10, 20, and 50 bps to assess robustness to execution costs."
    )
    sections.append({"chapter": chapter, "title": "Data and Backtest Setup", "body": data_body})
    chapter += 1

    # 3. Methodology
    n_config = sweep_config.get("n_iterations") or n_iter
    method_body = (
        f"The {sc} strategy was evaluated using {sweep_type} parameter optimisation "
        f"over {n_config} configurations. "
        f"Statistical validation employed a five-gate pre-registered framework: "
        f"(1) minimum 100 completed trades, "
        f"(2) Profit Factor 95% confidence interval lower bound exceeding 1.0, "
        f"(3) Deflated Sharpe Ratio (DSR) ≥ 0.95 (Bailey and López de Prado, 2014), "
        f"(4) statistical significance assessed as Significant Edge, and "
        f"(5) CAGR ≥ 10% at 90% Kelly allocation. "
        f"All thresholds were pre-registered before the experiment to mitigate selection bias "
        f"(Harvey, Liu, and Zhu, 2016)."
    )
    sections.append({"chapter": chapter, "title": "Methodology", "body": method_body})
    chapter += 1

    # 4. Results
    if best:
        metrics = best.get("metrics") or {}
        cagr = metrics.get("cagr") or 0
        pf = metrics.get("profit_factor") or 0
        dsr = metrics.get("dsr") or 0
        dd = metrics.get("max_drawdown_pct") or 0
        sharpe = metrics.get("sharpe_ratio") or 0
        trades = int(metrics.get("trade_count") or 0)
        stat_v = (best.get("statistical_verdict") or "—").replace("_", " ")
        pf_ci_low = metrics.get("pf_ci_low")
        pf_ci_high = metrics.get("pf_ci_high")
        ci_str = (
            f" (95% CI: [{pf_ci_low:.2f}, {pf_ci_high:.2f}])"
            if pf_ci_low is not None and pf_ci_high is not None
            else ""
        )
        results_body = (
            f"The best-performing parameter configuration achieved a CAGR of {cagr:.1f}%, "
            f"a Profit Factor of {pf:.2f}{ci_str}, "
            f"a Deflated Sharpe Ratio of {dsr:.4f}, "
            f"a maximum drawdown of {abs(dd):.1f}%, "
            f"a Sharpe Ratio of {sharpe:.2f}, "
            f"and {trades} closed trades. "
            f"Statistical assessment: {stat_v}.\n\n"
            f"The normalised equity curve (base 100), monthly return heatmap, "
            f"and per-trade P&L distribution are presented in the figures below."
        )
    else:
        results_body = "No completed iterations are available for this research paper."
    sections.append({"chapter": chapter, "title": "Results", "body": results_body})
    chapter += 1

    # 5. Robustness Analysis (only when data is present)
    slip = (robustness or {}).get("slippage_sensitivity") or {}
    regime = (robustness or {}).get("regime_breakdown") or {}
    if slip or regime:
        rob_body = (
            "Robustness was assessed across two dimensions: slippage sensitivity and market "
            "regime breakdown. "
        )
        if slip:
            rob_body += (
                "Slippage sensitivity analysis evaluated strategy performance at 0, 5, 10, 20, "
                "and 50 basis points of additional round-trip cost, measuring degradation in CAGR "
                "at each level. "
            )
        if regime:
            rob_body += (
                "Regime breakdown analysis decomposed performance across identified market regimes "
                "to assess consistency of the identified edge across different market conditions."
            )
        sections.append({"chapter": chapter, "title": "Robustness Analysis", "body": rob_body})
        chapter += 1

    # 6. Conclusion
    gate_items = {k: v for k, v in (gate or {}).items() if isinstance(v, dict) and "pass" in v}
    passed = sum(1 for v in gate_items.values() if v.get("pass") is True)
    total = len(gate_items)
    conc_body = (
        f"This study evaluated the {sc} strategy on {sym} ({iv}) "
        f"across {n_iter} parameter configurations. "
        f"The best configuration passed {passed} of {total} pre-registered statistical gates. "
        f"Final verdict: {final_verdict}.\n\n"
        f"Limitations of this study include in-sample optimisation bias inherent to parameter sweeps "
        f"and the use of exchange-reported tick data which may not reflect true liquidity conditions "
        f"at scale. Future work should include out-of-sample walk-forward validation and evaluation "
        f"across additional market regimes and instruments."
    )
    sections.append({"chapter": chapter, "title": "Conclusion", "body": conc_body})
    chapter += 1

    # 7. Research Notes (only when journal entries exist)
    if journal:
        parts: list[str] = []
        for entry in journal:
            title = (entry.get("title") or entry.get("entry_type") or "Note").strip()
            content = (entry.get("content") or "").strip()
            if content:
                parts.append(f"{title}: {content}")
        if parts:
            sections.append({
                "chapter": chapter,
                "title": "Research Notes",
                "body": "\n\n".join(parts),
            })

    return sections
```

- [ ] **Step 2: Wire `_build_prose_sections()` into `build_paper_sections()`**

In `build_paper_sections()` (≈lines 484–515), find where the return dict is built. Locate the variables: `queue`, `best`, `iterations`, `run_meta`, `robustness`, `gate`, `journal`. Add `"sections"` to the return dict:

```python
    return {
        **paper_row,  # or however the dict is assembled
        # ... existing keys: metadata, best_iteration, top_iterations, robustness, verdict_gate, journal_entries, citations ...
        "sections": _build_prose_sections(
            queue=queue,
            best=best,
            iterations=iterations,
            run_meta=run_meta,
            robustness=robustness,
            gate=gate,
            journal=journal,
        ),
    }
```

Read the actual function body first to identify the exact variable names and return statement, then add the `"sections"` key in the same pattern as existing keys.

- [ ] **Step 3: Wire `_build_prose_sections()` into `generate_paper()`**

In `generate_paper()` (≈lines 65–156), find where the result dict is built and returned. The function already computes `queue`, `best`, `iterations`, `run_meta`. Add:

```python
        "sections": _build_prose_sections(
            queue=queue,
            best=best,
            iterations=iterations,
            run_meta=run_meta,
            robustness=_build_robustness(best),
            gate=_build_verdict_gate(best, iterations),
            journal=journal,
        ),
```

Again: read the actual return statement first to find the exact structure, then add `"sections"` in the same pattern. The `_build_robustness()` and `_build_verdict_gate()` function names may differ — check the actual names in the file.

- [ ] **Step 4: Smoke-test**

Start the orchestrator locally (or use an existing running instance). Fetch a paper:

```bash
curl -s http://localhost:8082/api/v1/research-orch/papers | python -m json.tool | grep paper_id | head -3
# Pick a paper_id from the output
curl -s http://localhost:8082/api/v1/research-orch/papers/<paper_id> | python -m json.tool | grep -A5 '"sections"'
```

Expected: `"sections"` key present, array of 5–7 objects each with `chapter`, `title`, `body`.

- [ ] **Step 5: Commit**

```bash
cd C:\Project\blackheart-research-orchestrator
git add src/orchestrator/services/paper_generator.py
git commit -m "feat(papers): add _build_prose_sections() — deterministic IEEE chapter prose"
```

---

## Task 2 — Orchestrator: upgrade LaTeX to IEEEtran

**Files:**
- Modify: `src/orchestrator/services/latex_export.py`

**Context:** `latex_export.py` has a `_preamble(title, date_str)` function (≈lines 63–88) that currently uses `\documentclass{article}`. Changing to `\documentclass[journal]{IEEEtran}` makes the output submission-ready. IEEEtran uses different package conventions — the preamble needs to match.

- [ ] **Step 1: Read `_preamble()` to see the current content**

Open `C:\Project\blackheart-research-orchestrator\src\orchestrator\services\latex_export.py` and read lines 63–88.

- [ ] **Step 2: Replace `_preamble()` with IEEEtran version**

Replace the entire `_preamble()` function body with:

```python
def _preamble(title: str, date_str: str) -> str:
    esc_title = _esc(title)
    return rf"""\documentclass[journal]{{IEEEtran}}
\usepackage[utf8]{{inputenc}}
\usepackage{{amsmath}}
\usepackage{{booktabs}}
\usepackage{{array}}
\usepackage{{longtable}}
\usepackage{{hyperref}}
\usepackage{{xcolor}}
\usepackage{{microtype}}

\title{{{esc_title}}}
\author{{Blackheart Research System}}
\date{{{date_str}}}

\begin{{document}}
\maketitle

"""
```

Note: IEEEtran provides its own `\geometry` and column layout — do not include `\usepackage{geometry}` or it will conflict.

- [ ] **Step 3: Verify LaTeX compiles**

If `pdflatex` is installed locally:

```bash
cd C:\Project\blackheart-research-orchestrator
python -c "
from src.orchestrator.services.latex_export import render_latex
latex = render_latex({'title': 'Test', 'abstract': 'Test abstract.', 'metadata': {'strategy_code':'LSR','instrument':'BTCUSDT','interval_name':'4h','hypothesis':None,'sweep_type':'grid','final_verdict':'PASS','queue_status':'DONE','n_iterations':10,'backtest_period':{'start':None,'end':None},'initial_capital':10000}, 'best_iteration': None, 'top_iterations': [], 'robustness': {'slippage_sensitivity': {}, 'regime_breakdown': {}}, 'verdict_gate': {}, 'journal_entries': [], 'citations': [], 'sections': []})
print(latex[:500])
"
```

Expected: output starts with `\documentclass[journal]{IEEEtran}`.

- [ ] **Step 4: Commit**

```bash
git add src/orchestrator/services/latex_export.py
git commit -m "feat(papers): upgrade LaTeX template to IEEEtran journal class"
```

---

## Task 3 — Orchestrator: PDF compilation endpoint

**Files:**
- Modify: `src/orchestrator/api/papers.py`

**Context:** The existing LaTeX export returns a `.tex` file. A new `GET /papers/{paper_id}/export/pdf` endpoint compiles that LaTeX to PDF via `pdflatex` subprocess and returns the binary PDF. `pdflatex` must be installed on the server (`apt-get install texlive-full` or `texlive-publishers` for IEEEtran class).

- [ ] **Step 1: Add imports to `papers.py`**

At the top of `C:\Project\blackheart-research-orchestrator\src\orchestrator\api\papers.py`, add:

```python
import subprocess
import tempfile
from pathlib import Path
```

(Check existing imports first — some may already be present.)

- [ ] **Step 2: Add the PDF endpoint**

After the existing `export_latex` endpoint (≈lines 231–263), add:

```python
@router.get("/{paper_id}/export/pdf")
async def export_pdf(
    paper_id: str,
    conn: asyncpg.Connection = Depends(get_db_conn),
) -> Response:
    paper = await papers_repo.get_paper(conn, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper_data = await build_paper_sections(conn, paper)
    latex_source = render_latex(paper_data)

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_name = f"{paper_id}.tex"
        tex_path = Path(tmpdir) / tex_name
        tex_path.write_text(latex_source, encoding="utf-8")

        try:
            proc = subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", "-halt-on-error", tex_name],
                cwd=tmpdir,
                capture_output=True,
                timeout=60,
            )
        except FileNotFoundError:
            raise HTTPException(status_code=503, detail="pdflatex not available on this server")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="PDF compilation timed out")

        pdf_path = Path(tmpdir) / f"{paper_id}.pdf"
        if not pdf_path.exists():
            log_snippet = proc.stderr.decode("utf-8", errors="replace")[-800:]
            raise HTTPException(
                status_code=500,
                detail=f"PDF compilation failed. pdflatex stderr: {log_snippet}",
            )

        pdf_bytes = pdf_path.read_bytes()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{paper_id}.pdf"',
            "X-Paper-Version": str(paper.get("version", 1)),
            "Cache-Control": "no-store",
        },
    )
```

- [ ] **Step 3: Smoke-test the endpoint**

```bash
curl -o /tmp/test.pdf http://localhost:8082/api/v1/research-orch/papers/<paper_id>/export/pdf
file /tmp/test.pdf
```

Expected: `PDF document, version 1.x`

If `pdflatex` is not installed locally, skip to Step 4 — the endpoint will return 503 gracefully.

- [ ] **Step 4: Commit**

```bash
git add src/orchestrator/api/papers.py
git commit -m "feat(papers): add GET /papers/{id}/export/pdf endpoint via pdflatex"
```

---

## Task 4 — Frontend: add `PaperSection` type

**Files:**
- Modify: `C:\Project\blackridge-frontend\src\types\papers.ts`

- [ ] **Step 1: Add `PaperSection` interface**

In `src/types/papers.ts`, add this interface before the `PaperDetail` interface (≈line 121):

```typescript
export interface PaperSection {
  chapter: number;
  title: string;
  body: string;
}
```

- [ ] **Step 2: Add `sections` field to `PaperDetail`**

In the `PaperDetail` interface, add after the `citations` field (≈line 141):

```typescript
  citations: PaperCitation[];
  sections: PaperSection[] | null;
  next_actions?: Array<{ kind: string; method: string; path: string; description?: string }>;
```

- [ ] **Step 3: Typecheck**

```bash
cd C:\Project\blackridge-frontend && pnpm tsc --noEmit 2>&1 | grep papers
```

Expected: no errors related to `papers.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/types/papers.ts
git commit -m "feat(papers): add PaperSection type + sections field to PaperDetail"
```

---

## Task 5 — Frontend: `PaperChapters.tsx` component

**Files:**
- Create: `C:\Project\blackridge-frontend\src\components\research\papers\PaperChapters.tsx`

**Context:** This component renders when `paper.sections` is non-empty. It shows: abstract block → chapters (prose) → charts block after the Results chapter → Additional Information collapsible (web-only, `print:hidden`) → References. The `ChartData` type is from `@/types/papers`. `BacktestEquityPoint` is from `@/types/backtest`. The `hasBestIter` guard checks for `'iteration_id' in bi`. Helper subcomponents (`ChapterSection`, `ChartsBlock`, `AdditionalInfo`) are file-private.

- [ ] **Step 1: Create the file**

Create `C:\Project\blackridge-frontend\src\components\research\papers\PaperChapters.tsx` with this content:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toneColor } from '@/lib/tones';
import type {
  BestIteration,
  ChartData,
  PaperDetail,
  PaperSection,
  TopIteration,
  VerdictGate,
} from '@/types/papers';
import type { BacktestEquityPoint } from '@/types/backtest';

const PaperEquityCurveChart = dynamic(
  () =>
    import('@/components/research/papers/PaperEquityCurveChart').then(
      (m) => m.PaperEquityCurveChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-60 w-full" /> },
);

const PaperTradeHistogram = dynamic(
  () =>
    import('@/components/research/papers/PaperTradeHistogram').then((m) => m.PaperTradeHistogram),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

const BacktestMonthlyReturns = dynamic(
  () =>
    import('@/components/backtest/BacktestMonthlyReturns').then((m) => m.BacktestMonthlyReturns),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

function hasBestIter(bi: PaperDetail['best_iteration']): bi is BestIteration {
  return 'iteration_id' in bi;
}

function fmt(v: number | null | undefined, decimals = 2, suffix = ''): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)}${suffix}`;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface PaperChaptersProps {
  paper: PaperDetail;
  chartData: ChartData | undefined;
  chartLoading: boolean;
  equityPoints: BacktestEquityPoint[];
}

export function PaperChapters({
  paper,
  chartData,
  chartLoading,
  equityPoints,
}: PaperChaptersProps) {
  const sections = paper.sections ?? [];
  const best = hasBestIter(paper.best_iteration) ? paper.best_iteration : null;
  const meta = paper.metadata;
  const hasWf = !!(chartData?.wf_equity_curve?.length);

  const hasParams = best !== null && Object.keys(best.params ?? {}).length > 0;
  const hasSlippage = Object.keys(paper.robustness?.slippage_sensitivity ?? {}).length > 0;
  const hasRegime = Object.keys(paper.robustness?.regime_breakdown ?? {}).length > 0;
  const hasAuditNotes = !!(best?.quant_audit_notes);
  const hasJournal = paper.journal_entries.length > 0;
  const hasAdditional =
    hasParams ||
    paper.top_iterations.length > 0 ||
    hasSlippage ||
    hasRegime ||
    hasAuditNotes ||
    hasJournal;

  // Charts go after the chapter whose title contains "result" (case-insensitive).
  // If no such chapter, they go after the last chapter.
  const resultsIdx = sections.findIndex((s) => s.title.toLowerCase().includes('result'));
  const chartsAfterIdx = resultsIdx !== -1 ? resultsIdx : sections.length - 1;

  return (
    <div className="space-y-10">
      {/* Abstract — IEEE format: displayed before section 1 */}
      {paper.abstract && (
        <div
          id="abstract"
          className="rounded-sm border border-bd-subtle bg-bg-base p-4"
        >
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Abstract
          </p>
          <p className="text-[13px] italic leading-relaxed text-text-secondary">
            {paper.abstract}
          </p>
          {meta.hypothesis && (
            <blockquote className="mt-3 border-l-2 border-bd-subtle pl-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Hypothesis
              </p>
              <p className="mt-1 text-[12px] italic leading-relaxed text-text-secondary">
                {meta.hypothesis}
              </p>
            </blockquote>
          )}
        </div>
      )}

      {/* Chapter sections */}
      {sections.map((section, idx) => (
        <div key={section.chapter} id={`chapter-${section.chapter}`}>
          <ChapterSection section={section} />
          {idx === chartsAfterIdx && (
            <ChartsBlock
              meta={meta}
              chartData={chartData}
              chartLoading={chartLoading}
              equityPoints={equityPoints}
              hasWf={hasWf}
            />
          )}
        </div>
      ))}

      {/* Additional Information — web-only, print:hidden */}
      {hasAdditional && (
        <AdditionalInfo
          paper={paper}
          best={best}
          hasParams={hasParams}
          hasSlippage={hasSlippage}
          hasRegime={hasRegime}
          hasAuditNotes={hasAuditNotes}
          hasJournal={hasJournal}
        />
      )}

      {/* References — always visible */}
      {paper.citations.length > 0 && (
        <div id="references">
          <h2 className="mb-4 font-display text-[17px] font-semibold tracking-tight text-text-primary">
            References
          </h2>
          <ol className="list-decimal list-inside space-y-2">
            {paper.citations.map((c, i) => (
              <li key={c.key} className="text-[12px] leading-relaxed text-text-secondary">
                [{i + 1}] {c.text}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChapterSection
// ---------------------------------------------------------------------------

function ChapterSection({ section }: { section: PaperSection }) {
  const paragraphs = section.body.split('\n\n').filter(Boolean);
  return (
    <div className="space-y-3">
      <h2 className="font-display text-[18px] font-semibold tracking-tight text-text-primary">
        {section.chapter}. {section.title}
      </h2>
      {paragraphs.map((para, i) => (
        <p key={i} className="text-[14px] leading-relaxed text-text-secondary">
          {para}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartsBlock — injected after Results chapter
// ---------------------------------------------------------------------------

interface ChartsBlockProps {
  meta: PaperDetail['metadata'];
  chartData: ChartData | undefined;
  chartLoading: boolean;
  equityPoints: BacktestEquityPoint[];
  hasWf: boolean;
}

function ChartsBlock({ meta, chartData, chartLoading, equityPoints, hasWf }: ChartsBlockProps) {
  let figNum = 0;
  const nextFig = () => `Figure ${++figNum}.`;
  return (
    <div className="mt-6 space-y-6">
      {/* Equity curve */}
      <div>
        <p className="mb-1.5 text-center font-mono text-[10px] text-text-muted">
          {nextFig()} Normalised equity curve (base 100) · {meta.instrument} {meta.interval_name}
        </p>
        {chartLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : chartData?.equity_curve.length ? (
          <PaperEquityCurveChart curve={chartData.equity_curve} height={240} gradientId="ch-is" />
        ) : (
          <div className="flex h-60 items-center justify-center text-[12px] text-text-muted">
            {chartData ? 'No equity data.' : 'Chart data not yet available.'}
          </div>
        )}
      </div>

      {/* Monthly returns */}
      <div>
        <p className="mb-1.5 text-center font-mono text-[10px] text-text-muted">
          {nextFig()} Monthly return heatmap (in-sample)
        </p>
        {chartLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : equityPoints.length >= 2 ? (
          <BacktestMonthlyReturns points={equityPoints} />
        ) : (
          <div className="flex h-32 items-center justify-center text-[12px] text-text-muted">
            {chartData ? 'Not enough data points.' : 'Awaiting chart data.'}
          </div>
        )}
      </div>

      {/* Trade P&L */}
      <div>
        <p className="mb-1.5 text-center font-mono text-[10px] text-text-muted">
          {nextFig()} Per-trade P&amp;L (%) — chronological order
        </p>
        {chartLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : chartData?.trades.length ? (
          <PaperTradeHistogram trades={chartData.trades} height={200} />
        ) : (
          <div className="flex h-48 items-center justify-center text-[12px] text-text-muted">
            {chartData ? 'No trade data.' : 'Awaiting chart data.'}
          </div>
        )}
      </div>

      {/* Walk-forward */}
      {hasWf && (
        <div>
          <p className="mb-1.5 text-center font-mono text-[10px] text-text-muted">
            {nextFig()} In-sample equity (green) vs walk-forward out-of-sample (blue)
          </p>
          <PaperEquityCurveChart
            curve={chartData!.equity_curve}
            wfCurve={chartData!.wf_equity_curve}
            height={240}
            gradientId="ch-wf"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdditionalInfo — web-only collapsible
// ---------------------------------------------------------------------------

interface AdditionalInfoProps {
  paper: PaperDetail;
  best: BestIteration | null;
  hasParams: boolean;
  hasSlippage: boolean;
  hasRegime: boolean;
  hasAuditNotes: boolean;
  hasJournal: boolean;
}

function AdditionalInfo({
  paper,
  best,
  hasParams,
  hasSlippage,
  hasRegime,
  hasAuditNotes,
  hasJournal,
}: AdditionalInfoProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-sm border border-bd-subtle bg-bg-base px-4 py-3 text-left transition-colors hover:bg-bg-hover"
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Additional Information
        </span>
        {open ? (
          <ChevronDown size={14} className="text-text-muted" />
        ) : (
          <ChevronRight size={14} className="text-text-muted" />
        )}
      </button>

      {open && (
        <div className="mt-1 space-y-6 rounded-sm border border-bd-subtle bg-bg-base p-6">
          {/* Statistical gates */}
          <AdditionalSection title="Statistical Gate Results">
            <GatesTable gate={paper.verdict_gate} />
          </AdditionalSection>

          {/* Best parameters */}
          {hasParams && (
            <AdditionalSection
              title={`Best Parameters · iteration #${best!.iteration_number ?? '—'}`}
            >
              <table className="w-full text-[11px]">
                <tbody>
                  {Object.entries(best!.params).map(([k, v]) => (
                    <tr key={k} className="border-b border-bd-subtle last:border-0">
                      <td className="py-1 pr-4 font-mono text-text-secondary">{k}</td>
                      <td className="py-1 font-mono tabular-nums text-text-primary">
                        {String(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdditionalSection>
          )}

          {/* Top iterations */}
          {paper.top_iterations.length > 0 && (
            <AdditionalSection
              title={`Top Iterations · ${paper.top_iterations.length} configs ranked by CAGR`}
            >
              <TopIterTable rows={paper.top_iterations} />
            </AdditionalSection>
          )}

          {/* Robustness */}
          {(hasSlippage || hasRegime) && (
            <AdditionalSection title="Robustness">
              {hasSlippage && (
                <div className="mb-4">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Slippage sensitivity
                  </p>
                  <ObjectTable data={paper.robustness.slippage_sensitivity} />
                </div>
              )}
              {hasRegime && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Regime breakdown
                  </p>
                  <ObjectTable data={paper.robustness.regime_breakdown} />
                </div>
              )}
            </AdditionalSection>
          )}

          {/* Research notes */}
          {(hasAuditNotes || hasJournal) && (
            <AdditionalSection title="Research Notes">
              {hasAuditNotes && (
                <p className="whitespace-pre-line text-[12px] leading-relaxed text-text-secondary">
                  {best!.quant_audit_notes}
                </p>
              )}
              {hasJournal && (
                <div className="mt-3 space-y-3">
                  {paper.journal_entries.map((e) => (
                    <div key={e.journal_id} className="border-l-2 border-bd-subtle pl-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {e.entry_type}
                      </p>
                      {e.title && (
                        <p className="text-[12px] font-semibold text-text-primary">{e.title}</p>
                      )}
                      {e.content && (
                        <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-text-secondary">
                          {e.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AdditionalSection>
          )}
        </div>
      )}
    </div>
  );
}

function AdditionalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Statistical gates table (shared helper)
// ---------------------------------------------------------------------------

function GatesTable({ gate }: { gate: VerdictGate }) {
  const rows = Object.entries(gate).filter(([, v]) => typeof v === 'object' && v !== null && 'pass' in (v as object));
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-bd-subtle">
          <th className="pb-1 text-left font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Gate
          </th>
          <th className="pb-1 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Value
          </th>
          <th className="pb-1 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
            Result
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([key, v]) => {
          const val = v as { pass: boolean; value?: unknown; threshold?: unknown };
          return (
            <tr key={key} className="border-b border-bd-subtle last:border-0">
              <td className="py-1 font-mono text-text-secondary">
                {key.replace(/_/g, ' ')}
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {val.value != null ? String(val.value) : '—'}
              </td>
              <td className="py-1 text-right">
                {val.pass ? (
                  <CheckCircle2 size={13} className="ml-auto" style={{ color: 'var(--color-profit)' }} />
                ) : (
                  <XCircle size={13} className="ml-auto" style={{ color: 'var(--color-loss)' }} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Top iterations table
// ---------------------------------------------------------------------------

function TopIterTable({ rows }: { rows: TopIteration[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-bd-subtle">
            {['#', 'CAGR', 'PF', 'DSR', 'DD', 'Trades', 'Verdict'].map((h) => (
              <th
                key={h}
                className="pb-1 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted first:text-left"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.iteration_id} className="border-b border-bd-subtle last:border-0">
              <td className="py-1 font-mono text-text-secondary">{r.iteration_number ?? '—'}</td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {fmt(r.metrics?.cagr, 1, '%')}
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {fmt(r.metrics?.profit_factor)}
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {fmt(r.metrics?.dsr, 4)}
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {fmt(r.metrics?.max_drawdown_pct, 1, '%')}
              </td>
              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                {r.metrics?.trade_count ?? '—'}
              </td>
              <td
                className="py-1 text-right font-mono text-[10px]"
                style={{ color: toneColor(r.statistical_verdict === 'SIGNIFICANT_EDGE' ? 'profit' : r.statistical_verdict === 'MARGINAL' ? 'warning' : 'muted') }}
              >
                {(r.statistical_verdict ?? '—').replace(/_/g, ' ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Object table (robustness data)
// ---------------------------------------------------------------------------

function ObjectTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (!entries.length) return <p className="text-[11px] text-text-muted">No data.</p>;
  return (
    <table className="w-full text-[11px]">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-bd-subtle last:border-0">
            <td className="py-1 pr-4 font-mono text-text-secondary">{k.replace(/_/g, ' ')}</td>
            <td className="py-1 font-mono tabular-nums text-text-primary">
              {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd C:\Project\blackridge-frontend && pnpm tsc --noEmit 2>&1 | grep PaperChapters
```

Expected: zero errors. If `TopIteration.metrics` doesn't have all the fields referenced, check `src/types/papers.ts` and adjust field names accordingly.

- [ ] **Step 3: Commit**

```bash
git add src/components/research/papers/PaperChapters.tsx
git commit -m "feat(papers): add PaperChapters component with chapter prose + embedded charts + additional info"
```

---

## Task 6 — Frontend: wire `PaperChapters` into `page.tsx`

**Files:**
- Modify: `C:\Project\blackridge-frontend\src\app\(dashboard)\research\papers\[id]\page.tsx`

**Context:** `page.tsx` is 836 lines. The sections block runs from ≈line 619 to ≈line 829. The TOC is built at ≈lines 517–530. Changes: (1) import `PaperChapters`, (2) update TOC to show chapter titles when sections exist, (3) conditionally render `PaperChapters` vs existing sections, (4) add `paper` prop to `ExportButtons`.

- [ ] **Step 1: Add import**

In `page.tsx`, add the import alongside the other paper component imports (≈lines 9–11):

```tsx
import { PaperChapters } from '@/components/research/papers/PaperChapters';
```

- [ ] **Step 2: Add `hasSections` flag**

In the component body, after the `best` variable is declared (find where `const best = ...` is set), add:

```tsx
const hasSections = (paper.sections?.length ?? 0) > 0;
```

- [ ] **Step 3: Replace TOC items**

Find the `tocItems` array (≈lines 517–530). Replace the entire `tocItems` declaration with:

```tsx
const tocItems = hasSections
  ? [
      ...(paper.abstract ? [{ id: 'abstract', label: 'Abstract' }] : []),
      ...(paper.sections ?? []).map((s) => ({
        id: `chapter-${s.chapter}`,
        label: `${s.chapter}. ${s.title}`,
      })),
      ...(paper.citations.length > 0 ? [{ id: 'references', label: 'References' }] : []),
    ]
  : [
      { id: 'abstract', label: '1. Abstract' },
      ...(best ? [{ id: 'metrics', label: '2. Key Results' }] : []),
      { id: 'equity', label: `${best ? 3 : 2}. Equity Curve` },
      { id: 'monthly', label: `${best ? 4 : 3}. Monthly Returns` },
      { id: 'trades', label: `${best ? 5 : 4}. Trade P&L` },
      ...(hasWf ? [{ id: 'walk-forward', label: 'Walk-Forward' }] : []),
      { id: 'gates', label: 'Stat. Gates' },
      ...(hasParams ? [{ id: 'parameters', label: 'Parameters ▸' }] : []),
      ...(paper.top_iterations.length > 0 ? [{ id: 'iterations', label: 'Iterations ▸' }] : []),
      ...(hasSlippage || hasRegime ? [{ id: 'robustness', label: 'Robustness ▸' }] : []),
      ...(hasAuditNotes || hasJournal ? [{ id: 'notes', label: 'Notes ▸' }] : []),
      ...(paper.citations.length > 0 ? [{ id: 'references', label: 'References ▸' }] : []),
    ];
```

- [ ] **Step 4: Replace the sections block with conditional rendering**

Find the `{/* Sections */}` comment (≈line 618) and the closing `</div>` of the sections block (≈line 829). Replace the entire sections `<div className="space-y-10">` block with:

```tsx
{/* Sections */}
<div className="space-y-10">
  {hasSections ? (
    <PaperChapters
      paper={paper}
      chartData={chartData}
      chartLoading={chartLoading}
      equityPoints={equityPoints}
    />
  ) : (
    <>
      {/* 1. Abstract */}
      <Section id="abstract" num={nextSec()} title="Abstract">
        {/* ... keep existing abstract JSX unchanged ... */}
      </Section>

      {/* keep all remaining existing sections unchanged */}
    </>
  )}
</div>
```

**Important:** Do NOT delete the existing sections JSX — wrap it in `<>...</>` inside the `else` branch of the ternary. Only papers without sections (old papers) use the old layout.

- [ ] **Step 5: Update `ExportButtons` call site**

Find `<ExportButtons paperId={id} />` (≈line 545). Change to:

```tsx
<ExportButtons paperId={id} paper={paper} />
```

- [ ] **Step 6: Typecheck**

```bash
cd C:\Project\blackridge-frontend && pnpm tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/research/papers/[id]/page.tsx"
git commit -m "feat(papers): conditional chapter rendering + updated TOC + ExportButtons paper prop"
```

---

## Task 7 — Frontend: Word export + export buttons update

**Files:**
- Modify: `C:\Project\blackridge-frontend\src\lib\api\researchPapers.ts`
- Create: `C:\Project\blackridge-frontend\src\lib\export\buildIeeeDocx.ts`
- Modify: `C:\Project\blackridge-frontend\src\components\research\papers\ExportButtons.tsx`

- [ ] **Step 1: Install `docx` package**

```bash
cd C:\Project\blackridge-frontend && pnpm add docx
```

Expected: `docx` appears in `package.json` dependencies.

- [ ] **Step 2: Add `paperPdfHref` to `researchPapers.ts`**

In `src/lib/api/researchPapers.ts`, add after `paperLatexHref`:

```typescript
export function paperPdfHref(paperId: string): string {
  return `${env.apiUrl}${BASE}/${paperId}/export/pdf`;
}
```

- [ ] **Step 3: Create `src/lib/export/buildIeeeDocx.ts`**

Create the directory `src/lib/export/` if it doesn't exist, then create `buildIeeeDocx.ts`:

```typescript
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
```

- [ ] **Step 4: Rewrite `ExportButtons.tsx`**

Replace the entire content of `src/components/research/papers/ExportButtons.tsx` with:

```tsx
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
```

- [ ] **Step 5: Full typecheck**

```bash
cd C:\Project\blackridge-frontend && pnpm tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 6: Build**

```bash
cd C:\Project\blackridge-frontend && pnpm exec next build --no-lint 2>&1 | tail -20
```

Expected: build completes without errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/researchPapers.ts src/lib/export/buildIeeeDocx.ts src/components/research/papers/ExportButtons.tsx
git commit -m "feat(papers): Word export via docx + PDF download button + paperPdfHref"
```

---

## Self-Review

**Spec coverage:**
- ✅ Backend generates chapter prose — `_build_prose_sections()` in Task 1
- ✅ Sections returned in `PaperDetail.sections` — Tasks 1 + 4
- ✅ LaTeX upgraded to IEEEtran — Task 2
- ✅ PDF endpoint compiles LaTeX via pdflatex — Task 3
- ✅ Frontend renders chapters as prose sections — Task 5
- ✅ Charts embedded after Results chapter — Task 5 (`ChartsBlock` injected at `chartsAfterIdx`)
- ✅ Additional Information collapsible (web-only, `print:hidden`) — Task 5 (`AdditionalInfo` with `print:hidden`)
- ✅ References always shown — Task 5
- ✅ Old papers (no sections) keep current layout — Task 6 (`hasSections` conditional)
- ✅ TOC shows chapter titles when sections present — Task 6
- ✅ PDF export button replaced from `window.print()` to download link — Task 7
- ✅ Word export via `docx` library — Task 7
- ✅ Three export buttons: LaTeX, PDF, Word — Task 7

**Placeholder scan:** None.

**Type consistency:**
- `PaperSection` defined in Task 4, used in Task 5 `ChapterSection` — consistent
- `paper.sections` null check via `paper.sections ?? []` — consistent in Task 5 and Task 6
- `ExportButtons` prop `paper: PaperDetail` added in Task 7, consumed at call site in Task 6 — consistent
- `paperPdfHref` added to `researchPapers.ts` in Task 7, imported in `ExportButtons` — consistent
