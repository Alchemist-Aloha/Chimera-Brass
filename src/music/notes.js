import embouchures from './embouchures.json' with { type: 'json' };
import tromboneEmbouchures from './trombone-embouchures.json' with { type: 'json' };
import { DEFAULTS } from '../dsp/trumpet.js';
import { TROMBONE_DEFAULTS } from '../dsp/trombone.js';
import { MIN_NOTE, MAX_NOTE, fingering } from './fingering.js';
import { TROMBONE_MIN, TROMBONE_MAX, trombonePosition } from './trombone-positions.js';

export const INSTRUMENTS = ['trumpet', 'trombone'];
export function noteRange(instrument = 'trumpet') {
  if (instrument === 'trombone') return [TROMBONE_MIN, TROMBONE_MAX];
  if (instrument === 'trumpet') return [MIN_NOTE, MAX_NOTE];
  throw new TypeError('Unknown instrument');
}

// Offline-fitted physical controls, not output frequencies or audio samples.
// Trombone fits include the continuous slide position a player uses to centre each note.
export function noteParameters(midi, attack = false, instrument = 'trumpet') {
  if (instrument === 'trombone') {
    trombonePosition(midi); // range check
    return { ...TROMBONE_DEFAULTS, ...tromboneEmbouchures[midi - TROMBONE_MIN], blowing: true };
  }
  const valves = fingering(midi);
  const { attackLipFrequency, ...parameters } = embouchures[midi - MIN_NOTE];
  if (attack && attackLipFrequency) parameters.lipFrequency = attackLipFrequency;
  return { ...DEFAULTS, ...parameters, valves, blowing: true };
}

// Notes this fingering (trumpet) or nominal slide position (trombone) can sound,
// i.e. the partials a player reaches by changing only the lips.
export function partialsFor(instrument, { valves = [false, false, false], slide = 0 } = {}) {
  const [low, high] = noteRange(instrument);
  const notes = [];
  for (let midi = low; midi <= high; midi++) {
    if (instrument === 'trumpet') {
      if (fingering(midi).every((v, i) => v === valves[i])) notes.push(midi);
    } else if (Math.abs(trombonePosition(midi).slide - slide) < 30) notes.push(midi);
  }
  return notes;
}
