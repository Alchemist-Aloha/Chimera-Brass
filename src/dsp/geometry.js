export const BASE_LENGTH = 1.48;
// Published YTR-8335LA bore/aperture diameters; length and flare are generic estimates.
export const BELL = Object.freeze({ length: 0.32, entryRadius: 0.005825, radius: 0.0635, flare: 1.5 });
export const VALVE_LENGTHS = [2, 1, 3].map(s => BASE_LENGTH * (2 ** (s / 12) - 1));

export function bellRadius(fraction) {
  const taper = 1 - (BELL.entryRadius / BELL.radius) ** (1 / BELL.flare);
  return BELL.entryRadius / (1 - fraction * taper) ** BELL.flare;
}

export function boreProfile(valves = [false, false, false], rate = 96000, speed = 343.4, tuning = 0) {
  const extra = tuning * 0.002 + VALVE_LENGTHS.reduce((s, length, i) => s + (valves[i] ? length : 0), 0);
  const length = BASE_LENGTH + extra;
  const n = Math.round(length * rate / speed);
  const radii = Float64Array.from({ length: n }, (_, i) => {
    const x = (i + 0.5) * length / n;
    if (x < 0.02) return 0.00185 + (0.00825 - 0.00185) * (1 - x / 0.02) ** 0.6;
    if (x < 0.026) return 0.00185;
    if (x < 0.09) return 0.00185 + (0.0045 - 0.00185) * ((x - 0.026) / 0.064) ** 0.7;
    if (x < 0.32) return 0.0045 + (BELL.entryRadius - 0.0045) * (x - 0.09) / 0.23;
    if (x < length - BELL.length) return BELL.entryRadius;
    return bellRadius((x - (length - BELL.length)) / BELL.length);
  });
  return { length, radii };
}
