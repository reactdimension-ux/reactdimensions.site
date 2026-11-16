import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, facet, rng, useGeo, useKick, useTap, wobble } from './kit.jsx'

// A low-poly gramophone: a wooden cabinet on little feet with an inset
// panel and a winding crank, a platter with a black record and a bright
// label, a tone arm with its soundbox, and a flared, petalled horn on a
// curving neck. The record spins, the crank turns slowly, and music notes
// float out of the horn and drift away. Tap it and the needle lifts, swings
// out and drops back onto the record with a sparkle and a burst of notes.

const LOOKS = {
  brass: { wood: '#8a5a3a', dark: '#6e452b', horn: '#e0ad42', hornIn: '#b8822a', metal: '#d9a43a', label: '#e3393f', notes: ['#2c2a33', '#3a3846', '#6e452b'] },
  mahogany: { wood: '#6e2a22', dark: '#4e1c18', horn: '#8a3a2c', hornIn: '#5a2018', metal: '#d9a43a', label: '#f6c93a', notes: ['#2c2a33', '#8a3a2c', '#c8a24a'] },
  mint: { wood: '#8fd8bf', dark: '#6cc0a6', horn: '#f4ead2', hornIn: '#e3cfa6', metal: '#d9a43a', label: '#f27aa6', notes: ['#e86a8a', '#3d8de0', '#2c2a33'] },
}
const W = 1.1 // cabinet width and depth
const H = 0.42 // cabinet height
const REC = [-0.08, 0.06] // record centre x, z
const REC_Y = H + 0.065 // record top
const PIVOT = [0.4, -0.38] // tone arm pivot x, z
const ARM = 0.7
const YAW = -0.39 // the arm's angle with the needle in the groove
const ARM_Y = H + 0.15
// the horn: a throat behind the arm, flaring forward and up
const THROAT = new THREE.Vector3(0.38, H + 0.42, -0.5)
const AXIS = new THREE.Vector3(-0.3, 0.7, 0.75).normalize()
const HORN_LEN = 1.0
const BELL = THROAT.clone().addScaledVector(AXIS, HORN_LEN)
const DROP = 0.55 // seconds after a tap that the needle lands

// a chamfered box: the corners cut off in a single flat step
function chamferBox(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2)
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

// the horn: a lathe that flares like a trumpet, its mouth cut into petals
function hornGeo() {
  const pts = []
  for (let i = 0; i <= 10; i++) {
    const u = i / 10
    pts.push(new THREE.Vector2(0.045 + 0.48 * u ** 3.2, u * HORN_LEN))
  }
  const g = new THREE.LatheGeometry(pts, 16)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const u = p.getY(i) / HORN_LEN
    const k = 1 + 0.07 * Math.cos(Math.atan2(z, x) * 8) * u ** 3
    p.setX(i, x * k)
    p.setZ(i, z * k)
  }
  g.computeVertexNormals()
  return g
}

// an eighth note (flag) or a quarter note, facing +z
function noteGeos() {
  const head = facet(new THREE.IcosahedronGeometry(0.05, 0).scale(1.3, 0.9, 0.45).rotateZ(0.4), 0.004, 3)
  const stem = new THREE.BoxGeometry(0.016, 0.19, 0.016).translate(0.055, 0.09, 0)
  const flag = new THREE.BoxGeometry(0.075, 0.028, 0.016).rotateZ(-0.65).translate(0.085, 0.15, 0)
  return { head, stem, flag }
}

