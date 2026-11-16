import { Stage } from './kit.jsx'
import { MEADOW, SAVANNA, Quadruped } from './quadruped.jsx'

// A low-poly lion, built like the Low Poly Bear: a tawny body on four stubby
// legs, a big shaggy mane round its head and a tufted tail, on a patch of
// savanna. It breathes, sniffs, looks about and swings its tail; tap it and it
// throws its head back and roars, mane puffed out.

const SPEC = {
  S: 4.3,
  body: { y: 0.19, r: [0.12, 0.11, 0.21] },
  leg: { h: 0.17, r: [0.03, 0.025], x: 0.068, z: 0.12 },
  head: { pivot: [0, 0.25, 0.19], off: [0, 0, 0.05], r: [0.078, 0.074, 0.08] },
  muzzle: { off: [0, -0.025, 0.125], r: [0.04, 0.032, 0.042] },
  jaw: { off: [0, -0.045, 0.1], len: 0.03 },
  nose: { off: [0, -0.008, 0.165], r: 0.013 },
  eyes: { x: 0.033, y: 0.02, z: 0.115, r: 0.01 },
  ears: { kind: 'round', x: 0.06, y: 0.068, z: 0.03, size: 0.022 },
  tail: { len: 0.26, r: [0.016, 0.009], droop: -0.7, curl: 1.0, tuft: true },
  mane: true,
  action: 'roar',
}

const LOOKS = {
  classic: { fur: '#d9a45a', legs: '#c4904a', muzzle: '#f0d8ae', belly: '#e8c48a', mane: '#8a4e22', mane2: '#a3612c', nose: '#4a2a22', ...SAVANNA },
  golden: { fur: '#e8bd6a', legs: '#d4a456', muzzle: '#f6e2b8', belly: '#f2d498', mane: '#b8702e', mane2: '#cc8a3a', nose: '#5a3424', ...SAVANNA },
  white: { fur: '#efe7d6', legs: '#e0d6c2', muzzle: '#f8f2e6', belly: '#f6f0e4', mane: '#d8c8a6', mane2: '#e6d8ba', nose: '#8a6a5a', ...MEADOW },
  dark: { fur: '#c99550', legs: '#b28044', muzzle: '#ecd2a6', belly: '#dcb47a', mane: '#3a2418', mane2: '#52321e', nose: '#3a2220', ...SAVANNA },
}

export function Lion({ look = 'classic' }) {
  return <Quadruped spec={SPEC} look={LOOKS[look] || LOOKS.classic} />
}

export default function LionScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[4.4, 2.7, 5.4]} target={[0, 0.95, 0]} hint="The lion breathes, sniffs, looks about and swings its tufted tail · tap it and it throws its head back and roars · Look swaps classic, golden, white and dark-maned · drag to orbit">
      <Lion {...props} />
    </Stage>
  )
}
