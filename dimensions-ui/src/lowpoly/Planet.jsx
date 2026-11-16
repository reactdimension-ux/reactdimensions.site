import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly ringed planet hanging above the floor: a faceted globe striped
// with bands of colour by latitude, tipped on its axis, and round it a
// tilted ring of small rocks. Left alone, the planet turns slowly and the
// ring rocks drift round it, each tumbling on its own. Tap it and a little
// moon swings once round the planet on a wide arc, with a sparkle as it
// appears, and fades away again.

const LOOKS = {
  saturn: { bands: ['#e8cf9a', '#d9b071', '#f2e2bb', '#c8945a', '#e6c48a', '#b98450'], rock: ['#d8c4a0', '#b8a07a', '#efe2c6'], moon: '#d9d6cf', spark: ['#fff6d8', '#ffd98a'] },
  ice: { bands: ['#dff1fb', '#a9d6ee', '#f4fbff', '#7fbfe0', '#c4e5f5', '#6aa9d0'], rock: ['#e8f6ff', '#b6dcf0', '#ffffff'], moon: '#cfd8e0', spark: ['#ffffff', '#bfe9ff'] },
  violet: { bands: ['#c9a6ec', '#9d6fd4', '#e2cdf6', '#7a4fb8', '#b48ae0', '#e88fc6'], rock: ['#d6c2f0', '#a888d6', '#f3c4e4'], moon: '#d8d2e2', spark: ['#ffffff', '#f6c0ff'] },
  ember: { bands: ['#ff9a4a', '#d9502a', '#ffc46e', '#a8321e', '#f27a3a', '#6e2418'], rock: ['#5a3a30', '#8a4a32', '#ffb35a'], moon: '#b9aea6', spark: ['#fff0b0', '#ff9a3c'] },
}

const CY = 1.0 // the planet's centre height
const R = 0.52 // planet radius
const ROCKS = 110
const MOON_T = 2.6 // seconds the moon takes to swing round

// The globe: an icosphere, faceted, each face coloured by the band its
// centre falls in (banded by latitude, with a wavy edge).
function planetGeometry(bands) {
  const g = facet(new THREE.IcosahedronGeometry(R, 3), R * 0.025, 4).toNonIndexed()
  g.computeVertexNormals()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  const r = rng(8)
  for (let f = 0; f < p.count; f += 3) {
    const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3
    const x = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3
    const z = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3
    const lat = y / R + 0.025 * Math.sin(Math.atan2(z, x) * 3)
    const k = Math.min(bands.length - 1, Math.floor(Math.abs(lat) * bands.length * 0.999))
    c.set(bands[(k + (lat < 0 ? 1 : 0)) % bands.length]).multiplyScalar(0.98 + r() * 0.04)
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

const _o = new THREE.Object3D()

export function Planet({ look = 'saturn' }) {
  const L = LOOKS[look] || LOOKS.saturn
  const { tap, handlers, clock } = useTap(1.2)
  const globe = useRef()
  const ring = useRef()
  const rocks = useRef()
  const moon = useRef()
  const planet = useGeo(() => planetGeometry(L.bands), [look])
  const geo = useGeo(
    () => ({
      rock: new THREE.DodecahedronGeometry(1, 0),
      moon: blob(0.11, 21, 1),
      crater: new THREE.IcosahedronGeometry(1, 0),
      star: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )
  // each rock: its distance out, angle round, height off the ring plane,
  // size and its own tumble
  const R0 = useMemo(() => {
    const r = rng(17)
    return Array.from({ length: ROCKS }, (_, i) => ({
      d: 0.78 + r() * 0.36 + (i % 3 === 0 ? 0.05 : 0),
      a: (i / ROCKS) * TAU + r() * 0.08,
      y: (r() - 0.5) * 0.04,
      s: 0.018 + r() ** 2 * 0.04,
      sp: [r() * 3 - 1.5, r() * 3 - 1.5, r() * 3 - 1.5],
      ph: r() * TAU,
    }))
  }, [])
  useEffect(() => {
    const m = rocks.current
    const c = new THREE.Color()
    R0.forEach((b, i) => m.setColorAt(i, c.set(L.rock[i % L.rock.length])))
    m.instanceColor.needsUpdate = true
  }, [L, R0])

  // the moon's path: one loop round the planet on a tipped circle
  const moonAt = (u, v) => {
    const a = Math.PI * 0.3 + u * TAU
    const rr = 1.45
    return v.set(Math.cos(a) * rr, Math.sin(a) * rr * 0.35 + Math.sin(u * Math.PI) * 0.15, Math.sin(a) * rr)
  }
  const start = useMemo(() => moonAt(0, new THREE.Vector3()).add(new THREE.Vector3(0, CY, 0)).toArray(), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const t = clock.elapsedTime
    globe.current.rotation.y = t * 0.25
    // the ring rocks: orbit (inner ones faster) and tumble
    const m = rocks.current
    R0.forEach((b, i) => {
      const a = b.a + t * (0.32 / b.d)
      _o.position.set(Math.cos(a) * b.d, b.y + Math.sin(t * 0.8 + b.ph) * 0.01, Math.sin(a) * b.d)
      _o.rotation.set(t * b.sp[0] + b.ph, t * b.sp[1], t * b.sp[2])
      _o.scale.setScalar(b.s)
      _o.updateMatrix()
      m.setMatrixAt(i, _o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    ring.current.rotation.y = Math.sin(t * 0.2) * 0.02
    // the moon, only for a while after a tap
    const s = tap.since(t)
    const mo = moon.current
    mo.visible = s >= 0 && s < MOON_T
    if (mo.visible) {
      const u = s / MOON_T
      const e = u * u * (3 - 2 * u) * 0.6 + u * 0.4 // quick out, slower round the back
      moonAt(e, mo.position)
      mo.position.y += CY
      mo.rotation.set(s * 1.4, s * 2, 0)
      mo.scale.setScalar(Math.max(0.001, Math.min(1, s * 5, (MOON_T - s) * 3)))
    }
  })

  return (
    <group {...handlers}>
      <group position-y={CY} rotation={[0.42, 0, -0.22]}>
        <mesh ref={globe} geometry={planet}>
          <Flat vertexColors color="#ffffff" roughness={0.7} />
        </mesh>
        {/* the ring, tipped with the planet's axis */}
        <group ref={ring}>
          <instancedMesh ref={rocks} args={[geo.rock, undefined, ROCKS]} frustumCulled={false}>
            <Flat color="#ffffff" roughness={0.8} />
          </instancedMesh>
        </group>
      </group>
      {/* the moon, with a couple of craters */}
      <group ref={moon} visible={false}>
        <mesh geometry={geo.moon}>
          <Flat color={L.moon} />
        </mesh>
        {[
          [0.07, 0.06, 0.06],
          [-0.06, -0.02, 0.08],
          [0.02, -0.08, -0.07],
        ].map((p, i) => (
          <mesh key={i} geometry={geo.crater} position={p} scale={0.03}>
            <Flat color={new THREE.Color(L.moon).multiplyScalar(0.72)} />
          </mesh>
        ))}
      </group>
      <Burst tap={tap} geometry={geo.star} count={14} colors={L.spark} speed={1.1} gravity={0} size={0.045} life={0.9} origin={start} spread={1} up={0.6} />
    </group>
  )
}

export default function PlanetScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.4, 4.6]} target={[0, 1, 0]} hint="The planet turns slowly while its ring of rocks orbits and tumbles · tap it and a little moon swings once round the planet with a sparkle · Look swaps saturn, ice, violet and ember · drag to orbit">
      <Planet {...props} />
    </Stage>
  )
}
