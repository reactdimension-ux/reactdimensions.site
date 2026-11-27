import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// Shared parts of the low-poly motion-graphics set: faceting, the stage, the
// pop-in and float every model enters with, and the "i" usage hint.

export function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Knock a primitive's vertices about a little so its faces catch the light
// at different angles: the hand-modelled low-poly look. Vertices that share a
// position move together, so the surface never tears at a seam. axes scales
// the jitter per axis; keep(x, y, z) can pin vertices (a flat base, say).
export function facet(geo, amt = 0.05, seed = 1, axes = [1, 1, 1], keep) {
  const p = geo.attributes.position
  const r = rng(seed)
  const off = new Map()
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    if (keep && keep(x, y, z)) continue
    // (+ 0 folds -0 into 0, so a seam's two copies share one key)
    const k = `${(Math.round(x * 1000) + 0) / 1000},${(Math.round(y * 1000) + 0) / 1000},${(Math.round(z * 1000) + 0) / 1000}`
    let o = off.get(k)
    if (!o) off.set(k, (o = [(r() - 0.5) * 2 * amt * axes[0], (r() - 0.5) * 2 * amt * axes[1], (r() - 0.5) * 2 * amt * axes[2]]))
    p.setXYZ(i, x + o[0], y + o[1], z + o[2])
  }
  geo.computeVertexNormals()
  return geo
}

// Geometry built once and disposed with the component.
export function useGeo(make, deps = []) {
  const g = useMemo(make, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      const all = g instanceof THREE.BufferGeometry ? [g] : Object.values(g).flat()
      all.forEach((x) => x?.dispose?.())
    },
    [g],
  )
  return g
}

// A flat-shaded, matt material: every facet one even tone.
export function Flat({ color, ...props }) {
  return <meshStandardMaterial color={color} flatShading roughness={0.82} metalness={0} {...props} />
}

// Every model springs in from nothing, overshoots a touch, settles, and then
// floats: a slow bob and sway, so the shot is never quite still.
function Presenter({ float, children }) {
  const g = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const k = 1 - Math.exp(-5.5 * t) * Math.cos(8 * t)
    g.current.scale.setScalar(Math.max(0.001, k))
    g.current.position.y = float ? 0.1 + Math.sin(t * 1.3) * 0.07 : 0
    g.current.rotation.z = float ? Math.sin(t * 0.9) * 0.025 : 0
    g.current.rotation.x = float ? Math.sin(t * 0.7 + 1) * 0.02 : 0
  })
  return <group ref={g}>{children}</group>
}

