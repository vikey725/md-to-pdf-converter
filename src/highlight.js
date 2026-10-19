import { createHighlighter, bundledLanguages } from 'shiki';
import { THEMES } from './themes.js';

let highlighterPromise;

function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: [...new Set(Object.values(THEMES).map((t) => t.shiki))],
    langs: [],
  });
  return highlighterPromise;
}

export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Shiki is async but markdown-it's highlight hook is sync, so load every
// language the document uses up front and return a sync highlight function.
export async function createHighlightFn(langs, shikiTheme) {
  const highlighter = await getHighlighter();
  const known = [...new Set(langs)].filter((l) => l in bundledLanguages);
  await Promise.all(
    known
      .filter((l) => !highlighter.getLoadedLanguages().includes(l))
      .map((l) => highlighter.loadLanguage(l)),
  );

  return (code, lang) => {
    if (lang === 'mermaid') {
      return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
    }
    if (!known.includes(lang)) {
      return `<pre class="shiki plain"><code>${escapeHtml(code)}</code></pre>`;
    }
    return highlighter.codeToHtml(code, { lang, theme: shikiTheme });
  };
}
