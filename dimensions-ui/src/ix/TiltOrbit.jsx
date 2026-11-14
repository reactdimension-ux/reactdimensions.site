import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Tilt-to-orbit. A virtual tilt (x = left/right, y = forward/back, each -1..1)
// comes from the phone's DeviceOrientation (gamma / beta, with 45 degrees of
// beta treated as "held comfortably") or, when there is no sensor, denied
// permission or a desktop, from the pointer position inside the stage. The tilt
// is smoothed and then orbits the camera around the model. The phone glyph shows
// the same virtual tilt either way.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Model({ bodyColor, accentColor }) {
  const gem = useRef()
  const ring = useRef()
  const reduced = useRef(reducedMotion())
  useFrame((_, dt) => {
    if (reduced.current) return
    if (gem.current) gem.current.rotation.y += dt * 0.35
    if (ring.current) ring.current.rotation.z += dt * 0.5
  })
  return (
    <group position={[0, -0.2, 0]}>
      <mesh position={[0, -0.9, 0]}>
        <cylinderGeometry args={[1.5, 1.7, 0.3, 48]} />
        <meshStandardMaterial color={accentColor} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[1.1, 1.2, 0.12, 48]} />
        <meshStandardMaterial color="#d8d4cc" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh ref={gem} position={[0, 0.35, 0]}>
        <icosahedronGeometry args={[0.85, 0]} />
        <meshStandardMaterial color={bodyColor} roughness={0.2} metalness={0.3} flatShading />
      </mesh>
      <mesh ref={ring} position={[0, 0.35, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.35, 0.04, 12, 80]} />
        <meshStandardMaterial color={accentColor} roughness={0.3} metalness={0.6} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 1.25, -0.6, Math.sin((i * Math.PI) / 2) * 1.25]}>
          <boxGeometry args={[0.18, 0.18 + i * 0.12, 0.18]} />
          <meshStandardMaterial color={bodyColor} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// Orbits the camera from the smoothed tilt held in `cur`.
function Rig({ cur, sens }) {
  const { camera } = useThree()
  useFrame(() => {
    const yaw = cur.current.x * 1.1 * sens
    const pitch = clamp(0.35 + cur.current.y * 0.6 * sens, -0.2, 1.3)
    const r = 6
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r, Math.cos(yaw) * Math.cos(pitch) * r)
    camera.lookAt(0, 0, 0)
  })
  return null
}

