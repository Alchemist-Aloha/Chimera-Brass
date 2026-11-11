import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatePitch } from '../src/ui/pitch.js';

test('pitch detector finds a fundamental even when its second harmonic dominates', () => {
  for (const rate of [44100, 48000, 96000]) for (const frequency of [116.54, 233.08, 349.23, 700]) {
    const samples = Float32Array.from({ length: 4096 }, (_, i) =>
      0.07 * Math.sin(2 * Math.PI * frequency * i / rate) +
      0.2 * Math.sin(4 * Math.PI * frequency * i / rate));
    assert.ok(Math.abs(estimatePitch(samples, rate) - frequency) < frequency * 0.01);
  }
});
test('pitch detector returns no pitch for silence and deterministic broadband noise', () => {
  assert.equal(estimatePitch(new Float32Array(4096), 48000), 0);
  let seed = 1;
  const noise = Float32Array.from({ length: 4096 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return seed / 2147483648 * 0.1;
  });
  assert.equal(estimatePitch(noise, 48000), 0);
});
