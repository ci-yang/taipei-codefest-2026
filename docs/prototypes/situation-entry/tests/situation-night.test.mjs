import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css'), 'utf8');

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} block missing`);
  return css.slice(start, css.indexOf('\n}', start));
}
function tokens(text) {
  return Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const day = tokens(block(':root'));
const night = { ...day, ...tokens(block(':root[data-period="night"]')) };

function resolve(set, name) {
  let value = set[name];
  for (let i = 0; value && value.startsWith('var(') && i < 5; i += 1) value = set[value.slice(4, -1)];
  assert.match(value || '', /^#[0-9a-f]{6}$/i, `${name} does not resolve to a hex colour`);
  return value;
}
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text token, background token] pairs that carry readable text at night.
const PAIRS = [
  ['--ink', '--paper'], ['--muted', '--paper'], ['--ink', '--tint'], ['--muted', '--tint'],
  ['--on-desk', '--desk'], ['--on-desk-muted', '--desk'], ['--desk-link', '--desk'],
  ['--go', '--paper'], ['--on-go', '--go'], ['--on-go', '--go-press'], ['--tick', '--paper'],
  ['--band-ink', '--band'], ['--band-sub', '--band'],
  ['--urgent-text', '--paper'], ['--urgent-text', '--desk'], ['--urgent-text', '--sos-bg'], ['--ink', '--urgent-soft'],
  ['--closed', '--paper'], ['--closed', '--blank'], ['--ink', '--blank'], ['--pending-ink', '--blank'],
  ['--cat-ink', '--cat-bg'], ['--cat-count-ink', '--cat-count-bg'], ['--cat-on-ink', '--cat-on-bg'],
  ['--cat-on-count-ink', '--cat-on-count-bg'], ['--cat-empty-ink', '--cat-bg'],
];

for (const [fg, bg] of PAIRS) {
  test(`night: ${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
    const ratio = contrast(resolve(night, fg), resolve(night, bg));
    assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
  });
}

test('night: no surface is pure white', () => {
  for (const name of ['--paper', '--tint', '--sos-bg', '--cat-bg', '--cat-on-bg', '--blank', '--urgent-soft']) {
    assert.notEqual(resolve(night, name).toLowerCase(), '#ffffff', `${name} is pure white at night`);
  }
});

test('night: the action-card band stays yellow (amber hue), only dimmed', () => {
  const hex = resolve(night, '--band');
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  assert.ok(r > g && g > b && r - b > 100, `${hex} no longer reads as yellow`);
  assert.ok(luminance(hex) < luminance(resolve(day, '--band')), 'night band should be dimmer than day');
});

test('night: colours outside the token blocks stay off pure white, except text on red/brown fills', () => {
  const rules = css.slice(css.indexOf('\n}', css.indexOf(':root[data-period="night"] {')));
  const whites = [...rules.matchAll(/^([^{\n]+)\{[^}]*(?:#fff\b|#ffffff)/gm)].map((m) => m[1].trim());
  assert.deepEqual(whites, ['.is-urgent .mini-band, .card.is-urgent .band', '.is-urgent .mini-label', '.mini-label.is-closed']);
});

