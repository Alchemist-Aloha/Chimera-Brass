import test from 'node:test';
import assert from 'node:assert/strict';
import { TromboneModel } from '../src/dsp/trombone.js';
import { SlideBore } from '../src/dsp/slide-bore.js';
import { TROMBONE_LENGTH, TROMBONE_BELL, SLIDE_POSITIONS, tromboneProfile, tromboneBellRadius } from '../src/dsp/trombone-geometry.js';
import { PhysicalPlayer } from '../src/music/player.js';
import { TrumpetModel } from '../src/dsp/trumpet.js';
import { estimatePitch } from '../src/ui/pitch.js';
import { noteParameters } from '../src/music/notes.js';
import { TROMBONE_MIN, TROMBONE_MAX, trombonePosition } from '../src/music/trombone-positions.js';
import { parseMidi } from '../src/music/midi.js';
import { readFileSync } from 'node:fs';

const rms = samples => Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
function render(model, seconds = 1) {
  const buffer = new Float32Array(Math.round(model.sampleRate * seconds));
  model.process(buffer);
  assert.equal(model.fault, false);
  assert.ok(buffer.every(x => Number.isFinite(x) && Math.abs(x) <= 0.65));
  return buffer;
}

test('tenor profile uses its own cup, throat, bore and bell; two slide legs set length', () => {
  assert.equal(tromboneBellRadius(0), 0.00635);
  assert.ok(Math.abs(tromboneBellRadius(1) - TROMBONE_BELL.radius) < 1e-12);
  for (const slide of [0, ...SLIDE_POSITIONS, 650]) for (const tuning of [-20, 0, 40]) {
    const profile = tromboneProfile(slide, tuning);
    assert.ok(Math.abs(profile.length - TROMBONE_LENGTH - (slide + tuning) * 0.002) < 1e-12);
    assert.ok(profile.radii.every(r => r > 0 && r <= TROMBONE_BELL.radius));
    const bore = new SlideBore(96000, 343.4, slide, tuning);
    assert.ok(Math.abs(bore.length - profile.length) < 1e-12);
    assert.ok(Math.abs(bore.tube.length + bore.fixedLength - profile.length) < 1e-12);
  }
  for (let i = 0; i < 7; i++) assert.ok(Math.abs((TROMBONE_LENGTH + SLIDE_POSITIONS[i] * 0.002) / TROMBONE_LENGTH - 2 ** (i / 12)) < 1e-12);
});

test('fractional slide interpolation is passive at a fixed length', () => {
  const bore = new SlideBore(96000, 343.4);
  const { tube } = bore;
  const impulse = new Float64Array(tube.forward.length); impulse[0] = 1;
  let energy = 0;
  for (let i = 0; i < impulse.length; i++) {
    tube.cursor = i;
    const y = tube.read(impulse, 100.3);
    energy += y * y;
  }
  assert.ok(Math.abs(energy - (0.7 ** 2 + 0.3 ** 2)) < 1e-10);
});

test('slide moves continuously with acoustic and lip state preserved; longer tube lowers the same partial', () => {
  const m = new TromboneModel(48000, { blowing: true }); m.articulate();
  const first = render(m, 2);
  const before = estimatePitch(first.slice(-4096), 48000);
  const bore = m.bore, tract = m.tract, forward = bore.tube.forward, bell = m.radiation;
  const displacement = m.displacement;
  m.setParameters({ slide: 100 });
  assert.equal(m.rebuilding, false);
  assert.equal(m.displacement, displacement);
  render(m, 0.02);
  assert.ok(bore.slide > 59 && bore.slide < 61, 'hand speed is 3 m/s');
  const after = render(m, 1.5);
  assert.equal(bore.slide, 100);
  assert.equal(m.bore, bore); assert.equal(m.tract, tract);
  assert.equal(m.radiation, bell); assert.equal(bore.tube.forward, forward);
  assert.ok(before > 170 && before < 182, `default lips sound near F3, got ${before}`);
  const frequency = estimatePitch(after.slice(-4096), 48000);
  assert.ok(frequency > 160 && frequency < before - 4);
  assert.ok(rms(after.slice(-4096)) > 0.02);
  assert.equal(m.telemetry().slide, 100);
  assert.ok(m.telemetry().bore.every(Number.isFinite));
});

test('trombone needs pressure, sustains both attacks, responds to its head, and decays after breath stops', () => {
  for (const articulation of ['tu', 'ku']) {
    const silent = new TromboneModel(48000, { blowing: true, pressure: 0, articulation }); silent.articulate();
    assert.equal(rms(render(silent)), 0);
    const m = new TromboneModel(48000, { blowing: true, articulation }); m.articulate();
    const a = render(m, 2);
    assert.ok(rms(a.slice(-4096)) > 0.02);
    m.setParameters({ tongue: 0.8 });
    const b = render(m);
    assert.notDeepEqual(a.slice(-128), b.slice(-128));
    m.setParameters({ blowing: false });
    const tail = render(m, 2);
    assert.ok(rms(tail.slice(-4096)) < 1e-5);
  }
});

