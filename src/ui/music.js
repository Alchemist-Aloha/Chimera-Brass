import { noteName, fingering } from '../music/fingering.js';
import { parseMidi } from '../music/midi.js';
import { validateScore } from '../music/score.js';
import { noteRange } from '../music/notes.js';
import { trombonePosition } from '../music/trombone-positions.js';

// Trumpet shows written (B♭) names; the tenor trombone reads at concert pitch.
const written = (midi, instrument) => instrument === 'trombone' ? midi : midi + 2;
const label = (midi, instrument) => noteName(written(midi, instrument));
const fingeringLabel = (midi, instrument) => instrument === 'trombone'
  ? 'pos ' + trombonePosition(midi).position
  : fingering(midi).map((v, n) => v ? n + 1 : '').join('') || 'open';
export function keyboardMarkup(instrument) {
  const [low, high] = noteRange(instrument);
  return Array.from({ length: high - low + 1 }, (_, i) => {
    const midi = low + i;
    const name = instrument === 'trombone' ? `Play concert ${noteName(midi)}, slide position ${trombonePosition(midi).position}` : `Play written ${noteName(midi + 2)}, concert ${noteName(midi)}`;
    return `<button data-note="${midi}" aria-pressed="false" aria-label="${name}"><strong>${label(midi, instrument)}</strong><small>${fingeringLabel(midi, instrument)}</small></button>`;
  }).join('');
}
const HELP = {
  trumpet: 'Tap a written note to audition it. Sounding pitch is two semitones lower. Each note uses a calibrated embouchure, not a pitched oscillator. Low notes need time to speak; auditions hold for 3.5 seconds.',
  trombone: 'Tap a note to audition it. The tenor trombone sounds as written (concert pitch). Each note uses a fitted embouchure and a slide placement near its nominal position, just as a player corrects intonation with the slide.',
};
const RANGE = { trumpet: '31 notes · F♯3–C6 written', trombone: '31 notes · E2–B♭4 concert' };

const demos = {
  'ode-to-joy': { title: 'Ode to Joy · lower register', description: 'Beethoven · 8-bar theme in G major, G4–D5 concert, 80 BPM. Five semitones lower than the earlier demo; original dotted/eighth-note cadences retained.', source: 'https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode-a4.pdf', sourceLabel: 'Source sheet music · Mutopia (public domain)' },
  'william-tell': { title: 'William Tell · Rossini', description: 'Overture finale · opening gallop theme only, transposed to D major, A4–A5 concert. Slow practice tempo: 71 BPM, not the orchestral Presto.', source: 'https://abcnotation.com/tunePage?a=trillian.mit.edu/~jc/music/abc/Contra/march/William_Tell_Overture-C--/0000', sourceLabel: 'Source melody notation · William Tell' },
  chromatic: { title: 'Long-tone study · all 31 notes', description: 'A slow, two-minute study of all 31 physical notes. Long holds allow low notes to settle.' },
};

export const musicMarkup = `
<section class="page music-panel" id="music" aria-labelledby="music-title">
  <div class="music-heading"><h2 id="music-title">Play a melody</h2><span class="music-range" id="music-range">${RANGE.trumpet}</span></div>
  <div class="melody-layout"><div class="melody-stage" id="melody-stage"></div><div class="melody-main">
  <p class="music-help" id="music-intro">${HELP.trumpet}</p>
  <div class="note-keyboard" id="note-keyboard" aria-label="Playable trumpet notes">${keyboardMarkup('trumpet')}</div>
  <div class="score-tools"><label class="sr-only" for="music-piece">Demo MIDI score</label><select id="music-piece">${Object.entries(demos).map(([id, demo]) => `<option value="${id}">${demo.title}</option>`).join('')}</select><button id="score-play" class="score-play" disabled><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg>Play score</button><button id="score-stop"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10v10H3z"/></svg>Stop</button><label class="file-upload" for="midi-file">Open MIDI<input id="midi-file" type="file" accept=".mid,.midi,audio/midi" class="sr-only"/></label></div>
  <select id="midi-track" aria-label="MIDI melody track" hidden></select>
  <div class="score-timeline" id="score-timeline" aria-label="MIDI note score"></div>
  <div class="score-progress"><progress id="score-progress" value="0" max="1" aria-label="Score playback progress"></progress><span id="score-current" aria-live="polite">Ready</span></div>
  <p id="music-message" class="music-help" role="status">Standard MIDI uses concert pitch. One melody track → one physical instrument.</p>
  <p id="score-description" class="music-help"></p>
  <a id="midi-download" class="score-download" href="./scores/ode-to-joy.mid" download>Download this MIDI score</a>
  <p class="music-help"><a id="score-source" class="score-download" target="_blank" rel="noreferrer" hidden></a></p>
  </div></div>
</section>`;

