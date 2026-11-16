import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, facet, useGeo, useTap, waveAt } from './kit.jsx'

// A low-poly Venetian canal: a long black gondola with its rising bow and
// toothed silver ferro, a gondolier in a striped shirt and straw boater
// rowing with one long oar in the forcola, a little stone footbridge
// arching over the canal, quays either side and a stretch of plastered
// house wall with shuttered windows and striped mooring poles. Left alone
// the gondolier rows, leaning into each stroke, and the boat rocks and
// drifts on the swell. Tap it and the gondola straightens up, glides away
// under the bridge (the gondolier ducks as it passes) and backs home again.

const LOOKS = {
  classic: { water: '#3aa3a0', bed: '#226664', wall: '#e09a68', wall2: '#cf8455', stone: '#efe6d6', quay: '#cfc5b4', shutter: '#3f7a52', glass: '#2c3440', glow: 0, stripe: '#2b3a6b', ribbon: '#c8352e', seat: '#b8333a', pole: '#2b3a6b', sky: false },
  sunset: { water: '#d98a74', bed: '#8e4f52', wall: '#f0b48a', wall2: '#de9a72', stone: '#f6dcc4', quay: '#d9b49e', shutter: '#7a4a6a', glass: '#4a3040', glow: 0.25, stripe: '#c8352e', ribbon: '#2b3a6b', seat: '#7c2d55', pole: '#c8352e', sky: false },
  night: { water: '#24406e', bed: '#142640', wall: '#5d5a7a', wall2: '#4c4968', stone: '#8d8ba6', quay: '#6b6984', shutter: '#2c3a4e', glass: '#ffcf6a', glow: 1.2, stripe: '#1c2238', ribbon: '#e8b64a', seat: '#6a2440', pole: '#e8b64a', sky: true },
}

const WY = 0.14 // the water level
const QY = 0.32 // the quay tops
const CW = 0.8 // half the canal's width
const CL = 2.7 // half the canal's length
const BX = 0.3 // the bridge, across the canal at this x
const ARCH = 0.74 // the arch's clearance above the water
const X0 = -1.0 // where the gondola idles
const XFAR = 1.65 // how far it glides on a tap
const TRIP = 8 // seconds for the trip

// the hull: u runs stern (-1) to bow (1), a from port (-pi/2) round under
// the keel (0) to starboard (pi/2). Both ends sweep up out of the water.
const HL = 1.0
const halfW = (u) => 0.21 * Math.pow(Math.max(0, 1 - u * u), 0.55)
const depth = (u) => 0.17 * (1 - u * u) + 0.03
const sheer = (u) => 0.09 + (u > 0 ? 0.22 : 0.15) * Math.abs(u) ** 5
const hullAt = (u, a) => new THREE.Vector3(u * HL, sheer(u) - depth(u) * Math.pow(Math.cos(a), 0.8), halfW(u) * Math.sin(a))
// the half-width of the hull's inside at height y
const insideAt = (u, y) => {
  const c = (sheer(u) - y) / depth(u)
  return c >= 1 || c <= 0 ? 0 : halfW(u) * Math.sin(Math.acos(Math.pow(c, 1 / 0.8)))
}

function hullGeometry() {
  const N = 28
  const M = 10
  const pos = []
  const idx = []
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= M; j++) {
      const p = hullAt(-1 + (2 * i) / N, -Math.PI / 2 + (j / M) * Math.PI)
      pos.push(p.x, p.y, p.z)
    }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j
      const b = a + M + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return facet(g.toNonIndexed(), 0.004, 8)
}

