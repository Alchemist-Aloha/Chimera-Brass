import { Waveguide } from './waveguide.js';
import { CylinderDelay } from './cylinder.js';
import { BASE_LENGTH, BELL, VALVE_LENGTHS, boreProfile } from './geometry.js';

// Main tuning slide: a uniform U-tube after the leadpipe whose two legs move continuously.
export const TUNING_SLIDE = Object.freeze({ start: 0.32, end: 0.48, travel: [-20, 40] });
const TUNING_SPEED = 0.25; // m/s maximum hand travel on the tuning slide

// Mouthpiece/leadpipe, a moving tuning slide, then four permanent tube sections with a
// switchable valve slide between each pair.
export class PistonBore {
  constructor(rate, speed, valves, tuning = 0) {
    this.rate = rate; this.speed = speed;
    this.tuning = this.tuningTarget = tuning;
    const { radii } = boreProfile([false, false, false], rate, speed, 0);
    const cell = x => Math.round(x * rate / speed);
    const [a, b] = [cell(TUNING_SLIDE.start), cell(TUNING_SLIDE.end)];
    this.front = new Waveguide(radii.slice(0, a), rate, speed, 0.06);
    this.slideBase = (b - a) * speed / rate;
    this.tube = new CylinderDelay(rate, speed, BELL.entryRadius, this.slideBase + tuning * 0.002, {
      minLength: this.slideBase + TUNING_SLIDE.travel[0] * 0.002,
      maxLength: this.slideBase + TUNING_SLIDE.travel[1] * 0.002,
    });
    this.tuningStep = TUNING_SPEED * 1000 / rate;
    const cuts = [b, ...[0.51, 0.63, 0.75].map(cell), radii.length];
    // shortcut: representative low-register attenuation, not a fitted viscothermal model.
    this.segments = cuts.slice(1).map((end, i) => new Waveguide(radii.slice(cuts[i], end), rate, speed, 0.06));
    this.slides = VALVE_LENGTHS.map(length => new Waveguide(
      new Float64Array(Math.round(length * rate / speed)).fill(BELL.entryRadius), rate, speed, 0.06));
    this.positions = valves.map(Number);
    this.targets = [...this.positions];
    this.stroke = 1 / (0.018 * rate);
    this.left = new Float64Array(4);
    this.right = new Float64Array(4);
    this.updateNonlinearLength();
  }
  // Cylindrical path from the leadpipe end to the bell flare, including engaged valve slides.
  updateNonlinearLength() {
    const valves = VALVE_LENGTHS.reduce((sum, length, i) => sum + (this.targets[i] >= 0.5 ? length : 0), 0);
    this.tube.setNonlinearLength(BASE_LENGTH - TUNING_SLIDE.start - BELL.length * 0.5 + valves + this.tuning * 0.002);
  }
  setTuning(mm) { this.tuningTarget = mm; }
  setNonlinear(enabled) { this.tube.nonlinear = enabled; }
  get advance() { return this.tube.advance; }
  setValves(valves) { this.targets = valves.map(Number); this.updateNonlinearLength(); }
  get inputImpedance() { return this.front.inputImpedance; }
  get backPressure() { return this.front.backward[0]; }
  get bellPressure() {
    const last = this.segments[3];
    return last.forward[last.n - 1];
  }
  get length() {
    return BASE_LENGTH + this.tuning * 0.002 + VALVE_LENGTHS.reduce((sum, length, i) => sum + (this.positions[i] >= 0.5 ? length : 0), 0);
  }
  step(leftBoundary, rightBoundary) {
    if (this.tuning !== this.tuningTarget) {
      this.tuning += Math.max(-this.tuningStep, Math.min(this.tuningStep, this.tuningTarget - this.tuning));
      this.tube.setLength(this.slideBase + this.tuning * 0.002);
    }
    const { tube, front } = this;
    tube.step(front.forward[front.n - 1], this.segments[0].backward[0]);
    front.step(leftBoundary, tube.toMouth);
    this.left[0] = tube.toBell;
    this.right[3] = rightBoundary;
    for (let j = 0; j < 3; j++) {
      const i = 2 - j; // Air reaches valve 3, then 2, then 1.
      const position = this.positions[i] += Math.max(-this.stroke, Math.min(this.stroke, this.targets[i] - this.positions[i]));
      const r = Math.sin(Math.PI * position) ** 2, t = 1 - r;
      const a = this.segments[j].forward[this.segments[j].n - 1];
      const b = this.segments[j + 1].backward[0];
      const slide = this.slides[i];
      const c = slide.backward[0], d = slide.forward[slide.n - 1];
      // A moving piston closes its old ports before opening the new pair.
      // S = [[r,1-r],[1-r,r]] is passive even during port constriction.
      if (position < 0.5) {
        this.right[j] = r * a + t * b;
        this.left[j + 1] = t * a + r * b;
        slide.step(c, d); // An unused slide is sealed, not a leaking side branch.
      } else {
        this.right[j] = r * a + t * c;
        this.left[j + 1] = r * b + t * d;
        slide.step(t * a + r * c, t * b + r * d);
      }
    }
    for (let j = 0; j < 4; j++) this.segments[j].step(this.left[j], this.right[j]);
  }
  pressureSamples(count = 64) {
    const { tube } = this;
    const slide = { n: Math.max(1, Math.round(tube.delay)), at: i => tube.sample(i / Math.max(1, Math.round(tube.delay) - 1)) };
    const paths = [this.front, slide, this.segments[0]];
    for (let j = 0; j < 3; j++) {
      if (this.positions[2 - j] >= 0.5) paths.push(this.slides[2 - j]);
      paths.push(this.segments[j + 1]);
    }
    const n = paths.reduce((sum, p) => sum + p.n, 0);
    let part = 0, offset = 0;
    return Array.from({ length: count }, (_, i) => {
      const index = Math.floor(i * (n - 1) / (count - 1));
      while (index >= offset + paths[part].n) offset += paths[part++].n;
      const p = paths[part], j = index - offset;
      return p.at ? p.at(j) : p.forward[j] + p.backward[j];
    });
  }
}
