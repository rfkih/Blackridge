const THEME_STORAGE_KEY = 'blackheart:theme';
const PALETTE_STORAGE_KEY = 'br.palette';

// IIFE runs in <head> before paint. Two responsibilities:
//   1. Resolve theme (dark/light) from localStorage → prefers-color-scheme → dark.
//   2. Resolve palette (midnight/slate/oxford) from localStorage → midnight.
//      Stale 'emerald' values from before the brand refresh fall through to
//      midnight (which now carries the ink-navy ramp).
const script = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var p=window.matchMedia('(prefers-color-scheme: light)').matches;var t=(s==='light'||s==='dark')?s:(p?'light':'dark');document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute('data-theme','dark');}try{var pp=localStorage.getItem('${PALETTE_STORAGE_KEY}');var ok=['midnight','slate','oxford'];var pal=(pp&&ok.indexOf(pp)>-1)?pp:'midnight';document.documentElement.setAttribute('data-palette',pal);}catch(e2){document.documentElement.setAttribute('data-palette','midnight');}})();`;

export function ThemeScript() {
  // Bootstrap script runs before React hydrates, so it must ship as raw
  // HTML. Content is a literal string we wrote — not user data — so the
  // no-danger warning doesn't apply.
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
