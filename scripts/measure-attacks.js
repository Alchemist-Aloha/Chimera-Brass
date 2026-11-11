import { PhysicalPlayer } from '../src/music/player.js';
import { MIN_NOTE, MAX_NOTE, noteFrequency } from '../src/music/fingering.js';
import { estimatePitch } from '../src/ui/pitch.js';

// Window-end times include the 85 ms pitch-estimation window; not lip-motion latency.
export function measureAttack(output, midi, rate = 48000) {
  let consecutive = 0;
  for (let end = 4096; end <= output.length; end += Math.round(rate * 0.02)) {
    const tail = output.subarray(end - 4096, end);
    const rms = Math.sqrt(tail.reduce((sum, x) => sum + x * x, 0) / tail.length);
    const hz = rms >= 0.01 ? estimatePitch(tail, rate) : 0;
    if (hz && Math.abs(1200 * Math.log2(hz / noteFrequency(midi))) < 50) consecutive++;
    else consecutive = 0;
    if (consecutive === 3) return +(end / rate).toFixed(3);
  }
  return null;
}

if (process.argv[1]?.endsWith('/measure-attacks.js')) {
  const results = [];
  for (let midi = MIN_NOTE; midi <= MAX_NOTE; midi++) {
    const player = new PhysicalPlayer();
    player.start([{ midi, time: 0, duration: 3.1, velocity: 1 }]);
    const output = new Float32Array(144000); player.process(output);
    results.push({ midi, seconds: measureAttack(output, midi), fault: player.model.fault });
  }
  console.log(JSON.stringify(results, null, 2));
}
