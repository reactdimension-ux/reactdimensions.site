import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Hinge, Stage, facet, rng, useGeo, useTap, waveAt } from './kit.jsx'

// A low-poly row of three beach huts on a strip of sand: little sheds with
// vertical stripes, pitched roofs and a door each, up on plinths and facing
// the sea, whose edge laps at the sand in front of them. A pennant flies
// from each ridge. Left alone, the flags flutter in the sea breeze and the
// foam runs up the sand and slides back. Tap a hut and its door swings open
// on its hinges, showing the dark inside, then swings shut again (tap the
// sand and the next hut along opens).

const LOOKS = {
  pastel: {
    huts: [
      { body: '#f5c4d1', stripe: '#ffffff', door: '#e9879f', roof: '#ddd3ea', flag: '#e9879f' },
      { body: '#b2e0cf', stripe: '#ffffff', door: '#6fbfa6', roof: '#ddd3ea', flag: '#f2c95c' },
      { body: '#f6df98', stripe: '#ffffff', door: '#8fb8e8', roof: '#ddd3ea', flag: '#8fb8e8' },
    ],
    trim: '#ffffff',
  },
  bright: {
    huts: [
      { body: '#e63946', stripe: '#ffffff', door: '#ffcc33', roof: '#2b2f4a', flag: '#ffcc33' },
      { body: '#2a8df0', stripe: '#ffffff', door: '#ff7a2f', roof: '#2b2f4a', flag: '#e63946' },
      { body: '#ffc23a', stripe: '#ffffff', door: '#2fb37a', roof: '#2b2f4a', flag: '#2a8df0' },
    ],
    trim: '#ffffff',
  },
  stripes: {
    huts: [
      { body: '#f8f6f0', stripe: '#1f3b73', door: '#1f3b73', roof: '#c8352c', flag: '#c8352c' },
      { body: '#f8f6f0', stripe: '#c8352c', door: '#c8352c', roof: '#1f3b73', flag: '#1f3b73' },
      { body: '#f8f6f0', stripe: '#2a9d8f', door: '#2a9d8f', roof: '#c8352c', flag: '#f2c230' },
    ],
    trim: '#f8f6f0',
  },
}

const W = 0.46 // hut width (x)
const D = 0.46 // depth (z)
const H = 0.52 // wall height
const RISE = 0.2 // roof rise
const GAP = 0.66 // hut spacing
const BASE = 0.17 // the hut floor height
const HZ = -0.28 // the huts' z
const DW = 0.2 // door width
const DH = 0.38 // door height
const OPEN = 1.6 // seconds a door stays open
const SLATS = 9
const SHORE = 0.38 // where the sand meets the sea (z)
const SAND_W = 2.5
const SEA = 0.6 // the sea's depth (z)
const SEA_Y = 0.06 // its surface
const onTop = (z) => Math.max(sandY(z), SEA_Y + 0.008)

// The flat sand on top, sloping into the sea at the front.
const sandY = (z) => (z < SHORE - 0.2 ? 0.1 : Math.max(0.02, 0.1 - ((z - (SHORE - 0.2)) / 0.32) * 0.08))

