import { TrumpetModel } from '../dsp/trumpet.js';
import { noteParameters } from './notes.js';
import { validateScore } from './score.js';

export class PhysicalPlayer {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.model = new TrumpetModel(sampleRate);
    this.active = false; this.frame = 0; this.duration = 0;
    this.index = -1; this.midi = null; this.expression = 1;
    this.events = []; this.next = 0;
  }
  start(notes, id = 0) {
    const clean = validateScore(notes);
    const events = clean.flatMap((note, index) => {
      const on = Math.round(note.time * this.sampleRate);
      const off = Math.max(on + 1, Math.round((note.time + note.duration) * this.sampleRate));
      const events = [{ frame: on, on: true, note, index }, { frame: off, on: false, index }];
      // Brief lip-tension gestures cross registers; they never prescribe the output frequency.
      const settle = on + Math.round(0.08 * this.sampleRate);
      if (settle < off) events.push({ frame: settle, on: false, settle: true, note, index });
      return events;
    }).sort((a, b) => a.frame - b.frame || Number(a.on) - Number(b.on));
    // A new performance starts at rest, with the first fingering pre-positioned.
    const { tuning, articulation } = this.model.params;
    this.model = new TrumpetModel(this.sampleRate, { ...noteParameters(clean[0].midi, true), tuning, articulation, blowing: false });
    this.id = Number.isSafeInteger(id) ? id : 0;
    this.events = events; this.next = 0; this.frame = 0;
    this.duration = clean.at(-1).time + clean.at(-1).duration;
    this.index = -1; this.midi = null; this.active = true;
  }
  stop() {
    this.active = false; this.events = []; this.midi = null;
    this.model.setParameters({ blowing: false });
  }
  process(buffer) {
    for (let i = 0; i < buffer.length; i++) {
      if (this.active) {
        while (this.next < this.events.length && this.events[this.next].frame <= this.frame) {
          const event = this.events[this.next++];
          if (event.on) {
            const { tuning, articulation } = this.model.params;
            this.model.setParameters({ ...noteParameters(event.note.midi, true), tuning, articulation });
            this.model.articulate();
            this.index = event.index; this.midi = event.note.midi;
            // MIDI velocity is monitor expression; it must not detune the calibrated lips.
            this.expression = Math.sqrt(event.note.velocity);
          } else if (event.index === this.index) {
            if (event.settle) {
              const { tuning, articulation } = this.model.params;
              this.model.setParameters({ ...noteParameters(event.note.midi), tuning, articulation });
            }
            else { this.model.setParameters({ blowing: false }); this.midi = null; }
          }
        }
        if (this.next === this.events.length) this.active = false;
        this.frame++;
      }
      buffer[i] = this.model.step() * this.expression;
    }
  }
  telemetry() {
    return { ...this.model.telemetry(), performance: {
      id: this.id, active: this.active, index: this.index, midi: this.midi,
      time: Math.min(this.duration, this.frame / this.sampleRate), duration: this.duration,
      parameters: this.model.params,
    } };
  }
}
