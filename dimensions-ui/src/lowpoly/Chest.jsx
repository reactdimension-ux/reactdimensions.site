import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { Flat, Stage, facet, rng, useGeo } from './kit.jsx'

// A low-poly treasure chest: a faceted painted box under a barrel lid, bound
// at the corners and edges in gold, with a gold lock plate and keyhole. Shut,
// something inside rattles the lid now and then. Opened, the lid springs back
// on its hinge, gold light spills out and coins burst up, tumble and drop
// back in.

const PAINT = { purple: '#6a3d9e', red: '#a3303a', blue: '#2f56a6', green: '#2f7d4f' }
const GOLD = '#d9aa3c'
const W = 1.4 // width
const D = 0.9 // depth
const H = 0.74 // body height
const LID_R = D / 2
const COINS = 14

export function Chest({ color = 'purple', loop = true }) {
  const paint = PAINT[color] || PAINT.purple
  const clock = useThree((s) => s.clock)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const lid = useRef()
  const body = useRef()
  const glow = useRef()
  const light = useRef()
  const coinRefs = useRef([])
  const st = useRef({ open: false, a: 0, v: 0, toggledAt: 0, nextBurst: 0 })
  const coins = useMemo(() => Array.from({ length: COINS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), w: new THREE.Vector3(), live: false })), [])

  const geo = useGeo(
    () => {
      // half a six-sided barrel: axis along x, the curve on top, open below
      const barrel = (r, len) => new THREE.CylinderGeometry(r, r, len, 6, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateY(Math.PI / 2)
      return {
        body: facet(new THREE.BoxGeometry(W, H, D, 3, 2, 2), 0.018, 1),
        lid: facet(barrel(LID_R, W), 0.012, 2, [0, 1, 1], (x, y) => y < 0.001),
        lidBand: barrel(LID_R + 0.025, 0.09),
        bar: new THREE.BoxGeometry(1, 1, 1),
        coin: new THREE.CylinderGeometry(0.085, 0.085, 0.025, 7),
        keyhole: new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6).rotateX(Math.PI / 2),
        inside: new THREE.PlaneGeometry(W - 0.12, D - 0.12).rotateX(-Math.PI / 2),
      }
    },
    [],
  )

  const toggle = () => {
    const s = st.current
    s.open = !s.open
    s.toggledAt = clock.elapsedTime
    if (s.open) burst()
  }
  const burst = () => {
    const r = rng((Math.random() * 1e9) | 0)
    coins.forEach((c, i) => {
      c.live = true
      c.p.set((r() - 0.5) * 0.7, H - 0.1, (r() - 0.5) * 0.4)
      c.v.set((r() - 0.5) * 1.6, 3.1 + r() * 1.4, (r() - 0.3) * 1.2)
      c.w.set(r() * 14, r() * 8, r() * 14)
      c.delay = i * 0.03
    })
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const t = clock.elapsedTime
    const s = st.current
    // on a loop it opens and shuts by itself
    if (loop && t - s.toggledAt > (s.open ? 2.6 : 2.2) && t > 1) toggle()
    // the lid: a sprung hinge, overshooting a little when it flies open
    const target = s.open ? 1.95 : 0
    s.v += ((target - s.a) * 70 - s.v * 9) * dt
    s.a += s.v * dt
    if (!s.open && s.a < 0) (s.a = 0), (s.v = Math.abs(s.v) * 0.25) // it lands on the rim and bounces
    // shut, the lid now and then rattles, as if something is in there
    const rattle = !s.open && s.a < 0.02 ? Math.max(0, Math.sin(t * 2.4)) ** 24 * Math.abs(Math.sin(t * 40)) * 0.06 : 0
    lid.current.rotation.x = -(s.a + rattle)
    body.current.position.y = rattle * 0.25
    // the gold glow from inside follows how far open it is
    const open = THREE.MathUtils.clamp(s.a / 1.6, 0, 1)
    glow.current.material.emissiveIntensity = open * (1.4 + Math.sin(t * 6) * 0.15)
    light.current.intensity = open * 3
    // coins
    coins.forEach((c, i) => {
      const m = coinRefs.current[i]
      if (!m) return
      if (c.live && (c.delay -= dt) <= 0) {
        c.v.y -= 9.81 * dt
        c.p.addScaledVector(c.v, dt)
        m.rotation.x += c.w.x * dt
        m.rotation.y += c.w.y * dt
        m.rotation.z += c.w.z * dt
        // back into the chest, or onto the floor in front of it
        if (c.v.y < 0 && c.p.y < H - 0.05 && Math.abs(c.p.x) < W / 2 - 0.05 && Math.abs(c.p.z) < D / 2 - 0.05) c.live = false
        if (c.p.y < 0.02) c.live = false
      }
      m.visible = c.live && c.delay <= 0
      m.position.copy(c.p)
    })
  })

  const gold = <Flat color={GOLD} metalness={0.55} roughness={0.38} />
  const bar = (p, s, key) => (
    <mesh key={key} geometry={geo.bar} position={p} scale={s}>
      {gold}
    </mesh>
  )
  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        toggle()
      }}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      <group ref={body}>
        <mesh geometry={geo.body} position-y={H / 2}>
          <Flat color={paint} />
        </mesh>
        {/* gold glow on the treasure inside */}
        <mesh ref={glow} geometry={geo.inside} position-y={H - 0.06}>
          <meshStandardMaterial color="#8a6418" emissive="#ffc94a" emissiveIntensity={0} flatShading />
        </mesh>
        <pointLight ref={light} position={[0, H + 0.35, 0.1]} color="#ffcf66" intensity={0} distance={3.5} decay={2} />
        {/* corner posts, the base band and the rim band */}
        {[-1, 1].map((sx) => [-1, 1].map((sz) => bar([sx * (W / 2), H / 2, sz * (D / 2)], [0.11, H + 0.02, 0.11], `${sx}${sz}`)))}
        {bar([0, 0.045, 0], [W + 0.06, 0.09, D + 0.06])}
        {bar([0, H - 0.035, 0], [W + 0.05, 0.07, D + 0.05])}
        {/* the lock plate and its keyhole */}
        {bar([0, H - 0.13, D / 2 + 0.03], [0.24, 0.3, 0.05])}
        <mesh geometry={geo.keyhole} position={[0, H - 0.1, D / 2 + 0.058]}>
          <Flat color="#1a1208" />
        </mesh>
        <mesh geometry={geo.bar} position={[0, H - 0.17, D / 2 + 0.058]} scale={[0.026, 0.07, 0.02]}>
          <Flat color="#1a1208" />
        </mesh>

        {/* the lid, hinged along the back edge */}
        <group ref={lid} position={[0, H, -D / 2]}>
          <group position-z={D / 2}>
            <mesh geometry={geo.lid}>
              <Flat color={paint} side={THREE.DoubleSide} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={geo.lidBand} position-x={s * (W / 2 - 0.02)}>
                {gold}
              </mesh>
            ))}
            <mesh geometry={geo.lidBand} scale={[0.7, 1, 1]}>
              {gold}
            </mesh>
            {bar([0, 0.03, D / 2 + 0.01], [W + 0.05, 0.06, 0.06])}
            {/* the hasp that drops over the lock */}
            {bar([0, 0.0, D / 2 + 0.04], [0.14, 0.12, 0.04])}
          </group>
        </group>
      </group>
      {coins.map((_, i) => (
        <mesh key={i} ref={(m) => (coinRefs.current[i] = m)} geometry={geo.coin} visible={false}>
          <Flat color="#f2c14e" metalness={0.6} roughness={0.3} emissive="#6b4a08" />
        </mesh>
      ))}
    </group>
  )
}

export default function ChestScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 0.6, 0]} camera={[3.2, 2.4, 4.4]} hint="Tap the chest to open or shut it: the lid springs back, gold light spills out and coins burst up · Loop opens and shuts it on its own · shut, something inside rattles the lid · drag to orbit">
      <Chest {...props} />
    </Stage>
  )
}