// music notes floating out of the horn. With a kick, a bigger handful
// bursts out once instead of the steady trickle.
function Notes({ geo, colors, count = 6, life = 2.8, burst, seed = 1 }) {
  const clock = useThree((s) => s.clock)
  const camera = useThree((s) => s.camera)
  const refs = useRef([])
  const P = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: count }, (_, i) => ({
      off: i / count,
      side: (r() - 0.5) * 2,
      up: 0.15 + r() * 0.35,
      out: 0.4 + r() * 0.5,
      ph: r() * TAU,
      flag: i % 3 !== 2,
      s: 0.85 + r() * 0.4,
      c: colors[i % colors.length],
      a: r() * TAU,
    }))
  }, [count, seed, colors.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const side = useMemo(() => new THREE.Vector3().crossVectors(AXIS, new THREE.Vector3(0, 1, 0)).normalize(), [])
  useFrame(() => {
    const t = clock.elapsedTime
    const s = burst ? burst.since(t) : 0
    P.forEach((p, i) => {
      const m = refs.current[i]
      if (!m) return
      let u
      if (burst) {
        u = s / life
        m.visible = u >= 0 && u < 1
      } else {
        u = (t / life + p.off) % 1
        m.visible = true
      }
      if (!m.visible) return
      // out of the bell along the horn's axis, rising and fanning out
      const go = burst ? 1 - (1 - u) ** 2 : u
      const fan = burst ? 1.6 : 0.5
      m.position.copy(BELL).addScaledVector(AXIS, 0.05 + go * p.out * (burst ? 1.4 : 1))
      m.position.addScaledVector(side, p.side * go * fan + Math.sin(t * 2.2 + p.ph) * 0.06 * u)
      if (burst) m.position.addScaledVector(side.clone().cross(AXIS), Math.cos(p.a) * go * 0.6)
      m.position.y += go * p.up * (burst ? 0.9 : 1)
      const pop = Math.min(1, u * 8)
      const fade = Math.min(1, (1 - u) * 3.5)
      m.scale.setScalar(Math.max(0.001, p.s * pop * fade * (burst ? 1.15 : 1)))
      m.quaternion.copy(camera.quaternion)
      m.rotateZ(Math.sin(t * 3 + p.ph) * 0.3)
    })
  })
  return (
    <group>
      {P.map((p, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} visible={false}>
          <mesh geometry={geo.head}>
            <Flat color={p.c} emissive={p.c} emissiveIntensity={0.2} />
          </mesh>
          <mesh geometry={geo.stem}>
            <Flat color={p.c} emissive={p.c} emissiveIntensity={0.2} />
          </mesh>
          {p.flag && (
            <mesh geometry={geo.flag}>
              <Flat color={p.c} emissive={p.c} emissiveIntensity={0.2} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

export function Gramophone({ look = 'brass' }) {
  const L = LOOKS[look] || LOOKS.brass
  const { tap, handlers, clock } = useTap(1)
  const drop = useKick(1.2)
  const record = useRef()
  const crank = useRef()
  const yaw = useRef()
  const lift = useRef()
  const spin = useRef(0)

  const geo = useGeo(
    () => ({
      cabinet: facet(chamferBox(W, H - 0.06, W, 0.05).translate(0, H / 2 + 0.03, 0), 0.006, 1),
      lidTrim: facet(chamferBox(W + 0.06, 0.05, W + 0.06, 0.02).translate(0, H - 0.025, 0), 0.004, 2),
      plinth: facet(chamferBox(W + 0.06, 0.06, W + 0.06, 0.02).translate(0, 0.06, 0), 0.004, 3),
      panel: new THREE.BoxGeometry(W * 0.7, H * 0.42, 0.02),
      foot: new THREE.CylinderGeometry(0.05, 0.035, 0.05, 6, 1).translate(0, 0.025, 0),
      platter: new THREE.CylinderGeometry(0.43, 0.43, 0.035, 20, 1).translate(0, 0.0175, 0),
      record: new THREE.CylinderGeometry(0.4, 0.4, 0.014, 24, 1).translate(0, 0.007, 0),
      groove: new THREE.RingGeometry(0.97, 1, 24, 1).rotateX(-Math.PI / 2),
      shine: new THREE.RingGeometry(0.15, 0.38, 6, 1, -0.18, 0.36).rotateX(-Math.PI / 2),
      label: new THREE.CircleGeometry(0.12, 14).rotateX(-Math.PI / 2),
      stripe: new THREE.PlaneGeometry(0.1, 0.022).rotateX(-Math.PI / 2),
      spindle: new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6, 1),
      post: facet(new THREE.CylinderGeometry(0.05, 0.075, 0.15, 8, 1).translate(0, 0.075, 0), 0.003, 4),
      arm: new THREE.CylinderGeometry(0.018, 0.024, ARM, 6, 1).rotateX(Math.PI / 2).translate(0, 0, ARM / 2),
      soundbox: facet(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 10, 1), 0.003, 5),
      needle: new THREE.ConeGeometry(0.008, 0.05, 4, 1).rotateX(Math.PI),
      horn: facet(hornGeo(), 0.006, 6),
      lip: new THREE.TorusGeometry(0.525, 0.018, 4, 16).rotateX(Math.PI / 2),
      neck: new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(PIVOT[0], H + 0.15, PIVOT[1]), THROAT.clone().addScaledVector(AXIS, -0.22).add(new THREE.Vector3(0.04, 0, -0.06)), THROAT), 10, 0.042, 7, false),
      collar: facet(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8, 1), 0.003, 7),
      shaft: new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6, 1).rotateZ(Math.PI / 2).translate(0.07, 0, 0),
      crankArm: new THREE.BoxGeometry(0.03, 0.22, 0.04).translate(0, -0.1, 0),
      knob: facet(new THREE.CylinderGeometry(0.03, 0.034, 0.1, 6, 1).rotateZ(Math.PI / 2), 0.003, 8),
      star: new THREE.OctahedronGeometry(1, 0).scale(1, 1, 0.4),
      ...Object.fromEntries(Object.entries(noteGeos()).map(([k, v]) => [`note_${k}`, v])),
    }),
    [],
  )
  const note = { head: geo.note_head, stem: geo.note_stem, flag: geo.note_flag }
  const hornQ = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), AXIS), [])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const d = Math.min(dt, 0.05)
    // the record turns steadily, a touch faster just after the needle drops
    spin.current += d * (2.4 + 2 * drop.value(t))
    record.current.rotation.y = -spin.current
    crank.current.rotation.x = -t * 0.8
    // the tone arm: up, out, back over the groove and down with a bounce
    let up = 0
    let out = 0
    if (s >= 0 && s < DROP) {
      const u = s / DROP
      up = Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * (u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25)
      out = Math.sin(u * Math.PI)
    }
    const bounce = wobble(s - DROP, 22, 7) * 0.05
    lift.current.rotation.x = -0.32 * up - Math.abs(bounce) + Math.sin(spin.current) * 0.004
    yaw.current.rotation.y = YAW + 0.25 * out + Math.sin(t * 0.13) * 0.01
  })

  return (
    <group
      {...handlers}
      onClick={(e) => {
        handlers.onClick(e)
        drop.kick(clock.elapsedTime + DROP)
      }}
    >
      {/* the cabinet */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={geo.foot} position={[x * 0.46, 0, z * 0.46]}>
          <Flat color={L.metal} metalness={0.35} roughness={0.4} />
        </mesh>
      ))}
      <mesh geometry={geo.plinth} position-y={-0.01}>
        <Flat color={L.dark} />
      </mesh>
      <mesh geometry={geo.cabinet}>
        <Flat color={L.wood} />
      </mesh>
      <mesh geometry={geo.lidTrim}>
        <Flat color={L.dark} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
        <group key={a} rotation-y={a}>
          <mesh geometry={geo.panel} position={[0, H / 2 + 0.03, W / 2 + 0.005]}>
            <Flat color={L.dark} />
          </mesh>
        </group>
      ))}

      {/* the crank */}
      <group position={[W / 2, H * 0.5, 0.18]}>
        <mesh geometry={geo.shaft}>
          <Flat color={L.metal} metalness={0.35} roughness={0.4} />
        </mesh>
        <group ref={crank} position-x={0.14}>
          <mesh geometry={geo.crankArm}>
            <Flat color={L.metal} metalness={0.35} roughness={0.4} />
          </mesh>
          <mesh geometry={geo.knob} position={[0.06, -0.19, 0]}>
            <Flat color="#2c2a33" />
          </mesh>
        </group>
      </group>

      {/* platter and record */}
      <group position={[REC[0], H, REC[1]]}>
        <mesh geometry={geo.platter}>
          <Flat color={L.metal} metalness={0.35} roughness={0.4} />
        </mesh>
        <group ref={record} position-y={0.035}>
          <mesh geometry={geo.record}>
            <Flat color="#1c1b22" roughness={0.35} />
          </mesh>
          {[0.18, 0.24, 0.3, 0.36].map((r) => (
            <mesh key={r} geometry={geo.groove} position-y={0.0145} scale={r}>
              <Flat color="#34323e" roughness={0.3} />
            </mesh>
          ))}
          <mesh geometry={geo.shine} position-y={0.0148}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.08} depthWrite={false} />
          </mesh>
          <mesh geometry={geo.label} position-y={0.015}>
            <Flat color={L.label} />
          </mesh>
          <mesh geometry={geo.stripe} position={[0.04, 0.016, 0]}>
            <Flat color="#f4f1ea" />
          </mesh>
          <mesh geometry={geo.spindle} position-y={0.03}>
            <Flat color="#c9ced8" metalness={0.4} roughness={0.35} />
          </mesh>
        </group>
      </group>

      {/* tone arm */}
      <group position={[PIVOT[0], H, PIVOT[1]]}>
        <mesh geometry={geo.post}>
          <Flat color={L.metal} metalness={0.35} roughness={0.4} />
        </mesh>
        <group ref={yaw} position-y={0.15} rotation-y={YAW}>
          <group ref={lift}>
            <mesh geometry={geo.arm}>
              <Flat color={L.metal} metalness={0.35} roughness={0.4} />
            </mesh>
            <group position={[0, 0, ARM]} rotation-x={0.25}>
              <mesh geometry={geo.soundbox} rotation-x={Math.PI / 2 - 0.25}>
                <Flat color="#c9ced8" metalness={0.4} roughness={0.35} />
              </mesh>
            </group>
            <mesh geometry={geo.needle} position={[0, -ARM_Y + REC_Y + 0.025, ARM]}>
              <Flat color="#2c2a33" />
            </mesh>
          </group>
        </group>
      </group>

      {/* the horn on its neck */}
      <mesh geometry={geo.neck}>
        <Flat color={L.metal} metalness={0.35} roughness={0.4} />
      </mesh>
      <group position={THROAT} quaternion={hornQ}>
        <mesh geometry={geo.collar}>
          <Flat color={L.metal} metalness={0.35} roughness={0.4} />
        </mesh>
        <mesh geometry={geo.horn}>
          <Flat color={L.horn} side={THREE.FrontSide} metalness={look === 'brass' ? 0.3 : 0} roughness={0.45} />
        </mesh>
        <mesh geometry={geo.horn}>
          <Flat color={L.hornIn} side={THREE.BackSide} roughness={0.6} />
        </mesh>
        <mesh geometry={geo.lip} position-y={HORN_LEN}>
          <Flat color={L.metal} metalness={0.35} roughness={0.4} />
        </mesh>
      </group>

      <Notes geo={note} colors={L.notes} count={6} life={3} seed={2} />
      <Notes geo={note} colors={L.notes} count={10} life={1.8} burst={drop} seed={7} />
      <Burst tap={drop} geometry={geo.star} count={16} colors={['#ffe066', '#ffc21a', '#fff7d0']} size={0.075} speed={1.4} gravity={1.5} life={1.0} origin={[PIVOT[0] + Math.sin(YAW) * ARM, REC_Y + 0.03, PIVOT[1] + Math.cos(YAW) * ARM]} spread={0.7} seed={5} />
    </group>
  )
}

export default function GramophoneScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.1, 2.6, 4.7]} target={[0, 0.95, 0]} hint="The record spins and music notes float out of the horn on their own · tap it and the needle lifts, swings out and drops back onto the record with a sparkle and a burst of notes · Look swaps brass, mahogany and mint · drag to orbit">
      <Gramophone {...props} />
    </Stage>
  )
}