test('all seven positions and sample-rate/control extremes stay finite without hiding a fault', () => {
  for (const slide of SLIDE_POSITIONS) {
    const m = new TromboneModel(48000, { blowing: true, slide });
    render(m, 0.5);
  }
  for (const rate of [16000, 44100, 48000, 96000]) {
    const m = new TromboneModel(rate, { blowing: true, slide: 650, tuning: 40, pressure: 15, opening: 0.8, lipFrequency: 40 });
    render(m, 0.35);
    m.setParameters({ slide: 0, lipFrequency: 900, opening: 0, temperature: 35, tuning: -20 });
    render(m, 0.5);
  }
});

test('invalid slide parameters are rejected atomically; instrument changes cancel a score safely', () => {
  const m = new TromboneModel();
  for (const slide of [-1, 651, NaN, Infinity, '100']) {
    assert.throws(() => m.setParameters({ pressure: 9, slide }));
    assert.equal(m.params.pressure, 5.5);
  }
  const player = new PhysicalPlayer();
  const notes = [{ midi: 70, time: 0, duration: 1, velocity: 0.8 }];
  player.start(notes); const original = player.model;
  assert.throws(() => player.setInstrument('tuba'));
  assert.equal(player.model, original); assert.equal(player.active, true);
  player.process(new Float32Array(1));
  assert.equal(player.expression, Math.sqrt(0.8));
  player.setInstrument('trombone');
  assert.equal(player.expression, 1);
  assert.equal(player.active, false); assert.equal(player.events.length, 0);
  assert.ok(player.model instanceof TromboneModel);
  assert.equal(player.telemetry().instrument, 'trombone');
  assert.throws(() => player.start([{ midi: 76, time: 0, duration: 1, velocity: 0.8 }]), /trombone/);
  player.start(notes);
  const low = new Float32Array(48000); player.process(low);
  assert.ok(rms(low.slice(-4096)) > 0.02, 'trombone plays its own calibrated B♭4');
  player.setInstrument('trumpet');
  assert.equal(player.model.constructor, TrumpetModel);
  player.start(notes);
  const buffer = new Float32Array(48000); player.process(buffer);
  assert.ok(rms(buffer.slice(-4096)) > 0.02);
});

test('open first-position partials follow the B♭ harmonic series, not C', () => {
  // Same F3 lips: tighten for B♭3, loosen for B♭2, all at slide 0.
  const play = midi => {
    const m = new TromboneModel(48000, { ...noteParameters(midi, false, 'trombone'), slide: 0 }); m.articulate();
    return estimatePitch(render(m, 2).slice(-4096), 48000);
  };
  for (const midi of [46, 53, 58, 62, 65]) {
    const cents = 1200 * Math.log2(play(midi) / (440 * 2 ** ((midi - 69) / 12)));
    assert.ok(Math.abs(cents) < 60, `${midi}: ${cents} cents from nominal at slide 0`);
  }
});

for (const [articulation, tolerance] of [['tu', 25], ['ku', 50]]) {
  test(`all 31 trombone embouchures sustain their chromatic pitch with ${articulation} near a nominal position`, () => {
    for (let midi = TROMBONE_MIN; midi <= TROMBONE_MAX; midi++) {
      const parameters = noteParameters(midi, false, 'trombone');
      assert.ok(Math.abs(parameters.slide - trombonePosition(midi).slide) <= 90, `${midi}: slide ${parameters.slide} far from its position`);
      const player = new PhysicalPlayer(48000); player.setInstrument('trombone');
      player.model.setParameters({ articulation });
      player.start([{ midi, time: 0, duration: 3.1, velocity: 1 }]);
      const output = new Float32Array(144000); player.process(output);
      const hz = estimatePitch(output.subarray(-4096), 48000);
      const cents = 1200 * Math.log2(hz / (440 * 2 ** ((midi - 69) / 12)));
      assert.equal(player.model.fault, false);
      assert.ok(hz && Math.abs(cents) < tolerance, `${midi}: ${hz} Hz, ${cents} cents`);
      assert.ok(rms(output.subarray(-4096)) > 0.01, `${midi}: too quiet`);
    }
  });
}

for (const articulation of ['tu', 'ku']) for (const [name, tolerance] of [['ode-to-joy', 25], ['william-tell', 25], ['chromatic', 50]]) {
  test(`trombone plays the ${name} demo an octave down with a moving slide (${articulation})`, () => {
    const notes = parseMidi(readFileSync(`public/scores/${name}.mid`), { instrument: 'trombone', transpose: -12 }).tracks[0].notes;
    const player = new PhysicalPlayer(48000); player.setInstrument('trombone');
    player.model.setParameters({ articulation }); player.start(notes);
    const output = new Float32Array(Math.ceil((player.duration + 1) * 48000));
    player.process(output);
    assert.equal(player.model.fault, false); assert.equal(player.active, false);
    for (const [i, note] of notes.entries()) {
      const end = Math.round((note.time + note.duration - 0.02) * 48000);
      const hz = estimatePitch(output.subarray(end - 4096, end), 48000);
      const cents = 1200 * Math.log2(hz / (440 * 2 ** ((note.midi - 69) / 12)));
      assert.ok(hz && Math.abs(cents) < tolerance, `note ${i} (${note.midi}): ${cents} cents`);
    }
  });
}

test('trumpet-register MIDI is rejected on trombone unless transposed explicitly', () => {
  const buffer = readFileSync('public/scores/william-tell.mid');
  assert.ok(parseMidi(buffer, { instrument: 'trombone' }).tracks[0].error);
  assert.equal(parseMidi(buffer, { instrument: 'trombone', transpose: -12 }).tracks[0].error, '');
});
