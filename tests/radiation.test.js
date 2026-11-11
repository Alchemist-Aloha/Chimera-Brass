import test from 'node:test';
import assert from 'node:assert/strict';
import { BellRadiation } from '../src/dsp/radiation.js';
import { BELL, bellRadius, boreProfile } from '../src/dsp/trumpet.js';

test('Bessel bell is monotone, meets both bore radii, and is the solver geometry', () => {
  assert.equal(bellRadius(0), BELL.entryRadius);
  assert.ok(Math.abs(bellRadius(1) - BELL.radius) < 1e-14);
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const radius = bellRadius(i / 100);
    assert.ok(Number.isFinite(radius) && radius > previous);
    previous = radius;
  }
  for (const valves of [[false, false, false], [true, true, true]]) {
    const { length, radii } = boreProfile(valves);
    radii.forEach((radius, i) => {
      const x = (i + 0.5) * length / radii.length;
      if (x >= length - BELL.length) assert.ok(Math.abs(radius - bellRadius((x - length + BELL.length) / BELL.length)) < 1e-14);
    });
  }
});

test('causal bell radiation matches the published fit and cannot amplify any frequency', () => {
  const speed = 343.42, radius = BELL.radius;
  for (const rate of [32000, 96000, 192000]) {
    const filter = new BellRadiation(rate, speed, radius);
    const impulse = Float64Array.from({ length: 4096 }, (_, i) => filter.step(i === 0 ? 1 : 0));
    assert.ok(impulse.every(Number.isFinite));
    assert.ok(Math.abs(impulse.reduce((s, v) => s + v, 0) + 1) < 1e-10, 'pressure-release DC limit');
    for (const ka of [0.01, 0.1, 0.5, 1, 2, 4, 8]) {
      const w = 2 * Math.atan(ka / (2 * rate * radius / speed));
      let re = 0, im = 0;
      impulse.forEach((v, i) => { re += v * Math.cos(w * i); im -= v * Math.sin(w * i); });
      const dr = 1 - 0.457 * ka * ka, di = 1.393 * ka;
      const denom = dr * dr + di * di;
      const expectedRe = -(dr + 0.167 * ka * di) / denom;
      const expectedIm = -(0.167 * ka * dr - di) / denom;
      assert.ok(Math.hypot(re - expectedRe, im - expectedIm) < 1e-10);
      assert.ok(Math.hypot(re, im) <= 1);
      if (ka === 0.01) {
        const endCorrection = Math.atan2(im, -re) / (2 * ka);
        assert.ok(Math.abs(endCorrection - 0.6133) < 0.001);
        assert.ok(Math.abs((1 - Math.hypot(re, im)) / (ka * ka) - 0.5) < 0.003);
      }
    }
  }
});
