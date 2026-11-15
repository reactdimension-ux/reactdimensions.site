import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, Sky } from '@react-three/drei'
import * as THREE from 'three'
import Lion from './Lion.jsx'
import { grassTuft, groundTextures, rockGeometry, scatter } from './world.js'

const HAZE = '#d9c3a0'
const SUN = new THREE.Vector3(6, 7.5, 4.5)

const KEYS = {
  ArrowUp: 'f', KeyW: 'f',
  ArrowDown: 'b', KeyS: 'b',
  ArrowLeft: 'l', KeyA: 'l',
  ArrowRight: 'r', KeyD: 'r',
}

function Ground() {
  const tex = useMemo(groundTextures, [])
  useEffect(() => () => {
    tex.map.dispose()
    tex.bump.dispose()
  }, [tex])
  useMemo(() => {
    for (const t of [tex.map, tex.bump]) t.repeat.set(90, 90)
  }, [tex])
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[280, 280]} />
      <meshStandardMaterial map={tex.map} bumpMap={tex.bump} bumpScale={1.2} roughness={1} metalness={0} />
    </mesh>
  )
}

function Grass() {
  const geo = useMemo(grassTuft, [])
  const spots = useMemo(() => scatter(3200, 62, 21, 1.6), [])
  const ref = useRef()
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const c = new THREE.Color()
    spots.forEach((s, i) => {
      q.setFromEuler(e.set(0, s.rot, 0))
      m.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(s.s, s.s * (0.8 + s.r * 0.6), s.s))
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, c.setHSL(0.11 + s.r * 0.03, 0.35 + s.r * 0.2, 0.75 + s.r * 0.25))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [spots])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, spots.length]} receiveShadow>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.95} />
    </instancedMesh>
  )
}

function Rocks() {
  const rocks = useMemo(
    () =>
      scatter(18, 50, 8, 5).map((s, i) => ({
        ...s,
        geo: rockGeometry(i + 1),
        size: 0.25 + s.r * s.r * 1.4,
      })),
    [],
  )
  useEffect(() => () => rocks.forEach((r) => r.geo.dispose()), [rocks])
  return rocks.map((r, i) => (
    <mesh key={i} geometry={r.geo} position={[r.x, 0, r.z]} rotation-y={r.rot} scale={r.size} castShadow receiveShadow>
      <meshStandardMaterial color="#8a7d6a" roughness={0.95} flatShading />
    </mesh>
  ))
}

// The sun's shadow box follows the lion.
function Sunlight({ track }) {
  const ref = useRef()
  useFrame(() => {
    const l = ref.current
    if (!l) return
    const p = track.current
    l.position.set(p.x + SUN.x, SUN.y, p.z + SUN.z)
    l.target.position.set(p.x, 0, p.z)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={ref}
      intensity={3.2}
      color="#ffe2b8"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    >
      <orthographicCamera attach="shadow-camera" args={[-3.2, 3.2, 3.2, -3.2, 0.5, 30]} />
    </directionalLight>
  )
}

// Moves the camera with the lion; dragging still orbits around it.
function Follow({ track }) {
  const controls = useThree((s) => s.controls)
  const camera = useThree((s) => s.camera)
  const last = useRef(null)
  useFrame(() => {
    const p = track.current
    if (!last.current) {
      last.current = p.clone()
      return
    }
    const dx = p.x - last.current.x
    const dz = p.z - last.current.z
    if (dx || dz) {
      camera.position.x += dx
      camera.position.z += dz
      if (controls) {
        controls.target.x += dx
        controls.target.z += dz
        controls.update()
      }
    }
    last.current.copy(p)
  })
  return null
}

const pad = (on) => ({
  width: 44,
  height: 44,
  borderRadius: 12,
  border: 'none',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  font: '600 15px/1 ui-sans-serif, system-ui, sans-serif',
  color: on ? '#1c160e' : '#f6ecd9',
  background: on ? '#f3d9a4' : 'rgba(28,22,14,0.55)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  boxShadow: 'inset 0 0 0 1px rgba(255,240,210,0.18)',
  touchAction: 'none',
  userSelect: 'none',
})

function Hint() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 'calc(100% - 24px)' }}>
      {open && (
        <div role="tooltip" style={{ maxWidth: 300, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,250,240,0.94)', boxShadow: '0 8px 24px rgba(0,0,0,.18)', font: '500 11px/1.7 ui-monospace, Menlo, monospace', color: '#2a2218' }}>
          W / ↑ walk · S / ↓ back up
          <br />A D / ← → turn · Shift run
          <br />Drag to orbit · scroll to zoom
        </div>
      )}
      <button
        type="button"
        aria-label="Controls"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
        style={{ ...pad(open), width: 30, height: 30, borderRadius: '50%', font: 'italic 700 15px/1 Georgia, serif' }}
      >
        i
      </button>
    </div>
  )
}

