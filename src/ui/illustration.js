// Trumpet artwork: Yamaha Corporation reference, adapted under CC BY-SA 4.0.
// See public/licenses/yamaha-reference.txt; rendering logic remains MIT.
import { BELL, bellRadius } from '../dsp/geometry.js';
import { headMarkup } from './head.js';

const leadpipe = (tuning = 0) => {
  const pull = tuning * 0.6;
  return `H${858 + pull} Q${900 + pull} 204 ${900 + pull} 246 V250 Q${900 + pull} 280 ${870 + pull} 280 H708 Q684 280 684 270`;
};
const bellReturn = 'H432 Q378 270 378 224 Q378 178 432 178 H814';
// Ports run right to left: third valve → second → first → bell return.
const valveRoutes = [
  'V250 H486 Q470 250 470 264 V276 Q470 290 486 290 H592 V270',
  'V284 L634 302 Q626 310 620 302 L612 294 Q608 288 614 282 L626 270',
  'V250 H830 Q851 250 851 264 V268 Q851 282 830 282 H660 V270',
];
export function trumpetAirPath(valves = [false, false, false], tuning = 0) {
  return `M279 204 ${leadpipe(tuning)} ${valves[2] ? valveRoutes[2] : 'H660'} H650 ${valves[1] ? valveRoutes[1] : 'H626'} H616 ${valves[0] ? valveRoutes[0] : 'H592'} ${bellReturn} H1032`;
}
export function mainBorePath(tuning = 0) { return `M365 204 ${leadpipe(tuning)} H592 ${bellReturn}`; }
const tubePaths = [mainBorePath(),
  ...valveRoutes.map((route, i) => `M${616 + 34 * i} 270 ${route}`)];
const bellTop = Array.from({ length: 49 }, (_, i) => {
  const t = i / 48;
  return [814 + 218 * t, 178 - bellRadius(t) / BELL.radius * 75];
});
const bellOutline = bellTop.concat(bellTop.map(([x, y]) => [x, 356 - y]).reverse());
const bellShape = bellOutline.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + 'Z';

export const illustration = `
<svg class="instrument-scene" viewBox="0 0 1100 420" role="img" aria-labelledby="scene-title scene-description">
<title id="scene-title">Human vocal tract coupled to a B-flat trumpet</title>
<desc id="scene-description">Human midsagittal head, tongue and airway cross-sections reused from Chimera Vocal Synth. The same area samples drive the acoustic head model. Trumpet proportions reconstructed from a Yamaha YTR-8335LA B-flat reference photograph. Connected trumpet cutaway. Air travels from the mouthpiece along the leadpipe, around the main tuning slide, through valves 3, 2 and 1, then along the bell return. The teal route follows the selected valve slides. Bell contour uses the acoustic model's Bessel flare. Schematic, not to scale.</desc>
<defs>
  <linearGradient id="brass" x1="0" y1="0" x2="0.1" y2="1"><stop stop-color="#8f6b31"/><stop offset=".22" stop-color="#efd39a"/><stop offset=".45" stop-color="#b8924f"/><stop offset=".65" stop-color="#f2dbab"/><stop offset="1" stop-color="#87622e"/></linearGradient>
  <linearGradient id="tube-brass" gradientUnits="userSpaceOnUse" x1="0" y1="197" x2="0" y2="211" spreadMethod="reflect"><stop stop-color="#936e35"/><stop offset=".3" stop-color="#f4dfb0"/><stop offset=".55" stop-color="#d4b16d"/><stop offset="1" stop-color="#997137"/></linearGradient>
  <linearGradient id="bell" x1="0" y1="0" x2="0.3" y2="1"><stop stop-color="#a67a38"/><stop offset=".3" stop-color="#eed7a7"/><stop offset=".52" stop-color="#c6a56c"/><stop offset=".78" stop-color="#f7e4bf"/><stop offset="1" stop-color="#b38a49"/></linearGradient>
  <linearGradient id="skin" x1="0" y1="0" x2="1" y2=".5"><stop stop-color="#e7dcd1"/><stop offset="1" stop-color="#f2e9df"/></linearGradient>
  <radialGradient id="bell-inside"><stop stop-color="#57432a"/><stop offset=".76" stop-color="#977340"/><stop offset="1" stop-color="#d2b17a"/></radialGradient>
  <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#d9dbd5"/></pattern>
  <filter id="shadow" x="-20%" width="140%" y="-50%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
<rect width="1100" height="420" fill="url(#grid)" opacity=".65"/>
<ellipse cx="740" cy="367" rx="290" ry="10" fill="#81704e" opacity=".09" filter="url(#shadow)"/>
${headMarkup}
<circle cx="278" cy="204" r="12" fill="none" stroke="#b99350" stroke-width="1" stroke-dasharray="3 3"/>
<!-- Casings sit behind the cutaway tubes so they cannot hide a connection. -->
${[604, 638, 672].map((x, i) => `<g class="piston" id="piston-${i}">
  <rect x="${x - 14}" y="189" width="28" height="122" rx="8" fill="url(#brass)" stroke="#9d7a42"/>
  <path d="M${x - 8} 198 V300" stroke="#f6e5be" stroke-width="2"/>
  <rect x="${x - 17}" y="302" width="34" height="10" rx="4" fill="url(#brass)" stroke="#9d7a42"/>
  <g class="valve-stem"><rect x="${x - 3}" y="163" width="6" height="28" rx="2" fill="#b8b4a5" stroke="#8a887b"/><rect x="${x - 17}" y="155" width="34" height="10" rx="5" fill="#eee8d6" stroke="#9a9381"/><text x="${x}" y="149" text-anchor="middle" font-size="13" fill="#626d5e">${i + 1}</text></g>
