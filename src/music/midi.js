import { Midi } from '@tonejs/midi/dist/Midi.js';
import { validateScore } from './score.js';

// transpose is explicit and announced by the caller; out-of-range notes are never silently moved.
export function parseMidi(buffer, { instrument = 'trumpet', transpose = 0 } = {}) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 14 || bytes.length > 1024 * 1024 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'MThd') throw new Error('Choose a Standard MIDI file, at most 1 MB.');
  if (bytes[8] !== 0 || bytes[9] > 1 || bytes[12] & 128) throw new Error('Only MIDI format 0/1 with musical tick timing is supported.');
  if ((bytes[10] * 256 + bytes[11]) > 128) throw new Error('MIDI file has too many tracks (maximum 128).');
  let midi;
  try { midi = new Midi(bytes); } catch { throw new Error('This MIDI file is damaged or unsupported.'); }
  if (midi.tracks.reduce((count, track) => count + track.notes.length, 0) > 10000) throw new Error('MIDI file has too many notes (maximum 10000 across tracks).');
  const tracks = midi.tracks.filter(t => t.channel !== 9 && t.notes.length).map((track, i) => {
    const notes = track.notes.map(({ midi, time, duration, velocity }) => ({ midi: midi + transpose, time, duration, velocity }));
    let error = '';
    try { validateScore(notes, instrument); } catch (e) { error = e.message; }
    return { name: track.name || `Melody track ${i + 1}`, notes, error };
  });
  if (!tracks.length) throw new Error('This MIDI file has no non-percussion melody tracks.');
  return { name: midi.name || 'Imported MIDI', tracks };
}
