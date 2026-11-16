import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Ripple, Stage, TAU, Water, Wing, blob, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly sea stack: a tall, leaning column of faceted rock standing in
// the surf, banded with strata, grassy on top, with jutting ledges up its
// sides, a smaller stack and a scatter of boulders beside it and a ring of
// foam round its foot. Waves roll in from every side, rear up and break on
// the rock in bursts of spray, while gulls circle overhead and others sit on
// the ledges. Tap it and every gull scatters out over the sea, wheels, and
// comes back: the circlers to their rounds, the sitters to their ledges.

const LOOKS = {
  granite: { rock: ['#7f828a', '#959aa3', '#6c7079', '#a3a6ad'], ledge: '#868991', cap: '#6aa84a', cap2: '#5a983e', water: '#3f9fd2', edge: '#2c79a8', boulder: ['#7a7d85', '#92959c'] },
  sandstone: { rock: ['#c9814e', '#dc9c64', '#b86f42', '#e6b07a'], ledge: '#cf8d58', cap: '#8db04e', cap2: '#7a9e40', water: '#3fb0cf', edge: '#2a86a3', boulder: ['#bd7a4a', '#d79a66'] },
  chalk: { rock: ['#efede5', '#e2dfd4', '#f7f6f1', '#d8d4c8'], ledge: '#e7e4da', cap: '#7cc257', cap2: '#69b048', water: '#4ab4d6', edge: '#2f8bb0', boulder: ['#e2dfd5', '#cfcbc0'] },
}

const H = 2.05 // stack height
const R0 = 0.52 // radius at the foot
const R1 = 0.34 // radius at the top
const SEA_R = 1.75
const SEA_Y = 0.07
const radiusAt = (y) => R0 + ((R1 - R0) * y) / H
// the stack leans and wanders a little as it rises
const leanAt = (y) => [Math.sin(y * 1.5) * 0.08 - 0.03, Math.sin(y * 1.1 + 0.6) * 0.06 - 0.03]

// ledges: [height, angle, size]
const LEDGES = [
  [0.55, 0.5, 0.26],
  [0.95, 2.7, 0.24],
  [1.3, 4.6, 0.22],
  [1.62, 1.4, 0.2],
]

// a perch on a ledge (or the top), in stack space
function perchAt(y, a, out = 0.12) {
  const [lx, lz] = leanAt(y)
  const r = radiusAt(y) + out
  return [lx + Math.cos(a) * r, y + 0.085, lz + Math.sin(a) * r]
}

// The column: a tall cylinder whose rings are pushed about and pinched so it
// reads as weathered rock, faceted, then coloured face by face in strata,
// with grass on the flat top.
function stackGeometry(L) {
  const SEGS = 9
  const g = new THREE.CylinderGeometry(R1, R0, H, 9, SEGS, false).translate(0, H / 2, 0)
  const r = rng(21)
  const ring = Array.from({ length: SEGS + 1 }, () => 0.9 + r() * 0.17)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const k = Math.round((y / H) * SEGS)
    const s = y > H - 0.01 || y < 0.01 ? 1 : ring[k]
    const [lx, lz] = leanAt(y)
    p.setXYZ(i, p.getX(i) * s + lx, y, p.getZ(i) * s + lz)
  }
  const f = facet(g, 0.035, 5, [1, 0.6, 1], (x, y) => y < 0.01).toNonIndexed()
  f.computeVertexNormals()
  const P = f.attributes.position
  const N = f.attributes.normal
  const col = new Float32Array(P.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < P.count; i += 3) {
    const y = (P.getY(i) + P.getY(i + 1) + P.getY(i + 2)) / 3
    const ny = (N.getY(i) + N.getY(i + 1) + N.getY(i + 2)) / 3
    if (ny > 0.7 && y > H - 0.2) c.set(r() > 0.5 ? L.cap : L.cap2)
    else c.set(L.rock[Math.floor(y * 5.2) % L.rock.length]).multiplyScalar(0.93 + r() * 0.12)
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3)
  }
  f.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return f
}

