import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
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
export function Stage({ background = '#eceaf1', autoRotate = true, float = true, hint, camera = [3.4, 2.3, 4.6], target = [0, 0.9, 0], children }) {
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
