import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { contrast, css, day, night, pageDir, palette, resolve } from './css-tokens.mjs';

// TownPass checkout next to this repo (Orca layout); override with TP_COLORS_DART=/path/to/tp_colors.dart.
const DART = process.env.TP_COLORS_DART
  || join(pageDir, '../../../../../TownPass/situation-entry/lib/util/tp_colors.dart');
const TP_SIZES = [12, 14, 16, 18, 24, 36]; // TPTextStyles: caption, body, h3, title, h2, h1
const TP_WEIGHTS = ['400', '600'];

const paletteHexes = new Set(Object.values(palette).map((v) => v.toLowerCase()));

test('styles.css declares every TPColors colour, with the same value as tp_colors.dart', { skip: !existsSync(DART) && `no TownPass checkout at ${DART}` }, () => {
  const dart = Object.fromEntries([...readFileSync(DART, 'utf8').matchAll(/static const Color (\w+?)(\d*) = Color\(0xFF([0-9A-Fa-f]{6})\)/g)]
    .map(([, family, step, hex]) => [`--tp-${family}${step ? `-${step}` : ''}`, `#${hex.toLowerCase()}`]));
  assert.ok(Object.keys(dart).length >= 57, 'tp_colors.dart parsed too few colours');
  assert.deepEqual(palette, dart);
});

test('outside the palette block, styles.css uses no colour literal that is not a TPColors value', () => {
  const rest = css.slice(css.indexOf('\n}', css.indexOf('--tp-')));
  const hexes = [...rest.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase());
  for (const hex of hexes) assert.ok(paletteHexes.has(hex), `${hex} is not a TPColors value`);
  for (const [, r, g, b] of rest.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) {
    const hex = `#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
    assert.ok(paletteHexes.has(hex), `rgb(${r}, ${g}, ${b}) is not a TPColors value`);
  }
  assert.doesNotMatch(rest, /\b(hsla?|oklch|lab)\(/, 'colour functions bypass the palette');
});

test('semantic tokens and rules reach colours only through --tp-* variables', () => {
  const rest = css.slice(css.indexOf('\n}', css.indexOf('--tp-')));
  assert.doesNotMatch(rest, /#[0-9a-f]{3,8}\b/i, 'write var(--tp-…) instead of a hex literal');
});

test('the browser theme colour in index.html is a TPColors value for day and night', () => {
  const html = readFileSync(join(pageDir, 'index.html'), 'utf8');
  const meta = html.match(/<meta name="theme-color"[^>]*>/)[0];
  const values = [...meta.matchAll(/(content|data-day|data-night)="([^"]+)"/g)].map((m) => m[2].toLowerCase());
  assert.equal(values.length, 3);
  for (const v of values) assert.ok(paletteHexes.has(v), `${v} is not a TPColors value`);
  assert.equal(values[1], resolve(day, '--desk'));
  assert.equal(values[2], resolve(night, '--desk'));
});

test('font-size uses only TPTextStyles sizes', () => {
  const sizes = [...css.matchAll(/font-size:\s*([^;}]+)/g)].map((m) => m[1].trim());
  assert.ok(sizes.length > 20);
  for (const size of sizes) {
    const px = size.match(/^(\d+(?:\.\d+)?)(px|rem)$/);
    assert.ok(px, `font-size ${size} is not a fixed px/rem size`);
    assert.ok(TP_SIZES.includes(Number(px[1]) * (px[2] === 'rem' ? 16 : 1)), `font-size ${size} is not a TPTextStyles size`);
  }
});

test('font-weight uses only TPTextStyles weights (regular 400, semibold 600)', () => {
  for (const [, weight] of css.matchAll(/font-weight:\s*([^;}]+)/g)) {
    assert.ok(TP_WEIGHTS.includes(weight.trim()), `font-weight ${weight} is not 400 or 600`);
  }
});

test('Latin text uses Roboto first, Chinese falls back to PingFang TC', () => {
  assert.match(css, /font-family:\s*"Roboto",\s*"PingFang TC"/);
});

// [text token, background token] pairs that carry readable text, in both periods.
const PAIRS = [
  ['--ink', '--paper'], ['--muted', '--paper'], ['--ink', '--tint'], ['--muted', '--tint'],
  ['--on-desk', '--desk'], ['--on-desk-muted', '--desk'], ['--desk-link', '--desk'],
  ['--go', '--paper'], ['--go', '--tint'], ['--on-go', '--go'], ['--on-go', '--go-press'], ['--tick', '--paper'],
  ['--band-ink', '--band'], ['--band-sub', '--band'],
  ['--on-urgent', '--urgent'], ['--on-urgent-sub', '--urgent'], ['--on-closed', '--closed-fill'],
  ['--urgent-text', '--paper'], ['--urgent-text', '--desk'], ['--urgent-text', '--sos-bg'], ['--ink', '--urgent-soft'],
  ['--closed', '--paper'], ['--closed', '--tint'], ['--closed', '--blank'], ['--ink', '--blank'], ['--pending-ink', '--blank'],
  ['--cat-ink', '--cat-bg'], ['--cat-count-ink', '--cat-count-bg'], ['--cat-on-ink', '--cat-on-bg'],
  ['--cat-on-count-ink', '--cat-on-count-bg'], ['--cat-empty-ink', '--cat-bg'],
];

for (const [period, set] of [['day', day], ['night', night]]) {
  for (const [fg, bg] of PAIRS) {
    test(`${period}: ${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
      // --cat-bg is transparent by day: the chip sits on the desk.
      const back = set[bg] === 'transparent' ? '--desk' : bg;
      const ratio = contrast(resolve(set, fg), resolve(set, back));
      assert.ok(ratio >= 4.5, `${fg} on ${back} is ${ratio.toFixed(2)}:1`);
    });
  }
  test(`${period}: focus ring stands out from desk and paper (3:1, non-text)`, () => {
    for (const bg of ['--desk', '--paper']) {
      const ratio = contrast(resolve(set, '--focus'), resolve(set, bg));
      assert.ok(ratio >= 3, `--focus on ${bg} is ${ratio.toFixed(2)}:1`);
    }
  });
}
