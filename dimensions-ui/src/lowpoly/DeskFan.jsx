import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, facet, useGeo, useTap } from './kit.jsx'

// A low-poly desk fan on the corner of a wooden desk: a domed base with two
// buttons, a slim neck, a motor housing and four paddle blades inside a
// round wire cage. Beside it lie a little stack of papers and a pencil. The
// blades spin, the head sweeps slowly side to side, and the top papers
// ruffle each time the breeze passes over them. Tap it and the fan kicks up
// to full speed: the top sheet lifts off, sails up and flutters down like
// a falling leaf back onto the pile, and the fan winds back down.

const LOOKS = {
  mint: { body: '#9fe0c8', metal: 0, rough: 0.5, cage: '#f4f6f7', cageMetal: 0.1, blade: '#f4f6f7', badge: '#3aa886' },
  chrome: { body: '#d4dae2', metal: 0.45, rough: 0.28, cage: '#c9ced8', cageMetal: 0.5, blade: '#b9c0cc', badge: '#3a3a44' },
  cream: { body: '#f1e6c8', metal: 0, rough: 0.55, cage: '#c9a24a', cageMetal: 0.45, blade: '#c9a24a', badge: '#b0453a' },
}
const DESK = 0.1 // desk top
const FAN = [0.36, -0.2] // fan base x, z on the desk
const BASE_YAW = -0.15
const NECK = 0.62 // head pivot height above the desk
const CAGE = 0.37
const PAPER = [-0.38, 0.3] // paper stack x, z
const PW = 0.42 // paper width (x) and length (z)
const PL = 0.56
const SEG = 4
const TO_PAPER = Math.atan2(PAPER[0] - FAN[0], PAPER[1] - FAN[1]) // yaw that points at the papers
const AWAY = [Math.sin(TO_PAPER), Math.cos(TO_PAPER)]
const SHEETS = [
  [0, 0.02],
  [0.025, -0.1],
  [-0.01, 0.12],
]
const DELAY = 0.25 // the gust reaches the papers after the speed jumps
const FLY = 2.8
const ease = (u) => u * u * (3 - 2 * u)

// a paper sheet: a flat grid lying in x/z we can bend each frame
function sheetGeo() {
  const g = new THREE.PlaneGeometry(PW, PL, SEG, SEG).rotateX(-Math.PI / 2)
  return g
}

// a paddle blade: a flattened, twisted teardrop out along +y from the hub
function bladeGeo(seed) {
  const g = new THREE.SphereGeometry(1, 8, 4)
  g.scale(0.1, 0.155, 0.012).translate(0, 0.185, 0)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const a = 0.35 + y * 0.6 // twist along the blade
    p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a))
  }
  return facet(g, 0.004, seed)
}

// where the flying sheet is f (0..1) through its flight: [dx, dy, dz, pitch, yaw, roll]
function flightAt(f) {
  const rise = 0.18
  const y = 0.8 * (f < rise ? ease(f / rise) : 1 - ease((f - rise) / (1 - rise)))
  const out = 0.42 * Math.sin(Math.PI * Math.min(1, f * 1.3)) * (1 - f) ** 0.5
  const side = 0.28 * Math.sin(f * 3 * Math.PI) * (1 - f)
  return [AWAY[0] * out + AWAY[1] * side, y, AWAY[1] * out - AWAY[0] * side, -0.6 * Math.sin(Math.PI * Math.min(1, f * 2.5)) * (1 - f), Math.sin(Math.PI * f) * 1.1, 0.7 * Math.cos(f * 3 * Math.PI + Math.PI / 2) * (1 - f)]
}

