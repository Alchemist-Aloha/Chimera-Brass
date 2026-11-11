# Chimera Vocal Synth reuse

- Upstream: https://github.com/jamesondh/chimera-vocal-synth
- Revision: `6259e880f5d0108b862e98cefd930aa8c5bc0dc5`
- License: MIT, © 2026 Jameson Hodge; see `LICENSE` and the production copy at `public/licenses/chimera-MIT.txt`.

Unmodified reference snapshots:

| Local snapshot | Upstream file |
| --- | --- |
| `human.original.rs` | `crates/chimera/src/anatomy/human.rs` |
| `articulators.original.rs` | `crates/chimera/src/control/articulators.rs` |
| `profile.original.ts` | `src/ui/render/profile.ts` |
| `geom.original.ts` | `src/ui/render/geom.ts` |

## Adaptation

`scripts/import-chimera.js` runs the pinned upstream Rust `HumanVocalTract` with `scripts/chimera-export.rs`, then upstream TypeScript `buildProfile`. It exports 21 adult male tongue postures (44 arc-length samples each), the head profile and internal outlines. The jaw is fixed at 0.45, velum closed, and the oral opening is 0.4 cm behind the separately modelled brass embouchure. The tongue control traces a restricted open-to-arched path, not the full speech articulator space. Areas retain Chimera's semipolar `A = α d^β` mapping. Below the first pharyngeal cross-section, a uniform 2.4 cm lower-larynx extension uses that section's area; Chimera's separate `epilarynx_area` profile is not imported. This remains a generic laryngeal impedance assumption.

- `src/dsp/chimera-tract.json`: cross-sectional areas, cm².
- `src/ui/chimera-head.json`: midsagittal outlines and matching cross-sections, cm.
- `src/dsp/tract.js`: interpolation of areas, resampling and SI-unit circular-equivalent radii. The requested 13–21 cm acoustic length is independent of the schematic's display scale.
- `src/ui/head.js`: SVG translation of the head/profile components, matched to the trumpet mouthpiece, with interpolated tongue/airway contours and pressure-coloured sections. Palette is adapted to Brasswind; gaze animation is omitted.
- `src/dsp/articulator.js`: Chimera's critically damped muscle equation, integrated analytically rather than by semi-implicit Euler. Tongue uses 12 Hz and lip aperture uses 11 Hz, updated at 1 kHz. Natural lip frequency retains a separate 10.4 ms tension response; using the speech-aperture muscle for tension selected wrong harmonic slots in sequence tests.

This replaces the old Pink Trombone diameter shape and hand-drawn head, but retains the existing pressure-wave acoustic solver and trumpet. It does **not** import Chimera's prescribed-pitch glottal source, Rust/WASM runtime, FDTD airway network, nasal branch or animal LipReed. The quasi-static area updates omit moving-wall flow; the picture is a generic 2-D anatomical model, not a scan or a 3-D mesh.

To regenerate (optional; checked-in assets need no Rust at runtime):

```sh
node scripts/import-chimera.js /path/to/chimera-at-the-pinned-revision
```

Requires modern Node with TypeScript stripping, Cargo and network access for Rust dependencies. The script checks the revision and validates positive finite areas. The normal Vite build uses only checked-in assets.
