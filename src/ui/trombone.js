import { TROMBONE_BELL, tromboneBellRadius } from '../dsp/trombone-geometry.js';
import { tube, mouthpiece } from './brass.js';

// Side view of a straight tenor, laid out like the real instrument: the slide runs forward from
// the mouthpiece, the bell section returns over the player's shoulder (its tuning-slide bow sits
// behind the head) and the bell faces forward above the slide. Schematic, not to scale.
export const SLIDE_SCALE = 0.3;               // drawing px per mm of hand travel
const Y1 = 204, Y2 = 238, R = (Y2 - Y1) / 2;  // upper (inner) and lower slide legs
const LOCK = 372;                             // slide lock / inner brace
const INNER_END = 802;                        // fixed inner slide tubes end here
const OUTER = [392, 812];                     // outer slide at closed position
const BELL_Y = 84, BELL_START = 540, BELL_END = 740, BELL_R = 64;

const tuningX = tuning => 92 - tuning * 0.6;  // tuning pull moves the bow toward the back
// Lower slide leg → gooseneck → over the shoulder → tuning bow → bell tube.
function bellSection(tuning) {
  const x = tuningX(tuning);
  return `H352 Q328 ${Y2} 328 ${Y2 - 24} V150 Q328 126 304 126 H${x} Q${x - 21} 126 ${x - 21} 105 Q${x - 21} ${BELL_Y} ${x} ${BELL_Y} H${BELL_START}`;
}
const outerSlide = (s, close = false) => `M${OUTER[0] + s} ${Y1} H${OUTER[1] + s} A${R} ${R} 0 0 1 ${OUTER[1] + s} ${Y2}${close ? ` H${OUTER[0] + s}` : ''}`;

export function tromboneAirPath(slide = 0, tuning = 0) {
  return `M279 ${Y1} H${OUTER[1] + slide * SLIDE_SCALE} A${R} ${R} 0 0 1 ${OUTER[1] + slide * SLIDE_SCALE} ${Y2} ${bellSection(tuning)} H${BELL_END}`;
}
// Kept for callers that draw the whole bore as one stroke.
export function tromboneTubePath(slide = 0, tuning = 0) {
  return tromboneAirPath(slide, tuning).replace('M279', 'M333').replace(/ H\d+(\.\d+)?$/, '');
}

export function drawTrombone(mm, tuning) {
  const s = mm * SLIDE_SCALE, set = (id, attr, value) => document.getElementById(id)?.setAttribute(attr, value);
  set('trombone-outer', 'transform', `translate(${s} 0)`);
  set('hand-brace', 'transform', `translate(${s} 0)`);
  document.querySelectorAll('[data-trombone-back]').forEach(p => p.setAttribute('d', `M372 ${Y2} ${bellSection(tuning)}`));
  set('trombone-tuning-brace', 'transform', `translate(${-tuning * 0.6} 0)`);
  set('trombone-air-path', 'd', tromboneAirPath(mm, tuning));
}

const bellTop = Array.from({ length: 49 }, (_, i) => {
  const t = i / 48;
  return [BELL_START + (BELL_END - BELL_START) * t, BELL_Y - tromboneBellRadius(t) / TROMBONE_BELL.radius * BELL_R];
});
const bellShape = bellTop.concat(bellTop.map(([x, y]) => [x, 2 * BELL_Y - y]).reverse())
  .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z';
const highlight = bellTop.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${(y + 2.5).toFixed(2)}`).join(' ');

// Drawn before the head: the bell section passes behind the player.
export const tromboneBackMarkup = `<g id="trombone-back" hidden fill="none" stroke-linecap="round" stroke-linejoin="round">
  ${tube(`M372 ${Y2} ${bellSection(0)}`, 11, { attrs: 'data-trombone-back' })}
  ${tube(`M316 ${BELL_Y + 6} V120`, 4)}
  <g id="trombone-tuning-brace">${tube(`M${tuningX(0) + 26} ${BELL_Y + 6} V120`, 4)}<circle cx="${tuningX(0) - 21}" cy="112" r="3.5" fill="url(#brass)" stroke="#7a5726"/></g>
