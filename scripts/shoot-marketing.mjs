// One-off visual QA: screenshot the public marketing pages in both themes.
// Usage: node scripts/shoot-marketing.mjs [baseUrl]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:3000';
const outDir = 'playwright-report/marketing-shots';
mkdirSync(outDir, { recursive: true });

const pages = ['welcome', 'product', 'strategies-overview', 'pricing', 'security', 'docs'];

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
  const page = await ctx.newPage();
  for (const p of pages) {
    await page.goto(`${base}/${p}`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outDir}/${p}-${theme}.png`, fullPage: true });
    console.log(`shot ${p} (${theme})`);
  }
  await ctx.close();
}
await browser.close();