</g>`).join('')}
<!-- One connected open bore; every slide returns to its own valve's second port. -->
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
${tubePaths.map((d, i) => `<path ${i ? '' : 'data-main-tube'} d="${d}" stroke="#99733a" stroke-width="16"/><path ${i ? '' : 'data-main-tube'} d="${d}" stroke="url(#tube-brass)" stroke-width="12"/>`).join('')}
</g>
<!-- Mouthpiece seals against the lips; the receiver meets the leadpipe. -->
<path d="M280 192 Q300 197 310 200 H332 V208 H310 Q299 211 280 216Z" fill="url(#brass)" stroke="#99733a"/>
<rect x="279" y="191" width="6" height="26" rx="3" fill="#eee2bf" stroke="#a88a54"/>
<rect x="330" y="198" width="37" height="12" rx="3" fill="url(#brass)" stroke="#99733a"/>
<!-- The silhouette and the acoustic solver use the same bell-radius function. -->
<path id="bell-contour" d="${bellShape}" fill="url(#bell)" stroke="#a4834e" stroke-width="1.5"/>
<path d="${bellTop.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${(y + 2).toFixed(2)}`).join(' ')}" fill="none" stroke="#fff0ce" stroke-width="2" opacity=".75"/>
<ellipse cx="1032" cy="178" rx="20" ry="75" fill="url(#bell-inside)" stroke="#d8bb83" stroke-width="4"/>
<ellipse cx="1032" cy="178" rx="14" ry="65" fill="none" stroke="#6d552e" opacity=".45"/>
<!-- Teal is the continuous acoustic route, not an extra physical tube. -->
<path id="trumpet-air-path" d="${trumpetAirPath()}" fill="none" stroke="#387c72" stroke-width="2.5" stroke-dasharray="6 5" stroke-linejoin="round" stroke-linecap="round"/>
<path id="water-key" d="M873 277 V290 Q872 298 886 295" fill="none" stroke="#99733a" stroke-width="3"/>
<g class="scene-labels" fill="#626d5e" font-family="monospace" font-size="10" letter-spacing="1">
<text x="27" y="33">01 / THE PLAYER</text><text x="795" y="33">03 / THE RESONATOR</text>
<path d="M216 194 L310 114 H360 M281 218 L317 352 H375 M996 141 L938 70 H1020 M886 282 V327 H963" fill="none" stroke="#bac0b4" stroke-width="1"/>
<circle cx="216" cy="194" r="2"/><circle cx="281" cy="218" r="2"/><circle cx="996" cy="141" r="2"/>
<text x="312" y="105">VOCAL TRACT</text><text x="327" y="371">02 / LIP VALVE</text><text x="883" y="61">B♭ / Ø127 mm BELL</text>
<text x="390" y="229">LEADPIPE →</text><text x="798" y="345">MAIN TUNING SLIDE</text>
<text x="34" y="409" font-size="9" letter-spacing=".5">CHIMERA HEAD · YAMAHA B♭ REFERENCE · NOT TO SCALE</text>
</g>
</svg>`;
