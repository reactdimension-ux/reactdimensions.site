import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Beam, Flat, Stage, TAU, Trail, blob, facet, polarGrid, rng, useGeo, useTap } from './kit.jsx'

// A low-poly lunar rover on a cratered round of grey regolith, with a few
// rocks lying about and the Earth hanging in the sky. The rover is an open
// frame of tubes with a floor pan, two webbed seats, a control post, a TV
// camera, a tool pallet at the back, fenders over four woven-mesh wheels on
// their own sprung struts, and a high-gain umbrella dish on a mast. Left
// alone, it creeps back and forth over a few bumps: each wheel finds the
// ground under it, the struts stretch and squeeze, the frame pitches and
// rolls between them, the wheels turn at exactly the speed it travels, and
// a little dust trails off the tyres. Tap it and the dish swings round and
// up to find the Earth, then beams a pulsing signal to it, and the Earth
// flashes as each pulse arrives.

const LOOKS = {
  apollo: { frame: '#c9ccd2', seat: '#3d5a8a', fender: '#8e949c', accent: '#d9a73a', dish: '#e9e6dd', ground: '#a3a09b', rock: '#7e7b76', bg: null },
  modern: { frame: '#f2f2f4', seat: '#2c2c32', fender: '#ef7d22', accent: '#ef7d22', dish: '#ffffff', ground: '#b4b1ac', rock: '#8e8b86', bg: null },
  mars: { frame: '#ece7de', seat: '#5a3a2a', fender: '#c8352b', accent: '#c8352b', dish: '#f4efe6', ground: '#b8613f', rock: '#7e3f28', bg: '#f0d6c8' },
}

const GY = 0.06 // the rim of the patch
const PR = 1.45 // patch radius
const WR = 0.13 // wheel radius
const TW = 0.09 // wheel width
const WB = 0.62 // wheelbase (axles at +-WB/2)
const TZ = 0.3 // wheel centres (z)
const CL = 0.13 // frame above the mean of the wheel centres
const AMP = 0.72 // how far it creeps each way
const RATE = 0.32 // radians a second of the back-and-forth
// (out past the contact shadow's reach, so it casts no smudge on the ground)
const EARTH = new THREE.Vector3(-3.4, 1.6, -4.0)
const MAST = [0.3, 0.42, -0.14] // the dish mast foot on the frame

// the bumps it creeps over (along its track) and the craters round about
const BUMPS = [
  [-0.55, 0.055, 0.16],
  [0.12, 0.07, 0.15],
  [0.72, 0.05, 0.13],
]
const CRATERS = [
  [0.55, -0.95, 0.36, 0.09],
  [-0.8, 0.7, 0.3, 0.07],
  [1.05, 0.72, 0.2, 0.05],
  [-1.0, -0.6, 0.22, 0.05],
]
function groundAt(x, z) {
  let h = 0
  for (const [bx, a, w] of BUMPS) h += a * Math.exp(-((x - bx) ** 2) / (w * w)) * Math.exp(-(z * z) / 0.6)
  for (const [cx, cz, r, dp] of CRATERS) {
    const d = Math.hypot(x - cx, z - cz) / r
    h += d < 1 ? -dp * (1 - d * d) : 0
    h += dp * 0.45 * Math.exp(-(((d - 1) / 0.22) ** 2))
  }
  const u = Math.min(1, Math.hypot(x, z) / PR)
  return GY + h * (1 - u ** 6)
}
// a wheel's lowest point on uneven ground: the highest ground under its tread
function wheelFloor(x, z) {
  let m = -1
  for (let k = -3; k <= 3; k++) {
    const dx = (k / 3) * WR * 0.9
    m = Math.max(m, groundAt(x + dx, z) + Math.sqrt(WR * WR - dx * dx))
  }
  return m - WR
}

