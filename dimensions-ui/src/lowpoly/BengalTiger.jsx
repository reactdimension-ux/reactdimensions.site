import { Stage } from './kit.jsx'
import { MEADOW, SAVANNA, SNOW, Quadruped } from './quadruped.jsx'

// A low-poly Bengal tiger, built like the Low Poly Bear: an orange body
// wrapped in black stripes, a white muzzle with whiskers and a long striped
// tail, on a meadow. It breathes, sniffs, looks about and swings its tail; tap
// it and it crouches, pounces forward with its legs out, lands with a thud and
// pads back.

const SPEC = {
  S: 4.3,
  body: { y: 0.18, r: [0.115, 0.1, 0.22] },
  leg: { h: 0.16, r: [0.028, 0.024], x: 0.065, z: 0.13 },
  head: { pivot: [0, 0.23, 0.2], off: [0, 0, 0.05], r: [0.08, 0.072, 0.078] },
  muzzle: { off: [0, -0.022, 0.115], r: [0.042, 0.03, 0.04] },
  jaw: { off: [0, -0.04, 0.095], len: 0.028 },
  nose: { off: [0, -0.006, 0.152], r: 0.012 },
  eyes: { x: 0.034, y: 0.02, z: 0.108, r: 0.01 },
  ears: { kind: 'round', x: 0.06, y: 0.062, z: 0.03, size: 0.02 },
  tail: { len: 0.3, r: [0.016, 0.009], droop: -0.5, curl: 1.1, striped: true, segs: 8 },
  pattern: 'stripes',
  stripes: 8,
  stripeW: 0.011,
  whiskers: true,
  action: 'pounce',
  leap: 0.6,
}

const LOOKS = {
  orange: { fur: '#e8862a', legs: '#e07a22', muzzle: '#f6eee2', belly: '#f4ece0', mark: '#1d1a1a', earIn: '#f4ece0', nose: '#c8706e', ...MEADOW },
  white: { fur: '#f0ebe2', legs: '#e8e2d8', muzzle: '#fbf8f2', belly: '#fbf8f2', mark: '#3a3436', earIn: '#fbf8f2', nose: '#d88a8a', eye: '#5fa8e0', ...SNOW },
  golden: { fur: '#f2c06a', legs: '#e8b45e', muzzle: '#fbf2e2', belly: '#fbf2e2', mark: '#c07a32', earIn: '#fbf2e2', nose: '#d88a7a', ...SAVANNA },
  siberian: { fur: '#d98e4e', legs: '#cf8444', muzzle: '#f6f2ea', belly: '#f6f2ea', mark: '#2a2220', earIn: '#f6f2ea', nose: '#c8706e', ...SNOW },
}

export function BengalTiger({ look = 'orange' }) {
  return <Quadruped spec={SPEC} look={LOOKS[look] || LOOKS.orange} />
}

export default function BengalTigerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[4.4, 2.7, 5.4]} target={[0, 0.95, 0]} hint="The tiger breathes, sniffs, looks about and swings its striped tail · tap it and it crouches, pounces, lands and pads back · Look swaps orange, white, golden and Siberian · drag to orbit">
      <BengalTiger {...props} />
    </Stage>
  )
}
