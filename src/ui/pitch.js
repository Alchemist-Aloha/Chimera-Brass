// YIN-style difference threshold: choose the first periodicity, not a louder harmonic.
export function estimatePitch(samples, rate) {
  let energy = 0;
  for (const x of samples) energy += x * x;
  if (energy / samples.length < 1e-7) return 0;
  const min = Math.max(2, Math.floor(rate / 1200));
  const max = Math.min(Math.floor(rate / 70), Math.floor(samples.length / 2) - 1);
  const size = samples.length - max;
  const difference = new Float64Array(max + 1);
  let sum = 0;
  for (let lag = 1; lag <= max; lag++) {
    let value = 0;
    for (let i = 0; i < size; i++) value += (samples[i] - samples[i + lag]) ** 2;
    sum += value;
    difference[lag] = sum ? value * lag / sum : 1;
  }
  for (let lag = min; lag < max; lag++) {
    if (difference[lag] >= 0.12) continue;
    while (lag + 1 <= max && difference[lag + 1] < difference[lag]) lag++;
    const a = difference[lag - 1], b = difference[lag], c = difference[lag + 1] ?? b;
    const denominator = a - 2 * b + c;
    const shift = denominator ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * denominator))) : 0;
    return rate / (lag + shift);
  }
  return 0;
}
