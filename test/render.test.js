import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/render.js';

const render = async (src, opts) => (await renderMarkdown(src, opts)).html;

test('color shorthand: named, hex, styles, backgrounds', async () => {
  const html = await render('{red}(hot) {#ff6600}(hex) {blue bold}(both) {white bg:green}(badge)');
  assert.match(html, /<span class="c-red">hot<\/span>/);
  assert.match(html, /<span style="color:#ff6600">hex<\/span>/);
  assert.match(html, /<span class="c-blue t-bold">both<\/span>/);
  assert.match(html, /<span class="c-white bg-green t-bg">badge<\/span>/);
});

test('color shorthand parses nested markdown and ignores unknown specs', async () => {
  const html = await render('{purple}(has **bold** and (parens)) {notacolor}(x)');
  assert.match(html, /<span class="c-purple">has <strong>bold<\/strong> and \(parens\)<\/span>/);
  assert.match(html, /\{notacolor\}\(x\)/);
});

test('attribute spans and highlights', async () => {
  const html = await render('[text]{.blue .bold} ==mark==');
  assert.match(html, /<span class="blue bold">text<\/span>/);
  assert.match(html, /<mark>mark<\/mark>/);
});

test('mermaid fences become escaped pre.mermaid blocks', async () => {
  const html = await render('```mermaid\nflowchart LR\n  A --> B\n```');
  assert.match(html, /<pre class="mermaid">flowchart LR\n {2}A --&gt; B\n<\/pre>/);
});

test('code fences are highlighted by Shiki; unknown languages stay plain', async () => {
  const html = await render('```js\nconst x = 1;\n```\n\n```nosuchlang\n<b>\n```');
  assert.match(html, /<pre class="shiki github-light"/);
  assert.match(html, /<pre class="shiki plain"><code>&lt;b&gt;/);
});

test('math renders with KaTeX', async () => {
  const html = await render('Inline $x^2$ and\n\n$$\\frac{a}{b}$$');
  assert.match(html, /class="katex"/);
  assert.match(html, /katex-display/);
});

test('GitHub callouts', async () => {
  const html = await render('> [!WARNING]\n> Careful');
  assert.match(html, /markdown-alert markdown-alert-warning/);
});

test('toc option inserts TOC after the title, excluding a single H1', async () => {
  const html = await render('# Title\n\n## One\n\n## Two', { toc: true });
  assert.match(html, /<h1[^>]*>Title<\/h1>\s*<nav class="toc">/);
  assert.match(html, /href="#one"/);
  assert.doesNotMatch(html.match(/<nav class="toc">[\s\S]*?<\/nav>/)[0], /#title/);
});

test('front matter supplies meta; explicit options win', async () => {
  const { meta } = await renderMarkdown('---\ntitle: FM\ntheme: dark\n---\n# H', { theme: 'sepia' });
  assert.equal(meta.title, 'FM');
  assert.equal(meta.theme, 'sepia');
});

test('title falls back to first H1; unknown theme throws', async () => {
  assert.equal((await renderMarkdown('# Hello\ntext')).meta.title, 'Hello');
  await assert.rejects(renderMarkdown('x', { theme: 'neon' }), /Unknown theme/);
});
