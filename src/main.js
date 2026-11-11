import './style.css';
import { DEFAULTS, BASE_LENGTH, VALVE_LENGTHS, boreProfile } from './dsp/trumpet.js';
import { drawHead } from './ui/head.js';
import { AudioEngine } from './audio/engine.js';
import { illustration, trumpetAirPath, mainBorePath } from './ui/illustration.js';
import { estimatePitch } from './ui/pitch.js';
import { musicMarkup, setupMusic } from './ui/music.js';
import { validateScore } from './music/score.js';

const units = { pressure: 'kPa', lipFrequency: 'Hz', opening: 'mm', tongue: '%', tuning: 'mm', tractLength: 'cm', lipQ: 'Q', lipMass: 'kg/m²', temperature: '°C' };
const slider = (key, name, min, max, step, description) => {
  const scale = key === 'tongue' || key === 'tractLength' ? 100 : 1;
  return `<div class="control">
    <div class="control-heading"><label for="${key}">${name}</label><button type="button" class="parameter-reset" data-reset="${key}" aria-label="Restore ${name} default" title="Restore ${name} default"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg></button></div>
    <div class="control-inputs"><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${DEFAULTS[key]}" aria-describedby="${key}-help" />
    <label class="value-field" for="${key}-number"><input id="${key}-number" type="number" min="${min * scale}" max="${max * scale}" step="${+(step * scale).toFixed(4)}" data-scale="${scale}" aria-label="${name} in ${units[key]}" aria-describedby="${key}-help ${key}-error" /><span aria-hidden="true">${units[key]}</span></label></div>
    <p id="${key}-help">${description}</p><p id="${key}-error" class="control-error" role="alert" hidden></p></div>`;
};

const state = { ...DEFAULTS, valves: [...DEFAULTS.valves] };
let starting = false;
let intent = 0;
let telemetry = null;
let signalView = 'waveform';
let boreView = 'geometry';
let frame = 0;
let measuredPitch = 0;
let performanceActive = false, performanceIndex = -2;
let updateMusic = () => {};
const presets = {
  balanced: { pressure: 5.5, lipFrequency: 280, opening: 0.18, lipQ: 7, tongue: 0.45 },
  gentle: { pressure: 3.5, lipFrequency: 280, opening: 0.12, lipQ: 8, tongue: 0.4 },
  bright: { pressure: 8, lipFrequency: 400, opening: 0.18, lipQ: 8, tongue: 0.65 },
  upper: { pressure: 9, lipFrequency: 500, opening: 0.10, lipQ: 9, tongue: 0.7 },
};

