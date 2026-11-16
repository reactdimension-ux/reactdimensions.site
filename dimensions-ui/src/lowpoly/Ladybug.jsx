import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, facet, followPath, useGeo, useTap } from './kit.jsx'

// A low-poly ladybug on a big leaf: a spotted dome split into two shell
// halves, a black head with white eyes and two antennae, and six little
// legs. Left alone, it crawls in a slow circle round the leaf, legs
// pattering. Tap it and the shell halves lift apart, a pair of thin wings
// unfold and buzz, and it flies one loop over the leaf, lands where it took
// off, folds its wings away and crawls on.

const LOOKS = {
  red: { shell: '#d8322a', rim: '#b8241e' },
  orange: { shell: '#ee7a22', rim: '#cf5f14' },
  yellow: { shell: '#f2c230', rim: '#d9a51c' },
}
const BLACK = '#1d1c22'
const LEAF = ['#5aa846', '#4c9a3c']
const RIB = '#8fcf6a'

const LEAF_LEN = 2.3
const LEAF_W = 1.35
const SHELL = [0.24, 0.2, 0.29] // the dome's half-width, height and half-length
const BASE = 0.07 // the shell's rim above the leaf
const CRAWL = { x: 0, z: -0.05, r: 0.42, speed: 0.5 }
const OPEN = 0.45 // seconds to open up before lift-off
const FLY = 3.2 // seconds in the air
const DONE = OPEN + FLY + 0.6
const LOOP = 0.45 // radius of the flight loop

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x))
  return k * k * (3 - 2 * k)
}

// The leaf's half-width at v (0 stem end .. 1 tip), and its surface height:
// edges curled up a little, both ends lifted.
const halfW = (v) => (LEAF_W / 2) * Math.sin(Math.PI * Math.min(1, Math.max(0, v))) ** 0.75
const leafY = (x, z) => {
  const v = z / LEAF_LEN + 0.5
  const w = Math.max(0.05, halfW(v))
  const xn = Math.min(1, Math.abs(x) / w)
  return 0.05 + 0.14 * xn * xn * (w / (LEAF_W / 2)) + 0.4 * (v - 0.5) ** 2
}

function leafGeometry() {
  const g = new THREE.PlaneGeometry(2, LEAF_LEN, 8, 12).rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const xn = p.getX(i)
    const z = p.getZ(i)
    // the plane's +z end is the tip; v runs stem (0) to tip (1)
    const x = xn * halfW(z / LEAF_LEN + 0.5)
    p.setXYZ(i, x, leafY(x, z) - 0.012, z)
  }
  return facet(g, 0.02, 4, [1, 0.5, 1])
}

const crawlAt = (a, out) => {
  const x = CRAWL.x + CRAWL.r * Math.cos(a)
  const z = CRAWL.z + CRAWL.r * Math.sin(a)
  return out.set(x, leafY(x, z), z)
}

// A spot on the unit dome at polar angle th from the top and azimuth ph
// (from +x toward +z), laid flat on the surface.
function spot(th, ph) {
  const n = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph))
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
  return { pos: n.clone().multiplyScalar(1.005).toArray(), quat: q.toArray() }
}
const SPOTS = [
  [0.55, 0.85, 0.2],
  [0.62, -0.62, 0.22],
  [1.12, 0.1, 0.18],
]

