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

test('night: the action-card band stays yellow (amber hue), only dimmed', () => {
  const hex = resolve(night, '--band');
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  assert.ok(r > g && g > b && r - b > 100, `${hex} no longer reads as yellow`);
  assert.ok(luminance(hex) < luminance(resolve(day, '--band')), 'night band should be dimmer than day');
});