// Soft studio: a bright key from above front, a cool rim from behind, sky
// and ground fill, and a soft contact shadow on an endless pale floor.
// overlay is optional HTML laid over the canvas (a live readout, say).
export function Stage({ background = '#eceaf1', autoRotate = true, float = true, hint, overlay, camera = [3.4, 2.3, 4.6], target = [0, 0.9, 0], children }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas dpr={[1, 1.75]} camera={{ position: camera, fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#b8b2c8', 1.1]} />
        <directionalLight position={[3, 6, 5]} intensity={2.2} />
        <directionalLight position={[-5, 3, -4]} intensity={0.8} color="#d6deff" />
        <Presenter float={float}>{children}</Presenter>
        <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={7} blur={2.4} far={3} resolution={512} color="#2a2440" />
        <OrbitControls makeDefault enablePan={false} target={target} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={2.5} maxDistance={12} maxPolarAngle={1.5} />
      </Canvas>
      {overlay}
      {hint && <InfoHint>{hint}</InfoHint>}
    </div>
  )
}

// The usage tips live behind a small "i" button in the corner: hover it (or
// tap it) to read them.
export function InfoHint({ children }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hover || pinned
  return (
    <div
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
      style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 'calc(100% - 24px)' }}
    >
      {open && (
        <div role="tooltip" style={{ maxWidth: 340, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.06)', font: '500 11px/1.6 ui-monospace, Menlo, monospace', letterSpacing: '0.03em', color: '#2a2925', textAlign: 'left' }}>
          {children}
        </div>
      )}
      <button
        type="button"
        aria-label="How to use"
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        style={{ width: 30, height: 30, padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: open ? '#1c1a16' : 'rgba(255,255,255,0.88)', color: open ? '#f4f1ea' : '#2a2925', font: 'italic 700 15px/1 Georgia, "Times New Roman", serif', boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)' }}
      >
        i
      </button>
    </div>
  )
}

// A decaying kick, for tap reactions: call kick() to start it, read it each
// frame with value(t) (1 at the tap, easing to 0).
export function useKick(decay = 2.5) {
  const k = useRef({ t0: -99 })
  return useMemo(
    () => ({
      kick: (t) => (k.current.t0 = t),
      value: (t) => Math.exp(-decay * Math.max(0, t - k.current.t0)) * (t >= k.current.t0 ? 1 : 0),
      since: (t) => t - k.current.t0,
    }),
    [decay],
  )
}

// ---- Shared parts for the level 1 set (see docs/lowpoly/lowpoly-level-1-easy.md) ----

export const TAU = Math.PI * 2

// A faceted icosphere and a faceted cone standing on its base.
export const blob = (r, seed, detail = 1) => facet(new THREE.IcosahedronGeometry(r, detail), r * 0.06, seed)
export const cone = (r, h, n, seed) => facet(new THREE.ConeGeometry(r, h, n, 1).translate(0, h / 2, 0), r * 0.08, seed)

// A 0..1 sine at rate cycles a second, offset by phase (radians).
export const pulse = (t, rate = 1, phase = 0) => 0.5 + 0.5 * Math.sin(t * rate * TAU + phase)

// The tap plumbing every model shares: a decaying kick, the pointer cursor
// on hover and the handlers to spread on the model's root group.
export function useTap(decay = 1.5) {
  const clock = useThree((s) => s.clock)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tap = useKick(decay)
  const handlers = {
    onClick: (e) => {
      e.stopPropagation()
      tap.kick(clock.elapsedTime)
    },
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }
  return { tap, handlers, clock }
}

// A spray of faceted bits thrown out from origin on each tap: they fly,
// tumble, shrink and fall (or drift up, with a negative gravity). Pass a
// geometry to throw stars, petals or leaves instead of chips.
export function Burst({ tap, geometry, count = 14, colors = ['#ffffff'], speed = 2.2, gravity = 5, size = 0.07, life = 1.1, origin = [0, 0.8, 0], spread = 1, up = 1, seed = 3 }) {
  const clock = useThree((s) => s.clock)
  const refs = useRef([])
  const chip = useGeo(() => new THREE.TetrahedronGeometry(1, 0), [])
  const bits = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: count }, (_, i) => {
      const a = r() * TAU
      const e = 0.35 + r() * 0.9
      const h = (0.5 + r()) * spread
      return { v: [Math.cos(a) * Math.cos(e) * h, Math.sin(e) * (0.6 + r() * 0.8) * up, Math.sin(a) * Math.cos(e) * h], s: 0.6 + r() * 0.8, spin: [(r() - 0.5) * 12, (r() - 0.5) * 12], c: colors[i % colors.length] }
    })
  }, [count, seed, up, spread, colors.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const s = tap.since(clock.elapsedTime)
    bits.forEach((b, i) => {
      const m = refs.current[i]
      if (!m) return
      m.visible = s >= 0 && s < life
      if (!m.visible) return
      m.position.set(origin[0] + b.v[0] * speed * s, origin[1] + b.v[1] * speed * s - 0.5 * gravity * s * s, origin[2] + b.v[2] * speed * s)
      m.scale.setScalar(Math.max(0.001, size * b.s * (1 - (s / life) ** 2)))
      m.rotation.set(s * b.spin[0], s * b.spin[1], 0)
    })
  })
  return (
    <group>
      {bits.map((b, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geometry || chip} visible={false}>
          <Flat color={b.c} emissive={b.c} emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  )
}

// Rings that spread across the floor and fade: on each tap, or on a loop
// every period seconds when loop is set.
export function Ripple({ tap, loop = false, period = 1.8, count = 2, color = '#ffffff', radius = 1.5, life = 1.2, y = 0.01, opacity = 0.55 }) {
  const clock = useThree((s) => s.clock)
  const refs = useRef([])
  const ring = useGeo(() => new THREE.RingGeometry(0.86, 1, 24, 1).rotateX(-Math.PI / 2), [])
  useFrame(() => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const u = loop ? ((t / period + i / count) % 1) : (tap.since(t) - i * 0.16) / life
      m.visible = u >= 0 && u < 1
      if (!m.visible) return
      m.scale.setScalar(0.15 + u * radius)
      m.material.opacity = opacity * (1 - u) ** 1.5
    })
  })
  return (
    <group position-y={y}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={ring} visible={false}>
          <meshBasicMaterial color={color} transparent depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

// A group that turns steadily and whirls faster for a moment on a tap.
export function Spin({ tap, rate = 0.5, boost = 9, axis = 'y', children, ...props }) {
  const g = useRef()
  const clock = useThree((s) => s.clock)
  const a = useRef(0)
  useFrame((_, dt) => {
    const k = tap ? tap.value(clock.elapsedTime) : 0
    a.current += Math.min(dt, 0.05) * (rate + boost * k)
    g.current.rotation[axis] = a.current
  })
  return (
    <group ref={g} {...props}>
      {children}
    </group>
  )
}

// ---- Shared parts for the level 2 set (see docs/lowpoly/lowpoly-level-2-simple.md) ----

// The angle of link i in a swaying chain: each link a beat behind the one
// below it, so a trunk, frond or scarf bends like a whip.
export const swayAngle = (t, i = 0, { rate = 0.5, amp = 0.05, lag = 0.4 } = {}) => amp * Math.sin(t * rate * TAU - i * lag)

// A damped wobble after a tap: 0 at rest, swinging about +-1 and dying away.
// Pass the seconds since the tap.
export const wobble = (s, rate = 14, decay = 3) => (s >= 0 ? Math.exp(-decay * s) * Math.sin(s * rate) : 0)

// Volume-keeping squash: k > 0 flattens and widens, k < 0 stretches.
export function squash(obj, k, base = 1) {
  obj.scale.set(base * (1 + k * 0.5), base * (1 - k), base * (1 + k * 0.5))
}

// A group that sways about one axis. Nest them with a rising i for a lag
// chain. kick (a useKick) adds a shake that runs up the chain on a tap.
// It owns rotation[axis]: set any fixed bend on a parent group instead.
export function Sway({ i = 0, rate = 0.5, amp = 0.05, lag = 0.4, axis = 'z', kick, kickAmp = 0, children, ...props }) {
  const g = useRef()
  const clock = useThree((s) => s.clock)
  useFrame(() => {
    const t = clock.elapsedTime
    let a = swayAngle(t, i, { rate, amp, lag })
    if (kick && kickAmp) a += kickAmp * wobble(kick.since(t - i * 0.05), 13, 2.4)
    g.current.rotation[axis] = a
  })
  return (
    <group ref={g} {...props}>
      {children}
    </group>
  )
}

// A pivot that swings to angle when open and back when shut, on a spring
// that overshoots and settles. Put the group on the hinge line. open is a
// boolean, a 0..1 amount, or a function returning either (read every frame,
// so a tap can open it without a re-render).
export function Hinge({ open = false, angle = -1.9, axis = 'x', stiffness = 90, damping = 9, children, ...props }) {
  const g = useRef()
  const st = useRef({ x: 0, v: 0 })
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.033)
    const o = typeof open === 'function' ? open() : open
    const target = angle * (o === true ? 1 : o === false ? 0 : o)
    const s = st.current
    s.v += ((target - s.x) * stiffness - s.v * damping) * d
    s.x += s.v * d
    g.current.rotation[axis] = s.x
  })
  return (
    <group ref={g} {...props}>
      {children}
    </group>
  )
}

