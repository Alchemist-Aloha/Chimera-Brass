import { PhysicalPlayer } from '../music/player.js';

class BrassProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.player = new PhysicalPlayer(sampleRate);
    this.blocks = 0;
    this.port.onmessage = ({ data }) => {
      try {
        if (data?.type === 'score') {
          this.player.start(data.notes, data.id);
          this.port.postMessage(this.player.telemetry());
        }
        else if (data?.type === 'articulate') this.player.model.articulate();
        else {
          const live = Object.keys(data).every(key => key === 'tuning' || key === 'articulation');
          if (this.player.active && !live) this.player.stop();
          const wasBlowing = this.player.model.params.blowing;
          this.player.model.setParameters(data);
          if (data.blowing && !wasBlowing) this.player.model.articulate();
        }
      } catch (error) {
        this.port.postMessage({ error: error.message });
      }
    };
  }
  process(inputs, outputs) {
    const channel = outputs[0]?.[0];
    if (!channel) return true;
    this.player.process(channel);
    if (++this.blocks % 16 === 0) this.port.postMessage(this.player.telemetry());
    return true;
  }
}
registerProcessor('brass-processor', BrassProcessor);
