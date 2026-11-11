import test from 'node:test';
import assert from 'node:assert/strict';
import { PistonBore } from '../src/dsp/bore.js';
import { BASE_LENGTH, VALVE_LENGTHS, boreProfile, TrumpetModel } from '../src/dsp/trumpet.js';
import { noteParameters } from '../src/music/notes.js';
import { estimatePitch } from '../src/ui/pitch.js';

const flags = mask => [!!(mask & 1), !!(mask & 2), !!(mask & 4)];

test('tuning pull lengthens both U-slide legs without changing valve additions', () => {
  for (const tuning of [-20, 0, 7.5, 40]) for (let mask = 0; mask < 8; mask++) {
    const valves = flags(mask), bore = new PistonBore(96000, 343.4, valves, tuning);
    const extra = VALVE_LENGTHS.reduce((s, x, i) => s + (valves[i] ? x : 0), 0);
    const expected = BASE_LENGTH + tuning * 0.002 + extra;
    assert.ok(Math.abs(bore.length - expected) < 1e-12);
    assert.ok(Math.abs(boreProfile(valves, 96000, 343.4, tuning).length - expected) < 1e-12);
    assert.ok(bore.segments.every(s => s.n > 0 && s.radii.every(r => r > 0)));
    assert.ok(Math.abs(bore.segments.reduce((s, g) => s + g.n * g.dx, 0) - BASE_LENGTH - tuning * 0.002) < 343.4 / 96000);
  }
});

test('pulling the main slide lowers actual pitch at a fixed embouchure and can calibrate it', () => {
  const pitches = [];
  for (const tuning of [0, 5, 10]) {
    const m = new TrumpetModel(48000, { ...noteParameters(70), tuning });
    m.articulate();
    const output = new Float32Array(96000); m.process(output);
    pitches.push(estimatePitch(output.subarray(-4096), 48000));
    assert.equal(m.fault, false);
  }
  assert.ok(pitches[0] > pitches[1] && pitches[1] > pitches[2]);
  // This preset is initially sharp; a small real tube-length adjustment crosses its target.
  const target = 440 * 2 ** ((70 - 69) / 12);
  assert.ok(pitches[0] > target && pitches[2] < target);
  assert.ok(Math.abs(1200 * Math.log2(pitches[1] / target)) < 5);
});

test('live tuning fades and rebuilds safely, preserves breath/settings, and works at travel limits', () => {
  for (const tuning of [-20, 40]) {
    const m = new TrumpetModel(48000, { blowing: true });
    m.process(new Float32Array(4800));
    const before = m.bore;
    m.setParameters({ tuning }); assert.equal(m.rebuilding, true);
    const samples = new Float32Array(4800); m.process(samples);
    assert.notEqual(m.bore, before); assert.equal(m.rebuilding, false);
    assert.equal(m.params.blowing, true); assert.equal(m.params.tuning, tuning);
    assert.ok(Math.abs(m.length - BASE_LENGTH - tuning * 0.002) < 1e-12);
    assert.ok(samples.every(x => Number.isFinite(x) && Math.abs(x) <= 0.65));
    assert.equal(m.fade, 1); assert.equal(m.fault, false);
  }
});