// A soft cone of light from the origin along +z, for lamps, lighthouses and
// flashes. The ref is the mesh, so a scene can drive material.opacity.
export const Beam = forwardRef(function Beam({ length = 2, radius = 0.5, color = '#fff3c4', opacity = 0.3, ...props }, ref) {
  const geo = useGeo(() => {
    const g = new THREE.ConeGeometry(radius, length, 10, 4, true).translate(0, -length / 2, 0).rotateX(-Math.PI / 2)
    // fade the light out along its length, with vertex alpha
    const p = g.attributes.position
    const c = new Float32Array(p.count * 4)
    for (let i = 0; i < p.count; i++) c.set([1, 1, 1, (1 - p.getZ(i) / length) ** 1.6], i * 4)
    g.setAttribute('color', new THREE.BufferAttribute(c, 4))
    return g
  }, [length, radius])
  return (
    <mesh ref={ref} geometry={geo} {...props}>
      <meshBasicMaterial color={color} vertexColors transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
})

// A simple face: two eyes that blink now and then and a mouth (smile, o,
// flat, dots for coal, or none). Place the group just in front of the
// surface it sits on; it faces +z.
export function Face({ spacing = 0.12, size = 0.035, color = '#1b1a22', mouth = 'smile', mouthWidth = 0.1, mouthY = -0.08, blinkEvery = 3.6, phase = 0, ...props }) {
  const clock = useThree((s) => s.clock)
  const eyes = useRef([])
  const geo = useGeo(() => ({ eye: new THREE.IcosahedronGeometry(1, 0), smile: new THREE.TorusGeometry(1, 0.2, 3, 7, Math.PI).rotateZ(Math.PI), bar: new THREE.BoxGeometry(1, 0.25, 0.25) }), [])
  useFrame(() => {
    const b = (clock.elapsedTime + phase) % blinkEvery
    const s = b < 0.12 ? 0.15 : 1
    eyes.current.forEach((e) => e && (e.scale.y = size * 1.2 * s))
  })
  const w = mouthWidth / 2
  return (
    <group {...props}>
      {[-1, 1].map((x, i) => (
        <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.eye} position={[(x * spacing) / 2, 0, 0]} scale={[size, size * 1.2, size * 0.6]}>
          <Flat color={color} roughness={0.35} />
        </mesh>
      ))}
      {mouth === 'smile' && (
        <mesh geometry={geo.smile} position-y={mouthY + w * 0.6} scale={[w, w, w]}>
          <Flat color={color} roughness={0.35} />
        </mesh>
      )}
      {mouth === 'o' && (
        <mesh geometry={geo.eye} position-y={mouthY} scale={[w * 0.5, w * 0.6, size * 0.5]}>
          <Flat color={color} roughness={0.35} />
        </mesh>
      )}
      {mouth === 'flat' && (
        <mesh geometry={geo.bar} position-y={mouthY} scale={[mouthWidth, mouthWidth, mouthWidth]}>
          <Flat color={color} roughness={0.35} />
        </mesh>
      )}
      {mouth === 'dots' &&
        [-2, -1, 0, 1, 2].map((k) => (
          <mesh key={k} geometry={geo.eye} position={[k * w * 0.45, mouthY - (1 - (k / 2) ** 2) * w * 0.35, 0]} scale={size * 0.55}>
            <Flat color={color} roughness={0.35} />
          </mesh>
        ))}
    </group>
  )
}

// ---- Shared parts for the level 3 set (see docs/lowpoly/lowpoly-level-3-medium.md) ----

const read = (v) => (typeof v === 'function' ? v() : v)