export function Ladybug({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1.5)
  const bug = useRef()
  const halves = useRef([])
  const wings = useRef([])
  const legs = useRef([])
  const st = useRef({ a: 0, step: 0 })
  const v = useMemo(() => ({ p0: new THREE.Vector3(), n: new THREE.Vector3(), c: new THREE.Vector3(), out: new THREE.Vector3() }), [])
  const onClick = (e) => {
    if (tap.since(clock.elapsedTime) < DONE) return e.stopPropagation()
    handlers.onClick(e)
  }

  const geo = useGeo(
    () => ({
      leaf: leafGeometry(),
      rib: new THREE.CylinderGeometry(0.012, 0.03, LEAF_LEN * 0.8, 4, 1).rotateX(Math.PI / 2),
      stalk: facet(new THREE.CylinderGeometry(0.025, 0.035, 0.35, 5, 1).rotateX(Math.PI / 2), 0.004, 2),
      half: [1, -1].map((side) => facet(new THREE.SphereGeometry(1, 7, 5, side > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI / 2), 0.03, side > 0 ? 3 : 5)),
      dot: new THREE.CircleGeometry(1, 7),
      ball: blob(1, 6),
      leg: new THREE.CylinderGeometry(0.009, 0.012, 1, 4, 1).translate(0, -0.5, 0),
      wing: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.quadraticCurveTo(0.09, -0.06, 0.08, -0.22)
        s.quadraticCurveTo(0.05, -0.36, 0, -0.38)
        s.quadraticCurveTo(-0.03, -0.2, 0, 0)
        return new THREE.ShapeGeometry(s, 4).rotateX(Math.PI / 2)
      })(),
    }),
    [],
  )
  const spots = useMemo(() => SPOTS.map(([th, ph, s]) => [1, -1].map((side) => ({ ...spot(th, side > 0 ? ph : Math.PI - ph), s }))), [])
  // side veins: from the midrib out toward the edge, angled to the tip
  const veins = useMemo(
    () =>
      [-0.7, -0.35, 0, 0.35, 0.68].flatMap((z0) =>
        [1, -1].map((side) => {
          const a = 0.95
          const len = (0.6 * halfW(z0 / LEAF_LEN + 0.5)) / Math.sin(a)
          const x = (side * Math.sin(a) * len) / 2
          const z = z0 + (Math.cos(a) * len) / 2
          return { pos: [x, leafY(x * 0.6, z) + 0.002, z], rot: side * a, len }
        }),
      ),
    [],
  )

  const flightPath = (s, out) => {
    const u = Math.min(1, Math.max(0, s / FLY))
    const ang = Math.atan2(v.p0.z - v.c.z, v.p0.x - v.c.x) + TAU * u
    return out.set(v.c.x + LOOP * Math.cos(ang), v.p0.y + 0.62 * Math.sin(Math.PI * u) + 0.03 * Math.sin(s * 11) * Math.sin(Math.PI * u), v.c.z + LOOP * Math.sin(ang))
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const d = Math.min(dt, 0.05)
    const S = st.current
    const s = tap.since(t)
    const busy = s >= 0 && s < DONE
    const o = !busy ? 0 : s < OPEN + FLY + 0.1 ? smooth(s / OPEN) : 1 - smooth((s - OPEN - FLY - 0.1) / 0.5)
    const flying = busy && s >= OPEN && s < OPEN + FLY
    if (!busy) S.a += d * CRAWL.speed
    crawlAt(S.a, v.p0)
    if (flying) {
      v.n.set(v.p0.x - CRAWL.x, 0, v.p0.z - CRAWL.z).normalize()
      v.c.copy(v.p0).addScaledVector(v.n, -LOOP)
      followPath(bug.current, (k) => flightPath(k, v.out).clone(), s - OPEN, 0.3)
    } else {
      followPath(bug.current, (k) => crawlAt(k, v.out).clone(), S.a, 0)
      bug.current.position.y += busy ? 0 : Math.abs(Math.sin(t * 12)) * 0.006
    }
    // the shell halves lift and swing apart
    halves.current.forEach((h, i) => {
      if (!h) return
      const side = i ? -1 : 1
      h.rotation.set(-0.45 * o, 0, side * 1.0 * o)
    })
    // the wings unfold and buzz
    wings.current.forEach((w, i) => {
      if (!w) return
      const side = i ? -1 : 1
      w.visible = o > 0.15
      if (!w.visible) return
      const buzz = flying ? 0.55 * Math.sin(t * 48 + i * 0.3) : 0
      w.rotation.set(-0.25 * o, -side * 0.75 * o, side * (0.25 + buzz) * o, 'ZYX')
      w.scale.setScalar(Math.max(0.001, o))
    })
    // legs patter while crawling and tuck in while flying
    if (!busy) S.step += d * 13
    legs.current.forEach((g, i) => {
      if (!g) return
      const side = i < 3 ? 1 : -1
      const k = i % 3
      const ph = S.step + (k % 2 === (side > 0 ? 0 : 1) ? 0 : Math.PI)
      g.rotation.y = flying ? 0 : 0.35 * Math.sin(ph)
      g.children[0].rotation.z = side * (flying ? 0.35 : 1.0 + 0.15 * Math.max(0, Math.cos(ph)))
    })
  })

  const pivot = [0, BASE + SHELL[1] * 0.75, SHELL[2] * 0.55]
  return (
    <group {...handlers} onClick={onClick}>
      {/* the leaf */}
      <mesh geometry={geo.leaf}>
        <Flat color={LEAF[0]} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.rib} position={[0, leafY(0, 0) - 0.005, 0]}>
        <Flat color={RIB} />
      </mesh>
      {veins.map((vn, i) => (
        <mesh key={i} geometry={geo.rib} position={vn.pos} rotation-y={vn.rot} scale={[0.45, 0.35, vn.len / (LEAF_LEN * 0.8)]}>
          <Flat color={RIB} />
        </mesh>
      ))}
      <mesh geometry={geo.stalk} position={[0, leafY(0, -LEAF_LEN / 2) - 0.02, -LEAF_LEN / 2 - 0.12]} rotation-x={0.25}>
        <Flat color={RIB} />
      </mesh>

      {/* the bug, facing +z */}
      <group ref={bug}>
        <mesh geometry={geo.ball} position-y={BASE + 0.02} scale={[0.2, 0.07, 0.25]}>
          <Flat color={BLACK} />
        </mesh>
        <mesh geometry={geo.ball} position={[0, BASE + 0.05, 0.2]} scale={[0.15, 0.09, 0.1]}>
          <Flat color={BLACK} />
        </mesh>
        {[1, -1].map((side) => (
          <mesh key={side} geometry={geo.ball} position={[side * 0.09, BASE + 0.1, 0.24]} scale={[0.035, 0.025, 0.03]}>
            <Flat color="#f4f1ea" />
          </mesh>
        ))}
        {/* head, eyes and antennae */}
        <group position={[0, BASE + 0.05, 0.3]}>
          <mesh geometry={geo.ball} scale={[0.1, 0.08, 0.08]}>
            <Flat color={BLACK} />
          </mesh>
          {[1, -1].map((side) => (
            <group key={side}>
              <mesh geometry={geo.ball} position={[side * 0.052, 0.03, 0.055]} scale={0.026}>
                <Flat color="#ffffff" roughness={0.4} />
              </mesh>
              <mesh geometry={geo.ball} position={[side * 0.055, 0.032, 0.076]} scale={0.012}>
                <Flat color={BLACK} roughness={0.3} />
              </mesh>
              <group position={[side * 0.035, 0.06, 0.04]} rotation={[0.75, 0, -side * 0.45]}>
                <mesh geometry={geo.leg} rotation-x={Math.PI} scale={[0.8, 0.13, 0.8]}>
                  <Flat color={BLACK} />
                </mesh>
                <mesh geometry={geo.ball} position-y={0.13} scale={0.016}>
                  <Flat color={BLACK} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
        {/* six legs */}
        {[1, -1].map((side) =>
          [0.12, 0, -0.12].map((z, k) => (
            <group key={`${side}${k}`} ref={(el) => (legs.current[(side > 0 ? 0 : 3) + k] = el)} position={[side * 0.13, BASE + 0.02, z]}>
              <group>
                <mesh geometry={geo.leg} scale={[1, 0.15, 1]}>
                  <Flat color={BLACK} />
                </mesh>
              </group>
            </group>
          )),
        )}
        {/* wings, folded away under the shell until it opens */}
        {[1, -1].map((side, i) => (
          <group key={side} ref={(el) => (wings.current[i] = el)} position={[side * 0.03, BASE + 0.12, 0.1]} scale={[side, 1, 1]} visible={false}>
            <mesh geometry={geo.wing} scale={[1.3, 1, 1.3]}>
              <meshStandardMaterial color="#e8ddd0" roughness={0.4} transparent opacity={0.82} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        ))}
        {/* the two shell halves, hinged at the front of the seam */}
        {[1, -1].map((side, i) => (
          <group key={side} ref={(el) => (halves.current[i] = el)} position={pivot}>
            <group position={[-pivot[0], -pivot[1] + BASE, -pivot[2]]} scale={SHELL}>
              <mesh geometry={geo.half[i]}>
                <Flat color={L.shell} roughness={0.45} side={THREE.DoubleSide} />
              </mesh>
              {spots.map((pair, k) => (
                <mesh key={k} geometry={geo.dot} position={pair[i].pos} quaternion={pair[i].quat} scale={pair[i].s}>
                  <Flat color={BLACK} roughness={0.5} />
                </mesh>
              ))}
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

export default function LadybugScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.3, 1.85, 3.1]} target={[0, 0.38, 0]} hint="The ladybug crawls round and round its leaf on its own · tap it and its shell opens, its wings buzz and it flies a loop before landing back · Look swaps red, orange and yellow · drag to orbit">
      <Ladybug {...props} />
    </Stage>
  )
}
