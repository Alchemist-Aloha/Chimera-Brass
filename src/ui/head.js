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
export const headMarkup = `<g id="chimera-head" transform="matrix(${scale} 0 0 ${-scale} ${279 - lip.x * scale} ${204 + lip.y * scale})">
  ${shape([...p.skinLower, ...p.skinUpper], 'url(#skin)', '#b7afa0', true)}
  ${shape(p.skull, '#e5e2d7', '#c5c6b5', true)}
  ${shape(p.brain, '#e0ded2', '#c2c4b4', true)}
  ${shape(p.sulcus, 'none', '#c2c4b4')}
  ${shape(p.eye, '#f2f1e7', '#afb5a4', true)}
  ${shape(p.inset, 'none', '#d1c9ba')}
  ${p.vertebrae.map(v => shape(v, '#eae6d9', '#babfae', true)).join('')}
  ${shape(p.nasal, '#d4ded5', '#9eb8ab', true)}
  ${p.turbinates.map(v => shape(v, 'none', '#a7b9aa', true)).join('')}
  ${shape(p.palOral, 'none', '#aeb19e')}
  ${shape(p.palNasal, 'none', '#bbc0ac')}
  <path id="tract-air" fill="#77afa2" fill-opacity=".35" stroke="#468b84" stroke-width=".7" vector-effect="non-scaling-stroke"/>
  <g id="head-sections" stroke="#438b7f" stroke-width=".6" vector-effect="non-scaling-stroke">${Array.from({length:44}, () => '<path vector-effect="non-scaling-stroke"/>').join('')}</g>
  <path id="tract-outline" fill="none" stroke="#4b8a7e" stroke-width=".7" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>
  <path id="tongue-shape" fill="#cfa495" stroke="#af8475" stroke-width="1" vector-effect="non-scaling-stroke"/>
  <path id="tongue-contact" fill="none" stroke="#a56d30" stroke-width="2" vector-effect="non-scaling-stroke"/>
  ${shape(p.jawLower, 'none', '#a9aa96')}
  ${shape(p.jawUpper, 'none', '#bbc0ac')}
  ${shape(f.upperTeeth, '#fffef1', '#b9baa5', true)}
  ${shape(p.lowerTeeth, '#fffef1', '#b9baa5', true)}
  ${shape(f.velum, 'none', '#ac8776')}
  ${shape(f.epiglottis, '#d9b6a1', '#b59881')}
  ${shape(p.hyoid, '#efe9d4', '#b1b29d', true)}
  ${shape(p.thyroid, 'none', '#adae96')}
  ${p.trachea.map(v => shape(v, 'none', '#9eb8ab')).join('')}
  ${p.rings.map(v => shape(v, 'none', '#aeb8a1')).join('')}
  ${p.folds.map(v => shape(v, '#c6a28b', '#a38e73', true)).join('')}
  ${shape(f.upperLip, '#bd8d7e', '#a37968')}
  ${shape(f.lowerLip, '#bd8d7e', '#a37968')}
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