// A continuous stream of faceted bits: embers, smoke, rain, snow, bubbles.
// Each particle loops through its life on its own offset, rising with
// velocity, falling with gravity, drifting sideways, growing from size[0]
// to size[1] and fading from opacity[0] to opacity[1]. active (0..1, or a
// function returning it) thins or stops the stream.
export function Particles({ count = 16, life = 2, origin = [0, 0, 0], spread = 0.1, velocity = [0, 0.6, 0], scatter = 0.3, gravity = 0, drift = 0.15, size = [0.05, 0.12], colors = ['#ffffff'], opacity = [0.9, 0], emissive = 0, geometry, active = 1, spin = 2, seed = 1 }) {
  const clock = useThree((s) => s.clock)
  const refs = useRef([])
  const ico = useGeo(() => new THREE.IcosahedronGeometry(1, 0), [])
  const P = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: count }, (_, i) => ({ off: i / count, jx: (r() - 0.5) * 2 * spread, jz: (r() - 0.5) * 2 * spread, vx: (r() - 0.5) * 2 * scatter, vz: (r() - 0.5) * 2 * scatter, vs: 0.7 + r() * 0.6, ph: r() * TAU, gate: r(), c: colors[i % colors.length] }))
  }, [count, seed, spread, scatter, colors.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const t = clock.elapsedTime
    const a = read(active)
    P.forEach((p, i) => {
      const m = refs.current[i]
      if (!m) return
      m.visible = p.gate < a
      if (!m.visible) return
      const u = (t / life + p.off) % 1
      const age = u * life
      m.position.set(
        origin[0] + p.jx + (velocity[0] + p.vx) * age * p.vs + Math.sin(age * 2 + p.ph) * drift * u,
        origin[1] + velocity[1] * age * p.vs - 0.5 * gravity * age * age,
        origin[2] + p.jz + (velocity[2] + p.vz) * age * p.vs + Math.cos(age * 1.7 + p.ph) * drift * u,
      )
      m.scale.setScalar(Math.max(0.001, size[0] + (size[1] - size[0]) * u))
      m.rotation.set(age * spin + p.ph, age * spin * 0.7, 0)
      m.material.opacity = opacity[0] + (opacity[1] - opacity[0]) * u
    })
  })
  return (
    <group>
      {P.map((p, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geometry || ico}>
          <meshStandardMaterial color={p.c} emissive={p.c} emissiveIntensity={emissive} flatShading roughness={0.8} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// A flickering low-poly flame: three nested cones (outer, middle, core) that
// stretch and twist on their own beats, with a point light that flickers
// with them. power (or a function returning it) scales the height.
export function Flame({ size = 1, colors = ['#ff6a1f', '#ffb52e', '#fff3b0'], power = 1, phase = 0, light = true, ...props }) {
  const clock = useThree((s) => s.clock)
  const parts = useRef([])
  const lamp = useRef()
  const geo = useGeo(() => new THREE.ConeGeometry(1, 1, 5, 1).translate(0, 0.5, 0), [])
  useFrame(() => {
    const t = clock.elapsedTime + phase
    const pw = read(power)
    parts.current.forEach((m, i) => {
      if (!m) return
      const f = 1 + 0.18 * Math.sin(t * (9 + i * 3.1) + i) + 0.1 * Math.sin(t * (15.7 + i * 2) + i * 2)
      const r = size * [0.22, 0.15, 0.08][i]
      m.scale.set(r * (1 + 0.1 * Math.sin(t * 7 + i)), Math.max(0.001, size * [0.75, 0.55, 0.32][i] * pw * f), r)
      m.rotation.y = t * (0.6 + i * 0.4)
      m.rotation.z = Math.sin(t * 3 + i) * 0.08
    })
    if (lamp.current) lamp.current.intensity = 2.2 * size * pw * (0.85 + 0.15 * Math.sin(t * 13))
  })
  return (
    <group {...props}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (parts.current[i] = el)} geometry={geo}>
          <meshStandardMaterial color={colors[i]} emissive={colors[i]} emissiveIntensity={1.3} flatShading transparent opacity={[0.85, 0.92, 1][i]} depthWrite={false} />
        </mesh>
      ))}
      {light && <pointLight ref={lamp} color={colors[1]} distance={3 * size + 1} decay={2} position-y={0.4 * size} />}
    </group>
  )
}

