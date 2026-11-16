import { Stage } from './kit.jsx'
import { MEADOW, SNOW, Quadruped } from './quadruped.jsx'

// A low-poly dog, built like the Low Poly Bear: a sturdy body on four legs,
// floppy ears, a longer snout and a waggy tail, on a meadow. It breathes,
// sniffs, looks about and wags; tap it and it bounces up in two happy hops,
// spinning on the second, barking, tail going.

const SPEC = {
  S: 4.3,
  body: { y: 0.17, r: [0.095, 0.09, 0.165] },
  leg: { h: 0.16, r: [0.025, 0.022], x: 0.055, z: 0.1 },
  head: { pivot: [0, 0.25, 0.15], off: [0, 0, 0.05], r: [0.072, 0.068, 0.072] },
  muzzle: { off: [0, -0.03, 0.125], r: [0.034, 0.03, 0.06] },
  jaw: { off: [0, -0.05, 0.1], len: 0.04 },
  nose: { off: [0, -0.012, 0.185], r: 0.016 },
  eyes: { x: 0.033, y: 0.02, z: 0.108, r: 0.011 },
  ears: { kind: 'floppy', x: 0.06, y: 0.04, z: 0.03, size: 0.03 },
  tail: { len: 0.13, r: [0.016, 0.01], droop: 0.9, curl: 0.3, rate: 2.2, amp: 0.5, kickAmp: 0.8, segs: 5 },
  spots: 22,
  spotSize: 0.02,
  seed: 3,
  action: 'hop',
}

const LOOKS = {
  golden: { fur: '#d9a35a', legs: '#cc9650', muzzle: '#e8c088', ear: '#b8823e', nose: '#2a201c', ...MEADOW },
  chocolate: { fur: '#6a4028', legs: '#5e3822', muzzle: '#8a5a3a', ear: '#4e2c1a', nose: '#2a1a14', ...MEADOW },
  dalmatian: { fur: '#f4f2ee', legs: '#ecebe6', muzzle: '#f8f6f2', ear: '#26222a', nose: '#1f1d22', pattern: 'spots', mark: '#1f1d22', ...MEADOW },
  husky: { fur: '#8a909a', legs: '#e8e8e6', muzzle: '#f2f2f0', belly: '#f0f0ee', ears: 'point', ear: '#7a808a', earIn: '#e8e8e6', eye: '#7ab8e8', nose: '#26222a', ...SNOW },
}

export function Dog({ look = 'golden' }) {
  return <Quadruped spec={SPEC} look={LOOKS[look] || LOOKS.golden} />
}

export default function DogScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[4.2, 2.6, 5.2]} target={[0, 0.9, 0]} hint="The dog breathes, sniffs, looks about and wags its tail · tap it and it bounces up in two happy hops, spinning and barking · Look swaps golden, chocolate, dalmatian and husky · drag to orbit">
      <Dog {...props} />
    </Stage>
  )
}
