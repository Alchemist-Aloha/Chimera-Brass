import { TrumpetModel } from '../dsp/trumpet.js';
import { TromboneModel } from '../dsp/trombone.js';
import { noteParameters } from './notes.js';
import { validateScore } from './score.js';

// Player choices that persist through a performance rather than being prescribed per note.
const LIVE = ['tuning', 'articulation', 'nonlinear'];
const keep = params => Object.fromEntries(LIVE.map(key => [key, params[key]]));
// The trombone hand slide starts moving shortly before each attack, as a player's arm does.
const SLIDE_LEAD = 0.03;

export class PhysicalPlayer {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.instrument = 'trumpet';
    this.model = new TrumpetModel(sampleRate);
    this.active = false; this.frame = 0; this.duration = 0;
    this.index = -1; this.midi = null; this.expression = 1;
    this.events = []; this.next = 0;
  }
  setInstrument(instrument) {
    if (instrument !== 'trumpet' && instrument !== 'trombone') throw new TypeError('Unknown instrument');
    this.stop();
    this.expression = 1;
    this.instrument = instrument;
    this.model = instrument === 'trombone' ? new TromboneModel(this.sampleRate) : new TrumpetModel(this.sampleRate);
  }
  notes(midi, attack = false) { return noteParameters(midi, attack, this.instrument); }
  start(notes, id = 0) {
    const clean = validateScore(notes, this.instrument);
    const trombone = this.instrument === 'trombone';
    const events = clean.flatMap((note, index) => {
      const on = Math.round(note.time * this.sampleRate);
      const off = Math.max(on + 1, Math.round((note.time + note.duration) * this.sampleRate));
      const events = [{ frame: on, on: true, note, index }, { frame: off, on: false, index }];
      // Brief lip-tension gestures cross registers; they never prescribe the output frequency.
      const settle = on + Math.round(0.08 * this.sampleRate);
      if (settle < off) events.push({ frame: settle, on: false, settle: true, note, index });
      if (trombone && index > 0) {
        const previous = clean[index - 1];
        const earliest = Math.round((previous.time + Math.min(previous.duration * 0.5, 0.1)) * this.sampleRate);
        events.push({ frame: Math.max(earliest, on - Math.round(SLIDE_LEAD * this.sampleRate)), on: false, slide: this.notes(note.midi).slide, index: -1 });
      }
      return events;
    }).sort((a, b) => a.frame - b.frame || Number(a.on) - Number(b.on));
    // A new performance starts at rest, with the first fingering or slide pre-positioned.
    const Model = trombone ? TromboneModel : TrumpetModel;
    this.model = new Model(this.sampleRate, { ...this.notes(clean[0].midi, true), ...keep(this.model.params), blowing: false });
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
          if (event.slide !== undefined) this.model.setParameters({ slide: event.slide });
          else if (event.on) {
            this.model.setParameters({ ...this.notes(event.note.midi, true), ...keep(this.model.params) });
            this.model.articulate();
            this.index = event.index; this.midi = event.note.midi;
            // MIDI velocity is monitor expression; it must not detune the calibrated lips.
            this.expression = Math.sqrt(event.note.velocity);
          } else if (event.index === this.index) {
            if (event.settle) this.model.setParameters({ ...this.notes(event.note.midi), ...keep(this.model.params) });
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
    return { ...this.model.telemetry(), instrument: this.instrument, performance: {
      id: this.id, active: this.active, index: this.index, midi: this.midi,
      time: Math.min(this.duration, this.frame / this.sampleRate), duration: this.duration,
      parameters: this.model.params,
    } };
  }
}