// A polar grid: a centre point and rings of segs points out to radius, the
// height of each from y(u, angle, ring) where u runs 0 (centre) to 1 (rim).
// Faces point up. Alternate rings are turned half a step for a triangle mesh.
export function polarGrid(radius, rings, segs, y = () => 0, jitter = 0, seed = 1) {
  const r = rng(seed)
  const pos = [0, y(0, 0, 0), 0]
  for (let k = 1; k <= rings; k++) {
    const u = k / rings
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * TAU + ((k % 2) * Math.PI) / segs
      const rr = radius * u * (1 + (k < rings ? (r() - 0.5) * jitter : 0))
      pos.push(Math.cos(a) * rr, y(u, a, k), Math.sin(a) * rr)
    }
  }
  const idx = []
  const at = (k, s) => (k === 0 ? 0 : 1 + (k - 1) * segs + (((s % segs) + segs) % segs))
  for (let s = 0; s < segs; s++) idx.push(0, at(1, s + 1), at(1, s))
  for (let k = 2; k <= rings; k++)
    for (let s = 0; s < segs; s++) {
      idx.push(at(k - 1, s), at(k, s + 1), at(k, s))
      idx.push(at(k - 1, s), at(k - 1, s + 1), at(k, s + 1))
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Faceted ground: a peak, dome, mesa or crater with a flat rim at y = 0, roughened
// by seed, each face coloured by height from bands [[from 0..1, colour]].
// Use it with <Flat vertexColors color="#ffffff" />.
// The height profile (0..1) of a terrain shape at u = distance / radius, so a
// scene can find the ground under a falling rock or a flowing stream.
export const terrainShape = (profile) => (u) =>
  profile === 'dome' ? 1 - u * u : profile === 'mesa' ? (u < 0.55 ? 1 : 1 - ((u - 0.55) / 0.45) ** 1.4) : profile === 'crater' ? (u < 0.2 ? 0.74 + 0.26 * (u / 0.2) ** 2 : ((1 - u) / 0.8) ** 1.15) : (1 - u) ** 1.25

export function terrainGeo({ radius = 1, height = 1, seed = 1, rings = 5, segs = 12, rough = 0.15, profile = 'peak', bands = [[0, '#6fb04f']] }) {
  const r = rng(seed + 99)
  const shape = terrainShape(profile)
  const g = polarGrid(radius, rings, segs, (u, a, k) => (k === rings ? 0 : height * shape(u) * (1 + (r() - 0.5) * rough * 2)), rough, seed).toNonIndexed()
  g.computeVertexNormals()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let f = 0; f < p.count; f += 3) {
    const h = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3 / height
    let pick = bands[0][1]
    for (const [from, color] of bands) if (h >= from) pick = color
    c.set(pick).multiplyScalar(0.94 + r() * 0.12)
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// A round of faceted water whose surface rolls in slow waves (the rim stays
// put), with a darker band round its edge.
export function Water({ radius = 1.4, rings = 5, segs = 20, color = '#4aa3d8', edge = '#2f7fb0', amp = 0.025, speed = 1, opacity = 1, y = 0.06, ...props }) {
  const clock = useThree((s) => s.clock)
  const geo = useGeo(() => ({ top: polarGrid(radius, rings, segs, () => 0, 0.12, 3), side: new THREE.CylinderGeometry(radius, radius, y, segs, 1, true).translate(0, -y / 2, 0) }), [radius, rings, segs, y])
  const base = useMemo(() => Float32Array.from(geo.top.attributes.position.array), [geo])
  useFrame(() => {
    const p = geo.top.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3]
      const z = base[i * 3 + 2]
      const fall = 1 - Math.min(1, Math.hypot(x, z) / radius) ** 4
      p.setY(i, fall * waveAt(x, z, clock.elapsedTime, amp, speed))
    }
    p.needsUpdate = true
    geo.top.computeVertexNormals()
  })
  const transparent = opacity < 1
  return (
    <group position-y={y} {...props}>
      <mesh geometry={geo.top}>
        <meshStandardMaterial color={color} flatShading roughness={0.3} metalness={0.05} transparent={transparent} opacity={opacity} depthWrite={!transparent} />
      </mesh>
      <mesh geometry={geo.side}>
        <meshStandardMaterial color={edge} flatShading roughness={0.4} side={THREE.DoubleSide} transparent={transparent} opacity={opacity} />
      </mesh>
    </group>
  )
}

