// Shared by the styles tests: reads styles.css, resolves its custom properties to hex, measures contrast.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const pageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
export const css = readFileSync(join(pageDir, 'styles.css'), 'utf8');

function blocks(selector) {
  const found = [];
  for (let start = css.indexOf(`${selector} {`); start >= 0; start = css.indexOf(`${selector} {`, start + 1)) {
    if (start > 0 && css[start - 1] !== '\n') continue;
    found.push(css.slice(start, css.indexOf('\n}', start)));
  }
  assert.ok(found.length > 0, `${selector} block missing`);
  return found.join('\n');
}
function tokens(text) {
  return Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** The one token set. Night uses it too: TownPass has no dark theme, so only the content changes after hours. */
export const day = tokens(blocks(':root'));
/** --tp-* custom properties: the TPColors palette as styles.css declares it. */
export const palette = Object.fromEntries(Object.entries(day).filter(([name]) => name.startsWith('--tp-')));

export function resolve(set, name) {
  let value = set[name];
  for (let i = 0; value && value.startsWith('var(') && i < 5; i += 1) value = set[value.slice(4, -1)];
  assert.match(value || '', /^#[0-9a-f]{6}$/i, `${name} does not resolve to a hex colour`);
  return value.toLowerCase();
}
export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
