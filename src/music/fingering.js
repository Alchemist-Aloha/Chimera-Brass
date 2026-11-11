export const MIN_NOTE = 52; // Concert E3 = written F♯3 on a B♭ trumpet.
export const MAX_NOTE = 82; // Concert B♭5 = written C6.
export const FINGERINGS = [7, 5, 6, 3, 1, 2, 0, 7, 5, 6, 3, 1, 2, 0, 6, 3, 1, 2, 0, 3, 1, 2, 0, 1, 2, 0, 6, 3, 1, 2, 0];
export const noteFrequency = midi => 440 * 2 ** ((midi - 69) / 12);
export function noteName(midi) {
  return ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][midi % 12] + (Math.floor(midi / 12) - 1);
}
export function fingering(midi) {
  if (!Number.isInteger(midi) || midi < MIN_NOTE || midi > MAX_NOTE) throw new RangeError('Trumpet range is concert E3–B♭5 (MIDI 52–82).');
  const mask = FINGERINGS[midi - MIN_NOTE];
  return [!!(mask & 1), !!(mask & 2), !!(mask & 4)];
}
