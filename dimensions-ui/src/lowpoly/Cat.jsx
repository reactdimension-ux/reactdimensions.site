import { Stage } from './kit.jsx'
import { MEADOW, Quadruped } from './quadruped.jsx'

// A low-poly cat, built like the Low Poly Bear but small and slender: pointed
// ears, green or golden eyes with slit pupils, whiskers and a long tail
// curving up, on a meadow. It breathes, sniffs, looks about and swishes its
// tail; tap it and it arches its back, fur up and tail straight in the air,
// ears flat, and hisses.

const SPEC = {
  S: 4.6,
  body: { y: 0.145, r: [0.075, 0.072, 0.14] },
  leg: { h: 0.13, r: [0.018, 0.016], x: 0.045, z: 0.09 },
  head: { pivot: [0, 0.2, 0.125], off: [0, 0, 0.04], r: [0.062, 0.058, 0.058] },
  muzzle: { off: [0, -0.018, 0.088], r: [0.024, 0.018, 0.02] },
  jaw: { off: [0, -0.03, 0.075], len: 0.016 },
  nose: { off: [0, -0.008, 0.104], r: 0.008 },
  eyes: { x: 0.026, y: 0.012, z: 0.083, r: 0.011 },
  slit: true,
  ears: { kind: 'point', x: 0.038, y: 0.045, z: 0.015, size: 0.022 },
  tail: { len: 0.28, r: [0.011, 0.007], droop: 0.35, curl: 0.9, segs: 8, amp: 0.3 },
  stripes: 6,
  stripeW: 0.009,
  whiskers: true,
  action: 'arch',
}

const LOOKS = {
  ginger: { fur: '#e08a3a', legs: '#d87e30', muzzle: '#f6e8d6', belly: '#f6e8d6', mark: '#b8601e', pattern: 'stripes', eye: '#9ac43a', earIn: '#f0b8a8', nose: '#e88a8a', ...MEADOW },
  black: { fur: '#25222a', legs: '#201e24', muzzle: '#2c2930', eye: '#e0c040', earIn: '#3a3238', nose: '#3a3036', whisker: '#d8d8d8', ...MEADOW },
  tabby: { fur: '#8a8a90', legs: '#808086', muzzle: '#e8e6e2', belly: '#e8e6e2', mark: '#4a4a52', pattern: 'stripes', eye: '#a8c43a', earIn: '#e8b0a8', nose: '#d88a8a', ...MEADOW },
  calico: { fur: '#f4f0e8', legs: '#f0ece4', muzzle: '#f8f6f2', pattern: 'patches', marks: ['#e08a3a', '#2a2628'], eye: '#c8a83a', earIn: '#f0b8a8', nose: '#e88a8a', ...MEADOW },
}

export function Cat({ look = 'ginger' }) {
  return <Quadruped spec={SPEC} look={LOOKS[look] || LOOKS.ginger} />
}

export default function CatScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.2, 4.4]} target={[0, 0.7, 0]} hint="The cat breathes, sniffs, looks about and swishes its tail · tap it and it arches its back, fur up, and hisses · Look swaps ginger, black, tabby and calico · drag to orbit">
      <Cat {...props} />
    </Stage>
  )
}
