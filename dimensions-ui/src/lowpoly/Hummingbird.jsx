import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, facet, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly hummingbird hovering by a trumpet flower: a small body with an
// iridescent back, a bright shimmering throat, a long thin beak, a forked
// tail and tiny feet, its blade-thin wings beating so fast they smear into a
// pale blur fan either side. The flower is a trumpet vine on a curving stem
// with paired leaves, two open trumpets and a bud, standing on a grassy
// mound. Left alone, the bird hovers in place, bobbing slightly with its
// wings buzzing and its tail flicking now and then. Tap it and it darts to
// the nearest trumpet, dips its beak in to sip (bobbing in and out three
// times while pollen sparkles spill from the flower), then zips back to its
// hover spot.

const LOOKS = {
  ruby: { back: '#3fae6a', throat: '#e8203f', belly: '#eef0ea', tail: '#2c6a46', flower: ['#f2632a', '#ffb347'], leaf: '#4f9a3a' },
  emerald: { back: '#1fae8a', throat: '#2fe08a', belly: '#e8f2ec', tail: '#17705c', flower: ['#e8357a', '#ffd0e0'], leaf: '#4a9440' },
  violet: { back: '#4a8ad8', throat: '#9b4ef0', belly: '#eceaf4', tail: '#2f4f8f', flower: ['#ff7a3a', '#ffd36a'], leaf: '#4f9a3a' },
  gold: { back: '#7aa83a', throat: '#ffb21f', belly: '#f4efe0', tail: '#4f6a28', flower: ['#d63a6a', '#ff9ab8'], leaf: '#4a9440' },
}

const SC = 1.35 // the bird's size
const TRIP = 2.4 // seconds for a dart, a sip and the dart home
const STEM_TOP = new THREE.Vector3(0.34, 1.16, 0.0)
const MOUTH = new THREE.Vector3(0.1, 1.04, 0.06) // the open end of the main trumpet
const HOVER = new THREE.Vector3(-0.44, 1.12, 0.16)
const DIR = new THREE.Vector3(MOUTH.x - HOVER.x, 0, MOUTH.z - HOVER.z).normalize()
const YAW = Math.atan2(DIR.x, DIR.z)
const BEAK_TIP = (0.085 + 0.04 + 0.16) * SC // how far the beak tip is ahead of the bird
const HEAD_Y = 0.085 * SC
// where the bird sits to sip: beak tip a little way into the trumpet
const SIP = MOUTH.clone().addScaledVector(DIR, -(BEAK_TIP - 0.06)).setY(MOUTH.y - HEAD_Y)

const ease = (u) => {
  const x = Math.max(0, Math.min(1, u))
  return x * x * (3 - 2 * x)
}

// a trumpet: a narrow tube flaring to a five-lobed mouth, along +y
const TRUMPET = [
  [0.001, 0],
  [0.022, 0.01],
  [0.026, 0.08],
  [0.032, 0.17],
  [0.045, 0.23],
  [0.075, 0.27],
  [0.088, 0.285],
  [0.07, 0.275],
]