</g>`;

export const tromboneMarkup = `<g id="trombone-assembly" hidden>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <!-- Fixed nickel-silver inner slide; the brass outer slide rides over it. -->
    ${tube(`M${LOCK} ${Y1} H${INNER_END} M${LOCK} ${Y2} H${INNER_END}`, 8, { metal: 'nickel' })}
    <g id="trombone-outer">
      ${tube(outerSlide(0, true), 11)}
      <!-- Stockings: thicker sleeves at the far end, and the end crook bumper. -->
      ${tube(`M${OUTER[1] - 46} ${Y1} H${OUTER[1] - 6} M${OUTER[1] - 46} ${Y2} H${OUTER[1] - 6}`, 13)}
      <path d="M${OUTER[1] + R + 7} ${Y1 + 9} V${Y2 - 9}" stroke="#2c2a26" stroke-width="5"/>
      <path d="M${OUTER[1] + 2} ${Y2 + 5} q8 9 16 2" stroke="#a88a54" stroke-width="2.5"/>
      ${[OUTER[0] + 2, OUTER[1] - 46].map(x => `<rect x="${x - 3}" y="${Y1 - 8}" width="6" height="16" rx="2" fill="url(#brass)" stroke="#7a5726"/><rect x="${x - 3}" y="${Y2 - 8}" width="6" height="16" rx="2" fill="url(#brass)" stroke="#7a5726"/>`).join('')}
    </g>
    <!-- Outer-slide hand brace: the part the right hand moves. -->
    <g id="hand-brace">${tube(`M436 ${Y1 + 6} V${Y2 - 6}`, 6)}<rect x="430" y="${Y1 + 12}" width="12" height="10" rx="3" fill="url(#brass)" stroke="#5f4219"/></g>
    <!-- Inner brace / slide lock, held by the left hand. -->
    ${tube(`M${LOCK + 6} ${Y1 + 6} V${Y2 - 6}`, 5, { metal: 'nickel' })}
    <rect x="${LOCK - 6}" y="${Y1 - 9}" width="16" height="18" rx="3" fill="url(#brass)" stroke="#7a5726"/>
    <rect x="${LOCK - 6}" y="${Y2 - 9}" width="16" height="18" rx="3" fill="url(#brass)" stroke="#7a5726"/>
  </g>
  <g fill="none" stroke-linecap="round">${tube(`M333 ${Y1} H${LOCK - 6}`, 8)}</g>
  <!-- Bell: same Bessel-flare radius function as the solver. -->
  <path id="trombone-bell" d="${bellShape}" fill="url(#bell)" stroke="#8d6a34" stroke-width="1.5"/>
  <path d="${highlight}" fill="none" stroke="#fff3d2" stroke-width="2" opacity=".7"/>
  <rect x="${BELL_START - 6}" y="${BELL_Y - 8}" width="10" height="16" rx="2" fill="url(#brass)" stroke="#7a5726"/>
  <ellipse cx="${BELL_END}" cy="${BELL_Y}" rx="17" ry="${BELL_R}" fill="url(#bell-inside)"/>
  <ellipse cx="${BELL_END}" cy="${BELL_Y}" rx="17" ry="${BELL_R}" fill="none" stroke="#7a5726" stroke-width="7"/>
  <ellipse cx="${BELL_END}" cy="${BELL_Y}" rx="17" ry="${BELL_R}" fill="none" stroke="url(#rim)" stroke-width="4.5"/>
  ${mouthpiece()}
  <path id="trombone-air-path" d="${tromboneAirPath()}" fill="none" stroke="#8bc9b8" stroke-width="2.5" stroke-dasharray="6 5" stroke-linejoin="round"/>
  <g class="scene-labels" fill="#abb9ab" font-family="monospace" font-size="10" letter-spacing="1">
    <text x="27" y="33">01 / THE PLAYER</text><text x="795" y="33">03 / THE RESONATOR</text>
    <path d="M${BELL_END + 10} ${BELL_Y - 40} L${BELL_END + 50} 58 H${BELL_END + 175}" fill="none" stroke="#6b806e" stroke-width="1"/>
    <text x="${BELL_END + 58}" y="52">B♭ TENOR · Ø204 mm</text>
    <text x="560" y="286">CONTINUOUS HAND SLIDE ↔</text>
    <text x="470" y="196">INNER SLIDE</text>
    <text x="22" y="140">TUNING</text><text x="22" y="152">SLIDE</text>
    <text x="34" y="409" font-size="9" letter-spacing=".5">CHIMERA HEAD · GENERIC TENOR GEOMETRY · NOT TO SCALE</text>
  </g>
</g>`;