export function setupMusic(play, stop) {
  const $ = id => document.getElementById(id);
  let tracks = [], notes = [], lastIndex = -2, loadId = 0, showScore = true;
  let instrument = 'trumpet', source = null, demoLoaded = false;
  function message(text, error = false) { $('music-message').textContent = text; $('music-message').classList.toggle('error', error); }
  function selectTrack(index) {
    stop();
    const track = tracks[index];
    notes = track?.notes || [];
    $('score-play').disabled = !track || !!track.error;
    $('score-timeline').replaceChildren();
    if (track?.error) { message(track.error, true); return; }
    notes = validateScore(notes, instrument);
    const shift = transpose();
    const fragment = document.createDocumentFragment();
    notes.forEach((note, i) => {
      const span = document.createElement('span');
      span.className = 'score-note'; span.dataset.index = i;
      span.style.width = Math.max(35, Math.min(100, note.duration * 70)) + 'px';
      span.textContent = label(note.midi, instrument);
      span.title = `Concert ${noteName(note.midi)} · ${note.time.toFixed(2)} s · ${note.duration.toFixed(2)} s`;
      fragment.append(span);
    });
    $('score-timeline').append(fragment);
    $('score-progress').max = notes.at(-1).time + notes.at(-1).duration;
    $('score-progress').value = 0;
    $('score-current').textContent = `${notes.length} notes`;
    message(instrument === 'trombone'
      ? (shift ? 'Concert notes above, one octave below the trumpet demo. ' : 'Concert notes above. ') + 'The slide travels between notes at up to 3 m/s. Playback uses the standard 17 cm head at 20°C.'
      : 'Written notes above; MIDI and measured pitch are concert pitch. Playback uses the standard 17 cm head at 20°C.');
    lastIndex = -2;
  }
  // Demo melodies are trumpet-register; on trombone they are announced and played an octave down.
  const transpose = () => instrument === 'trombone' && demoLoaded ? -12 : 0;
  function load(buffer, demo = false) {
    source = buffer; demoLoaded = demo;
    const midi = parseMidi(buffer, { instrument, transpose: transpose() });
    tracks = midi.tracks;
    $('midi-track').replaceChildren(...tracks.map((t, i) => { const option = document.createElement('option'); option.value = i; option.textContent = t.name; return option; }));
    $('midi-track').hidden = tracks.length < 2;
    const index = Math.max(0, tracks.findIndex(t => !t.error));
    $('midi-track').value = index;
    selectTrack(index);
  }
  async function demo() {
    const ticket = ++loadId;
    stop(); $('score-play').disabled = true;
    $('score-source').hidden = true; $('score-description').textContent = '';
    try {
      // Public assets use the app base, including subdirectory deployments.
      const response = await fetch(`${import.meta.env.BASE_URL}scores/${$('music-piece').value}.mid`);
      if (!response.ok) throw new Error('Could not load the demo MIDI.');
      const buffer = await response.arrayBuffer();
      if (ticket !== loadId) return;
      load(buffer, true);
      $('midi-download').href = `${import.meta.env.BASE_URL}scores/${$('music-piece').value}.mid`;
      $('midi-download').hidden = false;
      const demo = demos[$('music-piece').value];
      $('score-description').textContent = demo.description;
      $('score-source').hidden = !demo.source;
      if (demo.source) { $('score-source').href = demo.source; $('score-source').textContent = demo.sourceLabel; }
    } catch (error) { if (ticket === loadId) message(error.message, true); }
  }
  $('music-piece').addEventListener('change', demo);
  $('midi-track').addEventListener('change', e => selectTrack(+e.target.value));
  $('midi-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    const ticket = ++loadId; stop(); $('score-play').disabled = true;
    $('score-source').hidden = true; $('score-description').textContent = '';
    try {
      if (file.size > 1024 * 1024) throw new Error('Choose a MIDI file at most 1 MB.');
      const buffer = await file.arrayBuffer();
      if (ticket !== loadId) return;
      load(buffer); $('midi-download').hidden = true;
    } catch (error) { if (ticket === loadId) message(error.message, true); }
    event.target.value = '';
  });
  async function perform(score, timeline = true) {
    showScore = timeline; lastIndex = -2;
    $('score-progress').max = score.at(-1)?.time + score.at(-1)?.duration || 1;
    try { await play(score); } catch (error) { message(error.message, true); }
  }
  $('score-play').addEventListener('click', () => perform(notes));
  $('score-stop').addEventListener('click', stop);
  $('note-keyboard').addEventListener('click', event => {
    const button = event.target.closest('[data-note]');
    if (button) perform([{ midi: +button.dataset.note, time: 0, duration: 3.5, velocity: 0.8 }], false);
  });
  demo();
  const update = status => {
    if (!status) return;
    $('score-progress').value = status.time;
    document.querySelectorAll('[data-note]').forEach(button => {
      const active = status.active && +button.dataset.note === status.midi;
      button.classList.toggle('sounding', active); button.setAttribute('aria-pressed', String(active));
    });
    const index = status.active && status.midi !== null && showScore ? status.index : -1;
    if (index !== lastIndex || !showScore) {
      $('score-timeline').querySelector('.current')?.classList.remove('current');
      const chip = $('score-timeline').children[index];
      if (chip) {
        chip.classList.add('current');
        $('score-timeline').scrollLeft = Math.max(0, chip.offsetLeft - $('score-timeline').offsetLeft - 100);
      }
      $('score-current').textContent = status.active && status.midi !== null
        ? (instrument === 'trombone' ? `${noteName(status.midi)} · position ${trombonePosition(status.midi).position}` : `${noteName(status.midi + 2)} / ${noteName(status.midi)} concert`)
        : status.active ? 'Rest' : 'Stopped';
      lastIndex = index;
    }
  };
  update.setInstrument = next => {
    if (next === instrument) return;
    instrument = next;
    $('note-keyboard').innerHTML = keyboardMarkup(instrument);
    $('note-keyboard').setAttribute('aria-label', `Playable ${instrument} notes`);
    $('music-range').textContent = RANGE[instrument];
    $('music-intro').textContent = HELP[instrument];
    if (source) {
      const track = +($('midi-track').value || 0);
      tracks = parseMidi(source, { instrument, transpose: transpose() }).tracks;
      selectTrack(Math.min(track, tracks.length - 1));
    }
  };
  return update;
}
