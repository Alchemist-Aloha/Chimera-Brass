import test from 'node:test';
import assert from 'node:assert/strict';
import { TrumpetModel, lipFlow, boreProfile, VALVE_LENGTHS, validateParameters } from '../src/dsp/trumpet.js';
import { Waveguide } from '../src/dsp/waveguide.js';
import { tractDiameters } from '../src/dsp/tract.js';
import { estimatePitch } from '../src/ui/pitch.js';

const rms = a => Math.sqrt(a.reduce((sum, x) => sum + x * x, 0) / a.length);
function render(parameters, rate = 48000, seconds = 1) {
  const model = new TrumpetModel(rate, parameters);
  const samples = new Float32Array(Math.round(rate * seconds));
  model.process(samples);
  return { model, samples };
}

test('trust boundary rejects malformed, nonfinite and unknown controls without mutation', () => {
  for (const patch of [null, [], { pressure: NaN }, { pressure: -1 }, { pressure: 16 },
    { lipFrequency: Infinity }, { valves: [1, 0, 0] }, { valves: [true] }, { valves: new Array(3) },
    { blowing: 1 }, { random: 4 }, { toString: 4 }]) assert.throws(() => validateParameters(patch));
  const m = new TrumpetModel();
  assert.throws(() => m.setParameters({ pressure: 4, tongue: NaN }));
  assert.equal(m.params.pressure, 5.5);
  assert.throws(() => new TrumpetModel(0));
  assert.throws(() => new TrumpetModel(Infinity));
});

test('Bernoulli junction satisfies both impedances, including reverse flow and closure', () => {
  const rho = 1.204, z = 3e6, opening = 0.0003, width = 0.012;
  for (const available of [-12000, -100, 0, 100, 12000]) {
    const u = lipFlow(available, opening, z);
    const delta = available - z * u;
    const expected = Math.sign(delta) * width * opening * Math.sqrt(2 * Math.abs(delta) / rho);
    assert.ok(Math.abs(u - expected) < 1e-12);
  }
  assert.equal(lipFlow(5000, 0, z), 0);
});

test('Kelly–Lochbaum junction does not create pressure-wave energy', () => {
  const radii = new Float64Array([0.005, 0.01]);
  const wave = new Waveguide(radii, 96000, 343, 0);
  wave.forward[0] = 3;
  wave.backward[1] = -2;
  const incoming = 3 ** 2 * radii[0] ** 2 + 2 ** 2 * radii[1] ** 2;
  wave.step(0, 0);
  // Account for the intentional passive wall smoothing; it cannot add energy.
  const outgoing = wave.backward[0] ** 2 * radii[0] ** 2 + wave.forward[1] ** 2 * radii[1] ** 2;
  assert.ok(outgoing <= incoming);
  assert.ok(outgoing > incoming * 0.99);
});

test('uniform tube round-trip time follows physical length and wave speed', () => {
  const wave = new Waveguide(new Float64Array(100).fill(0.005), 96000, 343, 0);
  let firstReturn = -1;
  for (let i = 0; i < 250; i++) {
    const reflected = wave.forward[99] * -1;
    if (firstReturn < 0 && Math.abs(wave.backward[0]) > 0.5) firstReturn = i;
    wave.step(i === 0 ? 1 : 0, reflected);
  }
  assert.equal(firstReturn, 200);
  assert.ok(Math.abs(2 * (100 * wave.dx) / 343 - firstReturn / 96000) < 1e-12);
});

test('each valve adds its actual tubing length and all bore radii stay positive', () => {
  const base = boreProfile();
  for (let mask = 0; mask < 8; mask++) {
    const valves = [!!(mask & 1), !!(mask & 2), !!(mask & 4)];
    const profile = boreProfile(valves);
    const expected = 1.48 + VALVE_LENGTHS.reduce((s, length, i) => s + (valves[i] ? length : 0), 0);
    assert.equal(profile.length, expected);
    assert.ok(profile.radii.every(r => Number.isFinite(r) && r >= 0.00185 && r <= 0.0615));
    assert.ok(profile.radii.length >= base.radii.length);
  }
  assert.ok(VALVE_LENGTHS[1] < VALVE_LENGTHS[0] && VALVE_LENGTHS[0] < VALVE_LENGTHS[2]);
});

