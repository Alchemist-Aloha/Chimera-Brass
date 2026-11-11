import test from 'node:test';
import assert from 'node:assert/strict';
import { TrumpetModel } from '../src/dsp/trumpet.js';
import { noteParameters } from '../src/music/notes.js';
import { MIN_NOTE, MAX_NOTE, noteFrequency, noteName } from '../src/music/fingering.js';
import { estimatePitch } from '../src/ui/pitch.js';
import { PhysicalPlayer } from '../src/music/player.js';
import { parseMidi } from '../src/music/midi.js';
import { readFileSync } from 'node:fs';
import { measureAttack } from '../scripts/measure-attacks.js';

const cents = (hz, midi) => 1200 * Math.log2(hz / noteFrequency(midi));

for (const [articulation, tolerance, drift] of [['tu', 25, 15], ['ku', 50, 25]]) {
test(`all 31 physical embouchures sustain their chromatic pitch with ${articulation} (${tolerance} cents)`, () => {
  for (let midi = MIN_NOTE; midi <= MAX_NOTE; midi++) {
    const player = new PhysicalPlayer(48000);
    player.model.setParameters({ articulation });
    player.start([{ midi, time: 0, duration: 3.1, velocity: 1 }]);
    const output = new Float32Array(144000);
    player.process(output);
    const model = player.model;
    const tail = output.subarray(-4096), hz = estimatePitch(tail, 48000);
    const previous = estimatePitch(output.subarray(-8192, -4096), 48000);
    const rms = Math.sqrt(tail.reduce((sum, value) => sum + value * value, 0) / tail.length);
    const label = `written ${noteName(midi + 2)}, concert ${noteName(midi)}`;
    assert.equal(model.fault, false, label);
    assert.ok(hz && Math.abs(cents(hz, midi)) < tolerance, `${label}: ${hz} Hz, ${cents(hz, midi)} cents`);
    assert.ok(previous && Math.abs(1200 * Math.log2(hz / previous)) < drift, `${label}: unstable pitch`);
    assert.ok(rms > 0.01, `${label}: inaudible oscillation`);
    assert.ok(output.every(value => Number.isFinite(value) && Math.abs(value) <= 0.65), label);
    // Regression limits include the 85 ms analysis window, not just physical lip latency.
    const deadlines = { 59: 2.6, 60: 1.2, 61: 1, 62: 1.2, 64: 0.8, 65: 0.6 };
    if (articulation === 'tu' && midi in deadlines) {
      const attack = measureAttack(output, midi);
      assert.ok(attack !== null && attack < deadlines[midi], `${label}: slow attack ${attack}s`);
    }
  }
});
}

test('MIDI uses the exact pressure-driven solver, and calibrated lips cannot sound without pressure', () => {
  const player = new PhysicalPlayer(48000);
  player.start([{ midi: 70, time: 0, duration: 1, velocity: 1 }]);
  const model = new TrumpetModel(48000, noteParameters(70)); model.articulate();
  const a = new Float32Array(256), b = new Float32Array(256);
  player.process(a); model.process(b);
  assert.deepEqual(a, b);
  const silent = new TrumpetModel(48000, { ...noteParameters(70), pressure: 0 });
  silent.articulate(); const buffer = new Float32Array(24000); silent.process(buffer);
  assert.ok(buffer.every(value => value === 0));
});

test('tongue articulation closes then releases the aperture without resetting acoustic memory', () => {
  const model = new TrumpetModel(48000, { blowing: true });
  model.process(new Float32Array(4800));
  const displacement = model.displacement, bore = model.bore;
  model.articulate();
  assert.equal(model.displacement, displacement); assert.equal(model.bore, bore);
  model.process(new Float32Array(864)); assert.equal(model.tongueGate, 0);
  model.process(new Float32Array(72)); assert.ok(Math.abs(model.tongueGate - 0.5) < 1e-12);
  model.process(new Float32Array(73)); assert.equal(model.tongueGate, 1);
  assert.equal(model.fault, false);
});

test('register attack gestures settle at exactly 80 ms without replacing the model', () => {
  const player = new PhysicalPlayer(48000);
  player.start([{ midi: 72, time: 0, duration: 0.2, velocity: 1 }]);
  const model = player.model;
  player.process(new Float32Array(3840));
  assert.equal(model.params.lipFrequency, noteParameters(72, true).lipFrequency);
  player.process(new Float32Array(1));
  assert.equal(model.params.lipFrequency, noteParameters(72).lipFrequency);
  assert.equal(player.model, model);
});

for (const articulation of ['tu', 'ku']) for (const [name, tolerance] of [['ode-to-joy', 25], ['william-tell', 25], ['chromatic', 50]]) {
  test(`entire ${name} MIDI score (${articulation}) sounds its notes through one continuous physical model`, () => {
    const notes = parseMidi(readFileSync(`public/scores/${name}.mid`)).tracks[0].notes;
    const player = new PhysicalPlayer(48000);
    player.model.setParameters({ articulation }); player.start(notes);
    const model = player.model, output = new Float32Array(Math.ceil((player.duration + 1) * 48000));
    player.process(output);
    assert.equal(player.model, model); assert.equal(model.fault, false); assert.equal(player.active, false);
    assert.equal(model.params.blowing, false);
    for (const [i, note] of notes.entries()) {
      const end = Math.round((note.time + note.duration - 0.02) * 48000);
      const tail = output.subarray(end - 4096, end), hz = estimatePitch(tail, 48000);
      const rms = Math.sqrt(tail.reduce((s, v) => s + v * v, 0) / tail.length);
      assert.ok(hz && Math.abs(cents(hz, note.midi)) < tolerance, `note ${i}, concert ${noteName(note.midi)}: ${cents(hz, note.midi)} cents`);
      assert.ok(rms > 0.01, `note ${i} is too quiet`);
    }
    assert.ok(output.every(v => Number.isFinite(v) && Math.abs(v) <= 0.65));
    const tail = output.subarray(-4096);
    assert.ok(Math.sqrt(tail.reduce((s, v) => s + v * v, 0) / tail.length) < 0.001);
  });
}
