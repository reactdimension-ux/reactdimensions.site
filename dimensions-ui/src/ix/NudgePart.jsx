import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// Keyboard nudging for a 3D part. A little toy robot is built from six separate
// parts. Click or tap one to select it (it gets an outline), then use the
// keyboard while the stage has focus:
//   arrow keys    move it one unit on X / Z
//   PageUp/Down   move it one unit up / down (Y)
//   Shift         makes each step five units
//   Backspace/Home  puts that part back; Esc deselects
// A readout panel shows the part name and its offset in units. Offsets are kept
// as whole units, so the readout is exact; the mesh glides to its target on a
// damped step (it snaps under prefers-reduced-motion). Keys only act while the
// stage is focused, which is shown with a visible focus ring.

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const REACH = 3.2 // how far from the origin a part may be nudged, in world units

// Each part: a name plus primitives { t: shape, a: args, p: position, c: colour slot, e: emissive }
const PARTS = [
  {
    id: 'base',
    name: 'Base',
    prims: [
      { t: 'box', a: [1.6, 0.2, 1.1], p: [0, 0.1, 0], c: 'dark' },
      { t: 'cyl', a: [0.18, 0.18, 0.1, 20], p: [-0.5, 0.0, 0.35], c: 'dark', rot: [0, 0, 0] },
      { t: 'box', a: [1.3, 0.04, 0.9], p: [0, 0.22, 0], c: 'accent' },
    ],
  },
  {
    id: 'torso',
    name: 'Torso',
    prims: [
      { t: 'rbox', a: [1.1, 1.05, 0.75], p: [0, 0.82, 0], c: 'body' },
      { t: 'box', a: [0.6, 0.4, 0.04], p: [0, 0.88, 0.38], c: 'dark' },
      { t: 'sph', a: [0.07, 16, 12], p: [-0.18, 0.88, 0.41], c: 'glow' },
      { t: 'sph', a: [0.07, 16, 12], p: [0.0, 0.88, 0.41], c: 'accent' },
      { t: 'sph', a: [0.07, 16, 12], p: [0.18, 0.88, 0.41], c: 'glow' },
    ],
  },
  {
    id: 'head',
    name: 'Head',
    prims: [
      { t: 'rbox', a: [0.85, 0.6, 0.7], p: [0, 1.75, 0], c: 'body' },
      { t: 'box', a: [0.62, 0.2, 0.04], p: [0, 1.77, 0.36], c: 'dark' },
      { t: 'sph', a: [0.06, 16, 12], p: [-0.14, 1.77, 0.39], c: 'glow' },
      { t: 'sph', a: [0.06, 16, 12], p: [0.14, 1.77, 0.39], c: 'glow' },
    ],
  },
  {
    id: 'antenna',
    name: 'Antenna',
    prims: [
      { t: 'cyl', a: [0.025, 0.025, 0.4, 10], p: [0, 2.25, 0], c: 'dark' },
      { t: 'sph', a: [0.08, 16, 12], p: [0, 2.5, 0], c: 'accent' },
    ],
  },
  {
    id: 'larm',
    name: 'Left arm',
    prims: [
      { t: 'rbox', a: [0.26, 0.85, 0.28], p: [-0.78, 0.85, 0], c: 'accent' },
      { t: 'sph', a: [0.18, 16, 12], p: [-0.78, 0.35, 0], c: 'dark' },
    ],
  },
  {
    id: 'rarm',
    name: 'Right arm',
    prims: [
      { t: 'rbox', a: [0.26, 0.85, 0.28], p: [0.78, 0.85, 0], c: 'accent' },
      { t: 'sph', a: [0.18, 16, 12], p: [0.78, 0.35, 0], c: 'dark' },
    ],
  },
]

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#8a8580']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-8, 7, 6]} rotation-y={Math.PI / 3} scale={[6, 10, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#eaf0ff" position={[8, 5, 5]} rotation-y={-Math.PI / 3} scale={[6, 8, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[16, 8, 1]} />
    </Environment>
  )
}

function Prim({ prim, material }) {
  const { t, a, p, rot } = prim
  if (t === 'rbox') return <RoundedBox args={a} radius={0.06} smoothness={3} position={p} material={material} />
  return (
    <mesh position={p} rotation={rot || [0, 0, 0]} material={material}>
      {t === 'box' && <boxGeometry args={a} />}
      {t === 'cyl' && <cylinderGeometry args={a} />}
      {t === 'sph' && <sphereGeometry args={a} />}
    </mesh>
  )
}

function Part({ part, mats, outline, selected, offset, unit, onSelect }) {
  const group = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')
  const reduced = useMemo(reducedMotion, [])
  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const k = reduced ? 1 : 1 - Math.exp(-14 * Math.min(delta, 1 / 20))
    g.position.x += (offset[0] * unit - g.position.x) * k
    g.position.y += (offset[1] * unit - g.position.y) * k
    g.position.z += (offset[2] * unit - g.position.z) * k
  })
  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(part.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      {part.prims.map((pr, i) => (
        <Prim key={i} prim={pr} material={mats[pr.c]} />
      ))}
      {selected &&
        part.prims.map((pr, i) => (
          <group key={'o' + i} position={pr.p} scale={1.09}>
            <Prim prim={{ ...pr, p: [0, 0, 0] }} material={outline} />
          </group>
        ))}
    </group>
  )
}

function Rig() {
  return null
}

