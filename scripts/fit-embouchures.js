// Offline embouchure fitter. Finds physical lip controls (and, for trombone, a continuous slide
// correction) that make the coupled model settle on each chromatic note. It never touches the
// output signal: every candidate is judged from the model's own rendered sound.
//
//   node scripts/fit-embouchures.js trombone            # fit all trombone notes
//   node scripts/fit-embouchures.js trumpet 67 77 79    # refit selected trumpet notes
//   node scripts/fit-embouchures.js trombone --check    # report the stored fit only
import { readFileSync, writeFileSync } from 'node:fs';
import { TrumpetModel } from '../src/dsp/trumpet.js';
import { TromboneModel } from '../src/dsp/trombone.js';
import { SLIDE_MAX } from '../src/dsp/trombone-geometry.js';
import { MIN_NOTE, MAX_NOTE, fingering, noteFrequency, noteName } from '../src/music/fingering.js';
import { TROMBONE_MIN, TROMBONE_MAX, trombonePosition } from '../src/music/trombone-positions.js';
import { estimatePitch } from '../src/ui/pitch.js';

const RATE = 48000;
const args = process.argv.slice(2);
const instrument = args[0] ?? 'trombone';
const check = args.includes('--check');
const trombone = instrument === 'trombone';
const file = new URL(trombone ? '../src/music/trombone-embouchures.json' : '../src/music/embouchures.json', import.meta.url);
const [low, high] = trombone ? [TROMBONE_MIN, TROMBONE_MAX] : [MIN_NOTE, MAX_NOTE];
// --out=path writes only this run's notes as { midi: controls }, so subsets can run in parallel.
const out = args.find(a => a.startsWith('--out='))?.slice(6);
const results = {};
const requested = args.slice(1).filter(a => /^\d+$/.test(a)).map(Number);
const notes = requested.length ? requested : Array.from({ length: high - low + 1 }, (_, i) => low + i);
let table = [];
try { table = JSON.parse(readFileSync(file, 'utf8')); } catch { /* new table */ }

const cents = (hz, midi) => 1200 * Math.log2(hz / noteFrequency(midi));
const Model = trombone ? TromboneModel : TrumpetModel;
const geometry = midi => trombone ? {} : { valves: fingering(midi) };

// Render one attack and describe how it settles.
function render(midi, controls, { seconds = 1.6, articulation = 'tu' } = {}) {
  const model = new Model(RATE, { ...controls, ...geometry(midi), articulation, blowing: true });
  model.articulate();
  const out = new Float32Array(Math.round(RATE * seconds));
  model.process(out);
  if (model.fault) return { fault: true };
  const at = end => estimatePitch(out.subarray(end - 4096, end), RATE);
  const n = out.length;
  const hz = at(n), previous = at(n - 4096), earlier = at(n - 8192);
  const tail = out.subarray(n - 4096);
  const rms = Math.sqrt(tail.reduce((s, x) => s + x * x, 0) / tail.length);
  let onset = null, run = 0;
  for (let end = 4096; end <= n; end += 960) {
    const f = at(end);
    if (f && Math.abs(cents(f, midi)) < 50) { if (++run === 3) { onset = end / RATE; break; } } else run = 0;
  }
  const stable = hz && previous && earlier && Math.abs(1200 * Math.log2(hz / previous)) < 12 && Math.abs(1200 * Math.log2(hz / earlier)) < 20;
  return { hz, cents: hz ? cents(hz, midi) : NaN, stable, rms, onset };
}

// Trombone lips are larger and heavier than trumpet lips; light lips pull far above the bore.
const BASES = trombone ? [
  { pressure: 5.5, opening: 0.3, lipQ: 10, lipMass: 20 },
  { pressure: 6, opening: 0.35, lipQ: 12, lipMass: 30 },
  { pressure: 5.5, opening: 0.3, lipQ: 6, lipMass: 20 },
  { pressure: 4, opening: 0.3, lipQ: 10, lipMass: 20 },
  { pressure: 7, opening: 0.25, lipQ: 10, lipMass: 12 },
  { pressure: 8, opening: 0.15, lipQ: 10, lipMass: 8 },
  { pressure: 9, opening: 0.1, lipQ: 10, lipMass: 6 },
  { pressure: 7, opening: 0.2, lipQ: 12, lipMass: 16 },
] : [
  { pressure: 5.5, opening: 0.15, lipQ: 10, lipMass: 4 },
  { pressure: 4, opening: 0.1, lipQ: 7, lipMass: 4 },
  { pressure: 8, opening: 0.1, lipQ: 10, lipMass: 8 },
  { pressure: 5.5, opening: 0.15, lipQ: 10, lipMass: 2 },
];

// mm a player might move away from a nominal position; --offset=mm starts the scan further out.
const SLIDE_RANGE = 90;
const OFFSET = +(args.find(a => a.startsWith('--offset='))?.slice(9) ?? 0);
function score(r, controls, nominal) {
  if (!r.hz || !r.stable || r.rms < 0.015) return Infinity;
  const slide = trombone ? 0.15 * Math.abs(controls.slide - nominal) : 0;
  return Math.abs(r.cents) + 25 * (r.onset ?? 3) + slide;
}

