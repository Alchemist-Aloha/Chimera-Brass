// Kelly–Lochbaum topology adapted from Pink Trombone (MIT).
// The original uses flow waves; here scattering is expressed as pressure waves.
export class Waveguide {
  constructor(radii, rate, speed, wallLoss = 0.18) {
    this.n = radii.length;
    this.radii = radii;
    this.rate = rate;
    this.speed = speed;
    this.dx = speed / rate;
    this.forward = new Float64Array(this.n);
    this.backward = new Float64Array(this.n);
    this.nextForward = new Float64Array(this.n);
    this.nextBackward = new Float64Array(this.n);
    this.reflection = new Float64Array(this.n);
    this.loss = new Float64Array(this.n);
    this.wallLoss = wallLoss;
    this.setRadii(radii);
  }

  setRadii(radii) {
    this.radii = radii;
    for (let i = 0; i < this.n; i++) {
      this.loss[i] = Math.exp(-this.wallLoss * this.dx * 0.00583 / radii[i]);
    }
    for (let i = 1; i < this.n; i++) {
      const a = radii[i - 1] ** 2;
      const b = radii[i] ** 2;
      this.reflection[i] = (a - b) / (a + b);
    }
  }

  step(leftBoundary, rightBoundary, closureIndex = 0, openness = 1) {
    const { n, forward: r, backward: l, nextForward: nr,
      nextBackward: nl, reflection: k, loss } = this;
    nr[0] = leftBoundary;
    nl[n - 1] = rightBoundary;
    for (let i = 1; i < n; i++) {
      const w = k[i] * (r[i - 1] - l[i]);
      nr[i] = r[i - 1] + w;
      nl[i - 1] = l[i] + w;
    }
    if (closureIndex > 0 && openness < 1) {
      // Convex mix of the area junction and sealed ends: passive at every opening.
      nr[closureIndex] = openness * nr[closureIndex] + (1 - openness) * l[closureIndex];
      nl[closureIndex - 1] = openness * nl[closureIndex - 1] + (1 - openness) * r[closureIndex - 1];
    }
    for (let i = 0; i < n; i++) {
      // shortcut: a passive one-pole approximates frequency-dependent wall loss;
      // replace with measured viscothermal filters for calibrated impedance.
      nr[i] = loss[i] * (0.997 * nr[i] + 0.003 * r[i]);
      nl[i] = loss[i] * (0.997 * nl[i] + 0.003 * l[i]);
    }
    this.forward = nr; this.backward = nl;
    this.nextForward = r; this.nextBackward = l;
  }

  get inputImpedance() { return 1.204 * this.speed / (Math.PI * this.radii[0] ** 2); }
  get outputImpedance() { return 1.204 * this.speed / (Math.PI * this.radii[this.n - 1] ** 2); }

  clear() {
    this.forward.fill(0); this.backward.fill(0);
    this.nextForward.fill(0); this.nextBackward.fill(0);
  }
}
