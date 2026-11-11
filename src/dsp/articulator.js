// Adapted from Chimera ArticulatorBank (MIT, © 2026 Jameson Hodge).
// Same x'' = ω²(target − x) − 2ωx'; exact integration avoids control-rate instability.
export class Articulator {
  constructor(value, hz, dt) {
    this.x = value; this.v = 0;
    this.w = 2 * Math.PI * hz;
    this.dt = dt; this.decay = Math.exp(-this.w * dt);
  }
  step(target) {
    const error = this.x - target, b = this.v + this.w * error;
    this.x = target + (error + b * this.dt) * this.decay;
    this.v = (this.v - this.w * b * this.dt) * this.decay;
    return this.x;
  }
}
