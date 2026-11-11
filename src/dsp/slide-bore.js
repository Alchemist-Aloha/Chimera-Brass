import { Waveguide } from './waveguide.js';
import { CylinderDelay } from './cylinder.js';
import { FRONT_LENGTH, SLIDE_MAX, TROMBONE_LENGTH, TROMBONE_BELL, tromboneRadius } from './trombone-geometry.js';

const TUNING_TRAVEL = [-20, 40];
const HAND_SPEED = 3;      // m/s maximum hand-slide travel (fast legato arm motion)
const TUNING_SPEED = 0.25; // m/s maximum tuning-slide travel

// Permanent cup/leadpipe and bell, joined by a bidirectional fractional-delay slide.
export class SlideBore {
  constructor(rate, speed, slide = 0, tuning = 0) {
    this.rate = rate; this.speed = speed;
    this.slide = this.target = slide;
    this.tuning = this.tuningTarget = tuning;
    const frontCount = Math.round(FRONT_LENGTH * rate / speed);
    const bellCount = Math.round(TROMBONE_BELL.length * rate / speed);
    this.front = new Waveguide(Float64Array.from({ length: frontCount }, (_, i) => tromboneRadius((i + 0.5) * FRONT_LENGTH / frontCount, TROMBONE_LENGTH)), rate, speed, 0.06);
    this.bell = new Waveguide(Float64Array.from({ length: bellCount }, (_, i) => tromboneRadius(TROMBONE_LENGTH - TROMBONE_BELL.length + (i + 0.5) * TROMBONE_BELL.length / bellCount, TROMBONE_LENGTH)), rate, speed, 0.06);
    this.fixedLength = (frontCount + bellCount) * speed / rate;
    const tube = length => length - this.fixedLength;
    this.tube = new CylinderDelay(rate, speed, TROMBONE_BELL.entryRadius, tube(this.length), {
      minLength: tube(TROMBONE_LENGTH + TUNING_TRAVEL[0] * 0.002),
      maxLength: tube(TROMBONE_LENGTH + (SLIDE_MAX + TUNING_TRAVEL[1]) * 0.002),
    });
    // Inner/outer slide, gooseneck and bell tail: most of the path is narrow enough to steepen.
    this.tube.setNonlinearLength(this.length - FRONT_LENGTH * 0.6 - TROMBONE_BELL.length * 0.5);
    this.travelStep = HAND_SPEED * 1000 / rate;
    this.tuningStep = TUNING_SPEED * 1000 / rate;
  }
  setSlide(mm) { this.target = mm; }
  setTuning(mm) { this.tuningTarget = mm; }
  setNonlinear(enabled) { this.tube.nonlinear = enabled; }
  get length() { return TROMBONE_LENGTH + (this.slide + this.tuning) * 0.002; }
  get delay() { return this.tube.length * this.rate / this.speed; }
  get advance() { return this.tube.advance; }
  get inputImpedance() { return this.front.inputImpedance; }
  get backPressure() { return this.front.backward[0]; }
  get bellPressure() { return this.bell.forward[this.bell.n - 1]; }
  step(leftBoundary, rightBoundary) {
    if (this.slide !== this.target || this.tuning !== this.tuningTarget) {
      this.slide += Math.max(-this.travelStep, Math.min(this.travelStep, this.target - this.slide));
      this.tuning += Math.max(-this.tuningStep, Math.min(this.tuningStep, this.tuningTarget - this.tuning));
      this.tube.setLength(this.length - this.fixedLength);
    }
    const { tube } = this;
    tube.step(this.front.forward[this.front.n - 1], this.bell.backward[0]);
    this.front.step(leftBoundary, tube.toMouth);
    this.bell.step(tube.toBell, rightBoundary);
  }
  pressureSamples(count = 64) {
    const frontLength = this.front.n * this.speed / this.rate;
    const bellStart = this.length - this.bell.n * this.speed / this.rate;
    return Array.from({ length: count }, (_, i) => {
      const x = i * this.length / (count - 1);
      if (x < frontLength) {
        const j = Math.min(this.front.n - 1, Math.floor(x * this.rate / this.speed));
        return this.front.forward[j] + this.front.backward[j];
      }
      if (x >= bellStart) {
        const j = Math.min(this.bell.n - 1, Math.floor((x - bellStart) * this.rate / this.speed));
        return this.bell.forward[j] + this.bell.backward[j];
      }
      return this.tube.sample((x - frontLength) / (bellStart - frontLength));
    });
  }
}
