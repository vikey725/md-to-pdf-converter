import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import matter from 'gray-matter';
import { load as loadYaml } from 'js-yaml';
import { escapeHtml } from './highlight.js';
import { firstHeading, renderChapter } from './render.js';

const MD_FILE = /\.(md|markdown)$/i;
const CONFIG_FILES = ['book.yaml', 'book.yml', 'book.json'];
const INTRO_FILES = ['readme', 'index', 'preface', 'introduction', 'intro'];
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Paper sizes in mm (portrait), for sizing the full-bleed cover.
const PAPER = { a3: [297, 420], a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4], legal: [215.9, 355.6] };

const stem = (file) => basename(file).replace(MD_FILE, '');
const isIntro = (file) => INTRO_FILES.includes(stem(file).toLowerCase());

/** "02-getting_started" -> "Getting Started" */
export function humanize(name) {
  return name
    .replace(/^[\d.\s_-]+(?=\D)/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function readConfig(dir) {
  const file = CONFIG_FILES.map((f) => join(dir, f)).find(existsSync);
  if (!file) return {};
  const text = await readFile(file, 'utf8');
  return (file.endsWith('.json') ? JSON.parse(text) : loadYaml(text)) ?? {};
}

async function listMarkdown(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && MD_FILE.test(e.name))
    .map((e) => join(e.parentPath ?? e.path, e.name))
    .filter((f) => !relative(dir, f).split(sep).some((p) => p.startsWith('.') || p === 'node_modules'))
    .filter((f) => stem(f).toLowerCase() !== 'summary');
}

/**
 * Chapter order: `chapters` in book.yaml, else the links in SUMMARY.md, else
 * every markdown file in natural sort order with a root README/index first.
 */
export async function collectChapters(dir, config = {}) {
  if (Array.isArray(config.chapters)) {
    return config.chapters.map((c) => {
      const file = resolve(dir, c);
      if (!existsSync(file)) throw new Error(`book config lists missing chapter: ${c}`);
      return file;
    });
  }

  const summary = (await readdir(dir)).find((f) => /^summary\.md$/i.test(f));
  if (summary) {
    const text = await readFile(join(dir, summary), 'utf8');
    const links = [...text.matchAll(/\]\(\s*<?([^)>#\s]+\.(?:md|markdown))/gi)].map((m) => resolve(dir, decodeURI(m[1])));
    const files = [...new Set(links)].filter(existsSync);
    if (files.length) return files;
  }

  const files = await listMarkdown(dir);
  files.sort((a, b) => natural.compare(relative(dir, a), relative(dir, b)));
  const intro = files.findIndex((f) => dirname(f) === dir && isIntro(f));
  if (intro > 0) files.unshift(...files.splice(intro, 1));
  return files;
}

function coverHtml(meta) {
  const [w, h] = PAPER[String(meta.format ?? 'A4').toLowerCase()] ?? [];
  const height = h ? `${(meta.landscape ? w : h) - 0.5}mm` : '100vh';
  const line = (cls, text) => (text ? `<div class="${cls}">${escapeHtml(String(text))}</div>` : '');
  return `<section class="cover" style="height:${height}">
  <div class="cover-inner">
    <div class="cover-rule"></div>
    ${line('cover-title', meta.title)}
    ${line('cover-subtitle', meta.subtitle)}
    <div class="cover-meta">
      ${line('cover-author', meta.author)}
      ${line('cover-date', meta.date instanceof Date ? meta.date.toISOString().slice(0, 10) : meta.date)}
    </div>
  </div>
</section>`;
}

function tocHtml(chapters, depth) {
  const items = chapters
    .map((ch) => {
      const subs = ch.headings
        .filter((h) => h.level >= 2 && h.level <= depth && h.id)
        .map((h) => `<li class="toc-l${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
        .join('');
      const num = ch.number ? `<span class="toc-num">${ch.number}</span>` : '';
      return `<li class="toc-chapter"><a href="#${ch.id}">${num}${escapeHtml(ch.title)}</a>${subs ? `<ol>${subs}</ol>` : ''}</li>`;
    })
    .join('\n');
  return `<section class="toc-page">
  <div class="toc-heading">Contents</div>
  <nav class="toc book-toc"><ol>${items}</ol></nav>
</section>`;
}

function chapterHtml(ch) {
  const label = ch.label ? `<div class="chapter-label">${escapeHtml(ch.label)}</div>` : '';
  return `<section class="chapter" id="${ch.id}" style="page:${ch.id}">
${label}
${ch.html}
</section>`;
}

/**
 * Build a book from a folder of markdown files. Settings come from book.yaml
 * (title, subtitle, author, date, theme, toc, tocDepth, format, margin,
 * landscape, numberChapters, cover, chapters); explicit `opts` win.
 * Returns the body HTML, the merged meta, and chapter info for @page rules.
 */
export async function buildBook(dir, opts = {}) {
  const root = resolve(dir);
  const config = await readConfig(root);
  const meta = { toc: true, tocDepth: 2, cover: true, numberChapters: true, ...config };
  for (const [k, v] of Object.entries(opts)) if (v !== undefined) meta[k] = v;
  meta.theme ??= 'light';
  meta.title ??= humanize(basename(root));

  const files = await collectChapters(root, config);
  if (!files.length) throw new Error(`no markdown files found in ${root}`);

  const sources = await Promise.all(files.map((f) => readFile(f, 'utf8').then((s) => matter(s))));
  const chapterIds = new Map(files.map((f, i) => [f, { id: `ch${i + 1}`, idPrefix: `ch${i + 1}-` }]));

  let number = 0;
  const chapters = [];
  for (const [i, file] of files.entries()) {
    const { data, content } = sources[i];
    const id = `ch${i + 1}`;
    const title = data.title ?? firstHeading(content) ?? humanize(stem(file));
    // every chapter needs an H1 for its opener and the PDF bookmarks
    const body = firstHeading(content) ? content : `# ${title}\n\n${content}`;
    const numbered = meta.numberChapters !== false && data.numbered !== false && !(isIntro(file) && dirname(file) === root);
    if (numbered) number++;

    const { html, headings } = await renderChapter(body, { theme: meta.theme, id, baseDir: dirname(file), chapterIds });
    chapters.push({
      id,
      title,
      html,
      headings,
      number: numbered ? number : undefined,
      label: numbered ? `Chapter ${number}` : undefined,
    });
  }

  const html = [
    meta.cover !== false ? coverHtml(meta) : '',
    meta.toc !== false ? tocHtml(chapters, Number(meta.tocDepth) || 2) : '',
    ...chapters.map(chapterHtml),
  ].join('\n');
  return { html, meta, chapters };
}
