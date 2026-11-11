import test from 'node:test';
import assert from 'node:assert/strict';
import { PistonBore } from '../src/dsp/bore.js';
import { TrumpetModel, VALVE_LENGTHS } from '../src/dsp/trumpet.js';

const flags = mask => [!!(mask & 1), !!(mask & 2), !!(mask & 4)];
const guides = bore => [...bore.segments, ...bore.slides];
const energy = bore => guides(bore).reduce((sum, guide) => sum + guide.forward.reduce((s, value, i) => s + guide.radii[i] ** 2 * (value ** 2 + guide.backward[i] ** 2), 0), 0);

test('all eight piston routes insert exactly their own slide lengths and delays', () => {
  for (let mask = 0; mask < 8; mask++) {
    const bore = new PistonBore(96000, 343.4, flags(mask));
    const extra = VALVE_LENGTHS.reduce((sum, length, i) => sum + (mask & (1 << i) ? length : 0), 0);
    assert.ok(Math.abs(bore.length - 1.48 - extra) < 1e-12);
    let arrival = 0;
    while (!bore.bellPressure && arrival < 1000) {
      bore.step(arrival === 0 ? 1 : 0, 0); arrival++;
    }
    const sections = bore.front.n + bore.tube.delay + bore.segments.reduce((sum, guide) => sum + guide.n, 0) + bore.slides.reduce((sum, slide, i) => sum + (mask & (1 << i) ? slide.n : 0), 0);
    assert.ok(Math.abs(arrival - sections) <= 7, `${mask}: ${arrival} vs ${sections}`);
    assert.ok(arrival < 1000);
  }
});

test('piston constrictions are passive throughout the stroke', () => {
  for (const position of [0, 0.25, 0.5, 0.75, 1]) {
    const bore = new PistonBore(96000, 343.4, flags(0));
    bore.positions.fill(position); bore.targets.fill(position);
    guides(bore).forEach((guide, n) => {
      for (let i = 0; i < guide.n; i++) { guide.forward[i] = Math.sin(i * 3 + n); guide.backward[i] = Math.cos(i * 5 + n); }
    });
    const before = energy(bore);
    bore.step(0, 0);
    assert.ok(energy(bore) <= before + 1e-12, `position ${position} creates energy`);
  }
});

test('valve travel takes 18 ms without clearing the head, bell, lips or wave arrays', () => {
  const model = new TrumpetModel(48000, { blowing: true });
  model.process(new Float32Array(48000));
  const bore = model.bore, tract = model.tract, radiation = model.radiation;
  const arrays = guides(bore).map(guide => guide.forward);
  const displacement = model.displacement;
  model.setParameters({ valves: flags(7) });
  assert.equal(model.rebuilding, false);
  assert.equal(model.displacement, displacement);
  assert.deepEqual(bore.positions, [0, 0, 0]);
  model.process(new Float32Array(432));
  assert.ok(bore.positions.every(p => Math.abs(p - 0.5) < 1e-12));
  model.process(new Float32Array(433));
  assert.deepEqual(bore.positions, [1, 1, 1]);
  assert.equal(model.bore, bore); assert.equal(model.tract, tract); assert.equal(model.radiation, radiation);
  guides(bore).forEach((guide, i) => assert.ok(arrays.includes(guide.forward) || arrays.includes(guide.nextForward), `guide ${i} was replaced`));
  assert.equal(model.fade, 1); assert.equal(model.fault, false);
});