const app = document.querySelector('#app');
app.innerHTML = `
<header class="topbar">
  <a class="brand" href="./" aria-label="Brasswind home"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 12h13l11-6v20l-11-6H4z" fill="currentColor"/><path d="M10 20v7h10v-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>brasswind<span class="brand-dot">.</span></a>
  <span class="topbar-caption">A PHYSICAL SOUND LABORATORY</span>
  <button class="text-button" id="model-notes">Behind the model <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"/></svg></button>
</header>
<main>
  <div class="page-heading"><div><h1>Trumpet laboratory</h1><p>A human airway. A pair of lips. A column of air brought to life.</p></div><div class="model-tag"><span class="status-dot"></span> Physical model <span class="tag-version">v0.1</span></div></div>
  <div class="workspace">
    <div class="setup-listen" role="group" aria-label="Playback and starting point">
      <div class="preset-control"><label for="preset">Starting point</label><select id="preset"><option value="balanced">Balanced embouchure</option><option value="gentle">Gentle attack</option><option value="bright">Bright & open</option><option value="upper">Upper register</option><option value="custom" disabled>Custom setup</option></select></div>
      <button type="button" class="setup-play" id="setup-play" aria-pressed="false"><svg id="setup-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg><span id="setup-play-label">Play setup</span></button>
      <div class="setup-feedback"><span>Measured concert pitch</span><output id="setup-pitch" aria-live="off">— Hz</output></div>
      <button class="text-button reset" id="reset">Reset <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg></button>
      <p id="setup-error" class="setup-error" hidden></p>
    </div>
    <section class="laboratory" aria-label="Trumpet simulation">
      <div class="stage-top"><div class="instrument-heading"><div><h2>B♭ Trumpet</h2><span>CYLINDRICAL BORE · THREE PISTON VALVES</span></div></div><span class="live-status" id="live-status">At rest</span></div>
      <div class="stage">${illustration}</div>
      <div class="scene-tools"><a class="tune-link" href="#setup">Tune parameters</a><a class="tune-link" href="#music">Play a melody</a><button id="show-air" class="text-button" aria-pressed="false">Show airflow route</button><details class="reference"><summary>Yamaha B♭ photo reference</summary><figure><img src="./reference/yamaha-ytr-8335la.jpg" alt="Side view of a Yamaha YTR-8335LA B-flat trumpet, showing its bell above the leadpipe and horizontal tuning slides" width="1800" height="982" loading="lazy"/><figcaption>Yamaha Corporation · crop by Jonathanischoice · <a href="https://commons.wikimedia.org/wiki/File:Yamaha_Trumpet_YTR-8335LA_crop.jpg" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. Exterior reference only, not a measured internal bore.</figcaption></figure></details></div>
      <div class="signal-chain"><span><i class="chain-dot teal"></i> Breath pressure</span><b>→</b><span>Vocal tract</span><b>⇄</b><span>Vibrating lips</span><b>⇄</b><span>Trumpet bore</span><b>→</b><span><i class="chain-dot gold"></i> Sound</span></div>
      <div class="readouts"><div><span>ORAL PRESSURE</span><strong id="oral-pressure">0.00 <small>kPa</small></strong></div><div><span>AIRFLOW AT LIPS</span><strong id="airflow">0 <small>mL/s</small></strong></div><div><span>MEASURED PITCH <span title="Estimated from the audible signal, in concert pitch. Lip tuning is not a note generator.">ⓘ</span></span><strong id="pitch">— <small>Hz</small></strong></div><div><span>ACOUSTIC PATH</span><strong id="bore-length">1.480 <small>m</small></strong></div></div>
      <div class="analysis-grid">
        <section class="plot"><div class="plot-heading"><h3>At the bell</h3><div class="segmented" aria-label="Output visualization"><button class="selected" data-signal="waveform" aria-pressed="true">Wave</button><button data-signal="spectrum" aria-pressed="false">Spectrum</button></div></div><canvas id="signal-canvas" aria-label="Live output waveform or spectrum"></canvas><div class="plot-caption"><span id="signal-caption">OUTPUT AMPLITUDE</span><span id="sample-rate">AUDIO OFF</span></div></section>
        <section class="plot"><div class="plot-heading"><h3>Inside the instrument</h3><div class="segmented" aria-label="Bore visualization"><button class="selected" data-bore="geometry" aria-pressed="true">Bore</button><button data-bore="pressure" aria-pressed="false">Pressure</button></div></div><canvas id="bore-canvas" aria-label="Trumpet radius along its acoustic path or live bore pressure"></canvas><div class="plot-caption"><span id="bore-caption">RADIUS · 0–64 mm</span><span>MOUTHPIECE → BELL</span></div></section>
      </div>
      <div class="transport"><button id="play" class="play-button" aria-pressed="false"><svg class="play-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg><span id="play-label">Start airflow</span><kbd>SPACE</kbd></button><div class="volume-control"><label for="volume"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3zM16 8q5 4 0 8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><span class="sr-only">Monitor volume</span></label><input id="volume" type="range" min="0" max="1" step="0.01" value="0.55"/><output id="volume-value" for="volume">55%</output></div></div>
      <p class="listening-note" id="audio-message" role="status">Start at a low listening volume. Sound is synthesized live, never sampled.</p>
    </section>
    <aside class="inspector" id="setup" aria-label="Player and instrument controls">
      <div class="inspector-title"><h2>Sound controls</h2></div>
      <p class="setup-help">Start quietly. Drag to explore, or type a value and press Enter. Arrow keys fine-tune; Escape cancels.</p>
      <section class="control-section"><div class="section-label"><h3>The player</h3><span class="section-note">Excitation</span></div>
        <div class="player-parameters">${slider('pressure', 'Breath pressure', 0, 15, 0.1, 'Lung driving pressure; the mouth pressure responds to flow.')}
        ${slider('lipFrequency', 'Lip resonance', 90, 900, 1, 'Mass–spring tuning. The bore decides which note locks in.')}
        ${slider('opening', 'Rest lip opening', 0, 0.8, 0.01, 'Aperture before pressure pushes the lips apart.')}
        ${slider('tongue', 'Tongue arch', 0, 1, 0.01, 'Open / ah to arched / ee. Reshapes the upstream airway and its feedback.')}</div>
        <div class="control articulation-control"><div class="control-heading"><label for="articulation">Tongue attack</label><button id="tongue-note" type="button" class="text-button">Tongue note · T / K</button></div><select id="articulation" aria-describedby="articulation-help"><option value="tu">Tu · front tongue / crisp</option><option value="ku">Ku · back tongue / softer</option></select><p id="articulation-help">T plays “tu”; K plays “ku”. Tongue the live note, or start airflow at rest. MIDI uses the selected attack, not a spoken sample.</p></div>
      </section>
      <section class="control-section instrument-controls"><div class="section-label"><h3>The trumpet</h3><span class="section-note">Resonator</span></div><div class="instrument-parameters"><div class="valve-controls"><div class="valve-heading"><span>Piston valves</span><span>CLICK OR HOLD KEYS 1–3</span></div><div class="valve-buttons">${[1, 2, 3].map((n, i) => `<button class="valve-button" data-valve="${i}" aria-label="Valve ${n}" aria-pressed="false"><span>${n}</span><small>+${Math.round(VALVE_LENGTHS[i] * 100)} cm</small></button>`).join('')}</div><div class="tubing-readout"><span>Additional tubing</span><strong id="extra-length">+0.0 cm</strong></div><p class="valve-help">Retune the lips as you change valves; fixed embouchure can jump registers or fall silent.</p></div>${slider('tuning', 'Main tuning slide', -20, 40, 0.5, 'Pull + to lower pitch; push − to raise it. Millimetres relative to nominal; both U-slide legs change length. Tune against A4 = 440 Hz and the measured cents readout.')}</div></section>
      <details class="advanced"><summary>Player anatomy & physics <svg class="disclosure-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary><div class="advanced-controls">${slider('tractLength', 'Vocal tract length', 0.13, 0.21, 0.005, 'Scales the reused adult vocal tract; not an individual scan.')}${slider('lipQ', 'Lip quality factor', 1.5, 12, 0.1, 'Higher values mean less tissue damping.')}${slider('lipMass', 'Lip areal mass', 1, 40, 0.1, 'Effective vibrating mass per lip area, in kg/m².')}${slider('temperature', 'Air temperature', 5, 35, 1, 'Changes wave speed and therefore the bore resonances.')}</div></details>
      <div class="physics-note"><p><strong>One coupled system.</strong><br/>Pressure moves the lips. The lips move air. Reflections from the head and horn move the lips again.</p></div>
    </aside>
    ${musicMarkup}
  </div>
  <footer><span>MADE OF AIR, NOT SAMPLES.</span><span>Head & airway adapted from <a href="https://github.com/jamesondh/chimera-vocal-synth" target="_blank" rel="noreferrer">Chimera Vocal Synth ↗</a> <span class="footer-divider">/</span> <button class="text-button" id="limitations">Assumptions & credits</button></span></footer>
</main>
<dialog id="notes-dialog" aria-labelledby="notes-title"><div class="dialog-heading"><button id="close-notes" class="icon-button" aria-label="Close model notes"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><h2 id="notes-title">Air is the instrument.</h2><p>This is a real-time, one-dimensional physical-model prototype, not a sample player and not a validated digital twin.</p><h3>The human side</h3><p>The midsagittal head graphic, tongue contours and semipolar airway areas come from <a href="https://github.com/jamesondh/chimera-vocal-synth" target="_blank" rel="noreferrer">Chimera Vocal Synth</a> (MIT, © 2026 Jameson Hodge). The same 21 exported tongue postures drive the drawing and the pressure-wave tract. Chimera’s critically damped muscle equation moves tongue arch and lip aperture smoothly; lip tension has a separate faster response. Kelly–Lochbaum pressure scattering retains the earlier Pink Trombone adaptation. An open glottis terminates the airway; the velum is sealed. Vocal folds do not generate the sound.</p><h3>The trumpet side</h3><p>An outward-striking mass–spring–damper lip valve drives Bernoulli flow, solved against both the airway and mouthpiece impedances. A 1.48 m variable-area waveguide includes the cup, 3.7 mm throat, backbore, 11.65 mm bore, independent valve slides and a 127 mm Bessel-flared bell. The bell contour in the cutaway uses the same radius function as the solver. A causal Silva et al. radiation filter models frequency-dependent reflection and end correction at the aperture. Two-times oversampling and an anti-alias filter run in an AudioWorklet.</p><h3>What “realistic” means here</h3><p>Lips self-oscillate only when pressure and impedance allow it. Some settings make no sustained note. Lip resonance is not output pitch; the readout measures the resulting sound in concert pitch, with signed cents relative to A4 = 440 Hz. The main tuning slide adds twice its pull distance to the bore: pull + to lower resonances, push − to raise them. Travel is relative to nominal. Tuning and tongue style persist during MIDI; other manual controls stop it.</p><p><strong>Limits:</strong> schematic anatomy, one lip degree of freedom, simplified contact and wall losses, an unflanged-pipe approximation at the bell aperture, a passive two-port approximation of piston port closure and no nasal leak. No measured impedance fitting, tissue calibration, 3-D airflow or nonlinear shock-wave brassing. Nominal B♭ geometry is not precision-tuned. Pistons travel over 18 ms, close their ports mid-stroke and preserve the acoustic state. Main tuning-slide, temperature or head-length changes fade over 12 ms and restart geometry; the main slide is not a continuous moving-wall simulation. Photo-matched outer dimensions do not calibrate the unseen interior. The 31 written notes F♯3–C6 use offline-fitted physical embouchures at 20°C; MIDI events are scheduled on the audio sample clock, with Tu (18 ms front contact, lumped at the embouchure) or Ku (22 ms contact plus a passive rear-tract closure at 58% of its length), followed by a 3 ms release. T/K re-tongue without clearing the lip oscillator or acoustic waves; these are brass attacks, not spoken syllables. Rear contact can change nonlinear startup and intonation. Intonation, low-note attacks and fast register changes remain imperfect. MIDI velocity changes monitor expression, not pitch. One melody track is supported, not chords. Output volume is not calibrated SPL.</p><h3>Sources & attribution</h3><ul><li>Kelly & Lochbaum (1962), waveguide tract synthesis.</li><li><a href="https://arxiv.org/abs/0811.3625" target="_blank" rel="noreferrer">Silva et al. (2009)</a>, causal acoustic radiation (Eq. 16, unflanged fit).</li><li><a href="https://www.ibew.org.uk/dvarch/DV03196.pdf" target="_blank" rel="noreferrer">An Environment for Physical Modeling of Articulated Brass</a>, coupled lip and bore modelling.</li><li>Chimera anatomy/profile and muscle-motion source, exact revision and adaptation notes are retained in <code>third_party/chimera/</code>. <a href="./licenses/chimera-MIT.txt" target="_blank" rel="noreferrer">Chimera MIT license</a>. Its WASM/FDTD voice solver and prescribed-pitch glottal source are not used; changing areas omit moving-wall flow.</li><li>Earlier scattering source and pinned revision are retained in <code>third_party/pink-trombone/</code>. <a href="./licenses/pink-trombone-MIT.txt" target="_blank" rel="noreferrer">Pink Trombone MIT license</a>.</li><li>Yamaha YTR-8335LA photo: Yamaha Corporation, crop by Jonathanischoice, <a href="./licenses/yamaha-reference.txt" target="_blank" rel="noreferrer">CC BY-SA 4.0; adapted trumpet artwork under the same license</a>. Exterior only; internal profile is generic.</li><li>Standard MIDI parsing: <a href="./licenses/tonejs-midi-MIT.txt" target="_blank" rel="noreferrer">@tonejs/midi (MIT)</a>, <a href="./licenses/midi-file-MIT.txt" target="_blank" rel="noreferrer">midi-file</a> and <a href="./licenses/array-flatten-MIT.txt" target="_blank" rel="noreferrer">array-flatten</a>. Beethoven/Rossini demo melodies are public domain; these are monophonic excerpts, not complete orchestral scores. <a href="./licenses/score-sources.txt" target="_blank" rel="noreferrer">Score sources, credits and adaptations</a> include the downloaded Mutopia Ode edition and William Tell notation reference.</li><li>Self-hosted DM Sans and Instrument Serif: <a href="./licenses/dm-sans-OFL.txt" target="_blank" rel="noreferrer">DM Sans license</a> / <a href="./licenses/instrument-serif-OFL.txt" target="_blank" rel="noreferrer">Instrument Serif license</a> (SIL OFL).</li></ul><p class="dialog-footnote">Educational simulation. Not a medical model or a substitute for instrument measurements.</p></dialog>`;

