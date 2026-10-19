#!/usr/bin/env node
import { statSync, watch } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { Command, Option } from 'commander';
import { convert } from '../src/index.js';
import { launchBrowser } from '../src/pdf.js';
import { THEME_NAMES } from '../src/themes.js';

const program = new Command()
  .name('md2pdf')
  .description('Convert Markdown to a colored PDF with diagrams, math, themes and TOC.\nA folder input becomes one book: cover, contents, one chapter per file.')
  .argument('<inputs...>', 'markdown file(s) or folder(s)')
  .option('-o, --output <file>', 'output PDF (single input only; default: next to input)')
  .addOption(new Option('-t, --theme <name>', 'color theme').choices(THEME_NAMES))
  .option('--toc', 'insert a table of contents (or put [[toc]] in the document)')
  .option('--title <text>', 'document/book title')
  .option('--subtitle <text>', 'book subtitle (cover page)')
  .option('--author <name>', 'book author (cover page)')
  .option('--no-cover', 'book: skip the cover page')
  .option('-f, --format <size>', 'paper size: A4, Letter, Legal, A3...')
  .option('-m, --margin <size>', 'page margin, e.g. 18mm, 0.75in')
  .option('-l, --landscape', 'landscape orientation')
  .option('--no-header-footer', 'omit page title header and page number footer')
  .option('--css <file>', 'extra CSS file applied after the theme')
  .option('--html', 'also write the intermediate HTML next to the PDF')
  .option('-w, --watch', 're-render when the input changes')
  .option('--chrome <path>', 'Chrome/Chromium executable (or set CHROME_PATH)')
  .parse();

const inputs = program.args.map((p) => resolve(p));
const cli = program.opts();

if (cli.output && inputs.length > 1) {
  program.error('--output works with a single input; batch output goes next to each input.');
}

const isDir = (p) => statSync(p).isDirectory();
const outputFor = (input) => (cli.output ? resolve(cli.output) : input.replace(/\.(md|markdown)$/i, '') + '.pdf');

const browser = await launchBrowser(cli.chrome);
const customCss = cli.css ? await readFile(resolve(cli.css), 'utf8') : undefined;

async function run(input) {
  const out = outputFor(input);
  const started = Date.now();
  try {
    const { html } = await convert(input, out, {
      browser,
      customCss,
      theme: cli.theme,
      toc: cli.toc,
      title: cli.title,
      subtitle: cli.subtitle,
      author: cli.author,
      cover: cli.cover === false ? false : undefined,
      format: cli.format,
      margin: cli.margin,
      landscape: cli.landscape,
      // commander sets headerFooter=true by default; only pass an explicit opt-out
      headerFooter: cli.headerFooter === false ? false : undefined,
    });
    if (cli.html) await writeFile(out.replace(/\.pdf$/i, '') + '.html', html);
    console.log(`✓ ${out} (${Date.now() - started} ms)`);
  } catch (err) {
    console.error(`✗ ${input}: ${err.message}`);
    process.exitCode = 1;
  }
}

for (const input of inputs) await run(input);

if (cli.watch) {
  console.log('Watching for changes... (Ctrl+C to stop)');
  for (const input of inputs) {
    let timer;
    const rerun = () => {
      clearTimeout(timer);
      timer = setTimeout(() => run(input), 150);
    };
    if (isDir(input)) {
      watch(input, { recursive: true }, (_, name) => {
        if (name && /\.(md|markdown|ya?ml|json|png|jpe?g|gif|svg|webp)$/i.test(name)) rerun();
      });
    } else {
      // watch the directory: editors often replace the file on save
      watch(dirname(input), (_, name) => name === basename(input) && rerun());
    }
  }
  process.on('SIGINT', async () => {
    await browser.close();
    process.exit(0);
  });
} else {
  await browser.close();
}