export function DeskFan({ look = 'mint' }) {
  const L = LOOKS[look] || LOOKS.mint
  const { tap, handlers, clock } = useTap(0.9)
  const head = useRef()
  const blades = useRef()
  const blur = useRef()
  const flyer = useRef()
  const spin = useRef(0)
  const last = useRef(0)

  const geo = useGeo(
    () => ({
      desk: facet(new THREE.BoxGeometry(2.1, DESK, 1.45, 3, 1, 2).translate(0, DESK / 2, 0), 0.008, 2, [1, 0.3, 1]),
      base: facet(new THREE.LatheGeometry([[0.001, 0], [0.3, 0], [0.31, 0.03], [0.27, 0.08], [0.15, 0.11], [0.001, 0.11]].map(([r, y]) => new THREE.Vector2(r, y)), 14), 0.004, 3),
      button: new THREE.BoxGeometry(0.06, 0.03, 0.05),
      neck: new THREE.CylinderGeometry(0.035, 0.045, NECK - 0.1, 7, 1).translate(0, (NECK - 0.1) / 2 + 0.1, 0),
      yoke: facet(new THREE.SphereGeometry(0.07, 8, 5), 0.004, 4),
      motor: facet(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 10, 1).rotateX(Math.PI / 2), 0.004, 5),
      cap: facet(new THREE.SphereGeometry(0.12, 10, 4, 0, TAU, 0, Math.PI / 2).rotateX(-Math.PI / 2), 0.004, 6),
      rim: new THREE.TorusGeometry(CAGE, 0.014, 4, 28),
      ring: new THREE.TorusGeometry(CAGE * 0.55, 0.008, 3, 20),
      spoke: new THREE.BoxGeometry(0.01, CAGE, 0.008).translate(0, CAGE / 2, 0),
      side: new THREE.CylinderGeometry(0.007, 0.007, 0.16, 3, 1).rotateX(Math.PI / 2),
      badge: new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10, 1).rotateX(Math.PI / 2),
      hub: facet(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 8, 1).rotateX(Math.PI / 2), 0.003, 7),
      blades: [0, 1, 2, 3].map((i) => bladeGeo(10 + i)),
      blur: new THREE.CircleGeometry(CAGE * 0.92, 24),
      pencil: new THREE.CylinderGeometry(0.022, 0.022, 0.5, 6, 1).rotateZ(Math.PI / 2),
      lead: new THREE.ConeGeometry(0.022, 0.07, 6, 1).rotateZ(-Math.PI / 2),
      eraser: new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6, 1).rotateZ(Math.PI / 2),
    }),
    [],
  )
  // each paper keeps its own grid to bend
  const sheets = useGeo(() => SHEETS.map(() => sheetGeo()), [])
  const flat = useGeo(() => sheetGeo().attributes.position.clone(), [])

  useFrame(() => {
    const t = clock.elapsedTime
    const dt = Math.min(0.05, t - last.current)
    last.current = t
    const k = tap.value(t)
    const s = tap.since(t)

    // speed: a steady whirr that jumps on a tap and winds back down
    const speed = 13 + 32 * k
    spin.current += speed * dt
    blades.current.rotation.z = -spin.current
    blur.current.material.opacity = 0.08 + 0.22 * k

    // the head sweeps side to side, with a little shake at full speed
    const yaw = BASE_YAW + Math.sin(t * 0.55) * 0.75
    head.current.rotation.y = yaw - BASE_YAW
    head.current.rotation.x = -0.12 + Math.sin(t * 60) * 0.006 * k

    // the breeze on the papers is strongest as the fan points their way
    const wind = Math.exp(-((yaw - TO_PAPER) ** 2) / 0.12) * (1 + 1.5 * k)
    const flying = s >= DELAY && s < DELAY + FLY
    sheets.forEach((g, n) => {
      const p = g.attributes.position
      const top = n === SHEETS.length - 1
      for (let i = 0; i < p.count; i++) {
        const x = flat.getX(i)
        const z = flat.getZ(i)
        let y = 0
        if (top && flying) {
          // curling and rippling as it sails
          const f = (s - DELAY) / FLY
          y = (0.07 * Math.sin(x * 9 + t * 11) + 0.05 * Math.cos(z * 7 - t * 8)) * (1 - f) + 0.06 * (z / PL) ** 2 * 4
        } else {
          // the far edge (away from the fan) lifts and flutters
          const u = Math.max(0, (x * AWAY[0] + z * AWAY[1]) / (PL * 0.6) + 0.35)
          const amp = top ? 0.09 : 0.03
          y = wind * amp * u * u * (0.65 + 0.35 * Math.sin(t * 17 + x * 12 + n))
        }
        p.setY(i, y)
      }
      p.needsUpdate = true
      g.computeVertexNormals()
    })

    const m = flyer.current
    if (flying) {
      const [dx, dy, dz, pitch, yw, roll] = flightAt((s - DELAY) / FLY)
      m.position.set(PAPER[0] + SHEETS[2][0] + dx, DESK + 0.012 + dy, PAPER[1] + dz)
      m.rotation.set(pitch, SHEETS[2][1] + yw, roll)
    } else {
      m.position.set(PAPER[0] + SHEETS[2][0], DESK + 0.012, PAPER[1])
      m.rotation.set(0, SHEETS[2][1], 0)
    }
  })

  return (
    <group {...handlers}>
      {/* the desk corner */}
      <mesh geometry={geo.desk}>
        <Flat color="#c99561" />
      </mesh>
      {[-0.45, 0.05, 0.5].map((z) => (
        <mesh key={z} position={[0, DESK + 0.0005, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[2.08, 0.006]} />
          <meshBasicMaterial color="#b07c48" />
        </mesh>
      ))}

      {/* papers and a pencil */}
      {SHEETS.slice(0, 2).map(([dx, r], i) => (
        <mesh key={i} geometry={sheets[i]} position={[PAPER[0] + dx, DESK + 0.004 + i * 0.004, PAPER[1]]} rotation-y={r}>
          <Flat color={i ? '#f4f1ea' : '#e8e2d2'} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <group ref={flyer}>
        <mesh geometry={sheets[2]}>
          <Flat color="#fbf8f0" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group position={[0.12, DESK + 0.022, 0.48]} rotation-y={0.4}>
        <mesh geometry={geo.pencil}>
          <Flat color="#f6c22e" />
        </mesh>
        <mesh geometry={geo.lead} position-x={0.285}>
          <Flat color="#e8c89a" />
        </mesh>
        <mesh geometry={geo.eraser} position-x={-0.275}>
          <Flat color="#f28bb0" />
        </mesh>
      </group>

      {/* the fan */}
      <group position={[FAN[0], DESK, FAN[1]]} rotation-y={BASE_YAW}>
        <mesh geometry={geo.base}>
          <Flat color={L.body} metalness={L.metal} roughness={L.rough} />
        </mesh>
        {[-0.05, 0.05].map((x, i) => (
          <mesh key={x} geometry={geo.button} position={[x, 0.085, 0.19]} rotation-x={0.5}>
            <Flat color={i ? L.badge : '#f4f1ea'} />
          </mesh>
        ))}
        <mesh geometry={geo.neck}>
          <Flat color={L.body} metalness={L.metal} roughness={L.rough} />
        </mesh>
        <group ref={head} position-y={NECK}>
          <mesh geometry={geo.yoke}>
            <Flat color={L.body} metalness={L.metal} roughness={L.rough} />
          </mesh>
          <group position-y={0.08}>
            <mesh geometry={geo.motor} position-z={-0.12}>
              <Flat color={L.body} metalness={L.metal} roughness={L.rough} />
            </mesh>
            <mesh geometry={geo.cap} position-z={-0.22}>
              <Flat color={L.body} metalness={L.metal} roughness={L.rough} />
            </mesh>
            {/* blades */}
            <group ref={blades} position-z={0.04}>
              <mesh geometry={geo.hub}>
                <Flat color={L.body} metalness={L.metal} roughness={L.rough} />
              </mesh>
              {geo.blades.map((g, i) => (
                <mesh key={i} geometry={g} rotation-z={(i / 4) * TAU}>
                  <Flat color={L.blade} metalness={L.cageMetal * 0.6} roughness={0.4} />
                </mesh>
              ))}
            </group>
            <mesh ref={blur} geometry={geo.blur} position-z={0.045}>
              <meshBasicMaterial color={L.blade} transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {/* the wire cage */}
            {[0.11, -0.05].map((z) => (
              <mesh key={z} geometry={geo.rim} position-z={z} scale={z < 0 ? 0.84 : 1}>
                <Flat color={L.cage} metalness={L.cageMetal} roughness={0.35} />
              </mesh>
            ))}
            <mesh geometry={geo.ring} position-z={0.124}>
              <Flat color={L.cage} metalness={L.cageMetal} roughness={0.35} />
            </mesh>
            {Array.from({ length: 16 }, (_, i) => (i / 16) * TAU).map((a) => (
              <group key={a} rotation-z={a}>
                <mesh geometry={geo.spoke} position-z={0.14} rotation-x={-0.075}>
                  <Flat color={L.cage} metalness={L.cageMetal} roughness={0.35} />
                </mesh>
                <mesh geometry={geo.side} position={[0, CAGE * 0.92, 0.03]} rotation-x={-0.36}>
                  <Flat color={L.cage} metalness={L.cageMetal} roughness={0.35} />
                </mesh>
                <mesh geometry={geo.spoke} position-z={-0.065} rotation-x={0.04} scale-y={0.84}>
                  <Flat color={L.cage} metalness={L.cageMetal} roughness={0.35} />
                </mesh>
              </group>
            ))}
            <mesh geometry={geo.badge} position-z={0.15}>
              <Flat color={L.badge} roughness={0.4} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export default function DeskFanScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[1.5, 2.0, 3.4]} target={[0, 0.5, 0]} hint="The blades spin, the head sweeps side to side and the papers ruffle as the breeze passes · tap it and the fan jumps to full speed, the top sheet flies off and flutters back down onto the pile · Look swaps mint, chrome and cream · drag to orbit">
      <DeskFan {...props} />
    </Stage>
  )
}