const $ = id => document.getElementById(id);
function controlText(key, value) {
  if (key === 'tuning') return (value > 0 ? '+' : '') + value.toFixed(1) + ' mm';
  if (key === 'pressure') return value.toFixed(1) + ' kPa';
  if (key === 'lipFrequency') return Math.round(value) + ' Hz';
  if (key === 'opening') return value.toFixed(2) + ' mm';
  if (key === 'tractLength') return (value * 100).toFixed(1) + ' cm';
  if (key === 'temperature') return value + ' °C';
  if (key === 'tongue') return Math.round(value * 100) + '%';
  return value.toFixed(1);
}

function updateControls() {
  for (const key of Object.keys(DEFAULTS)) {
    if (!$(key)) continue;
    $(key).value = state[key];
    if (key === 'articulation') continue;
    const input = $(key);
    const editor = $(key + '-number');
    if (document.activeElement !== editor) {
      editor.value = +(+input.value * +editor.dataset.scale).toFixed(4);
      editor.removeAttribute('aria-invalid');
      $(key + '-error').hidden = true;
    }
    document.querySelector(`[data-reset="${key}"]`).disabled = state[key] === DEFAULTS[key];
    input.setAttribute('aria-valuetext', controlText(key, state[key]));
    input.style.setProperty('--position', ((state[key] - +input.min) / (+input.max - +input.min) * 100) + '%');
  }
  document.querySelectorAll('[data-valve]').forEach(button => {
    const i = +button.dataset.valve;
    button.setAttribute('aria-pressed', String(state.valves[i]));
    $('piston-' + i).classList.toggle('down', state.valves[i]);
    $('piston-' + i).style.setProperty('--piston', state.valves[i] ? 1 : 0);
  });
  $('trumpet-air-path').setAttribute('d', trumpetAirPath(state.valves, state.tuning));
  document.querySelectorAll('[data-main-tube]').forEach(path => path.setAttribute('d', mainBorePath(state.tuning)));
  $('water-key').setAttribute('transform', `translate(${state.tuning * 0.6} 0)`);
  const extra = VALVE_LENGTHS.reduce((sum, length, i) => sum + (state.valves[i] ? length : 0), 0);
  $('extra-length').textContent = '+' + (extra * 100).toFixed(1) + ' cm';
  $('bore-length').innerHTML = (BASE_LENGTH + extra + state.tuning * 0.002).toFixed(3) + ' <small>m</small>';
  drawHead(telemetry?.tongue ?? state.tongue, telemetry?.tract, telemetry?.articulation);
}

