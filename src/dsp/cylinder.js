// A uniform cylindrical tube of variable, fractional length with plane waves in both directions.
// Used for moving slides (trombone hand slide, main tuning slides) without restarting the
// acoustic state, and as the place where cumulative nonlinear steepening is lumped.

const BETA = 1.2;            // Coefficient of nonlinearity of air, (γ + 1) / 2.
const RHO_C2 = 1.4 * 101325; // γ·P0: bulk modulus of air, Pa.

export class CylinderDelay {
  /**
   * @param {number} rate propagation rate, samples/s
   * @param {number} speed sound speed, m/s
   * @param {number} radius tube radius, m (sets wall loss)
   * @param {number} length initial acoustic length, m
   * @param {{minLength?: number, maxLength?: number, wallLoss?: number}} travel shortest/longest length, m
   */
  constructor(rate, speed, radius, length, { minLength = length, maxLength = length, wallLoss = 0.06 } = {}) {
    this.rate = rate; this.speed = speed; this.radius = radius; this.wallLoss = wallLoss;
    // Room for steepening: up to 0.5 ms advance, never more than the shortest tube allows.
    this.maxAdvance = Math.max(0, Math.min(rate * 0.0005, Math.floor(minLength * rate / speed) - 3));
    const capacity = Math.ceil(maxLength * rate / speed) + this.maxAdvance + 8;
    this.forward = new Float64Array(capacity); this.backward = new Float64Array(capacity);
    this.cursor = 0;
    // Nonlinear steepening: samples of time advance per pascal of forward acoustic pressure.
    this.nonlinearLength = 0; this.nonlinearGain = 0; this.nonlinear = true;
    this.advance = 0; this.lastRead = -Infinity; this.mean = 0;
    this.meanAlpha = 1 - Math.exp(-1 / (0.05 * rate));
    this.lpForward = 0; this.lpBackward = 0;
    this.outForward = 0; this.outBackward = 0;
    this.setLength(length);
  }

  // Length of cylindrical tube over which the forward wave accumulates its distortion.
  setNonlinearLength(metres) {
    this.nonlinearLength = Math.max(0, metres);
    this.nonlinearGain = this.nonlinearLength * this.rate / this.speed * BETA / RHO_C2;
  }

  setLength(metres) {
    this.length = metres;
    const cells = metres * this.rate / this.speed;
    // Distributed viscothermal smoothing, lumped: the same variance as Waveguide's per-cell
    // 0.997/0.003 FIR, realised as a one-pole whose own mean delay is removed from the line.
    const variance = Math.max(1e-6, 0.003 * 0.997 * cells);
    const g = (1 + 2 * variance - Math.sqrt(1 + 4 * variance)) / (2 * variance);
    this.smoothing = g;
    this.delay = Math.max(1 + this.maxAdvance, cells + 0.003 * cells - g / (1 - g));
    this.attenuation = Math.exp(-this.wallLoss * 0.00583 / this.radius * metres);
  }

  read(buffer, delay) {
    const position = (this.cursor - delay + buffer.length) % buffer.length;
    const i = Math.floor(position), fraction = position - i;
    return buffer[i] * (1 - fraction) + buffer[(i + 1) % buffer.length] * fraction;
  }

  // Inputs: wave entering from the mouth side and from the bell side.
  step(fromMouth, fromBell) {
    // shortcut: steepening of the whole bore is lumped here and driven by the outgoing wave;
    // a distributed Burgers solver would resolve where shocks form.
    let delay = this.delay;
    if (this.nonlinear && this.nonlinearGain) {
      const wanted = Math.max(-this.maxAdvance, Math.min(this.maxAdvance, this.nonlinearGain * (this.outForward - this.mean)));
      delay -= wanted;
      // The read point never runs backwards: a would-be fold becomes a shock front.
      const position = this.cursor - delay;
      if (position < this.lastRead) delay = this.cursor - this.lastRead;
      this.advance = this.delay - delay;
    } else this.advance = 0;
    this.lastRead = this.cursor - delay;
    const g = this.smoothing;
    const toBell = this.read(this.forward, delay);
    const toMouth = this.read(this.backward, this.delay);
    this.outForward = toBell;
    this.mean += (toBell - this.mean) * this.meanAlpha;
    this.lpForward = (1 - g) * toBell + g * this.lpForward;
    this.lpBackward = (1 - g) * toMouth + g * this.lpBackward;
    this.forward[this.cursor] = fromMouth;
    this.backward[this.cursor] = fromBell;
    this.cursor++;
    if (this.cursor >= this.forward.length) { this.cursor -= this.forward.length; this.lastRead -= this.forward.length; }
    this.toBell = this.lpForward * this.attenuation;
    this.toMouth = this.lpBackward * this.attenuation;
  }

  // Standing pressure at fraction t ∈ [0, 1] from the mouth end.
  sample(t) {
    const d = Math.max(1, Math.min(this.delay - 1, t * this.delay));
    return this.read(this.forward, Math.max(1, d)) + this.read(this.backward, Math.max(1, this.delay - d));
  }

  get cells() { return this.delay; }
}