export default function LionScene(props) {
  const input = useRef({ f: 0, b: 0, l: 0, r: 0, run: false })
  const track = useRef(new THREE.Vector3())
  const wrap = useRef()
  const over = useRef(false)
  const [, redraw] = useState(0)

  useEffect(() => {
    const k = input.current
    const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable]')
    const down = (e) => {
      if (typing(e)) return
      if (e.key === 'Shift') k.run = true
      const m = KEYS[e.code]
      if (!m) return
      k[m] = 1
      // keep arrow keys from scrolling the page while steering
      if ((over.current || wrap.current?.contains(document.activeElement)) && e.code.startsWith('Arrow')) e.preventDefault()
    }
    const up = (e) => {
      if (e.key === 'Shift') k.run = false
      const m = KEYS[e.code]
      if (m) k[m] = 0
    }
    const clear = () => Object.assign(k, { f: 0, b: 0, l: 0, r: 0, run: false })
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  const hold = (m) => ({
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      input.current[m] = 1
      redraw((n) => n + 1)
    },
    onPointerUp: () => {
      input.current[m] = 0
      redraw((n) => n + 1)
    },
    onPointerCancel: () => {
      input.current[m] = 0
      redraw((n) => n + 1)
    },
  })
  const k = input.current

  return (
    <div
      ref={wrap}
      tabIndex={0}
      onPointerEnter={() => (over.current = true)}
      onPointerLeave={() => (over.current = false)}
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', outline: 'none', background: HAZE }}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [3.1, 1.55, 3.3], fov: 34, near: 0.05, far: 2000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <fog attach="fog" args={[HAZE, 22, 120]} />
        <Sky distance={1000} sunPosition={SUN.toArray()} turbidity={3.5} rayleigh={2.4} mieCoefficient={0.004} mieDirectionalG={0.85} />
        <hemisphereLight args={['#ffe8c6', '#6b5234', 0.7]} />
        <Sunlight track={track} />
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={1.6} color="#ffd9a6" position={[6, 6, 4]} scale={[8, 5, 1]} />
          <Lightformer form="rect" intensity={0.9} color="#a9c2e6" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[14, 14, 1]} />
          <Lightformer form="rect" intensity={0.5} color="#c9a576" position={[-6, 1, -5]} scale={[12, 2, 1]} />
        </Environment>
        <Lion input={input} track={track} {...props} />
        <Ground />
        <Grass />
        <Rocks />
        <Follow track={track} />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.85, 0]} minDistance={0.7} maxDistance={14} minPolarAngle={0.2} maxPolarAngle={1.52} />
      </Canvas>

      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: 6 }}>
        <span />
        <button type="button" aria-label="Walk forward" style={pad(k.f)} {...hold('f')}>▲</button>
        <span />
        <button type="button" aria-label="Turn left" style={pad(k.l)} {...hold('l')}>◀</button>
        <button type="button" aria-label="Back up" style={pad(k.b)} {...hold('b')}>▼</button>
        <button type="button" aria-label="Turn right" style={pad(k.r)} {...hold('r')}>▶</button>
      </div>
      <button
        type="button"
        aria-pressed={k.run}
        onClick={() => {
          k.run = !k.run
          redraw((n) => n + 1)
        }}
        style={{ ...pad(k.run), position: 'absolute', left: 12 + 3 * 44 + 2 * 6 + 10, bottom: 12, width: 'auto', padding: '0 14px', zIndex: 5 }}
      >
        Run
      </button>
      <Hint />
    </div>
  )
}