const audio = new AudioEngine(data => {
  telemetry = data;
  const performance = data.performance;
  if (performance?.id === intent) updateMusic(performance);
  if (performanceActive && performance?.id === intent) {
    if (!performance.active) {
      performanceActive = false; state.blowing = false; updateTransport();
    } else if (performance.midi !== null && (performance.index !== performanceIndex || state.lipFrequency !== performance.parameters.lipFrequency)) {
      performanceIndex = performance.index;
      const { tuning, articulation } = state;
      Object.assign(state, performance.parameters, { tuning, articulation });
      state.valves = [...performance.parameters.valves];
      $('preset').value = 'custom';
      updateControls(); updateTransport();
    }
  }
}, message => {
  stop(); audio.silence();
  $('audio-message').textContent = message;
  $('audio-message').classList.add('error');
  $('setup-error').textContent = message;
  $('setup-error').hidden = false;
});

function setParameters(patch, custom = true) {
  const live = Object.keys(patch).every(key => key === 'tuning' || key === 'articulation');
  if (performanceActive && !live) stop();
  Object.assign(state, patch);
  if (custom) $('preset').value = 'custom';
  audio.update(patch);
  updateControls();
}

function updateTransport() {
  $('play').setAttribute('aria-pressed', String(state.blowing));
  $('play').classList.toggle('playing', state.blowing);
  document.querySelector('.instrument-scene').classList.toggle('blowing', state.blowing);
  $('play-label').textContent = state.blowing ? 'Stop airflow' : 'Start airflow';
  $('setup-play').setAttribute('aria-pressed', String(state.blowing));
  $('setup-play-label').textContent = state.blowing ? 'Stop sound' : 'Play setup';
  $('setup-icon').innerHTML = state.blowing ? '<path d="M3 3h10v10H3z"/>' : '<path d="M4 2l10 6-10 6z"/>';
  document.querySelector('.play-icon').innerHTML = $('setup-icon').innerHTML;
  $('live-status').textContent = state.blowing ? 'Airflow on' : 'At rest';
  $('live-status').classList.toggle('active', state.blowing);
}
function stop() {
  intent++;
  state.blowing = false;
  performanceActive = false;
  updateMusic({ active: false, index: -1, midi: null, time: 0 });
  audio.update({ blowing: false });
  updateTransport();
}
async function toggle() {
  if (state.blowing) return stop();
  if (starting) return;
  starting = true;
  const ticket = ++intent;
  $('play').disabled = $('setup-play').disabled = true;
  try {
    await audio.start({ ...state, blowing: false });
    if (ticket !== intent) return;
    audio.setVolume(+$('volume').value);
    state.blowing = true;
    audio.update({ blowing: true });
    $('sample-rate').textContent = (audio.context.sampleRate / 1000).toFixed(1) + ' kHz · 2×';
    $('audio-message').textContent = 'Listening to a coupled physical model. Explore pressure, lips and valves.';
    $('audio-message').classList.remove('error');
    $('setup-error').hidden = true;
    updateTransport();
  } catch (error) {
    stop();
    $('audio-message').textContent = error.message;
    $('audio-message').classList.add('error');
    $('setup-error').textContent = error.message;
    $('setup-error').hidden = false;
  } finally {
    starting = false;
    $('play').disabled = $('setup-play').disabled = false;
  }
}

