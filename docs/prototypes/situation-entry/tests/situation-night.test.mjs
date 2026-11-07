// Night keeps the daytime TownPass colours (TownPass ships only a light ThemeData, no darkTheme).
// Only the content changes after hours, and one light strip (.night-note) says so.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { buildData } from '../build-data.mjs';
import { declarations } from './css-audit.mjs';
import { contrast, css, day, pageDir, resolve } from './css-tokens.mjs';

const data = buildData();
const { app, core } = (() => {
  const context = { window: {} };
  context.window.window = context.window;
  for (const file of ['core.js', 'app.js']) vm.runInNewContext(readFileSync(join(pageDir, file), 'utf8'), context);
  return { app: context.window.SituationApp, core: context.window.SituationCore };
})();
const pages = (period, district = '') => [
  ['home', app.render(data, { id: null, period, district }, new Set())],
  ...data.situations.map((s) => [s.id, app.render(data, { id: s.id, period, district }, new Set())]),
];
const classes = (html) => new Set([...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));

test('night and day use the same colour tokens: every custom property is declared under plain :root only', () => {
  const owners = new Set(declarations(css).filter((d) => d.prop.startsWith('--')).map((d) => d.selector));
  assert.deepEqual([...owners], [':root']);
});

test('no stylesheet rule switches on the period or the OS dark mode', () => {
  assert.doesNotMatch(css, /data-period|prefers-color-scheme|\.is-night|\.night(?!-note)/i);
});

test('the page stays white day and night, as in the TownPass service tab', () => {
  assert.equal(resolve(day, '--desk'), '#ffffff');
  assert.equal(resolve(day, '--paper'), '#ffffff');
});

test('card heads and buttons are TownPass primary teal, not yellow', () => {
  for (const name of ['--band', '--go', '--cat-on-bg']) assert.match(day[name], /^var\(--tp-primary-\d+\)$/, `${name} is ${day[name]}`);
});

test('night: home and every situation card show the night strip; day shows none', () => {
  for (const [page, html] of pages('night')) assert.match(html, /<p class="night-note" data-night-note><svg[^>]*>.*?<\/svg><span>現在是晚上或假日，/, `${page} at night has no strip`);
  for (const [page, html] of pages('day')) assert.doesNotMatch(html, /night-note/, `${page} by day shows the night strip`);
});

test('night: on a card the strip sits right above 「現在打給」, inside the call part', () => {
  const html = app.renderCard(data, data.situations.find((s) => s.id === 'food'), { id: 'food', period: 'night', district: '' }, new Set());
  const call = html.slice(html.indexOf('<section class="part call"'), html.indexOf('</section>'));
  assert.ok(call.indexOf('data-night-note') >= 0 && call.indexOf('data-night-note') < call.indexOf('<p class="label">'));
});

test('night uses no class that the day pages lack, except the strip: only content changes, never the look', () => {
  const dayClasses = classes([...pages('day'), ...pages('day', '中正區')].map(([, html]) => html).join(''));
  for (const [page, html] of pages('night')) {
    // is-closed marks a line outside its hours; day shows it too (12:45 lunch, see situation-data tests).
    const extra = [...classes(html)].filter((c) => !dayClasses.has(c) && c !== 'night-note' && c !== 'is-closed');
    assert.deepEqual(extra, [], `${page} at night adds ${extra}`);
  }
});

test('the night strip text meets WCAG AA (4.5:1) and its moon icon 3:1 on the strip', () => {
  const ratio = contrast(resolve(day, '--note-ink'), resolve(day, '--note-bg'));
  assert.ok(ratio >= 4.5, `--note-ink on --note-bg is ${ratio.toFixed(2)}:1`);
  const icon = contrast(resolve(day, '--note-mark'), resolve(day, '--note-bg'));
  assert.ok(icon >= 3, `--note-mark on --note-bg is ${icon.toFixed(2)}:1`);
});

test('the night strip is a light TPColors tint with a hairline edge, not a filled colour block', () => {
  assert.equal(day['--note-bg'], 'var(--tp-secondary-50)');
  const rule = declarations(css).filter((d) => d.selector === '.night-note');
  assert.ok(rule.some((d) => d.prop === 'background' && d.value === 'var(--note-bg)'));
  assert.ok(rule.some((d) => d.prop === 'border' && /^1px solid var\(--note-edge\)$/.test(d.value)));
});

// Review round 15: the strip must not say a number is reachable when the card shows it closed.
const stripText = (html) => html.match(/data-night-note><svg[^>]*>.*?<\/svg><span>([^<]*)<\/span>/)[1];

for (const s of data.situations) {
  test(`night: the ${s.id} card strip matches whether its number is open now`, () => {
    const { status } = core.plan(data, s, 'night', '');
    const text = stripText(app.renderCard(data, s, { id: s.id, period: 'night', district: '' }, new Set()));
    if (status.open) {
      assert.equal(text, '現在是晚上或假日，先給晚上打得通的電話');
    } else {
      assert.ok(status.next, `${s.id} is closed with no next opening time`);
      assert.equal(text, `現在是晚上或假日，這支電話${status.next}才有人接`);
      assert.doesNotMatch(text, /打得通/);
    }
  });
}

test('night: both kinds of card are covered (1999 open, 412-8518 / 1966 / 0800-030-598 closed)', () => {
  const at = (id) => core.plan(data, data.situations.find((s) => s.id === id), 'night', '');
  assert.equal(at('food').status.open, true);
  for (const id of ['rental', 'discharge', 'nhi']) assert.equal(at(id).status.open, false, `${id} is open at night`);
  const rental = stripText(app.renderCard(data, data.situations.find((s) => s.id === 'rental'), { id: 'rental', period: 'night', district: '' }, new Set()));
  assert.equal(rental, '現在是晚上或假日，這支電話明天 9:00 起才有人接');
});

test('night: a weekend closed card says 週一 in the strip', () => {
  const s = data.situations.find((x) => x.id === 'nhi');
  const moment = { workday: false, minutes: 14 * 60, day: 6 };
  const html = app.renderCard(data, s, { id: s.id, period: 'night', district: '', moment }, new Set());
  assert.equal(stripText(html), '現在是晚上或假日，這支電話週一 8:30 起才有人接');
});

test('night: the home strip and footer never claim every card is reachable', () => {
  const home = app.render(data, { id: null, period: 'night', district: '' }, new Set());
  assert.equal(stripText(home), '現在是晚上或假日，卡片會標出哪些電話現在打得通');
  assert.doesNotMatch(home, /卡片先給晚上打得通/);
});
