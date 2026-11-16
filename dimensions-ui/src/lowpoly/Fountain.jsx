import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Ripple, Stage, TAU, Water, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly tiered fountain on a round plaza of paving: a wide pool behind a
// low moulded wall, a turned column rising from the water and carrying two
// dished bowls, the upper one smaller, with a little cup and a finial spout
// on top. Left alone, water arcs out of the spout and falls into the upper
// bowl, spills over each bowl's rim in a falling sheet threaded with
// streaks, splashes where it lands, and the pool rolls and rings spread
// across it. Tap it and the jets surge: the top spray shoots up much higher
// and wider, a ring of jets springs up from the pool wall and arcs inward,
// spray bursts from the top and rings spread over the pool, then it all
// settles back.

const LOOKS = {
  stone: { stone: '#bdb6aa', stone2: '#a39b8e', trim: '#d6d0c4', pave: ['#d9d2c4', '#c9c0ae', '#b3a994'], water: '#58b4e0', edge: '#3a8fc0' },
  marble: { stone: '#f1eee8', stone2: '#dad5cc', trim: '#ffffff', pave: ['#e6e2da', '#d4cec4', '#bfb8ac'], water: '#5ec4ea', edge: '#3c9ccc' },
  terracotta: { stone: '#cf7a4e', stone2: '#b4623c', trim: '#e3a374', pave: ['#e8cdae', '#d8b892', '#c29f78'], water: '#4ab0d0', edge: '#2e8cac' },
  jade: { stone: '#5fae8e', stone2: '#468f73', trim: '#d8b85a', pave: ['#dcdfd2', '#c6ccbc', '#aeb6a2'], water: '#4cc8d0', edge: '#2fa0aa' },
}

const POOL_R = 0.98 // inside of the pool wall
const POOL_Y = 0.28 // the pool surface
const T1 = { r: 0.62, y: 0.84 } // lower bowl: rim radius and rim height
const T2 = { r: 0.38, y: 1.32 } // upper bowl
const SPOUT_Y = 1.64
const ARCS = 8
const JETS = 10

// the dished bowl, as a lathe profile scaled to rim radius r
const bowlProfile = (r) =>
  [
    [0.0, -0.3],
    [0.18, -0.3],
    [0.36, -0.24],
    [0.62, -0.13],
    [0.9, -0.03],
    [1.0, 0.0],
    [1.06, 0.03],
    [1.04, 0.07],
    [0.95, 0.06],
    [0.6, -0.02],
    [0.0, -0.05],
  ].map(([x, y]) => new THREE.Vector2(x * r, y * r))

// how much the jets surge s seconds after a tap: up fast, hold, settle
function surgeAt(s) {
  if (s < 0 || s > 3.6) return 0
  const up = 1 - Math.exp(-s * 7)
  const down = s < 2.2 ? 1 : Math.max(0, 1 - (s - 2.2) / 1.4)
  return up * down * down
}

// Drops strung along paths: path(u, out) writes the point at u (0..1) into
// out. Each drop runs along its path on a loop, stretched along the flow
// and shrinking in and out at the ends. One instanced mesh draws them all.
const _p = new THREE.Vector3()
const _n = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _Z = new THREE.Vector3(0, 0, 1)
const _M = new THREE.Matrix4()
function Drops({ paths, per = 6, speed = 0.8, size = 0.02, stretch = 2.5, color = '#ffffff', opacity = 0.9, active = 1, seed = 1 }) {
  const clock = useThree((s) => s.clock)
  const mesh = useRef()
  const ph = useRef(0)
  const geo = useGeo(() => new THREE.OctahedronGeometry(1, 0), [])
  const n = paths.length * per
  const D = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: n }, (_, i) => ({ path: paths[i % paths.length], off: Math.floor(i / paths.length) / per + r() * 0.08, vs: 0.85 + r() * 0.3 }))
  }, [n, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    const sp = typeof speed === 'function' ? speed() : speed
    ph.current += Math.min(dt, 0.05) * sp
    const a = typeof active === 'function' ? active() : active
    D.forEach((d, i) => {
      const u = (ph.current * d.vs + d.off) % 1
      const k = a <= 0 ? 0 : Math.min(1, u * 8, (1 - u) * 8) * Math.min(1, a)
      d.path(u, _p)
      d.path(Math.min(1, u + 0.02), _n)
      _n.sub(_p)
      if (_n.lengthSq() < 1e-10) _n.set(0, -1, 0)
      _q.setFromUnitVectors(_Z, _n.normalize())
      _s.set(size * k, size * k, size * stretch * k)
      m.setMatrixAt(i, _M.compose(_p, _q, _s))
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[geo, null, n]} frustumCulled={false}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} flatShading roughness={0.3} transparent opacity={opacity} depthWrite={false} />
    </instancedMesh>
  )
}

