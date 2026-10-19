import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { renderMarkdown } from './render.js';
import { buildBook } from './book.js';
import { buildPage } from './template.js';
import { bookPageCss, documentPageCss } from './paged.js';
import { htmlToPdf, launchBrowser } from './pdf.js';
import { getTheme } from './themes.js';

export { renderMarkdown, buildBook, buildPage, htmlToPdf, launchBrowser };

async function buildDocument(input, { customCss, ...opts }) {
  if ((await stat(input)).isDirectory()) {
    const { html: body, meta, chapters } = await buildBook(input, opts);
    const pageCss = bookPageCss(meta, getTheme(meta.theme), chapters);
    return { meta, html: buildPage({ html: body, meta, baseDir: input, customCss, pageCss, book: true }) };
  }
  const { html: body, meta } = await renderMarkdown(await readFile(input, 'utf8'), opts);
  const pageCss = documentPageCss(meta, getTheme(meta.theme));
  return { meta, html: buildPage({ html: body, meta, baseDir: dirname(input), customCss, pageCss }) };
}

/**
 * Convert a markdown file, or a folder of markdown files into one book, to
 * PDF. Pass `browser` to reuse a Chrome instance across conversions.
 */
export async function convert(inputPath, outputPath, { browser, chrome, ...opts } = {}) {
  const { html, meta } = await buildDocument(resolve(inputPath), opts);

  const ownBrowser = !browser;
  browser ??= await launchBrowser(chrome);
  try {
    await htmlToPdf(browser, html, resolve(outputPath), meta);
  } finally {
    if (ownBrowser) await browser.close();
  }
  return { html, meta };
}
