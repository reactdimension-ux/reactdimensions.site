import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, facet, useGeo, useTap } from './kit.jsx'

// A low-poly toaster on a plank cutting board: a rounded, chamfered body on
// little feet, two slots with the bread peeking out, a lever down the side,
// a browning dial on the front, and a butter dish with a knife beside it.
// While it toasts, the slots glow a faint orange and heat shimmers up from
// them in wavy, fading sheets. Tap it and the lever snaps up, the toast
// pops high, tumbles a little, drops back into the slots with a bounce, and
// the lever goes back down.

const LOOKS = {
  chrome: { body: '#d4dae2', metal: 0.45, rough: 0.28, trim: '#3a3a44', knob: '#2c2a33' },
  mint: { body: '#9fe0c8', metal: 0, rough: 0.5, trim: '#d8dde4', knob: '#f4f1ea' },
  red: { body: '#e2483d', metal: 0, rough: 0.45, trim: '#d8dde4', knob: '#f4f1ea' },
}
const W = 1.0 // body width (x)
const H = 0.72 // body height
const D = 0.62 // body depth (z)
const FEET = 0.05
const BOARD = 0.08
const SLOTS = [-0.11, 0.11] // slot centres along z
const REST = H + 0.08 - 0.55 // bread bottom while toasting
const POP = 0.75 // how high the toast flies
const G = 9 // gravity for the pop
const V0 = Math.sqrt(2 * G * POP)
const FLIGHT = (2 * V0) / G
const CRUMBS = Array.from({ length: 9 }, (_, i) => [Math.sin(i * 2.3) * 0.28, Math.cos(i * 1.7) * 0.5 + 0.1])

// a box with its edges and corners rounded off in a few flat steps
function roundedBox(w, h, d, r, seg = 4) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  const c = new THREE.Vector3()
  const lim = [w / 2 - r, h / 2 - r, d / 2 - r]
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    c.set(Math.max(-lim[0], Math.min(lim[0], v.x)), Math.max(-lim[1], Math.min(lim[1], v.y)), Math.max(-lim[2], Math.min(lim[2], v.z)))
    v.sub(c)
    if (v.lengthSq() > 1e-9) v.normalize().multiplyScalar(r)
    p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z)
  }
  g.computeVertexNormals()
  return g
}

// a slice of bread: a square foot and two rounded lobes on top
function sliceGeo() {
  const s = new THREE.Shape()
  s.moveTo(-0.26, 0)
  s.lineTo(0.26, 0)
  s.lineTo(0.26, 0.42)
  s.bezierCurveTo(0.31, 0.56, 0.12, 0.6, 0, 0.53)
  s.bezierCurveTo(-0.12, 0.6, -0.31, 0.56, -0.26, 0.42)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 1, curveSegments: 4 })
  return facet(g.translate(0, 0, -0.025), 0.004, 7)
}

// where slice i is s seconds after a tap: [lift, tumble], or null at rest
function toastAt(s, i) {
  const u = s - 0.06 - i * 0.07
  if (u < 0) return null
  if (u < FLIGHT) {
    const lift = V0 * u - 0.5 * G * u * u
    return [lift, Math.sin((u / FLIGHT) * Math.PI) * (i ? -0.55 : 0.45)]
  }
  // a small bounce as it lands back in the slot
  const b = u - FLIGHT
  if (b < 0.6) return [Math.abs(Math.sin(b * 9)) * 0.05 * Math.exp(-6 * b), 0]
  return null
}

