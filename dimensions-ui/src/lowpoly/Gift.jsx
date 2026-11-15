import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Hinge, Stage, TAU, facet, squash, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly gift box: a faceted cube tied with crossing ribbons, a lid on a
// hinge at the back and a big bow with looped wings and tails. The bow
// bounces and now and then the box gives an excited hop. Tap it and the lid
// springs open, confetti bursts out and a glowing star rises, spins and
// sinks back as the lid shuts.

const WRAPS = {
  red: { box: '#d8383f', box2: '#c22f36', ribbon: '#f2c23a' },
  blue: { box: '#2f6fd0', box2: '#285fb4', ribbon: '#e9edf4' },
  green: { box: '#2f9a5a', box2: '#278550', ribbon: '#e3393f' },
  purple: { box: '#8350c8', box2: '#7243b0', ribbon: '#f2c23a' },
}
const B = 0.8 // box size
const BH = 0.62 // box height
const OPEN = 2.4 // seconds the lid stays open
const CONFETTI = ['#f2c23a', '#e3393f', '#2f6fd0', '#2f9a5a', '#f27aa6', '#ffffff']

function starGeo(r) {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2
    const k = i % 2 ? r * 0.45 : r
    i ? s.lineTo(Math.cos(a) * k, Math.sin(a) * k) : s.moveTo(Math.cos(a) * k, Math.sin(a) * k)
  }
  return new THREE.ExtrudeGeometry(s, { depth: r * 0.3, bevelEnabled: true, bevelThickness: r * 0.15, bevelSize: r * 0.1, bevelSegments: 1 }).center()
}

export function Gift({ wrap = 'red' }) {
  const W = WRAPS[wrap] || WRAPS.red
  const { tap, handlers, clock } = useTap(1.2)
  const box = useRef()
  const bow = useRef()
  const star = useRef()

  const geo = useGeo(
    () => ({
      body: facet(new THREE.BoxGeometry(B, BH, B), 0.01, 1),
      bandX: new THREE.BoxGeometry(B + 0.02, BH + 0.01, 0.14),
      bandZ: new THREE.BoxGeometry(0.14, BH + 0.01, B + 0.02),
      lid: facet(new THREE.BoxGeometry(B + 0.08, 0.16, B + 0.08), 0.008, 2),
      lidX: new THREE.BoxGeometry(B + 0.1, 0.17, 0.14),
      lidZ: new THREE.BoxGeometry(0.14, 0.17, B + 0.1),
      loop: new THREE.TorusGeometry(0.12, 0.045, 4, 8),
      knot: new THREE.OctahedronGeometry(0.06, 0),
      tail: new THREE.BoxGeometry(0.08, 0.2, 0.02).translate(0, -0.1, 0),
      star: starGeo(0.16),
      bit: new THREE.BoxGeometry(1, 1, 0.2),
      inside: new THREE.BoxGeometry(B - 0.06, 0.02, B - 0.06),
    }),
    [],
  )

  const isOpen = () => tap.since(clock.elapsedTime) < OPEN

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // an excited hop every few seconds while shut
    const ph = t % 4.2
    const hop = !isOpen() && ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI) * 0.08 : 0
    box.current.position.y = hop
    squash(box.current, ph < 0.5 && !isOpen() ? wobble(ph, 20, 6) * 0.06 : wobble(s, 16, 4) * 0.05)
    bow.current.scale.setScalar(1 + Math.sin(t * 3) * 0.06)
    bow.current.rotation.y = Math.sin(t * 1.4) * 0.15
    // the star rises out while the lid is open and sinks back before it shuts
    const u = s >= 0 && s < OPEN ? s / OPEN : -1
    const rise = u < 0 ? 0 : Math.sin(Math.min(1, u * 1.15) * Math.PI)
    star.current.visible = rise > 0.01
    star.current.position.y = BH - 0.1 + rise * 0.65
    star.current.rotation.y = t * 4
    star.current.scale.setScalar(Math.max(0.001, rise))
  })

  return (
    <group {...handlers}>
      <group ref={box}>
        <mesh geometry={geo.body} position-y={BH / 2}>
          <Flat color={W.box} />
        </mesh>
        <mesh geometry={geo.bandX} position-y={BH / 2}>
          <Flat color={W.ribbon} />
        </mesh>
        <mesh geometry={geo.bandZ} position-y={BH / 2}>
          <Flat color={W.ribbon} />
        </mesh>
        <mesh geometry={geo.inside} position-y={BH + 0.002}>
          <Flat color="#2a1d2a" />
        </mesh>

        {/* the lid, hinged along its back edge */}
        <Hinge open={isOpen} angle={-2} stiffness={110} damping={8} position={[0, BH, -(B + 0.08) / 2]}>
          <group position={[0, 0.07, (B + 0.08) / 2]}>
            <mesh geometry={geo.lid}>
              <Flat color={W.box2} />
            </mesh>
            <mesh geometry={geo.lidX}>
              <Flat color={W.ribbon} />
            </mesh>
            <mesh geometry={geo.lidZ}>
              <Flat color={W.ribbon} />
            </mesh>
            <group ref={bow} position-y={0.1}>
              <mesh geometry={geo.knot}>
                <Flat color={W.ribbon} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={geo.loop} position={[s * 0.12, 0.05, 0]} rotation={[0, s * 0.35, s * 0.5]} scale={[1, 0.75, 1]}>
                  <Flat color={W.ribbon} />
                </mesh>
              ))}
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={geo.tail} position={[s * 0.05, -0.01, 0.08]} rotation={[-1.2, 0, s * 0.5]}>
                  <Flat color={W.ribbon} />
                </mesh>
              ))}
            </group>
          </group>
        </Hinge>

        <mesh ref={star} geometry={geo.star} visible={false}>
          <Flat color="#ffd84a" emissive="#ffd84a" emissiveIntensity={0.7} roughness={0.4} />
        </mesh>
      </group>

      <Burst tap={tap} geometry={geo.bit} count={26} colors={CONFETTI} speed={2.4} gravity={3.2} size={0.04} life={1.8} origin={[0, BH + 0.05, 0]} spread={0.9} up={1.6} />
    </group>
  )
}

export default function GiftScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.3, 4]} target={[0, 0.55, 0]} hint="The bow bounces and the box hops now and then on its own · tap it and the lid springs open with confetti and a rising star · Wrap swaps red, blue, green and purple · drag to orbit">
      <Gift {...props} />
    </Stage>
  )
}
