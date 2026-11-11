import { Waveguide } from './waveguide.js';
import { tractRadii } from './tract.js';
import { BellRadiation } from './radiation.js';
import { PistonBore } from './bore.js';
import { BELL } from './geometry.js';
import { Articulator } from './articulator.js';
export { BASE_LENGTH, BELL, VALVE_LENGTHS, bellRadius, boreProfile } from './geometry.js';

export const DEFAULTS = Object.freeze({
  pressure: 5.5, lipFrequency: 280, opening: 0.18, lipQ: 7,
  tongue: 0.45, tractLength: 0.17, temperature: 20, lipMass: 4,
  valves: [false, false, false], blowing: false, tuning: 0, articulation: 'tu', slide: 0, nonlinear: true,
});
export const LIMITS = Object.freeze({
  slide: [0, 650], tuning: [-20, 40], pressure: [0, 15], lipFrequency: [40, 900], opening: [0, 0.8],
  lipQ: [1.5, 12], tongue: [0, 1], tractLength: [0.13, 0.21], temperature: [5, 35], lipMass: [1, 40],
});
export function validateParameters(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Parameters must be an object');
  const clean = {};
  for (const [key, value] of Object.entries(patch)) {
    if (Object.hasOwn(LIMITS, key)) {
      const [min, max] = LIMITS[key];
      if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(key + ' is out of range');
      clean[key] = value;
    } else if (key === 'articulation') {
      if (value !== 'tu' && value !== 'ku') throw new TypeError('articulation must be tu or ku');
      clean.articulation = value;
    } else if (key === 'valves') {
      if (!Array.isArray(value) || value.length !== 3 || [...value].some(v => typeof v !== 'boolean')) throw new TypeError('Expected three boolean valves');
      clean.valves = [...value];
    } else if (key === 'blowing' || key === 'nonlinear') {
      if (typeof value !== 'boolean') throw new TypeError(key + ' must be boolean');
      clean[key] = value;
    } else throw new TypeError('Unknown parameter: ' + key);
  }
  return clean;
}

// Exact positive root of Bernoulli flow coupled to both acoustic impedances.
export function lipFlow(pressure, opening, impedance, width = 0.012) {
  if (opening <= 0 || pressure === 0) return 0;
  const g = width * opening * Math.sqrt(2 / 1.204);
  const z = impedance * g;
  return Math.sign(pressure) * g * 2 * Math.abs(pressure) /
    (Math.sqrt(z * z + 4 * Math.abs(pressure)) + z);
}

