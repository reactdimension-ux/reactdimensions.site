import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly sewing machine of the classic kind: a flat bed on little feet,
// a tapered pillar up the right with a spoked hand wheel on its side, a
// humped arm across the top with gold decals, and the head at the left end
// with its needle bar, presser foot, take-up lever and tension discs. Thread
// runs from a spool on top of the arm, through the guides and the lever,
// down to the needle's eye. A square of gingham lies on the bed under the
// foot, its edges draped over the sides. Left alone, the needle bobs
// lightly, the wheel turns and the thread wiggles with the lever. Tap it and
// the machine races: the needle stabs down through the cloth, the feed
// walks the fabric back a stitch at a time and a dashed seam is left behind
// it. Then the foot lifts and the fabric slides back, shifted a little to
// one side, ready for the next seam beside it.

const LOOKS = {
  vintage: { body: '#1f1d22', decal: '#d8b04a', wheel: '#2a282e', rim: '#c9ccd4', fabric: ['#f6efe2', '#9cc0e0', '#3f78b5'], thread: '#d8352e', spool: '#b07a4a' },
  cream: { body: '#efe3c8', decal: '#5a86b0', wheel: '#e2d3b2', rim: '#c9ccd4', fabric: ['#fbf6e8', '#f2d27a', '#e0a52a'], thread: '#2f5f9e', spool: '#d9b98a' },
  mint: { body: '#8fd8c0', decal: '#fbf6ea', wheel: '#7cc8b0', rim: '#f7f3ea', fabric: ['#fff6f8', '#f6b6c8', '#e0607f'], thread: '#1f7a6a', spool: '#f2d6a8' },
}

const BT = 0.2 // top of the bed
const BED = { x0: -1.05, x1: 0.85, z: 0.5 } // the bed's extent
const NX = -0.6 // the needle's line
const NZ = 0
const FAB = { w: 0.74, d: 0.92 } // the fabric
const Z0 = 0.25 // fabric centre z before it feeds
const PITCH = 0.04 // stitch length
const STITCHES = 11 // stitches in one seam
const LANES = [-0.12, 0, 0.12] // seam positions across the fabric (local x)
const C = { sew: 2.7, hold: 3.5, back: 4.2 } // a tap's timeline, in seconds
const RATE = { idle: 0.85, sew: 5.2 } // needle strokes a second

const ss = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
// how far the feed has walked the fabric after c needle strokes: it moves
// one stitch while the needle is up, and holds still while it is down
const feedAt = (c) => {
  if (c < 0.8) return 0
  const m = Math.floor(c - 0.8)
  return PITCH * (m + ss(0, 0.4, c - 0.8 - m))
}
// cloth past the front or back edge of the bed folds down over it: returns
// [local z, y] for a point at local z on fabric whose centre is at gz
function drape(lz, gz) {
  const wz = lz + gz
  const over = Math.abs(wz) - BED.z
  if (over <= 0) return [lz, 0]
  return [Math.sign(wz) * (BED.z + over * 0.25) - gz, -Math.min(BT - 0.03, over * 0.95)]
}