test('tongue reuses a positive 44-section oral shape and changes constriction', () => {
  const low = tractDiameters(0), high = tractDiameters(1);
  assert.equal(low.length, 44);
  assert.ok(high.every(d => d > 0));
  assert.notDeepEqual(low, high);
  assert.ok(high[30] < low[30], 'arched tongue narrows the oral cavity behind the fixed lip opening');
});

test('no pressure creates no sound; default pressure self-excites a stable harmonic note', () => {
  const silent = render({ blowing: true, pressure: 0 });
  assert.equal(rms(silent.samples), 0);
  const { model, samples } = render({ blowing: true }, 48000, 2);
  assert.equal(model.fault, false);
  assert.ok(rms(samples.slice(-48000)) > 0.02);
  assert.ok(samples.every(v => Number.isFinite(v) && Math.abs(v) <= 0.65));
  const pitch = estimatePitch(samples.slice(-4096), 48000);
  assert.ok(pitch > 300 && pitch < 450, 'bore-selected pitch, not a forced 280 Hz oscillator');
});

test('stopping breath dissipates stored acoustic energy', () => {
  const { model } = render({ blowing: true });
  model.setParameters({ blowing: false });
  const tail = new Float32Array(48000 * 2);
  model.process(tail);
  assert.ok(rms(tail.slice(-4800)) < 1e-5);
});

test('tongue and head length affect the coupled sound', () => {
  const a = render({ blowing: true, tongue: 0.2 });
  const b = render({ blowing: true, tongue: 0.8 });
  const c = render({ blowing: true, tractLength: 0.21 });
  assert.notDeepEqual(a.samples.slice(-128), b.samples.slice(-128));
  assert.notEqual(a.model.tract.n, c.model.tract.n);
  assert.notDeepEqual(a.samples.slice(-128), c.samples.slice(-128));
});

test('live geometry changes fade through a finite restart and update physical length', () => {
  const { model } = render({ blowing: true });
  model.setParameters({ valves: [true, false, true], temperature: 30, tractLength: 0.2 });
  const transition = new Float32Array(48000);
  model.process(transition);
  assert.equal(model.rebuilding, false);
  assert.ok(Math.abs(model.length - 1.48 - VALVE_LENGTHS[0] - VALVE_LENGTHS[2]) < 1e-10);
  assert.ok(transition.every(v => Number.isFinite(v) && Math.abs(v) <= 0.65));
  assert.equal(model.fault, false);
});

test('supported sample rates and extreme controls remain finite and bounded', () => {
  for (const rate of [16000, 32000, 44100, 48000, 96000]) {
    for (const parameters of [
      { blowing: true },
      { blowing: true, pressure: 15, lipFrequency: 90, lipQ: 12, opening: 0.8, tongue: 1, valves: [true, true, true] },
      { blowing: true, pressure: 15, lipFrequency: 900, lipQ: 1.5, opening: 0, tongue: 0, tractLength: 0.13 },
    ]) {
      const { samples, model } = render(parameters, rate, 0.5);
      assert.equal(model.fault, false, JSON.stringify({ rate, parameters }));
      assert.ok(samples.every(x => Number.isFinite(x) && Math.abs(x) <= 0.65));
    }
  }
});

test('physical pitch is consistent across common audio sample rates', () => {
  const frequencies = [32000, 44100, 48000, 96000].map(rate => {
    const { samples } = render({ blowing: true }, rate, 1.5);
    return estimatePitch(samples.slice(-4096), rate);
  });
  assert.ok(frequencies.every(f => Math.abs(f - frequencies[0]) / frequencies[0] < 0.01));
});

test('solver fault latches silence rather than emitting NaN', () => {
  const model = new TrumpetModel();
  model.velocity = NaN;
  assert.equal(model.step(), 0);
  assert.equal(model.fault, true);
  const samples = new Float32Array(128);
  model.process(samples);
  assert.equal(rms(samples), 0);
});
