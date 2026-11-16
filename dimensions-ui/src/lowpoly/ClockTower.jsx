import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, TAU, blob, facet, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly clock tower on a little town square: a tall block shaft with
// dressed corner stones, a clock face on all four sides with real hands, an
// open arched belfry with a bronze bell, a pointed roof and a weather vane.
// The hands tick round on fast-forwarded time, the vane veers in the breeze
// and pigeons bob on the ledges. Tap it and the bell swings and rings,
// throwing out rings of sound, while the pigeons flutter up and circle the
// tower before settling again.

const LOOKS = {
  stone: { ground: '#c9c3b6', ground2: '#b4ad9e', wall: '#d8cdb4', quoin: '#ece4cf', trim: '#a39678', roof: '#4f6584', face: '#f8f3e4', rim: '#c9a246', hand: '#1f2230', door: '#6a4630', bell: '#d6a23a', snow: false },
  brick: { ground: '#bdb6aa', ground2: '#a8a194', wall: '#b85a3f', quoin: '#eadcc0', trim: '#e0cfac', roof: '#5f9c87', face: '#fcf6e6', rim: '#d1a640', hand: '#2a1d18', door: '#3f5a3a', bell: '#cf9a32', snow: false },
  snow: { ground: '#f2f5fa', ground2: '#e1e7f0', wall: '#c9cdd8', quoin: '#e4e7ee', trim: '#8f97aa', roof: '#f6f8fc', face: '#fffaf0', rim: '#c9a246', hand: '#26304a', door: '#8a3a2e', bell: '#d6a23a', snow: true },
}

const S = 0.62 // shaft width
const Y0 = 0.16 // top of the plinth
const Y1 = 1.5 // top of the shaft
const CY = 1.78 // clock centre
const B0 = 2.06 // belfry floor
const B1 = 2.5 // belfry top
const R0 = 2.56 // roof base
const RH = 0.78 // roof height
const SWING = 5.5 // bell swing rate (rad/s)
const FLIGHT = 3.4 // seconds the pigeons are up

// the pigeons' perches: position, and the way each one faces
const PERCH = [
  [0.14, B0, 0.38, 0],
  [0.38, B0, -0.08, Math.PI / 2],
  [-0.36, B0, 0.2, -Math.PI / 2],
  [-0.34, Y0, 0.47, 0.2],
]

// a pyramid roof whose flat sides line up with the square shaft
function roofGeo(half, h) {
  return new THREE.ConeGeometry(half * Math.SQRT2, h, 4, 1).rotateY(Math.PI / 4).translate(0, h / 2, 0)
}

// one side of the belfry: a wall panel with an arched opening through it
function archGeo(w, h, d) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.lineTo(-w / 2, h)
  s.closePath()
  const r = 0.15
  const hole = new THREE.Path()
  hole.moveTo(-r, 0.05)
  hole.lineTo(r, 0.05)
  hole.lineTo(r, 0.22)
  hole.absarc(0, 0.22, r, 0, Math.PI, false)
  hole.lineTo(-r, 0.05)
  s.holes.push(hole)
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -d / 2)
}

// the clock's time, fast-forwarded: the minute hand steps every 0.45 s and
// settles with a small bounce, like a real tower clock
function clockMinutes(t) {
  const p = t / 0.45
  const n = Math.floor(p)
  const f = p - n
  const step = f < 0.1 ? f / 0.1 : 1 + 0.18 * Math.exp(-(f - 0.1) * 22) * Math.sin((f - 0.1) * 55)
  return 10 * 60 + 8 + (n + step) * 2
}

