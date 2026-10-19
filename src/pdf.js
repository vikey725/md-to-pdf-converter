import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { findChrome } from './chrome.js';
import { destinationPages } from './paged.js';
import { getTheme } from './themes.js';

const require = createRequire(import.meta.url);
const MERMAID_JS = require.resolve('mermaid/dist/mermaid.min.js');

export function launchBrowser(chromePath) {
  return puppeteer.launch({
    executablePath: findChrome(chromePath),
    headless: true,
    args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
  });
}

async function renderMermaid(page, themeVariables) {
  const count = await page.$$eval('pre.mermaid', (els) => els.length);
  if (!count) return;
  await page.addScriptTag({ path: MERMAID_JS });
  await page.evaluate(async (themeVariables) => {
    const { mermaid } = window;
    mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables, securityLevel: 'loose' });
    const els = [...document.querySelectorAll('pre.mermaid')];
    for (const [i, el] of els.entries()) {
      const wrapper = document.createElement('div');
      try {
        const { svg } = await mermaid.render(`mermaid-${i}`, el.textContent);
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = svg;
      } catch (err) {
        wrapper.className = 'mermaid-error';
        wrapper.textContent = `Mermaid error: ${err?.message ?? err}`;
        // mermaid leaves an orphan error element in <body> on failure
        document.getElementById(`dmermaid-${i}`)?.remove();
      }
      el.replaceWith(wrapper);
    }
  }, themeVariables);
}

// Contents entries get their page number from a first print pass; the
// number column has a fixed width so filling it in doesn't move anything.
async function fillTocPageNumbers(page, pdfOptions) {
  if (!(await page.$('.toc a[href^="#"]'))) return;
  const pages = await destinationPages(await page.pdf(pdfOptions));
  await page.evaluate((entries) => {
    const map = new Map(entries);
    for (const a of document.querySelectorAll('.toc a[href^="#"]')) {
      const n = map.get(a.getAttribute('href').slice(1));
      if (n) a.dataset.page = n;
    }
  }, [...pages]);
}

/**
 * Print a full HTML page to PDF. Page size, margins and header/footer come
 * from the page's own @page CSS (see paged.js).
 */
export async function htmlToPdf(browser, pageHtml, outPath, meta) {
  const theme = getTheme(meta.theme);
  const dir = await mkdtemp(join(tmpdir(), 'md2pdf-'));
  const htmlPath = join(dir, 'page.html');
  await writeFile(htmlPath, pageHtml);

  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await renderMermaid(page, theme.mermaid);
    await page.evaluate(() => document.fonts.ready);

    const pdfOptions = { printBackground: true, preferCSSPageSize: true, outline: true, tagged: true, timeout: 0 };
    await fillTocPageNumbers(page, pdfOptions);
    await page.pdf({ ...pdfOptions, path: outPath });
  } finally {
    await page.close();
    await rm(dir, { recursive: true, force: true });
  }
}