function fit(midi) {
  const target = noteFrequency(midi);
  const nominal = trombone ? trombonePosition(midi).slide : 0;
  const candidates = [];
  if (table[midi - low] && !args.includes('--fresh')) candidates.push({ ...table[midi - low] });
  for (const base of BASES) {
    // 1. Scan lip tension for the correct partial slot.
    const hits = [];
    for (let ratio = 0.5; ratio <= 1.02; ratio *= 1.035) {
      const controls = { ...base, lipFrequency: target * ratio, ...(trombone ? { slide: nominal + OFFSET } : {}) };
      const r = render(midi, controls, { seconds: 1.2 });
      if (r.hz && Math.abs(r.cents) < 120 && r.stable) hits.push({ controls, r });
    }
    if (!hits.length) continue;
    // 2. Refine lip tension inside the slot, preferring the middle of it.
    hits.sort((a, b) => Math.abs(a.r.cents) - Math.abs(b.r.cents));
    let best = hits[Math.floor(hits.length / 2) < 2 ? 0 : 0];
    let span = 0.03;
    for (let i = 0; i < 6; i++) {
      for (const sign of [-1, 1]) {
        const controls = { ...best.controls, lipFrequency: best.controls.lipFrequency * (1 + sign * span) };
        const r = render(midi, controls, { seconds: 1.2 });
        if (r.hz && r.stable && Math.abs(r.cents) < Math.abs(best.r.cents)) best = { controls, r };
      }
      span /= 2;
    }
    // 3. Trombone: move the hand slide, as a player does, to centre the note.
    if (trombone) {
      for (let i = 0; i < 4 && Math.abs(best.r.cents) > 3; i++) {
        const length = 2.976 + best.controls.slide * 0.002;
        const wanted = best.controls.slide + length * (2 ** (best.r.cents / 1200) - 1) / 0.002;
        const slide = Math.max(0, Math.min(SLIDE_MAX, nominal + SLIDE_RANGE, Math.max(nominal - SLIDE_RANGE, wanted)));
        if (Math.abs(slide - best.controls.slide) < 0.25) break;
        let step = slide - best.controls.slide, moved = false;
        for (let tries = 0; tries < 3 && !moved; tries++, step /= 2) {
          const controls = { ...best.controls, slide: Math.round((best.controls.slide + step) * 2) / 2 };
          const r = render(midi, controls, { seconds: 1.2 });
          if (r.hz && r.stable && Math.abs(r.cents) < Math.abs(best.r.cents)) { best = { controls, r }; moved = true; }
        }
        if (!moved) break;
        // Re-centre the lips on the moved slide.
        for (const sign of [-1, 1]) {
          const controls = { ...best.controls, lipFrequency: best.controls.lipFrequency * (1 + sign * 0.01) };
          const r = render(midi, controls, { seconds: 1.2 });
          if (r.hz && r.stable && Math.abs(r.cents) < Math.abs(best.r.cents)) best = { controls, r };
        }
      }
    }
    candidates.push(best.controls);
  }
  // 4. Validate every candidate with longer renders and both attacks.
  let winner = null;
  for (const controls of candidates) {
    const tu = render(midi, controls, { seconds: 3 }), ku = render(midi, controls, { seconds: 3, articulation: 'ku' });
    if (!Number.isFinite(score(tu, controls, nominal)) || !ku.hz || Math.abs(ku.cents) > 40) continue;
    const s = score(tu, controls, nominal) + 0.3 * Math.abs(ku.cents);
    if (!winner || s < winner.s) winner = { s, controls, tu, ku };
  }
  return winner;
}

const round = (x, d) => +x.toFixed(d);
for (const midi of notes) {
  const label = `${noteName(midi)} (${midi})`;
  if (check) {
    const c = table[midi - low];
    const tu = render(midi, c, { seconds: 3 }), ku = render(midi, c, { seconds: 3, articulation: 'ku' });
    console.log(label, 'tu', tu.cents?.toFixed(1), 'onset', tu.onset, 'ku', ku.cents?.toFixed(1), JSON.stringify(c));
    continue;
  }
  const result = fit(midi);
  if (!result) { console.log(label, 'NO FIT'); continue; }
  const { lipFrequency, pressure, opening, lipQ, lipMass, slide, attackLipFrequency } = result.controls;
  table[midi - low] = {
    lipFrequency: round(lipFrequency, 3), ...(attackLipFrequency ? { attackLipFrequency } : {}),
    pressure, opening, lipQ, lipMass, ...(trombone ? { slide: round(slide, 1) } : {}),
  };
  console.log(label, 'tu', result.tu.cents.toFixed(1), 'onset', result.tu.onset, 'ku', result.ku.cents.toFixed(1), JSON.stringify(table[midi - low]));
  results[midi] = table[midi - low];
  if (out) writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
  else writeFileSync(file, JSON.stringify(table, null, 2) + '\n');
}
