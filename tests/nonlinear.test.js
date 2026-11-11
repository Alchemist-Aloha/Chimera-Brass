import test from 'node:test';
import assert from 'node:assert/strict';
import { CylinderDelay } from '../src/dsp/cylinder.js';
import { TrumpetModel } from '../src/dsp/trumpet.js';
import { TromboneModel } from '../src/dsp/trombone.js';
import { noteParameters } from '../src/music/notes.js';
import { estimatePitch } from '../src/ui/pitch.js';

// Spectral centroid of a Hann-windowed frame: a simple brightness measure.
function centroid(x, rate) {
  const N = x.length; let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const w = (0.5 - 0.5 * Math.cos(2 * Math.PI * n / N)) * x[n], a = 2 * Math.PI * k * n / N;
      re += w * Math.cos(a); im -= w * Math.sin(a);
    }
    const m = Math.hypot(re, im); num += m * k * rate / N; den += m;
  }
  return num / den;
}

test('a linear moving tube delays, attenuates and conserves a small pulse', () => {
  const tube = new CylinderDelay(96000, 343.4, 0.006, 0.5, { minLength: 0.3, maxLength: 0.8 });
  tube.nonlinear = false;
  let arrival = -1, sum = 0;
  for (let n = 0; n < 400; n++) {
    tube.step(n === 0 ? 1 : 0, 0);
    sum += tube.toBell;
    if (arrival < 0 && tube.toBell > 0.05) arrival = n;
  }
  const cells = 0.5 * 96000 / 343.4;
  assert.ok(Math.abs(arrival - cells) < 4, `arrival ${arrival} vs ${cells}`);
  assert.ok(sum > 0.9 && sum <= 1, 'DC gain equals wall attenuation');
});

test('loud crests arrive early and steepen, quiet ones do not; the read point never runs backwards', () => {
  const run = amplitude => {
    const tube = new CylinderDelay(96000, 343.4, 0.006, 1, { minLength: 1, maxLength: 1 });
    tube.setNonlinearLength(1);
    const out = [];
    let last = -Infinity;
    for (let n = 0; n < 1600; n++) {
      tube.step(amplitude * Math.sin(2 * Math.PI * 500 * n / 96000), 0);
      out.push(tube.toBell);
      assert.ok(tube.lastRead >= last - 1e-9 - (n && tube.cursor === 0 ? tube.forward.length : 0));
      last = tube.lastRead;
    }
    return out.slice(-192); // one period
  };
  const slope = wave => Math.max(...wave.slice(1).map((v, i) => v - wave[i])) / Math.max(...wave.map(Math.abs));
  const quiet = slope(run(10)), loud = slope(run(8000));
  assert.ok(loud > quiet * 1.5, `loud wavefront should steepen: ${loud} vs ${quiet}`);
});

for (const [name, Model, params] of [['trumpet', TrumpetModel, noteParameters(70)], ['trombone', TromboneModel, noteParameters(58, false, 'trombone')]]) {
  test(`${name}: steepening brightens a fortissimo without moving its pitch`, () => {
    const result = {};
    for (const nonlinear of [false, true]) {
      const m = new Model(48000, { ...params, pressure: 12, nonlinear }); m.articulate();
      const out = new Float32Array(72000); m.process(out);
      assert.equal(m.fault, false);
      const tail = out.slice(-2048);
      result[nonlinear] = { hz: estimatePitch(out.slice(-4096), 48000), brightness: centroid(tail, 48000), steepening: m.telemetry().steepening };
    }
    assert.ok(result.true.brightness > result.false.brightness * 1.15, JSON.stringify(result));
    assert.ok(Math.abs(1200 * Math.log2(result.true.hz / result.false.hz)) < 15, JSON.stringify(result));
    assert.equal(result.false.steepening, 0);
    assert.ok(result.true.steepening > 20, 'telemetry reports crest advance in µs');
  });
}

test('steepening can be toggled live without a geometry restart', () => {
  const m = new TrumpetModel(48000, { blowing: true, pressure: 10 });
  m.process(new Float32Array(4800));
  const bore = m.bore;
  m.setParameters({ nonlinear: false });
  assert.equal(m.rebuilding, false); assert.equal(m.bore, bore); assert.equal(bore.tube.nonlinear, false);
  assert.throws(() => m.setParameters({ nonlinear: 'yes' }));
});
