// Silva et al. (2009), Eq. 16 / Table 1, causal unflanged-pipe Padé fit.
// https://arxiv.org/abs/0811.3625 — bilinear transform of R(s), q = s·radius/c.
export class BellRadiation {
  constructor(rate, speed, radius) {
    const q = 2 * rate * radius / speed;
    const n1 = 0.167, d1 = 1.393, d2 = 0.457;
    const a0 = 1 + d1 * q + d2 * q * q;
    this.b0 = -(1 + n1 * q) / a0;
    this.b1 = -2 / a0;
    this.b2 = -(1 - n1 * q) / a0;
    this.a1 = (2 - 2 * d2 * q * q) / a0;
    this.a2 = (1 - d1 * q + d2 * q * q) / a0;
    this.z1 = 0; this.z2 = 0;
  }

  step(incident) {
    const reflected = this.b0 * incident + this.z1;
    this.z1 = this.b1 * incident - this.a1 * reflected + this.z2;
    this.z2 = this.b2 * incident - this.a2 * reflected;
    return reflected;
  }
}
