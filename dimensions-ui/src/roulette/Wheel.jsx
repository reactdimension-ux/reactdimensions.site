import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildPeel, buildWood } from '../gameboard/textures.js'
import { createRouletteAudio } from './audio.js'
import { arcPts, lathe } from './build.js'
import { ORDER } from './layout.js'
import { BALL, DIAMONDS, DIAMOND_R, R, SEG, SLOPE, Y, ground, newSim, rand, step } from './physics.js'
import { buildRing } from './textures.js'

// A single-zero roulette wheel that works the way a real one does.
//
// The bowl is fixed: a rim, a ball track under its lip, and a sloping apron
// set with eight deflectors. The rotor turns inside it on a spindle: the
// number ring, 37 pockets divided by metal separators, a cone and a turret.
//
// A spin sets the rotor turning one way and flicks the ball round the track
// the other way. Nothing about the result is decided in advance: the ball
// is simulated. It holds the track while it is fast enough to be pressed
// against the wall, slows with rolling drag, peels off and spirals down the
// apron, is knocked about by the deflectors, drops onto the turning rotor,
// rattles over the separators until it is too slow to climb one, and
// settles in a pocket. That pocket's number is the result.
//
// Heights are above the table's cloth; the wheel's axis is the local y axis.
// An angle a is the point (sin a, cos a) in plan, which is how a lathe is
// turned, so the ring's texture, the pockets and the ball agree.

// ---- turned profiles, [radius, height], each listed bottom -> outside -> top -> inside ----
const BOWL = (() => {
  const a = Math.atan(SLOPE.apron)
  const apronAt = (r) => Y.apron + (r - R.rotor) * SLOPE.apron
  // the track: a fillet a little larger than the ball between the apron and the wall
  const wall = R.track + BALL
  const f = 0.012
  const fc = [wall - f, apronAt(wall - f) + f / Math.cos(a)]
  return [
    [0.4045, 0.004],
    [0.4045, 0.0115],
    [0.403, 0.0135],
    [0.399, 0.016],
    [0.397, 0.021],
    [0.396, 0.073],
    ...arcPts(0.386, 0.073, 0.01, 0, Math.PI / 2, 8),
    ...arcPts(wall + 0.008, 0.075, 0.008, Math.PI / 2, Math.PI, 8),
    ...arcPts(fc[0], fc[1], f, 0, a - Math.PI / 2, 10),
    [R.rotor, Y.apron],
    [R.rotor, Y.apron],
    [R.rotor, 0.006],
  ]
})()
const RIM = R.rotor - 0.0025 // the rotor's own radius
const RING = [
  [RIM, Y.ring + (RIM - R.ring) * SLOPE.ring],
  [R.ring, Y.ring],
  [R.ring, Y.ring],
  [R.ring, Y.floor],
  [R.ring, Y.floor],
  [R.cone, Y.floor],
  [R.cone, Y.floor],
  [R.cone, Y.cone],
]
const RING_BANDS = (() => {
  const len = [1, 3, 5, 7].map((i) => Math.hypot(RING[i][0] - RING[i - 1][0], RING[i][1] - RING[i - 1][1]))
  const total = len.reduce((a, b) => a + b)
  return [len[0] / total, (len[0] + len[1]) / total, (len[0] + len[1] + len[2]) / total]
})()
const coneAt = (r) => Y.cone + (R.cone - r) * SLOPE.cone
const CONE = [[R.cone, Y.cone], [R.cone, Y.cone], [0.169, 0.0152], [0.165, coneAt(0.165)], [0.056, coneAt(0.056)], [0.05, coneAt(0.056) + 0.0005]]
const SKIRT = [[RIM, 0.008], [RIM, RING[0][1]]]
const TURRET = [
  [0.054, 0.045],
  [0.054, 0.051],
  [0.05, 0.055],
  [0.032, 0.058],
  [0.025, 0.062],
  [0.022, 0.075],
  [0.029, 0.082],
  [0.034, 0.09],
  [0.03, 0.098],
  [0.02, 0.103],
  [0.014, 0.11],
  [0.013, 0.128],
  [0.019, 0.134],
  [0.022, 0.142],
  [0.019, 0.15],
  [0.011, 0.155],
  [0.008, 0.16],
  [0.0085, 0.17],
  ...arcPts(0, 0.182, 0.0125, -0.8, Math.PI / 2, 12),
]

function buildGeometry() {
  const fret = new THREE.BoxGeometry(0.0014, Y.fret - Y.floor, R.ring - R.cone)
  const diamond = new THREE.OctahedronGeometry(1)
  return {
    bowl: lathe(BOWL, 160, 5),
    ring: lathe(RING, 148, 1, 0),
    cone: lathe(CONE, 128, 3),
    skirt: lathe(SKIRT, 128, 1, 0),
    turret: lathe(TURRET, 64, 1, 0),
    fret,
    diamond,
    hoop: [
      [RIM - 0.0008, RING[0][1] + 0.0002],
      [R.ring, Y.fret - 0.0003],
      [R.cone, Y.cone + 0.0002],
    ].map(([r, y]) => ({ y, g: new THREE.TorusGeometry(r, 0.0012, 8, 160) })),
    ball: new THREE.SphereGeometry(BALL, 40, 28),
  }
}

