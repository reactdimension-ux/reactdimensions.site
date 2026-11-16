import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Ripple, Stage, TAU, cone, facet, polarGrid, rng, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly water tower on a round of grass: a round tank (a bulging
// wooden barrel, a riveted steel drum or a painted can with a stripe) under
// a cone roof, standing on a deck held up by four splayed legs with cross
// braces, and a ladder running up the front. Left alone, a little spout on
// the side drips: a drop swells, lets go, falls and plinks into a puddle
// in the grass, sending out rings. Tap it and the tank sloshes on its legs
// and a leak springs out of the side in a spraying arc, splashing on the
// grass, until the pressure drops and it stops.

const LOOKS = {
  classic: { tank: '#b07a45', stave: 0.16, bulge: 0.07, band: '#3d3a3f', bands: [0.12, 0.5, 0.88], bandW: 0.035, roof: '#7a4b30', leg: '#8a5a36', brace: '#74492b', deck: '#6e4630', ladder: '#5a3a24' },
  rust: { tank: '#b4582f', stave: 0.08, bulge: 0, band: '#7c3a22', bands: [0.04, 0.36, 0.68, 0.96], bandW: 0.025, roof: '#8f4527', leg: '#6d7078', brace: '#5b5e66', deck: '#53565d', ladder: '#474950' },
  painted: { tank: '#a9d8e6', stave: 0.03, bulge: 0, band: '#f4a3b6', bands: [0.5], bandW: 0.16, roof: '#f6e7c8', leg: '#efedf5', brace: '#d8d3e6', deck: '#c9c2da', ladder: '#bdb5d1' },
}

const LEG_H = 1.2 // the deck's height
const TR = 0.42 // the tank's radius
const TH = 0.58 // and its height
const TANK_Y = LEG_H + 0.06
const SPOUT = [0.62, TANK_Y + 0.12, 0.0] // the spout's tip
const PUDDLE = [SPOUT[0], 0.105, SPOUT[2]]
const DRIP = 2.4 // seconds between drops
const LEAK_DIR = new THREE.Vector3(-0.8, 0, 0.6) // the leak faces left of the camera
const LEAK = LEAK_DIR.clone().multiplyScalar(TR + 0.01).setY(TANK_Y + 0.2)
const SPRAY = [0.18, 1.7] // seconds after a tap the leak runs
const NSPRAY = 40
const CYCLE = 0.75 // a spray drop's longest flight
const G = 7

// A beam from a to b, as a position, a rotation and a length.
function strut(a, b) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = B.clone().sub(A)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())
  return { p: A.add(B).multiplyScalar(0.5).toArray(), q, len: d.length() }
}

