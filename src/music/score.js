import { MIN_NOTE, MAX_NOTE } from './fingering.js';

export const MAX_SCORE_NOTES = 4096;
export function validateScore(notes) {
  if (!Array.isArray(notes) || !notes.length || notes.length > MAX_SCORE_NOTES) throw new RangeError('Choose a melody with 1–4096 notes.');
  let end = 0;
  return notes.map(note => {
    if (!note || !Number.isInteger(note.midi) || note.midi < MIN_NOTE || note.midi > MAX_NOTE) throw new RangeError('Melody must fit concert E3–B♭5 (written F♯3–C6).');
    if (![note.time, note.duration, note.velocity].every(Number.isFinite) || note.time < 0 || note.duration <= 0 || note.time + note.duration > 600 || note.velocity <= 0 || note.velocity > 1) throw new RangeError('Invalid note timing/velocity, or score longer than 10 minutes.');
    if (note.time < end - 1e-9) throw new RangeError('Choose a monophonic melody track; overlapping notes need more than one trumpet.');
    const clean = { midi: note.midi, time: note.time, duration: note.duration, velocity: note.velocity };
    end = note.time + note.duration;
    return clean;
  });
}
