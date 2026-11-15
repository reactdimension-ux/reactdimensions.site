import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, TAU, beat, facet, useGeo, useTap } from './kit.jsx'

// Low-poly over-ear headphones standing on their band: a padded headband,
// sliders, yokes, big ear cups with cushions and a graphic equaliser on each
// cup, and a coiled-looking cable running to a jack on the floor. Everything
// keys off one beat clock: the cups pump, the band bounces, the EQ bars jump
// to a made-up spectrum and notes drift up. Tap it and the beat doubles for
// a few bars and notes burst out.

const LOOKS = {
  black: { shell: '#2c2a33', pad: '#1f1e24', band: '#3a3846', accent: '#e3393f', bars: ['#e3393f', '#f28c38', '#f6c93a'] },
  white: { shell: '#f4f6fa', pad: '#d8dce4', band: '#c9ced8', accent: '#3d7fe0', bars: ['#3d7fe0', '#5ac7a6', '#8350c8'] },
  mint: { shell: '#9fe0c8', pad: '#f4f1ea', band: '#f4f1ea', accent: '#f27aa6', bars: ['#f27aa6', '#f6c93a', '#ffffff'] },
  red: { shell: '#d8383f', pad: '#2c2a33', band: '#2c2a33', accent: '#f6c93a', bars: ['#f6c93a', '#ffffff', '#f28c38'] },
}
const CUP_X = 0.36
const CUP_Y = 0.27
const BARS = 5

function noteGeo() {
  const head = new THREE.Shape()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    const x = Math.cos(a) * 0.055
    const y = Math.sin(a) * 0.04
    i ? head.lineTo(x, y) : head.moveTo(x, y)
  }
  const stem = new THREE.Shape()
  stem.moveTo(0.04, 0)
  stem.lineTo(0.055, 0)
  stem.lineTo(0.055, 0.2)
  stem.lineTo(0.04, 0.2)
  const flag = new THREE.Shape()
  flag.moveTo(0.055, 0.2)
  flag.lineTo(0.11, 0.14)
  flag.lineTo(0.1, 0.12)
  flag.lineTo(0.055, 0.16)
  return new THREE.ExtrudeGeometry([head, stem, flag], { depth: 0.02, bevelEnabled: false }).center()
}

