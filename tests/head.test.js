import test from 'node:test';
import assert from 'node:assert/strict';
import head from '../src/ui/chimera-head.json' with { type: 'json' };
import areas from '../src/dsp/chimera-tract.json' with { type: 'json' };
import { tractRadii } from '../src/dsp/tract.js';
import { Articulator } from '../src/dsp/articulator.js';
import { TrumpetModel } from '../src/dsp/trumpet.js';
import { measureAttack } from '../scripts/measure-attacks.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test('all Chimera cross-sections share the drawing geometry, units and area interpolation', () => {
  assert.equal(head.revision, '6259e880f5d0108b862e98cefd930aa8c5bc0dc5');
  assert.equal(areas.length, 21);
  for (let k = 0; k < 21; k++) {
    const radii = tractRadii(44, k / 20);
    for (let i = 0; i < 44; i++) {
      const g = head.postures[k].grid[i];
      assert.ok(g.every(Number.isFinite) && g[4] > 0);
      if (i) {
        const previous = head.postures[k].grid[i - 1];
        assert.ok(Math.hypot(...g.slice(0, 4).map((x, j) => x - previous[j])) > 1e-5, 'cross-sections must advance from the glottis, not stack at the first pharyngeal section');
      } else {
        assert.ok(Math.abs((g[0] + g[2]) / 2 - head.frame.glottis.x) < 1e-6);
        assert.ok(Math.abs((g[1] + g[3]) / 2 - head.frame.glottis.y) < 1e-6);
      }
      close(areas[k][i], g[4]);
      close(Math.PI * radii[i] ** 2 * 1e4, g[4]);
    }
    if (k === 20) continue;
    const half = tractRadii(44, (k + 0.5) / 20);
    for (let i = 0; i < 44; i++) close(Math.PI * half[i] ** 2 * 1e4, (areas[k][i] + areas[k + 1][i]) / 2);
  }
  const out = new Float64Array(97);
  assert.equal(tractRadii(97, 0.45, out), out);
  assert.ok(out.every(r => Number.isFinite(r) && r > 0));
});

test('Chimera muscle motion follows the critically damped equation without a target jump', () => {
  for (const hz of [11, 12]) {
    const a = new Articulator(0, hz, 0.001);
    let last = 0;
    for (let i = 1; i <= 500; i++) {
      const x = a.step(1), t = i * 0.001, w = 2 * Math.PI * hz;
      close(x, 1 - (1 + w * t) * Math.exp(-w * t));
      assert.ok(x >= last && x <= 1); last = x;
    }
    assert.ok(a.x > 0.999999);
  }
});

test('moving the tongue and lip targets preserves the coupled acoustic state', () => {
  const m = new TrumpetModel(48000, { blowing: true });
  m.process(new Float32Array(24000));
  const tract = m.tract, bore = m.bore, x = m.tongueMotion.x, f = m.frequency;
  const waves = [...tract.forward];
  m.setParameters({ tongue: 0.9, lipFrequency: 500, opening: 0.3 });
  assert.equal(m.tongueMotion.x, x); assert.equal(m.frequency, f);
  assert.deepEqual([...tract.forward], waves);
  m.process(new Float32Array(480));
  assert.equal(m.tract, tract); assert.equal(m.bore, bore);
  assert.ok(m.tongueMotion.x > x && m.tongueMotion.x < 0.9);
  assert.ok(m.frequency > f && m.frequency < 500);
  m.process(new Float32Array(24000));
  assert.ok(Math.abs(m.telemetry().tongue - 0.9) < 1e-8);
  assert.equal(m.fault, false);
});

test('attack measurement rejects silence and wrong pitch and includes the analysis window', () => {
  const a = new Float32Array(24000), rate = 48000;
  assert.equal(measureAttack(a, 69), null);
  for (let i = 0; i < a.length; i++) a[i] = 0.1 * Math.sin(2 * Math.PI * 440 * i / rate);
  assert.equal(measureAttack(a, 69), 0.125);
  assert.equal(measureAttack(a, 70), null);
});