const Wheel = forwardRef(function Wheel({ woodColor = '#6a3420', metalColor = '#c9a557', sound = true, onResult, ...props }, ref) {
  const invalidate = useThree((s) => s.invalidate)
  const rotor = useRef()
  const ball = useRef()
  const frets = useRef()
  const sim = useRef(null)
  if (!sim.current) sim.current = newSim()
  const audio = useRef(null)
  const live = useRef({})
  live.current = { sound, onResult }
  const acc = useRef(0)

  const geo = useMemo(buildGeometry, [])
  const tex = useMemo(() => {
    const peel = buildPeel()
    peel.repeat.set(30, 6)
    return { grain: buildWood(7), peel, ring: buildRing(RING_BANDS) }
  }, [])
  const mats = useMemo(
    () => ({
      wood: new THREE.MeshPhysicalMaterial({ map: tex.grain, roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.16, clearcoatNormalMap: tex.peel, clearcoatNormalScale: new THREE.Vector2(0.05, 0.05) }),
      ring: new THREE.MeshPhysicalMaterial({ map: tex.ring, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.22 }),
      metal: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.2 }),
      ball: new THREE.MeshPhysicalMaterial({ color: '#f4f1e8', roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    }),
    [tex],
  )
  useLayoutEffect(() => {
    mats.wood.color.set(woodColor)
    mats.metal.color.set(metalColor)
    invalidate()
  }, [mats, woodColor, metalColor, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      Object.values(tex).forEach((t) => t.dispose())
      const { hoop, ...rest } = geo
      Object.values(rest).forEach((g) => g.dispose())
      hoop.forEach((h) => h.g.dispose())
    },
    [mats, tex, geo],
  )
  useEffect(
    () => () => {
      audio.current?.dispose()
      audio.current = null
    },
    [],
  )
  useEffect(() => {
    if (!sound) audio.current?.roll(0)
  }, [sound])

  // the 37 separators, one mesh
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const mid = (R.ring + R.cone) / 2
    for (let k = 0; k < ORDER.length; k++) {
      const a = -k * SEG
      m.makeRotationY(a).setPosition(Math.sin(a) * mid, (Y.fret + Y.floor) / 2, Math.cos(a) * mid)
      frets.current.setMatrixAt(k, m)
    }
    frets.current.instanceMatrix.needsUpdate = true
  }, [])

  const place = () => {
    const s = sim.current
    rotor.current.rotation.y = s.A
    ball.current.position.set(Math.sin(s.th) * s.r, s.y + BALL, Math.cos(s.th) * s.r)
  }
  useLayoutEffect(place, [])

  useImperativeHandle(
    ref,
    () => ({
      // false if a spin is already under way
      spin() {
        const s = sim.current
        if (s.mode === 'pickup' || s.mode === 'run') return false
        if (live.current.sound && !audio.current) audio.current = createRouletteAudio()
        // rotor one way, ball the other, swapping each spin as croupiers do
        s.dir = -s.dir
        Object.assign(s, { mode: 'pickup', t: 0, r0: s.r, y0: s.y, th0: s.th, Wt: -s.dir * rand(1.9, 2.3), w0: rand(9.5, 11.5) })
        invalidate()
        return true
      },
    }),
    [invalidate],
  )

  useFrame((_, dt) => {
    const s = sim.current
    if (s.mode === 'settled' && s.W === 0) return
    const click = (v) => live.current.sound && audio.current?.click(v)
    acc.current = Math.min(acc.current + dt, 0.06)
    const h = 1 / 480
    while (acc.current >= h) {
      acc.current -= h
      const n = step(s, h, click)
      if (n !== undefined) live.current.onResult?.(n)
    }
    place()
    if (live.current.sound && audio.current) {
      const rolling = s.mode === 'run' && s.y <= ground(s.r)[0] + 0.001
      audio.current.roll(rolling ? Math.abs(s.w - (s.r < R.rotor ? s.W : 0)) * s.r : 0)
    }
    invalidate()
  })

  return (
    <group {...props}>
      <mesh geometry={geo.bowl} material={mats.wood} castShadow receiveShadow />
      {DIAMONDS.map((a, k) => (
        <group key={k} rotation-y={a} position={[Math.sin(a) * DIAMOND_R, Y.apron + (DIAMOND_R - R.rotor) * SLOPE.apron + 0.001, Math.cos(a) * DIAMOND_R]}>
          <mesh geometry={geo.diamond} material={mats.metal} rotation-x={-Math.atan(SLOPE.apron)} scale={k % 2 ? [0.03, 0.007, 0.0095] : [0.0095, 0.007, 0.03]} castShadow />
        </group>
      ))}
      <group ref={rotor}>
        <mesh geometry={geo.ring} material={mats.ring} receiveShadow />
        <mesh geometry={geo.skirt} material={mats.metal} />
        <mesh geometry={geo.cone} material={mats.wood} receiveShadow />
        <mesh geometry={geo.turret} material={mats.metal} castShadow />
        {geo.hoop.map((h, i) => (
          <mesh key={i} geometry={h.g} material={mats.metal} rotation-x={Math.PI / 2} position-y={h.y} />
        ))}
        <instancedMesh ref={frets} args={[geo.fret, mats.metal, ORDER.length]} castShadow />
      </group>
      <mesh ref={ball} geometry={geo.ball} material={mats.ball} castShadow />
    </group>
  )
})

export default Wheel
