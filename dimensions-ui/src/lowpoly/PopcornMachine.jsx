import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Flat, Hinge, Stage, TAU, facet, polarGrid, rng, useGeo, useTap } from './kit.jsx'

// A low-poly popcorn cart: a painted cabinet on two big spoked wheels and a
// pair of legs, with a push bar at the back, and on top a glass case lit by
// a warm lamp. Inside, a steel kettle hangs on a tilting axle over a heap of
// popcorn, its two lid flaps hinged across the middle, and a marquee sign
// with chasing bulbs stands on the roof. Left alone, a kernel pops now and
// then: a flap jumps, the piece flies out and lands on the heap. Tap it and
// the kettle tips forward, both flaps fly open and a burst of popcorn
// overflows onto the heap, which swells, while the glass door swings open
// and a spill of popcorn tumbles out of it onto the ground.

const LOOKS = {
  red: { body: '#d8392f', trim: '#f2c23a', roof: '#d8392f', stripe: '#fbf3e4', wheel: '#f2c23a', panel: '#b82e26', sign: '#d8392f', letter: '#d8392f' },
  retro: { body: '#f2e3c4', trim: '#c8352e', roof: '#2f6b8f', stripe: '#c8352e', wheel: '#c8352e', panel: '#e6d2ac', sign: '#c8352e', letter: '#2f6b8f' },
  mint: { body: '#7fd1b9', trim: '#fbf3e4', roof: '#f28bb0', stripe: '#fbf3e4', wheel: '#f28bb0', panel: '#68bfa6', sign: '#7fd1b9', letter: '#e0607f' },
}
const CORN = ['#fff6e0', '#fdebbd', '#fff1cf', '#f6d47a']

const CB = 0.36 // bottom of the cabinet
const CT = 0.94 // top of the cabinet, the case floor
const GT = 1.76 // top of the glass case
const W = 0.5 // half width (x)
const D = 0.38 // half depth (z)
const KY = 1.5 // the kettle's axle
const PH = 0.22 // height of the heap
const RX = 0.47
const RZ = 0.35
const OPEN = 4.5 // seconds the door stays open after a tap

const ss = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
// the heap's surface over the case floor (before it swells)
const moundY = (x, z) => CT + PH * Math.max(0, 1 - (x / RX) ** 2 - ((z + 0.04) / RZ) ** 2)
// a puffed piece of popcorn: three lumps run together
function cornGeo() {
  const parts = [
    [1, [0, 0, 0], 3],
    [0.75, [0.6, 0.35, 0.1], 4],
    [0.7, [-0.45, 0.3, -0.35], 5],
    [0.6, [0.05, -0.2, 0.62], 6],
  ].map(([r, [x, y, z], s]) => facet(new THREE.IcosahedronGeometry(r, 0), r * 0.1, s).translate(x, y, z))
  const g = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return g
}
// a word in chunky 3 x 5 pixel letters, centred, standing out from z = 0.036
const FONT = { P: ['111', '101', '111', '100', '100'], O: ['111', '101', '101', '101', '111'], C: ['111', '100', '100', '100', '111'], R: ['111', '101', '110', '101', '101'], N: ['110', '101', '101', '101', '101'] }
function signText(word, px) {
  const boxes = []
  const w = word.length * 4 - 1
  ;[...word].forEach((ch, k) =>
    FONT[ch].forEach((row, j) =>
      [...row].forEach((b, i) => {
        if (b === '1') boxes.push(new THREE.BoxGeometry(px * 0.92, px * 0.92, 0.012).translate((k * 4 + i - (w - 1) / 2) * px, (2 - j) * px, 0.036))
      }),
    ),
  )
  const g = mergeGeometries(boxes)
  boxes.forEach((b) => b.dispose())
  return g
}
// a point on the heap, picked by r
function heapPoint(r, grow = 1) {
  const a = r() * TAU
  const d = Math.sqrt(r()) * 0.88
  const x = Math.cos(a) * d * RX
  const z = Math.sin(a) * d * RZ - 0.04
  return new THREE.Vector3(x, CT + (moundY(x, z) - CT) * grow + 0.02, z)
}
const arc = (out, a, b, k, h) => out.lerpVectors(a, b, k).setY(a.y + (b.y - a.y) * k + 4 * h * k * (1 - k))

