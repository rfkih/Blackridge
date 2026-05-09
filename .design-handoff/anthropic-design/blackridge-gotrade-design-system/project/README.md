# Blackridge × Gotrade Design System

A redesign of **Blackridge** (the Meridian Edge algo-trading dashboard) reimagined in the visual language of **Gotrade** — a Singapore-based fractional-investing app whose ethos is _"investing made fun, fair and simple for everyone, everywhere"_.

The original Blackridge product is a dark, data-dense, Bloomberg-terminal-style dashboard for power-user quant traders. This design system pulls it the other direction: **bright, friendly, mobile-first, emoji-warm, rounded, optimistic** — without losing the precision a trading product requires.

## Index

| File | Purpose |
|---|---|
| `README.md` | This document — context, content rules, visual foundations, iconography. |
| `colors_and_type.css` | CSS variables for color, type, spacing, radius, shadow. Drop into any HTML file. |
| `SKILL.md` | Agent Skills compatibility manifest. |
| `assets/` | Logo, favicon, brand marks, illustrations. |
| `fonts/` | Web fonts (or Google Fonts substitution notes). |
| `preview/` | Cards rendered into the Design System tab. |
| `ui_kits/website/` | Marketing-website kit (Gotrade-style hero, features, CTA). |
| `ui_kits/dashboard/` | Authenticated trading-dashboard kit (Blackridge surfaces, redesigned). |

## Sources

- **Blackridge codebase**: `github.com/rfkih/Blackridge` (master). Key files read: `README.md`, `CLAUDE.md` (full design + architecture spec), `tailwind.config.ts`, `src/app/`, `src/components/`. The product is Next.js 14 + TanStack Query + Zustand + STOMP/WebSocket, dark-only, with surfaces for: Dashboard, Trades, Strategies, Backtest (config + param tuning + annotated chart), P&L, Portfolio, Market, Monte Carlo, Research.
- **Gotrade reference**: `heygotrade.com`, App Store + Play Store listings, TechCrunch + CB Insights coverage. Singapore-headquartered (Tanjong Pagar), 1M+ users across 150+ countries, fractional US-stock investing from $1, regulated by LFSA / SIPC-protected via Alpaca.

## What we're building

The user asked to **redesign Blackridge in the spirit of Gotrade**. That means:

- Keep Blackridge's information architecture and feature surface (positions, P&L, strategies, backtests, candles).
- Replace the "dark terminal luxury" visual language with Gotrade's "fun, fair, simple" language — light by default, generous whitespace, soft greens, friendly rounded geometry, emoji used sparingly as marketing accent.
- Preserve the semantic color contract (green = profit/long, red = loss/short, amber = warning) but warm the hues to match Gotrade's palette.
- Build a fresh logo in the Gotrade taste — wordmark + a simple geometric mark with the upward-trending motif Gotrade uses on `heygotrade.com`.

## Content fundamentals

**Voice.** Friendly, optimistic, reassuring. Talks _to_ the user (you/your), never down to them. Short declarative sentences. Numbers framed as opportunity, not pressure.