export function Toaster({ look = 'chrome' }) {
  const L = LOOKS[look] || LOOKS.chrome
  const { tap, handlers, clock } = useTap(1)
  const body = useRef()
  const lever = useRef()
  const dial = useRef()
  const slices = useRef([])
  const slots = useRef([])
  const glow = useRef()
  const sheets = useRef([])

  const geo = useGeo(
    () => ({
      body: facet(roundedBox(W, H, D, 0.14).translate(0, H / 2, 0), 0.006, 1),
      board: facet(new THREE.BoxGeometry(0.72, BOARD, 1.4, 2, 1, 3).translate(0, BOARD / 2, 0), 0.008, 2, [1, 0.3, 1]),
      foot: new THREE.CylinderGeometry(0.035, 0.045, FEET, 6, 1).translate(0, FEET / 2, 0),
      slot: new THREE.BoxGeometry(0.66, 0.02, 0.1),
      rim: new THREE.BoxGeometry(0.72, 0.016, 0.15),
      slice: sliceGeo(),
      groove: new THREE.BoxGeometry(0.02, 0.36, 0.05),
      lever: facet(roundedBox(0.16, 0.07, 0.16, 0.03, 2).translate(0.07, 0, 0), 0.004, 3),
      stem: new THREE.BoxGeometry(0.06, 0.03, 0.03).translate(0.02, 0, 0),
      dial: facet(new THREE.CylinderGeometry(0.075, 0.085, 0.05, 10, 1).rotateX(Math.PI / 2), 0.003, 4),
      tick: new THREE.BoxGeometry(0.015, 0.05, 0.012),
      band: new THREE.BoxGeometry(W * 0.74, 0.05, 0.012),
      dish: facet(new THREE.LatheGeometry([[0.001, 0], [0.24, 0], [0.33, 0.05], [0.35, 0.07], [0.31, 0.07], [0.24, 0.035], [0.001, 0.035]].map(([r, y]) => new THREE.Vector2(r, y)), 12).scale(1, 1, 0.72), 0.005, 5),
      butter: facet(new THREE.BoxGeometry(0.3, 0.13, 0.18, 2, 1, 1), 0.008, 6),
      pat: facet(new THREE.BoxGeometry(0.08, 0.035, 0.06), 0.006, 8),
      blade: new THREE.BoxGeometry(0.26, 0.012, 0.055).translate(0.13, 0, 0),
      handle: facet(new THREE.BoxGeometry(0.2, 0.035, 0.05).translate(-0.1, 0, 0), 0.004, 9),
      crumb: new THREE.TetrahedronGeometry(0.018, 0),
    }),
    [],
  )
  // each shimmer sheet keeps its own copy of the plane, bent every frame
  const sheetGeos = useGeo(() => Array.from({ length: 6 }, () => new THREE.PlaneGeometry(0.5, 0.06, 8, 1)), [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const flying = s >= 0 && s < FLIGHT + 0.25
    // the lever snaps up with the pop and is pushed back down after it
    const up = s < 0 ? 0 : s < 0.08 ? s / 0.08 : s < FLIGHT + 0.3 ? 1 : Math.max(0, 1 - (s - FLIGHT - 0.3) / 0.25)
    lever.current.position.y = 0.22 + up * 0.32
    // the whole body gives a little jolt as the springs fire
    const jolt = s >= 0 && s < 0.3 ? Math.sin((s / 0.3) * Math.PI) * Math.exp(-4 * s) : 0
    body.current.scale.set(1 + jolt * 0.05, 1 - jolt * 0.07, 1 + jolt * 0.05)
    dial.current.rotation.z = -0.6 + Math.sin(t * 0.5) * 0.05
    slices.current.forEach((m, i) => {
      if (!m) return
      const p = toastAt(s, i)
      m.position.y = REST + (p ? p[0] : Math.sin(t * 2 + i) * 0.004)
      m.rotation.x = p ? p[1] : 0
      m.rotation.z = p ? p[1] * 0.25 : 0
    })
    // the slots glow while toasting, and go dark while the toast is out
    const heat = flying ? 0.15 : 0.75 + 0.15 * Math.sin(t * 3.1) + 0.08 * Math.sin(t * 7.7)
    slots.current.forEach((m) => m && (m.material.emissiveIntensity = heat * 1.4))
    glow.current.intensity = heat * 1.6
    // heat shimmer: wavy sheets that rise off each slot, narrowing and fading
    sheets.current.forEach((m, i) => {
      if (!m) return
      const slot = i % 2
      const u = (t / 1.6 + i / 6) % 1
      m.position.set(0, H + 0.12 + u * 0.55, SLOTS[slot])
      m.scale.set(1 - u * 0.4, 1 + u * 0.6, 1)
      m.material.opacity = (flying ? 0.05 : 0.22) * Math.sin(u * Math.PI)
      const p = sheetGeos[i].attributes.position
      for (let k = 0; k < p.count; k++) {
        const x = ((k % 9) / 8 - 0.5) * 0.5
        const top = k < 9 ? 1 : 0
        p.setZ(k, Math.sin(x * 14 + t * 5 + i * 1.3 + top) * 0.03)
        p.setY(k, (top ? 0.03 : -0.03) + Math.sin(x * 9 - t * 4 + i) * 0.012)
      }
      p.needsUpdate = true
    })
  })

  return (
    <group {...handlers}>
      {/* the plank board, three planks side by side */}
      {[-0.73, 0, 0.73].map((x, i) => (
        <mesh key={x} geometry={geo.board} position-x={x}>
          <Flat color={['#c99561', '#d6a46c', '#c18a55'][i]} />
        </mesh>
      ))}
      {CRUMBS.map(([x, z], i) => (
        <mesh key={i} geometry={geo.crumb} position={[x - 0.15 + (i % 3) * 0.5, BOARD + 0.01, z]} rotation={[i, i * 2, 0]}>
          <Flat color={i % 2 ? '#b8743c' : '#e0b070'} />
        </mesh>
      ))}

      {/* the toaster */}
      <group position={[0.22, BOARD, -0.12]}>
        {[
          [-0.32, -0.17],
          [0.32, -0.17],
          [-0.32, 0.17],
          [0.32, 0.17],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={geo.foot} position={[x, 0, z]}>
            <Flat color="#2c2a33" />
          </mesh>
        ))}
        <group position-y={FEET}>
          <group ref={body}>
            <mesh geometry={geo.body}>
              <Flat color={L.body} metalness={L.metal} roughness={L.rough} />
            </mesh>
            {/* a trim band round the front and back */}
            {[1, -1].map((z) => (
              <mesh key={z} geometry={geo.band} position={[0, 0.12, z * (D / 2 + 0.002)]}>
                <Flat color={L.trim} metalness={0.3} roughness={0.35} />
              </mesh>
            ))}
            {/* the two slots, glowing faintly inside */}
            {SLOTS.map((z, i) => (
              <group key={z} position={[0, H, z]}>
                <mesh geometry={geo.rim}>
                  <Flat color={L.trim} metalness={0.3} roughness={0.35} />
                </mesh>
                <mesh ref={(el) => (slots.current[i] = el)} geometry={geo.slot} position-y={0.004}>
                  <Flat color="#2a1610" emissive="#ff5a1a" emissiveIntensity={1} />
                </mesh>
              </group>
            ))}
            <pointLight ref={glow} color="#ff8a3a" distance={1.6} decay={2} position={[0, H + 0.2, 0]} intensity={1} />
            {/* the lever in its groove down the side */}
            <mesh geometry={geo.groove} position={[W / 2 + 0.001, 0.38, 0]}>
              <Flat color="#1c1a20" />
            </mesh>
            <group ref={lever} position={[W / 2, 0.22, 0]}>
              <mesh geometry={geo.stem}>
                <Flat color="#3a3a44" />
              </mesh>
              <mesh geometry={geo.lever} position-x={0.04}>
                <Flat color={L.knob} />
              </mesh>
            </group>
            {/* the browning dial on the front */}
            <group position={[0.27, 0.32, D / 2 + 0.02]}>
              <mesh ref={dial} geometry={geo.dial}>
                <Flat color={L.knob} />
                <mesh geometry={geo.tick} position={[0, 0.04, 0.03]}>
                  <Flat color="#e2483d" />
                </mesh>
              </mesh>
              {[-1.1, -0.4, 0.3, 1.0].map((a) => (
                <mesh key={a} position={[Math.sin(a) * 0.12, Math.cos(a) * 0.12, -0.015]}>
                  <boxGeometry args={[0.018, 0.018, 0.01]} />
                  <Flat color="#2c2a33" />
                </mesh>
              ))}
            </group>
          </group>
          {/* the toast */}
          {SLOTS.map((z, i) => (
            <group key={z} position-z={z}>
              <mesh ref={(el) => (slices.current[i] = el)} geometry={geo.slice} position-y={REST}>
                <meshStandardMaterial attach="material-0" color="#e3ab5c" flatShading roughness={0.9} />
                <meshStandardMaterial attach="material-1" color="#9a5a2a" flatShading roughness={0.9} />
              </mesh>
            </group>
          ))}
          {/* heat shimmer */}
          {sheetGeos.map((g, i) => (
            <mesh key={i} ref={(el) => (sheets.current[i] = el)} geometry={g}>
              <meshBasicMaterial color="#fff0d8" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <Burst tap={tap} count={14} colors={['#e3ab5c', '#9a5a2a', '#f2cf8a']} size={0.035} speed={1.6} gravity={5} life={1.1} origin={[0, H + 0.05, 0]} spread={0.8} seed={4} />
        </group>
      </group>

      {/* the butter dish and knife */}
      <group position={[-0.62, BOARD, 0.42]} rotation-y={0.35}>
        <mesh geometry={geo.dish}>
          <Flat color="#f4f1ea" roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.butter} position={[-0.02, 0.035 + 0.065, 0]}>
          <Flat color="#f6dc7a" />
        </mesh>
        <mesh geometry={geo.pat} position={[0.17, 0.06, 0.04]} rotation-y={0.5}>
          <Flat color="#f6dc7a" />
        </mesh>
        <group position={[0.08, 0.1, 0.17]} rotation={[0, -0.25, -0.12]}>
          <mesh geometry={geo.blade}>
            <Flat color="#c9ced8" metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh geometry={geo.handle}>
            <Flat color="#5a3a2a" />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export default function ToasterScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.6, 2.6, 4.2]} target={[0, 0.7, 0]} hint="The slots glow and heat shimmers up from them on their own · tap it and the lever snaps up, the toast pops high, tumbles and drops back in · Look swaps chrome, mint and red · drag to orbit">
      <Toaster {...props} />
    </Stage>
  )
}
