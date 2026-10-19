import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import tocDoneRight from 'markdown-it-toc-done-right';
import attrs from 'markdown-it-attrs';
import bracketedSpans from 'markdown-it-bracketed-spans';
import mark from 'markdown-it-mark';
import githubAlerts from 'markdown-it-github-alerts';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import katexPlugin from '@vscode/markdown-it-katex';
import matter from 'gray-matter';
import colorText from './plugins/color-text.js';
import { createHighlightFn } from './highlight.js';
import { getTheme } from './themes.js';

const TOC_MARKER = /^\s*\[\[toc\]\]\s*$/im;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i;
const MD_LINK = /^([^#?]+\.(?:md|markdown))(#.*)?$/i;

export function slugify(text) {
  return encodeURIComponent(String(text).trim().toLowerCase().replace(/\s+/g, '-'));
}

// Book chapters are rendered separately but end up in one HTML page, so
// relative images/links are resolved per chapter and heading ids prefixed.
function chapterLinks(md) {
  const fileUrl = (env, src) =>
    EXTERNAL.test(src) ? src : pathToFileURL(resolve(env.baseDir, decodeURI(src))).href;
  const rewriteHtml = (env, html) =>
    html.replace(/(<img\b[^>]*?\bsrc=")([^"]+)"/gi, (_, pre, src) => `${pre}${fileUrl(env, src)}"`);

  function rewriteHref(env, href) {
    if (href.startsWith('#')) return `#${env.idPrefix ?? ''}${href.slice(1)}`;
    if (EXTERNAL.test(href)) return href;
    const m = href.match(MD_LINK);
    const target = m && env.chapterIds?.get(resolve(env.baseDir, decodeURI(m[1])));
    if (!target) return href;
    return m[2]?.length > 1 ? `#${target.idPrefix}${m[2].slice(1)}` : `#${target.id}`;
  }

  md.core.ruler.push('chapter_links', (state) => {
    const { env } = state;
    if (!env.baseDir) return;
    const visit = (tokens) => {
      for (const t of tokens) {
        if (t.type === 'image') t.attrSet('src', fileUrl(env, t.attrGet('src')));
        else if (t.type === 'link_open') t.attrSet('href', rewriteHref(env, t.attrGet('href')));
        else if (t.type === 'html_block' || t.type === 'html_inline') t.content = rewriteHtml(env, t.content);
        if (t.children) visit(t.children);
      }
    };
    visit(state.tokens);
  });
}

function createMarkdown(highlight, tocLevels = [1, 2, 3]) {
  return new MarkdownIt({ html: true, linkify: true, typographer: true, highlight })
    .use(colorText)
    .use(bracketedSpans)
    .use(attrs, { allowedAttributes: ['id', 'class', 'style'] })
    .use(mark)
    .use(githubAlerts)
    .use(taskLists, { label: true })
    .use(footnote)
    .use(katexPlugin.default ?? katexPlugin, { throwOnError: false })
    .use(anchor, {
      tabIndex: false,
      slugifyWithState: (text, state) => (state.env.idPrefix ?? '') + slugify(text),
    })
    .use(tocDoneRight, { containerClass: 'toc', listType: 'ol', level: tocLevels })
    .use(chapterLinks);
}

function fenceLangs(tokens) {
  return tokens
    .filter((t) => t.type === 'fence')
    .map((t) => t.info.trim().split(/\s+/)[0].toLowerCase())
    .filter(Boolean);
}

function plainText(children) {
  return children
    .filter((c) => c.type === 'text' || c.type === 'code_inline')
    .map((c) => c.content)
    .join('')
    .trim();
}

function headingsOf(tokens) {
  return tokens.flatMap((t, i) =>
    t.type === 'heading_open'
      ? [{ level: Number(t.tag.slice(1)), id: t.attrGet('id'), text: plainText(tokens[i + 1].children) }]
      : [],
  );
}

export function firstHeading(src) {
  return src.match(/^#\s+(.+)$/m)?.[1].trim();
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// `env` carries per-chapter state for books: idPrefix, baseDir, chapterIds,
// docId (footnote id prefix).
async function renderBody(body, shikiTheme, env, tocLevels) {
  const langs = fenceLangs(createMarkdown().parse(body, {}));
  const md = createMarkdown(await createHighlightFn(langs, shikiTheme), tocLevels);
  const tokens = md.parse(body, env);
  return { html: md.renderer.render(tokens, md.options, env), headings: headingsOf(tokens) };
}

/**
 * Render a single markdown document to an HTML body fragment.
 * Options from front matter are returned as `meta`; explicit `opts` win.
 */
export async function renderMarkdown(source, opts = {}) {
  const { data: frontMatter, content } = matter(source);
  const meta = { ...frontMatter, ...stripUndefined(opts) };
  meta.theme ??= 'light';
  meta.title ??= firstHeading(content) ?? 'Document';

  const theme = getTheme(meta.theme);
  let body = content;
  if (meta.toc && !TOC_MARKER.test(body)) {
    // Keep a leading H1 as the title above the TOC.
    const h1 = body.match(/^\s*#\s+.+\n/);
    const at = h1 ? h1[0].length : 0;
    body = `${body.slice(0, at)}\n[[toc]]\n\n${body.slice(at)}`;
  }

  // A single H1 is the document title; leave it out of the TOC.
  const h1Count = createMarkdown().parse(body, {}).filter((t) => t.type === 'heading_open' && t.tag === 'h1').length;
  const tocLevels = h1Count === 1 ? [2, 3] : [1, 2, 3];
  const { html } = await renderBody(body, theme.shiki, {}, tocLevels);
  return { html, meta };
}

/**
 * Render one book chapter (front matter already stripped). Returns its HTML
 * and headings, with ids prefixed by the chapter id. `[[toc]]` markers are
 * dropped: the book has its own contents page.
 */
export async function renderChapter(content, { theme, id, baseDir, chapterIds }) {
  const env = { idPrefix: `${id}-`, docId: id, baseDir, chapterIds };
  const body = content.replace(new RegExp(TOC_MARKER.source, 'gim'), '');
  return renderBody(body, getTheme(theme).shiki, env, [7]);
}
