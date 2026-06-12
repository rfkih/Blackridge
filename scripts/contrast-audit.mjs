// Automated contrast audit for the public marketing pages: walks every
// visible text node in both themes, resolves the effective background by
// ascending ancestors (compositing alpha), and reports WCAG contrast
// ratios below the threshold. Usage: node scripts/contrast-audit.mjs [baseUrl]
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3777';
// WCAG AA for body text. Known false positives: /onboarding's aside panel
// uses a dark gradient background-image, which this audit cannot read —
// its white-on-(reported)-paper findings are fine visually in both themes.
const THRESHOLD = 4.5;
const pages = [
  'welcome',
  'product',
  'strategies-overview',
  'pricing',
  'security',
  'docs',
  'onboarding',
];

const auditFn = (threshold) => {
  const parse = (s) => {
    const m = s.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  };
  const blend = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const effectiveBg = (el) => {
    let node = el;
    let acc = null; // stacked semi-transparent layers, top-first
    const layers = [];
    while (node && node !== document.documentElement.parentNode) {
      const cs = getComputedStyle(node);
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a >= 1) break;
      }
      node = node.parentElement;
    }
    if (!layers.length || layers[layers.length - 1].a < 1) {
      layers.push({ r: 255, g: 255, b: 255, a: 1 }); // canvas default
    }
    acc = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i--) acc = blend(layers[i], acc);
    return acc;
  };
  const path = (el) => {
    const bits = [];
    let n = el;
    while (n && n.tagName !== 'BODY' && bits.length < 5) {
      let s = n.tagName.toLowerCase();
      if (n.className && typeof n.className === 'string') {
        const c = n.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (c) s += '.' + c;
      }
      bits.unshift(s);
      n = n.parentElement;
    }
    return bits.join(' > ');
  };

  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let t;
  while ((t = walker.nextNode())) {
    const text = t.textContent.trim();
    if (!text) continue;
    const el = t.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    if (fg.a === 0) {
      out.push({ path: path(el), text: text.slice(0, 60), fg: cs.color, bg: '-', ratio: 0 });
      continue;
    }
    const bg = effectiveBg(el);
    const fgFlat = fg.a < 1 ? blend(fg, bg) : fg;
    const r = ratio(fgFlat, bg);
    if (r < threshold) {
      const key = path(el) + '|' + cs.color;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        path: path(el),
        text: text.slice(0, 60),
        fg: cs.color,
        bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        ratio: Math.round(r * 100) / 100,
      });
    }
  }
  return out;
};

const browser = await chromium.launch();
let totalIssues = 0;
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((t) => localStorage.setItem('blackheart:theme', t), theme);
  const page = await ctx.newPage();
  for (const p of pages) {
    await page.goto(`${base}/${p}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    // open all <details> so FAQ bodies are audited too
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
    const issues = await page.evaluate(auditFn, THRESHOLD);
    if (issues.length) {
      totalIssues += issues.length;
      console.log(`\n=== /${p} [${theme}] — ${issues.length} low-contrast nodes ===`);
      for (const i of issues) {
        console.log(`  ratio=${i.ratio}  fg=${i.fg}  bg=${i.bg}`);
        console.log(`    at ${i.path}`);
        console.log(`    "${i.text}"`);
      }
    } else {
      console.log(`/${p} [${theme}] OK`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`\nTotal: ${totalIssues} low-contrast findings (threshold ${THRESHOLD}:1)`);