// A deck strip over the hull from u0 to u1, following the sheer.
function deckGeometry(u0, u1) {
  const pos = []
  const n = 12
  for (let i = 0; i < n; i++) {
    const a = u0 + ((u1 - u0) * i) / n
    const b = u0 + ((u1 - u0) * (i + 1)) / n
    const P = (u, s) => [u * HL, sheer(u) + 0.004, s * halfW(u)]
    const q = [P(a, -1), P(b, -1), P(b, 1), P(a, 1)]
    for (const v of [q[0], q[2], q[1], q[0], q[3], q[2]]) pos.push(...v)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

// The floor in the open middle, at height y.
function floorGeometry(y, u0, u1) {
  const s = new THREE.Shape()
  const n = 14
  for (let k = 0; k <= n; k++) {
    const u = u0 + ((u1 - u0) * k) / n
    k ? s.lineTo(u * HL, insideAt(u, y) - 0.005) : s.moveTo(u * HL, insideAt(u, y) - 0.005)
  }
  for (let k = n; k >= 0; k--) {
    const u = u0 + ((u1 - u0) * k) / n
    s.lineTo(u * HL, -insideAt(u, y) + 0.005)
  }
  return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2).translate(0, y, 0)
}

// A rail along the hull side at drop below the sheer.
function railGeometry(side, drop, r) {
  const pts = []
  for (let k = 0; k <= 20; k++) {
    const u = -0.96 + (1.9 * k) / 20
    const p = hullAt(u, (side * Math.PI) / 2)
    pts.push(new THREE.Vector3(p.x, p.y - drop, p.z + side * 0.004))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 4, false)
}

// The ferro on the bow: a flat silver blade with six teeth pointing ahead.
function ferroGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-0.05, 0)
  s.lineTo(0.02, 0)
  for (let i = 0; i < 6; i++) {
    const y = 0.025 + i * 0.03
    s.lineTo(0.02, y)
    s.lineTo(0.075, y + 0.006)
    s.lineTo(0.075, y + 0.018)
    s.lineTo(0.02, y + 0.018)
  }
  s.lineTo(0.03, 0.2)
  s.lineTo(0.11, 0.215)
  s.lineTo(0.1, 0.25)
  s.lineTo(-0.02, 0.245)
  s.lineTo(-0.045, 0.19)
  s.lineTo(-0.03, 0.1)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: false }).translate(0, 0, -0.007)
}

// The bridge's side profile across the canal (shape x = world z), extruded
// along the canal into a slab, with the arch cut from under it.
function bridgeGeometry() {
  const R = 1.25
  const top = (z) => QY + 0.07 + (WY + ARCH + 0.13 - QY - 0.07) * (1 - (z / R) ** 2)
  const s = new THREE.Shape()
  s.moveTo(-R, QY)
  for (let k = 0; k <= 16; k++) {
    const z = -R + (2 * R * k) / 16
    s.lineTo(z, top(z))
  }
  s.lineTo(R, QY)
  s.lineTo(CW, QY)
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * Math.PI
    s.lineTo(CW * Math.cos(a), WY + ARCH * Math.sin(a) ** 0.8)
  }
  s.lineTo(-CW, QY)
  s.closePath()
  return { body: facet(new THREE.ExtrudeGeometry(s, { depth: 0.46, bevelEnabled: false }).translate(0, 0, -0.23).rotateY(Math.PI / 2), 0.006, 12), top }
}

// stripes of a pole or a shirt: alternate colours stacked up
function Stripes({ n, h, r0, r1 = r0, colors, sides = 7, ...props }) {
  return (
    <group {...props}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position-y={(i + 0.5) * h}>
          <cylinderGeometry args={[r0 + ((r1 - r0) * (i + 1)) / n, r0 + ((r1 - r0) * i) / n, h, sides]} />
          <Flat color={colors[i % colors.length]} />
        </mesh>
      ))}
    </group>
  )
}