function ClockFace({ geo, L, hands, k, ...props }) {
  return (
    <group {...props}>
      <mesh geometry={geo.dial}>
        <Flat color={L.face} emissive={L.face} emissiveIntensity={0.18} />
      </mesh>
      <mesh geometry={geo.rim}>
        <Flat color={L.rim} metalness={0.45} roughness={0.4} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * TAU
        const big = i % 3 === 0
        return (
          <mesh key={i} geometry={geo.tick} position={[Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0.014]} rotation-z={-a} scale={big ? [1.5, 1.5, 1] : [1, 1, 1]}>
            <Flat color={L.hand} />
          </mesh>
        )
      })}
      <group ref={(el) => (hands.current[k * 2] = el)} position-z={0.02}>
        <mesh geometry={geo.hour}>
          <Flat color={L.hand} />
        </mesh>
      </group>
      <group ref={(el) => (hands.current[k * 2 + 1] = el)} position-z={0.028}>
        <mesh geometry={geo.minute}>
          <Flat color={L.hand} />
        </mesh>
      </group>
      <mesh geometry={geo.cap} position-z={0.034}>
        <Flat color={L.rim} metalness={0.45} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Pigeon({ geo, wings, head, ...props }) {
  return (
    <group {...props}>
      <mesh geometry={geo.pBody} position-y={0.04}>
        <Flat color="#9097a8" />
      </mesh>
      <group ref={head} position={[0, 0.06, 0.03]}>
      <group position={[0, -0.06, -0.03]}>
      <mesh geometry={geo.pHead} position={[0, 0.085, 0.045]}>
        <Flat color="#6c7389" />
      </mesh>
      <mesh geometry={geo.pNeck} position={[0, 0.065, 0.035]}>
        <Flat color="#5c8f86" />
      </mesh>
      <mesh geometry={geo.pBeak} position={[0, 0.082, 0.075]} rotation-x={Math.PI / 2}>
        <Flat color="#e5ad86" />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} geometry={geo.pEye} position={[x * 0.018, 0.092, 0.058]}>
          <Flat color="#1b1a22" roughness={0.3} />
        </mesh>
      ))}
      </group>
      </group>
      <mesh geometry={geo.pTail} position={[0, 0.045, -0.06]} rotation-x={-0.25}>
        <Flat color="#5f667a" />
      </mesh>
      {[-1, 1].map((x, i) => (
        <group key={x} ref={(el) => (wings[i] = el)} position={[x * 0.028, 0.06, -0.005]}>
          <mesh geometry={geo.pWing} position-x={x * 0.04}>
            <Flat color="#7b8296" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={x} geometry={geo.pLeg} position={[x * 0.012, 0.008, 0.005]}>
          <Flat color="#d98a78" />
        </mesh>
      ))}
    </group>
  )
}

