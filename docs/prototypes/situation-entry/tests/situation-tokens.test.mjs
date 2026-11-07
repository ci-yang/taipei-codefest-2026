import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { audit, declarations } from './css-audit.mjs';
import { contrast, css, day, pageDir, palette, resolve } from './css-tokens.mjs';

// Pinned TPColors snapshot (source file, commit and date inside). Required: the palette check never skips.
const SNAPSHOT_PATH = join(pageDir, 'tests/fixtures/tp_colors.json');
const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
const paletteHexes = new Set(Object.values(snapshot.colors));

// Optional extra: a TownPass checkout next to this repo (Orca layout); override with TP_COLORS_DART=/path/to/tp_colors.dart.
const DART = process.env.TP_COLORS_DART
  || join(pageDir, '../../../../../TownPass/situation-entry/lib/util/tp_colors.dart');

test('the TPColors snapshot records its source, commit and date, and lists all 57 colours', () => {
  assert.match(snapshot.source, /tp_colors\.dart$/);
  assert.match(snapshot.commit, /^[0-9a-f]{40}$/);
  assert.match(snapshot.fetched, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Object.keys(snapshot.colors).length, 57);
});

test('styles.css declares exactly the TPColors snapshot as --tp-* variables', () => {
  assert.deepEqual(palette, snapshot.colors);
});

test('the TPColors snapshot still matches tp_colors.dart in the local TownPass checkout',
  { skip: !existsSync(DART) && `SKIPPED: no TownPass checkout at ${DART} (set TP_COLORS_DART); the pinned snapshot check above still ran` }, () => {
    const dart = Object.fromEntries([...readFileSync(DART, 'utf8').matchAll(/static const Color (\w+?)(\d*) = Color\(0xFF([0-9A-Fa-f]{6})\)/g)]
      .map(([, family, step, hex]) => [`--tp-${family}${step ? `-${step}` : ''}`, `#${hex.toLowerCase()}`]));
    assert.deepEqual(snapshot.colors, dart);
  });

test('styles.css: every colour is var(--tp-*) or rgba(<TPColors>, a), every font size and weight is TPTextStyles', () => {
  assert.ok(declarations(css).length > 300, 'parser found too few declarations');
  assert.deepEqual(audit(css, paletteHexes), []);
});

