import ToneMidi from '@tonejs/midi/build/Midi.js';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const { Midi } = ToneMidi;
mkdirSync('public/scores', { recursive: true });

// Mutopia's public-domain SATB MIDI: the soprano is the highest voice on the upper staff.
const source = new Midi(readFileSync('third_party/scores/ode-mutopia.mid'));
const ode = [];
let end = 0;
for (const note of [...source.tracks.find(t => t.name === 'upper').notes].sort((a, b) => a.ticks - b.ticks || b.midi - a.midi)) {
  if (note.ticks < end || note.ticks >= 32 * source.header.ppq) continue;
  ode.push([note.midi, note.durationTicks / source.header.ppq]);
  end = note.ticks + note.durationTicks;
}
assert.equal(ode.length, 30);
assert.equal(end, 32 * source.header.ppq);

// First gallop theme, checked against the linked ABC reference; chords/other sections omitted.
// Its two eighth-note pickups and tied high note are part of the melody, not extra attacks.
const william = [
  [67,.5],[67,.5],
  [67,1],[67,.5],[67,.5],[67,1],[67,1],
  [72,1],[74,1],[76,1],[67,.5],[67,.5],
  [67,1],[67,.5],[67,.5],[72,1],[76,1],
  [74,1],[71,1],[67,1],[67,.5],[67,.5],
  [67,1],[67,.5],[67,.5],[67,1],[67,1],
  [72,1],[74,1],[76,1],[72,.5],[76,.5],
  [79,2.5],[77,.5],[76,.5],[74,.5],
  [72,1],[76,1],[72,1],
].map(([pitch, beats]) => [pitch + 2, beats]);
assert.equal(william.reduce((sum, [, beats]) => sum + beats, 0), 32);

for (const [name, title, sequence, bpm, key] of [
  ['ode-to-joy', 'Ode to Joy — Beethoven (8-bar theme, G major)', ode, 80, 'G'],
  ['william-tell', 'William Tell — Rossini (gallop theme, D major)', william, 71, 'D'],
  ['chromatic', 'Chromatic trumpet study', Array.from({ length: 31 }, (_, i) => [52 + i, 1]), 15, 'C'],
]) {
  const midi = new Midi();
  midi.name = title;
  midi.header.setTempo(bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
  midi.header.keySignatures.push({ ticks: 0, key, scale: 'major' });
  const track = midi.addTrack(); track.name = 'Trumpet melody'; track.instrument.number = 56;
  let ticks = 0;
  for (const [pitch, beats] of sequence) {
    // Tongue contact articulates the melodies; only the long-tone study has breathing gaps.
    track.addNote({ midi: pitch, ticks, durationTicks: 480 * beats - (name === 'chromatic' ? 60 : 0), velocity: .8 });
    ticks += 480 * beats;
  }
  writeFileSync(`public/scores/${name}.mid`, midi.toArray());
}
console.log('Wrote three monophonic Standard MIDI scores. Source notes: public/licenses/score-sources.txt');
