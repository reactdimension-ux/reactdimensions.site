import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Stage, TAU, Trail, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly black hole hanging in space: a faceted, perfectly dark sphere
// ringed by a thin, blazing photon ring, inside a wide, tilted accretion
// disk made of hundreds of glowing faceted chunks over a faint faceted
// sheet, white-hot at the inner edge and cooling to deep colour outside. A
// second ring of chunks always faces you, wrapped round the hole, like the
// far side of the disk bent up over the top by its gravity, and a scatter
// of distant stars twinkles behind. Left alone, the disk swirls, the inner
// chunks racing round far faster than the outer ones, and the photon ring
// shimmers. Tap it and a passing asteroid is caught: it spirals in, ever
// faster, stretching out along its path and trailing sparks, until it
// crosses the edge and vanishes in a bright flare.

const LOOKS = {
  amber: { hot: '#fff6dc', mid: '#ffb347', outer: '#e0561e', far: '#7a2410', ring: '#fff1c8', glow: '#ff9a3c', star: ['#ffffff', '#ffe9b8', '#ffd0a0'] },
  blue: { hot: '#f2fbff', mid: '#7fd6ff', outer: '#2f6bff', far: '#1a2a80', ring: '#e4f7ff', glow: '#4aa8ff', star: ['#ffffff', '#cfe6ff', '#a8d0ff'] },
  violet: { hot: '#fff0ff', mid: '#e494ff', outer: '#8a4cf0', far: '#3a1a80', ring: '#ffe8ff', glow: '#c070ff', star: ['#ffffff', '#f0d8ff', '#ffd0f0'] },
}

const CY = 1.05 // the hole's centre height
const RH = 0.3 // the event horizon
const R0 = 0.44 // the disk's inner edge
const R1 = 1.4 // and its outer edge
const NDISK = 800
const NLENS = 240
const FALL = 2.8 // seconds the asteroid takes to spiral in
const TILT = [0.24, 0, -0.1]
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))
const omega = (r) => 1.25 * (R0 / r) ** 1.5 // inner faster

// The disk colour at a share k (0 inner .. 1 outer) of the way out.
function diskColor(L, k, out) {
  const stops = [L.hot, L.mid, L.outer, L.far]
  const x = Math.min(0.999, Math.max(0, k)) * (stops.length - 1)
  const i = Math.floor(x)
  return out.set(stops[i]).lerp(new THREE.Color(stops[i + 1]), x - i)
}

// The asteroid's spiral, in the disk's own (tilted) frame.
const A0 = 2.4
const fallAngle = (u) => A0 + 6.2 * u ** 1.7
const fallR = (u) => RH + (2.2 - RH) * (1 - u) ** 1.25
const fallAt = (u, out) => {
  const a = fallAngle(u)
  const r = fallR(u)
  return out.set(Math.cos(a) * r, 0.42 * (1 - u) ** 2, Math.sin(a) * r)
}
const END = fallAt(1, new THREE.Vector3()).toArray()

const _o = new THREE.Object3D()
const _c = new THREE.Color()
const _q = new THREE.Quaternion()

