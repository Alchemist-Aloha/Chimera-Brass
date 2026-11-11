import test from 'node:test';
import assert from 'node:assert/strict';
import { TrumpetModel, validateParameters } from '../src/dsp/trumpet.js';
import { Waveguide } from '../src/dsp/waveguide.js';
import { PhysicalPlayer } from '../src/music/player.js';
import { noteParameters } from '../src/music/notes.js';
import { noteFrequency } from '../src/music/fingering.js';
import { estimatePitch } from '../src/ui/pitch.js';

const energy = w => w.forward.reduce((sum, x, i) => sum + w.radii[i] ** 2 * (x * x + w.backward[i] ** 2), 0);

test('articulation and tuning reject invalid controls atomically', () => {
  for (const patch of [{ articulation: 'voice' }, { articulation: null }, { articulation: 1 },
    { tuning: NaN }, { tuning: Infinity }, { tuning: -20.1 }, { tuning: 40.1 }, { tuning: '10' }]) {
    assert.throws(() => validateParameters(patch));
  }
  const m = new TrumpetModel();
  assert.throws(() => m.setParameters({ tuning: 10, articulation: 'invalid' }));
  assert.equal(m.params.tuning, 0); assert.equal(m.params.articulation, 'tu');
});

test('rear tongue junction is passive at every closure and reflects at full contact', () => {
  for (const openness of [0, 0.25, 0.5, 0.75, 1]) {
    const w = new Waveguide(new Float64Array([0.004, 0.009, 0.003, 0.008]), 96000, 343, 0);
    for (let i = 0; i < w.n; i++) { w.forward[i] = Math.sin(i + 1); w.backward[i] = Math.cos(i * 2); }
    const before = energy(w);
    w.step(0, 0, 2, openness);
    assert.ok(energy(w) <= before + 1e-14);
  }
  const w = new Waveguide(new Float64Array([0.004, 0.009]), 96000, 343, 0);
  w.forward[0] = 3; w.backward[1] = -2;
  w.step(0, 0, 1, 0);
  assert.equal(w.forward[1], -2 * 0.997); assert.equal(w.backward[0], 3 * 0.997);
});

test('Tu and Ku close supply flow and release on their distinct physical envelopes without resetting waves', () => {
  for (const rate of [16000, 48000, 96000]) for (const kind of ['tu', 'ku']) {
    const m = new TrumpetModel(rate, { blowing: true, articulation: kind });
    m.process(new Float32Array(Math.round(rate * 0.05)));
    const bore = m.bore, tract = m.tract, radiation = m.radiation, displacement = m.displacement;
    m.articulate();
    assert.equal(m.tongueGate, 0); assert.equal(m.displacement, displacement);
    const hold = kind === 'tu' ? 0.018 : 0.022, release = 0.003;
    m.process(new Float32Array(Math.round(rate * hold)));
    assert.equal(m.tongueGate, 0); assert.equal(m.flow, 0);
    m.process(new Float32Array(Math.round(rate * release / 2)));
    assert.ok(Math.abs(m.tongueGate - 0.5) < 1e-10);
    m.process(new Float32Array(Math.round(rate * release / 2) + 1));
    assert.equal(m.tongueGate, 1);
    assert.equal(m.bore, bore); assert.equal(m.tract, tract); assert.equal(m.radiation, radiation);
    assert.equal(m.telemetry().articulation.kind, kind); assert.equal(m.fault, false);
  }
});

test('Ku produces a different attack, but still requires pressure and sustains the physical pitch', () => {
  const attacks = [];
  for (const articulation of ['tu', 'ku']) {
    const m = new TrumpetModel(48000, { ...noteParameters(70), articulation });
    m.articulate();
    const samples = new Float32Array(48000); m.process(samples);
    attacks.push(samples.subarray(0, 4800));
    const pitch = estimatePitch(samples.subarray(-4096), 48000);
    assert.ok(Math.abs(1200 * Math.log2(pitch / noteFrequency(70))) < 25);
    assert.equal(m.fault, false);
    const silent = new TrumpetModel(48000, { blowing: true, pressure: 0, articulation });
    silent.articulate(); const output = new Float32Array(4800); silent.process(output);
    assert.ok(output.every(x => x === 0));
  }
  assert.ok(attacks[0].some((x, i) => Math.abs(x - attacks[1][i]) > 0.001));
});

test('MIDI preserves tuning and tongue style through note-ons, 80 ms settling and subsequent performances', () => {
  const p = new PhysicalPlayer(48000);
  const note = (midi, time) => ({ midi, time, duration: 0.4, velocity: 0.8 });
  p.model.setParameters({ tuning: 7.5, articulation: 'ku' });
  p.start([note(71, 0), note(72, 0.5)]);
  p.process(new Float32Array(3841));
  assert.equal(p.model.params.lipFrequency, noteParameters(71).lipFrequency);
  assert.equal(p.model.params.tuning, 7.5); assert.equal(p.model.params.articulation, 'ku');
  assert.equal(p.model.attackKind, 'ku');
  const model = p.model;
  p.model.setParameters({ tuning: 12, articulation: 'tu' });
  p.process(new Float32Array(24000));
  assert.equal(p.midi, 72); assert.equal(p.model, model); assert.equal(p.active, true);
  assert.equal(p.model.params.tuning, 12); assert.equal(p.model.params.articulation, 'tu');
  assert.equal(p.model.params.lipFrequency, noteParameters(72).lipFrequency);
  assert.equal(p.model.attackKind, 'tu'); assert.equal(p.model.fault, false);
  p.stop(); p.start([note(70, 0)]);
  assert.equal(p.model.params.tuning, 12); assert.equal(p.model.params.articulation, 'tu');
});
