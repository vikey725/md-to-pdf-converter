import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { escapeHtml } from './highlight.js';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KATEX_DIST = dirname(require.resolve('katex/dist/katex.min.css'));

const read = (path) => readFileSync(path, 'utf8');

// Inline KaTeX CSS with font URLs made absolute so they resolve from any page.
let katexCss;
function getKatexCss() {
  const fontsUrl = pathToFileURL(join(KATEX_DIST, 'fonts')).href;
  katexCss ??= read(join(KATEX_DIST, 'katex.min.css')).replace(/url\(fonts\//g, `url(${fontsUrl}/`);
  return katexCss;
}

export function themeCss(theme) {
  return read(join(ROOT, 'themes', `${theme}.css`));
}

/**
 * Build a self-contained HTML page. `baseDir` is the markdown file's directory
 * so relative image links resolve against it. `pageCss` holds the @page rules.
 */
export function buildPage({ html, meta, baseDir, customCss, pageCss, book = false }) {
  const baseHref = pathToFileURL(baseDir.endsWith('/') ? baseDir : `${baseDir}/`).href;
  return `<!doctype html>
<html lang="en" data-theme="${meta.theme}">
<head>
<meta charset="utf-8">
<base href="${baseHref}">
<title>${escapeHtml(String(meta.title))}</title>
<style>${getKatexCss()}</style>
<style>${read(join(ROOT, 'themes', 'base.css'))}</style>
<style>${themeCss(meta.theme)}</style>
${book ? `<style>${read(join(ROOT, 'themes', 'book.css'))}</style>` : ''}
<style>${pageCss}</style>
${customCss ? `<style>${customCss}</style>` : ''}
</head>
<body${book ? ' class="book"' : ''}>
<main class="markdown-body">
${html}
</main>
</body>
</html>`;
}