function groundGeo(color) {
  const g = polarGrid(PR, 14, 36, (u, a) => groundAt(Math.cos(a) * PR * u, Math.sin(a) * PR * u), 0, 2).toNonIndexed()
  g.computeVertexNormals()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  const r = rng(7)
  for (let f = 0; f < p.count; f += 3) {
    const h = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3 - GY
    c.set(color).multiplyScalar((0.9 + r() * 0.12) * (h < -0.01 ? 0.82 : h > 0.02 ? 1.06 : 1))
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// A woven wire wheel turning about z: a mesh tyre, chevron treads, a hub.
function Wheel({ geo, L, wheelRef }) {
  return (
    <group ref={wheelRef}>
      <mesh geometry={geo.tyre}>
        <Flat color="#8f949b" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh geometry={geo.weave}>
        <meshBasicMaterial color="#4a4e55" wireframe />
      </mesh>
      {Array.from({ length: 12 }, (_, k) => (
        <group key={k} rotation-z={(k / 12) * TAU}>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.chev} position={[WR * 0.97, 0, (s * TW) / 4]} rotation-x={s * 0.5}>
              <Flat color="#d8dbe0" metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh geometry={geo.hub}>
        <Flat color={L.accent} roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  )
}

export function LunarRover({ look = 'apollo' }) {
  const L = LOOKS[look] || LOOKS.apollo
  const { tap, handlers, clock } = useTap(1)
  const rover = useRef()
  const chassis = useRef()
  const hubs = useRef([])
  const wheels = useRef([])
  const struts = useRef([])
  const yawG = useRef()
  const tiltG = useRef()
  const beam = useRef()
  const pulses = useRef([])
  const earth = useRef()
  const tailL = useRef()
  const tailR = useRef()
  const st = useRef({ yaw: 0, vy: 0, tilt: 0.3, vt: 0, x: 0 })
  const v = useMemo(() => new THREE.Vector3(), [])

  const geo = useGeo(
    () => ({
      ground: groundGeo(L.ground),
      skirt: new THREE.CylinderGeometry(PR, PR * 1.02, GY, 36, 1, true).translate(0, GY / 2, 0),
      rock: blob(1, 3, 0),
      tyre: new THREE.CylinderGeometry(WR * 0.94, WR * 0.94, TW, 14, 1).rotateX(Math.PI / 2),
      weave: new THREE.CylinderGeometry(WR * 0.955, WR * 0.955, TW * 0.98, 14, 3, true).rotateX(Math.PI / 2),
      chev: new THREE.BoxGeometry(0.018, 0.012, TW * 0.55),
      hub: new THREE.CylinderGeometry(WR * 0.35, WR * 0.35, TW + 0.02, 8).rotateX(Math.PI / 2),
      strut: new THREE.BoxGeometry(0.022, 1, 0.022).translate(0, 0.5, 0),
      arm: new THREE.BoxGeometry(0.14, 0.018, 0.018),
      rail: new THREE.CylinderGeometry(0.014, 0.014, 0.86, 6).rotateZ(Math.PI / 2),
      cross: new THREE.CylinderGeometry(0.014, 0.014, TZ * 2 - 0.1, 6).rotateX(Math.PI / 2),
      floor: facet(new THREE.BoxGeometry(0.78, 0.014, 0.4), 0.002, 4),
      fender: new THREE.CylinderGeometry(WR + 0.03, WR + 0.03, TW + 0.03, 10, 1, true, -Math.PI / 2, Math.PI * 0.9).rotateX(-Math.PI / 2),
      seatPan: new THREE.BoxGeometry(0.15, 0.02, 0.15),
      seatBack: new THREE.BoxGeometry(0.02, 0.15, 0.15),
      seatLeg: new THREE.BoxGeometry(0.012, 0.08, 0.012),
      post: new THREE.CylinderGeometry(0.012, 0.014, 0.2, 5).translate(0, 0.1, 0),
      panel: facet(new THREE.BoxGeometry(0.06, 0.08, 0.16), 0.002, 5),
      handle: new THREE.BoxGeometry(0.02, 0.07, 0.02),
      cam: facet(new THREE.BoxGeometry(0.08, 0.06, 0.06), 0.002, 6),
      lens: new THREE.CylinderGeometry(0.018, 0.022, 0.04, 7).rotateZ(Math.PI / 2),
      pallet: facet(new THREE.BoxGeometry(0.16, 0.12, 0.36), 0.003, 7),
      mast: new THREE.CylinderGeometry(0.011, 0.013, 0.42, 5).translate(0, 0.21, 0),
      dish: new THREE.LatheGeometry(Array.from({ length: 6 }, (_, i) => new THREE.Vector2(0.004 + (i / 5) * 0.17, ((i / 5) * 0.17) ** 2 * 2.2)), 12).rotateZ(-Math.PI / 2),
      rib: new THREE.BoxGeometry(0.003, 0.17, 0.006).translate(0, 0.085, 0),
      feed: new THREE.CylinderGeometry(0.004, 0.004, 0.11, 4).rotateZ(-Math.PI / 2).translate(0.055, 0, 0),
      lga: new THREE.CylinderGeometry(0.006, 0.03, 0.22, 6).translate(0, 0.11, 0),
      flag: new THREE.BoxGeometry(0.004, 0.06, 0.09),
      earth: new THREE.IcosahedronGeometry(0.26, 2),
      land: blob(1, 21, 1),
      cloud: blob(1, 22, 0),
      pulse: new THREE.TorusGeometry(1, 0.12, 4, 16).rotateY(Math.PI / 2),
      hit: new THREE.BoxGeometry(1.0, 0.8, 0.8),
    }),
    [L.ground],
  )
  const rocks = useMemo(
    () =>
      [
        [-0.25, 0.62, 0.07],
        [0.9, -0.42, 0.06],
        [-1.15, 0.25, 0.08],
        [0.35, 0.95, 0.05],
        [1.15, -0.2, 0.05],
        [-0.6, -0.9, 0.06],
      ].map(([x, z, r]) => [x, groundAt(x, z) + r * 0.3, z, r]),
    [],
  )
  const W = useMemo(() => [-1, 1].flatMap((ax) => [-1, 1].map((sz) => [(ax * WB) / 2, sz * TZ])), []) // rear-right, rear-left, front-right, front-left (left is +z)

  useFrame((_, dtRaw) => {
    const d = Math.min(Math.max(dtRaw, 1e-3), 0.05)
    const t = clock.elapsedTime
    const S = st.current
    // creep back and forth along x
    const x = AMP * Math.sin(t * RATE)
    S.speed = (x - S.x) / d
    S.x = x
    rover.current.position.x = x
    // every wheel finds the ground under it and turns with the distance
    const yw = W.map(([wx, wz]) => wheelFloor(x + wx, wz) + WR)
    W.forEach(([wx, wz], i) => {
      hubs.current[i].position.set(wx, yw[i], wz)
      wheels.current[i].rotation.z = -x / WR
    })
    const front = (yw[2] + yw[3]) / 2
    const rear = (yw[0] + yw[1]) / 2
    const left = (yw[1] + yw[3]) / 2
    const right = (yw[0] + yw[2]) / 2
    const cy = (front + rear) / 2 + CL
    const pitch = Math.atan2(front - rear, WB) * 0.85
    const roll = Math.atan2(left - right, TZ * 2) * 0.85
    chassis.current.position.y = cy + Math.sin(t * 9) * 0.0015
    chassis.current.rotation.set(-roll, 0, pitch)
    // the struts stretch from each hub up to its corner of the frame
    W.forEach(([wx, wz], i) => {
      const corner = cy + Math.tan(pitch) * wx + Math.tan(roll) * wz * 0.8 - 0.02
      const m = struts.current[i]
      m.position.set(wx, yw[i], wz * 0.8)
      m.scale.y = Math.max(0.02, corner - yw[i])
    })
    // the dish: scanning lazily, or swung round and up to find the Earth
    const s = tap.since(t)
    const seek = s >= 0 && s < 4.2
    rover.current.updateWorldMatrix(true, false)
    v.set(MAST[0], 0.9, MAST[2]).applyMatrix4(rover.current.matrixWorld)
    rover.current.parent.worldToLocal(v)
    const dx = EARTH.x - v.x
    const dz = EARTH.z - v.z
    const ty = seek ? Math.atan2(-dz, dx) : 0.5 + Math.sin(t * 0.4) * 0.35
    const tt = seek ? Math.atan2(EARTH.y - v.y, Math.hypot(dx, dz)) : 0.3 + Math.sin(t * 0.55) * 0.08
    S.vy += ((ty - S.yaw) * 22 - S.vy * 6.5) * d
    S.yaw += S.vy * d
    S.vt += ((tt - S.tilt) * 22 - S.vt * 6.5) * d
    S.tilt += S.vt * d
    yawG.current.rotation.y = S.yaw
    tiltG.current.rotation.z = S.tilt
    // the signal: a beam and pulses running out to the Earth
    const reach = Math.max(0.5, Math.hypot(dx, EARTH.y - v.y, dz) - 0.3)
    beam.current.scale.z = reach / 4
    const on = s > 0.9 && s < 3.9
    const b = on ? Math.min(1, (s - 0.9) * 4, (3.9 - s) * 3) : 0
    beam.current.visible = b > 0.01
    beam.current.material.opacity = 0.5 * b * (0.75 + 0.25 * Math.sin(t * 18))
    let flash = 0
    pulses.current.forEach((m, i) => {
      const u = on ? ((s - 0.9) * 1.1 + i / 4) % 1 : -1
      m.visible = u >= 0
      if (!m.visible) return
      m.position.x = 0.08 + u * reach
      m.scale.setScalar(0.05 + u * 0.12)
      m.material.opacity = 0.9 * (1 - u * 0.6)
      if (u > 0.85) flash = Math.max(flash, (u - 0.85) / 0.15)
    })
    earth.current.material.emissiveIntensity = 0.12 + flash * 0.8 * b
    earth.current.rotation.y = t * 0.15
  })

  const moving = () => Math.abs(st.current.speed || 0) > 0.06

  return (
    <group {...handlers}>
      {/* the regolith: bumps on the track, craters round about */}
      <mesh geometry={geo.ground}>
        <Flat color="#ffffff" vertexColors />
      </mesh>
      <mesh geometry={geo.skirt}>
        <Flat color={L.rock} side={THREE.DoubleSide} />
      </mesh>
      {rocks.map(([x, y, z, r], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, y, z]} scale={[r * 1.3, r, r * 1.1]} rotation-y={i * 1.3}>
          <Flat color={i % 2 ? L.rock : L.ground} />
        </mesh>
      ))}
      {/* the Earth in the sky */}
      <group position={EARTH.toArray()} scale={1.6}>
        <mesh ref={earth} geometry={geo.earth}>
          <meshStandardMaterial color="#3f7fd6" emissive="#7fb4ff" emissiveIntensity={0.12} flatShading roughness={0.6} />
        </mesh>
        {[
          [0.15, 0.11, 0.16, 0.1],
          [-0.14, -0.04, 0.2, 0.09],
          [0.04, -0.17, 0.19, 0.08],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} geometry={geo.land} position={[x, y, z]} scale={[r, r * 0.8, r * 0.6]}>
            <Flat color="#5fae5a" />
          </mesh>
        ))}
        {[
          [-0.04, 0.21, 0.12, 0.08],
          [0.21, -0.06, 0.11, 0.06],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} geometry={geo.cloud} position={[x, y, z]} scale={[r * 1.4, r * 0.5, r]}>
            <Flat color="#ffffff" />
          </mesh>
        ))}
      </group>

      <group ref={rover}>
        {W.map((_, i) => (
          <group key={i} ref={(el) => (hubs.current[i] = el)}>
            <Wheel geo={geo} L={L} wheelRef={(el) => (wheels.current[i] = el)} />
          </group>
        ))}
        {W.map((_, i) => (
          <mesh key={i} ref={(el) => (struts.current[i] = el)} geometry={geo.strut}>
            <Flat color={L.frame} metalness={0.3} roughness={0.5} />
          </mesh>
        ))}
        {/* where the rear tyres touch down, for the dust */}
        <group ref={tailL} position={[-WB / 2, 0.07, TZ]} />
        <group ref={tailR} position={[-WB / 2, 0.07, -TZ]} />

        <group ref={chassis}>
          {/* the open frame and its floor pan */}
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.rail} position={[0, 0, sz * (TZ - 0.05)]}>
              <Flat color={L.frame} metalness={0.3} roughness={0.5} />
            </mesh>
          ))}
          {[-0.4, -0.13, 0.13, 0.4].map((x) => (
            <mesh key={x} geometry={geo.cross} position-x={x}>
              <Flat color={L.frame} metalness={0.3} roughness={0.5} />
            </mesh>
          ))}
          <mesh geometry={geo.floor} position-y={-0.012}>
            <Flat color="#7d828a" />
          </mesh>
          {W.map(([wx, wz], i) => (
            <group key={i} position={[wx, -CL + 0.005, wz]}>
              <mesh geometry={geo.fender}>
                <Flat color={L.fender} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
          {W.map(([wx, wz], i) => (
            <mesh key={i} geometry={geo.arm} position={[wx * 0.9, -0.01, wz * 0.85]}>
              <Flat color={L.frame} />
            </mesh>
          ))}
          {/* two webbed seats */}
          {[-1, 1].map((sz) => (
            <group key={sz} position={[-0.08, 0, sz * 0.12]}>
              {[-1, 1].map((k) => (
                <mesh key={k} geometry={geo.seatLeg} position={[k * 0.06, 0.04, 0]}>
                  <Flat color={L.frame} />
                </mesh>
              ))}
              <mesh geometry={geo.seatPan} position-y={0.085}>
                <Flat color={L.seat} />
              </mesh>
              <mesh geometry={geo.seatBack} position={[-0.075, 0.16, 0]} rotation-z={-0.18}>
                <Flat color={L.seat} />
              </mesh>
            </group>
          ))}
          {/* the control post and console between the seats */}
          <mesh geometry={geo.post} position={[0.13, 0, 0]}>
            <Flat color={L.frame} />
          </mesh>
          <mesh geometry={geo.panel} position={[0.14, 0.22, 0]} rotation-z={0.4}>
            <Flat color={L.accent} roughness={0.5} />
          </mesh>
          <mesh geometry={geo.handle} position={[0.06, 0.1, 0]}>
            <Flat color="#2a2a30" />
          </mesh>
          {/* the TV camera on the nose and the tool pallet at the back */}
          <mesh geometry={geo.cam} position={[0.4, 0.09, 0.12]}>
            <Flat color="#e8e6e0" />
          </mesh>
          <mesh geometry={geo.lens} position={[0.45, 0.09, 0.12]}>
            <Flat color="#2a2a30" />
          </mesh>
          <mesh geometry={geo.pallet} position={[-0.36, 0.06, 0]}>
            <Flat color={L.accent} roughness={0.5} metalness={0.2} />
          </mesh>
          {/* a low-gain antenna and a small flag */}
          <mesh geometry={geo.lga} position={[0.28, 0.06, 0.18]}>
            <Flat color={L.frame} />
          </mesh>
          <mesh geometry={geo.mast} position={[-0.4, 0.12, 0.17]} scale={[0.7, 0.7, 0.7]}>
            <Flat color={L.frame} />
          </mesh>
          <mesh geometry={geo.flag} position={[-0.4, 0.38, 0.22]} rotation-y={Math.PI / 2}>
            <Flat color={L.accent} side={THREE.DoubleSide} />
          </mesh>
          {/* the high-gain dish on its mast: it pans, then tilts */}
          <group position={[MAST[0], 0, MAST[2]]}>
            <mesh geometry={geo.mast}>
              <Flat color={L.frame} />
            </mesh>
            <group ref={yawG} position-y={0.43}>
              <group ref={tiltG}>
                <mesh geometry={geo.dish}>
                  <Flat color={L.dish} side={THREE.DoubleSide} metalness={0.2} roughness={0.5} />
                </mesh>
                {Array.from({ length: 6 }, (_, k) => (
                  <mesh key={k} geometry={geo.rib} position-x={0.004} rotation-x={(k / 6) * TAU}>
                    <Flat color={L.accent} />
                  </mesh>
                ))}
                <mesh geometry={geo.feed}>
                  <Flat color="#5a5f68" />
                </mesh>
                <Beam ref={beam} length={4} radius={0.22} color="#bfe6ff" opacity={0} rotation-y={Math.PI / 2} position-x={0.07} visible={false} />
                {Array.from({ length: 4 }, (_, i) => (
                  <mesh key={i} ref={(el) => (pulses.current[i] = el)} geometry={geo.pulse} visible={false}>
                    <meshBasicMaterial color="#e8f6ff" transparent depthWrite={false} />
                  </mesh>
                ))}
              </group>
            </group>
          </group>
        </group>
        <mesh geometry={geo.hit} position={[0, 0.35, 0]}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
      <Trail target={tailL} count={14} every={0.06} color={L.ground} size={0.035} grow={0.08} opacity={0.6} active={moving} />
      <Trail target={tailR} count={14} every={0.06} color={L.ground} size={0.035} grow={0.08} opacity={0.6} active={moving} />
    </group>
  )
}

export default function LunarRoverScene({ background, autoRotate, float, ...props }) {
  const L = LOOKS[props.look] || LOOKS.apollo
  // mars tints the default sky a dusty pink
  const bg = L.bg && (!background || background.toLowerCase() === '#eceaf1') ? L.bg : background
  return (
    <Stage background={bg} autoRotate={autoRotate} float={float} camera={[2.8, 1.75, 3.8]} target={[0, 0.66, -0.2]} hint="The rover creeps back and forth on its own: each wheel rides the bumps on its strut, the frame pitches and rolls and the wheels turn with the ground · tap it and the dish swings round to find the Earth and beams a pulsing signal home · Look swaps apollo, modern and mars · drag to orbit">
      <LunarRover {...props} />
    </Stage>
  )
}