export function Hummingbird({ look = 'ruby' }) {
  const L = LOOKS[look] || LOOKS.ruby
  const { tap, handlers, clock } = useTap(1)
  const bird = useRef()
  const tail = useRef()
  const wings = useRef([])
  const blurs = useRef([])
  const head = useRef()

  const geo = useGeo(() => {
    const blade = new THREE.Shape()
    ;[[0, 0.02], [0.07, 0.034], [0.17, 0.022], [0.21, 0.004], [0.19, -0.012], [0.1, -0.026], [0, -0.022]].forEach(([x, y], i) => (i ? blade.lineTo(x, y) : blade.moveTo(x, y)))
    blade.closePath()
    const feather = new THREE.Shape()
    ;[[-0.012, 0], [0.012, 0], [0.016, 0.07], [0.006, 0.12], [-0.008, 0.1], [-0.014, 0.06]].forEach(([x, y], i) => (i ? feather.lineTo(x, y) : feather.moveTo(x, y)))
    feather.closePath()
    return {
      mound: facet(new THREE.CylinderGeometry(0.62, 0.7, 0.08, 11, 1).translate(0, 0.04, 0), 0.02, 3, [1, 0.4, 1], (x, y) => y < 0.001),
      tuft: new THREE.ConeGeometry(0.045, 0.15, 3, 1).translate(0, 0.075, 0),
      stem: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.38, 0.05, -0.06), new THREE.Vector3(0.44, 0.45, -0.03), new THREE.Vector3(0.38, 0.88, 0.0), STEM_TOP]), 10, 0.022, 5),
      twig: new THREE.CylinderGeometry(0.01, 0.013, 0.12, 4, 1).translate(0, 0.06, 0),
      leaf: facet(new THREE.IcosahedronGeometry(0.1, 0), 0.006, 5).scale(0.6, 0.12, 1.6).translate(0, 0, 0.15),
      trumpet: facet(new THREE.LatheGeometry(TRUMPET.map(([r, y]) => new THREE.Vector2(r, y)), 5), 0.003, 7),
      calyx: facet(new THREE.ConeGeometry(0.035, 0.07, 5, 1).translate(0, 0.035, 0), 0.003, 8),
      bud: facet(new THREE.CylinderGeometry(0.03, 0.018, 0.14, 5, 1).translate(0, 0.07, 0), 0.003, 9),
      stamen: new THREE.IcosahedronGeometry(0.012, 0),
      body: blob(0.065, 11),
      belly: blob(0.058, 12),
      head: blob(0.05, 13),
      gorget: blob(0.04, 14),
      eye: new THREE.IcosahedronGeometry(0.011, 0),
      beak: new THREE.ConeGeometry(0.008, 0.16, 4, 1).translate(0, 0.08, 0).rotateX(Math.PI / 2),
      blade: new THREE.ShapeGeometry(blade).rotateX(-Math.PI / 2),
      blur: new THREE.CircleGeometry(0.21, 12, -1.15, 2.3),
      feather: new THREE.ShapeGeometry(feather).rotateX(-Math.PI / 2).rotateY(Math.PI),
      foot: new THREE.CylinderGeometry(0.004, 0.004, 0.03, 3, 1).translate(0, -0.015, 0),
      sparkle: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.75, 0.75, 1.5, 10).translate(0, 0.8, 0),
    }
  }, [])

  // the trumpets: base on the stem, pointing at their mouths
  const trumpets = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    const mk = (base, mouth) => ({ p: base.toArray(), q: new THREE.Quaternion().setFromUnitVectors(up, mouth.clone().sub(base).normalize()) })
    return [mk(new THREE.Vector3(0.33, 1.13, 0.03), MOUTH), mk(new THREE.Vector3(0.36, 1.14, -0.02), new THREE.Vector3(0.48, 1.0, -0.22)), mk(new THREE.Vector3(0.34, 1.15, 0.0), new THREE.Vector3(0.4, 1.3, 0.05))]
  }, [])
  // a tap object whose clock starts once the beak is in, for the pollen
  const sipTap = useMemo(() => ({ since: (t) => tap.since(t) - 0.42 }), [tap])

  const onClick = (e) => {
    e.stopPropagation()
    const s = tap.since(clock.elapsedTime)
    if (s >= 0 && s < TRIP) return // already on its way
    handlers.onClick(e)
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const o = bird.current
    // the hover: tiny bobs and drifts
    o.position.copy(HOVER)
    o.position.y += Math.sin(t * 2.3) * 0.022 + Math.sin(t * 5.1) * 0.006
    o.position.x += Math.sin(t * 1.3) * 0.012
    o.position.z += Math.sin(t * 1.7 + 1) * 0.01
    let pitch = 0
    let yaw = YAW + Math.sin(t * 0.7) * 0.12
    if (s >= 0 && s < TRIP) {
      // dart in, sip three times, dart home
      const go = ease(s / 0.35)
      const back = ease((s - 1.95) / 0.4)
      const at = go * (1 - back)
      o.position.lerp(SIP, at)
      if (s > 0.35 && s < 1.95) {
        const u = (s - 0.35) / 1.6
        o.position.addScaledVector(DIR, -0.045 * (0.5 - 0.5 * Math.cos(u * 3 * TAU)))
        o.position.y += 0.012 * Math.sin(u * 3 * TAU)
      }
      pitch = 0.45 * Math.sin(Math.PI * Math.min(1, s / 0.35)) * (s < 0.35 ? 1 : 0) - 0.45 * Math.sin(Math.PI * Math.max(0, Math.min(1, (s - 1.95) / 0.4)))
      yaw = YAW + (yaw - YAW) * (1 - at)
    }
    o.rotation.set(pitch, yaw, 0, 'YXZ')
    // head steadies the beak level
    head.current.rotation.x = -pitch * 0.5

    // the wings: a blade at some point in a stroke too fast to see, and the blur
    const beat = Math.sin(t * 87)
    wings.current.forEach((w, i) => w && (w.rotation.z = (i ? 1 : -1) * beat * 1.05))
    blurs.current.forEach((b, i) => b && (b.material.opacity = 0.3 + 0.07 * Math.sin(t * 40 + i)))

    // a flick of the tail every few seconds
    const f = t % 2.7
    tail.current.rotation.x = 0.15 * Math.sin(t * 2.3) + 0.45 * wobble(f - 1.9, 18, 6)
  })

  return (
    <group {...handlers} onClick={onClick}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* the mound and the trumpet vine */}
      <mesh geometry={geo.mound}>
        <Flat color="#7fbf52" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} geometry={geo.tuft} position={[Math.cos(i * 0.8 + 0.3) * (0.3 + (i % 3) * 0.08), 0.07, Math.sin(i * 0.8 + 0.3) * (0.3 + (i % 3) * 0.08)]} rotation={[0.2 * Math.sin(i), i, 0.2 * Math.cos(i)]} scale={0.7 + (i % 2) * 0.4}>
          <Flat color={i % 2 ? '#5fa63c' : '#6fb547'} />
        </mesh>
      ))}
      <mesh geometry={geo.stem}>
        <Flat color={L.leaf} />
      </mesh>
      {[
        [0.43, 0.32, -0.04, 0],
        [0.42, 0.58, -0.02, 1],
        [0.39, 0.84, 0.0, 2],
      ].map(([x, y, z, i]) =>
        [-1, 1].map((sd) => (
          <mesh key={`${i}${sd}`} geometry={geo.leaf} position={[x, y, z]} rotation={[0.5, sd * 1.4 + i * 0.7, 0]} scale={1 - i * 0.12}>
            <Flat color={sd > 0 ? L.leaf : '#3f8a3a'} />
          </mesh>
        )),
      )}
      {trumpets.map((tr, i) => (
        <group key={i} position={tr.p} quaternion={tr.q}>
          <mesh geometry={geo.calyx} position-y={-0.02}>
            <Flat color={L.leaf} />
          </mesh>
          {i < 2 ? (
            <>
              <mesh geometry={geo.trumpet}>
                <Flat color={L.flower[0]} side={THREE.DoubleSide} />
              </mesh>
              {[0, 1, 2].map((k) => (
                <mesh key={k} geometry={geo.stamen} position={[Math.cos(k * 2.1) * 0.012, 0.29 + k * 0.006, Math.sin(k * 2.1) * 0.012]}>
                  <Flat color="#ffe36a" emissive="#ffe36a" emissiveIntensity={0.3} />
                </mesh>
              ))}
              <mesh geometry={geo.trumpet} position-y={0.004} scale={[0.82, 0.985, 0.82]}>
                <Flat color={L.flower[1]} side={THREE.BackSide} />
              </mesh>
            </>
          ) : (
            <mesh geometry={geo.bud}>
              <Flat color={L.flower[0]} />
            </mesh>
          )}
        </group>
      ))}
      <Burst tap={sipTap} geometry={geo.sparkle} count={12} colors={['#ffe36a', '#fff6c0', L.flower[1]]} speed={0.6} gravity={0.5} size={0.018} life={1.3} origin={MOUTH.toArray()} up={1} />

      {/* the bird, facing +z */}
      <group ref={bird} position={HOVER.toArray()}>
        <group scale={SC}>
          {/* the body, held nearly upright */}
          <group rotation-x={-0.85}>
            <mesh geometry={geo.body} scale={[0.85, 0.85, 1.5]}>
              <meshStandardMaterial color={L.back} emissive={L.back} emissiveIntensity={0.28} metalness={0.4} roughness={0.32} flatShading />
            </mesh>
            <mesh geometry={geo.belly} position={[0, -0.016, 0.005]} scale={[0.82, 0.78, 1.35]}>
              <Flat color={L.belly} />
            </mesh>
            {[-1, 1].map((x, i) => (
              <group key={x} position={[x * 0.045, 0.03, 0.035]} scale={[x, 1, 1]}>
                <group ref={(el) => (wings.current[i] = el)}>
                  <mesh geometry={geo.blade}>
                    <meshStandardMaterial color={L.tail} emissive={L.back} emissiveIntensity={0.1} flatShading roughness={0.5} side={THREE.DoubleSide} />
                  </mesh>
                </group>
                <mesh ref={(el) => (blurs.current[i] = el)} geometry={geo.blur} rotation-y={0}>
                  <meshBasicMaterial color="#b9cddd" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
              </group>
            ))}
            <group ref={tail} position={[0, -0.005, -0.09]}>
              {[-1, 1].map((x) => (
                <mesh key={x} geometry={geo.feather} rotation={[0.1, x * 0.28, 0]} scale={1.1}>
                  <Flat color={L.tail} side={THREE.DoubleSide} />
                </mesh>
              ))}
              <mesh geometry={geo.feather} rotation-x={0.12} scale={0.75}>
                <Flat color={L.back} side={THREE.DoubleSide} />
              </mesh>
            </group>
            {[-1, 1].map((x) => (
              <mesh key={x} geometry={geo.foot} position={[x * 0.018, -0.05, 0.02]} rotation-x={0.6}>
                <Flat color="#2a2622" />
              </mesh>
            ))}
          </group>
          {/* the head, keeping the beak level */}
          <group ref={head} position={[0, 0.085, 0.085]}>
            <mesh geometry={geo.head}>
              <meshStandardMaterial color={L.back} emissive={L.back} emissiveIntensity={0.25} metalness={0.4} roughness={0.32} flatShading />
            </mesh>
            <mesh geometry={geo.gorget} position={[0, -0.03, 0.012]} scale={[1.05, 0.85, 0.95]}>
              <meshStandardMaterial color={L.throat} emissive={L.throat} emissiveIntensity={0.45} metalness={0.35} roughness={0.28} flatShading />
            </mesh>
            {[-1, 1].map((x) => (
              <group key={x} position={[x * 0.034, 0.012, 0.03]}>
                <mesh geometry={geo.eye}>
                  <Flat color="#141216" roughness={0.25} />
                </mesh>
                <mesh geometry={geo.eye} position={[x * 0.003, 0.004, 0.008]} scale={0.3}>
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </group>
            ))}
            <mesh geometry={geo.beak} position={[0, -0.004, 0.04]}>
              <Flat color="#1e1c1e" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export default function HummingbirdScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[0.9, 1.6, 3.6]} target={[0, 0.85, 0]} hint="The hummingbird hovers by the trumpet flower, wings a buzzing blur, tail flicking · tap it and it darts to the flower, sips three times as pollen sparkles, then zips back · Look swaps ruby, emerald, violet and gold · drag to orbit">
      <Hummingbird {...props} />
    </Stage>
  )
}
