// Parses CSS into declarations and lists every colour or type value that is outside TPColors / TPTextStyles.
// Used by situation-tokens.test.mjs on the real styles.css and on mutated copies of it.

export const TP_SIZES = [12, 14, 16, 18, 24, 36]; // TPTextStyles: caption, body, h3, title, h2, h1
export const TP_WEIGHTS = [400, 600];

/** Every `prop: value` in the stylesheet, with the selector (or at-rule) it sits under. */
export function declarations(cssText) {
  const text = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  const stack = [];
  let buf = '';
  const flush = () => {
    const decl = buf.trim();
    buf = '';
    if (!decl || !stack.length) return;
    const colon = decl.indexOf(':');
    if (colon < 0) return;
    found.push({ selector: stack.at(-1), prop: decl.slice(0, colon).trim().toLowerCase(), value: decl.slice(colon + 1).trim() });
  };
  for (const ch of text) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; } else if (ch === '}') { flush(); stack.pop(); } else if (ch === ';') flush();
    else buf += ch;
  }
  return found;
}

// Allowlist: properties whose value can never be a colour (vendor prefix stripped before lookup).
// Every other property — color, background, border, -webkit-text-fill-color, caret-color, scrollbar-color, custom
// properties … — has each word of its value checked, so a colour property nobody listed cannot slip through.
const NO_COLOUR_PROP = new RegExp(`^(${[
  'margin(-.+)?', 'padding(-.+)?', '(min-|max-)?(width|height)', 'top|right|bottom|left|inset(-.+)?', 'z-index',
  'display', 'position', 'box-sizing', 'overflow(-.+)?', 'clip', 'clip-path', 'white-space', 'visibility', 'opacity',
  '(row-|column-)?gap', 'grid(-.+)?', 'flex(-.+)?', 'order', '(align|justify|place)-(items|content|self)',
  'font', 'font-(family|size|weight|style|stretch|variant(-.+)?|feature-settings)', 'line-height', 'letter-spacing',
  'word-(spacing|break)', 'overflow-wrap', 'text-(align|transform|overflow|indent|underline-offset|size-adjust|wrap)',
  'vertical-align', 'hyphens', 'list-style(-type|-position)?', 'content', 'cursor', 'pointer-events', 'user-select',
  'touch-action', 'appearance', 'transform(-.+)?', 'transition(-.+)?', 'animation(-.+)?', 'will-change',
  'scroll-(margin|padding)(-.+)?', 'scroll-behavior', 'border(-(top|bottom)-(left|right))?-radius', 'border-width',
  'border-style', 'outline-(offset|width|style)', 'aspect-ratio', 'object-fit', 'isolation', 'contain',
].join('|')})$`);
// currentColor follows the text colour, so it is only allowed where a line or glyph should match its own text.
// On `color` it is a no-op that hides the real value; on backgrounds or tokens it can erase the contrast.
const CURRENTCOLOR_PROP = /^(border(-.+)?|outline(-color)?|fill|stroke|text-decoration(-color)?|text-emphasis-color|column-rule(-color)?)$/;
// Words that may sit next to a colour in colour-capable properties without being one.
const NON_COLOUR = new Set(['none', 'transparent', 'inherit', 'initial', 'unset', 'revert', 'auto', 'solid', 'dashed',
  'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'hidden', 'thin', 'medium', 'thick', 'underline']);
const LENGTH = /^-?(\d+(\.\d+)?|\.\d+)(px|rem|em|%)?$/;

/** Splits a value on spaces and commas, keeping function calls such as var(…) or rgba(…) whole. */
function words(value) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth === 0 && /[\s,]/.test(ch)) { if (cur) out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const hex = (r, g, b) => `#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;

/**
 * @param {string} cssText
 * @param {Set<string>} paletteHexes  lower-case #rrggbb values of TPColors
 * @returns {string[]} one message per violation; empty when the stylesheet is clean
 */
export function audit(cssText, paletteHexes) {
  const decls = declarations(cssText).map((d) => ({ ...d, value: d.value.toLowerCase().replace(/\s*!\s*important$/, '') }));
  const defined = new Set(decls.filter((d) => d.prop.startsWith('--')).map((d) => d.prop));
  const problems = [];
  for (const { selector, prop, value } of decls) {
    const at = `${selector} { ${prop}: ${value} }`;
    if (prop.startsWith('--tp-')) {
      if (!/^#[0-9a-f]{6}$/.test(value) || !paletteHexes.has(value)) problems.push(`palette entry is not a TPColors value: ${at}`);
      continue;
    }
    if (!NO_COLOUR_PROP.test(prop.replace(/^-(webkit|moz|ms|o)-/, ''))) {
      for (const word of words(value)) {
        const v = word.match(/^var\((--[\w-]+)\)$/);
        if (v) { if (!defined.has(v[1])) problems.push(`undefined variable ${v[1]}: ${at}`); continue; }
        const rgba = word.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0?\.\d+|0|1)\s*\)$/);
        if (rgba) { if (!paletteHexes.has(hex(rgba[1], rgba[2], rgba[3]))) problems.push(`rgba base is not a TPColors value: ${at}`); continue; }
        if (word === 'currentcolor') {
          if (!CURRENTCOLOR_PROP.test(prop)) problems.push(`currentColor only belongs on borders, outlines, fill, stroke or decorations: ${at}`);
          continue;
        }
        if (NON_COLOUR.has(word) || LENGTH.test(word)) continue;
        problems.push(`colour must be var(--tp-*) or rgba(<TPColors>, a), got "${word}" (if ${prop} can never take a colour, add it to NO_COLOUR_PROP): ${at}`);
      }
    } else if (/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(|\bcurrentcolor\b/.test(value)) {
      problems.push(`colour literal in a non-colour property: ${at}`);
    }
    if (prop === 'font-size') checkSize(value, at, problems);
    if (prop === 'font-weight') checkWeight(value, at, problems);
    if (prop === 'font' && !['inherit', 'initial', 'unset'].includes(value)) {
      const parts = words(value.split(',')[0]);
      const sizeAt = parts.findIndex((p) => /^(\d+(\.\d+)?|\.\d+)[a-z%]/.test(p));
      if (sizeAt < 0) { problems.push(`font shorthand without a TPTextStyles size: ${at}`); continue; }
      checkSize(parts[sizeAt].split('/')[0], at, problems);
      for (const p of parts.slice(0, sizeAt)) if (weightOf(p) !== null) checkWeight(p, at, problems);
    }
  }
  return problems;
}

// CSS weight keywords as numbers. bolder/lighter are relative; from a 400 parent they give 700 and 100.
const WEIGHT_KEYWORD = { normal: 400, bold: 700, bolder: 700, lighter: 100 };
function weightOf(word) {
  if (word in WEIGHT_KEYWORD) return WEIGHT_KEYWORD[word];
  return /^\d+(\.\d+)?$/.test(word) ? Number(word) : null;
}
function checkWeight(value, at, problems) {
  if (!TP_WEIGHTS.includes(weightOf(value))) problems.push(`font weight is not 400 or 600: ${at}`);
}

function checkSize(value, at, problems) {
  const px = value.match(/^(\d+(?:\.\d+)?)(px|rem)$/);
  if (!px) problems.push(`font size is not a fixed px/rem size: ${at}`);
  else if (!TP_SIZES.includes(Number(px[1]) * (px[2] === 'rem' ? 16 : 1))) problems.push(`font size is not a TPTextStyles size: ${at}`);
}
