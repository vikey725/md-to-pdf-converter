# md2pdf

Convert Markdown into polished, colored PDFs — with Mermaid diagrams, colored text, syntax-highlighted code, KaTeX math, callouts, themes, a table of contents and page numbers.

Rendering runs fully offline using your installed Chrome/Chromium (no browser download).

## Quick start

```bash
# 1. Get dependencies (needs Node 20+ and Chrome/Chromium/Edge 131+)
cd md-to-pdf-converter
npm install

# 2. Try the examples
node bin/md2pdf.js examples/showcase.md             # -> examples/showcase.pdf
node bin/md2pdf.js examples/showcase.md -t dark     # dark theme
node bin/md2pdf.js examples/book                    # folder -> examples/book.pdf

# 3. Open the result
xdg-open examples/book.pdf                          # macOS: open, Windows: start

# 4. (Optional) install the `md2pdf` command globally
npm link
md2pdf --help
```

Without `npm link`, use `node bin/md2pdf.js` anywhere `md2pdf` appears below.

The Chrome executable is auto-detected. If it isn't found:

```bash
md2pdf notes.md --chrome /path/to/chrome
export CHROME_PATH=/path/to/chrome   # or set it once per shell
```

## Usage

```bash
# Single files
md2pdf notes.md                              # -> notes.pdf
md2pdf notes.md -o out.pdf                   # custom output path
md2pdf notes.md -t dark --toc                # dark theme + table of contents
md2pdf notes.md -t sepia -f Letter -l        # sepia, US Letter, landscape
md2pdf notes.md --css my-style.css           # extra CSS on top of the theme
md2pdf notes.md --no-header-footer           # no title header / page numbers

# Many files at once (each PDF next to its input)
md2pdf docs/*.md -t sepia

# A folder as one book
md2pdf my-book/                              # -> my-book.pdf
md2pdf my-book/ -t dark --title "My Book" --subtitle "Notes" --author "Me"
md2pdf my-book/ -o ~/Desktop/book.pdf --no-cover

# Live re-render while you edit (Ctrl+C to stop)
md2pdf notes.md --watch
md2pdf my-book/ --watch

# Debug styling: also write the intermediate HTML
md2pdf notes.md --html                       # -> notes.pdf + notes.html
```

| Option | Description |
| --- | --- |
| `-o, --output <file>` | Output path (single input only) |
| `-t, --theme <name>` | `light` (default), `dark`, `sepia` |
| `--toc` | Insert a table of contents (or put `[[toc]]` where you want it) |
| `--title <text>` | Document/book title (default: front matter, first `#` heading, or folder name) |
| `--subtitle <text>`, `--author <name>` | Book cover lines |
| `--no-cover` | Book without a cover page |
| `-f, --format <size>` | `A4` (default), `Letter`, `Legal`, `A3`, ... |
| `-m, --margin <size>` | Page margin, default `18mm` |
| `-l, --landscape` | Landscape orientation |
| `--no-header-footer` | Omit header title and `page / total` footer |
| `--css <file>` | Extra CSS applied after the theme |
| `--html` | Also write the intermediate HTML (for debugging styles) |
| `-w, --watch` | Re-render when the file changes |

Front matter sets per-document defaults; CLI flags override it:

```yaml
---
title: Design Doc
theme: dark
toc: true
format: Letter
margin: 20mm
landscape: false
headerFooter: true
---
```

## Books

Pass a folder and every Markdown file in it becomes one PDF book:

- **Cover page** with a full-bleed theme gradient: title, subtitle, author, date
- **Contents page** with dotted leaders and real page numbers, all clickable
- **Chapters** each start on a new page with a `Chapter N` label; the page header shows the book title and the current chapter
- **Links between files** (`[x](02-usage.md#setup)`) become internal PDF links; images resolve relative to each chapter's file
- **PDF bookmarks** for every chapter and section

```
my-book/
├── book.yaml            # optional settings
├── README.md            # preface: first, unnumbered (also index.md, preface.md)
├── 01-introduction.md   # Chapter 1
├── 02-usage.md          # Chapter 2
├── 03-reference/
│   └── colors.md        # Chapter 3
└── images/
```

**Chapter order:** `chapters:` list in `book.yaml`, otherwise the links in a `SUMMARY.md` (mdBook/GitBook style), otherwise natural sort of file paths (`2-x.md` before `10-x.md`). Dot-folders and `node_modules` are skipped.

**Chapter title:** the file's front matter `title`, else its first `#` heading, else the file name (`02-getting-started` → "Getting Started").

`book.yaml` (all optional; CLI flags override):

```yaml
title: The Handbook
subtitle: Everything in one place
author: Jane Doe
date: 2026-10-19
theme: sepia            # light | dark | sepia
toc: true               # contents page
tocDepth: 2             # 1 = chapters only, 2 = + sections, 3 = + subsections
cover: true
numberChapters: true    # per chapter: front matter `numbered: false`
format: A4
margin: 20mm
chapters:               # explicit order (optional)
  - README.md
  - 01-introduction.md
```

Example: `md2pdf examples/book -t dark`.

## Syntax

### Colored text

```markdown
{red}(red text)   {#ff6600}(any hex)   {blue bold}(blue and bold)
{white bg:red}(badge)   {bg:yellow}(highlighted)   {purple}(works with **markdown** inside)

[span with classes]{.green .bold}   [inline style]{style="color:#e11d48"}
==highlighted==   <span style="color:teal">raw HTML</span>
```

Palette: `red orange yellow green teal blue purple pink gray white black` (tuned per theme).
Modifiers: `bold italic underline`, `bg:<color>` for backgrounds.

### Callouts

```markdown
> [!NOTE]
> Also: TIP, IMPORTANT, WARNING, CAUTION
```

### Diagrams

Any [Mermaid](https://mermaid.js.org) diagram in a `mermaid` fence: flowchart, sequence, class, state, ER, gantt, pie, mindmap, timeline, and more. Diagram colors follow the theme. A diagram with a syntax error renders as a red error box instead of failing the whole document.

### Math

`$inline$` and `$$display$$` via KaTeX.

### Also

Syntax-highlighted code (Shiki, VS Code grammars), tables, task lists, footnotes, `{#id .class}` attributes on any block, PDF bookmarks from headings.

See [`examples/showcase.md`](examples/showcase.md) for every feature:

```bash
md2pdf examples/showcase.md -t dark
```

## Library

```js
import { convert } from 'md2pdf';

await convert('in.md', 'out.pdf', { theme: 'dark', toc: true });
```

## Security

Raw HTML is allowed and pages are rendered with local file access, so only convert Markdown you trust.

## Development

```bash
npm test                              # all tests
node --test test/book.test.js         # one test file
node bin/md2pdf.js examples/showcase.md --html   # render + inspect HTML
npm unlink -g md2pdf                  # remove the global command
```