export function Headphones({ look = 'black', bpm = 104 }) {
  const C = LOOKS[look] || LOOKS.black
  const { tap, handlers, clock } = useTap(0.3)
  const rig = useRef()
  const cups = useRef([])
  const bars = useRef([])

  const geo = useGeo(
    () => ({
      band: new THREE.TorusGeometry(0.42, 0.035, 4, 16, Math.PI).scale(1, 1.05, 1.6),
      padTop: new THREE.TorusGeometry(0.38, 0.03, 4, 12, Math.PI * 0.55).rotateZ(Math.PI * 0.225),
      slider: new THREE.BoxGeometry(0.03, 0.16, 0.05),
      yoke: new THREE.TorusGeometry(0.17, 0.018, 4, 10, Math.PI).rotateZ(Math.PI).rotateY(Math.PI / 2),
      cup: facet(new THREE.CylinderGeometry(0.17, 0.18, 0.11, 10, 1).rotateZ(Math.PI / 2), 0.004, 1),
      plate: new THREE.CylinderGeometry(0.13, 0.13, 0.012, 10, 1).rotateZ(Math.PI / 2),
      cushion: new THREE.TorusGeometry(0.13, 0.045, 4, 10).rotateY(Math.PI / 2),
      bar: new THREE.BoxGeometry(0.01, 1, 0.025).translate(0, 0.5, 0),
      jack: new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6, 1).rotateZ(Math.PI / 2),
      tip: new THREE.CylinderGeometry(0.008, 0.008, 0.06, 5, 1).rotateZ(Math.PI / 2),
      note: noteGeo(),
    }),
    [],
  )
  // the cable: from the bottom of the left cup down and across to a jack
  const cable = useGeo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-CUP_X - 0.06, CUP_Y - 0.17, 0),
      new THREE.Vector3(-CUP_X - 0.1, 0.06, 0.12),
      new THREE.Vector3(-0.3, 0.02, 0.45),
      new THREE.Vector3(0.1, 0.02, 0.55),
      new THREE.Vector3(0.38, 0.02, 0.42),
    ])
    return new THREE.TubeGeometry(curve, 30, 0.012, 4, false)
  }, [])
  const notes = () => (tap.since(clock.elapsedTime) < 4 ? 1 : 0.4)

  useFrame(() => {
    const t = clock.elapsedTime
    const fast = tap.since(t) < 4
    const B = beat(t, fast ? bpm * 2 : bpm)
    rig.current.position.y = B.k * 0.025
    rig.current.scale.set(1 + B.k * 0.015, 1 - B.k * 0.02, 1 + B.k * 0.015)
    cups.current.forEach((c) => c && c.scale.setScalar(1 + B.k * 0.07))
    // a made-up spectrum: lows on the beat, highs on the off-beat, a little noise
    bars.current.forEach((b, i) => {
      if (!b) return
      const band = i % BARS
      const lows = B.k * (1 - band / BARS)
      const highs = Math.exp(-Math.abs(B.f - 0.5) * 8) * (band / BARS)
      const noise = 0.5 + 0.5 * Math.sin(t * (7 + band * 3.1) + i)
      b.scale.y = 0.02 + 0.13 * Math.min(1, lows * 1.2 + highs * 0.9 + noise * 0.25)
    })
  })

  return (
    <group {...handlers}>
      <mesh geometry={cable}>
        <Flat color={C.band} />
      </mesh>
      <group position={[0.42, 0.02, 0.4]} rotation-y={0.4}>
        <mesh geometry={geo.jack}>
          <Flat color={C.shell} />
        </mesh>
        <mesh geometry={geo.tip} position-x={0.09}>
          <Flat color="#c9ced8" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      <group ref={rig}>
        <mesh geometry={geo.band} position-y={CUP_Y + 0.28}>
          <Flat color={C.band} />
        </mesh>
        <mesh geometry={geo.padTop} position-y={CUP_Y + 0.29}>
          <Flat color={C.pad} />
        </mesh>
        {[-1, 1].map((s, i) => (
          <group key={s} position={[s * CUP_X, CUP_Y, 0]}>
            <mesh geometry={geo.slider} position={[s * 0.06, 0.25, 0]}>
              <Flat color="#c9ced8" metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh geometry={geo.yoke} position={[s * 0.02, 0.0, 0]}>
              <Flat color={C.shell} />
            </mesh>
            <group ref={(el) => (cups.current[i] = el)}>
              <mesh geometry={geo.cup}>
                <Flat color={C.shell} />
              </mesh>
              <mesh geometry={geo.cushion} position-x={-s * 0.07}>
                <Flat color={C.pad} />
              </mesh>
              <mesh geometry={geo.plate} position-x={s * 0.058}>
                <Flat color={C.accent} />
              </mesh>
              {Array.from({ length: BARS }, (_, k) => (
                <mesh key={k} ref={(el) => (bars.current[i * BARS + k] = el)} geometry={geo.bar} position={[s * 0.066, -0.07, (k - (BARS - 1) / 2) * 0.04]}>
                  <Flat color={C.bars[k % C.bars.length]} emissive={C.bars[k % C.bars.length]} emissiveIntensity={0.5} />
                </mesh>
              ))}
            </group>
          </group>
        ))}
      </group>

      <Particles geometry={geo.note} count={8} life={3} origin={[0, CUP_Y + 0.2, 0]} spread={0.4} velocity={[0, 0.35, 0.05]} scatter={0.06} drift={0.15} size={[0.9, 0.6]} colors={C.bars} opacity={[1, 0]} emissive={0.4} spin={0.6} active={notes} />
      <Burst tap={tap} geometry={geo.note} count={10} colors={C.bars} speed={1.6} gravity={0.8} size={1} life={1.6} origin={[0, CUP_Y + 0.3, 0]} up={1.2} />
    </group>
  )
}

export default function HeadphonesScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.4, 1.5, 3.2]} target={[0, 0.35, 0]} hint="One beat clock drives it all: the cups pump, the band bounces, the EQ bars jump and notes drift up · tap it and the beat doubles for a few bars · Bpm sets the tempo · Look swaps black, white, mint and red · drag to orbit">
      <Headphones {...props} />
    </Stage>
  )
}