export function ClockTower({ look = 'stone' }) {
  const L = LOOKS[look] || LOOKS.stone
  const { tap, handlers, clock } = useTap(1)
  const hands = useRef([])
  const bell = useRef()
  const clapper = useRef()
  const vane = useRef()
  const rings = useRef([])
  const birds = useRef([])
  const wings = useMemo(() => PERCH.map(() => []), [])
  const heads = useRef([])
  const v0 = useMemo(() => new THREE.Vector3(), [])
  const v1 = useMemo(() => new THREE.Vector3(), [])

  const geo = useGeo(
    () => ({
      square: facet(new THREE.BoxGeometry(1.7, 0.06, 1.7, 3, 1, 3).translate(0, 0.03, 0), 0.012, 1, [1, 0.3, 1], (x, y) => y < 0.001),
      kerb: new THREE.BoxGeometry(1.78, 0.04, 0.1),
      plinth: facet(new THREE.BoxGeometry(0.86, 0.1, 0.86).translate(0, 0.11, 0), 0.006, 2),
      shaft: facet(new THREE.BoxGeometry(S, Y1 - Y0, S, 2, 5, 2).translate(0, (Y1 + Y0) / 2, 0), 0.006, 3),
      quoin: facet(new THREE.BoxGeometry(1, 1, 1), 0.04, 4),
      band: new THREE.BoxGeometry(1, 1, 1),
      clockBox: facet(new THREE.BoxGeometry(0.68, 0.52, 0.68).translate(0, 0.26, 0), 0.005, 5),
      arch: archGeo(0.62, B1 - B0, 0.07),
      pillar: facet(new THREE.BoxGeometry(0.11, B1 - B0, 0.11).translate(0, (B1 - B0) / 2, 0), 0.006, 6),
      roof: roofGeo(0.42, RH),
      eave: new THREE.BoxGeometry(0.86, 0.06, 0.86),
      door: new THREE.BoxGeometry(0.2, 0.24, 0.03),
      doorTop: new THREE.CylinderGeometry(0.1, 0.1, 0.03, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2).rotateY(0),
      slit: new THREE.BoxGeometry(0.07, 0.16, 0.02),
      sill: new THREE.BoxGeometry(0.11, 0.025, 0.04),
      dial: new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16).rotateX(Math.PI / 2),
      rim: new THREE.TorusGeometry(0.205, 0.022, 4, 16),
      tick: new THREE.BoxGeometry(0.014, 0.035, 0.008),
      hour: new THREE.BoxGeometry(0.026, 0.11, 0.01).translate(0, 0.04, 0),
      minute: new THREE.BoxGeometry(0.017, 0.16, 0.01).translate(0, 0.065, 0),
      cap: new THREE.CylinderGeometry(0.02, 0.02, 0.015, 8).rotateX(Math.PI / 2),
      beam: new THREE.BoxGeometry(0.05, 0.05, 0.62),
      yoke: new THREE.BoxGeometry(0.06, 0.05, 0.12),
      bell: new THREE.LatheGeometry(
        [
          [0.001, -0.02],
          [0.055, -0.02],
          [0.07, -0.05],
          [0.075, -0.11],
          [0.095, -0.17],
          [0.125, -0.21],
          [0.12, -0.225],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        10,
      ),
      lip: new THREE.TorusGeometry(0.122, 0.012, 4, 10).rotateX(Math.PI / 2),
      clapperRod: new THREE.CylinderGeometry(0.006, 0.006, 0.15, 4).translate(0, -0.075, 0),
      clapperBall: blob(0.026, 8, 0),
      finial: blob(0.035, 9, 0),
      rod: new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5).translate(0, 0.15, 0),
      arm: new THREE.BoxGeometry(0.16, 0.008, 0.008),
      arrow: new THREE.BoxGeometry(0.28, 0.012, 0.012),
      arrowHead: new THREE.ConeGeometry(0.03, 0.07, 4).rotateZ(-Math.PI / 2),
      fin: new THREE.BoxGeometry(0.07, 0.07, 0.006).rotateZ(Math.PI / 4),
      ring: new THREE.TorusGeometry(1, 0.04, 3, 28).rotateX(Math.PI / 2),
      bush: blob(0.13, 11),
      pot: facet(new THREE.CylinderGeometry(0.12, 0.1, 0.12, 7).translate(0, 0.06, 0), 0.006, 12),
      snowCap: facet(new THREE.BoxGeometry(1, 1, 1, 2, 1, 2), 0.03, 13, [1, 0.2, 1]),
      pBody: blob(0.05, 21, 0).scale(0.8, 0.72, 1.35),
      pHead: blob(0.03, 22, 0),
      pNeck: blob(0.028, 23, 0).scale(1, 0.9, 1),
      pBeak: new THREE.ConeGeometry(0.008, 0.022, 4),
      pEye: new THREE.IcosahedronGeometry(0.0065, 0),
      pTail: new THREE.BoxGeometry(0.045, 0.012, 0.06),
      pWing: new THREE.BoxGeometry(0.08, 0.008, 0.06),
      pLeg: new THREE.CylinderGeometry(0.004, 0.004, 0.016, 3),
      flake: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )

  // the tower's quoins: alternating long and short corner stones up the shaft
  const quoins = useMemo(() => {
    const out = []
    const n = 7
    const h = (Y1 - Y0) / n
    for (let k = 0; k < n; k++)
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const long = (k + (sx * sz > 0 ? 0 : 1)) % 2 === 0
        const wx = long ? 0.17 : 0.11
        const wz = long ? 0.11 : 0.17
        out.push({ p: [sx * (S / 2 - wx / 2 + 0.018), Y0 + h * (k + 0.5), sz * (S / 2 - wz / 2 + 0.018)], s: [wx, h * 0.86, wz] })
      }
    return out
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the hands
    const m = clockMinutes(t)
    hands.current.forEach((h, i) => h && (h.rotation.z = -(i % 2 ? (m / 60) * TAU : (m / 720) * TAU)))
    // the bell: a gentle idle stir, a big damped swing after a tap, the clapper a beat behind
    const swing = 0.03 * Math.sin(t * 1.4) + 0.75 * wobble(s, SWING, 0.75)
    bell.current.rotation.z = swing
    clapper.current.rotation.z = -0.55 * wobble(s - 0.07, SWING, 0.75)
    // a ring of sound at each strike, the strikes at the ends of the swing
    rings.current.forEach((r, i) => {
      if (!r) return
      const k = Math.floor(i / 2)
      const u = (s - (Math.PI / 2 + k * Math.PI) / SWING - (i % 2) * 0.12) / 1.2
      r.visible = s >= 0 && u >= 0 && u < 1
      if (!r.visible) return
      const g = 0.35 + u * (1.5 - k * 0.15)
      r.scale.set(g, 1 + u * 2, g)
      r.material.opacity = 0.95 * (1 - u) ** 1.4 * Math.exp(-k * 0.35)
    })
    // the weather vane veers in the breeze, and spins round on a tap
    vane.current.rotation.y = 0.7 * Math.sin(t * 0.33) + 0.25 * Math.sin(t * 0.91 + 1) + (s >= 0 ? TAU * 2 * (1 - Math.exp(-1.6 * s)) : 0)
    // pigeons: bob and peck on their perches, or flutter round the tower
    PERCH.forEach(([px, py, pz, yaw], i) => {
      const b = birds.current[i]
      if (!b) return
      const fs = s - i * 0.09
      const u = fs / FLIGHT
      const pose = (time) => {
        const uu = time / FLIGHT
        const w = uu <= 0 || uu >= 1 ? 0 : THREE.MathUtils.smoothstep(Math.min(1, uu * 4.5, (1 - uu) * 3.2), 0, 1)
        const a = Math.atan2(pz, px) + time * (1.5 + i * 0.12)
        const r = 0.78 + i * 0.12
        const y = 2.55 + i * 0.13 + Math.sin(time * 2.3 + i) * 0.08
        return v0.set(px + (Math.cos(a) * r - px) * w, py + (y - py) * w, pz + (Math.sin(a) * r - pz) * w)
      }
      const flying = u > 0 && u < 1
      if (flying) {
        v1.copy(pose(fs + 0.03))
        b.position.copy(pose(fs))
        if (v1.distanceToSquared(b.position) > 1e-7) {
          b.lookAt(b.parent.localToWorld(v1.clone()))
        }
      } else {
        b.position.set(px, py, pz)
        b.rotation.set(0, yaw + 0.25 * Math.sin(t * 0.4 + i * 2), 0)
      }
      const flap = flying ? Math.sin(t * 34 + i) * 0.9 : -1.15
      wings[i].forEach((wg, j) => wg && (wg.rotation.z = (j ? 1 : -1) * flap))
      const hd = heads.current[i]
      if (hd) {
        const peck = flying ? 0 : Math.max(0, Math.sin(t * 1.7 + i * 2.1)) ** 10
        hd.rotation.x = peck * 0.7
        hd.position.y = 0.06 + Math.abs(Math.sin(t * 3 + i)) * 0.004
      }
    })
  })

  const tone = <Flat color={L.trim} />
  const band = (y, w, h, key) => (
    <mesh key={key} geometry={geo.band} position-y={y} scale={[w, h, w]}>
      {tone}
    </mesh>
  )
  const snowSlab = (y, w, key) =>
    L.snow && (
      <mesh key={key} geometry={geo.snowCap} position-y={y} scale={[w, 0.025, w]}>
        <Flat color="#ffffff" />
      </mesh>
    )

  return (
    <group {...handlers}>
      {/* the town square, with a kerb of darker stones round it */}
      <mesh geometry={geo.square}>
        <Flat color={L.ground} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} geometry={geo.kerb} rotation-y={(k * Math.PI) / 2} position={[Math.sin((k * Math.PI) / 2) * 0.84, 0.04, Math.cos((k * Math.PI) / 2) * 0.84]}>
          <Flat color={L.ground2} />
        </mesh>
      ))}
      {[
        [0.62, 0.58],
        [-0.6, -0.6],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.06, z]}>
          <mesh geometry={geo.pot}>
            <Flat color={L.snow ? '#9a8e80' : '#b86a46'} />
          </mesh>
          <mesh geometry={geo.bush} position-y={0.17} scale={[1, 0.85, 1]}>
            <Flat color={L.snow ? '#f4f7fb' : i ? '#5f9a4a' : '#4f8a42'} />
          </mesh>
        </group>
      ))}

      <mesh geometry={geo.plinth}>
        <Flat color={L.trim} />
      </mesh>
      {snowSlab(Y0 + 0.005, 0.86)}
      <mesh geometry={geo.shaft}>
        <Flat color={L.wall} />
      </mesh>
      {quoins.map((q, i) => (
        <mesh key={i} geometry={geo.quoin} position={q.p} scale={q.s}>
          <Flat color={L.quoin} />
        </mesh>
      ))}

      {/* an arched door at the foot, slit windows up the shaft */}
      <group position={[0, Y0, S / 2 + 0.005]}>
        <mesh geometry={geo.door} position-y={0.12}>
          <Flat color={L.door} />
        </mesh>
        <mesh geometry={geo.doorTop} position-y={0.24}>
          <Flat color={L.door} />
        </mesh>
        <mesh geometry={geo.band} position={[0.06, 0.13, 0.02]} scale={[0.02, 0.02, 0.02]}>
          <Flat color={L.rim} metalness={0.5} />
        </mesh>
      </group>
      {[0, 1, 2, 3].map((k) =>
        [0.78, 1.18].map((y) =>
          k === 0 && y < 1 ? null : (
            <group key={`${k}${y}`} rotation-y={(k * Math.PI) / 2}>
              <mesh geometry={geo.slit} position={[0, y, S / 2 + 0.002]}>
                <Flat color="#2b2c3a" />
              </mesh>
              <mesh geometry={geo.sill} position={[0, y - 0.09, S / 2 + 0.012]}>
                {tone}
              </mesh>
            </group>
          ),
        ),
      )}

      {/* the clock stage */}
      {band(Y1 + 0.025, 0.74, 0.05)}
      {snowSlab(Y1 + 0.055, 0.74)}
      <mesh geometry={geo.clockBox} position-y={Y1 + 0.05}>
        <Flat color={L.wall} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <ClockFace key={k} k={k} geo={geo} L={L} hands={hands} rotation-y={(k * Math.PI) / 2} position={[Math.sin((k * Math.PI) / 2) * 0.35, CY, Math.cos((k * Math.PI) / 2) * 0.35]} />
      ))}
      {band(B0 - 0.025, 0.8, 0.05)}
      {snowSlab(B0 + 0.005, 0.8)}

      {/* the open belfry and its bell */}
      <group position-y={B0}>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} geometry={geo.arch} rotation-y={(k * Math.PI) / 2} position={[Math.sin((k * Math.PI) / 2) * 0.275, 0, Math.cos((k * Math.PI) / 2) * 0.275]}>
            <Flat color={L.wall} />
          </mesh>
        ))}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} geometry={geo.pillar} position={[sx * 0.3, 0, sz * 0.3]}>
              <Flat color={L.quoin} />
            </mesh>
          )),
        )}
        <mesh geometry={geo.beam} position-y={B1 - B0 - 0.06}>
          <Flat color="#5a3e2a" />
        </mesh>
        <group ref={bell} position-y={B1 - B0 - 0.08} scale={1.2}>
          <mesh geometry={geo.yoke}>
            <Flat color="#5a3e2a" />
          </mesh>
          <mesh geometry={geo.bell}>
            <Flat color={L.bell} metalness={0.55} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={geo.lip} position-y={-0.222}>
            <Flat color={L.bell} metalness={0.55} roughness={0.35} />
          </mesh>
          <group ref={clapper} position-y={-0.04}>
            <mesh geometry={geo.clapperRod}>
              <Flat color="#4a3a2a" />
            </mesh>
            <mesh geometry={geo.clapperBall} position-y={-0.15}>
              <Flat color="#4a3a2a" />
            </mesh>
          </group>
        </group>
      </group>
      {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} ref={(el) => (rings.current[i] = el)} geometry={geo.ring} position-y={B0 + 0.24} rotation={[(i % 2 ? 0.18 : -0.14) * (i % 4 < 2 ? 1 : -1), 0, i % 2 ? 0.12 : -0.1]} visible={false}>
            <meshBasicMaterial color="#ffd36a" transparent depthWrite={false} />
          </mesh>
        ))}

      {/* the roof, a ball finial and the weather vane */}
      <mesh geometry={geo.eave} position-y={B1 + 0.03}>
        {tone}
      </mesh>
      <mesh geometry={geo.roof} position-y={R0}>
        <Flat color={L.roof} />
      </mesh>
      <group position-y={R0 + RH}>
        <mesh geometry={geo.finial}>
          <Flat color={L.rim} metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh geometry={geo.rod}>
          <Flat color="#2d2a2a" />
        </mesh>
        <mesh geometry={geo.arm} position-y={0.12}>
          <Flat color="#2d2a2a" />
        </mesh>
        <mesh geometry={geo.arm} position-y={0.12} rotation-y={Math.PI / 2}>
          <Flat color="#2d2a2a" />
        </mesh>
        <group ref={vane} position-y={0.24}>
          <mesh geometry={geo.arrow}>
            <Flat color="#2d2a2a" />
          </mesh>
          <mesh geometry={geo.arrowHead} position-x={0.16}>
            <Flat color={L.rim} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh geometry={geo.fin} position-x={-0.13}>
            <Flat color={L.rim} metalness={0.5} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* pigeons */}
      {PERCH.map((p, i) => (
        <group key={i} ref={(el) => (birds.current[i] = el)} position={[p[0], p[1], p[2]]} rotation-y={p[3]}>
          <Pigeon geo={geo} wings={wings[i]} head={(el) => (heads.current[i] = el)} />
        </group>
      ))}

      {L.snow && <Particles geometry={geo.flake} count={40} life={6} origin={[0, 3.7, 0]} spread={1.1} velocity={[0, -0.62, 0]} scatter={0.03} drift={0.25} size={[0.018, 0.018]} colors={['#ffffff']} opacity={[0.95, 0.85]} emissive={0.3} seed={4} />}
    </group>
  )
}

export default function ClockTowerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[4.7, 3.2, 6.4]} target={[0, 1.72, 0]} hint="The clock hands tick round on fast-forwarded time, the weather vane veers and the pigeons bob on the ledges · tap the tower and the bell swings and rings out, and the pigeons flutter up and circle · Look swaps stone, brick and snow · drag to orbit">
      <ClockTower {...props} />
    </Stage>
  )
}
