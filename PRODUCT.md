# ChimeraBrass

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students exploring a brass-instrument demonstration. No specific age group or level of musical experience has been established.

## Product Purpose

A demo project for playing physically generated brass sounds and exploring how adjustable parameters change them. Start with a trumpet, with other brass instruments a possible later extension.

Success means students can get a sound, adjust it, hear the difference, and understand which controls are responsible without tedious setup or repeated slider hunting. This is not a professional performance instrument, a medical model, or a validated digital twin.

## Positioning

Sound emerges from the coupling of breath pressure, a human vocal tract, vibrating lips, and the instrument's air column. The controls affect that physical model rather than playing samples or forcing an oscillator to a requested note.

## Operating Context

- Runs in a browser with AudioWorklet, on localhost or HTTPS. Audio begins through a user gesture.
- Students can start airflow, explore physical parameters, press valves, audition notes, or play a MIDI melody.
- Controls and the head/instrument illustration should help connect an adjustment to its audible result. Technical detail supports exploration; it should not be a prerequisite for making sound.
- The user reports that the current tuning workflow is too tedious. Improving this workflow is the immediate UI priority, not adding more parameters.
- Audio computation, MIDI imports, fonts, and bundled demonstration assets run locally. No microphone or backend is required.

## Capabilities and Constraints

Existing implementation:

- A nominal B♭ trumpet coupled to a one-dimensional vocal-tract and pressure-driven lip model.
- Adjustable breath pressure, lip resonance, aperture, damping, effective lip mass, tongue arch, tract length, temperature, and main tuning-slide position.
- Three independent piston valves, Tu/Ku attacks, manual playback, and keyboard shortcuts.
- Thirty-one playable written notes F♯3–C6, sounding E3–B♭5, using fitted physical embouchures.
- Measured concert pitch and cents, pressure/flow readouts, waveform/spectrum, and bore/pressure views.
- Monophonic MIDI import, note audition, and bundled Ode to Joy, William Tell, and long-tone demonstrations.
- Responsive browser UI; this is a web project, not a native mobile app.

Preserve the distinction between a requested note, a lip-resonance setting, and measured output pitch. B♭ trumpet written pitch is two semitones above concert pitch. Do not disguise imperfect tuning or slow attacks with unannounced pitch correction.

The model has approximate anatomy, wall losses, contact, valve behavior, and bell radiation. Low-note onset and register changes remain imperfect. Output volume is not calibrated sound pressure level. MIDI is one melody on one trumpet, not polyphonic playback.

Open decisions: students' age and experience, any classroom-specific deployment needs, and which advanced controls students should see by default.

## Brand Commitments

The project name is ChimeraBrass (renamed from Brasswind). Acknowledge Chimera Vocal Synth and the other reused code and assets without implying upstream affiliation or endorsement. The user requested real instrument/head physics, reuse of Chimera's useful head components and graphic, and a trumpet-first implementation. The user has explicitly requested a dark theme and a reorganized layout. Keep the brass instrument and teal signal colors, use dark neutral surfaces, and prioritize direct controls with nearby playback and measured feedback. This is a visual/workflow change, not a change to the acoustic model.

## Evidence on Hand

- `README.md`: model equations, actual capabilities, controls, validation approach, and explicit limitations.
- `src/dsp/`: the pressure-driven solver and shared acoustic geometry.
- `src/ui/`: current illustration, reused head geometry, pitch measurement, and music UI.
- `third_party/chimera/` and `third_party/pink-trombone/`: pinned upstream source and attribution.
- `public/reference/yamaha-ytr-8335la.jpg`: licensed exterior reference, not measured internal acoustics.
- `public/scores/` and `public/licenses/score-sources.txt`: MIDI demos, sources, and adaptation details.
- `tests/`: numerical/model checks and real-browser worklet/interaction tests. These are regression evidence, not student usability studies or proof of acoustic realism.

No student usability research, instrument-measurement calibration, or formal listening validation has been supplied. Do not invent educational outcomes or performance claims.

## Product Principles

1. Make a sound before requiring technical knowledge: students should have an understandable starting point.
2. Make tuning direct: keep common adjustments easy to find and preserve access to detailed physical parameters without making every student manage them at once.
3. Make cause and effect clear: audible results, measured feedback, and the diagram should agree about what changed.
4. Preserve physical honesty: disclose approximations, actual pitch, transposition, and model limits rather than hiding them.
5. Keep the demo lightweight and local; prioritize exploring sound over unrelated features.