// a gull: a white body, grey wings with black tips, a yellow beak
const GULLS = [
  { orbit: [1.25, 2.15, 0.55, 0] },
  { orbit: [1.55, 1.8, -0.42, 2.1] },
  { orbit: [1.05, 2.45, 0.7, 4.0] },
  { perch: perchAt(LEDGES[0][0], LEDGES[0][1], LEDGES[0][2] * 0.6), face: LEDGES[0][1] },
  { perch: perchAt(LEDGES[2][0], LEDGES[2][1], LEDGES[2][2] * 0.6), face: LEDGES[2][1] },
  { perch: [leanAt(H)[0] + 0.05, H + 0.06, leanAt(H)[1] + 0.05], face: 0.8 },
]
const SCATTER = 4.2 // seconds a scatter lasts

// how far out a gull is flung at s seconds after a tap: quick out, slow back
const flung = (s) => (s < 0 || s > SCATTER ? 0 : (1 - Math.exp(-4 * s)) * (1 - THREE.MathUtils.smoothstep(s, 1.6, SCATTER)))

function Gull({ spec, index, tap, clock, geo }) {
  const g = useRef()
  const st = useRef({ flap: 0, fold: 1, prev: new THREE.Vector3(), yaw: spec.face || 0, init: false })
  const dir = useMemo(() => {
    const a = index * 2.4 + 0.3
    return [Math.cos(a), 0.3 + (index % 3) * 0.12, Math.sin(a)]
  }, [index])
  const home = new THREE.Vector3()
  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const S = st.current
    const k = flung(tap.since(t) - index * 0.06)
    let flying = k > 0.02
    if (spec.orbit) {
      const [rad, h, sp, ph] = spec.orbit
      const a = t * sp + ph
      home.set(Math.cos(a) * rad, h + Math.sin(t * 1.3 + ph) * 0.08, Math.sin(a) * rad * 0.85)
      flying = true
    } else home.set(...spec.perch)
    const out = 1.0 + (spec.orbit ? 0.3 : 0)
    g.current.position.set(home.x + dir[0] * out * k, home.y + dir[1] * out * k + (spec.perch ? Math.sin(k * Math.PI) * 0.2 : 0), home.z + dir[2] * out * k)
    // face the way it is moving, or out to sea when sitting
    const d = g.current.position.clone().sub(S.prev)
    if (!S.init) {
      S.init = true
      d.set(0, 0, 0)
    }
    S.prev.copy(g.current.position)
    let target = S.yaw
    if (flying && d.x * d.x + d.z * d.z > 1e-7) target = Math.atan2(d.x, d.z)
    else if (!flying) target = Math.PI / 2 - spec.face + Math.sin(t * 0.7 + index) * 0.5
    let dy = ((target - S.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI
    S.yaw += dy * Math.min(1, dt * 6)
    g.current.rotation.set(flying ? -d.y * 6 : 0, S.yaw, flying && spec.orbit && k < 0.05 ? 0.3 : 0)
    // wings: glide and flap in the air, folded when sitting
    S.fold += ((flying ? 0 : 1) - S.fold) * Math.min(1, dt * 8)
    const beat = spec.orbit && k < 0.05 ? 0.35 * Math.max(0, Math.sin(t * 2.2 + index)) : 1
    S.flap = (0.15 + Math.sin(t * (spec.orbit && k < 0.05 ? 9 : 16) + index * 2) * 0.55 * beat) * (1 - S.fold) + S.fold * 0.1
  })
  return (
    <group ref={g} scale={1.6}>
      <mesh geometry={geo.body}>
        <Flat color="#f7f7f8" />
      </mesh>
      <mesh geometry={geo.head} position={[0, 0.03, 0.055]}>
        <Flat color="#ffffff" />
      </mesh>
      <mesh geometry={geo.beak} position={[0, 0.026, 0.09]} rotation-x={Math.PI / 2}>
        <Flat color="#f2b52a" />
      </mesh>
      <mesh geometry={geo.tail} position={[0, 0.005, -0.075]}>
        <Flat color="#d9dbe0" />
      </mesh>
      {[1, -1].map((side) => (
        <Wing key={side} side={side} span={0.15} chord={0.06} color="#b9bec8" tipColor="#2c2c34" position={[side * 0.018, 0.012, 0.005]} angle={() => st.current.flap} fold={() => st.current.fold} />
      ))}
      {spec.perch && (
        <group>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.leg} position={[x * 0.012, -0.03, 0]}>
              <Flat color="#e0902a" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

// Waves rolling in from all round: each crest is an arc that runs in toward
// the stack, rears up, and breaks on it with a throw of spray.
const WAVES = 7
const PERIOD = 2.6
function Surf({ clock }) {
  const crests = useRef([])
  const drops = useRef([])
  const geo = useGeo(
    () => ({
      crest: new THREE.TorusGeometry(1, 0.03, 3, 9, 1.1).rotateX(-Math.PI / 2).rotateY(-0.55),
      drop: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )
  const W = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: WAVES }, (_, i) => ({
      a: (i / WAVES) * TAU + r() * 0.4,
      off: r(),
      drops: Array.from({ length: 6 }, () => [(r() - 0.5) * 0.9, 0.9 + r() * 0.8, 0.3 + r() * 0.5, 0.6 + r() * 0.7]),
    }))
  }, [])
  useFrame(() => {
    const t = clock.elapsedTime
    W.forEach((w, i) => {
      const u = (t / PERIOD + w.off) % 1
      const m = crests.current[i]
      const rad = 1.6 - u * 1.0 // in to about the foot of the rock
      if (m) {
        const rise = THREE.MathUtils.smoothstep(u, 0.1, 0.8)
        const fade = Math.min(1, u * 6) * (1 - THREE.MathUtils.smoothstep(u, 0.82, 0.95))
        m.visible = fade > 0.01
        m.position.set(0, SEA_Y + 0.01 + rise * 0.03, 0)
        m.rotation.y = -w.a
        m.scale.set(rad, 0.8 + rise * 3.2, rad)
        m.material.opacity = 0.85 * fade
      }
      // the spray thrown up as it breaks
      const s = (u - 0.8) * PERIOD
      const cx = Math.cos(w.a)
      const cz = Math.sin(w.a)
      w.drops.forEach(([side, up, outv, sz], j) => {
        const d = drops.current[i * 6 + j]
        if (!d) return
        d.visible = s > 0 && s < 0.85
        if (!d.visible) return
        const r0 = 0.62 + outv * s * 0.8
        const px = cx * r0 - cz * side * 0.25
        const pz = cz * r0 + cx * side * 0.25
        d.position.set(px, SEA_Y + up * 1.4 * s - 2.6 * s * s + 0.04, pz)
        d.scale.setScalar(Math.max(0.001, 0.05 * sz * (1 - s / 0.85)))
      })
    })
  })
  return (
    <group>
      {W.map((w, i) => (
        <mesh key={i} ref={(el) => (crests.current[i] = el)} geometry={geo.crest}>
          <meshStandardMaterial color="#ffffff" flatShading roughness={0.5} transparent depthWrite={false} />
        </mesh>
      ))}
      {W.flatMap((w, i) =>
        w.drops.map((_, j) => (
          <mesh key={`${i}-${j}`} ref={(el) => (drops.current[i * 6 + j] = el)} geometry={geo.drop} visible={false}>
            <Flat color="#ffffff" emissive="#dff3ff" emissiveIntensity={0.3} />
          </mesh>
        )),
      )}
    </group>
  )
}

export function SeaStack({ look = 'granite' }) {
  const L = LOOKS[look] || LOOKS.granite
  const { tap, handlers, clock } = useTap(1)
  const foam = useRef()
  const geo = useGeo(
    () => ({
      stack: stackGeometry(L),
      small: facet(new THREE.CylinderGeometry(0.17, 0.27, 0.75, 7, 3).translate(0, 0.375, 0), 0.03, 8),
      ledge: facet(new THREE.CylinderGeometry(1, 0.8, 0.07, 7, 1), 0.08, 4, [1, 0.4, 1]),
      boulder: blob(1, 6, 0),
      foam: facet(new THREE.RingGeometry(0.5, 0.82, 14, 1).rotateX(-Math.PI / 2), 0.04, 3, [1, 0, 1]),
      seabed: facet(new THREE.CylinderGeometry(SEA_R, SEA_R * 1.02, 0.06, 20, 1).translate(0, 0.03, 0), 0.02, 2, [1, 0.3, 1]),
      body: facet(new THREE.IcosahedronGeometry(1, 0).scale(0.028, 0.026, 0.07), 0.003, 11),
      head: new THREE.IcosahedronGeometry(0.022, 0),
      beak: new THREE.ConeGeometry(0.008, 0.035, 4).translate(0, 0.017, 0),
      tail: new THREE.ConeGeometry(0.02, 0.05, 4).rotateX(-Math.PI / 2).scale(1, 0.4, 1),
      leg: new THREE.CylinderGeometry(0.003, 0.003, 0.03, 3),
    }),
    [look],
  )
  const boulders = useMemo(() => {
    const r = rng(14)
    return Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * TAU + r() * 0.5
      const d = 0.62 + r() * 0.25
      const s = 0.08 + r() * 0.08
      return { p: [Math.cos(a) * d, SEA_Y - s * 0.2, Math.sin(a) * d], s: [s * 1.2, s * 0.8, s], c: L.boulder[i % 2] }
    })
  }, [look]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const t = clock.elapsedTime
    if (foam.current) {
      const k = 0.5 + 0.5 * Math.sin(t * (TAU / PERIOD) * 2)
      foam.current.scale.set(1 + k * 0.08, 1, 1 + k * 0.08)
      foam.current.material.opacity = 0.65 + k * 0.25
    }
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.seabed}>
        <Flat color={L.edge} />
      </mesh>
      <Water radius={SEA_R} rings={6} segs={24} color={L.water} edge={L.edge} amp={0.03} speed={1.2} y={SEA_Y} />
      <Ripple loop period={2.6} count={3} color="#ffffff" radius={1.3} opacity={0.35} y={SEA_Y + 0.02} />

      {/* the stack, its ledges, the little stack and the boulders */}
      <mesh geometry={geo.stack}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {LEDGES.map(([y, a, s], i) => {
        const [lx, lz] = leanAt(y)
        const r = radiusAt(y) * 0.92
        return (
          <mesh key={i} geometry={geo.ledge} position={[lx + Math.cos(a) * r, y, lz + Math.sin(a) * r]} rotation-y={-a} scale={[s, 1, s * 0.8]}>
            <Flat color={i % 2 ? L.ledge : L.rock[2]} />
          </mesh>
        )
      })}
      <mesh geometry={geo.small} position={[0.95, 0.02, -0.55]}>
        <Flat color={L.rock[1]} />
      </mesh>
      <mesh geometry={geo.ledge} position={[0.95, 0.78, -0.55]} scale={[0.19, 1.2, 0.19]}>
        <Flat color={L.cap} />
      </mesh>
      {boulders.map((b, i) => (
        <mesh key={i} geometry={geo.boulder} position={b.p} scale={b.s} rotation-y={i * 1.3}>
          <Flat color={b.c} />
        </mesh>
      ))}

      {/* the surf: foam round the foot, breaking waves and a little mist */}
      <mesh ref={foam} geometry={geo.foam} position-y={SEA_Y + 0.035}>
        <meshStandardMaterial color="#ffffff" flatShading roughness={0.6} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.foam} position={[0.95, SEA_Y + 0.03, -0.55]} scale={0.5}>
        <meshStandardMaterial color="#ffffff" flatShading roughness={0.6} transparent opacity={0.7} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Surf clock={clock} />
      <Particles count={14} life={1.6} origin={[0, SEA_Y + 0.05, 0]} spread={0.6} velocity={[0, 0.25, 0]} scatter={0.15} drift={0.1} size={[0.03, 0.08]} colors={['#ffffff', '#e6f6ff']} opacity={[0.55, 0]} seed={4} />

      {/* the gulls */}
      {GULLS.map((spec, i) => (
        <Gull key={i} spec={spec} index={i} tap={tap} clock={clock} geo={geo} />
      ))}
    </group>
  )
}

export default function SeaStackScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[4.2, 2.9, 5.4]} target={[0, 1.0, 0]} hint="Waves roll in and break on the rock in bursts of spray, and gulls circle while others sit on the ledges · tap it and the gulls scatter over the sea, then wheel back and land again · Look swaps granite, sandstone and chalk · drag to orbit">
      <SeaStack {...props} />
    </Stage>
  )
}
