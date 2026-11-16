import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Burst, Flat, Particles, Stage, TAU, facet, useGeo, useTap } from './kit.jsx'

// A low-poly music box: a painted jewellery box on little gold feet, lined
// with velvet, with a mirror set in the underside of its hinged lid, a
// butterfly winding key in its side and a tiny ballerina in a tutu on a
// coiled spring. Left alone the lid rests open a crack, the dancer turns
// slowly inside and the key ticks round, with now and then a note drifting
// up. Tap it and the lid swings right back, the dancer springs up out of
// the box and spins fast in a sparkle of rising notes, then the tune winds
// down: she slows, sinks back and the lid settles to its crack.

const LOOKS = {
  rose: { box: '#eaa2b4', box2: '#dc8ba0', trim: '#e2b552', velvet: '#b3304e', tutu: '#ffd3df', tutu2: '#ffffff', bodice: '#f07a9a', hair: '#5a3424', note: '#b3304e' },
  walnut: { box: '#7d4b2d', box2: '#6b3e24', trim: '#d9a845', velvet: '#2f5b3d', tutu: '#ffffff', tutu2: '#f3e7d6', bodice: '#d94d5c', hair: '#2e1d14', note: '#2f5b3d' },
  mint: { box: '#9fd9c4', box2: '#86c7b0', trim: '#d8dde6', velvet: '#f0a9bd', tutu: '#fff1b8', tutu2: '#ffffff', bodice: '#7cc3e8', hair: '#c98a3c', note: '#e86f92' },
}

const W = 1.2 // width
const D = 0.86 // depth
const H = 0.5 // body height
const T = 0.06 // wall thickness
const FLOOR = 0.12 // the velvet floor inside
const CRACK = 0.72 // the lid's resting angle
const OPEN = 1.95 // fully open
const PLAY = 6.5 // seconds the tune plays after a tap

// An open-topped box: a box with its top face taken out.
function openBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d)
  const idx = Array.from(g.index.array)
  g.setIndex([...idx.slice(0, 12), ...idx.slice(18)])
  g.clearGroups()
  return g
}

// A coiled spring of unit height, standing on y = 0.
function springGeometry() {
  const pts = Array.from({ length: 61 }, (_, i) => {
    const a = (i / 60) * TAU * 5
    return new THREE.Vector3(Math.cos(a) * 0.045, i / 60, Math.sin(a) * 0.045)
  })
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.01, 4, false)
}

// A quaver: a tilted oval head, a stem and a flag, about a unit tall.
function noteGeometry() {
  const head = new THREE.IcosahedronGeometry(1, 0).scale(0.32, 0.24, 0.2).rotateZ(0.45)
  const stem = new THREE.BoxGeometry(0.08, 0.95, 0.08).translate(0.26, 0.47, 0).toNonIndexed()
  const flag = new THREE.BoxGeometry(0.34, 0.09, 0.08).rotateZ(-0.7).translate(0.4, 0.82, 0).toNonIndexed()
  return mergeGeometries([head, stem, flag]).translate(-0.15, -0.4, 0)
}

