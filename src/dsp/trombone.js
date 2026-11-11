import { TrumpetModel, DEFAULTS } from './trumpet.js';
import { SlideBore } from './slide-bore.js';
import { TROMBONE_BELL } from './trombone-geometry.js';

// Default lips: the fitted F3 embouchure (heavier, larger lips than the trumpet's).
export const TROMBONE_DEFAULTS = Object.freeze({ ...DEFAULTS, lipFrequency: 137, pressure: 5.5, opening: 0.3, lipQ: 6, lipMass: 20 });

// Both instruments share the bidirectional head / Bernoulli lip solver, not an audio filter.
export class TromboneModel extends TrumpetModel {
  constructor(sampleRate = 48000, parameters = {}) { super(sampleRate, { ...TROMBONE_DEFAULTS, ...parameters }); }
  get bell() { return TROMBONE_BELL; }
  get lipWidth() { return 0.018; }
  createBore() {
    const bore = new SlideBore(this.rate, this.speed, this.params.slide, this.params.tuning);
    bore.setNonlinear(this.params.nonlinear);
    return bore;
  }
}
