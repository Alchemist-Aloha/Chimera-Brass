import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMidi } from '../src/music/midi.js';
import { validateScore } from '../src/music/score.js';
import { fingering, noteName, FINGERINGS } from '../src/music/fingering.js';
import { PhysicalPlayer } from '../src/music/player.js';

const note = (midi = 64, time = 0, duration = 0.5) => ({ midi, time, duration, velocity: 0.8 });

test('B-flat fingering covers every semitone in the practical written F-sharp3–C6 range', () => {
  assert.equal(FINGERINGS.length, 31);
  assert.deepEqual(fingering(52), [true, true, true]);
  assert.deepEqual(fingering(58), [false, false, false]);
  assert.deepEqual(fingering(82), [false, false, false]);
  assert.equal(noteName(58), 'B♭3'); assert.equal(noteName(60), 'C4');
  for (const midi of [51, 83, NaN, 64.5]) assert.throws(() => fingering(midi));
});

test('MIDI parsing handles tempo changes and running-status note-offs', () => {
  const track = [0,255,81,3,7,161,32, 0,144,64,100, 131,96,64,0, 0,255,81,3,15,66,64, 0,144,65,100, 131,96,65,0, 0,255,47,0];
  const bytes = Uint8Array.from([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,0,0,0,track.length,...track]);
  const { tracks } = parseMidi(bytes);
  assert.equal(tracks.length, 1); assert.equal(tracks[0].error, '');
  assert.equal(tracks[0].notes[0].time, 0); assert.equal(tracks[0].notes[0].duration, 0.5);
  assert.equal(tracks[0].notes[1].time, 0.5); assert.equal(tracks[0].notes[1].duration, 1);
  assert.deepEqual(tracks[0].notes.map(n => n.midi), [64, 65]);
});

test('lower Ode follows the public-domain soprano theme, including dotted cadences', () => {
  const ode = parseMidi(readFileSync('public/scores/ode-to-joy.mid')).tracks[0];
  assert.equal(ode.error, ''); assert.equal(ode.notes.length, 30);
  assert.deepEqual(ode.notes.map(n => n.midi), [71,71,72,74,74,72,71,69,67,67,69,71,71,69,69,71,71,72,74,74,72,71,69,67,67,69,71,69,67,67]);
  assert.equal(ode.notes[1].time, 0.75); // 80 BPM, five semitones below the old demo.
  assert.deepEqual([12,13,14,27,28,29].map(i => ode.notes[i].duration), [1.125,.375,1.5,1.125,.375,1.5]);
  assert.equal(ode.notes.at(-1).time + ode.notes.at(-1).duration, 24);
});

test('William Tell retains the pickup, gallop rhythm and tied high note in a D-major excerpt', () => {
  const score = parseMidi(readFileSync('public/scores/william-tell.mid')).tracks[0];
  assert.equal(score.error, ''); assert.equal(score.notes.length, 39);
  assert.deepEqual(score.notes.map(n => n.midi), [69,69,69,69,69,69,69,74,76,78,69,69,69,69,69,74,78,76,73,69,69,69,69,69,69,69,69,74,76,78,74,78,81,79,78,76,74,78,74]);
  const beat = score.notes[2].time; // Two eighth-note pickups make one beat.
  assert.ok(Math.abs(beat - 60 / 71) < 1e-5);
  for (const [i, beats] of [[0,.5],[1,.5],[2,1],[3,.5],[4,.5],[5,1],[6,1],[32,2.5]]) {
    assert.ok(Math.abs(score.notes[i].duration / beat - beats) < 1e-10);
  }
  assert.ok(Math.abs((score.notes.at(-1).time + score.notes.at(-1).duration) / beat - 32) < 1e-10);
});

test('chromatic MIDI remains monophonic and covers all 31 physical notes', () => {
  const chromatic = parseMidi(readFileSync('public/scores/chromatic.mid')).tracks[0];
  assert.equal(chromatic.error, '');
  assert.deepEqual(chromatic.notes.map(n => n.midi), Array.from({ length: 31 }, (_, i) => 52 + i));
});

test('score/file trust boundaries reject invalid timing, range, chords and size', () => {
  for (const notes of [[], [note(51)], [note(83)], [note(64.5)], [note(64, -1)],
    [note(64, Infinity)], [note(64, 0, 0)], [note(64, 0, 601)],
    [{ ...note(), velocity: NaN }], [{ ...note(), velocity: 0 }],
    [note(), note(65, 0.2)], [note(), note(65, 0.4995)], new Array(4097).fill(note())]) assert.throws(() => validateScore(notes));
  assert.throws(() => parseMidi(new Uint8Array([1, 2, 3])));
  assert.throws(() => parseMidi(new Uint8Array(1024 * 1024 + 1)));
  const source = [note()]; const clean = validateScore(source); clean[0].midi = 80;
  assert.equal(source[0].midi, 64);
});

test('score events run on exact audio sample frames and keep the same model between notes', () => {
  const p = new PhysicalPlayer(48000);
  p.start([note(64, 0.002, 0.004), note(65, 0.009, 0.001)], 7);
  const model = p.model;
  p.process(new Float32Array(96)); assert.equal(p.model.params.blowing, false);
  p.process(new Float32Array(1)); assert.equal(p.model.params.blowing, true); assert.equal(p.midi, 64);
  p.process(new Float32Array(192)); assert.equal(p.model.params.blowing, false);
  p.process(new Float32Array(144)); assert.equal(p.midi, 65);
  assert.equal(p.model, model);
  p.process(new Float32Array(100)); assert.equal(p.active, false); assert.equal(p.model.params.blowing, false);
  assert.equal(p.telemetry().performance.id, 7);
  assert.equal(p.model.fault, false);
  assert.throws(() => p.start([note(100)])); assert.equal(p.model, model);
});

test('sub-sample MIDI notes cannot leave a stuck airflow, and stop cancels future events', () => {
  const p = new PhysicalPlayer(48000);
  p.start([note(64, 0, 1e-8)]);
  p.process(new Float32Array(10));
  assert.equal(p.model.params.blowing, false); assert.equal(p.active, false);
  p.start([note(64), note(65, 2)]); p.stop();
  p.process(new Float32Array(128));
  assert.equal(p.model.params.blowing, false); assert.equal(p.events.length, 0);
});