// A trail of fading puffs left behind a moving object (pass its ref). It
// records where the target was every few hundredths of a second; active
// (or a function) pauses recording.
export function Trail({ target, count = 18, every = 0.03, color = '#ffffff', size = 0.06, grow = 0.05, opacity = 0.7, active = true }) {
  const g = useRef()
  const refs = useRef([])
  const hist = useRef([])
  const acc = useRef(0)
  const v = useMemo(() => new THREE.Vector3(), [])
  const geo = useGeo(() => new THREE.IcosahedronGeometry(1, 0), [])
  useFrame((_, dt) => {
    const o = target.current
    if (!o || !g.current) return
    acc.current += dt
    if (acc.current >= every) {
      acc.current = 0
      o.getWorldPosition(v)
      g.current.worldToLocal(v)
      hist.current.unshift({ p: v.clone(), on: !!read(active) && o.visible })
      if (hist.current.length > count) hist.current.pop()
    }
    refs.current.forEach((m, i) => {
      if (!m) return
      const h = hist.current[i]
      // three.js hides an object only when visible === false, so keep it boolean
      m.visible = !!(h && h.on)
      if (!m.visible) return
      const k = 1 - i / count
      m.position.copy(h.p)
      m.scale.setScalar(size * (0.4 + 0.6 * k) * (1 + i * grow))
      m.material.opacity = opacity * k
    })
  })
  return (
    <group ref={g}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geo} visible={false}>
          <meshStandardMaterial color={color} flatShading roughness={0.9} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// Put obj on a path fn(t) -> Vector3 (in its parent's space), facing along
// it (+z forward) and banking into turns.
const _m = new THREE.Matrix4()
const _d1 = new THREE.Vector3()
const _d2 = new THREE.Vector3()
const _UP = new THREE.Vector3(0, 1, 0)
export function followPath(obj, fn, t, bank = 1, dt = 0.02) {
  const p0 = fn(t)
  const p1 = fn(t + dt)
  const p2 = fn(t + 2 * dt)
  obj.position.copy(p0)
  _m.lookAt(p1, p0, _UP)
  obj.quaternion.setFromRotationMatrix(_m)
  _d1.subVectors(p1, p0).normalize()
  _d2.subVectors(p2, p1).normalize()
  const turn = (_d1.x * _d2.z - _d1.z * _d2.x) / dt // heading change, radians a second
  obj.rotateZ(Math.max(-1.1, Math.min(1.1, turn * 0.35 * bank)))
}

// ---- Shared parts for the level 4 set (see docs/lowpoly/lowpoly-level-4-hard.md) ----

// The height of the Water surface at (x, z): the same waves Water draws, so
// a boat or a float can ride them.
export const waveAt = (x, z, t, amp = 0.025, speed = 1) => amp * (Math.sin(x * 4 + t * speed * 1.6) + Math.cos(z * 3.3 + t * speed * 1.2))

// A shared musical clock: beat n, the fraction f through it, and a kick k
// that is 1 on the beat and decays before the next.
export function beat(t, bpm = 100) {
  const p = (t * bpm) / 60
  const n = Math.floor(p)
  const f = p - n
  return { n, f, k: Math.exp(-f * 6) }
}

// Cumulative volume up a lathe profile [[r, y], ...] (y rising), so a fill
// fraction can be turned into a height that holds that share of the volume.
function volumeTable(profile) {
  const v = [0]
  for (let i = 1; i < profile.length; i++) {
    const [r1, y1] = profile[i - 1]
    const [r2, y2] = profile[i]
    v.push(v[i - 1] + (Math.PI * (y2 - y1) * (r1 * r1 + r1 * r2 + r2 * r2)) / 3)
  }
  return v
}
function heightForVolume(profile, table, f, fromTop) {
  const total = table[table.length - 1]
  const target = (fromTop ? 1 - f : f) * total
  for (let i = 1; i < table.length; i++)
    if (table[i] >= target) {
      const k = (target - table[i - 1]) / Math.max(1e-9, table[i] - table[i - 1])
      return profile[i - 1][1] + k * (profile[i][1] - profile[i - 1][1])
    }
  return profile[profile.length - 1][1]
}

// A liquid (or sand) in a lathe-shaped vessel. The vessel's inner shape is
// cut by a plane that stays level in the world, so the liquid stays level
// however the vessel turns, and settles at whichever end points down. fill
// (0..1, or a function) is a share of the volume, not of the height. The
// surface sloshes: a damped pendulum driven by the vessel's own sideways
// acceleration. The cut face shows the surface colour.
const _P = new THREE.Vector3()
const _up = new THREE.Vector3()
const _q = new THREE.Quaternion()
export function Liquid({ profile, segs = 12, fill = 0.6, color = '#3fa0e0', surface, opacity = 0.85, emissive = 0, slosh = 1, ...props }) {
  const gl = useThree((s) => s.gl)
  const group = useRef()
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), [])
  const st = useRef({ p: new THREE.Vector3(), v: new THREE.Vector3(), sx: 0, sz: 0, vx: 0, vz: 0, init: false })
  const geo = useGeo(() => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)), segs), [profile, segs])
  const table = useMemo(() => volumeTable(profile), [profile])
  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const d = Math.min(Math.max(dt, 1e-4), 0.05)
    g.updateWorldMatrix(true, false)
    // which end of the vessel is down?
    g.getWorldQuaternion(_q)
    _up.set(0, 1, 0).applyQuaternion(_q)
    const f = Math.max(0, Math.min(1, read(fill)))
    const y = heightForVolume(profile, table, f, _up.y < 0)
    _P.set(0, y, 0).applyMatrix4(g.matrixWorld)
    // slosh: the surface leans against the acceleration of the level point
    const S = st.current
    if (!S.init) {
      S.p.copy(_P)
      S.init = true
    }
    const vx = (_P.x - S.p.x) / d
    const vz = (_P.z - S.p.z) / d
    const ax = (vx - S.v.x) / d
    const az = (vz - S.v.z) / d
    S.v.set(vx, 0, vz)
    S.p.copy(_P)
    const k = 70 // stiffness (surface natural frequency about 8 rad/s)
    const c = 3 // damping
    S.vx += (-k * S.sx - c * S.vx - Math.max(-60, Math.min(60, ax)) * 1.2 * slosh) * d
    S.vz += (-k * S.sz - c * S.vz - Math.max(-60, Math.min(60, az)) * 1.2 * slosh) * d
    S.sx = Math.max(-0.5, Math.min(0.5, S.sx + S.vx * d))
    S.sz = Math.max(-0.5, Math.min(0.5, S.sz + S.vz * d))
    plane.normal.set(S.sx, -1, S.sz).normalize()
    plane.constant = -plane.normal.dot(_P)
  })
  return (
    <group ref={group} {...props}>
      {/* draw the inside (seen through the cut) first and the skin over it */}
      <mesh geometry={geo} renderOrder={1}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} flatShading roughness={0.25} transparent={opacity < 1} opacity={opacity} clippingPlanes={[plane]} depthWrite={opacity >= 1} />
      </mesh>
      <mesh geometry={geo}>
        <meshStandardMaterial color={surface || color} emissive={surface || color} emissiveIntensity={emissive * 0.8 + 0.15} flatShading roughness={0.3} side={THREE.BackSide} transparent={opacity < 1} opacity={opacity} clippingPlanes={[plane]} depthWrite={opacity >= 1} />
      </mesh>
    </group>
  )
}

