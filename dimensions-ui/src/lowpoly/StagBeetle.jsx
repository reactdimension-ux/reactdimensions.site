import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, cone, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly stag beetle on a mossy log: glossy wing cases split down the
// middle, a broad shield of a thorax, a wide head with two big hinged
// antler mandibles, elbowed antennae ending in little combs, and six jointed
// legs gripping the bark. Left alone its antennae twitch, its mandibles open
// slowly and close again, and every few seconds it shuffles a small step
// along the log. Tap it and it rears up on its back legs, flings its jaws
// wide and clacks them shut twice, then settles back down.

const LOOKS = {
  bronze: { shell: ['#9a6630', '#86561f', '#b07a3c'], body: '#5e3b22', jaw: '#8a5428', leg: '#2e1e14', gloss: 0.3 },
  black: { shell: ['#2e2b34', '#25232b', '#3a3642'], body: '#1d1b22', jaw: '#5a2c20', leg: '#17161b', gloss: 0.26 },
  rainbow: { shell: ['#2bb36e', '#1fb3a2', '#2b8fd6', '#4c63dc', '#7b4fd6'], body: '#1f5a4c', jaw: '#3c5f8a', leg: '#1c2830', gloss: 0.22, iri: true },
}

const LOG_R = 0.45
const LOG_Y = 0.4 // log axis height
const BS = 1.6 // beetle scale
const TOP = LOG_Y + LOG_R
const STEP = 4.2 // seconds between shuffles

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const UP = new THREE.Vector3(0, 1, 0)

// a chain of tapering faceted segments through points [[x, y, z, r], ...]
function chain(pts, seed) {
  return pts.slice(1).map((b, i) => {
    const a = pts[i]
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const g = facet(new THREE.CylinderGeometry(b[3], a[3], d.length() * 1.1, 5, 1).translate(0, d.length() / 2, 0), a[3] * 0.08, seed + i)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()))
    g.translate(a[0], a[1], a[2])
    return g
  })
}

