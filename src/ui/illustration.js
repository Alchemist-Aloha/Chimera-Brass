// Trumpet artwork: Yamaha Corporation reference, adapted under CC BY-SA 4.0.
// See public/licenses/yamaha-reference.txt; rendering logic remains MIT.
import { BELL, bellRadius } from '../dsp/geometry.js';
import { headMarkup } from './head.js';
import { tromboneMarkup, tromboneBackMarkup } from './trombone.js';
import { tube, mouthpiece, metalDefs } from './brass.js';

const leadpipe = (tuning = 0) => {
  const pull = tuning * 0.6;
  return `H${858 + pull} Q${900 + pull} 204 ${900 + pull} 246 V250 Q${900 + pull} 280 ${870 + pull} 280 H708 Q684 280 684 270`;
};
// The bell return bends up at x 432; its straight run to the bell (BELL_TUBE) passes behind the valves.
const bendUp = 'H432 Q378 270 378 224 Q378 178 432 178';
const bellReturn = bendUp + ' H814';
const BELL_TUBE = 'M432 178 H814';
// Ports run right to left: third valve → second → first → bell return.
const valveRoutes = [
  'V250 H486 Q470 250 470 264 V276 Q470 290 486 290 H592 V270',
  'V284 L634 302 Q626 310 620 302 L612 294 Q608 288 614 282 L626 270',
  'V250 H830 Q851 250 851 264 V268 Q851 282 830 282 H660 V270',
];
export function trumpetAirPath(valves = [false, false, false], tuning = 0) {
  return `M279 204 ${leadpipe(tuning)} ${valves[2] ? valveRoutes[2] : 'H660'} H650 ${valves[1] ? valveRoutes[1] : 'H626'} H616 ${valves[0] ? valveRoutes[0] : 'H592'} ${bellReturn} H1032`;
}
// Drawn bore in front of the casings: leadpipe, tuning slide and the bend up to the bell tube.
export function mainBorePath(tuning = 0) { return `M365 204 ${leadpipe(tuning)} H592 ${bendUp}`; }
const tubePaths = [mainBorePath(),
  ...valveRoutes.map((route, i) => `M${616 + 34 * i} 270 ${route}`)];
const bellTop = Array.from({ length: 49 }, (_, i) => {
  const t = i / 48;
  return [814 + 218 * t, 178 - bellRadius(t) / BELL.radius * 75];
});
const bellOutline = bellTop.concat(bellTop.map(([x, y]) => [x, 356 - y]).reverse());
const bellShape = bellOutline.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + 'Z';

// Valve casing: knurled top cap, plated cylinder, bottom cap; the stem and pearl button move.
const casing = (x, i) => `<g class="piston" id="piston-${i}">
  <rect x="${x - 14}" y="166" width="28" height="141" fill="url(#casing)" stroke="#5f4219"/>
  <rect x="${x - 16}" y="160" width="32" height="9" rx="2" fill="url(#casing)" stroke="#5f4219"/>
  <path d="M${x - 13} 161.5 V167.5 M${x - 9} 161.5 V167.5 M${x - 5} 161.5 V167.5 M${x - 1} 161.5 V167.5 M${x + 3} 161.5 V167.5 M${x + 7} 161.5 V167.5 M${x + 11} 161.5 V167.5" stroke="#5f4219" stroke-width=".8" opacity=".6"/>
  <rect x="${x - 16}" y="232" width="32" height="5" fill="url(#casing)" stroke="#5f4219" opacity=".9"/>
  <rect x="${x - 17}" y="302" width="34" height="11" rx="4" fill="url(#casing)" stroke="#5f4219"/>
  <path d="M${x - 10} 313 Q${x} 322 ${x + 10} 313Z" fill="url(#casing)" stroke="#5f4219"/>
  <g class="valve-stem">
    <rect x="${x - 2.5}" y="136" width="5" height="25" fill="url(#casing)" stroke="#5f4219" stroke-width=".7"/>
    <rect x="${x - 16}" y="127" width="32" height="11" rx="5.5" fill="url(#casing)" stroke="#5f4219"/>
    <ellipse cx="${x}" cy="132" rx="12" ry="3.6" fill="url(#pearl)" stroke="#b8a99a" stroke-width=".6"/>
    <text x="${x}" y="119" text-anchor="middle" font-size="13" fill="#8f9b8c">${i + 1}</text>
  </g>
</g>`;
const brace = (x, y1, y2) => `<g fill="none" stroke-linecap="round">${tube(`M${x} ${y1} V${y2}`, 4)}</g>`;
const ferrule = (x, y, w = 9, h = 17) => `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="2" fill="url(#brass)" stroke="#5f4219"/>`;
const bellShade = bellTop.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${(356 - y).toFixed(2)}`).join(' ');

export const illustration = `
<svg class="instrument-scene" viewBox="0 0 1100 420" role="img" aria-labelledby="scene-title scene-description">
<title id="scene-title">Human vocal tract coupled to a B-flat trumpet</title>
<desc id="scene-description">Human midsagittal head, tongue and airway cross-sections reused from Chimera Vocal Synth. The same area samples drive the acoustic head model. Trumpet proportions reconstructed from a Yamaha YTR-8335LA B-flat reference photograph. Connected trumpet cutaway. Air travels from the mouthpiece along the leadpipe, around the main tuning slide, through valves 3, 2 and 1, then along the bell return. The teal route follows the selected valve slides. Bell contour uses the acoustic model's Bessel flare. Schematic, not to scale.</desc>
<defs>${metalDefs}
  <linearGradient id="skin" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#d9a891"/><stop offset=".55" stop-color="#e8bea7"/><stop offset="1" stop-color="#f1cfb9"/></linearGradient>
  <linearGradient id="brain" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#cdb2b6"/><stop offset="1" stop-color="#e2cdcd"/></linearGradient>
  <linearGradient id="bone" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#efe3c9"/><stop offset="1" stop-color="#fbf4e3"/></linearGradient>
  <linearGradient id="muscle" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b9584e"/><stop offset="1" stop-color="#d98274"/></linearGradient>
  <linearGradient id="lip" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#b75f57"/><stop offset="1" stop-color="#d98a7f"/></linearGradient>
  <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#d9dbd5"/></pattern>
  <filter id="shadow" x="-20%" width="140%" y="-50%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="soft" x="-10%" width="120%" y="-10%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