// gingham: each face coloured by whether its row, its column or both are dark
function ginghamGeo(colors) {
  const g = new THREE.PlaneGeometry(FAB.w, FAB.d, 16, 22).rotateX(-Math.PI / 2).toNonIndexed()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let f = 0; f < p.count; f += 3) {
    const x = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3
    const z = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3
    const a = Math.floor((x + FAB.w / 2) / (FAB.w / 8)) % 2
    const b = Math.floor((z + FAB.d / 2) / (FAB.d / 10)) % 2
    c.set(colors[a + b])
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

export function SewingMachine({ look = 'vintage' }) {
  const L = LOOKS[look] || LOOKS.vintage
  const { tap, handlers, clock } = useTap(1)
  const wheel = useRef()
  const needleBar = useRef()
  const lever = useRef()
  const foot = useRef()
  const fabric = useRef()
  const spool = useRef()
  const threadRefs = useRef([])
  const stitchRefs = useRef([])
  // the machine's own state: needle phase, which seam it is on, how far
  // each seam has got, and when the current run started
  const st = useRef({ phase: 0, rate: RATE.idle, t0: null, start: -99, startPhase: 0, run: -1, lane: 0, counts: [0, 0, 0], feed: 0, fx: NX - LANES[0], fromX: NX - LANES[0] })
  const fab = useGeo(() => ginghamGeo(L.fabric), [look])
  const fabBase = useMemo(() => Float32Array.from(fab.attributes.position.array), [fab])

  const geo = useGeo(
    () => ({
      bed: facet(new THREE.BoxGeometry(BED.x1 - BED.x0, 0.14, BED.z * 2).translate(0, 0.07, 0), 0.004, 1),
      bedTrim: new THREE.BoxGeometry(BED.x1 - BED.x0 + 0.01, 0.018, BED.z * 2 + 0.01),
      foot: new THREE.CylinderGeometry(0.05, 0.06, 0.06, 6).translate(0, 0.03, 0),
      pillar: facet(new THREE.CylinderGeometry(0.2, 0.27, 0.82, 4, 2).rotateY(Math.PI / 4).scale(1, 1, 1.25).translate(0, 0.41, 0), 0.006, 2),
      arm: facet(new THREE.BoxGeometry(1.15, 0.22, 0.3), 0.005, 3),
      hump: facet(new THREE.CylinderGeometry(0.15, 0.15, 1.15, 8, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.55, 1), 0.004, 4),
      head: facet(new THREE.BoxGeometry(0.32, 0.46, 0.34), 0.006, 5),
      headCap: facet(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 8, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).scale(1, 0.45, 1), 0.004, 6),
      face: new THREE.BoxGeometry(0.012, 0.36, 0.26),
      decal: new THREE.BoxGeometry(0.9, 0.012, 0.004),
      scroll: new THREE.TorusGeometry(0.05, 0.007, 3, 10, Math.PI * 1.4),
      badge: new THREE.CylinderGeometry(0.06, 0.06, 0.012, 10).rotateX(Math.PI / 2),
      bar: new THREE.CylinderGeometry(0.017, 0.017, 0.34, 6).translate(0, -0.17, 0),
      clamp: new THREE.BoxGeometry(0.05, 0.04, 0.05),
      needle: new THREE.CylinderGeometry(0.006, 0.0015, 0.13, 4).translate(0, -0.065, 0),
      presserBar: new THREE.CylinderGeometry(0.013, 0.013, 0.42, 6).translate(0, 0.21, 0),
      presserFoot: facet(new THREE.BoxGeometry(0.08, 0.018, 0.13), 0.002, 7),
      toe: new THREE.BoxGeometry(0.025, 0.018, 0.07),
      leverArm: new THREE.BoxGeometry(0.025, 0.025, 0.12).translate(0, 0, 0.06),
      leverEye: new THREE.TorusGeometry(0.018, 0.006, 4, 8).rotateY(Math.PI / 2),
      disc: new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10).rotateX(Math.PI / 2),
      knob: new THREE.CylinderGeometry(0.022, 0.026, 0.04, 8).rotateX(Math.PI / 2),
      guide: new THREE.TorusGeometry(0.014, 0.005, 4, 8),
      pin: new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5).translate(0, 0.1, 0),
      spoolBody: facet(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 10), 0.002, 8),
      spoolEnd: new THREE.CylinderGeometry(0.058, 0.058, 0.018, 10),
      // the hand wheel turns on the x axis
      rim: facet(new THREE.TorusGeometry(0.2, 0.035, 5, 16).rotateY(Math.PI / 2), 0.003, 9),
      tread: new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16, 1, true).rotateZ(Math.PI / 2),
      hub: new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8).rotateZ(Math.PI / 2),
      spoke: new THREE.BoxGeometry(0.03, 0.36, 0.035),
      knobW: new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8).rotateZ(Math.PI / 2),
      lever: new THREE.BoxGeometry(0.02, 0.1, 0.02).translate(0, 0.05, 0),
      plate: new THREE.BoxGeometry(0.22, 0.008, 0.18),
      thread: new THREE.CylinderGeometry(0.0045, 0.0045, 1, 4).translate(0, 0.5, 0),
      stitch: new THREE.BoxGeometry(0.016, 0.012, PITCH * 0.68),
      hit: new THREE.BoxGeometry(1.95, 1.25, 1.1),
    }),
    [],
  )
  const threadCurve = useMemo(() => new THREE.CatmullRomCurve3(Array.from({ length: 8 }, () => new THREE.Vector3()), false, 'centripetal'), [])
  const SEGS = 26
  const wig = useMemo(() => {
    const r = rng(4)
    return Array.from({ length: 8 }, () => r() * TAU)
  }, [])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const S = st.current
    const d = Math.min(dt, 0.05)
    // a fresh tap starts a run, unless one is still going
    const t0 = t - tap.since(t)
    if (S.t0 === null) S.t0 = t0
    if (t0 !== S.t0) {
      S.t0 = t0
      if (t - S.start > C.back) {
        S.start = t
        S.startPhase = S.phase
        S.run++
        S.lane = S.run % LANES.length
        S.counts[S.lane] = 0
        S.fromX = S.fx
      }
    }
    const s = t - S.start
    const sewing = s >= 0 && s < C.sew
    // the needle's stroke rate eases up to a race while it sews
    S.rate += ((sewing ? RATE.sew : RATE.idle) - S.rate) * Math.min(1, d * 6)
    S.phase += d * S.rate
    const c = S.phase
    const power = (S.rate - RATE.idle) / (RATE.sew - RATE.idle)

    // the feed: a stitch at a time while sewing, then slide back and over
    if (sewing) {
      const sc = S.phase - S.startPhase
      S.feed = Math.min(STITCHES * PITCH, feedAt(sc))
      S.counts[S.lane] = Math.min(STITCHES, Math.max(S.counts[S.lane], sc >= 0.5 ? Math.floor(sc - 0.5) : 0))
    }
    const back = ss(C.hold, C.back, s)
    const feed = s >= C.hold && s < C.back + 0.1 ? S.feed * (1 - back) : s >= C.back ? 0 : S.feed
    if (s >= C.back) S.feed = 0
    const toX = NX - LANES[(S.lane + 1) % LANES.length]
    if (S.run >= 0) S.fx = s < C.hold ? NX - LANES[S.lane] : NX - LANES[S.lane] + (toX - (NX - LANES[S.lane])) * back
    const gx = S.fx
    const gz = Z0 - feed
    fabric.current.position.set(gx, BT + 0.012, gz)
    // the cloth drapes over the bed's edges as it slides
    const p = fab.attributes.position
    for (let i = 0; i < p.count; i++) {
      const lx = fabBase[i * 3]
      const [lz, y] = drape(fabBase[i * 3 + 2], gz)
      p.setXYZ(i, lx, y + 0.003 * Math.sin(lx * 30 + lz * 20), lz)
    }
    p.needsUpdate = true
    fab.computeVertexNormals()
    // the seams already sewn, on the fabric
    for (let ln = 0; ln < LANES.length; ln++)
      for (let k = 0; k < STITCHES; k++) {
        const m = stitchRefs.current[ln * STITCHES + k]
        if (!m) continue
        m.visible = k < S.counts[ln] && S.run >= 0
        if (!m.visible) continue
        const [lz, y] = drape(NZ - Z0 + (k + 0.5) * PITCH, gz)
        m.position.set(LANES[ln], y + 0.006, lz)
        m.rotation.x = y < 0 ? -0.9 * Math.sign(lz + gz) : 0
      }

    // the needle bar strokes, deeper when sewing; the wheel turns with it
    const amp = 0.045 + 0.09 * power
    const nb = BT + 0.235 - amp * (0.5 - 0.5 * Math.cos(c * TAU))
    needleBar.current.position.y = nb
    wheel.current.rotation.x = -c * TAU
    const lev = 0.045 * Math.sin(c * TAU + Math.PI / 2)
    lever.current.position.y = 0.93 + lev
    // the presser foot lifts while the fabric slides back
    const lift = s >= C.hold - 0.2 && s < C.back + 0.2 ? ss(C.hold - 0.2, C.hold, s) * (1 - ss(C.back, C.back + 0.2, s)) : 0
    foot.current.position.y = BT + 0.026 + lift * 0.05
    spool.current.rotation.y += d * (0.3 + power * 4)

    // the thread: spool, guides, tension discs, lever eye, down to the needle
    const eye = nb - 0.09 // the needle's eye, just above its point
    const P = threadCurve.points
    P[0].set(0.2, 1.24, -0.05)
    P[1].set(-0.15, 1.1, 0.02)
    P[2].set(-0.52, 1.02, 0.19)
    P[3].set(-0.58, 0.88, 0.205)
    P[4].set(-0.66, 0.93 + lev, 0.25)
    P[5].set(-0.62, 0.7, 0.12)
    P[6].set(NX + 0.01, eye + 0.12, NZ + 0.03)
    P[7].set(NX, eye, NZ + 0.012)
    // a little wiggle in the free runs, livelier when it races
    const w = 0.006 + power * 0.008
    ;[1, 2, 5, 6].forEach((i) => {
      P[i].x += Math.sin(t * 7 + wig[i]) * w
      P[i].z += Math.cos(t * 9 + wig[i]) * w
    })
    for (let i = 0; i < SEGS; i++) {
      const m = threadRefs.current[i]
      if (!m) continue
      threadCurve.getPoint(i / SEGS, _a)
      threadCurve.getPoint((i + 1) / SEGS, _b)
      m.position.copy(_a)
      _b.sub(_a)
      const len = _b.length()
      m.scale.set(1, Math.max(0.0001, len), 1)
      m.quaternion.setFromUnitVectors(_up, _b.normalize())
    }
  })

  return (
    <group {...handlers}>
      {/* the bed on its feet */}
      {[
        [-0.9, -0.38],
        [-0.9, 0.38],
        [0.7, -0.38],
        [0.7, 0.38],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={geo.foot} position={[x, 0, z]}>
          <Flat color="#2c2a30" />
        </mesh>
      ))}
      <mesh geometry={geo.bed} position={[(BED.x0 + BED.x1) / 2, 0.06, 0]}>
        <Flat color={L.body} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.bedTrim} position={[(BED.x0 + BED.x1) / 2, BT - 0.03, 0]}>
        <Flat color={L.decal} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.plate} position={[NX, BT + 0.002, NZ]}>
        <Flat color={L.rim} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* the pillar, arm and head */}
      <mesh geometry={geo.pillar} position={[0.6, BT, -0.04]}>
        <Flat color={L.body} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.arm} position={[0.05, 0.9, -0.04]}>
        <Flat color={L.body} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.hump} position={[0.05, 1.01, -0.04]}>
        <Flat color={L.body} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.head} position={[-0.6, 0.83, 0]}>
        <Flat color={L.body} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.headCap} position={[-0.6, 1.06, 0]}>
        <Flat color={L.body} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.face} position={[-0.766, 0.82, 0]}>
        <Flat color={L.rim} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* gold decals and a badge */}
      {[0.84, 0.97].map((y, i) => (
        <mesh key={y} geometry={geo.decal} position={[0.02, y, 0.112]} scale={[1 - i * 0.2, 1, 1]}>
          <Flat color={L.decal} emissive={L.decal} emissiveIntensity={0.15} />
        </mesh>
      ))}
      {[-0.32, 0.36].map((x, i) => (
        <mesh key={x} geometry={geo.scroll} position={[x, 0.905, 0.112]} rotation-z={i ? Math.PI : 0}>
          <Flat color={L.decal} emissive={L.decal} emissiveIntensity={0.15} />
        </mesh>
      ))}
      <mesh geometry={geo.badge} position={[0.6, 0.55, 0.18]}>
        <Flat color={L.decal} emissive={L.decal} emissiveIntensity={0.2} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.lever} position={[0.5, 0.36, 0.205]} rotation-z={0.5}>
        <Flat color={L.rim} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* tension discs, guides and the take-up lever on the head */}
      <group position={[-0.58, 0.88, 0.17]}>
        {[0, 0.014].map((z) => (
          <mesh key={z} geometry={geo.disc} position-z={z}>
            <Flat color={L.rim} metalness={0.5} roughness={0.3} />
          </mesh>
        ))}
        <mesh geometry={geo.knob} position-z={0.04}>
          <Flat color={L.rim} metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
      <mesh geometry={geo.guide} position={[-0.15, 1.1, 0.02]} rotation-y={Math.PI / 2}>
        <Flat color={L.rim} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh geometry={geo.guide} position={[-0.62, 0.7, 0.12]} rotation-x={Math.PI / 2}>
        <Flat color={L.rim} metalness={0.5} roughness={0.3} />
      </mesh>
      <group ref={lever} position={[-0.66, 0.93, 0.16]}>
        <mesh geometry={geo.leverArm}>
          <Flat color={L.rim} metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh geometry={geo.leverEye} position-z={0.1}>
          <Flat color={L.rim} metalness={0.5} roughness={0.3} />
        </mesh>
      </group>

      {/* the needle bar, the needle, and the presser foot */}
      <group ref={needleBar} position={[NX, BT + 0.2, NZ]}>
        <mesh geometry={geo.bar} position-y={0.24}>
          <Flat color={L.rim} metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh geometry={geo.clamp} position-y={0.04}>
          <Flat color={L.rim} metalness={0.5} roughness={0.3} />
        </mesh>
        <group position-y={0.02}>
          <mesh geometry={geo.needle} position-y={0}>
            <Flat color="#e6e8ee" metalness={0.6} roughness={0.25} />
          </mesh>
        </group>
      </group>
      <group ref={foot} position={[NX, BT + 0.026, NZ]}>
        <mesh geometry={geo.presserBar} position={[0, 0.0, -0.06]}>
          <Flat color={L.rim} metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh geometry={geo.presserFoot} position={[0, 0.0, -0.035]}>
          <Flat color={L.rim} metalness={0.5} roughness={0.3} />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} geometry={geo.toe} position={[k * 0.026, 0, 0.06]}>
            <Flat color={L.rim} metalness={0.5} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* the spool on its pin */}
      <mesh geometry={geo.pin} position={[0.2, 1.08, -0.05]}>
        <Flat color={L.rim} metalness={0.5} roughness={0.3} />
      </mesh>
      <group ref={spool} position={[0.2, 1.18, -0.05]}>
        <mesh geometry={geo.spoolBody}>
          <Flat color={L.thread} />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} geometry={geo.spoolEnd} position-y={k * 0.054}>
            <Flat color={L.spool} />
          </mesh>
        ))}
      </group>

      {/* the hand wheel */}
      <group ref={wheel} position={[0.84, 0.86, -0.04]}>
        <mesh geometry={geo.rim}>
          <Flat color={L.rim} metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh geometry={geo.tread}>
          <Flat color={L.wheel} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.hub}>
          <Flat color={L.rim} metalness={0.5} roughness={0.3} />
        </mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} geometry={geo.spoke} rotation-x={(k * Math.PI) / 3}>
            <Flat color={L.wheel} />
          </mesh>
        ))}
        <mesh geometry={geo.knobW} position={[0.06, 0, 0]}>
          <Flat color={L.decal} />
        </mesh>
      </group>

      {/* the thread */}
      {Array.from({ length: SEGS }, (_, i) => (
        <mesh key={i} ref={(el) => (threadRefs.current[i] = el)} geometry={geo.thread} frustumCulled={false}>
          <Flat color={L.thread} />
        </mesh>
      ))}

      {/* the fabric, and the seams sewn in it */}
      <group ref={fabric} position={[NX - LANES[0], BT + 0.012, Z0]}>
        <mesh geometry={fab} frustumCulled={false}>
          <Flat vertexColors color="#ffffff" side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
        {Array.from({ length: LANES.length * STITCHES }, (_, i) => (
          <mesh key={i} ref={(el) => (stitchRefs.current[i] = el)} geometry={geo.stitch} visible={false}>
            <Flat color={L.thread} />
          </mesh>
        ))}
      </group>

      {/* an invisible box round the machine, so every tap lands */}
      <mesh geometry={geo.hit} position={[-0.1, 0.62, 0]}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function SewingMachineScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.1, 1.9, 3.35]} target={[-0.1, 0.62, 0]} hint="The needle bobs, the hand wheel turns and the thread wiggles on its own · tap it and the machine races, feeding the fabric back a stitch at a time and leaving a seam; then the foot lifts and the fabric slides back, ready for the next seam beside it · Look swaps vintage, cream and mint · drag to orbit">
      <SewingMachine {...props} />
    </Stage>
  )
}