// one wing case: half an ellipsoid, coloured per face (sheen bands for the iridescent look)
function elytronGeo(L, side) {
  const g = facet(new THREE.SphereGeometry(1, 8, 6, side > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI * 0.62), 0.04, side > 0 ? 3 : 4).toNonIndexed()
  g.computeVertexNormals()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  const r = rng(side > 0 ? 9 : 10)
  for (let f = 0; f < p.count; f += 3) {
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3
    let k = Math.floor(r() * L.shell.length)
    if (L.iri) k = Math.min(L.shell.length - 1, Math.floor(((1 - cz) / 2) * 3.2 + Math.abs(cx) * 1.4 + r() * 0.7))
    c.set(L.shell[k])
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

export function StagBeetle({ look = 'bronze' }) {
  const L = LOOKS[look] || LOOKS.bronze
  const { tap, handlers, clock } = useTap(1)
  const beetle = useRef()
  const rear = useRef()
  const jaws = useRef([])
  const ants = useRef([])
  const legs = useRef([])
  const flash = useRef([])

  const geo = useGeo(
    () => ({
      elyL: elytronGeo(L, -1),
      elyR: elytronGeo(L, 1),
      pronotum: facet(new THREE.IcosahedronGeometry(1, 1), 0.05, 5),
      head: facet(new THREE.IcosahedronGeometry(1, 1), 0.05, 6),
      eye: new THREE.IcosahedronGeometry(0.018, 0),
      jaw: chain(
        [
          [0, 0, 0, 0.026],
          [0.05, 0.015, 0.08, 0.023],
          [0.05, 0.035, 0.17, 0.018],
          [0.005, 0.048, 0.235, 0.013],
          [-0.045, 0.045, 0.26, 0.006],
        ],
        20,
      ),
      tine: cone(0.012, 0.05, 4, 7).rotateZ(Math.PI / 2),
      scape: facet(new THREE.CylinderGeometry(0.008, 0.01, 0.11, 4, 1).translate(0, 0.055, 0), 0.001, 2),
      funicle: facet(new THREE.CylinderGeometry(0.006, 0.008, 0.08, 4, 1).translate(0, 0.04, 0), 0.001, 3),
      lamella: new THREE.BoxGeometry(0.03, 0.008, 0.012),
      femur: facet(new THREE.CylinderGeometry(0.015, 0.02, 0.12, 4, 1).translate(0, 0.06, 0).rotateZ(-Math.PI / 2), 0.002, 4),
      tibia: facet(new THREE.CylinderGeometry(0.008, 0.014, 0.15, 4, 1).translate(0, 0.075, 0).rotateZ(-Math.PI / 2), 0.002, 5),
      star: new THREE.OctahedronGeometry(1, 0),
      log: facet(new THREE.CylinderGeometry(LOG_R, LOG_R * 1.04, 1.5, 9, 3).rotateZ(Math.PI / 2), 0.03, 8),
      cut: new THREE.CircleGeometry(LOG_R * 0.94, 9).rotateY(Math.PI / 2),
      ring: new THREE.RingGeometry(LOG_R * 0.45, LOG_R * 0.52, 9).rotateY(Math.PI / 2),
      moss: blob(0.12, 11),
      ground: terrainGeo({ radius: 1.25, height: 0.09, seed: 3, rings: 4, segs: 14, rough: 0.3, profile: 'dome', bands: [[0, '#6aa84a'], [0.5, '#7dbb55'], [0.85, '#8fc95f']] }),
      tuft: cone(0.03, 0.14, 3, 9),
      cap: facet(new THREE.SphereGeometry(0.07, 7, 3, 0, TAU, 0, Math.PI / 2), 0.004, 12),
      stalk: new THREE.CylinderGeometry(0.018, 0.022, 0.07, 5, 1).translate(0, 0.035, 0),
      hit: new THREE.BoxGeometry(0.6, 0.45, 0.95).translate(0, 0.12, 0.08),
    }),
    [look],
  )

  // legs: [z along the body, yaw splay, femur lift, tibia drop, tripod group]
  const LEGS = [
    [0.17, -0.75, 0.4, -2.3, 0],
    [0.0, 0.05, 0.42, -2.35, 1],
    [-0.12, 0.7, 0.4, -2.3, 0],
  ]
  const tufts = useMemo(() => {
    const r = rng(17)
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * TAU + r() * 0.3
      const d = 0.75 + r() * 0.35
      return { p: [Math.cos(a) * d, 0.04, Math.sin(a) * d], s: 0.7 + r() * 0.7, ry: r() * TAU, c: i % 2 ? '#4f9a3c' : '#5fae48' }
    })
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const active = s >= 0 && s < 2.6

    // the shuffle: every few seconds a two-beat tripod step, forward then back next time
    const n = Math.floor(t / STEP)
    const w = (t % STEP) / 0.7 // 0..1 over the step, then it rests
    const dir = n % 2 ? -1 : 1
    const prog = smooth(w)
    const baseZ = (n % 2 ? 0.04 : 0) + dir * 0.04 * prog
    beetle.current.position.set(0.0 + baseZ, TOP + 0.135 + (w < 1 ? Math.sin(w * TAU) * 0.004 : 0), 0)

    // tap: rear up, fling the jaws wide, clack twice, settle
    const rearAmt = active ? smooth(s / 0.35) * (1 - smooth((s - 1.7) / 0.8)) : 0
    rear.current.rotation.x = -0.55 * rearAmt
    rear.current.position.y = 0.02 * rearAmt
    // the jaws: open slowly and close at rest; wide, snap, wide, snap on a tap
    let open = 0.12 + 0.3 * smooth(0.5 + 0.5 * Math.sin(t * 0.55))
    let clack = -1
    if (active) {
      const wide = 0.75
      if (s < 0.4) open = open + (wide - open) * smooth(s / 0.4)
      else if (s < 0.5) open = wide
      else if (s < 0.58) open = wide * (1 - (s - 0.5) / 0.08) - 0.08 * ((s - 0.5) / 0.08)
      else if (s < 0.85) open = -0.08 + (wide + 0.08) * smooth((s - 0.58) / 0.27)
      else if (s < 0.93) open = wide * (1 - (s - 0.85) / 0.08) - 0.08 * ((s - 0.85) / 0.08)
      else open = -0.08 + 0.2 * smooth((s - 0.93) / 1.4)
      if (s >= 0.58 && s < 0.78) clack = (s - 0.58) / 0.2
      if (s >= 0.93 && s < 1.13) clack = (s - 0.93) / 0.2
    }
    jaws.current.forEach((m) => m && (m.rotation.y = open))
    flash.current.forEach((m, i) => {
      if (!m) return
      m.visible = clack >= 0
      if (!m.visible) return
      m.scale.setScalar(0.02 + 0.05 * Math.sin(Math.PI * clack) * (i ? 0.7 : 1))
      m.rotation.set(clack * 3, clack * 4 + i, 0)
    })

    // antennae: a nervous twitch now and then, wilder when it rears
    ants.current.forEach((a, i) => {
      if (!a) return
      const tw = Math.max(0, Math.sin(t * 1.3 + i * 2.1)) ** 6
      a.rotation.x = -0.25 + 0.25 * tw * Math.sin(t * 30 + i) + 0.08 * Math.sin(t * 1.7 + i) - 0.3 * rearAmt
      a.rotation.z = (i ? 1 : -1) * (0.1 * Math.sin(t * 2.3 + i * 1.3) + 0.15 * tw * Math.sin(t * 24))
    })

    // legs: the stepping tripods; front legs paw the air when reared
    legs.current.forEach((l, k) => {
      if (!l) return
      const [, yaw, lift, drop, grp] = LEGS[k % 3]
      const side = k < 3 ? 1 : -1
      const tri = (grp + (side < 0 ? 1 : 0)) % 2
      const u = tri ? w * 2 - 1 : w * 2
      const up = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0
      const sw = u <= 0 ? 0 : u >= 1 ? 1 : smooth(u)
      l.hip.rotation.y = yaw - dir * 0.2 * (sw - 0.5)
      const paw = k % 3 === 0 ? rearAmt * (0.6 + 0.3 * Math.sin(t * 12 + side)) : k % 3 === 1 ? rearAmt * 0.2 : 0
      l.femur.rotation.z = lift + up * 0.35 + paw
      l.tibia.rotation.z = drop + up * 0.2 + paw * 0.6
    })
  })

  const legRef = (k, part) => (el) => {
    if (!legs.current[k]) legs.current[k] = {}
    legs.current[k][part] = el
  }
  const gloss = { roughness: L.gloss, metalness: 0.25 }

  return (
    <group {...handlers} rotation-y={-0.7}>
      <mesh geometry={geo.ground}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {tufts.map((k, i) => (
        <mesh key={i} geometry={geo.tuft} position={k.p} rotation-y={k.ry} scale={[k.s, k.s * 1.2, k.s]}>
          <Flat color={k.c} />
        </mesh>
      ))}

      {/* the log, lying along x */}
      <group position-y={LOG_Y}>
        <mesh geometry={geo.log}>
          <Flat color="#7a5236" />
        </mesh>
        {[-1, 1].map((x) => (
          <group key={x} position-x={x * 0.751} rotation-y={x > 0 ? 0 : Math.PI}>
            <mesh geometry={geo.cut}>
              <Flat color="#d9b07a" />
            </mesh>
            <mesh geometry={geo.ring} position-x={0.002}>
              <Flat color="#b08452" />
            </mesh>
          </group>
        ))}
        {/* moss patches: [x along the log, angle round it from the top, size] */}
        {[
          [-0.5, 0.15, 1.3],
          [-0.25, -0.55, 1],
          [0.5, -0.35, 1.2],
          [0.6, 0.75, 0.9],
          [-0.6, 1.0, 0.8],
          [0.15, 1.15, 0.8],
          [-0.15, 0.6, 0.7],
        ].map(([x, a, s], i) => (
          <mesh key={i} geometry={geo.moss} position={[x, Math.cos(a) * LOG_R, Math.sin(a) * LOG_R]} rotation-x={a} scale={[s * 1.4, s * 0.4, s]}>
            <Flat color={i % 2 ? '#5aa646' : '#6cb752'} />
          </mesh>
        ))}
      </group>
      {/* a few little mushrooms beside the log */}
      {[
        [0.42, 0.6, 1, 0.1],
        [0.56, 0.52, 0.7, -0.2],
        [-0.62, -0.58, 0.85, 0.15],
      ].map(([x, z, s, rz], i) => (
        <group key={i} position={[x, 0.06, z]} rotation-z={rz} scale={s}>
          <mesh geometry={geo.stalk}>
            <Flat color="#f2e8d6" />
          </mesh>
          <mesh geometry={geo.cap} position-y={0.06} scale={[1, 0.7, 1]}>
            <Flat color="#e0743c" />
          </mesh>
        </group>
      ))}

      {/* the beetle, walking along the log (+z is its front) */}
      <group ref={beetle} rotation-y={Math.PI / 2} scale={BS}>
        <group ref={rear} position-z={-0.14}>
          <group position-z={0.14}>
            <mesh geometry={geo.elyR} position={[0.004, -0.01, -0.09]} scale={[0.15, 0.11, 0.25]}>
              <Flat vertexColors color="#ffffff" side={THREE.DoubleSide} {...gloss} />
            </mesh>
            <mesh geometry={geo.elyL} position={[-0.004, -0.01, -0.09]} scale={[0.15, 0.11, 0.25]}>
              <Flat vertexColors color="#ffffff" side={THREE.DoubleSide} {...gloss} />
            </mesh>
            {/* underside */}
            <mesh geometry={geo.pronotum} position={[0, -0.03, -0.06]} scale={[0.12, 0.05, 0.22]}>
              <Flat color={L.body} />
            </mesh>
            <mesh geometry={geo.pronotum} position={[0, 0.0, 0.18]} scale={[0.14, 0.075, 0.085]}>
              <Flat color={L.body} {...gloss} />
            </mesh>
            <mesh geometry={geo.head} position={[0, 0.0, 0.29]} scale={[0.125, 0.055, 0.07]}>
              <Flat color={L.body} {...gloss} />
            </mesh>
            {[-1, 1].map((x) => (
              <mesh key={x} geometry={geo.eye} position={[x * 0.115, 0.015, 0.3]}>
                <Flat color="#0f0e12" roughness={0.15} />
              </mesh>
            ))}
            {/* mandibles, hinged at the front of the head */}
            {[1, -1].map((x, i) => (
              <group key={x} position={[x * 0.07, 0.0, 0.33]} scale={[x * 1.25, 1.25, 1.25]}>
                <group ref={(el) => (jaws.current[i] = el)}>
                  {geo.jaw.map((g, j) => (
                    <mesh key={j} geometry={g}>
                      <Flat color={L.jaw} {...gloss} />
                    </mesh>
                  ))}
                  <mesh geometry={geo.tine} position={[0.035, 0.03, 0.15]} rotation-y={-0.3}>
                    <Flat color={L.jaw} {...gloss} />
                  </mesh>
                </group>
              </group>
            ))}
            {[0, 1].map((i) => (
              <mesh key={i} ref={(el) => (flash.current[i] = el)} geometry={geo.star} position={[0, 0.07, 0.66 + i * 0.02]} visible={false}>
                <meshBasicMaterial color={i ? '#ffe9a8' : '#ffffff'} toneMapped={false} />
              </mesh>
            ))}
            {/* elbowed antennae: a long scape, then the bent club */}
            {[1, -1].map((x, i) => (
              <group key={x} position={[x * 0.05, 0.03, 0.33]} scale={[x, 1, 1]}>
                <group rotation={[0.5, 0, -0.75]}>
                  <mesh geometry={geo.scape}>
                    <Flat color={L.leg} />
                  </mesh>
                  <group ref={(el) => (ants.current[i] = el)} position-y={0.11}>
                    <group rotation={[1.0, 0, 0.6]}>
                      <mesh geometry={geo.funicle}>
                        <Flat color={L.leg} />
                      </mesh>
                      {[0, 1, 2].map((j) => (
                        <mesh key={j} geometry={geo.lamella} position={[0.012, 0.075 + j * 0.012, 0]}>
                          <Flat color={L.jaw} />
                        </mesh>
                      ))}
                    </group>
                  </group>
                </group>
              </group>
            ))}
            {/* six jointed legs */}
            {[1, -1].map((x, si) =>
              LEGS.map(([z], j) => {
                const k = si * 3 + j
                return (
                  <group key={k} position={[x * 0.07, -0.03, z]} scale={[x, 1, 1]}>
                    <group ref={legRef(k, 'hip')}>
                      <group ref={legRef(k, 'femur')}>
                        <mesh geometry={geo.femur}>
                          <Flat color={L.leg} {...gloss} />
                        </mesh>
                        <group position-x={0.12} ref={legRef(k, 'tibia')}>
                          <mesh geometry={geo.tibia}>
                            <Flat color={L.leg} {...gloss} />
                          </mesh>
                        </group>
                      </group>
                    </group>
                  </group>
                )
              }),
            )}
          </group>
        </group>
        <Burst tap={tap} geometry={geo.star} count={10} colors={['#d9b07a', '#a87a4a']} speed={0.8} gravity={4} size={0.02} life={0.9} origin={[0, -0.08, 0]} spread={0.9} up={0.8} />
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    </group>
  )
}

export default function StagBeetleScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.8, 2.1, 3.9]} target={[0, 0.82, 0]} hint="The stag beetle sits on its mossy log, antennae twitching and mandibles opening slowly, shuffling a step now and then · tap it and it rears up and clacks its mandibles twice · Look swaps bronze, black and iridescent rainbow · drag to orbit">
      <StagBeetle {...props} />
    </Stage>
  )
}
