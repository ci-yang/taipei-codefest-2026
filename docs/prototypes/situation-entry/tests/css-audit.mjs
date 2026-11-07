// Parses CSS into declarations and lists every colour or type value that is outside TPColors / TPTextStyles.
// Used by situation-tokens.test.mjs on the real styles.css and on mutated copies of it.

export const TP_SIZES = [12, 14, 16, 18, 24, 36]; // TPTextStyles: caption, body, h3, title, h2, h1
export const TP_WEIGHTS = ['400', '600'];

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

// Properties whose value can carry a colour. Custom properties (other than the palette) are checked too.
const COLOUR_PROP = /^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration(-color)?|column-rule(-color)?|--.+)$/;
// Words that may sit next to a colour in those properties without being one.
const NON_COLOUR = new Set(['none', 'transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'solid', 'dashed', 'dotted', 'double', 'inset', 'underline', 'auto']);
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
  const decls = declarations(cssText);
  const defined = new Set(decls.filter((d) => d.prop.startsWith('--')).map((d) => d.prop));
  const problems = [];
  for (const { selector, prop, value } of decls) {
    const at = `${selector} { ${prop}: ${value} }`;
    if (prop.startsWith('--tp-')) {
      if (!/^#[0-9a-f]{6}$/i.test(value) || !paletteHexes.has(value.toLowerCase())) problems.push(`palette entry is not a TPColors value: ${at}`);
      continue;
    }
    if (COLOUR_PROP.test(prop)) {
      for (const word of words(value)) {
        const lower = word.toLowerCase();
        const v = lower.match(/^var\((--[\w-]+)\)$/);
        if (v) { if (!defined.has(v[1])) problems.push(`undefined variable ${v[1]}: ${at}`); continue; }
        const rgba = lower.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0?\.\d+|0|1)\s*\)$/);
        if (rgba) { if (!paletteHexes.has(hex(rgba[1], rgba[2], rgba[3]))) problems.push(`rgba base is not a TPColors value: ${at}`); continue; }
        if (NON_COLOUR.has(lower) || LENGTH.test(lower)) continue;
        problems.push(`colour must be var(--tp-*) or rgba(<TPColors>, a), got "${word}": ${at}`);
      }
    } else if (/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i.test(value)) {
      problems.push(`colour literal in a non-colour property: ${at}`);
    }
    if (prop === 'font-size') checkSize(value, at, problems);
    if (prop === 'font-weight' && !TP_WEIGHTS.includes(value)) problems.push(`font-weight is not 400 or 600: ${at}`);
    if (prop === 'font' && !['inherit', 'initial', 'unset'].includes(value)) {
      const parts = words(value.split(/,/)[0]);
      const size = parts.find((p) => /^[\d.]/.test(p) && !/^\d00$/.test(p));
      if (!size) problems.push(`font shorthand without a TPTextStyles size: ${at}`);
      else checkSize(size.split('/')[0], at, problems);
      for (const p of parts) if (/^\d00$/.test(p) && !TP_WEIGHTS.includes(p)) problems.push(`font weight is not 400 or 600: ${at}`);
      if (parts.some((p) => /^(bold|bolder|lighter)$/.test(p))) problems.push(`font weight keyword: ${at}`);
    }
  }
  return problems;
}

function checkSize(value, at, problems) {
  const px = value.match(/^(\d+(?:\.\d+)?)(px|rem)$/);
  if (!px) problems.push(`font size is not a fixed px/rem size: ${at}`);
  else if (!TP_SIZES.includes(Number(px[1]) * (px[2] === 'rem' ? 16 : 1))) problems.push(`font size is not a TPTextStyles size: ${at}`);
}