async function playScore(notes) {
  const clean = validateScore(notes);
  if (starting) return;
  stop(); starting = true;
  const ticket = ++intent;
  $('play').disabled = $('setup-play').disabled = true;
  try {
    await audio.start({ ...state, blowing: false });
    if (ticket !== intent) return;
    audio.setVolume(+$('volume').value);
    performanceActive = true; performanceIndex = -2;
    state.blowing = true;
    audio.playScore(clean, ticket);
    $('sample-rate').textContent = (audio.context.sampleRate / 1000).toFixed(1) + ' kHz · 2×';
    $('audio-message').textContent = 'Playing physical embouchures and piston slides. Tuning and tongue style stay live; other controls stop the score.';
    $('audio-message').classList.remove('error');
    $('setup-error').hidden = true;
    updateTransport();
  } finally {
    starting = false;
    $('play').disabled = $('setup-play').disabled = false;
  }
}
updateMusic = setupMusic(playScore, stop);
$('show-air').addEventListener('click', event => {
  const visible = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
  document.querySelector('.instrument-scene').classList.toggle('show-route', visible);
});

Object.keys(DEFAULTS).forEach(key => {
  if ($(key)?.type !== 'range') return;
  $(key).addEventListener('input', event => setParameters({ [key]: +event.target.value }));
  const editor = $(key + '-number');
  let cancelling = false;
  editor.addEventListener('change', () => {
    if (cancelling) return;
    if (editor.value === '' || !editor.validity.valid) {
      editor.setAttribute('aria-invalid', 'true');
      const error = $(key + '-error');
      error.textContent = `Use ${editor.min} to ${editor.max} ${units[key]}, in steps of ${editor.step}.`;
      error.hidden = false;
      return;
    }
    editor.removeAttribute('aria-invalid');
    $(key + '-error').hidden = true;
    const value = +editor.value / +editor.dataset.scale;
    if (value !== state[key]) setParameters({ [key]: value });
  });
  editor.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      cancelling = true;
      editor.blur();
      cancelling = false;
      updateControls();
    } else if (event.key === 'Enter') editor.blur();
  });
});
document.querySelectorAll('[data-reset]').forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.reset;
  setParameters({ [key]: DEFAULTS[key] });
}));
async function tongueNote(kind = state.articulation) {
  if (performanceActive) stop();
  setParameters({ articulation: kind });
  if (!state.blowing) return toggle();
  audio.articulate();
}
$('articulation').addEventListener('change', event => {
  setParameters({ articulation: event.target.value });
  if (state.blowing && !performanceActive) audio.articulate();
});
$('tongue-note').addEventListener('click', () => tongueNote());
$('play').addEventListener('click', toggle);
$('setup-play').addEventListener('click', toggle);
$('volume').addEventListener('input', event => {
  const value = +event.target.value;
  audio.setVolume(value);
  $('volume-value').textContent = Math.round(value * 100) + '%';
});
$('preset').addEventListener('change', event => { if (presets[event.target.value]) setParameters({ lipMass: 4, ...presets[event.target.value] }, false); });
$('reset').addEventListener('click', () => {
  stop();
  setParameters({ ...DEFAULTS, valves: [...DEFAULTS.valves] }, false);
  $('preset').value = 'balanced';
});
document.querySelectorAll('[data-valve]').forEach(button => button.addEventListener('click', () => {
  const valves = [...state.valves];
  valves[+button.dataset.valve] = !valves[+button.dataset.valve];
  setParameters({ valves }, false);
}));
const heldValves = new Map();
window.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || $('notes-dialog').open || event.target.closest('input, select, textarea')) return;
  if (event.code === 'Space' && !event.target.closest('button, a, summary')) { event.preventDefault(); toggle(); }
  if (event.code === 'KeyT' || event.code === 'KeyK') { event.preventDefault(); tongueNote(event.code === 'KeyT' ? 'tu' : 'ku'); }
  if (['1', '2', '3'].includes(event.key)) {
    const i = +event.key - 1;
    heldValves.set(i, state.valves[i]);
    const valves = [...state.valves]; valves[i] = true;
    setParameters({ valves }, false);
  }
});
window.addEventListener('keyup', event => {
  const i = +event.key - 1;
  if (!heldValves.has(i)) return;
  const valves = [...state.valves]; valves[i] = heldValves.get(i);
  heldValves.delete(i);
  setParameters({ valves }, false);
});
function release() {
  if (heldValves.size) {
    const valves = [...state.valves];
    heldValves.forEach((was, i) => { valves[i] = was; });
    heldValves.clear();
    setParameters({ valves }, false);
  }
  stop();
}
window.addEventListener('blur', release);
document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
window.addEventListener('pagehide', () => { release(); audio.close(); });