const _z = new THREE.Vector3(0, 0, 1)
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function CanalGondola({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(1)
  const boat = useRef()
  const water = useRef()
  const legs = useRef()
  const upper = useRef()
  const oar = useRef()
  const shoulders = useRef([])
  const arms = useRef([])
  const hands = useRef([])
  const st = useRef({ duck: 0 })
  const GX = -0.86 // where the gondolier stands, boat-local
  const PY = sheer(GX / HL) + 0.02 // the platform he stands on
  const F = useMemo(() => new THREE.Vector3(-0.56, sheer(-0.56) + 0.2, 0.17), []) // the forcola's notch
  const tmp = useMemo(() => ({ bp: new THREE.Vector3(), d: new THREE.Vector3(), h: new THREE.Vector3(), s: new THREE.Vector3(), q: new THREE.Quaternion() }), [])
  const geo = useGeo(() => {
    const br = bridgeGeometry()
    return {
      hull: hullGeometry(),
      deckF: deckGeometry(0.42, 0.985),
      deckA: deckGeometry(-0.985, -0.5),
      floor: floorGeometry(-0.04, -0.5, 0.42),
      rail: [railGeometry(1, 0.0, 0.012), railGeometry(-1, 0.0, 0.012)],
      gold: [railGeometry(1, 0.035, 0.006), railGeometry(-1, 0.035, 0.006)],
      ferro: ferroGeometry(),
      water: new THREE.PlaneGeometry(CL * 2, CW * 2, 30, 9).rotateX(-Math.PI / 2),
      bridge: br.body,
      bridgeTop: br.top,
      box: new THREE.BoxGeometry(1, 1, 1),
      arch: new THREE.CircleGeometry(0.5, 8, 0, Math.PI),
      arm: new THREE.CylinderGeometry(0.024, 0.02, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5),
      ball: new THREE.IcosahedronGeometry(1, 0),
      shaft: new THREE.CylinderGeometry(0.014, 0.014, 1.4, 5).rotateX(Math.PI / 2).translate(0, 0, 0.12),
      blade: facet(new THREE.BoxGeometry(0.012, 0.075, 0.2), 0.002, 5),
    }
  }, [])
  const baseY = useMemo(() => Float32Array.from(geo.water.attributes.position.array), [geo])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const t = clock.elapsedTime
    const S = st.current
    // the water's swell
    const wp = geo.water.attributes.position
    for (let i = 0; i < wp.count; i++) wp.setY(i, waveAt(baseY[i * 3], baseY[i * 3 + 2], t, 0.014, 0.8))
    wp.needsUpdate = true
    geo.water.computeVertexNormals()

    // the trip under the bridge and back
    const s = tap.since(t) / TRIP
    const trip = s >= 0 && s < 1 ? (s < 0.5 ? ease(s / 0.42) : 1 - ease((s - 0.5) / 0.46)) : 0
    const straight = s >= 0 && s < 1 ? Math.min(1, s * 6, (1 - s) * 5) : 0
    const phi = t * 2.1 // the rowing stroke
    const bx = X0 + (XFAR - X0) * trip + Math.sin(t * 0.23) * 0.07 * (1 - straight) + Math.sin(phi) * 0.012
    const bz = 0.08 * (1 - straight) + Math.sin(t * 0.17) * 0.04
    const yaw = (0.2 + Math.sin(t * 0.19) * 0.06) * (1 - straight)
    const hb = waveAt(bx + 0.7, bz, t, 0.014, 0.8)
    const hs = waveAt(bx - 0.7, bz, t, 0.014, 0.8)
    boat.current.position.set(bx, WY + (hb + hs) / 2 - 0.005, bz)
    boat.current.rotation.set(Math.sin(t * 1.1) * 0.025 + Math.sin(phi) * 0.02, yaw, ((hb - hs) / 1.4) * 0.9 + Math.sin(t * 0.7) * 0.012, 'YXZ')

    // the gondolier ducks as he passes under the bridge
    const gx = bx + GX * Math.cos(yaw)
    const want = ease(1 - (Math.abs(gx - BX) - 0.3) / 0.45)
    S.duck += (want - S.duck) * Math.min(1, dt * 7)
    const lean = 0.12 - 0.13 * Math.sin(phi) + S.duck * 0.55
    const legK = 1 - S.duck * 0.45
    legs.current.scale.y = legK
    upper.current.position.y = PY + 0.3 * legK
    upper.current.rotation.z = -lean

    // the oar: through the forcola, its blade sweeping fore and aft in the water
    const bp = tmp.bp.set(-0.3 + 0.2 * Math.sin(phi), -0.06 + 0.05 * Math.max(0, Math.cos(phi)), 0.56)
    const d = tmp.d.subVectors(bp, F).normalize()
    oar.current.position.copy(F)
    oar.current.quaternion.setFromUnitVectors(_z, d)
    // the arms reach from the shoulders to two grips on the oar
    boat.current.updateMatrixWorld(true)
    ;[0.36, 0.52].forEach((k, i) => {
      const sh = shoulders.current[i]
      const arm = arms.current[i]
      const hand = hands.current[i]
      if (!sh || !arm || !hand) return
      const h = tmp.h.copy(F).addScaledVector(d, -k)
      sh.getWorldPosition(tmp.s)
      boat.current.worldToLocal(tmp.s)
      arm.position.copy(tmp.s)
      const v = h.clone().sub(tmp.s)
      arm.scale.set(1, 1, Math.max(0.02, v.length()))
      arm.quaternion.setFromUnitVectors(_z, v.normalize())
      hand.position.copy(h)
    })
  })

  const box = (p, s, color, extra = {}, key) => (
    <mesh key={key} geometry={geo.box} position={p} scale={s}>
      <Flat color={color} {...extra} />
    </mesh>
  )
  const black = '#16161c'
  const skin = '#e7b08a'
  const shirt = ['#f5f3ee', L.stripe]
  const glassMat = { emissive: L.glass, emissiveIntensity: L.glow, roughness: 0.35 }

  return (
    <group {...handlers}>
      {/* the canal: bed, swelling water, and a quay either side */}
      {box([0, WY / 2 - 0.02, 0], [CL * 2, WY - 0.04, CW * 2], L.bed)}
      <mesh ref={water} geometry={geo.water} position-y={WY}>
        <meshStandardMaterial color={L.water} flatShading roughness={0.3} metalness={0.05} />
      </mesh>
      {[-1, 1].map((sz) => box([0, QY / 2, sz * (CW + 0.25)], [CL * 2, QY, 0.5], L.quay, {}, sz))}
      {[-1, 1].map((sz) => box([0, QY + 0.015, sz * (CW + 0.03)], [CL * 2, 0.03, 0.08], L.stone, {}, `e${sz}`))}

      {/* a stretch of house wall on the far quay */}
      <group position={[-1.35, QY, -CW - 0.38]}>
        {box([0, 0.7, 0], [2.7, 1.4, 0.22], L.wall)}
        {box([0, 1.42, 0.03], [2.78, 0.07, 0.3], L.stone)}
        {box([0, 0.04, 0.02], [2.72, 0.08, 0.26], L.wall2)}
        {[-0.9, 0, 0.9].map((x) =>
          [0.62, 1.08].map((y) => (
            <group key={`${x}${y}`} position={[x, y, 0.11]}>
              {box([0, 0, 0], [0.22, 0.3, 0.02], L.glass, glassMat)}
              <mesh geometry={geo.arch} position-y={0.15} position-z={0.011} scale={[0.22, 0.22, 1]}>
                <Flat color={L.glass} {...glassMat} />
              </mesh>
              {box([0, -0.18, 0.02], [0.3, 0.03, 0.06], L.stone)}
              {[-1, 1].map((k) => box([k * 0.17, 0, 0.01], [0.1, 0.32, 0.02], L.shutter, {}, k))}
            </group>
          )),
        )}
        {/* a water door with its arch */}
        <group position={[0.45, 0.2, 0.11]}>
          {box([0, 0, 0], [0.3, 0.4, 0.02], '#4a3426')}
          <mesh geometry={geo.arch} position-y={0.2} position-z={0.011} scale={[0.3, 0.3, 1]}>
            <Flat color="#4a3426" />
          </mesh>
        </group>
      </group>
      {/* striped mooring poles by the wall */}
      {[-2.2, -1.95, 2.3].map((x, i) => (
        <group key={x} position={[x, 0, i < 2 ? -CW + 0.12 : CW - 0.12]}>
          <Stripes n={7} h={0.11} r0={0.03} colors={['#f5f3ee', L.pole]} />
          <mesh position-y={0.8}>
            <coneGeometry args={[0.045, 0.08, 6]} />
            <Flat color={L.pole} />
          </mesh>
        </group>
      ))}

      {/* the footbridge with posts and a rail either side, and a lantern */}
      <group position-x={BX}>
        <mesh geometry={geo.bridge}>
          <Flat color={L.stone} />
        </mesh>
        {[-1, 1].map((sx) => (
          <group key={sx} position-x={sx * 0.2}>
            {[-1.05, -0.7, -0.35, 0, 0.35, 0.7, 1.05].map((z) => box([0, geo.bridgeTop(z) + 0.09, z], [0.04, 0.18, 0.04], L.stone, {}, z))}
            <mesh>
              <tubeGeometry args={[new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, k) => new THREE.Vector3(0, geo.bridgeTop(-1.1 + (2.2 * k) / 12) + 0.19, -1.1 + (2.2 * k) / 12))), 24, 0.022, 4, false]} />
              <Flat color={L.stone} />
            </mesh>
          </group>
        ))}
        <group position={[0.27, geo.bridgeTop(1.15), 1.15]}>
          {box([0, 0.28, 0], [0.03, 0.56, 0.03], black)}
          {box([0, 0.62, 0], [0.09, 0.12, 0.09], '#ffd27a', { emissive: '#ffb84a', emissiveIntensity: 0.3 + L.glow })}
          {box([0, 0.7, 0], [0.12, 0.03, 0.12], black)}
          {L.sky && <pointLight position-y={0.62} color="#ffc070" intensity={2.5} distance={3} decay={2} />}
        </group>
      </group>

      {/* the gondola */}
      <group ref={boat}>
        <mesh geometry={geo.hull}>
          <Flat color={black} roughness={0.4} side={THREE.FrontSide} />
        </mesh>
        <mesh geometry={geo.hull}>
          <Flat color="#3a2418" side={THREE.BackSide} />
        </mesh>
        <mesh geometry={geo.deckF}>
          <Flat color={black} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.deckA}>
          <Flat color={black} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.floor}>
          <Flat color="#7a5232" side={THREE.DoubleSide} />
        </mesh>
        {geo.rail.map((g, i) => (
          <mesh key={i} geometry={g}>
            <Flat color="#26262e" roughness={0.5} />
          </mesh>
        ))}
        {geo.gold.map((g, i) => (
          <mesh key={`g${i}`} geometry={g}>
            <Flat color="#d9aa3c" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        <mesh geometry={geo.ferro} position={[HL - 0.02, sheer(0.98) - 0.02, 0]}>
          <meshStandardMaterial color="#d8dce4" metalness={0.75} roughness={0.3} flatShading />
        </mesh>
        {/* the passenger seat: a red cushion and back in a gold frame */}
        {box([0.12, 0.0, 0], [0.24, 0.07, 0.26], L.seat)}
        {box([0.0, 0.07, 0], [0.04, 0.16, 0.26], L.seat)}
        {box([0.0, 0.16, 0], [0.05, 0.02, 0.28], '#d9aa3c', { metalness: 0.5, roughness: 0.4 })}
        {/* the forcola, the carved oarlock on the starboard side */}
        <group position={[F.x, 0, F.z]}>
          {box([0, (sheer(-0.56) + F.y) / 2 - 0.02, 0], [0.05, F.y - sheer(-0.56) + 0.04, 0.04], '#7a4f2c')}
          {box([0.03, F.y + 0.02, 0], [0.03, 0.06, 0.04], '#7a4f2c')}
        </group>
        {/* the stern platform the gondolier stands on */}
        {box([GX, PY - 0.01, 0], [0.2, 0.02, 0.2], '#5a3a24')}

        {/* the gondolier: legs that bend to duck, and a leaning upper body */}
        <group ref={legs} position={[GX, PY, 0]}>
          {[-1, 1].map((k) => (
            <group key={k} position-z={k * 0.045}>
              <mesh position-y={0.15}>
                <cylinderGeometry args={[0.034, 0.03, 0.3, 5]} />
                <Flat color={black} />
              </mesh>
              {box([0.02, 0.012, 0], [0.09, 0.025, 0.05], '#2a1a12')}
            </group>
          ))}
        </group>
        <group ref={upper} position={[GX, PY + 0.3, 0]}>
          <mesh position-y={0.02}>
            <cylinderGeometry args={[0.075, 0.07, 0.05, 7]} />
            <Flat color={black} />
          </mesh>
          <Stripes n={5} h={0.045} r0={0.074} r1={0.088} colors={shirt} position-y={0.04} />
          {[-1, 1].map((k, i) => (
            <group key={k} ref={(el) => (shoulders.current[i] = el)} position={[0, 0.235, k * 0.085]} />
          ))}
          <mesh geometry={geo.ball} position-y={0.3} scale={[0.058, 0.066, 0.058]}>
            <Flat color={skin} />
          </mesh>
          {/* the straw boater with its ribbon */}
          <mesh position-y={0.355}>
            <cylinderGeometry args={[0.105, 0.105, 0.012, 10]} />
            <Flat color="#e8cf8a" />
          </mesh>
          <mesh position-y={0.383}>
            <cylinderGeometry args={[0.062, 0.064, 0.05, 10]} />
            <Flat color="#e8cf8a" />
          </mesh>
          <mesh position-y={0.372}>
            <cylinderGeometry args={[0.066, 0.066, 0.018, 10]} />
            <Flat color={L.ribbon} />
          </mesh>
        </group>
        {[0, 1].map((i) => (
          <mesh key={i} ref={(el) => (arms.current[i] = el)} geometry={geo.arm}>
            <Flat color={shirt[0]} />
          </mesh>
        ))}
        {[0, 1].map((i) => (
          <mesh key={`h${i}`} ref={(el) => (hands.current[i] = el)} geometry={geo.ball} scale={0.028}>
            <Flat color={skin} />
          </mesh>
        ))}
        <group ref={oar}>
          <mesh geometry={geo.shaft}>
            <Flat color="#c9a06a" />
          </mesh>
          <mesh geometry={geo.blade} position-z={0.74}>
            <Flat color="#c9a06a" />
          </mesh>
        </group>
      </group>

      {/* an easy target for taps anywhere over the canal */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[CL * 2, 1.2, CW * 2 + 1]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function CanalGondolaScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.6, 3.1, 5.9]} target={[-0.2, 0.45, 0]} hint="The gondolier rows and the gondola rocks and drifts on the swell · tap it and the gondola straightens up, glides away under the bridge (mind your head!) and backs home again · Look swaps classic, sunset and night · drag to orbit">
      <CanalGondola {...props} />
    </Stage>
  )
}
