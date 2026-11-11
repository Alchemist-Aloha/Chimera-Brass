// Shared metalwork for the instrument drawings: round tubes, plating gradients, mouthpiece.
const METALS = {
  // edge, body, sheen, highlight
  brass: ['#5f4219', '#b88d48', '#dcb875', '#fff3d4'],
  nickel: ['#4f5554', '#9fa6a4', '#cdd3d0', '#ffffff'],
};

// Concentric strokes read as a cylinder in any direction; the offset streak is the key light.
export function tube(d, width, { metal = 'brass', attrs = '' } = {}) {
  const [edge, body, sheen, light] = METALS[metal];
  return `<path ${attrs} d="${d}" stroke="${edge}" stroke-width="${width + 3}"/>
  <path ${attrs} d="${d}" stroke="${body}" stroke-width="${width}"/>
  <path ${attrs} d="${d}" stroke="${sheen}" stroke-width="${(width * 0.55).toFixed(1)}" transform="translate(0 ${(-width * 0.12).toFixed(2)})"/>
  <path ${attrs} d="${d}" stroke="${light}" stroke-width="${Math.max(1.1, width * 0.16).toFixed(1)}" opacity=".75" transform="translate(0 ${(-width * 0.24).toFixed(2)})"/>`;
}

// Silver-plated mouthpiece: rim, cup and tapering shank into the receiver.
export function mouthpiece(y = 204, shank = 333) {
  return `<g class="mouthpiece">
  <path d="M281 ${y - 13} C290 ${y - 13} 296 ${y - 9} 304 ${y - 5} L${shank} ${y - 3.5} V${y + 3.5} L304 ${y + 5} C296 ${y + 9} 290 ${y + 13} 281 ${y + 13}Z" fill="url(#silver)" stroke="#6f7372"/>
  <path d="M286 ${y - 10} C294 ${y - 9} 300 ${y - 5} 312 ${y - 3}" fill="none" stroke="#fff" stroke-width="1.2" opacity=".75"/>
  <rect x="278.5" y="${y - 14}" width="6" height="28" rx="3" fill="url(#silver)" stroke="#6f7372"/>
</g>`;
}

export const metalDefs = `
  <linearGradient id="brass" x1="0" y1="0" x2="0.1" y2="1"><stop stop-color="#7d5a26"/><stop offset=".22" stop-color="#efd39a"/><stop offset=".45" stop-color="#b8924f"/><stop offset=".65" stop-color="#f2dbab"/><stop offset="1" stop-color="#76541f"/></linearGradient>
  <linearGradient id="brass-v" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#7d5a26"/><stop offset=".35" stop-color="#f4dfb0"/><stop offset=".6" stop-color="#c49d5c"/><stop offset="1" stop-color="#7d5a26"/></linearGradient>
  <linearGradient id="nickel-v" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#5d6261"/><stop offset=".35" stop-color="#f2f5f3"/><stop offset=".6" stop-color="#aeb4b2"/><stop offset="1" stop-color="#5d6261"/></linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8d9291"/><stop offset=".25" stop-color="#ffffff"/><stop offset=".55" stop-color="#bfc4c2"/><stop offset=".8" stop-color="#e8ecea"/><stop offset="1" stop-color="#7b807f"/></linearGradient>
  <linearGradient id="casing" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#6e4f20"/><stop offset=".18" stop-color="#c79f5c"/><stop offset=".34" stop-color="#fbe9c1"/><stop offset=".5" stop-color="#d7b06c"/><stop offset=".82" stop-color="#9a733a"/><stop offset="1" stop-color="#5f4219"/></linearGradient>
  <linearGradient id="bell" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8d6a34"/><stop offset=".18" stop-color="#f7e4bf"/><stop offset=".36" stop-color="#d9b779"/><stop offset=".62" stop-color="#b48c4c"/><stop offset=".82" stop-color="#e7c88c"/><stop offset="1" stop-color="#6e4f20"/></linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff2cf"/><stop offset=".5" stop-color="#c79f5c"/><stop offset="1" stop-color="#8d6a34"/></linearGradient>
  <radialGradient id="bell-inside" cx=".35" cy=".5" r=".7"><stop stop-color="#2f2416"/><stop offset=".55" stop-color="#6e5330"/><stop offset=".85" stop-color="#b38d50"/><stop offset="1" stop-color="#e2c48b"/></radialGradient>
  <radialGradient id="pearl" cx=".4" cy=".35" r=".7"><stop stop-color="#ffffff"/><stop offset=".4" stop-color="#f3ece4"/><stop offset=".7" stop-color="#dfe3ee"/><stop offset="1" stop-color="#cdbfb4"/></radialGradient>`;
