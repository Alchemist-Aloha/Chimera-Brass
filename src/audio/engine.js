import workletURL from './worklet.js?worker&url';

export class AudioEngine {
  constructor(onTelemetry, onError) {
    this.onTelemetry = onTelemetry;
    this.onError = onError;
    this.volume = 0.55;
  }
  async start(parameters) {
    if (!this.context) {
      if (!window.AudioContext || !window.AudioWorkletNode) throw new Error('AudioWorklet is unavailable. Use a current browser on localhost or HTTPS.');
      // Keep the physical presets on the propagation grid used for calibration.
      this.context = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
      try {
        await this.context.audioWorklet.addModule(workletURL);
        this.node = new AudioWorkletNode(this.context, 'brass-processor', { outputChannelCount: [1] });
        this.gain = this.context.createGain();
        this.gain.gain.value = this.volume;
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 4096;
        this.node.connect(this.gain).connect(this.analyser).connect(this.context.destination);
        this.node.port.onmessage = ({ data }) => {
          if (data.error) this.onError(data.error);
          else if (data.fault) this.onError('The solver stopped for safety. Reload to reset the simulation.');
          else this.onTelemetry(data);
        };
        this.node.onprocessorerror = () => this.onError('The audio processor stopped. Reload to reset it.');
      } catch (error) {
        await this.context.close();
        this.context = null;
        throw error;
      }
    }
    await this.context.resume();
    this.update(parameters);
  }
  update(parameters) { this.node?.port.postMessage(parameters); }
  articulate() { this.node?.port.postMessage({ type: 'articulate' }); }
  playScore(notes, id) { this.node?.port.postMessage({ type: 'score', notes, id }); }
  setVolume(value) {
    this.volume = value;
    if (this.context && this.gain) this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
  }
  silence() {
    this.update({ blowing: false });
    if (this.context && this.gain) this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.01);
  }
  async close() {
    this.node?.disconnect();
    await this.context?.close();
  }
}
