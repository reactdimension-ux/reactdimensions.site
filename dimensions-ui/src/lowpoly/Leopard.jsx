import { Stage } from './kit.jsx'
import { MEADOW, SAVANNA, SNOW, Quadruped } from './quadruped.jsx'

// A low-poly leopard, built like the Low Poly Bear but leaner: a golden body
// scattered with dark spots, a pale muzzle with whiskers, amber eyes and a
// long curling tail, on a patch of savanna. It breathes, sniffs, looks about
// and swings its tail; tap it and it crouches, pounces, lands and pads back.

const SPEC = {
  S: 4.3,
  body: { y: 0.17, r: [0.1, 0.09, 0.21] },
  leg: { h: 0.155, r: [0.024, 0.02], x: 0.058, z: 0.125 },
  head: { pivot: [0, 0.22, 0.19], off: [0, 0, 0.045], r: [0.068, 0.064, 0.07] },
  muzzle: { off: [0, -0.022, 0.1], r: [0.034, 0.026, 0.034] },
  jaw: { off: [0, -0.036, 0.085], len: 0.024 },
  nose: { off: [0, -0.008, 0.132], r: 0.011 },
  eyes: { x: 0.03, y: 0.018, z: 0.095, r: 0.0095 },
  ears: { kind: 'round', x: 0.05, y: 0.058, z: 0.025, size: 0.018 },
  tail: { len: 0.32, r: [0.014, 0.009], droop: -0.55, curl: 1.15, segs: 8 },
  pattern: 'spots',
  spots: 40,
  spotSize: 0.016,
  whiskers: true,
  action: 'pounce',
  leap: 0.55,
}

const LOOKS = {
  leopard: { fur: '#e2b464', legs: '#d8a85a', muzzle: '#f4ead8', belly: '#f4ead8', mark: '#2a2018', eye: '#c8b040', nose: '#b87060', ...SAVANNA },
  snow: { fur: '#e6e4de', legs: '#d8d6d0', muzzle: '#f6f4f0', belly: '#f6f4f0', mark: '#5a5a60', eye: '#9ac4c0', nose: '#a88080', ...SNOW },
  jaguar: { fur: '#d8963e', legs: '#cc8a34', muzzle: '#f2e4cc', belly: '#f2e4cc', mark: '#1e1612', eye: '#d8b030', nose: '#a86858', ...MEADOW },
  black: { fur: '#1f1d22', legs: '#1a181c', muzzle: '#2a272c', mark: '#2e2c33', eye: '#e0c040', nose: '#2a2628', whisker: '#bdbdbd', ...MEADOW },
}

export function Leopard({ look = 'leopard' }) {
  return <Quadruped spec={SPEC} look={LOOKS[look] || LOOKS.leopard} />
}

export default function LeopardScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[4.3, 2.6, 5.3]} target={[0, 0.9, 0]} hint="The leopard breathes, sniffs, looks about and swings its long tail · tap it and it crouches, pounces, lands and pads back · Look swaps leopard, snow leopard, jaguar and black panther · drag to orbit">
      <Leopard {...props} />
    </Stage>
  )
}