export default function TiltOrbit({
  sensitivity = 1,
  smoothing = 0.85,
  invert = false,
  bodyColor = '#e2573f',
  accentColor = '#1d2b4f',
  bgColor = '#ece7dd',
}) {
  const root = useRef(null)
  const glyph = useRef(null)
  const readout = useRef(null)
  const target = useRef({ x: 0, y: 0 })
  const cur = useRef({ x: 0, y: 0 })
  const sensor = useRef(false) // true once real orientation values have arrived
  const opts = useRef({})
  opts.current = { smoothing, invert }
  const [source, setSource] = useState('pointer')
  const [perm, setPerm] = useState('none') // none | needed | granted | denied
  const [msg, setMsg] = useState('')

  // Listen for orientation; iOS needs requestPermission from a user gesture first.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return
    const needs = typeof DeviceOrientationEvent.requestPermission === 'function'
    const onOri = (e) => {
      if (e.gamma == null || e.beta == null) return
      const ang = window.screen?.orientation?.angle ?? window.orientation ?? 0
      let a = e.gamma / 45
      let b = (e.beta - 45) / 45
      if (ang === 90) [a, b] = [b, -a]
      else if (ang === 270 || ang === -90) [a, b] = [-b, a]
      target.current = { x: clamp(a, -1, 1), y: clamp(b, -1, 1) }
      if (!sensor.current) {
        sensor.current = true
        setSource('sensor')
      }
    }
    // always listen: where permission is required no events arrive until it is granted
    window.addEventListener('deviceorientation', onOri)
    if (needs) setPerm('needed')
    return () => window.removeEventListener('deviceorientation', onOri)
  }, [])

  const enable = async () => {
    try {
      const res = await DeviceOrientationEvent.requestPermission()
      if (res === 'granted') {
        setPerm('granted')
        setMsg('')
      } else {
        setPerm('denied')
        setMsg('Motion access denied - using the pointer instead.')
      }
    } catch {
      setPerm('denied')
      setMsg('Motion is unavailable here - using the pointer instead.')
    }
  }

  const onPointerMove = (e) => {
    if (sensor.current) return
    if (e.pointerType !== 'mouse' && !e.buttons && e.pointerType !== 'touch') return
    const r = root.current.getBoundingClientRect()
    target.current = {
      x: clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
      y: clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1),
    }
  }
  const onLeave = () => {
    if (!sensor.current) target.current = { x: 0, y: 0 }
  }

  // smoothing + the tilt indicator, in one rAF loop
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const reduce = reducedMotion()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const { smoothing: sm, invert: inv } = opts.current
      const s = inv ? -1 : 1
      const alpha = reduce ? 1 : 1 - Math.pow(clamp(sm, 0, 0.99), dt * 60)
      cur.current.x += (target.current.x * s - cur.current.x) * alpha
      cur.current.y += (target.current.y * s - cur.current.y) * alpha
      const tx = target.current.x
      const ty = target.current.y
      if (glyph.current) glyph.current.style.transform = `rotateX(${(ty * -40).toFixed(1)}deg) rotateY(${(tx * 40).toFixed(1)}deg) rotateZ(${(tx * 8).toFixed(1)}deg)`
      if (readout.current) readout.current.textContent = `x ${Math.round(tx * 45)}°  y ${Math.round(ty * 45)}°`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const mono = '500 10px/1.4 ui-monospace, Menlo, monospace'
  const btn = { padding: '7px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', background: accentColor, color: '#f4f1ea', font: '600 12px/1 system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }

  return (
    <div
      ref={root}
      onPointerMove={onPointerMove}
      onPointerLeave={onLeave}
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', overflow: 'hidden', background: bgColor }}
    >
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 2, 6], fov: 40, near: 0.1, far: 60 }} gl={{ antialias: true }}>
        <color attach="background" args={[bgColor]} />
        <hemisphereLight args={['#ffffff', '#8a7a68', 0.9]} />
        <directionalLight position={[-4, 6, 5]} intensity={1.6} />
        <directionalLight position={[5, 2, -4]} intensity={0.6} color="#cfe0ff" />
        <Model bodyColor={bodyColor} accentColor={accentColor} />
        <Rig cur={cur} sens={sensitivity} />
      </Canvas>

      <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none', color: accentColor }}>
        <div style={{ perspective: 160, width: 30, height: 48, display: 'grid', placeItems: 'center' }}>
          <div ref={glyph} aria-hidden="true" style={{ width: 24, height: 42, borderRadius: 6, border: `2px solid ${accentColor}`, background: 'rgba(255,255,255,.55)', position: 'relative', willChange: 'transform' }}>
            <div style={{ position: 'absolute', top: 3, left: '50%', width: 8, height: 2, marginLeft: -4, borderRadius: 2, background: accentColor, opacity: 0.6 }} />
            <div style={{ position: 'absolute', inset: '9px 3px 7px', borderRadius: 2, background: bodyColor, opacity: 0.85 }} />
          </div>
        </div>
        <div style={{ font: mono, letterSpacing: '.04em' }}>
          <div ref={readout}>x 0&deg; y 0&deg;</div>
          <div style={{ opacity: 0.65 }}>{source === 'sensor' ? 'device motion' : 'pointer'}</div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 12, top: 12, right: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
        {perm === 'needed' && source !== 'sensor' && (
          <button type="button" onClick={enable} style={{ ...btn, pointerEvents: 'auto' }}>
            Enable motion
          </button>
        )}
        <span style={{ font: mono, letterSpacing: '.04em', color: accentColor, opacity: 0.75 }}>
          {msg || (source === 'sensor' ? 'Tilt your phone to orbit' : 'Move the pointer to orbit')}
        </span>
      </div>
    </div>
  )
}