export function PopcornMachine({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1)
  const kettle = useRef()
  const flapF = useRef()
  const flapB = useRef()
  const crank = useRef()
  const heap = useRef()
  const lamp = useRef()
  const pileMesh = useRef()
  const flyMesh = useRef()
  const bulbRefs = useRef([])
  const tilt = useRef({ x: 0, v: 0 })

  const geo = useGeo(
    () => ({
      corn: cornGeo(),
      cab: facet(new THREE.BoxGeometry(W * 2, CT - CB, D * 2), 0.004, 1),
      cabTrim: new THREE.BoxGeometry(W * 2 + 0.04, 0.045, D * 2 + 0.04),
      panel: new THREE.BoxGeometry(W * 1.5, (CT - CB) * 0.62, 0.012),
      panelFrame: new THREE.BoxGeometry(W * 1.5 + 0.05, (CT - CB) * 0.62 + 0.05, 0.008),
      post: new THREE.BoxGeometry(0.045, GT - CT, 0.045),
      glassSide: new THREE.BoxGeometry(0.01, GT - CT - 0.02, D * 2 - 0.04),
      glassBack: new THREE.BoxGeometry(W * 2 - 0.04, GT - CT - 0.02, 0.01),
      door: new THREE.BoxGeometry(W * 2 - 0.05, GT - CT - 0.04, 0.012).translate(W - 0.025, 0, 0),
      doorFrameH: new THREE.BoxGeometry(W * 2 - 0.05, 0.03, 0.022).translate(W - 0.025, 0, 0),
      doorFrameV: new THREE.BoxGeometry(0.03, GT - CT - 0.04, 0.022),
      knob: new THREE.IcosahedronGeometry(0.022, 0),
      streak: new THREE.BoxGeometry(0.05, 0.5, 0.004),
      roofSlab: facet(new THREE.BoxGeometry(W * 2 + 0.14, 0.06, D * 2 + 0.14), 0.004, 2),
      roofTop: facet(new THREE.ConeGeometry(0.76, 0.22, 4, 1).rotateY(Math.PI / 4).scale(1.08, 1, 0.84).translate(0, 0.11, 0), 0.006, 3),
      lampBox: new THREE.BoxGeometry(0.3, 0.04, 0.12),
      signPost: new THREE.BoxGeometry(0.035, 0.18, 0.035),
      sign: facet(new THREE.BoxGeometry(0.92, 0.3, 0.06), 0.004, 4),
      signFace: new THREE.BoxGeometry(0.8, 0.2, 0.01),
      letters: signText('POPCORN', 0.024),
      bulb: new THREE.IcosahedronGeometry(0.022, 0),
      bucket: new THREE.CylinderGeometry(0.075, 0.05, 0.13, 8, 1),
      bucketStripe: new THREE.CylinderGeometry(0.0755, 0.0505, 0.13, 8, 1, true, 0, Math.PI / 4),
      // the kettle hangs from its axle at the origin
      pot: facet(
        new THREE.LatheGeometry(
          [
            [0.001, -0.27],
            [0.15, -0.27],
            [0.2, -0.22],
            [0.21, -0.05],
            [0.225, -0.02],
            [0.2, -0.02],
            [0.19, -0.05],
            [0.18, -0.21],
            [0.001, -0.22],
          ].map(([r, y]) => new THREE.Vector2(r, y)),
          12,
        ),
        0.004,
        5,
      ),
      flap: new THREE.CylinderGeometry(0.205, 0.205, 0.014, 12, 1, false, -Math.PI / 2, Math.PI),
      motor: facet(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 8, 1), 0.003, 6),
      axle: new THREE.CylinderGeometry(0.014, 0.014, W * 2, 6).rotateZ(Math.PI / 2),
      ear: new THREE.BoxGeometry(0.03, 0.06, 0.05),
      inPot: polarGrid(0.18, 2, 10, (u) => 0.05 * (1 - u * u), 0.2, 7),
      crankDisc: new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8).rotateZ(Math.PI / 2),
      crankArm: new THREE.BoxGeometry(0.02, 0.16, 0.03).translate(0, -0.08, 0),
      crankKnob: new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6).rotateZ(Math.PI / 2),
      heap: polarGrid(1, 4, 14, (u) => 1 - u * u, 0.1, 8),
      tyre: facet(new THREE.TorusGeometry(0.28, 0.032, 5, 14).rotateY(Math.PI / 2), 0.004, 9),
      hub: new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8).rotateZ(Math.PI / 2),
      spoke: new THREE.BoxGeometry(0.018, 0.54, 0.018),
      leg: new THREE.BoxGeometry(0.05, CB, 0.05),
      foot: new THREE.BoxGeometry(0.09, 0.03, 0.09),
      handleRod: new THREE.CylinderGeometry(0.016, 0.016, 0.5, 6).rotateX(Math.PI / 2),
      grip: new THREE.CylinderGeometry(0.026, 0.026, W * 2 + 0.1, 8).rotateZ(Math.PI / 2),
      hit: new THREE.BoxGeometry(1.3, 2.3, 1.1),
    }),
    [],
  )

  // the heap's surface pieces
  const pile = useMemo(() => {
    const r = rng(14)
    return Array.from({ length: 120 }, (_, i) => ({ p: heapPoint(r), s: 0.038 + r() * 0.02, rot: [r() * TAU, r() * TAU, 0], c: CORN[i % CORN.length] }))
  }, [])
  // the flying pieces: idle pops, a tap's overflow, and a tap's spill
  const fly = useMemo(() => {
    const r = rng(31)
    const pops = Array.from({ length: 7 }, (_, i) => ({ kind: 'pop', period: 2.4 + i * 0.41, off: r() * 5, from: new THREE.Vector3((r() - 0.5) * 0.2, KY + 0.02, (r() - 0.5) * 0.2), to: heapPoint(r), h: 0.22 + r() * 0.12, front: r() > 0.5 }))
    const over = Array.from({ length: 34 }, () => ({ kind: 'over', delay: 0.05 + r() * 0.9, dur: 0.45 + r() * 0.3, from: new THREE.Vector3((r() - 0.5) * 0.24, KY + 0.04, 0.1 + r() * 0.06), to: heapPoint(r, 1.3), h: 0.15 + r() * 0.25, rest: 3 + r() * 1.5 }))
    const spill = Array.from({ length: 18 }, () => {
      const e = new THREE.Vector3((r() - 0.5) * 0.7, 0, D - 0.03)
      e.y = moundY(e.x, e.z) + 0.03
      const vy = 0.2 + r() * 0.3
      const t = (vy + Math.sqrt(vy * vy + 12 * (e.y - 0.03))) / 6
      return { kind: 'spill', delay: 0.15 + r() * 1, dur: 0.45 + r() * 0.2, from: new THREE.Vector3((r() - 0.5) * 0.2, KY + 0.04, 0.12), to: e, h: 0.12 + r() * 0.1, vy, vz: 0.45 + r() * 0.5, vx: (r() - 0.5) * 0.5, tLand: t, rest: 4.2 + r() * 1.3 }
    })
    return [...pops, ...over, ...spill].map((p, i) => ({ ...p, s: 0.036 + r() * 0.016, spin: [(r() - 0.5) * 14, (r() - 0.5) * 14], c: CORN[i % CORN.length] }))
  }, [])
  // one placeholder object per piece, written into two instanced meshes
  const pileObjs = useMemo(
    () =>
      pile.map((p) => {
        const o = new THREE.Object3D()
        o.position.copy(p.p)
        o.rotation.set(...p.rot)
        o.scale.setScalar(p.s)
        return o
      }),
    [pile],
  )
  const flyObjs = useMemo(() => fly.map(() => new THREE.Object3D()), [fly])
  useLayoutEffect(() => {
    const c = new THREE.Color()
    pile.forEach((p, i) => pileMesh.current.setColorAt(i, c.set(p.c)))
    fly.forEach((f, i) => flyMesh.current.setColorAt(i, c.set(f.c)))
    pileMesh.current.instanceColor.needsUpdate = true
    flyMesh.current.instanceColor.needsUpdate = true
  }, [pile, fly])
  const bulbs = useMemo(() => {
    const out = []
    for (let i = 0; i < 9; i++) out.push([-0.42 + i * 0.105, 0.125], [0.42 - i * 0.105, -0.125])
    out.push([-0.43, 0], [0.43, 0])
    return out
  }, [])
  const doorOpen = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < OPEN
  }
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const tapped = s >= 0 && s < OPEN
    // the heap swells as the overflow lands on it, and settles slowly
    const grow = 1 + (s >= 0 ? 0.3 * ss(0.3, 1.3, s) * (1 - ss(OPEN, OPEN + 3, s)) : 0)
    heap.current.scale.y = PH * grow
    pile.forEach((p, i) => {
      const o = pileObjs[i]
      o.position.set(p.p.x, CT + (p.p.y - CT) * grow, p.p.z)
      o.updateMatrix()
      pileMesh.current.setMatrixAt(i, o.matrix)
    })

    // idle pops kick the flaps; a tap throws them open
    let popKick = 0
    fly.forEach((f, i) => {
      const m = flyObjs[i]
      let show = false
      let sc = 1
      if (f.kind === 'pop') {
        const u = (t + f.off) % f.period
        if (u < 0.1) popKick = Math.max(popKick, f.front ? 1 - u / 0.1 : -(1 - u / 0.1))
        if (u < 1.7 && !tapped) {
          show = true
          const k = Math.min(1, u / 0.7)
          arc(m.position, f.from, f.to, k, f.h)
          sc = u < 0.08 ? u / 0.08 : u > 1.3 ? 1 - (u - 1.3) / 0.4 : 1
          m.rotation.set(Math.min(u, 0.7) * f.spin[0], Math.min(u, 0.7) * f.spin[1], 0)
        }
      } else if (s >= f.delay && s < f.delay + f.dur + f.rest + 0.5) {
        show = true
        const u = s - f.delay
        if (u < f.dur) {
          const k = u / f.dur
          arc(m.position, f.from, f.to, k, f.h)
          m.rotation.set(u * f.spin[0], u * f.spin[1], 0)
          sc = Math.min(1, u / 0.06)
        } else if (f.kind === 'over') {
          m.position.copy(f.to)
          sc = u > f.dur + f.rest ? 1 - (u - f.dur - f.rest) / 0.5 : 1
        } else {
          // tumble off the front of the case and out onto the ground
          const w = u - f.dur
          const tl = Math.min(w, f.tLand)
          m.position.set(f.to.x + f.vx * tl, f.to.y + f.vy * tl - 3 * tl * tl, f.to.z + f.vz * tl)
          if (w > f.tLand) {
            const b = w - f.tLand
            const hop = b < 0.28 ? Math.sin((b / 0.28) * Math.PI) * 0.05 : 0
            m.position.x += f.vx * 0.15 * Math.min(1, b / 0.28)
            m.position.z += f.vz * 0.15 * Math.min(1, b / 0.28)
            m.position.y = 0.03 + hop
          } else m.rotation.set(w * f.spin[0], w * f.spin[1], 0)
          sc = u > f.dur + f.rest ? 1 - (u - f.dur - f.rest) / 0.5 : 1
        }
      }
      m.scale.setScalar(show && sc > 0 ? f.s * sc : 0)
      m.updateMatrix()
      flyMesh.current.setMatrixAt(i, m.matrix)
    })

    // the kettle: a spring tips it on a tap, with a shake as it pours
    const d = Math.min(dt, 0.033)
    const T = tilt.current
    const target = s >= 0 && s < 2.4 ? 0.7 : 0
    T.v += ((target - T.x) * 55 - T.v * 7) * d
    T.x += T.v * d
    const shake = s >= 0 && s < 2.4 ? Math.sin(t * 38) * 0.03 : Math.sin(t * 21) * 0.006 + Math.abs(popKick) * Math.sin(t * 60) * 0.02
    kettle.current.rotation.x = T.x + shake
    crank.current.rotation.x = T.x * 1.6
    const flapOpen = s >= 0 && s < 2.6 ? ss(0, 0.18, s) * 1.25 : 0
    flapF.current.rotation.x = -(flapOpen + Math.max(0, popKick) * 0.5 + 0.03 * (0.5 + 0.5 * Math.sin(t * 17)))
    flapB.current.rotation.x = flapOpen + Math.max(0, -popKick) * 0.5 + 0.03 * (0.5 + 0.5 * Math.sin(t * 13 + 1))

    // the marquee bulbs chase round, and flash together after a tap
    const step = Math.floor(t * 7)
    pileMesh.current.instanceMatrix.needsUpdate = true
    flyMesh.current.instanceMatrix.needsUpdate = true
    bulbRefs.current.forEach((m, i) => {
      if (!m) return
      const on = tapped && s < 2 ? Math.floor(s * 8) % 2 === 0 : (i + step) % 3 === 0
      m.material.emissiveIntensity = on ? 1.4 : 0.15
    })
    lamp.current.intensity = 1.6 + 0.15 * Math.sin(t * 5) + (tapped ? 0.6 * (1 - ss(0, 2, s)) : 0)
  })

  const caseH = GT - CT
  return (
    <group {...handlers}>
      {/* wheels, legs and the push bar */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (W + 0.07), 0.3, -0.12]}>
          <mesh geometry={geo.tyre}>
            <Flat color="#2c2a30" roughness={0.9} />
          </mesh>
          <mesh geometry={geo.hub}>
            <Flat color={L.wheel} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} geometry={geo.spoke} rotation-x={(k * Math.PI) / 3}>
              <Flat color={L.wheel} />
            </mesh>
          ))}
        </group>
      ))}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (W - 0.07), 0, D - 0.07]}>
          <mesh geometry={geo.leg} position-y={CB / 2}>
            <Flat color="#3a383f" />
          </mesh>
          <mesh geometry={geo.foot} position-y={0.015}>
            <Flat color="#3a383f" />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={geo.handleRod} position={[sx * (W - 0.04), CT - 0.08, -D - 0.22]} rotation-x={-0.35}>
          <Flat color="#c9ccd2" metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
      <mesh geometry={geo.grip} position={[0, CT + 0.0, -D - 0.45]}>
        <Flat color="#2c2a30" />
      </mesh>

      {/* the cabinet */}
      <mesh geometry={geo.cab} position-y={(CB + CT) / 2}>
        <Flat color={L.body} />
      </mesh>
      {[CB + 0.02, CT - 0.01].map((y) => (
        <mesh key={y} geometry={geo.cabTrim} position-y={y}>
          <Flat color={L.trim} />
        </mesh>
      ))}
      <mesh geometry={geo.panelFrame} position={[0, (CB + CT) / 2, D + 0.004]}>
        <Flat color={L.trim} />
      </mesh>
      <mesh geometry={geo.panel} position={[0, (CB + CT) / 2, D + 0.008]}>
        <Flat color={L.panel} />
      </mesh>
      {[-0.22, 0, 0.22].map((x) => (
        <mesh key={x} geometry={geo.bucket} position={[x, (CB + CT) / 2, D + 0.05]} scale={[0.75, 0.75, 0.1]}>
          <Flat color={L.stripe} />
        </mesh>
      ))}

      {/* the heap of popcorn on the case floor */}
      <mesh ref={heap} geometry={geo.heap} position={[0, CT, -0.04]} scale={[RX, PH, RZ]}>
        <Flat color="#f7e2a8" />
      </mesh>
      <instancedMesh ref={pileMesh} args={[geo.corn, undefined, pile.length]} frustumCulled={false}>
        <Flat color="#ffffff" />
      </instancedMesh>

      {/* the kettle on its tilting axle, and the crank outside */}
      <mesh geometry={geo.axle} position={[0, KY, 0]}>
        <Flat color="#9a9ca4" metalness={0.5} roughness={0.35} />
      </mesh>
      <group ref={kettle} position={[0, KY, 0]}>
        <mesh geometry={geo.pot}>
          <Flat color="#c9ccd4" metalness={0.55} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.inPot} position-y={-0.1}>
          <Flat color="#fdebbd" />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} geometry={geo.ear} position={[sx * 0.225, -0.03, 0]}>
            <Flat color="#9a9ca4" metalness={0.5} roughness={0.35} />
          </mesh>
        ))}
        <group ref={flapF} position-y={0.01}>
          <mesh geometry={geo.flap}>
            <Flat color="#b4b8c2" metalness={0.55} roughness={0.3} />
          </mesh>
        </group>
        <group ref={flapB} position-y={0.01} rotation-y={Math.PI}>
          <group rotation-y={0}>
            <mesh geometry={geo.flap}>
              <Flat color="#b4b8c2" metalness={0.55} roughness={0.3} />
            </mesh>
          </group>
        </group>
        <mesh geometry={geo.motor} position-y={0.06}>
          <Flat color={L.trim} />
        </mesh>
      </group>
      <group ref={crank} position={[W + 0.03, KY, 0]}>
        <mesh geometry={geo.crankDisc}>
          <Flat color={L.trim} />
        </mesh>
        <mesh geometry={geo.crankArm} position-x={0.02}>
          <Flat color="#9a9ca4" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh geometry={geo.crankKnob} position={[0.04, -0.15, 0]}>
          <Flat color="#2c2a30" />
        </mesh>
      </group>

      {/* the glass case: posts, panes and the door */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={geo.post} position={[sx * (W - 0.0225), (CT + GT) / 2, sz * (D - 0.0225)]}>
            <Flat color={L.trim} />
          </mesh>
        )),
      )}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={geo.glassSide} position={[sx * (W - 0.02), (CT + GT) / 2, 0]}>
          <meshStandardMaterial color="#d4ecf4" transparent opacity={0.16} roughness={0.05} depthWrite={false} />
        </mesh>
      ))}
      <mesh geometry={geo.glassBack} position={[0, (CT + GT) / 2, -D + 0.02]}>
        <meshStandardMaterial color="#d4ecf4" transparent opacity={0.16} roughness={0.05} depthWrite={false} />
      </mesh>
      <Hinge open={doorOpen} axis="y" angle={-1.75} stiffness={45} damping={8} position={[-W + 0.025, (CT + GT) / 2, D - 0.01]}>
        <mesh geometry={geo.door}>
          <meshStandardMaterial color="#d4ecf4" transparent opacity={0.18} roughness={0.05} depthWrite={false} />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} geometry={geo.doorFrameH} position-y={(k * (caseH - 0.05)) / 2}>
            <Flat color={L.trim} />
          </mesh>
        ))}
        <mesh geometry={geo.doorFrameV} position-x={W * 2 - 0.065}>
          <Flat color={L.trim} />
        </mesh>
        <mesh geometry={geo.knob} position={[W * 2 - 0.1, -0.05, 0.025]}>
          <Flat color="#2c2a30" />
        </mesh>
        {[0.35, 0.5].map((x, i) => (
          <mesh key={x} geometry={geo.streak} position={[x, 0.05, 0.008]} rotation-z={-0.5} scale={[1 - i * 0.5, 1 - i * 0.3, 1]}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        ))}
      </Hinge>

      {/* the roof, the warm lamp under it and the marquee sign */}
      <mesh geometry={geo.roofSlab} position-y={GT + 0.03}>
        <Flat color={L.trim} />
      </mesh>
      <mesh geometry={geo.roofTop} position-y={GT + 0.06}>
        <Flat color={L.roof} />
      </mesh>
      <mesh geometry={geo.lampBox} position={[0, GT - 0.02, -0.15]}>
        <Flat color="#fff1b8" emissive="#ffd060" emissiveIntensity={1.2} />
      </mesh>
      <pointLight ref={lamp} color="#ffc35a" intensity={1.6} distance={2.2} decay={2} position={[0, GT - 0.1, 0.05]} />
      <group position-y={GT + 0.24}>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} geometry={geo.signPost} position={[x, 0, 0]}>
            <Flat color="#2c2a30" />
          </mesh>
        ))}
        <group position-y={0.22}>
          <mesh geometry={geo.sign}>
            <Flat color={L.sign} />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.signFace} position-z={sz * 0.031}>
              <Flat color="#fbf3e4" />
            </mesh>
          ))}
          {[0, Math.PI].map((ry) => (
            <mesh key={ry} geometry={geo.letters} rotation-y={ry}>
              <Flat color={L.letter} />
            </mesh>
          ))}
          {bulbs.map(([x, y], i) => (
            <mesh key={i} ref={(el) => (bulbRefs.current[i] = el)} geometry={geo.bulb} position={[x, y, 0]} scale={[1, 1, 1.9]}>
              <meshStandardMaterial color="#fff4c8" emissive="#ffcf4a" emissiveIntensity={0.15} flatShading roughness={0.4} />
            </mesh>
          ))}
          {/* a striped popcorn bucket on the sign */}
          <group position={[0, 0.2, 0]}>
            <mesh geometry={geo.bucket}>
              <Flat color={L.stripe} />
            </mesh>
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} geometry={geo.bucketStripe} rotation-y={(k * Math.PI) / 2}>
                <Flat color={L.sign} side={THREE.DoubleSide} />
              </mesh>
            ))}
            {[
              [0, 0.09, 0],
              [0.04, 0.08, 0.03],
              [-0.045, 0.08, 0.02],
              [0.02, 0.085, -0.04],
              [-0.03, 0.11, -0.01],
              [0.015, 0.12, 0.015],
            ].map((p, i) => (
              <mesh key={i} geometry={geo.corn} position={p} rotation={[i, i * 2, 0]} scale={0.03}>
                <Flat color={CORN[i % CORN.length]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* the popcorn in the air */}
      <instancedMesh ref={flyMesh} args={[geo.corn, undefined, fly.length]} frustumCulled={false}>
        <Flat color="#ffffff" />
      </instancedMesh>

      {/* an invisible box round the cart, so every tap lands */}
      <mesh geometry={geo.hit} position={[0, 1.15, 0]}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function PopcornMachineScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.3, 2.4, 5.1]} target={[0, 1.08, 0]} hint="Kernels pop in the kettle now and then, the lid flaps jump and the sign's bulbs chase round · tap it and the kettle tips, a burst of popcorn overflows onto the swelling heap and the door swings open to spill it out onto the ground · Look swaps red, retro and mint · drag to orbit">
      <PopcornMachine {...props} />
    </Stage>
  )
}
