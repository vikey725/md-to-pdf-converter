import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { buildBook, collectChapters, humanize } from '../src/book.js';
import { bookPageCss } from '../src/paged.js';
import { getTheme } from '../src/themes.js';

async function makeBook(files) {
  const dir = await mkdtemp(join(tmpdir(), 'md2pdf-book-'));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(join(dir, name, '..'), { recursive: true });
    await writeFile(join(dir, name), content);
  }
  return dir;
}

const names = (dir, files) => files.map((f) => relative(dir, f));

test('humanize strips number prefixes and separators', () => {
  assert.equal(humanize('02-getting_started'), 'Getting Started');
  assert.equal(humanize('10. faq'), 'Faq');
  assert.equal(humanize('2024-report'), 'Report');
});

test('chapters: natural sort, README first, hidden dirs and SUMMARY skipped', async () => {
  const dir = await makeBook({
    '10-end.md': '# End',
    '2-middle.md': '# Middle',
    '1-start.md': '# Start',
    'README.md': '# Preface',
    'part/01-sub.md': '# Sub',
    '.drafts/x.md': '# Hidden',
    'notes.txt': 'nope',
  });
  assert.deepEqual(names(dir, await collectChapters(dir)), [
    'README.md', '1-start.md', '2-middle.md', '10-end.md', join('part', '01-sub.md'),
  ]);
});

test('chapters: SUMMARY.md order, then book.yaml list wins', async () => {
  const dir = await makeBook({
    'a.md': '# A',
    'b.md': '# B',
    'c.md': '# C',
    'SUMMARY.md': '- [C](c.md)\n- [A](./a.md)\n- [missing](zzz.md)',
  });
  assert.deepEqual(names(dir, await collectChapters(dir)), ['c.md', 'a.md']);
  assert.deepEqual(names(dir, await collectChapters(dir, { chapters: ['b.md', 'a.md'] })), ['b.md', 'a.md']);
  await assert.rejects(collectChapters(dir, { chapters: ['nope.md'] }), /missing chapter/);
});

test('book: config, numbering, prefixed ids, cross-chapter links, images', async () => {
  const dir = await makeBook({
    'book.yaml': 'title: My Book\nauthor: Ann\n',
    'README.md': '# Intro\n\n## Overview\n\nSee [usage](02-usage.md#setup) and [top](#overview).',
    '01-basics.md': '## Overview\n\n![pic](img/a.png) [web](https://x.dev)',
    '02-usage.md': '---\ntitle: Usage Guide\n---\n# Usage\n\n## Setup\n\nBack to [intro](README.md).',
  });
  const { html, meta, chapters } = await buildBook(dir, { theme: 'dark', author: undefined });

  assert.equal(meta.title, 'My Book');
  assert.equal(meta.author, 'Ann');
  assert.equal(meta.theme, 'dark');
  assert.deepEqual(chapters.map((c) => [c.id, c.title, c.label]), [
    ['ch1', 'Intro', undefined],
    ['ch2', 'Basics', 'Chapter 1'], // title from filename, H1 injected
    ['ch3', 'Usage Guide', 'Chapter 2'], // front matter title wins
  ]);

  assert.match(html, /<section class="cover"/);
  assert.match(html, /<div class="cover-title">My Book<\/div>/);
  assert.match(html, /<h2 id="ch1-overview">/);
  assert.match(html, /<h2 id="ch2-overview">/);
  assert.match(html, /<h1 id="ch2-basics">Basics<\/h1>/);
  assert.match(html, /href="#ch3-setup"/);
  assert.match(html, /href="#ch1-overview">top/);
  assert.match(html, /href="#ch1">intro/);
  assert.match(html, /href="https:\/\/x.dev"/);
  assert.match(html, new RegExp(`src="file://[^"]*${basename(dir)}/img/a.png"`));
  assert.match(html, /<a href="#ch3"><span class="toc-num">2<\/span>Usage Guide<\/a>/);
  assert.match(html, /style="page:ch3"/);
});

test('book page CSS: running chapter headers and bare cover', () => {
  const css = bookPageCss({ title: 'T "q"' }, getTheme('light'), [{ id: 'ch2', title: 'Two', label: 'Chapter 1' }]);
  assert.match(css, /@top-left \{ content: "T \\"q\\"";/);
  assert.match(css, /@page ch2 \{\s*@top-right \{ content: "Chapter 1 · Two";/);
  assert.match(css, /@page cover \{\s*margin: 0;/);
});