export default function NudgePart({
  unit = 0.25,
  bodyColor = '#e8e4da',
  accentColor = '#ff4d1a',
  highlightColor = '#22c1ff',
  floorColor = '#d9d4cb',
  showGrid = true,
  autoRotate = false,
  style,
}) {
  const [sel, setSel] = useState(null)
  const [offs, setOffs] = useState({})
  const [focused, setFocused] = useState(false)
  const unitRef = useRef(unit)
  unitRef.current = unit

  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 }),
      accent: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2b2d33', roughness: 0.6, metalness: 0.2 }),
      glow: new THREE.MeshStandardMaterial({ color: '#bff3ff', emissive: '#58d6ff', emissiveIntensity: 1.2 }),
    }),
    [],
  )
  const outline = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, opacity: 0.95, depthWrite: false }), [])
  useEffect(() => () => [...Object.values(mats), outline].forEach((m) => m.dispose()), [mats, outline])
  useEffect(() => {
    mats.body.color.set(bodyColor)
    mats.accent.color.set(accentColor)
    outline.color.set(highlightColor)
  }, [mats, outline, bodyColor, accentColor, highlightColor])

  const nudge = useCallback((id, dx, dy, dz) => {
    const u = unitRef.current
    const lim = Math.floor(REACH / u)
    setOffs((o) => {
      const c = o[id] || [0, 0, 0]
      const n = [
        THREE.MathUtils.clamp(c[0] + dx, -lim, lim),
        THREE.MathUtils.clamp(c[1] + dy, 0, lim),
        THREE.MathUtils.clamp(c[2] + dz, -lim, lim),
      ]
      return { ...o, [id]: n }
    })
  }, [])

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Escape') {
      if (sel) {
        e.preventDefault()
        setSel(null)
      }
      return
    }
    if (!sel) return
    const s = e.shiftKey ? 5 : 1
    let d = null
    switch (e.key) {
      case 'ArrowLeft': d = [-s, 0, 0]; break
      case 'ArrowRight': d = [s, 0, 0]; break
      case 'ArrowUp': d = [0, 0, -s]; break
      case 'ArrowDown': d = [0, 0, s]; break
      case 'PageUp': d = [0, s, 0]; break
      case 'PageDown': d = [0, -s, 0]; break
      case 'Backspace':
      case 'Home':
        e.preventDefault()
        setOffs((o) => ({ ...o, [sel]: [0, 0, 0] }))
        return
      default: return
    }
    e.preventDefault()
    nudge(sel, ...d)
  }

  const part = PARTS.find((p) => p.id === sel)
  const cur = (sel && offs[sel]) || [0, 0, 0]
  const fmt = (n) => (n > 0 ? '+' + n : String(n))
  const mono = 'ui-monospace, Menlo, Consolas, monospace'

  return (
    <div
      tabIndex={0}
      role="application"
      aria-label="Nudge part. Click a part, then use arrow keys, Page Up and Page Down."
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      data-selected={sel || ''}
      data-pos={cur.join(',')}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        touchAction: 'none',
        outline: 'none',
        boxShadow: focused ? 'inset 0 0 0 3px ' + highlightColor : 'inset 0 0 0 1px rgba(0,0,0,.08)',
        borderRadius: 4,
        overflow: 'hidden',
        ...style,
      }}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [4.6, 3.6, 6.4], fov: 34, near: 0.1, far: 120 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onPointerMissed={() => setSel(null)}
      >
        <color attach="background" args={[floorColor]} />
        <fog attach="fog" args={[floorColor, 16, 34]} />
        <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
        <directionalLight position={[-5, 9, 6]} intensity={0.6} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.002}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color={floorColor} roughness={0.9} />
        </mesh>
        {showGrid && <gridHelper args={[REACH * 2 + 1, Math.max(2, Math.round((REACH * 2 + 1) / unit)), '#6d675d', '#a8a196']} position-y={0.001} />}
        <group position-y={0}>
          {PARTS.map((p) => (
            <Part key={p.id} part={p} mats={mats} outline={outline} selected={sel === p.id} offset={offs[p.id] || [0, 0, 0]} unit={unit} onSelect={setSel} />
          ))}
        </group>
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={[0, 1.1, 0]} autoRotate={autoRotate} autoRotateSpeed={0.8} minDistance={5} maxDistance={16} minPolarAngle={0.3} maxPolarAngle={1.45} />
      </Canvas>

      <div
        aria-live="polite"
        style={{ position: 'absolute', left: 12, top: 12, minWidth: 150, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 16px rgba(0,0,0,.12), inset 0 0 0 1px rgba(0,0,0,.06)', font: '500 12px/1.5 ' + mono, color: '#2a2925', pointerEvents: 'none' }}
      >
        {part ? (
          <>
            <div style={{ font: '700 13px/1.3 ' + mono, marginBottom: 4 }}>{part.name}</div>
            <div>X {fmt(cur[0])} &nbsp; Y {fmt(cur[1])} &nbsp; Z {fmt(cur[2])}</div>
            <div style={{ opacity: 0.55 }}>1 unit = {unit.toFixed(2)}</div>
          </>
        ) : (
          <div style={{ opacity: 0.7 }}>No part selected</div>
        )}
      </div>

      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 10, font: '500 11px/1.5 ' + mono, color: '#2a2925', textShadow: '0 1px 0 rgba(255,255,255,.5)', pointerEvents: 'none' }}>
        {focused ? 'Keys active: arrows = X/Z, PgUp/PgDn = Y, Shift = x5, Backspace = reset, Esc = deselect' : 'Click a part, then click the stage to focus it; keys only work while focused'}
      </div>
    </div>
  )
}