for (const id of ['model-notes', 'limitations']) $(id).addEventListener('click', () => { stop(); $('notes-dialog').showModal(); });
$('close-notes').addEventListener('click', () => $('notes-dialog').close());
$('notes-dialog').addEventListener('click', event => { if (event.target === $('notes-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
for (const type of ['signal', 'bore']) document.querySelectorAll('[data-' + type + ']').forEach(button => button.addEventListener('click', () => {
  if (type === 'signal') signalView = button.dataset.signal;
  else boreView = button.dataset.bore;
  document.querySelectorAll('[data-' + type + ']').forEach(b => {
    const selected = b === button;
    b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected));
  });
  $('signal-caption').textContent = signalView === 'waveform' ? 'OUTPUT AMPLITUDE' : 'SPECTRUM · 0–8 kHz';
  $('bore-caption').textContent = boreView === 'geometry' ? 'RADIUS · 0–64 mm' : 'INSTANTANEOUS PRESSURE · ±10 kPa';
}));

const timeData = new Float32Array(4096);
const spectrumData = new Float32Array(2048);
function prepare(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#34443b'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * height / 4); ctx.lineTo(width, i * height / 4); ctx.stroke(); }
  for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * width / 8, 0); ctx.lineTo(i * width / 8, height); ctx.stroke(); }
  return { ctx, width, height };
}
function drawSignal() {
  const { ctx, width, height } = prepare($('signal-canvas'));
  if (audio.analyser) {
    audio.analyser.getFloatTimeDomainData(timeData);
    audio.analyser.getFloatFrequencyData(spectrumData);
  }
  ctx.strokeStyle = '#8bc9b8'; ctx.lineWidth = 1.5; ctx.beginPath();
  const rate = audio.context?.sampleRate || 48000;
  if (signalView === 'waveform') {
    const count = Math.min(timeData.length, Math.round(rate * 0.025));
    for (let i = 0; i < count; i++) {
      const x = i * width / (count - 1);
      const y = height / 2 - timeData[i] * height * 1.8;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
  } else {
    const count = Math.min(spectrumData.length, Math.floor(8000 / (rate / 4096)));
    for (let i = 0; i < count; i++) {
      const value = audio.analyser ? Math.max(0, Math.min(1, (spectrumData[i] + 100) / 100)) : 0;
      const x = i * width / (count - 1); const y = height - value * height;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
  }
  ctx.stroke();
  if (frame % 12 === 0) {
    measuredPitch = audio.analyser ? estimatePitch(timeData, rate) : 0;
    if (measuredPitch) {
      const midi = Math.round(69 + 12 * Math.log2(measuredPitch / 440));
      const name = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
      const cents = Math.round(1200 * Math.log2(measuredPitch / (440 * 2 ** ((midi - 69) / 12))));
      $('pitch').innerHTML = measuredPitch.toFixed(0) + ' <small>Hz · ' + name + ' · ' + (cents >= 0 ? '+' : '') + cents + ' ct</small>';
    } else $('pitch').innerHTML = '— <small>Hz</small>';
    $('setup-pitch').textContent = $('pitch').textContent;
  }
}
function drawBore() {
  const { ctx, width, height } = prepare($('bore-canvas'));
  ctx.strokeStyle = '#d8b579'; ctx.fillStyle = '#d8b57920'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (boreView === 'geometry') {
    const { radii } = boreProfile(state.valves, 96000, 331.3 + 0.606 * state.temperature, state.tuning);
    for (let side = 0; side < 2; side++) for (let i = 0; i < radii.length; i++) {
      const j = side ? radii.length - i - 1 : i;
      const x = j * width / (radii.length - 1);
      const y = height / 2 + (side ? 1 : -1) * radii[j] / 0.064 * height * 0.46;
      !side && !i ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  } else {
    const values = telemetry?.bore || Array(64).fill(0);
    values.forEach((v, i) => {
      const x = i * width / 63; const y = height / 2 - Math.max(-1, Math.min(1, v / 10000)) * height * 0.45;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
  }
  ctx.stroke();
}
function animate() {
  frame++;
  drawSignal(); drawBore();
  if (telemetry && frame % 3 === 0) {
    $('oral-pressure').innerHTML = (telemetry.pressure / 1000).toFixed(2) + ' <small>kPa</small>';
    $('airflow').innerHTML = Math.round(telemetry.flow * 1e6) + ' <small>mL/s</small>';
    const amplitude = Math.min(1, Math.abs(telemetry.flow) * 4000);
    $('tract-air').style.opacity = String(0.45 + amplitude * 0.55);
    drawHead(telemetry.tongue, telemetry.tract, telemetry.articulation);
  }
  requestAnimationFrame(animate);
}
updateControls();
animate();