class Lowpass {
  constructor(rate, cutoff, q) {
    const w = 2 * Math.PI * cutoff / rate;
    const a = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    this.b0 = (1 - c) / (2 * (1 + a));
    this.b1 = 2 * this.b0; this.b2 = this.b0;
    this.a1 = -2 * c / (1 + a); this.a2 = (1 - a) / (1 + a);
    this.z1 = 0; this.z2 = 0;
  }
  step(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

export class TrumpetModel {
  constructor(sampleRate = 48000, parameters = {}) {
    if (!Number.isFinite(sampleRate) || sampleRate < 16000 || sampleRate > 96000) throw new RangeError('Unsupported sample rate');
    this.sampleRate = sampleRate;
    this.rate = sampleRate * 2;
    this.dt = 1 / this.rate;
    this.params = { ...DEFAULTS, valves: [...DEFAULTS.valves], ...validateParameters(parameters) };
    this.pressure = 0; this.frequency = this.params.lipFrequency;
    this.restOpening = this.params.opening * 0.001;
    this.controlPeriod = Math.round(this.rate / 1000);
    this.controlCountdown = 0;
    const controlDt = this.controlPeriod / this.rate;
    this.tongueMotion = new Articulator(this.params.tongue, 12, controlDt);
    this.tensionAlpha = 1 - Math.exp(-controlDt / 0.0104);
    this.openingMotion = new Articulator(this.restOpening, 11, controlDt);
    this.displacement = 0; this.velocity = 0;
    this.flow = 0; this.mouthPressure = 0; this.cupPressure = 0;
    this.lipOpening = 0;
    this.tongueGate = 1; this.tongueHold = 0;
    this.attackKind = this.params.articulation;
    this.tongueRelease = 1 / (this.rate * 0.003);
    this.dcX = 0; this.dcY = 0; this.fault = false;
    this.fade = 1; this.rebuilding = false; this.peakAdvance = 0;
    this.filter1 = new Lowpass(this.rate, 0.4 * sampleRate, 0.5411961);
    this.filter2 = new Lowpass(this.rate, 0.4 * sampleRate, 1.306563);
    this.buildGeometry();
  }

  get bell() { return BELL; }
  get lipWidth() { return 0.012; }
  createBore() {
    const bore = new PistonBore(this.rate, this.speed, this.params.valves, this.params.tuning);
    bore.setNonlinear(this.params.nonlinear);
    return bore;
  }

  buildGeometry() {
    this.speed = 331.3 + 0.606 * this.params.temperature;
    this.bore = this.createBore();
    this.length = this.bore.length;
    const count = Math.max(8, Math.round(this.params.tractLength * this.rate / this.speed));
    this.tract = new Waveguide(tractRadii(count, this.tongueMotion.x), this.rate, this.speed, 0.6);
    // shortcut: the aperture uses an unflanged duct fit; calibrate for a measured flared bell.
    this.radiation = new BellRadiation(this.rate, this.speed, this.bell.radius);
    this.displacement = 0; this.velocity = 0;
  }

  setParameters(patch) {
    const clean = validateParameters(patch);
    // Tuning and hand slides are continuous moving tubes; only wave speed or head length restart.
    const rebuild = ['tractLength', 'temperature'].some(key =>
      key in clean && String(clean[key]) !== String(this.params[key]));
    Object.assign(this.params, clean);
    if (rebuild) this.rebuilding = true;
    if ('valves' in clean) this.bore.setValves?.(clean.valves);
    if ('slide' in clean) this.bore.setSlide?.(clean.slide);
    if ('tuning' in clean) this.bore.setTuning(clean.tuning);
    if ('nonlinear' in clean) this.bore.setNonlinear(clean.nonlinear);
  }

  articulate() {
    this.attackKind = this.params.articulation;
    const ku = this.attackKind === 'ku';
    this.tongueGate = 0;
    this.tongueHold = Math.round(this.rate * (ku ? 0.022 : 0.018));
    this.tongueRelease = 1 / (this.rate * 0.003);
  }

  step() {
    if (this.fault) return 0;
    let out = 0;
    for (let sub = 0; sub < 2; sub++) {
      const p = this.params;
      this.fade = Math.max(0, Math.min(1, this.fade + (this.rebuilding ? -1 : 1) / (this.rate * 0.012)));
      if (this.rebuilding && this.fade === 0) {
        this.buildGeometry();
        this.rebuilding = false;
      }
      const target = p.blowing ? p.pressure * 1000 : 0;
      this.pressure += (target - this.pressure) * (1 - Math.exp(-this.dt / 0.025));
      if (this.controlCountdown-- <= 0) {
        this.controlCountdown = this.controlPeriod - 1;
        // Lip tension is not Chimera's speech lip-aperture muscle; keep its faster response.
        this.frequency += (p.lipFrequency - this.frequency) * this.tensionAlpha;
        this.restOpening = this.openingMotion.step(p.opening * 0.001);
        const before = this.tongueMotion.x, tongue = this.tongueMotion.step(p.tongue);
        if (Math.abs(tongue - before) > 1e-9) {
          // shortcut: quasi-static area updates omit moving-wall flow; use FDTD for that coupling.
          this.tract.setRadii(tractRadii(this.tract.n, tongue, this.tract.radii));
        }
      }
      const { bore, tract } = this;
      const upstream = tract.forward[tract.n - 1];
      const downstream = bore.backPressure;
      const headZ = tract.outputImpedance;
      const boreZ = bore.inputImpedance;
      const available = this.pressure + 2 * upstream - 2 * downstream;
      const opening = Math.max(0, this.restOpening + this.displacement);
      if (this.tongueHold > 0) this.tongueHold--;
      else this.tongueGate = Math.min(1, this.tongueGate + this.tongueRelease);
      // shortcut: lumped tongue contact omits moving-wall flow; use measured contact/cavity mechanics for resolved transients.
      const flow = lipFlow(available, opening * this.tongueGate, headZ + boreZ, this.lipWidth);
      const delta = available - (headZ + boreZ) * flow;
      const w = 2 * Math.PI * this.frequency;
      const gamma = w / (2 * p.lipQ);
      // Implicit midpoint is stable for the mass–spring–damper at every lip tuning.
      const v = ((1 - gamma * this.dt - w * w * this.dt * this.dt / 4) * this.velocity +
        this.dt * (delta / p.lipMass - w * w * this.displacement)) /
        (1 + gamma * this.dt + w * w * this.dt * this.dt / 4);
      this.displacement += this.dt * (this.velocity + v) / 2;
      this.velocity = v;
      if (this.displacement < -this.restOpening) {
        this.displacement = -this.restOpening;
        this.velocity = Math.max(0, -0.05 * this.velocity);
      }
      const reflected = this.radiation.step(bore.bellPressure);
      const radiated = bore.bellPressure + reflected;
      bore.step(downstream + boreZ * flow, reflected);
      if (bore.advance > this.peakAdvance) this.peakAdvance = bore.advance;
      this.length = bore.length;
      // Tu's front contact is lumped at the embouchure; Ku also closes the rear tract.
      const closure = this.attackKind === 'ku' ? Math.round((tract.n - 1) * 0.58) : 0;
      tract.step(-0.85 * tract.backward[0], upstream - headZ * flow, closure, this.tongueGate);
      this.flow = flow;
      this.mouthPressure = this.pressure + 2 * upstream - headZ * flow;
      this.cupPressure = 2 * downstream + boreZ * flow;
      this.lipOpening = opening;
      out = this.filter2.step(this.filter1.step(radiated));
    }
    // DC removal; monitor gain is separate from acoustic pressure, not an SPL claim.
    const dc = out - this.dcX + 0.995 * this.dcY;
    this.dcX = out; this.dcY = dc;
    if (!Number.isFinite(dc) || !Number.isFinite(this.displacement) || Math.abs(dc) > 1e7 || Math.abs(this.displacement) > 0.02) {
      this.fault = true;
      return 0;
    }
    return Math.tanh(dc * 0.008) * 0.65 * this.fade;
  }

  process(buffer) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = this.fault ? 0 : this.step();
    }
  }

  telemetry() {
    const steepening = this.peakAdvance / this.rate * 1e6;
    this.peakAdvance = 0;
    return {
      pressure: this.mouthPressure, cupPressure: this.cupPressure,
      flow: this.flow, opening: this.lipOpening, length: this.length,
      fault: this.fault, tongue: this.tongueMotion.x,
      articulation: { kind: this.attackKind, openness: this.tongueGate, fraction: this.attackKind === 'ku' ? 0.58 : 0.9 },
      tract: Array.from(this.tract.forward, (v, i) => v + this.tract.backward[i]),
      valves: [...(this.bore.positions ?? [0, 0, 0])], slide: this.bore.slide ?? 0, tuning: this.bore.tuning,
      steepening, // µs: largest nonlinear crest advance since the previous report
      bore: this.bore.pressureSamples(),
    };
  }
}
