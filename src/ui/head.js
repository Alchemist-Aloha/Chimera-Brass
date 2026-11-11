// Midsagittal artwork and cross-sections derived from Chimera's MIT human/profile components.
import head from './chimera-head.json' with { type: 'json' };

function posturePair(tongue) {
  const x = Math.max(0, Math.min(1, tongue)) * (head.postures.length - 1);
  const i = Math.min(head.postures.length - 2, Math.floor(x));
  return [head.postures[i], head.postures[i + 1], x - i];
}

const lip = { x: (head.frame.upperLip[6].x + head.frame.lowerLip[6].x) / 2,
  y: (head.frame.upperLip[6].y + head.frame.lowerLip[6].y) / 2 };
const scale = 11;
const path = (points, close = false) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x ?? p[0]} ${p.y ?? p[1]}`).join(' ') + (close ? 'Z' : '');
const shape = (points, fill, stroke, close = false, id = '') => `<path ${id ? `id="${id}"` : ''} d="${path(points, close)}" fill="${fill}" stroke="${stroke}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
const p = head.profile, f = head.frame;
// Midsagittal cut colouring: soft tissue, bone, brain, airway air and muscle are distinguishable.
const skin = [...p.skinLower, ...p.skinUpper];
export const headMarkup = `<g id="chimera-head" transform="matrix(${scale} 0 0 ${-scale} ${279 - lip.x * scale} ${204 + lip.y * scale})">
  <path d="${path(skin, true)}" fill="#000" opacity=".35" transform="translate(-.35 -.45)" filter="url(#soft)"/>
  ${shape(skin, 'url(#skin)', '#8f604b', true)}
  <path d="${path(skin, true)}" fill="none" stroke="#f6d8c6" stroke-width="1" opacity=".55" vector-effect="non-scaling-stroke" transform="translate(-.06 -.06)"/>
  ${shape(p.skull, 'url(#bone)', '#c4ae86', true)}
  ${shape(p.brain, 'url(#brain)', '#ae9095', true)}
  ${shape(p.sulcus, 'none', '#a7878d')}
  ${shape(p.eye, '#f6f2ea', '#b49b8a', true)}
  ${shape(p.inset, 'none', '#c99f8b')}
  ${p.vertebrae.map(v => shape(v, 'url(#bone)', '#b49d73', true)).join('')}
  ${shape(p.nasal, '#2c3b37', '#7e958b', true)}
  ${p.turbinates.map(v => shape(v, '#cf9a8c', '#a87163', true)).join('')}
  ${shape(p.palOral, 'none', '#b38a74')}
  ${shape(p.palNasal, 'none', '#b38a74')}
  <path id="tract-air" fill="#24413b" fill-opacity=".9" stroke="#5aa294" stroke-width=".8" vector-effect="non-scaling-stroke"/>
  <g id="head-sections" stroke="#438b7f" stroke-width=".6" vector-effect="non-scaling-stroke">${Array.from({length:44}, () => '<path vector-effect="non-scaling-stroke"/>').join('')}</g>
  <path id="tract-outline" fill="none" stroke="#4b8a7e" stroke-width=".7" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>
  <path id="tongue-shape" fill="url(#muscle)" stroke="#8e4239" stroke-width="1" vector-effect="non-scaling-stroke"/>
  <path id="tongue-contact" fill="none" stroke="#a56d30" stroke-width="2" vector-effect="non-scaling-stroke"/>
  ${shape(p.jawLower, 'none', '#b49d73')}
  ${shape(p.jawUpper, 'none', '#b49d73')}
  ${shape(f.upperTeeth, '#fffdf3', '#b4a68a', true)}
  ${shape(p.lowerTeeth, '#fffdf3', '#b4a68a', true)}
  ${shape(f.velum, 'none', '#a45a50')}
  ${shape(f.epiglottis, '#d68c80', '#a8655a')}
  ${shape(p.hyoid, 'url(#bone)', '#b49d73', true)}
  ${shape(p.thyroid, 'none', '#b49d73')}
  ${p.trachea.map(v => shape(v, 'none', '#7e958b')).join('')}
  ${p.rings.map(v => shape(v, 'none', '#c4ae86')).join('')}
  ${p.folds.map(v => shape(v, '#c4776a', '#94544a', true)).join('')}
  ${shape(f.upperLip, 'url(#lip)', '#8e4239')}
  ${shape(f.lowerLip, 'url(#lip)', '#8e4239')}
</g>`;

export function drawHead(tongue, pressures = [], articulation = { fraction: 0.9, openness: 1 }) {
  const [a, b, t] = posturePair(tongue);
  const mix = (a, b) => a.map((p, i) => p.map((x, j) => x + t * (b[i][j] - x)));
  const grid = mix(a.grid, b.grid);
  const g = grid[Math.round(articulation.fraction * 43)], contact = document.getElementById('tongue-contact');
  contact.setAttribute('d', `M${g[0]} ${g[1]}L${g[2]} ${g[3]}`);
  contact.setAttribute('opacity', String(0.2 + 0.8 * (1 - articulation.openness)));
  document.getElementById('tongue-shape').setAttribute('d', path(mix(a.tongue, b.tongue), true));
  document.getElementById('tract-air').setAttribute('d', path([...grid.map(g => g.slice(0, 2)), ...grid.map(g => g.slice(2, 4)).reverse()], true));
  document.getElementById('tract-outline').setAttribute('d', path(grid.map(g => [(g[0] + g[2]) / 2, (g[1] + g[3]) / 2])));
  document.querySelectorAll('#head-sections path').forEach((line, i) => {
    const g = grid[i]; line.setAttribute('d', `M${g[0]} ${g[1]}L${g[2]} ${g[3]}`);
    const pressure = pressures[Math.round(i * (pressures.length - 1) / 43)] || 0;
    line.setAttribute('stroke', pressure < 0 ? '#438b7f' : '#ac8039');
    line.setAttribute('opacity', String(0.15 + 0.75 * Math.min(1, Math.abs(pressure) / 3000)));
  });
}