export function BlackHole({ look = 'amber' }) {
  const L = LOOKS[look] || LOOKS.amber
  const { tap, handlers, clock } = useTap(1)
  const camera = useThree((s) => s.camera)
  const disk = useRef()
  const sheet = useRef()
  const lens = useRef()
  const bill = useRef()
  const ring = useRef()
  const halo = useRef()
  const rock = useRef()
  const flare = useRef()
  const twinkle = useRef([])
  const spin = useRef({ a: 0 })

  const geo = useGeo(
    () => ({
      hole: facet(new THREE.IcosahedronGeometry(RH, 2), 0.008, 3),
      chunk: new THREE.OctahedronGeometry(1, 0),
      ring: new THREE.TorusGeometry(RH * 1.17, 0.014, 4, 48),
      ring2: new THREE.TorusGeometry(RH * 1.3, 0.006, 3, 48),
      halo: new THREE.IcosahedronGeometry(1, 2),
      rock: facet(new THREE.DodecahedronGeometry(0.075, 0), 0.012, 9),
      flare: new THREE.IcosahedronGeometry(1, 1),
      star: new THREE.OctahedronGeometry(1, 0),
      spark: new THREE.TetrahedronGeometry(1, 0),
      hit: new THREE.SphereGeometry(1.0, 10, 6),
      // a faint faceted sheet under the chunks, each face its own shade
      sheet: (() => {
        const g = new THREE.RingGeometry(R0 * 0.95, R1 * 1.02, 40, 4).rotateX(-Math.PI / 2).toNonIndexed()
        const p = g.attributes.position
        const col = new Float32Array(p.count * 3)
        const r = rng(5)
        for (let f = 0; f < p.count; f += 3) {
          const d = Math.hypot(p.getX(f) + p.getX(f + 1) + p.getX(f + 2), p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3
          diskColor(L, (d - R0) / (R1 - R0), _c).multiplyScalar(0.75 + r() * 0.4)
          for (let j = 0; j < 3; j++) col.set([_c.r, _c.g, _c.b], (f + j) * 3)
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        return g
      })(),
      // distant stars: a shell of points
      stars: (() => {
        const r = rng(19)
        const pos = []
        for (let i = 0; i < 380; i++) {
          const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(7 + r() * 8)
          pos.push(v.x, Math.abs(v.y) * 0.9 + 0.5, v.z)
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
        return g
      })(),
    }),
    [look],
  )

  // disk chunks: denser and smaller towards the inside
  const D = useMemo(() => {
    const r = rng(11)
    return Array.from({ length: NDISK }, () => {
      const k = r() ** 1.5
      const rad = R0 + (R1 - R0) * k
      return { r: rad, k, a: r() * TAU, y: (r() - 0.5) * 0.05 * (0.4 + k), s: 0.011 + r() * 0.014 + k * 0.012, roll: r() * TAU, b: 0.75 + r() * 0.5, w: 0.9 + r() * 0.2 }
    })
  }, [])
  // the lensed ring that always faces the camera
  const LZ = useMemo(() => {
    const r = rng(29)
    return Array.from({ length: NLENS }, () => ({ a: r() * TAU, d: RH * 1.22 + r() ** 1.6 * 0.3, s: 0.008 + r() * 0.014, sp: 0.8 + r() * 0.6, b: 0.7 + r() * 0.5 }))
  }, [])
  // a few nearer, bigger stars that twinkle
  const TW = useMemo(() => {
    const r = rng(37)
    return Array.from({ length: 14 }, (_, i) => {
      const a = r() * TAU
      const d = 3 + r() * 2.5
      return { p: [Math.cos(a) * d, 0.6 + r() * 2.6, Math.sin(a) * d], s: 0.025 + r() * 0.03, ph: r() * TAU, rate: 1 + r() * 2, c: L.star[i % 3] }
    })
  }, [L])

  useEffect(() => {
    const m = disk.current
    D.forEach((p, i) => m.setColorAt(i, diskColor(L, p.k, _c).multiplyScalar(p.b)))
    m.instanceColor.needsUpdate = true
  }, [L, D])

  const flareKick = useMemo(() => ({ since: (t) => tap.since(t) - FALL }), [tap])
  const onClick = (e) => {
    e.stopPropagation()
    if (tap.since(clock.elapsedTime) > FALL + 1.2) tap.kick(clock.elapsedTime)
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const f = s - FALL // seconds since the flare
    const flash = f >= 0 ? Math.exp(-f * 3.5) : 0
    // the disk speeds up a little while it is fed
    spin.current.a += Math.min(dt, 0.05) * (1 + 1.2 * flash)
    const A = spin.current.a
    const m = disk.current
    D.forEach((p, i) => {
      const a = p.a + A * omega(p.r) * p.w
      _o.position.set(Math.cos(a) * p.r, p.y, Math.sin(a) * p.r)
      _o.rotation.set(0, -a, p.roll + A * 2)
      _o.scale.set(p.s, p.s * 0.7, p.s * (2 + (1 - p.k) * 2.5))
      _o.updateMatrix()
      m.setMatrixAt(i, _o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    sheet.current.rotation.y = -A * 0.35
    // the lensed ring faces the camera, its top arc brightest
    bill.current.quaternion.copy(camera.quaternion)
    const lz = lens.current
    LZ.forEach((p, i) => {
      const a = p.a + A * p.sp * 1.6
      const up = Math.sin(a)
      _o.position.set(Math.cos(a) * p.d, up * p.d * 1.08, 0.02)
      _o.rotation.set(0, 0, a + Math.PI / 2)
      _o.scale.set(p.s * 3, p.s, p.s)
      _o.updateMatrix()
      lz.setMatrixAt(i, _o.matrix)
      lz.setColorAt(i, diskColor(L, 0.15 + (p.d - RH * 1.22) * 2, _c).multiplyScalar(p.b * (0.55 + 0.5 * Math.max(0, up)) * (1 + 1.5 * flash)))
    })
    lz.instanceMatrix.needsUpdate = true
    lz.instanceColor.needsUpdate = true
    // the photon ring shimmers and blazes on the flare
    const sh = 1 + 0.06 * Math.sin(t * 7) + 0.04 * Math.sin(t * 13.3)
    ring.current.scale.setScalar(sh * (1 + 0.25 * flash))
    halo.current.children.forEach((h, i) => {
      h.material.opacity = (0.07 + 0.03 * Math.sin(t * 1.3 + i)) * (1 + 3 * flash)
      h.scale.setScalar((RH * (1.5 + i * 0.45)) * (1 + 0.3 * flash))
    })
    // the asteroid's fall
    const R = rock.current
    R.visible = s >= 0 && s < FALL
    if (R.visible) {
      const u = s / FALL
      const e = u * 0.4 + ease(u) * 0.6
      fallAt(e, R.position)
      const st = e ** 3
      R.rotation.set(s * 3, -fallAngle(e), s * 2)
      R.scale.set(1 - 0.55 * st, 1 - 0.55 * st, 1 + 4 * st).multiplyScalar(Math.min(1, s * 4) * (1 - 0.75 * e ** 6))
    }
    const F = flare.current
    F.visible = f >= 0 && f < 0.9
    if (F.visible) {
      F.parent.getWorldQuaternion(_q).invert()
      F.quaternion.copy(_q).multiply(camera.quaternion)
      F.scale.setScalar(0.06 + Math.sqrt(f) * 0.3)
      const fade = 1 - f / 0.9
      F.children.forEach((c, i) => {
        c.material.opacity = i === 0 ? fade ** 1.5 : i === 1 ? 0.5 * fade ** 2 : 0.9 * fade
        if (i > 1) c.rotation.z = ((i - 2) * Math.PI) / 4 + f * 0.8
      })
    }
    twinkle.current.forEach((m, i) => {
      if (!m) return
      const p = TW[i]
      m.scale.setScalar(p.s * (0.6 + 0.4 * Math.sin(t * p.rate + p.ph)))
      m.rotation.y = t * 0.5 + p.ph
    })
  })

  return (
    <group {...handlers} onClick={onClick}>
      <points geometry={geo.stars}>
        <pointsMaterial color={L.star[1]} size={0.05} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
      </points>
      {TW.map((p, i) => (
        <mesh key={i} ref={(el) => (twinkle.current[i] = el)} geometry={geo.star} position={p.p} scale={[p.s, p.s * 1.6, p.s]}>
          <meshBasicMaterial color={p.c} toneMapped={false} />
        </mesh>
      ))}
      <group position-y={CY}>
        {/* the hole itself: no light escapes */}
        <mesh geometry={geo.hole}>
          <meshStandardMaterial color="#030305" roughness={0.55} metalness={0.6} flatShading />
        </mesh>
        {/* a soft glow round it */}
        <group ref={halo}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={geo.halo} renderOrder={1}>
              <meshBasicMaterial color={L.glow} transparent opacity={0.08} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
            </mesh>
          ))}
        </group>
        {/* the photon ring and the lensed far side, always facing you */}
        <group ref={bill}>
          <group ref={ring}>
            <mesh geometry={geo.ring}>
              <meshBasicMaterial color={L.ring} toneMapped={false} />
            </mesh>
            <mesh geometry={geo.ring2}>
              <meshBasicMaterial color={L.mid} toneMapped={false} transparent opacity={0.8} />
            </mesh>
          </group>
          <instancedMesh ref={lens} args={[geo.chunk, undefined, NLENS]} frustumCulled={false}>
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </instancedMesh>
        </group>
        {/* the accretion disk */}
        <group rotation={TILT}>
          <mesh ref={sheet} geometry={geo.sheet} renderOrder={2}>
            <meshBasicMaterial vertexColors transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <instancedMesh ref={disk} args={[geo.chunk, undefined, NDISK]} frustumCulled={false}>
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </instancedMesh>
          {/* the asteroid and its flare */}
          <group ref={rock} visible={false}>
            <mesh geometry={geo.rock}>
              <meshStandardMaterial color="#8a7a6a" flatShading roughness={0.9} emissive={L.glow} emissiveIntensity={0.15} />
            </mesh>
          </group>
          <Trail target={rock} count={22} every={0.025} color={L.mid} size={0.035} grow={-0.02} opacity={0.8} active={() => tap.since(clock.elapsedTime) < FALL} />
          <group ref={flare} position={END} visible={false}>
            <mesh geometry={geo.flare} renderOrder={6}>
              <meshBasicMaterial color={L.hot} transparent opacity={0} blending={THREE.AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh geometry={geo.flare} scale={1.9} renderOrder={5}>
              <meshBasicMaterial color={L.mid} transparent opacity={0} blending={THREE.AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* a four-pointed glint, turned to face you */}
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} geometry={geo.star} rotation-z={(i * Math.PI) / 4} scale={i % 2 ? [0.07, 1.5, 0.07] : [0.1, 3, 0.1]} renderOrder={7}>
                <meshBasicMaterial color={L.ring} transparent opacity={0} blending={THREE.AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false} />
              </mesh>
            ))}
          </group>
          <Burst tap={flareKick} geometry={geo.spark} count={18} colors={[L.ring, L.mid, L.hot]} speed={1.3} gravity={0} size={0.04} life={0.9} origin={END} spread={1} up={0.7} />
        </group>
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    </group>
  )
}

export default function BlackHoleScene({ background = '#0b0c16', autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 1.75, 4.6]} target={[0, 1.0, 0]} hint="The accretion disk swirls, its inner edge racing round far faster than the outside, while the light from its far side bends up over the hole · tap it and a passing asteroid spirals in, stretches out and vanishes in a flare · Look swaps amber, blue and violet · drag to orbit">
      <BlackHole {...props} />
    </Stage>
  )
}