// A pennant: a long thin triangle along +x, in a few segments so it can ripple.
function pennant(len, h) {
  const g = new THREE.BufferGeometry()
  const n = 4
  const pos = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    pos.push(u * len, (h / 2) * (1 - u), 0, u * len, (-h / 2) * (1 - u), 0)
  }
  const idx = []
  for (let i = 0; i < n; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// The stripes on the walls: every other slat, proud of the wall a hair;
// over the door the front slats only fill the gap above it.
function stripes() {
  const out = []
  const sw = W / SLATS
  for (let k = 1; k < SLATS; k += 2) {
    const c = -W / 2 + sw * (k + 0.5)
    // back and the two sides run full height
    out.push({ p: [c, H / 2, -D / 2 - 0.004], s: [sw, H, 0.008] })
    out.push({ p: [-W / 2 - 0.004, H / 2, c], s: [0.008, H, sw] })
    out.push({ p: [W / 2 + 0.004, H / 2, c], s: [0.008, H, sw] })
    // the front, clear of the door
    if (Math.abs(c) - sw / 2 < DW / 2 + 0.02) out.push({ p: [c, (H + DH + 0.02) / 2, D / 2 + 0.004], s: [sw, H - DH - 0.02, 0.008] })
    else out.push({ p: [c, H / 2, D / 2 + 0.004], s: [sw, H, 0.008] })
  }
  return out
}
const STRIPES = stripes()

function Hut({ i, C, trim, geo, opened, clock, onTap }) {
  const flag = useRef()
  const base = useMemo(() => Float32Array.from(geo.flags[i].attributes.position.array), [geo, i])
  useFrame(() => {
    const t = clock.elapsedTime
    // the flag ripples: a wave runs out along it, growing towards the tip
    const p = geo.flags[i].attributes.position
    for (let v = 0; v < p.count; v++) {
      const x = base[v * 3]
      p.setZ(v, Math.sin(t * 7 - x * 22 + i * 1.7) * x * 0.32 + Math.sin(t * 2.3 + i) * x * 0.12)
    }
    p.needsUpdate = true
    geo.flags[i].computeVertexNormals()
    flag.current.rotation.y = 0.25 + Math.sin(t * 0.8 + i * 2) * 0.2
  })
  const open = () => {
    const s = clock.elapsedTime - opened.current[i]
    return s >= 0 && s < OPEN
  }
  return (
    <group
      position={[(i - 1) * GAP, 0, HZ]}
      onClick={(e) => {
        e.stopPropagation()
        onTap(i)
      }}
    >
      {/* the plinth and its little step */}
      <mesh geometry={geo.plinth} position-y={(BASE + 0.1) / 2}>
        <Flat color="#b8946a" />
      </mesh>
      <mesh geometry={geo.step} position={[0, 0.115, D / 2 + 0.09]}>
        <Flat color="#a8845c" />
      </mesh>
      <group position-y={BASE}>
        <mesh geometry={geo.body} position-y={H / 2}>
          <Flat color={C.body} />
        </mesh>
        {STRIPES.map((s, k) => (
          <mesh key={k} geometry={geo.slab} position={s.p} scale={s.s}>
            <Flat color={C.stripe} />
          </mesh>
        ))}
        {/* the gable, the roof's two slopes and the ridge */}
        <mesh geometry={geo.gable} position-y={H}>
          <Flat color={C.body} />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} geometry={geo.roof} position={[(sd * W) / 4 + sd * 0.005, H + RISE / 2 + 0.02, 0]} rotation-z={-sd * Math.atan2(RISE, W / 2)}>
            <Flat color={C.roof} />
          </mesh>
        ))}
        {/* the dark inside, the door frame and the door, hinged on its left */}
        <mesh geometry={geo.slab} position={[0, DH / 2, D / 2 + 0.006]} scale={[DW, DH, 0.006]}>
          <Flat color="#2a2433" roughness={1} />
        </mesh>
        <mesh geometry={geo.slab} position={[0, DH + 0.02, D / 2 + 0.01]} scale={[DW + 0.06, 0.03, 0.02]}>
          <Flat color={trim} />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} geometry={geo.slab} position={[sd * (DW / 2 + 0.015), DH / 2, D / 2 + 0.01]} scale={[0.03, DH + 0.01, 0.02]}>
            <Flat color={trim} />
          </mesh>
        ))}
        <Hinge open={open} angle={-1.85} axis="y" stiffness={70} damping={6} position={[-DW / 2, 0, D / 2 + 0.014]}>
          <mesh geometry={geo.slab} position={[DW / 2, DH / 2, 0]} scale={[DW - 0.005, DH - 0.005, 0.022]}>
            <Flat color={C.door} />
          </mesh>
          <mesh geometry={geo.port} position={[DW / 2, DH * 0.72, 0.013]}>
            <Flat color={trim} />
          </mesh>
          <mesh geometry={geo.glass} position={[DW / 2, DH * 0.72, 0.016]}>
            <Flat color="#9fd4ec" roughness={0.3} />
          </mesh>
          <mesh geometry={geo.knob} position={[DW - 0.03, DH * 0.45, 0.02]}>
            <Flat color="#e2b84a" roughness={0.4} metalness={0.4} />
          </mesh>
        </Hinge>
        {/* the flag on the ridge */}
        <group position={[0, H + RISE + 0.02, D / 2 - 0.06]}>
          <mesh geometry={geo.pole} position-y={0.13}>
            <Flat color="#e8e4ec" />
          </mesh>
          <group ref={flag} position-y={0.22}>
            <mesh geometry={geo.flags[i]}>
              <Flat color={C.flag} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export function BeachHuts({ look = 'pastel' }) {
  const S = LOOKS[look] || LOOKS.pastel
  const { handlers, clock } = useTap(1)
  const opened = useRef([-99, -99, -99])
  const next = useRef(1)
  const sea = useRef()
  const foam = useRef([])
  const wet = useRef()

  const geo = useGeo(() => {
    // the sand: a slab whose front slopes down under the water
    const prof = new THREE.Shape()
    const zs = []
    for (let z = -0.75; z <= SHORE + 0.2; z += 0.06) zs.push(z)
    prof.moveTo(0, -0.75)
    zs.forEach((z) => prof.lineTo(sandY(z), z))
    prof.lineTo(0, SHORE + 0.2)
    // shape x is height, shape y is depth, the extrusion runs along the row
    const sand = new THREE.ExtrudeGeometry(prof, { depth: SAND_W, bevelEnabled: false, curveSegments: 1 })
    sand.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, -SAND_W / 2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1))
    // the hut roof's gable end: a triangle prism
    const tri = new THREE.Shape()
    tri.moveTo(-W / 2, 0)
    tri.lineTo(W / 2, 0)
    tri.lineTo(0, RISE)
    tri.lineTo(-W / 2, 0)
    const gable = new THREE.ExtrudeGeometry(tri, { depth: D, bevelEnabled: false }).translate(0, 0, -D / 2)
    const slope = Math.hypot(W / 2, RISE)
    return {
      sand: facet(sand.toNonIndexed(), 0.012, 4, [0.6, 0.4, 0.6], (x, y) => y < 0.005),
      sea: new THREE.PlaneGeometry(SAND_W, SEA, 14, 4).rotateX(-Math.PI / 2),
      seaSide: new THREE.BoxGeometry(SAND_W, 0.05, SEA),
      foam: new THREE.BoxGeometry(1, 1, 1),
      plinth: facet(new THREE.BoxGeometry(W + 0.08, BASE - 0.1 + 0.02, D + 0.08), 0.006, 5),
      step: new THREE.BoxGeometry(0.22, 0.03, 0.12),
      body: new THREE.BoxGeometry(W, H, D),
      slab: new THREE.BoxGeometry(1, 1, 1),
      gable,
      roof: facet(new THREE.BoxGeometry(slope + 0.06, 0.035, D + 0.1), 0.004, 6),
      port: new THREE.CylinderGeometry(0.045, 0.045, 0.01, 8).rotateX(Math.PI / 2),
      glass: new THREE.CylinderGeometry(0.032, 0.032, 0.01, 8).rotateX(Math.PI / 2),
      knob: new THREE.IcosahedronGeometry(0.018, 0),
      pole: new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5),
      flags: [0, 1, 2].map(() => pennant(0.16, 0.08)),
      shell: facet(new THREE.ConeGeometry(0.035, 0.03, 6), 0.004, 7),
      pebble: facet(new THREE.DodecahedronGeometry(0.03, 0), 0.006, 8).scale(1, 0.5, 1),
    }
  }, [])
  const seaBase = useMemo(() => Float32Array.from(geo.sea.attributes.position.array), [geo])
  const bits = useMemo(() => {
    const r = rng(12)
    return Array.from({ length: 9 }, (_, i) => {
      const x = (r() - 0.5) * (SAND_W - 0.2)
      const z = -0.7 + r() * 0.25 + (i % 3 === 0 ? 0.75 : 0)
      return { p: [x, sandY(z) + 0.01, z], shell: i % 3 === 0, c: ['#f2d6c8', '#e8c0b0', '#d9d1c3'][i % 3], ry: r() * 6 }
    })
  }, [])

  const onTap = (i) => {
    const t = clock.elapsedTime
    opened.current[i] = t
    next.current = (i + 1) % 3
  }

  useFrame(() => {
    const t = clock.elapsedTime
    // the sea rolls, and its edge laps up the sand and slides back
    const p = geo.sea.attributes.position
    for (let v = 0; v < p.count; v++) p.setY(v, waveAt(seaBase[v * 3], seaBase[v * 3 + 2], t, 0.008, 0.9))
    p.needsUpdate = true
    geo.sea.computeVertexNormals()
    foam.current.forEach((m, k) => {
      if (!m) return
      const lap = Math.sin(t * 1.1 - k * 0.9)
      const z = SHORE - 0.12 + 0.08 * lap + k * 0.07
      m.position.set(0, onTop(z) + 0.006, z)
      m.scale.set(SAND_W - 0.01, 0.012, 0.035 + 0.02 * (1 - k))
      m.material.opacity = (k ? 0.55 : 0.95) * (0.75 + 0.25 * lap)
    })
    const wz = SHORE - 0.16 + 0.05 * Math.sin(t * 1.1 - 0.4)
    wet.current.position.set(0, sandY(wz) + 0.002, wz)
  })

  return (
    <group
      {...handlers}
      onClick={(e) => {
        e.stopPropagation()
        onTap(next.current)
      }}
    >
      <mesh geometry={geo.sand}>
        <Flat color="#ecd29a" />
      </mesh>
      {bits.map((b, i) => (
        <mesh key={i} geometry={b.shell ? geo.shell : geo.pebble} position={b.p} rotation-y={b.ry}>
          <Flat color={b.c} />
        </mesh>
      ))}
      {/* the sea, a shade deeper at its foot */}
      <group position={[0, SEA_Y, SHORE + SEA / 2 - 0.05]}>
        <mesh ref={sea} geometry={geo.sea}>
          <meshStandardMaterial color="#4fb3d9" flatShading roughness={0.3} metalness={0.05} />
        </mesh>
        <mesh geometry={geo.seaSide} position-y={-0.05}>
          <Flat color="#2f87b3" />
        </mesh>
      </group>
      <mesh ref={wet} geometry={geo.foam} scale={[SAND_W - 0.01, 0.004, 0.14]}>
        <Flat color="#cdb27c" />
      </mesh>
      {[0, 1].map((k) => (
        <mesh key={k} ref={(el) => (foam.current[k] = el)} geometry={geo.foam}>
          <meshStandardMaterial color="#ffffff" flatShading transparent depthWrite={false} />
        </mesh>
      ))}
      {S.huts.map((C, i) => (
        <Hut key={i} i={i} C={C} trim={S.trim} geo={geo} opened={opened} clock={clock} onTap={onTap} />
      ))}
    </group>
  )
}

export default function BeachHutsScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[1.9, 1.75, 4.3]} target={[0, 0.4, -0.05]} hint="Pennants flutter on the roofs in the sea breeze and the foam laps up the sand · tap a hut and its door swings open on its hinges, then closes (tap the sand for the next one along) · Look swaps pastel, bright and stripes · drag to orbit">
      <BeachHuts {...props} />
    </Stage>
  )
}