// The tank: a lathe with a bulge, every stave its own shade.
function tankGeo(L) {
  const pts = []
  for (let i = 0; i <= 6; i++) {
    const v = i / 6
    pts.push(new THREE.Vector2(TR * (1 + L.bulge * Math.sin(Math.PI * v)), v * TH))
  }
  const g = new THREE.LatheGeometry(pts, 16).toNonIndexed()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  const r = rng(7)
  const shade = Array.from({ length: 16 }, () => 1 - L.stave / 2 + r() * L.stave)
  for (let f = 0; f < p.count; f += 3) {
    const a = Math.atan2(p.getX(f) + p.getX(f + 1) + p.getX(f + 2), p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2))
    const k = Math.floor((((a / TAU) % 1) + 1) % 1 * 16) % 16
    c.set(L.tank).multiplyScalar(shade[k])
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

export function WaterTower({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(1.2)
  const tank = useRef()
  const drop = useRef()
  const rings = useRef([])
  const spray = useRef([])
  const jet = useRef()

  const geo = useGeo(
    () => ({
      grass: facet(new THREE.CylinderGeometry(1.05, 1.12, 0.1, 12, 1).translate(0, 0.05, 0), 0.025, 1, [1, 0.3, 1]),
      tuft: cone(0.06, 0.14, 4, 5),
      stone: facet(new THREE.DodecahedronGeometry(0.07, 0), 0.015, 6).scale(1, 0.6, 1),
      puddle: polarGrid(0.2, 2, 9, () => 0, 0.35, 8),
      beam: new THREE.BoxGeometry(1, 1, 1),
      deck: facet(new THREE.CylinderGeometry(0.54, 0.54, 0.06, 10, 1), 0.006, 3),
      tank: tankGeo(L),
      lid: new THREE.CylinderGeometry(TR, TR, 0.02, 16, 1),
      band: new THREE.CylinderGeometry(1, 1, 1, 16, 1, true),
      roof: cone(TR + 0.08, 0.32, 16, 4),
      finial: new THREE.OctahedronGeometry(0.045, 0),
      pipe: new THREE.CylinderGeometry(0.025, 0.025, 1, 6, 1),
      drop: new THREE.IcosahedronGeometry(1, 0).scale(1, 1.4, 1),
      ring: new THREE.RingGeometry(0.8, 1, 16, 1).rotateX(-Math.PI / 2),
      hole: new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6, 1).rotateZ(Math.PI / 2),
    }),
    [look],
  )

  // the legs splay out a little at the foot; braces cross each face
  const frame = useMemo(() => {
    const top = 0.3
    const foot = 0.4
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]]
    const at = (c, y) => {
      const w = foot + (top - foot) * (y / LEG_H)
      return [c[0] * w, y, c[1] * w]
    }
    const legs = corners.map((c) => strut(at(c, 0.08), at(c, LEG_H)))
    const braces = []
    corners.forEach((c, i) => {
      const n = corners[(i + 1) % 4]
      braces.push(strut(at(c, 0.62), at(n, 0.62)))
      braces.push(strut(at(c, 0.18), at(n, 0.62)), strut(at(n, 0.18), at(c, 0.62)))
      braces.push(strut(at(c, 0.62), at(n, 1.14)), strut(at(n, 0.62), at(c, 1.14)))
    })
    return { legs, braces }
  }, [])

  // the ladder on the front (+z), from the grass up the deck and the tank
  const ladder = useMemo(() => {
    const z = 0.6
    const top = TANK_Y + TH
    const rungs = []
    for (let y = 0.25; y < top - 0.05; y += 0.13) rungs.push(y)
    return { z, top, rungs }
  }, [])

  const drops = useMemo(() => {
    const r = rng(21)
    return Array.from({ length: NSPRAY }, (_, i) => ({ off: i / NSPRAY, v: 0.85 + r() * 0.3, side: (r() - 0.5) * 0.16, s: 0.7 + r() * 0.6 }))
  }, [])
  const side = useMemo(() => new THREE.Vector3(0, 1, 0).cross(LEAK_DIR).normalize(), [])
  const splash = useMemo(() => ({ since: (t) => tap.since(t) - SPRAY[0] - 0.75 }), [tap])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the slosh: the tank rocks on the deck and settles
    const w = s >= 0 ? 1 : 0
    tank.current.rotation.z = 0.07 * wobble(s, 8, 1.8) * w
    tank.current.rotation.x = 0.05 * wobble(s - 0.06, 10, 2) * w
    tank.current.scale.y = 1 + 0.04 * wobble(s, 16, 3) * w

    // the drip: swell at the spout, let go, fall, plink
    const u = t % DRIP
    const d = drop.current
    const swell = 1.4
    if (u < swell) {
      const k = u / swell
      d.position.set(SPOUT[0], SPOUT[1] - 0.04 - k * 0.02, SPOUT[2])
      d.scale.setScalar(0.006 + 0.034 * k ** 1.5)
    } else {
      const f = u - swell
      const y = SPOUT[1] - 0.06 - 0.5 * 6 * f * f
      d.position.set(SPOUT[0], Math.max(PUDDLE[1], y), SPOUT[2])
      d.scale.set(0.04, 0.04 * (1 + f * 1.5), 0.04)
      d.visible = y > PUDDLE[1]
    }
    if (u < swell) d.visible = true
    const fallT = Math.sqrt((2 * (SPOUT[1] - 0.06 - PUDDLE[1])) / 6)
    const hit = (u - swell - fallT + DRIP) % DRIP
    rings.current.forEach((m, i) => {
      if (!m) return
      const a = (hit - i * 0.22) / 1.1
      m.visible = a >= 0 && a < 1
      if (!m.visible) return
      m.scale.setScalar(0.03 + a * 0.17)
      m.material.opacity = 0.7 * (1 - a) ** 1.4
    })

    // the leak: a stream of drops, each thrown out when it was emitted,
    // weaker as the pressure drops
    spray.current.forEach((m, i) => {
      if (!m) return
      const p = drops[i]
      const age = (((s + p.off * CYCLE) % CYCLE) + CYCLE) % CYCLE
      const e = s - age // when it left the hole
      const on = s >= 0 && e >= SPRAY[0] && e <= SPRAY[1]
      const pr = on ? 1 - 0.65 * ((e - SPRAY[0]) / (SPRAY[1] - SPRAY[0])) ** 1.5 : 0
      const y = LEAK.y + 0.5 * pr * p.v * age - 0.5 * G * age * age
      m.visible = on && y > 0.1
      if (!m.visible) return
      const h = 0.82 * pr * p.v * age
      m.position.set(LEAK.x + LEAK_DIR.x * h + side.x * p.side * age, y, LEAK.z + LEAK_DIR.z * h + side.z * p.side * age)
      m.scale.setScalar(0.03 * p.s * (1 - age / CYCLE * 0.4))
      m.rotation.set(age * 9, age * 5, 0)
    })
    // the hole is only there while it leaks
    jet.current.visible = s >= SPRAY[0] - 0.05 && s < SPRAY[1] + 0.2
  })

  const water = '#7cc6ec'
  return (
    <group {...handlers}>
      {/* the grass, a few tufts and stones, and the puddle under the spout */}
      <mesh geometry={geo.grass}>
        <Flat color="#73b552" />
      </mesh>
      {[[-0.7, 0.4, 1], [0.35, 0.78, 0.8], [-0.2, -0.82, 1.1], [0.82, -0.45, 0.9], [-0.86, -0.3, 0.7]].map(([x, z, k], i) => (
        <mesh key={i} geometry={geo.tuft} position={[x, 0.1, z]} scale={k} rotation-y={i}>
          <Flat color={i % 2 ? '#5f9e44' : '#86c463'} />
        </mesh>
      ))}
      {[[0.62, 0.55], [-0.55, -0.7]].map(([x, z], i) => (
        <mesh key={i} geometry={geo.stone} position={[x, 0.12, z]} rotation-y={i * 2}>
          <Flat color="#a7a3ad" />
        </mesh>
      ))}
      <mesh geometry={geo.puddle} position={PUDDLE}>
        <meshStandardMaterial color={water} flatShading roughness={0.2} metalness={0.1} />
      </mesh>
      <group position={[PUDDLE[0], PUDDLE[1] + 0.006, PUDDLE[2]]}>
        {[0, 1].map((i) => (
          <mesh key={i} ref={(el) => (rings.current[i] = el)} geometry={geo.ring} visible={false}>
            <meshBasicMaterial color="#ffffff" transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* the legs and their braces */}
      {frame.legs.map((b, i) => (
        <mesh key={i} geometry={geo.beam} position={b.p} quaternion={b.q} scale={[0.07, b.len, 0.07]}>
          <Flat color={L.leg} />
        </mesh>
      ))}
      {frame.braces.map((b, i) => (
        <mesh key={i} geometry={geo.beam} position={b.p} quaternion={b.q} scale={[0.03, b.len, 0.03]}>
          <Flat color={L.brace} />
        </mesh>
      ))}
      <mesh geometry={geo.deck} position-y={LEG_H + 0.03}>
        <Flat color={L.deck} />
      </mesh>

      {/* the ladder up the front */}
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} geometry={geo.beam} position={[x, ladder.top / 2 + 0.05, ladder.z]} scale={[0.025, ladder.top - 0.1, 0.025]}>
          <Flat color={L.ladder} />
        </mesh>
      ))}
      {[[LEG_H + 0.03, 0.5], [TANK_Y + TH - 0.08, TR]].flatMap(([y, z0]) =>
        [-0.09, 0.09].map((x) => (
          <mesh key={y + '' + x} geometry={geo.beam} position={[x, y, (z0 + ladder.z) / 2]} scale={[0.022, 0.022, ladder.z - z0 + 0.02]}>
            <Flat color={L.ladder} />
          </mesh>
        )),
      )}
      {ladder.rungs.map((y) => (
        <mesh key={y} geometry={geo.beam} position={[0, y, ladder.z]} scale={[0.18, 0.018, 0.022]}>
          <Flat color={L.ladder} />
        </mesh>
      ))}

      {/* the tank and roof, rocking together on the deck */}
      <group ref={tank} position-y={TANK_Y}>
        <mesh geometry={geo.tank}>
          <Flat vertexColors color="#ffffff" roughness={look === 'classic' ? 0.85 : 0.55} metalness={look === 'rust' ? 0.25 : 0} />
        </mesh>
        <mesh geometry={geo.lid} position-y={TH}>
          <Flat color={L.tank} />
        </mesh>
        {L.bands.map((v) => {
          const r = TR * (1 + L.bulge * Math.sin(Math.PI * v)) + 0.008
          return (
            <mesh key={v} geometry={geo.band} position-y={v * TH} scale={[r, L.bandW, r]}>
              <Flat color={L.band} side={THREE.DoubleSide} metalness={look === 'painted' ? 0 : 0.3} roughness={0.6} />
            </mesh>
          )
        })}
        <mesh geometry={geo.roof} position-y={TH}>
          <Flat color={L.roof} />
        </mesh>
        <mesh geometry={geo.finial} position-y={TH + 0.35}>
          <Flat color={L.band} />
        </mesh>
        {/* the dripping spout: out from the side, then down */}
        <mesh geometry={geo.pipe} position={[(TR + SPOUT[0]) / 2, SPOUT[1] - TANK_Y + 0.04, 0]} rotation-z={Math.PI / 2} scale={[1, SPOUT[0] - TR + 0.02, 1]}>
          <Flat color={L.band} metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh geometry={geo.pipe} position={[SPOUT[0], SPOUT[1] - TANK_Y, 0]} scale={[1, 0.08, 1]}>
          <Flat color={L.band} metalness={0.3} roughness={0.5} />
        </mesh>
      </group>
      <mesh ref={drop} geometry={geo.drop}>
        <meshStandardMaterial color={water} flatShading roughness={0.15} emissive={water} emissiveIntensity={0.2} />
      </mesh>

      {/* the leak and its spray */}
      <mesh ref={jet} geometry={geo.hole} position={LEAK.toArray()} rotation-y={Math.atan2(-LEAK_DIR.z, LEAK_DIR.x)} visible={false}>
        <Flat color="#2a2530" />
      </mesh>
      {drops.map((_, i) => (
        <mesh key={i} ref={(el) => (spray.current[i] = el)} geometry={geo.drop} visible={false}>
          <meshStandardMaterial color={water} flatShading roughness={0.15} emissive={water} emissiveIntensity={0.25} />
        </mesh>
      ))}
      <group position={[LEAK.x + LEAK_DIR.x * 0.5, 0, LEAK.z + LEAK_DIR.z * 0.5]}>
        <Ripple tap={splash} count={3} color="#ffffff" radius={0.45} life={1.2} y={0.106} opacity={0.6} />
      </group>
    </group>
  )
}

export default function WaterTowerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.4, 4.8]} target={[0, 0.95, 0]} hint="A slow drip falls from the spout and rings out across the puddle below · tap the tower and the tank sloshes on its legs while a leak sprays out in an arc, then dies away · Look swaps classic, rust and painted · drag to orbit">
      <WaterTower {...props} />
    </Stage>
  )
}
