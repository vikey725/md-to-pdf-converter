import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';

// CSS paged media (Chrome 131+): page size, margins, theme background in the
// margins, and running header/footer via @page margin boxes.

const str = (s) => JSON.stringify(String(s ?? ''));
const BOX_FONT = "font: 8.5pt -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;";
const NONE = '{ content: none; }';

function size({ format = 'A4', landscape }) {
  return `${format}${landscape ? ' landscape' : ''}`;
}

/** @page rules for a single document: title header, page x / y footer. */
export function documentPageCss(meta, theme) {
  const showChrome = meta.headerFooter !== false;
  return `@page {
  size: ${size(meta)};
  margin: ${meta.margin ?? '18mm'};
  background: ${theme.bg};
  @top-center { content: ${showChrome ? str(meta.title) : 'none'}; color: ${theme.muted}; ${BOX_FONT} }
  @bottom-center { content: ${showChrome ? 'counter(page) " / " counter(pages)' : 'none'}; color: ${theme.muted}; ${BOX_FONT} }
}`;
}

/**
 * @page rules for a book: book title top-left, current chapter top-right
 * (one named page per chapter), page number bottom-center. The cover is
 * full-bleed with no margin boxes.
 */
export function bookPageCss(meta, theme, chapters) {
  const showChrome = meta.headerFooter !== false;
  const chapterPages = chapters
    .map(
      (ch) => `@page ${ch.id} {
  @top-right { content: ${str(ch.label ? `${ch.label} · ${ch.title}` : ch.title)}; color: ${theme.accent}; ${BOX_FONT} }
}`,
    )
    .join('\n');
  return `@page {
  size: ${size(meta)};
  margin: ${meta.margin ?? '20mm'};
  background: ${theme.bg};
  @top-left { content: ${str(meta.title)}; color: ${theme.muted}; ${BOX_FONT} }
  @bottom-center { content: counter(page); color: ${theme.muted}; ${BOX_FONT} }
}
@page cover {
  margin: 0;
  @top-left ${NONE} @top-right ${NONE} @bottom-center ${NONE}
}
@page front { @top-left ${NONE} }
${showChrome ? chapterPages : `@page { @top-left ${NONE} @bottom-center ${NONE} }`}`;
}

/** Map element id -> 1-based page number using the PDF's named destinations. */
export async function destinationPages(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const pageIndex = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i + 1]));
  const dests = doc.catalog.lookupMaybe(PDFName.of('Dests'), PDFDict);
  const pages = new Map();
  for (const [name, value] of dests?.entries() ?? []) {
    const dest = doc.context.lookupMaybe(value, PDFArray);
    const ref = dest?.get(0)?.toString();
    if (ref && pageIndex.has(ref)) pages.set(name.decodeText(), pageIndex.get(ref));
  }
  return pages;
}
