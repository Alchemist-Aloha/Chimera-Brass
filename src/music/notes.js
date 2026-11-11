import embouchures from './embouchures.json' with { type: 'json' };
import { DEFAULTS } from '../dsp/trumpet.js';
import { MIN_NOTE, fingering } from './fingering.js';

// Offline-fitted physical controls, not output frequencies or audio samples.
export function noteParameters(midi, attack = false) {
  const valves = fingering(midi);
  const { attackLipFrequency, ...parameters } = embouchures[midi - MIN_NOTE];
  if (attack && attackLipFrequency) parameters.lipFrequency = attackLipFrequency;
  return { ...DEFAULTS, ...parameters, valves, blowing: true };
}