// A strip of geometry along a path(u) -> Vector3, width wide, for a sheet of
// water, a road or a stream. across(u) -> Vector3 gives its sideways
// direction (default: level and square to the path).
const _t = new THREE.Vector3()
const _a = new THREE.Vector3()
function acrossAt(path, u, across) {
  if (across) return across(u)
  _t.subVectors(path(Math.min(1, u + 0.01)), path(Math.max(0, u - 0.01)))
  _a.set(-_t.z, 0, _t.x)
  return _a.lengthSq() < 1e-8 ? _a.set(1, 0, 0) : _a.normalize()
}
export function ribbonGeo(path, width, segs = 24, across) {
  const pos = []
  const idx = []
  for (let i = 0; i <= segs; i++) {
    const u = i / segs
    const p = path(u)
    const a = acrossAt(path, u, across).clone().multiplyScalar(width / 2)
    pos.push(p.x - a.x, p.y - a.y, p.z - a.z, p.x + a.x, p.y + a.y, p.z + a.z)
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Bits that flow along a path(u) -> Vector3 and loop back to the start:
// water down a fall, lava down a slope, sand through a neck. They spread
// across width, stretch along the flow and fade in and out at the ends.
const _o = new THREE.Vector3()
export function Flow({ path, count = 30, speed = 0.4, width = 0.2, size = 0.03, stretch = 2.5, colors = ['#ffffff'], opacity = 0.9, emissive = 0, active = 1, across, seed = 1 }) {
  const clock = useThree((s) => s.clock)
  const refs = useRef([])
  const geo = useGeo(() => new THREE.OctahedronGeometry(1, 0), [])
  const B = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: count }, (_, i) => ({ off: i / count + r() * 0.02, side: (r() - 0.5) * width, vs: 0.85 + r() * 0.3, gate: r(), c: colors[i % colors.length] }))
  }, [count, width, seed, colors.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const t = clock.elapsedTime
    const a = read(active)
    B.forEach((b, i) => {
      const m = refs.current[i]
      if (!m) return
      m.visible = b.gate < a
      if (!m.visible) return
      const u = (t * speed * b.vs + b.off) % 1
      const p = path(u)
      const s = acrossAt(path, u, across)
      m.position.set(p.x + s.x * b.side, p.y + s.y * b.side, p.z + s.z * b.side)
      _o.copy(path(Math.min(1, u + 0.02)))
      if (_o.distanceToSquared(m.position) > 1e-8) m.lookAt(m.parent ? m.parent.localToWorld(_o.add(s.multiplyScalar(b.side))) : _o)
      const fade = Math.min(1, u * 10, (1 - u) * 10)
      m.scale.set(size, size, size * stretch)
      m.material.opacity = opacity * fade
    })
  })
  return (
    <group>
      {B.map((b, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geo}>
          <meshStandardMaterial color={b.c} emissive={b.c} emissiveIntensity={emissive} flatShading roughness={0.4} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// Cloth pinned along its left edge (x = 0): a flag ('rect', hanging down
// from y = 0) or a sail ('tri', the luff up the pin from y = 0 to height,
// the foot along y = 0). It bellies out by billow (or a function) and
// ripples with a wave that grows away from the pinned edge.
export function Cloth({ width = 0.6, height = 0.4, segs = [10, 6], shape = 'rect', amp = 0.04, speed = 5, waves = 1.5, billow = 0, color = '#ffffff', ...props }) {
  const clock = useThree((s) => s.clock)
  const geo = useGeo(() => {
    const [sx, sy] = segs
    const pos = []
    const uv = []
    const idx = []
    for (let j = 0; j <= sy; j++) {
      const v = j / sy
      const rowW = shape === 'tri' ? width * (1 - v) : width
      for (let i = 0; i <= sx; i++) {
        const x = (i / sx) * rowW
        pos.push(x, shape === 'tri' ? v * height : -v * height, 0)
        uv.push(i / sx, v)
      }
    }
    const at = (i, j) => j * (sx + 1) + i
    for (let j = 0; j < sy; j++)
      for (let i = 0; i < sx; i++) {
        idx.push(at(i, j), at(i + 1, j), at(i, j + 1))
        idx.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1))
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [width, height, shape, segs[0], segs[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const t = clock.elapsedTime
    const b = read(billow)
    const p = geo.attributes.position
    const uv = geo.attributes.uv
    for (let i = 0; i < p.count; i++) {
      const rel = uv.getX(i) // 0 at the pinned edge, 1 at the free edge of its row
      const v = uv.getY(i)
      const u = p.getX(i) / width
      const belly = b * Math.sin(Math.PI * Math.min(1, rel * (shape === 'tri' ? 1.15 : 1))) * (shape === 'tri' ? Math.sqrt(1 - v) : Math.sin(Math.PI * Math.max(0.05, v)))
      p.setZ(i, belly + amp * u * Math.sin(u * waves * TAU - t * speed + v * 1.5))
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
  })
  return (
    <mesh geometry={geo} {...props}>
      <meshStandardMaterial color={color} flatShading roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  )
}

// A small live readout laid over the canvas (pass it to Stage as overlay).
// text() is called every animation frame and should be cheap.
export function Readout({ text }) {
  const el = useRef()
  useEffect(() => {
    let raf
    const tick = () => {
      if (el.current) el.current.textContent = text()
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [text])
  return <div ref={el} style={{ position: 'absolute', left: 12, top: 12, zIndex: 4, padding: '7px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.86)', boxShadow: '0 2px 10px rgba(0,0,0,.1)', font: '500 11px/1.5 ui-monospace, Menlo, monospace', color: '#2a2925', maxWidth: 'calc(100% - 68px)' }} />
}

// The fill height (local y) at which a lathe profile holds share f of its
// volume, counted from the bottom (or from the top).
export function fillHeight(profile, f, fromTop = false) {
  return heightForVolume(profile, volumeTable(profile), f, fromTop)
}

// ---- Shared parts for the level 5 set (see docs/lowpoly/lowpoly-level-5-hardest.md) ----

// A tapering chain of faceted links pointing back along -z: a tail, a
// trunk, a neck. Each link sways a beat behind the one before (a lag chain
// built from Sway), droops by droop radians, and shakes on a kick.
export function Tail({ segs = 5, length = 0.6, r0 = 0.08, r1 = 0.02, colors = ['#888888'], sides = 6, rate = 0.6, amp = 0.15, lag = 0.5, axis = 'y', droop = 0, curl = 0, kick, kickAmp = 0, tip, ...props }) {
  const L = length / segs
  const geo = useGeo(
    () =>
      Array.from({ length: segs }, (_, i) => {
        const a = r0 + ((r1 - r0) * i) / segs
        const b = r0 + ((r1 - r0) * (i + 1)) / segs
        return facet(new THREE.CylinderGeometry(b, a, L * 1.08, sides, 1).translate(0, L / 2, 0).rotateX(-Math.PI / 2), a * 0.05, 40 + i)
      }),
    [segs, length, r0, r1, sides],
  )
  const link = (i) =>
    i === segs ? (
      tip || null
    ) : (
      <group position-z={i === 0 ? 0 : -L} rotation-x={droop + (curl * i) / segs}>
        <Sway i={i} rate={rate} amp={amp * (0.5 + i / segs)} lag={lag} axis={axis} kick={kick} kickAmp={kickAmp}>
          <mesh geometry={geo[i]}>
            <Flat color={colors[i % colors.length]} />
          </mesh>
          {link(i + 1)}
        </Sway>
      </group>
    )
  return <group {...props}>{link(0)}</group>
}

// A wing hinged at the shoulder, spreading out along +x (side = -1 mirrors
// it). angle (radians, or a function read every frame) raises it about the
// body's long axis; fold (0..1, or a function) tucks it back.
export function Wing({ side = 1, span = 0.4, chord = 0.2, color = '#ffffff', tipColor, angle = 0, fold = 0, ...props }) {
  const g = useRef()
  const geo = useGeo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, chord * 0.5)
    s.lineTo(span * 0.55, chord * 0.55)
    s.lineTo(span, chord * 0.1)
    s.lineTo(span * 0.8, -chord * 0.45)
    s.lineTo(span * 0.3, -chord * 0.5)
    s.lineTo(0, -chord * 0.4)
    s.closePath()
    return facet(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 0.01, 0), 0.004, 77)
  }, [span, chord])
  useFrame(() => {
    if (!g.current) return
    g.current.rotation.z = side * read(angle)
    g.current.rotation.y = -side * read(fold) * 1.2
  })
  return (
    <group {...props}>
      <group ref={g} scale={[side, 1, 1]}>
        <mesh geometry={geo}>
          <Flat color={color} side={THREE.DoubleSide} />
        </mesh>
        {tipColor && (
          <mesh geometry={geo} position={[span * 0.18, 0.003, 0]} scale={[0.82, 1, 0.82]}>
            <Flat color={tipColor} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </group>
  )
}

// A walk cycle at phase p (radians, one stride per 2 pi): for each leg its
// swing (-1 back .. 1 forward) and lift (0 planted .. 1 highest). Two legs
// alternate; four legs use the walk's footfall order: left hind, left fore,
// right hind, right fore, a quarter stride apart.
const WALK = { 2: [0, Math.PI], 4: [Math.PI * 0.5, 0, Math.PI * 1.5, Math.PI] }
export function walk(p, legs = 4) {
  return (WALK[legs] || WALK[4]).map((o) => ({ swing: Math.sin(p + o), lift: Math.max(0, Math.cos(p + o)) }))
}

// A head that looks about: slow, uneven glances made of mismatched sines.
export function lookAround(t, phase = 0) {
  return { yaw: 0.45 * Math.sin(0.37 * t + phase) + 0.2 * Math.sin(0.83 * t + phase * 2), pitch: 0.12 * Math.sin(0.53 * t + phase) }
}

// An eyelid: 1 open, nearly shut for a moment every few seconds.
export const blinkAt = (t, every = 3.4, phase = 0) => ((t + phase) % every < 0.12 ? 0.12 : 1)