// A small star, for the sparkle.
function starGeometry() {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.45 : 1
    const a = (i / 10) * TAU + Math.PI / 2
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }).translate(0, 0, -0.15)
}

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function MusicBox({ look = 'rose' }) {
  const L = LOOKS[look] || LOOKS.rose
  const { tap, handlers, clock } = useTap(1.2)
  const lid = useRef()
  const spring = useRef()
  const dancer = useRef()
  const key = useRef()
  const st = useRef({ lid: CRACK, lv: 0, h: 0.12, hv: 0, spin: 0, key: 0 })
  const geo = useGeo(
    () => ({
      shell: facet(openBox(W, H, D), 0.012, 2),
      bar: new THREE.BoxGeometry(1, 1, 1),
      lid: facet(new THREE.BoxGeometry(W + 0.04, 0.09, D + 0.04, 2, 1, 2), 0.008, 3),
      panel: facet(new THREE.BoxGeometry(W - 0.26, 0.05, D - 0.26), 0.006, 4),
      foot: new THREE.IcosahedronGeometry(1, 0),
      disc: new THREE.CylinderGeometry(1, 1, 1, 10),
      spring: springGeometry(),
      note: noteGeometry(),
      star: starGeometry(),
      tutu: facet(new THREE.CylinderGeometry(0.04, 0.15, 0.035, 12, 1), 0.006, 6),
      tutu2: facet(new THREE.CylinderGeometry(0.04, 0.12, 0.03, 12, 1), 0.005, 7),
      arms: new THREE.TorusGeometry(0.07, 0.011, 4, 12, Math.PI * 1.55).rotateZ(Math.PI / 2 - Math.PI * 0.775),
      loop: new THREE.TorusGeometry(0.07, 0.022, 5, 10),
    }),
    [],
  )
  const playing = useMemo(() => () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < PLAY ? 1 - ease((s - PLAY + 2.2) / 2.2) : 0
  }, [tap, clock])
  const notesOn = useMemo(() => () => 0.2 + 0.8 * playing(), [playing])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const t = clock.elapsedTime
    const S = st.current
    const s = tap.since(t)
    const on = s >= 0 && s < PLAY
    const p = playing()
    // the lid: resting open a crack (breathing a touch), or flung right back
    const lidTo = on ? OPEN : CRACK + Math.sin(t * 1.4) * 0.03
    S.lv += ((lidTo - S.lid) * (on ? 60 : 30) - S.lv * (on ? 7 : 8)) * dt
    S.lid += S.lv * dt
    lid.current.rotation.x = -S.lid
    // the dancer rises on her spring once the lid is out of the way
    const hTo = on && S.lid > 1.1 ? 0.34 : 0.12 + Math.sin(t * 2.2) * 0.008
    S.hv += ((hTo - S.h) * 110 - S.hv * 7) * dt
    S.h = Math.max(0.01, S.h + S.hv * dt)
    spring.current.scale.y = S.h
    dancer.current.position.y = FLOOR + 0.025 + S.h
    // she turns slowly, spins fast while the tune plays, then winds down
    const rate = 0.9 + 11 * p * (on ? Math.min(1, s / 0.5) : 0)
    S.spin += rate * dt
    dancer.current.rotation.y = S.spin
    dancer.current.rotation.z = Math.sin(S.spin * 2) * 0.03 * (1 + p)
    // the key ticks round with the tune
    S.key += (0.7 + 4 * p) * dt
    key.current.rotation.x = S.key
  })

  const gold = { metalness: 0.55, roughness: 0.35 }
  const floorTone = useMemo(() => '#' + new THREE.Color(L.velvet).multiplyScalar(0.55).getHexString(), [L.velvet])
  const bar = (p, s, color, extra = {}, k) => (
    <mesh key={k} geometry={geo.bar} position={p} scale={s}>
      <Flat color={color} {...extra} />
    </mesh>
  )
  return (
    <group {...handlers}>
      <group position-y={0.07}>
        {/* the box: painted outside, velvet inside, gold rim and base bands */}
        <mesh geometry={geo.shell} position-y={H / 2}>
          <Flat color={L.box} side={THREE.FrontSide} />
        </mesh>
        {bar([0, FLOOR - 0.01, 0], [W - 2 * T, 0.02, D - 2 * T], floorTone, { roughness: 0.95 })}
        {[-1, 1].map((k) => bar([0, (FLOOR + H) / 2, k * (D / 2 - T - 0.005)], [W - 2 * T, H - FLOOR, 0.01], L.velvet, { roughness: 0.95 }, `lz${k}`))}
        {[-1, 1].map((k) => bar([k * (W / 2 - T - 0.005), (FLOOR + H) / 2, 0], [0.01, H - FLOOR, D - 2 * T], L.velvet, { roughness: 0.95 }, `lx${k}`))}
        {[-1, 1].map((k) => bar([0, H + 0.006, k * (D / 2 - T / 2)], [W + 0.01, 0.022, T + 0.01], L.trim, gold, `z${k}`))}
        {[-1, 1].map((k) => bar([k * (W / 2 - T / 2), H + 0.006, 0], [T + 0.01, 0.022, D - T], L.trim, gold, `x${k}`))}
        {bar([0, 0.03, 0], [W + 0.04, 0.06, D + 0.04], L.trim, gold)}
        {[-1, 1].map((k) => bar([0, H - 0.05, k * (D / 2 + 0.005)], [W + 0.02, 0.03, 0.012], L.box2, {}, `bz${k}`))}
        {[-1, 1].map((k) => bar([k * (W / 2 + 0.005), H - 0.05, 0], [0.012, 0.03, D + 0.02], L.box2, {}, `bx${k}`))}
        {/* a medallion on the front: a gold oval with a velvet heart */}
        <group position={[0, H * 0.5, D / 2 + 0.006]}>
          <mesh geometry={geo.disc} rotation-x={Math.PI / 2} scale={[0.11, 0.02, 0.085]}>
            <Flat color={L.trim} {...gold} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} geometry={geo.disc} position={[k * 0.024, 0.012, 0.012]} rotation-x={Math.PI / 2} scale={[0.032, 0.012, 0.032]}>
              <Flat color={L.velvet} />
            </mesh>
          ))}
          <mesh geometry={geo.bar} position={[0, -0.014, 0.012]} rotation-z={Math.PI / 4} scale={[0.045, 0.045, 0.012]}>
            <Flat color={L.velvet} />
          </mesh>
        </group>
        {/* gold bun feet */}
        {[-1, 1].map((sx) => [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={geo.foot} position={[sx * (W / 2 - 0.07), -0.025, sz * (D / 2 - 0.07)]} scale={[0.07, 0.05, 0.07]}>
            <Flat color={L.trim} {...gold} />
          </mesh>
        )))}

        {/* inside: a gold stage, the spring and the ballerina */}
        <mesh geometry={geo.disc} position-y={FLOOR + 0.012} scale={[0.1, 0.025, 0.1]}>
          <Flat color={L.trim} {...gold} />
        </mesh>
        <mesh ref={spring} geometry={geo.spring} position-y={FLOOR + 0.025}>
          <meshStandardMaterial color="#c9ced8" metalness={0.7} roughness={0.3} flatShading />
        </mesh>
        <group ref={dancer} scale={1.35}>
          {/* en pointe on one leg, the other bent at the knee */}
          <mesh position-y={0.075}>
            <cylinderGeometry args={[0.013, 0.008, 0.15, 5]} />
            <Flat color="#f7d9cf" />
          </mesh>
          <mesh position={[-0.03, 0.12, 0]} rotation-z={-1.1}>
            <cylinderGeometry args={[0.012, 0.009, 0.09, 5]} />
            <Flat color="#f7d9cf" />
          </mesh>
          <mesh geometry={geo.tutu} position-y={0.165}>
            <Flat color={L.tutu} />
          </mesh>
          <mesh geometry={geo.tutu2} position-y={0.19}>
            <Flat color={L.tutu2} />
          </mesh>
          <mesh position-y={0.235}>
            <cylinderGeometry args={[0.03, 0.036, 0.08, 7]} />
            <Flat color={L.bodice} />
          </mesh>
          <mesh geometry={geo.foot} position-y={0.31} scale={[0.036, 0.04, 0.036]}>
            <Flat color="#f7d9cf" />
          </mesh>
          <mesh geometry={geo.foot} position={[-0.012, 0.342, 0]} scale={0.02}>
            <Flat color={L.hair} />
          </mesh>
          <mesh geometry={geo.foot} position={[0, 0.316, 0]} scale={[0.038, 0.03, 0.038]}>
            <Flat color={L.hair} />
          </mesh>
          {/* arms raised in a ring over her head */}
          <mesh geometry={geo.arms} position-y={0.33}>
            <Flat color="#f7d9cf" />
          </mesh>
        </group>

        {/* the butterfly winding key in the right-hand side */}
        <group ref={key} position={[W / 2, H * 0.48, 0]}>
          <mesh geometry={geo.disc} rotation-z={Math.PI / 2} position-x={0.05} scale={[0.018, 0.1, 0.018]}>
            <Flat color={L.trim} {...gold} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} geometry={geo.loop} position={[0.11, k * 0.075, 0]} rotation-y={Math.PI / 2} scale={[1, 1.05, 1]}>
              <Flat color={L.trim} {...gold} />
            </mesh>
          ))}
        </group>

        {/* the lid, hinged along the back edge, with a mirror underneath */}
        <group ref={lid} position={[0, H + 0.017, -D / 2]}>
          <group position-z={D / 2}>
            <mesh geometry={geo.lid} position-y={0.045}>
              <Flat color={L.box} />
            </mesh>
            <mesh geometry={geo.panel} position-y={0.095}>
              <Flat color={L.box2} />
            </mesh>
            {bar([0, 0.004, 0], [W + 0.02, 0.02, D + 0.02], L.velvet, { roughness: 0.95 })}
            <mesh geometry={geo.disc} position-y={0.124} scale={[0.09, 0.012, 0.07]}>
              <Flat color={L.trim} {...gold} />
            </mesh>
            {/* the mirror in a gold frame, a bright streak across the glass */}
            {bar([0, -0.004, 0], [W - 0.22, 0.012, D - 0.2], L.trim, gold)}
            {bar([0, -0.009, 0], [W - 0.3, 0.012, D - 0.28], '#cfe7f3', { metalness: 0.35, roughness: 0.12, emissive: '#bfe3f6', emissiveIntensity: 0.35 })}
            {[0, 0.1].map((x, i) => bar([x - 0.1, -0.016, 0.02], [0.05 - i * 0.025, 0.004, D - 0.42], '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }, i))}
          </group>
        </group>
      </group>
      {/* a trickle of notes, a flurry while the tune plays, and a sparkle */}
      <Particles count={12} life={2.6} origin={[0, H + 0.2, 0]} spread={0.25} velocity={[0, 0.5, 0.12]} scatter={0.25} drift={0.25} size={[0.12, 0.16]} colors={[L.note, L.trim, '#ffffff']} opacity={[1, 0]} emissive={0.25} geometry={geo.note} active={notesOn} spin={0.6} seed={5} />
      <Burst tap={tap} geometry={geo.star} count={16} colors={[L.trim, '#ffffff', '#fff1a8']} speed={1.5} gravity={0.6} size={0.045} life={1.5} origin={[0, H + 0.55, 0]} spread={1} up={0.8} seed={9} />
      <mesh position-y={0.55}>
        <boxGeometry args={[W + 0.3, 1.1, D + 0.3]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function MusicBoxScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.2, 2.0, 3.4]} target={[0, 0.5, 0]} hint="The lid rests open a crack, the little dancer turns slowly inside and the key ticks round · tap it and the lid swings right back, she springs up and spins in a flurry of notes, then the tune winds down · Look swaps rose, walnut and mint · drag to orbit">
      <MusicBox {...props} />
    </Stage>
  )
}