**Tone examples (lifted from Gotrade's actual surfaces):**
- _"Invest in US stocks from $1."_
- _"100 share lots? Forget about it."_ — playful contraction of friction
- _"Imagine how far your money could go."_ — aspirational
- _"Start trading — all from the palm of your hand ✋. No papers."_ — informal, single emoji as exclamation

**Casing.** Sentence case for everything except the wordmark. **Never** all-caps for headlines (caps are reserved for tiny eyebrow labels, optional). Buttons sentence case: `Buy`, `Open account`, `Continue` — not `BUY` or `OPEN ACCOUNT`.

**Pronouns.** Always "you/your". The brand voice is "we" only when explaining policy ("We don't charge hidden fees").

**Emoji.** Used **sparingly** in marketing copy as exclamation/punctuation (✋ 💰 🚀 ❤️ 🔒 ⏰ 🆓). **Never** in the dashboard product UI itself — that stays clean. Rule of thumb: emoji on the marketing site, no emoji once the user is logged in.

**Numbers.** Tabular nums everywhere. Always show the currency symbol. Always sign positive deltas (`+12.4%`, never `12.4%`). Big hero numbers get the display font; in-table numbers use mono.

**Trust language.** Where Blackridge said _"institutional-grade analytics"_, Gotrade says _"Your account is protected for up to USD 500,000"_. The same fact, framed for confidence rather than prowess. Carry that over.

## Visual foundations

### Color
- **Light mode is default.** Background `#FFFFFF`, surface `#F7FAF8` (a hair of green tint), elevated `#FFFFFF` with shadow.
- **Brand**: emerald / kelly green family. `--brand-500: #16B364` (primary), `--brand-600: #0E9F50` (hover/press), `--brand-50: #E8F8EE` (tinted surface). This sits between Robinhood-green and Spotify-green — confident, optimistic, financial-but-approachable.
- **Semantic**: profit `#16B364` (same as brand — profit IS the brand), loss `#E5484D`, warning `#F5A623`, info `#3B82F6`, neutral `#6B7280`.
- **Ink**: ink-900 `#0E1116` (primary text), ink-700 `#384151` (body), ink-500 `#6B7280` (secondary), ink-300 `#A8B0BC` (muted), ink-100 `#E5E8EC` (borders).
- **Dark mode is provided** for the dashboard (traders work at night) but it's a **soft dark** — `#0E1116` not pure black, with elevated panels at `#171B22`. The Blackridge dark-luxury aesthetic survives here, just in a warmer key.

### Type
- **Display + body**: `Plus Jakarta Sans` (Gotrade-adjacent geometric humanist). Substituted for whatever proprietary face Gotrade uses internally — flagged below.
- **Mono / numerics**: `JetBrains Mono` for tables, prices, P&L cells. Tabular-nums always on.
- **Scale**: `display-2xl 56/1` → `display-xl 44/1.05` → `display-lg 36/1.1` → `h1 28/1.2` → `h2 22/1.25` → `h3 18/1.3` → `body 15/1.55` → `caption 13/1.45` → `micro 11/1.4`. Tight letter-spacing on display sizes (`-0.02em`), normal on body.
- **Weights**: 400 body, 500 emphasis, 600 headings, 700 display.

### Spacing & layout
- 4px grid. Spacing tokens: `2, 4, 8, 12, 16, 20, 24, 32, 40, 56, 80, 120`.
- Marketing content max-width `1120px`, centered, generous (80–120px) vertical section padding.
- Dashboard content max-width `1440px`, sidebar `240px`, gutter `24px`.
- Touch targets `≥44px` on mobile, `≥36px` on desktop dense surfaces.

### Radius
- `sm 6px` (chips, inputs), `md 12px` (buttons, small cards), `lg 20px` (large cards, modals), `xl 28px` (hero cards on marketing). **Pill** (`9999px`) is allowed on tags and CTAs — Gotrade uses pills heavily.

### Shadow
- Soft, layered, never harsh.
- `shadow-sm`: `0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.03)`.
- `shadow-md`: `0 4px 12px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)`.
- `shadow-lg`: `0 12px 32px rgba(15,23,42,0.08), 0 2px 8px rgba(15,23,42,0.04)`.
- `shadow-glow-brand`: `0 8px 28px rgba(22,179,100,0.18)` — used sparingly on the primary CTA hover.

### Borders
- 1px `--ink-100` for resting, 1.5px `--brand-500` for focus rings.
- Inputs use a 1px border + a focus halo (2px `--brand-100`), not a thick stroke.

### Backgrounds
- **Marketing pages**: large soft shapes — wide rounded blob in `--brand-50` behind the hero, faint diagonal "money line" SVG pattern at low opacity. **No** photographic imagery in the brand chrome (Gotrade keeps it illustrative). One full-bleed dark-green section as a "trust band" toward the bottom of the homepage.
- **Dashboard**: flat white surface, occasional `--brand-50` tints for celebration states (e.g. positive day badge).
- **No** bluish-purple gradients. **No** glassmorphism. **No** repeating textures.

### Animation
- Easing default: `cubic-bezier(0.16, 1, 0.3, 1)` (gentle out-expo).
- Durations: `fast 150ms` (hover), `base 220ms` (state change), `slow 400ms` (page/panel reveal).
- Hover: lift `translateY(-1px)` + shadow step up. **Press**: scale `0.98`. P&L cells flash green/red on update (220ms fade).
- No bounce, no overshoot, no parallax. Motion is calm and confidence-building.

### Hover & press states
- Buttons (primary): hover darkens to `--brand-600`; press goes to `--brand-700` and `scale(0.98)`.
- Buttons (secondary/ghost): hover fills `--brand-50`, no shadow.
- List rows: hover `--surface-hover` (`#F2F5F4`), no left-border accent.
- Cards: hover lifts `1px` and bumps shadow; clickable cards get a subtle 1px border tint to `--brand-200` on hover.

### Transparency & blur
- Used **only** for: dropdown overlays (90% white + 12px blur on iOS-style menus), the sticky marketing nav (95% white + 8px blur on scroll). Never decorative.

### Imagery
- Gotrade leans on **clean SVG illustrations** of brand logos (Apple, Tesla, etc.) on neutral backgrounds, plus **phone mockups** showing the app. We replicate that vocabulary: stock-ticker chips with brand logos arranged in a soft grid, a single phone mockup hero. Color vibe is **warm, optimistic, daylight** — never cool/blue/cold.

### Cards
- Default card: white, 1px `--ink-100` border, `radius-lg (20px)`, `shadow-sm`, padding `24px`.
- Hero/stat card: white, no border, `shadow-md`, `radius-xl (28px)`, padding `32px`.
- Elevated/dialog: white, no border, `shadow-lg`, `radius-lg`, padding `24–32px`.
- All cards align to the 4px grid. No card has _just_ a colored left border (we explicitly avoid that trope).

## Iconography

- **System**: [Lucide](https://lucide.dev) — same set Blackridge already uses (`lucide-react`). Stroke 1.75, 20×20 default, 16×16 dense, 24×24 marketing. Loaded from CDN in our previews to avoid bundling.
- **Brand logos** (Apple, Tesla, Google, etc.) — used in marketing illustrations as colored SVGs from [simple-icons](https://simpleicons.org). On the dashboard, brand logos appear in 32×32 rounded-square tiles next to ticker symbols.
- **Emoji**: marketing-only, used as punctuation. Native system emoji.
- **No custom icon system, no icon font.** Lucide is the entire vocabulary.
- **Logos created here**:
  - `assets/logo-mark.svg` — geometric "B" with an embedded upward-trend line (Blackridge × Gotrade pun: rising ridge).
  - `assets/logo-wordmark.svg` — `Blackridge` set in the display weight, brand-green dot.
  - `assets/logo-stack.svg` — vertically stacked mark + wordmark for app icons / loaders.

## Caveats / substitutions

- **Fonts**: Gotrade's exact production typeface is not public. We substitute **Plus Jakarta Sans** from Google Fonts — same Indonesian-roots warmth, geometric humanist, similar aperture. Swap in real files at `fonts/` when available.
- **Photography**: none included. Marketing kit uses brand-logo tiles and a phone mockup placeholder; replace with real product screenshots when ready.
- **Logo**: synthesized in this project — Gotrade's mark is trademarked, so we drew our own in the same _spirit_ rather than copying it.