export function Fountain({ look = 'stone' }) {
  const L = LOOKS[look] || LOOKS.stone
  const { tap, handlers, clock } = useTap(1)
  const sg = useRef(0)
  const sheets = useRef([])

  const geo = useGeo(() => {
    const ringSegs = (r0, r1, n) => Array.from({ length: n }, (_, i) => new THREE.RingGeometry(r0, r1, 3, 1, (i / n) * TAU, TAU / n - 0.012).rotateX(-Math.PI / 2))
    const wall = [
      [POOL_R, 0.06],
      [POOL_R, 0.34],
      [POOL_R + 0.03, 0.38],
      [1.2, 0.38],
      [1.23, 0.34],
      [1.19, 0.3],
      [1.17, 0.1],
      [1.24, 0.06],
      [1.24, 0.0],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const column = [
      [0.001, 0.06],
      [0.22, 0.06],
      [0.22, 0.12],
      [0.15, 0.18],
      [0.1, 0.3],
      [0.09, 0.42],
      [0.13, 0.5],
      [0.08, 0.58],
      [0.09, 0.68],
      [0.001, 0.68],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const stem = [
      [0.001, 0],
      [0.1, 0],
      [0.06, 0.08],
      [0.05, 0.2],
      [0.08, 0.28],
      [0.05, 0.36],
      [0.001, 0.36],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const finial = [
      [0.001, 0],
      [0.05, 0],
      [0.035, 0.08],
      [0.12, 0.13],
      [0.13, 0.16],
      [0.04, 0.16],
      [0.05, 0.2],
      [0.035, 0.26],
      [0.001, 0.3],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return {
      plaza: facet(new THREE.CylinderGeometry(1.75, 1.8, 0.05, 24, 1).translate(0, 0.025, 0), 0.01, 1, [1, 0.2, 1]),
      inner: ringSegs(1.24, 1.48, 16),
      outer: ringSegs(1.48, 1.73, 20),
      wall: facet(new THREE.LatheGeometry(wall, 18), 0.006, 2),
      column: facet(new THREE.LatheGeometry(column, 10), 0.004, 3),
      stem: new THREE.LatheGeometry(stem, 10),
      finial: new THREE.LatheGeometry(finial, 10),
      bowl1: facet(new THREE.LatheGeometry(bowlProfile(T1.r), 18), 0.005, 4),
      bowl2: facet(new THREE.LatheGeometry(bowlProfile(T2.r), 14), 0.004, 5),
      sheet1: new THREE.CylinderGeometry(T1.r * 1.06, T1.r * 1.06 + 0.05, T1.y - POOL_Y, 22, 1, true).translate(0, -(T1.y - POOL_Y) / 2, 0),
      sheet2: new THREE.CylinderGeometry(T2.r * 1.06, T2.r * 1.06 + 0.04, T2.y - T1.y, 16, 1, true).translate(0, -(T2.y - T1.y) / 2, 0),
      drop: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.6, 0.6, 1.8, 8).translate(0, 0.9, 0),
    }
  }, [])

  // the water's paths; the ones that surge read sg every frame
  const paths = useMemo(() => {
    const arcs = Array.from({ length: ARCS }, (_, i) => {
      const a = (i / ARCS) * TAU
      return (u, o) => {
        const g = sg.current
        const h = 0.22 + 0.5 * g
        const rl = T2.r * (0.72 + 0.2 * g)
        const y0 = SPOUT_Y
        const y1 = T2.y - 0.03
        return o.set(Math.cos(a) * rl * u, y0 + (y1 - y0) * u + 4 * h * u * (1 - u), Math.sin(a) * rl * u)
      }
    })
    const plume = [(u, o) => o.set(0, SPOUT_Y + (0.3 + 0.9 * sg.current) * Math.sin(u * Math.PI) * 0.9, 0)]
    // a falling sheet off a rim: a short lip outward, then down
    const fall = (n, r, y0, y1, phase) =>
      Array.from({ length: n }, (_, i) => {
        const a = ((i + phase) / n) * TAU
        return (u, o) => {
          const rr = r * 1.06 + 0.07 * Math.sqrt(u)
          return o.set(Math.cos(a) * rr, y0 - (y0 - y1) * u * u, Math.sin(a) * rr)
        }
      })
    // little hops of splash where a sheet lands
    const splash = (n, r, y, phase) =>
      Array.from({ length: n }, (_, i) => {
        const a = ((i + phase) / n) * TAU
        const out = i % 2 ? 0.12 : -0.06
        return (u, o) => {
          const rr = r + out * u
          return o.set(Math.cos(a) * rr, y + 0.1 * 4 * u * (1 - u), Math.sin(a) * rr)
        }
      })
    // jets from the pool wall arcing in toward the column
    const jets = Array.from({ length: JETS }, (_, i) => {
      const a = (i / JETS) * TAU + 0.3
      return (u, o) => {
        const g = sg.current
        const rr = POOL_R - 0.02 - (POOL_R - 0.72) * u
        return o.set(Math.cos(a) * rr, 0.36 + (POOL_Y - 0.36) * u + 4 * (0.15 + 0.5 * g) * u * (1 - u), Math.sin(a) * rr)
      }
    })
    return {
      arcs,
      plume,
      fall2: fall(14, T2.r, T2.y + 0.01, T1.y - 0.02, 0),
      fall1: fall(20, T1.r, T1.y + 0.01, POOL_Y, 0.5),
      splash2: splash(12, T2.r * 1.06 + 0.07, T1.y - 0.02, 0.3),
      splash1: splash(18, T1.r * 1.06 + 0.07, POOL_Y, 0.2),
      jets,
    }
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    sg.current = surgeAt(tap.since(t))
    sheets.current.forEach((m, i) => {
      if (!m) return
      m.opacity = 0.42 + 0.2 * sg.current + 0.04 * Math.sin(t * 9 + i * 2)
    })
  })

  const g = () => sg.current
  const flowSpeed = () => 0.9 + 0.8 * sg.current
  const jetsOn = () => (sg.current > 0.04 ? Math.min(1, sg.current * 1.5) : 0)

  return (
    <group {...handlers}>
      {/* the plaza: a disc of paving in two rings of alternating slabs */}
      <mesh geometry={geo.plaza}>
        <Flat color={L.pave[2]} />
      </mesh>
      {geo.inner.map((r, i) => (
        <mesh key={`i${i}`} geometry={r} position-y={0.052}>
          <Flat color={L.pave[i % 2]} />
        </mesh>
      ))}
      {geo.outer.map((r, i) => (
        <mesh key={`o${i}`} geometry={r} position-y={0.052}>
          <Flat color={L.pave[(i + 1) % 2]} />
        </mesh>
      ))}

      {/* the pool: a moulded wall round rolling water */}
      <mesh geometry={geo.wall}>
        <Flat color={L.stone} side={THREE.DoubleSide} />
      </mesh>
      <Water radius={POOL_R + 0.005} rings={5} segs={22} color={L.water} edge={L.edge} amp={0.012} speed={1.4} y={POOL_Y} />
      <Ripple loop period={1.6} count={3} color="#ffffff" radius={0.85} y={POOL_Y + 0.025} opacity={0.4} />
      <Ripple tap={tap} count={3} color="#ffffff" radius={1.0} y={POOL_Y + 0.03} life={1.4} opacity={0.65} />

      {/* the column, the two bowls with water in them, and the finial */}
      <mesh geometry={geo.column}>
        <Flat color={L.stone2} />
      </mesh>
      <mesh geometry={geo.stem} position-y={0.66} scale={[1, (T1.y - 0.66 - 0.08) / 0.36, 1]}>
        <Flat color={L.stone2} />
      </mesh>
      <mesh geometry={geo.bowl1} position-y={T1.y}>
        <Flat color={L.stone} side={THREE.DoubleSide} />
      </mesh>
      <group position-y={T1.y - 0.04}>
        <Water radius={T1.r * 0.97} rings={3} segs={18} color={L.water} edge={L.edge} amp={0.006} speed={2} y={0.03} />
      </group>
      <mesh geometry={geo.stem} position-y={T1.y - 0.02} scale={[0.8, (T2.y - T1.y - 0.06) / 0.36, 0.8]}>
        <Flat color={L.stone2} />
      </mesh>
      <mesh geometry={geo.bowl2} position-y={T2.y}>
        <Flat color={L.stone} side={THREE.DoubleSide} />
      </mesh>
      <group position-y={T2.y - 0.03}>
        <Water radius={T2.r * 0.96} rings={2} segs={14} color={L.water} edge={L.edge} amp={0.005} speed={2.4} y={0.02} />
      </group>
      <mesh geometry={geo.finial} position-y={T2.y - 0.02}>
        <Flat color={L.trim} roughness={0.5} />
      </mesh>

      {/* the falling sheets off each rim */}
      {[
        [geo.sheet2, T2.y + 0.01],
        [geo.sheet1, T1.y + 0.01],
      ].map(([sheet, y], i) => (
        <mesh key={i} geometry={sheet} position-y={y}>
          <meshStandardMaterial ref={(el) => (sheets.current[i] = el)} color={L.water} emissive={L.water} emissiveIntensity={0.15} flatShading roughness={0.25} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}

      {/* the water in motion: arcs, the plume, streaks down the sheets, splash */}
      <Drops paths={paths.arcs} per={7} speed={flowSpeed} size={0.016} stretch={3} color="#e6f6ff" opacity={0.95} seed={1} />
      <Drops paths={paths.plume} per={8} speed={flowSpeed} size={0.022} stretch={2} color="#ffffff" opacity={0.9} seed={2} />
      <Drops paths={paths.fall2} per={3} speed={flowSpeed} size={0.013} stretch={3.5} color="#ffffff" opacity={0.9} seed={3} />
      <Drops paths={paths.fall1} per={3} speed={flowSpeed} size={0.015} stretch={3.5} color="#ffffff" opacity={0.9} seed={4} />
      <Drops paths={paths.splash2} per={2} speed={1.6} size={0.012} stretch={1.2} color="#ffffff" opacity={0.85} seed={5} />
      <Drops paths={paths.splash1} per={2} speed={1.6} size={0.014} stretch={1.2} color="#ffffff" opacity={0.85} seed={6} />
      {/* the surge: jets from the pool wall and a burst of spray up top */}
      <Drops paths={paths.jets} per={8} speed={1.3} size={0.018} stretch={3} color="#e6f6ff" opacity={0.95} active={jetsOn} seed={7} />
      <Particles geometry={geo.drop} count={24} life={1.0} origin={[0, SPOUT_Y + 0.3, 0]} spread={0.05} velocity={[0, 1.0, 0]} scatter={0.7} gravity={4} drift={0} size={[0.025, 0.018]} colors={['#ffffff', '#d8f0ff']} opacity={[1, 0.3]} active={g} seed={8} />
      <Burst tap={tap} geometry={geo.drop} count={18} colors={['#ffffff', '#cfeaff', L.water]} speed={1.4} gravity={4} size={0.03} life={1.0} origin={[0, POOL_Y + 0.05, 0]} spread={1.4} up={1.1} seed={9} />

      {/* an invisible core over the column, so a tap at the middle lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function FountainScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.5, 4.9]} target={[0, 0.85, 0]} hint="Water arcs from the spout, spills over each bowl in a falling sheet and the pool ripples on its own · tap it and the jets surge: the top spray shoots higher and jets arc in from the pool wall, then it settles · Look swaps stone, marble, terracotta and jade · drag to orbit">
      <Fountain {...props} />
    </Stage>
  )
}
