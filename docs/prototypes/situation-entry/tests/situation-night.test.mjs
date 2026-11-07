import assert from 'node:assert/strict';
import { test } from 'node:test';
import { day, luminance, night, resolve } from './css-tokens.mjs';

// Contrast for both periods lives in situation-tokens.test.mjs.

test('night: no surface is pure white', () => {
  for (const name of ['--paper', '--tint', '--sos-bg', '--cat-bg', '--cat-on-bg', '--blank', '--urgent-soft', '--urgent', '--closed-fill']) {
    assert.notEqual(resolve(night, name), '#ffffff', `${name} is pure white at night`);
  }
});

test('night: no text token is pure white either', () => {
  for (const name of ['--ink', '--on-desk', '--on-go', '--on-urgent', '--on-closed']) {
    assert.notEqual(resolve(night, name), '#ffffff', `${name} is pure white at night`);
  }
});

test('day: the page is white, as in the TownPass service tab', () => {
  assert.equal(resolve(day, '--desk'), '#ffffff');
  assert.equal(resolve(day, '--paper'), '#ffffff');
});

test('both periods: card heads and buttons are TownPass primary teal, not yellow', () => {
  for (const set of [day, night]) {
    for (const name of ['--band', '--go', '--cat-on-bg']) {
      assert.match(set[name], /^var\(--tp-primary-\d+\)$/, `${name} is ${set[name]}`);
    }
  }
});

test('night: the desk is deep teal and darker than the card face', () => {
  assert.equal(night['--desk'], 'var(--tp-primary-950)');
  assert.ok(luminance(resolve(night, '--desk')) < luminance(resolve(night, '--paper')));
});
