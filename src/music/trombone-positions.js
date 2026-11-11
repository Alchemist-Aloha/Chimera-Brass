import { SLIDE_POSITIONS } from '../dsp/trombone-geometry.js';

// Straight B♭ tenor, no F attachment: concert E2–B♭4, exactly one octave below the trumpet's
// sounding E3–B♭5. The tenor trombone reads and sounds in concert pitch (no transposition).
export const TROMBONE_MIN = 40;
export const TROMBONE_MAX = 70;

// [partial, nominal position] per note, following a conventional tenor slide chart.
// Partial n of the open horn is the nth member of the B♭1 harmonic series.
const CHART = [
  [2, 7], [2, 6], [2, 5], [2, 4], [2, 3], [2, 2], [2, 1], // E2 … B♭2
  [3, 7], [3, 6], [3, 5], [3, 4], [3, 3], [3, 2], [3, 1], // B2 … F3
  [4, 5], [4, 4], [4, 3], [4, 2], [4, 1],                 // F♯3 … B♭3
  [5, 4], [5, 3], [5, 2], [5, 1],                         // B3 … D4
  [6, 3], [6, 2], [6, 1],                                 // E♭4 … F4
  [7, 3], [7, 2], [8, 3], [8, 2], [8, 1],                 // F♯4 … B♭4
];

export function trombonePosition(midi) {
  if (!Number.isInteger(midi) || midi < TROMBONE_MIN || midi > TROMBONE_MAX) throw new RangeError('Trombone range is concert E2–B♭4 (MIDI 40–70).');
  const [partial, position] = CHART[midi - TROMBONE_MIN];
  return { partial, position, slide: SLIDE_POSITIONS[position - 1] };
}
