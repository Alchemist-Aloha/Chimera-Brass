// Optional asset-generation step: node scripts/import-chimera.js /path/to/pinned/chimera
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(process.argv[2] || '');
const revision = '6259e880f5d0108b862e98cefd930aa8c5bc0dc5';
assert.equal(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), revision);
const temp = mkdtempSync(join(tmpdir(), 'brass-chimera-'));
try {
  writeFileSync(join(temp, 'Cargo.toml'), `[package]\nname="brass-chimera-export"\nversion="0.0.0"\nedition="2024"\n[[bin]]\nname="export"\npath="main.rs"\n[dependencies]\nchimera={path=${JSON.stringify(join(root, 'crates/chimera'))}}\nserde_json="1"\n`);
  writeFileSync(join(temp, 'main.rs'), readFileSync('scripts/chimera-export.rs'));
  const frames = JSON.parse(execFileSync('cargo', ['run', '--release', '--manifest-path', join(temp, 'Cargo.toml')], { encoding: 'utf8', maxBuffer: 16e6 }));
  const { buildProfile } = await import(pathToFileURL(join(root, 'src/ui/render/profile.ts')));
  const P = (x, y) => ({ x: x > 0.5 ? 0.5 + (x - 0.5) * 0.86 : x, y });
  const model = { tract: { scale: 1, P }, bodyParams: { pharynx: 1 } };
  const profile = buildProfile(model, frames[9].frame, frames[9].artic);
  delete profile.f; delete profile.model;
  // Fixed point counts make interpolation independent of contour vertex changes upstream.
  function resample(points, count = 64) {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths.at(-1) + Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y));
    let j = 0;
    return Array.from({ length: count }, (_, i) => {
      const s = lengths.at(-1) * i / (count - 1);
      while (j < points.length - 2 && lengths[j + 1] < s) j++;
      const t = (s - lengths[j]) / (lengths[j + 1] - lengths[j] || 1);
      return [points[j].x + t * (points[j+1].x - points[j].x), points[j].y + t * (points[j+1].y - points[j].y)];
    });
  }
  const postures = frames.map(({ frame: f }) => {
    assert.ok(f.grid.every(g => Number.isFinite(g.area) && g.area > 0));
    const sample = fraction => {
      const s = fraction * f.length, first = f.grid[0];
      if (s <= first.s) {
        // shortcut: uniform lower larynx uses the first pharyngeal area; export epilarynx_area for tissue-level refinement.
        const t = 1 - s / first.s, x = t * (f.glottis.x - first.mid.x), y = t * (f.glottis.y - first.mid.y);
        return [first.inner.x + x, first.inner.y + y, first.outer.x + x, first.outer.y + y, first.area];
      }
      let j = f.grid.findIndex(g => g.s >= s); if (j < 1) j = f.grid.length - 1;
      const a = f.grid[j-1], b = f.grid[j], t = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s)));
      return [a.inner.x + t*(b.inner.x-a.inner.x), a.inner.y + t*(b.inner.y-a.inner.y), a.outer.x + t*(b.outer.x-a.outer.x), a.outer.y + t*(b.outer.y-a.outer.y), a.area + t*(b.area-a.area)];
    };
    return { tongue: resample(f.tongue), inner: resample(f.inner), outer: resample(f.outer), grid: Array.from({length:44}, (_, i) => sample(i / 43)) };
  });
  const result = JSON.parse(JSON.stringify({ revision, profile, frame: frames[9].frame, postures }, (_, v) => typeof v === 'number' ? +v.toFixed(6) : v));
  writeFileSync('src/ui/chimera-head.json', JSON.stringify(result) + '\n');
  writeFileSync('src/dsp/chimera-tract.json', JSON.stringify(result.postures.map(p => p.grid.map(g => g[4]))) + '\n');
  console.log(`Exported ${postures.length} Chimera postures + midsagittal profile`);
} finally { rmSync(temp, { recursive: true, force: true }); }
