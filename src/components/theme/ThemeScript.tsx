const THEME_STORAGE_KEY = 'blackheart:theme';
const PALETTE_STORAGE_KEY = 'br.palette';

const script = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var p=window.matchMedia('(prefers-color-scheme: light)').matches;var t=(s==='light'||s==='dark')?s:(p?'light':'dark');document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute('data-theme','dark');}try{var pp=localStorage.getItem('${PALETTE_STORAGE_KEY}');var ok=['midnight','slate','oxford'];var pal=(pp&&ok.indexOf(pp)>-1)?pp:'midnight';document.documentElement.setAttribute('data-palette',pal);}catch(e2){document.documentElement.setAttribute('data-palette','midnight');}})();`;

export function ThemeScript() {
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