// Each mutation is injected into the real stylesheet in memory; the audit must reject it.
const MUTATIONS = {
  'named colour': '.x { color: rebeccapurple; }',
  'color() function': '.x { background: color(srgb 1 0 0); }',
  'hex in a border': '.x { border: 1px solid #5ab4c5; }',
  'off-palette rgba shadow': '.x { box-shadow: 0 1px 2px rgba(1, 2, 3, 0.2); }',
  'named outline colour': '.x { outline: 2px solid red; }',
  'hsl fill': '.x { fill: hsl(0 0% 0%); }',
  'named colour in a semantic token': ':root { --go: teal; }',
  'undefined variable': '.x { color: var(--nope); }',
  'var() with a fallback colour': '.x { color: var(--ink, black); }',
  'font shorthand with heavy weight and off-scale size': '.x { font: 900 23px sans-serif; }',
  'font shorthand with off-scale size only': '.x { font: 600 15px/1.4 sans-serif; }',
  'off-scale font-size': '.x { font-size: 15px; }',
  'keyword font-size': '.x { font-size: large; }',
  'off-scale font-weight': '.x { font-weight: 700; }',
  'colour literal hidden in another property': '.x { mask: linear-gradient(#000, transparent); }',
  // Review round 13: vendor-prefixed and rarely-used colour properties.
  '-webkit-text-fill-color with !important': '.x { -webkit-text-fill-color: rebeccapurple !important; }',
  '-webkit-text-stroke colour': '.x { -webkit-text-stroke: 1px rebeccapurple; }',
  '-webkit-tap-highlight-color': '.x { -webkit-tap-highlight-color: red; }',
  'caret-color': '.x { caret-color: red; }',
  'accent-color': '.x { accent-color: red; }',
  'text-decoration-color': '.x { text-decoration-color: red; }',
  'column-rule colour': '.x { column-rule: 1px solid red; }',
  'scrollbar-color': '.x { scrollbar-color: red blue; }',
  'gradient background': '.x { background: linear-gradient(var(--go), red); }',
  // Review round 13: upper case must not hide a value.
  'upper-case BOLD in the font shorthand': '.x { font: BOLD 16px sans-serif !important; }',
  'upper-case property and value': '.x { FONT-WEIGHT: BOLD; }',
  'upper-case named colour': '.x { COLOR: RED; }',
  'font-weight bolder': '.x { font-weight: bolder; }',
  'font-weight lighter in the shorthand': '.x { font: lighter 16px sans-serif; }',
  'upper-case off-scale font size': '.x { font-size: 15PX; }',
  // Review round 13: currentColor on text or surfaces can erase contrast.
  'color: currentColor': '.dial { color: currentColor; }',
  'background: currentColor': '.x { background: currentColor; }',
  'semantic token set to currentColor': ':root { --ink: currentColor; }',
  // Review round 14: weights through var() or CSS escapes, and keywords whose weight the audit cannot see.
  'font shorthand weight through a variable': ':root { --heavy: 900; } .dial { font: var(--heavy) 16px sans-serif; }',
  'font-weight through a variable': ':root { --heavy: 900; } .dial { font-weight: var(--heavy); }',
  'font-weight through a chain of variables': ':root { --a: var(--b); --b: 700; } .x { font-weight: var(--a); }',
  'variable that is 600 in one rule and 900 in another': ':root { --w: 600; } .y { --w: 900; } .x { font-weight: var(--w); }',
  'font-weight var() with a fallback': '.x { font-weight: var(--nope, 900); }',
  'font shorthand whose size and weight come from one variable': ':root { --f: 900 16px; } .x { font: var(--f) sans-serif; }',
  'escaped bold with a space in font-weight': '.x { font-weight: \\62 old; }',
  'escaped bold without a space in the font shorthand': '.x { font: \\62old 16px sans-serif; }',
  'escaped property name': '.x { font-w\\65 ight: 900; }',
  'escaped named colour': '.x { color: r\\65 d; }',
  'font-weight inherit': '.x { font-weight: inherit; }',
  'font-weight unset': '.x { font-weight: unset; }',
  'font-weight initial': '.x { font-weight: initial; }',
  'font-weight revert (browser default, bold on headings)': '.x { font-weight: revert; }',
  'font revert': '.x { font: revert; }',
  'unknown word before the size in the font shorthand': '.x { font: heavy 16px sans-serif; }',
  'font-variation-settings weight axis': '.x { font-variation-settings: "wght" 900; }',
};
for (const [name, rule] of Object.entries(MUTATIONS)) {
  test(`audit rejects ${name}`, () => {
    assert.notDeepEqual(audit(`${css}\n${rule}\n`, paletteHexes), [], `${rule} slipped through`);
  });
}

// The audit must not be so strict that legitimate values fail.
const ACCEPTED = {
  'currentColor on a border': '.x { border: 1px solid currentColor; }',
  'currentColor on an svg stroke': '.x { stroke: currentColor; fill: currentColor; }',
  'font-weight normal (400)': '.x { font-weight: normal; }',
  'upper-case 600 shorthand with !important': '.x { FONT: 600 16PX/1.4 SANS-SERIF !IMPORTANT; }',
  'token colour with !important': '.x { color: var(--ink) !important; }',
  'font-weight through a variable set to 600': ':root { --strong: 600; } .x { font-weight: var(--strong); }',
  'italic 600 font shorthand': '.x { font: italic 600 14px sans-serif; }',
  'font: inherit (takes the audited parent font)': '.x { font: inherit; }',
};
for (const [name, rule] of Object.entries(ACCEPTED)) {
  test(`audit accepts ${name}`, () => {
    assert.deepEqual(audit(`${css}\n${rule}\n`, paletteHexes), []);
  });
}

