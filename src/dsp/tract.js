// Geometry exported from Chimera (MIT, © 2026 Jameson Hodge); see third_party/chimera/.
import areas from './chimera-tract.json' with { type: 'json' };

export function tractRadii(count, tongue = 0.45, output = new Float64Array(count)) {
  const x = Math.max(0, Math.min(1, tongue)) * (areas.length - 1);
  const k = Math.min(areas.length - 2, Math.floor(x)), blend = x - k;
  const a = areas[k], b = areas[k + 1];
  for (let i = 0; i < count; i++) {
    const s = i * (a.length - 1) / (count - 1), j = Math.min(a.length - 2, Math.floor(s)), t = s - j;
    const areaA = a[j] + t * (a[j + 1] - a[j]);
    const areaB = b[j] + t * (b[j + 1] - b[j]);
    output[i] = Math.sqrt((areaA + blend * (areaB - areaA)) / Math.PI) * 0.01;
  }
  return output;
}

export function tractDiameters(tongue = 0.45) {
  return tractRadii(44, tongue).map(radius => radius * 200); // equivalent circular diameter, cm
}
