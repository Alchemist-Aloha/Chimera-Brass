// Small-bore B♭ tenor: 12.7 mm slide bore and 204.4 mm bell (Yamaha YSL-354 specification).
// The unseen interior (cup, taper, flare and total length) is generic, chosen so the bore's
// computed input-impedance peaks follow the same B♭ partial series as the trumpet model,
// one octave lower. It is not a measured Yamaha profile.
export const TROMBONE_LENGTH = 2.976;
export const TROMBONE_BELL = Object.freeze({ length: 0.65, entryRadius: 0.00635, radius: 0.1022, flare: 1.8 });
export const MOUTHPIECE = Object.freeze({ cup: 0.03, rim: 0.01225, throatLength: 0.01, throat: 0.00295, taper: 0.4 });
export const SLIDE_MAX = 650; // Hand travel, mm; both legs add acoustic length.
export const SLIDE_POSITIONS = Object.freeze(Array.from({ length: 7 }, (_, i) => TROMBONE_LENGTH * (2 ** (i / 12) - 1) * 500));
// Cup, throat, backbore and leadpipe are one permanent waveguide ahead of the moving slide.
export const FRONT_LENGTH = 0.45;
export function tromboneBellRadius(t) {
  const b = TROMBONE_BELL;
  return b.entryRadius / (1 - t * (1 - (b.entryRadius / b.radius) ** (1 / b.flare))) ** b.flare;
}
export function tromboneRadius(x, length) {
  const m = MOUTHPIECE, throatEnd = m.cup + m.throatLength;
  if (x < m.cup) return m.throat + (m.rim - m.throat) * (1 - x / m.cup) ** 0.7;
  if (x < throatEnd) return m.throat;
  // Backbore and leadpipe: a single conical-ish expansion into the slide bore.
  if (x < throatEnd + m.taper) return m.throat + (TROMBONE_BELL.entryRadius - m.throat) * ((x - throatEnd) / m.taper) ** 0.7;
  if (x < length - TROMBONE_BELL.length) return TROMBONE_BELL.entryRadius;
  return tromboneBellRadius((x - length + TROMBONE_BELL.length) / TROMBONE_BELL.length);
}
export function tromboneProfile(slide = 0, tuning = 0, rate = 96000, speed = 343.4) {
  const length = TROMBONE_LENGTH + (slide + tuning) * 0.002;
  const n = Math.round(length * rate / speed);
  return { length, radii: Float64Array.from({ length: n }, (_, i) => tromboneRadius((i + 0.5) * length / n, length)) };
}
