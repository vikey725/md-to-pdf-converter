// Inline colored text: {red}(text), {#ff6600}(text), {blue bold}(text),
// {white bg:red}(text). Content inside the parentheses is parsed as markdown.

export const PALETTE = ['white', 'black', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'];
const STYLES = ['bold', 'italic', 'underline'];
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function parseSpec(spec) {
  const classes = [];
  const styles = [];
  for (const part of spec.trim().split(/\s+/)) {
    const isBg = part.startsWith('bg:');
    const value = isBg ? part.slice(3) : part;
    if (PALETTE.includes(value)) {
      classes.push(isBg ? `bg-${value}` : `c-${value}`);
    } else if (HEX.test(value)) {
      styles.push(`${isBg ? 'background-color' : 'color'}:${value}`);
    } else if (!isBg && STYLES.includes(value)) {
      classes.push(`t-${value}`);
    } else {
      return null;
    }
  }
  if (classes.some((c) => c.startsWith('bg-')) || styles.some((s) => s.startsWith('background'))) {
    classes.push('t-bg');
  }
  return { classes, styles };
}

// Index of the ')' that closes the '(' at `open`, honoring nesting and escapes.
function findClose(src, open, max) {
  let depth = 0;
  for (let i = open; i < max; i++) {
    const ch = src[i];
    if (ch === '\\') i++;
    else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i;
  }
  return -1;
}

export default function colorText(md) {
  md.inline.ruler.before('emphasis', 'color_text', (state, silent) => {
    const { src, pos, posMax } = state;
    if (src.charCodeAt(pos) !== 0x7b /* { */) return false;

    const specEnd = src.indexOf('}', pos + 1);
    if (specEnd < 0 || specEnd + 1 >= posMax || src[specEnd + 1] !== '(') return false;
    const spec = parseSpec(src.slice(pos + 1, specEnd));
    if (!spec) return false;
    const close = findClose(src, specEnd + 1, posMax);
    if (close < 0) return false;

    if (!silent) {
      const open = state.push('color_text_open', 'span', 1);
      if (spec.classes.length) open.attrSet('class', spec.classes.join(' '));
      if (spec.styles.length) open.attrSet('style', spec.styles.join(';'));

      const oldMax = state.posMax;
      state.pos = specEnd + 2;
      state.posMax = close;
      state.md.inline.tokenize(state);
      state.posMax = oldMax;

      state.push('color_text_close', 'span', -1);
    }
    state.pos = close + 1;
    return true;
  });
}