test('the browser theme colour in index.html is the white page colour, with no night variant', () => {
  const html = readFileSync(join(pageDir, 'index.html'), 'utf8');
  const meta = html.match(/<meta name="theme-color"[^>]*>/)[0];
  assert.equal(meta.match(/content="([^"]+)"/)[1].toLowerCase(), resolve(day, '--desk'));
  assert.doesNotMatch(meta, /data-(day|night)/);
});

test('text uses the system UI font (PingFang TC on iOS, Roboto + Noto Sans TC on Android); no web font', () => {
  assert.match(css, /font-family:\s*system-ui,\s*-apple-system,\s*"PingFang TC"/);
  assert.doesNotMatch(css, /@font-face|@import/);
});

test('the page loads nothing from another origin (zero external requests)', () => {
  const html = readFileSync(join(pageDir, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/\b(?:src|href|srcset|poster|data)\s*=\s*"([^"]*)"/gi)].map((m) => m[1]);
  assert.ok(refs.length >= 5, 'expected the page’s own stylesheet and scripts');
  for (const ref of refs) assert.doesNotMatch(ref, /^(?:[a-z][\w+.-]*:|\/\/)/i, `external resource ${ref}`);
  assert.doesNotMatch(html, /rel="(?:preconnect|dns-prefetch|preload|prefetch)"/, 'resource hints open connections');
  for (const m of css.matchAll(/url\(([^)]*)\)/g)) assert.doesNotMatch(m[1], /^['"]?(?:[a-z][\w+.-]*:|\/\/)/i, `external url ${m[1]}`);
});

// [text token, background token] pairs that carry readable text, in both periods.
const PAIRS = [
  ['--ink', '--paper'], ['--muted', '--paper'], ['--ink', '--tint'], ['--muted', '--tint'],
  ['--on-desk', '--desk'], ['--on-desk-muted', '--desk'], ['--desk-link', '--desk'],
  ['--go', '--paper'], ['--go', '--tint'], ['--go', '--desk'], ['--on-go', '--go'], ['--on-go', '--go-press'], ['--tick', '--paper'],
  ['--band-ink', '--band'], ['--band-sub', '--band'], ['--band-ink', '--paper'], ['--band-ink', '--desk'], ['--ink', '--band'],
  ['--on-desk', '--band'], ['--on-desk-muted', '--band'], ['--desk-link', '--band'],
  ['--on-urgent', '--urgent'], ['--on-urgent-sub', '--urgent'], ['--on-closed', '--closed-fill'],
  ['--urgent-text', '--paper'], ['--urgent-text', '--desk'], ['--urgent-text', '--sos-bg'], ['--ink', '--urgent-soft'],
  ['--closed', '--paper'], ['--closed', '--tint'], ['--closed', '--blank'], ['--ink', '--blank'], ['--pending-ink', '--blank'],
  ['--cat-ink', '--cat-bg'], ['--cat-count-ink', '--cat-count-bg'], ['--cat-on-ink', '--cat-on-bg'],
  ['--cat-on-count-ink', '--cat-on-count-bg'], ['--cat-empty-ink', '--cat-bg'], ['--cat-empty-ink', '--cat-count-bg'],
  ['--on-done', '--done'], ['--note-ink', '--note-bg'],
];

// One token set for day and night (see situation-night.test.mjs), so each pair is checked once.
for (const [fg, bg] of PAIRS) {
  test(`${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
    const ratio = contrast(resolve(day, fg), resolve(day, bg));
    assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
  });
}
test('focus ring stands out from desk and paper (3:1, non-text)', () => {
  for (const bg of ['--desk', '--paper']) {
    const ratio = contrast(resolve(day, '--focus'), resolve(day, bg));
    assert.ok(ratio >= 3, `--focus on ${bg} is ${ratio.toFixed(2)}:1`);
  }
});
