import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// A small smart speaker you can handle with two fingers. Pinch two pointers
// together or apart to zoom the model, and twist them to turn it about its
// vertical axis. On a desktop there is no pinch, so the mouse wheel zooms, a
// one-pointer drag turns it, and on-screen +, -, rotate-left and rotate-right
// buttons do the same, with a readout of the zoom and angle. Motion is damped,
// zoom is limited, and a double-tap or double-click resets it.
//
// Pointers are tracked by hand with pointer events (the stage has
// touch-action: none); no gesture events are used. Under prefers-reduced-motion
// the model jumps to its target instead of gliding.

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const STEP = 1.2 // zoom factor per button press / wheel notch
const TURN = Math.PI / 12 // 15 degrees per rotate button

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

function Speaker({ bodyColor, accentColor, glowColor, target, onReadout }) {
  const group = useRef()
  const reduced = useMemo(reducedMotion, [])
  const cur = useRef({ zoom: 1, angle: 0 })
  const shown = useRef({ z: -1, a: -999 })

  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ roughness: 0.95 }), // fabric
      accent: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: '#25262b', roughness: 0.5, metalness: 0.2 }),
      glow: new THREE.MeshStandardMaterial({ emissiveIntensity: 1.6, color: '#ffffff' }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.body.color.set(bodyColor)
    mats.accent.color.set(accentColor)
    mats.glow.emissive.set(glowColor)
    mats.glow.color.set(glowColor)
  }, [mats, bodyColor, accentColor, glowColor])

  useFrame((_, delta) => {
    const c = cur.current
    const t = target.current
    const k = reduced ? 1 : 1 - Math.exp(-10 * Math.min(delta, 1 / 20))
    c.zoom += (t.zoom - c.zoom) * k
    c.angle += (t.angle - c.angle) * k
    group.current.scale.setScalar(c.zoom)
    group.current.rotation.y = c.angle
    const z = Math.round(c.zoom * 100)
    const a = Math.round((((THREE.MathUtils.radToDeg(c.angle) + 180) % 360) + 360) % 360) - 180
    if (z !== shown.current.z || a !== shown.current.a) {
      shown.current = { z, a }
      onReadout(z, a)
    }
  })

  return (
    <group position-y={0}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
        <circleGeometry args={[1.5, 48]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <group ref={group}>
        {/* base ring */}
        <mesh material={mats.dark} position-y={0.08}>
          <cylinderGeometry args={[0.95, 1.0, 0.16, 48]} />
        </mesh>
        {/* fabric body */}
        <mesh material={mats.body} position-y={1.05}>
          <cylinderGeometry args={[0.9, 0.95, 1.8, 48]} />
        </mesh>
        {/* metal bands */}
        {[0.3, 1.8].map((y) => (
          <mesh key={y} material={mats.accent} position-y={y}>
            <cylinderGeometry args={[0.93, 0.93, 0.06, 48]} />
          </mesh>
        ))}
        {/* top cap with glowing ring */}
        <mesh material={mats.dark} position-y={2.0}>
          <cylinderGeometry args={[0.9, 0.9, 0.18, 48]} />
        </mesh>
        <mesh material={mats.glow} rotation-x={Math.PI / 2} position-y={2.1}>
          <torusGeometry args={[0.5, 0.045, 12, 64]} />
        </mesh>
        {/* front: control pad and wedge so the angle is readable */}
        <RoundedBox args={[0.5, 0.22, 0.08]} radius={0.04} smoothness={3} position={[0, 1.55, 0.93]} material={mats.dark} />
        <mesh material={mats.glow} position={[0, 1.55, 0.975]}>
          <sphereGeometry args={[0.05, 16, 12]} />
        </mesh>
        <mesh material={mats.accent} position={[0.95, 1.0, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.1, 0.1, 0.22, 20]} />
        </mesh>
        {/* strap handle on the back */}
        <mesh material={mats.accent} position={[0, 1.2, -0.95]}>
          <boxGeometry args={[0.16, 0.8, 0.08]} />
        </mesh>
      </group>
    </group>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(17))
    const dist = Math.max(4.4 / 2 / tan, 5 / 2 / (tan * aspect)) * 1.45
    camera.position.set(0, 1.3 + dist * 0.2, dist)
    camera.lookAt(0, 1.2, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function PinchTwist({ bodyColor = '#6f7c93', accentColor = '#d9a441', glowColor = '#ff4d1a', floorColor = '#d9d4cb', minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM }) {
  const target = useRef({ zoom: 1, angle: 0 })
  const ptrs = useRef(new Map()) // pointerId -> {x, y}
  const gest = useRef({ dist: 0, ang: 0 })
  const tap = useRef({ t: 0, x: 0, y: 0, moved: 0 })
  const stage = useRef(null)
  const lims = useRef({ minZoom, maxZoom })
  lims.current = { minZoom, maxZoom }
  const [read, setRead] = useState({ z: 100, a: 0 })
  const rootRef = useRef(null)

  const setZoom = (v) => {
    target.current.zoom = THREE.MathUtils.clamp(v, lims.current.minZoom, lims.current.maxZoom)
  }
  const reset = () => {
    target.current.zoom = 1
    target.current.angle = Math.round(target.current.angle / (Math.PI * 2)) * Math.PI * 2 // shortest way home
  }

  useEffect(() => {
    const el = stage.current
    const wheel = (e) => {
      e.preventDefault()
      const f = Math.exp(-e.deltaY * 0.0015)
      setZoom(target.current.zoom * f)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])

  const pair = () => {
    const [a, b] = [...ptrs.current.values()]
    return { dist: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x) }
  }

  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size === 2) {
      gest.current = pair()
      tap.current.moved = 99 // a two-finger gesture is never a tap
    } else if (ptrs.current.size === 1) {
      tap.current.moved = 0
    }
  }
  const onMove = (e) => {
    const p = ptrs.current.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (ptrs.current.size === 1) {
      tap.current.moved += Math.abs(dx) + Math.abs(dy)
      target.current.angle += dx * 0.012
    } else if (ptrs.current.size === 2) {
      const g = pair()
      if (gest.current.dist > 1) setZoom(target.current.zoom * (g.dist / gest.current.dist))
      let da = g.ang - gest.current.ang
      da = Math.atan2(Math.sin(da), Math.cos(da)) // wrap to -PI..PI
      target.current.angle -= da // fingers turning clockwise on screen turn the model clockwise from above
      gest.current = g
    }
  }
  const onUp = (e) => {
    if (!ptrs.current.has(e.pointerId)) return
    const wasOne = ptrs.current.size === 1
    ptrs.current.delete(e.pointerId)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (ptrs.current.size === 1) {
      // dropped from two to one: carry on with the remaining pointer, no jump
    }
    if (wasOne && tap.current.moved < 10) {
      const now = performance.now()
      const t = tap.current
      if (now - t.t < 350 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) {
        reset()
        t.t = 0
      } else {
        t.t = now
        t.x = e.clientX
        t.y = e.clientY
      }
    }
  }

  const mono = 'ui-monospace, Menlo, Consolas, monospace'
  const btn = { width: 40, height: 40, padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.92)', color: '#2a2925', font: '700 18px/1 ' + mono, boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)' }

  return (
    <div ref={rootRef} data-zoom={read.z} data-angle={read.a} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div
        ref={stage}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'grab' }}
      >
        <Canvas dpr={[1, 1.75]} camera={{ position: [0, 2.5, 8], fov: 34, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
          <color attach="background" args={[floorColor]} />
          <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
          <directionalLight position={[-5, 9, 6]} intensity={0.6} />
          <Studio />
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[80, 80]} />
            <meshStandardMaterial color={floorColor} roughness={0.9} />
          </mesh>
          <Speaker bodyColor={bodyColor} accentColor={accentColor} glowColor={glowColor} target={target} onReadout={(z, a) => setRead({ z, a })} />
          <Rig />
        </Canvas>
      </div>

      <div aria-live="off" style={{ position: 'absolute', left: 12, top: 12, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 16px rgba(0,0,0,.12), inset 0 0 0 1px rgba(0,0,0,.06)', font: '600 12px/1.5 ' + mono, color: '#2a2925', pointerEvents: 'none' }}>
        Zoom {read.z}% &nbsp; Angle {read.a}&deg;
      </div>

      <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" aria-label="Rotate left" style={btn} onClick={() => (target.current.angle += TURN)}>&#x21BA;</button>
        <button type="button" aria-label="Rotate right" style={btn} onClick={() => (target.current.angle -= TURN)}>&#x21BB;</button>
        <button type="button" aria-label="Zoom out" style={btn} onClick={() => setZoom(target.current.zoom / STEP)}>&minus;</button>
        <button type="button" aria-label="Zoom in" style={btn} onClick={() => setZoom(target.current.zoom * STEP)}>+</button>
        <button type="button" aria-label="Reset view" style={{ ...btn, width: 'auto', padding: '0 14px', borderRadius: 999, font: '700 12px/1 ' + mono }} onClick={reset}>Reset</button>
      </div>
      <div style={{ position: 'absolute', left: 12, bottom: 16, font: '500 11px/1.5 ' + mono, color: '#2a2925', textShadow: '0 1px 0 rgba(255,255,255,.5)', pointerEvents: 'none' }}>
        Pinch + twist · wheel zooms · drag turns · double-tap resets
      </div>
    </div>
  )
}