</defs>
<rect width="1100" height="420" fill="url(#grid)" opacity=".65"/>
<ellipse cx="700" cy="372" rx="330" ry="11" fill="#000" opacity=".35" filter="url(#shadow)"/>
${tromboneBackMarkup}
${headMarkup}
<g id="trumpet-assembly">
<ellipse cx="660" cy="330" rx="250" ry="9" fill="#000" opacity=".35" filter="url(#soft)"/>
<!-- The bell tube runs on the far side of the valve block, behind the casings. -->
<g fill="none" stroke-linecap="round">${tube(BELL_TUBE, 11)}</g>
<!-- Casings sit in front of the bell tube and behind the near-side cutaway tubes. -->
${[604, 638, 672].map(casing).join('')}
<!-- One connected open bore; every slide returns to its own valve's second port. -->
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
${tubePaths.map((d, i) => tube(d, 11, { attrs: i ? '' : 'data-main-tube' })).join('')}
</g>
<!-- Braces, ferrules and hardware. -->
${brace(505, 184, 198)}${brace(770, 184, 198)}
${ferrule(814, 178, 10, 18)}${ferrule(440, 178)}${ferrule(372, 204)}${ferrule(858, 204)}
<g fill="none" stroke-linecap="round">${tube('M722 199 V190 q0 -6 6 -6 q6 0 6 6', 3)}</g>
<circle cx="806" cy="292" r="6" fill="none" stroke="#5f4219" stroke-width="4"/><circle cx="806" cy="292" r="6" fill="none" stroke="#dcb875" stroke-width="2"/>
<path d="M500 296 q0 9 9 9 h4 q9 0 9 -9" fill="none" stroke="#5f4219" stroke-width="4.5"/><path d="M500 296 q0 9 9 9 h4 q9 0 9 -9" fill="none" stroke="#dcb875" stroke-width="2.2"/>
<!-- Leadpipe receiver and silver mouthpiece. -->
<rect x="330" y="197" width="38" height="14" rx="3" fill="url(#brass)" stroke="#5f4219"/>
${mouthpiece()}
<!-- The silhouette and the acoustic solver use the same bell-radius function. -->
<path id="bell-contour" d="${bellShape}" fill="url(#bell)" stroke="#6e4f20" stroke-width="1.5"/>
<path d="${bellTop.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${(y + 2.5).toFixed(2)}`).join(' ')}" fill="none" stroke="#fff4d6" stroke-width="2.2" opacity=".8"/>
<path d="${bellShade}" fill="none" stroke="#5f4219" stroke-width="2" opacity=".5" transform="translate(0 -3)"/>
<ellipse cx="1032" cy="178" rx="20" ry="75" fill="url(#bell-inside)"/>
<ellipse cx="1032" cy="178" rx="20" ry="75" fill="none" stroke="#5f4219" stroke-width="8"/>
<ellipse cx="1032" cy="178" rx="20" ry="75" fill="none" stroke="url(#rim)" stroke-width="5"/>
<path d="M1022 112 Q1015 178 1022 244" fill="none" stroke="#fff4d6" stroke-width="1.2" opacity=".35"/>
<!-- Teal is the continuous acoustic route, not an extra physical tube. -->
<path id="trumpet-air-path" d="${trumpetAirPath()}" fill="none" stroke="#387c72" stroke-width="2.5" stroke-dasharray="6 5" stroke-linejoin="round" stroke-linecap="round"/>
<g id="water-key"><path d="M873 277 V290 Q872 298 886 295" fill="none" stroke="#5f4219" stroke-width="4.5"/><path d="M873 277 V290 Q872 298 886 295" fill="none" stroke="#dcb875" stroke-width="2.2"/></g>
<g class="scene-labels" fill="#626d5e" font-family="monospace" font-size="10" letter-spacing="1">
<text x="27" y="33">01 / THE PLAYER</text><text x="795" y="33">03 / THE RESONATOR</text>
<path d="M216 194 L310 114 H360 M281 218 L317 352 H375 M996 141 L938 70 H1020 M886 282 V327 H963" fill="none" stroke="#bac0b4" stroke-width="1"/>
<circle cx="216" cy="194" r="2"/><circle cx="281" cy="218" r="2"/><circle cx="996" cy="141" r="2"/>
<text x="312" y="105">VOCAL TRACT</text><text x="327" y="371">02 / LIP VALVE</text><text x="883" y="61">B♭ / Ø127 mm BELL</text>
<text x="390" y="229">LEADPIPE →</text><text x="798" y="345">MAIN TUNING SLIDE</text>
<text x="34" y="409" font-size="9" letter-spacing=".5">CHIMERA HEAD · YAMAHA B♭ REFERENCE · NOT TO SCALE</text>
</g>
</g>
${tromboneMarkup}
</svg>`;
