import { Waveguide } from './waveguide.js';
import { BASE_LENGTH, BELL, VALVE_LENGTHS, boreProfile } from './geometry.js';

// Four permanent tube sections, with a switchable slide between each pair.
export class PistonBore {
  constructor(rate, speed, valves, tuning = 0) {
    this.tuningLength = tuning * 0.002; // Both legs of the main U-slide move by the pull distance in mm.
    const { radii } = boreProfile([false, false, false], rate, speed, tuning);
    const cuts = [0, ...[0.51, 0.63, 0.75].map(x => Math.round((x + this.tuningLength) * rate / speed)), radii.length];
    // shortcut: representative low-register attenuation, not a fitted viscothermal model.
    this.segments = cuts.slice(1).map((end, i) => new Waveguide(radii.slice(cuts[i], end), rate, speed, 0.06));
    this.slides = VALVE_LENGTHS.map(length => new Waveguide(
      new Float64Array(Math.round(length * rate / speed)).fill(BELL.entryRadius), rate, speed, 0.06));
    this.positions = valves.map(Number);
    this.targets = [...this.positions];
    this.stroke = 1 / (0.018 * rate);
    this.left = new Float64Array(4);
    this.right = new Float64Array(4);
  }
  setValves(valves) { this.targets = valves.map(Number); }
  get inputImpedance() { return this.segments[0].inputImpedance; }
  get backPressure() { return this.segments[0].backward[0]; }
  get bellPressure() {
    const last = this.segments[3];
    return last.forward[last.n - 1];
  }
  get length() {
    return BASE_LENGTH + this.tuningLength + VALVE_LENGTHS.reduce((sum, length, i) => sum + (this.positions[i] >= 0.5 ? length : 0), 0);
  }
  step(leftBoundary, rightBoundary) {
    this.left[0] = leftBoundary;
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
    const paths = [this.segments[0]];
    for (let j = 0; j < 3; j++) {
      if (this.positions[2 - j] >= 0.5) paths.push(this.slides[2 - j]);
      paths.push(this.segments[j + 1]);
    }
    const n = paths.reduce((sum, p) => sum + p.n, 0);
    let part = 0, offset = 0;
    return Array.from({ length: count }, (_, i) => {
      const index = Math.floor(i * (n - 1) / (count - 1));
      while (index >= offset + paths[part].n) offset += paths[part++].n;
      const p = paths[part];
      return p.forward[index - offset] + p.backward[index - offset];
    });
  }
}
