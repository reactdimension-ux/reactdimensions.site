import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// Drag a crate across a gridded floor. Hold Shift while dragging (or switch on
// the on-screen "Lock axis" toggle, for touch) and the movement is locked to
// whichever axis, X or Z, you moved along first: a guide line shows the lane and
// a badge reads "Axis locked: X". Let go of Shift and it is free again. The
// crate lifts when held, follows on a spring, and drops with a small settle
// bounce on release; its soft shadow spreads as it rises. Optional snap-to-grid.
// Under prefers-reduced-motion it follows exactly, with no lift or bounce.

const BOUNDS = 4.5 // half-width of the floor you can carry it across
const SIZE = 1.0 // crate edge
const LIFT = 0.45
const PICK = 0.12 // how far you must move after locking before an axis is chosen

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

function useShadowTexture() {
  const tex = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 })
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.4, 'rgba(0,0,0,0.7)')
    grad.addColorStop(0.75, 'rgba(0,0,0,0.2)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

function Crate({ bodyColor, accentColor, snap, gridSize, shiftRef, toggleRef, onAxis, rootRef }) {
  const [hover, setHover] = useState(false)
  const [held, setHeld] = useState(false)
  useCursor(hover || held, held ? 'grabbing' : 'grab')
  const { camera } = useThree()
  const shadowTex = useShadowTexture()
  const reduced = useMemo(reducedMotion, [])

  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 }),
      accent: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4 }),
      shadow: new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: '#000000' }),
      guide: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }),
    }),
    [shadowTex],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.body.color.set(bodyColor)
    mats.accent.color.set(accentColor)
    mats.guide.color.set(accentColor)
  }, [mats, bodyColor, accentColor])

  const st = useRef({ x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, tx: 0, tz: 0, lean: 0 })
  // drag: grab offset; lock: anchor target + raw pointer at the moment of locking
  const drag = useRef(null)
  const lock = useRef({ on: false, axis: null, ax: 0, az: 0, rx: 0, rz: 0 })
  const group = useRef()
  const shadow = useRef()
  const guideX = useRef()
  const guideZ = useRef()
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const reportedAxis = useRef('~')

  useEffect(() => {
    const up = () => {
      if (!drag.current) return
      drag.current = null
      setHeld(false)
      lock.current.on = false
      lock.current.axis = null
    }
    const move = (e) => {
      if (drag.current) shiftRef.current = e.shiftKey
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('pointermove', move)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('pointermove', move)
    }
  }, [shiftRef])

  const onDown = (e) => {
    e.stopPropagation()
    const s = st.current
    drag.current = e.ray.intersectPlane(plane, hit) ? { ox: s.x - hit.x, oz: s.z - hit.z } : { ox: 0, oz: 0 }
    shiftRef.current = !!e.nativeEvent?.shiftKey
    lock.current.on = false
    lock.current.axis = null
    setHeld(true)
  }

  const snapV = (v) => (snap ? Math.round(v / gridSize) * gridSize : v)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const d = drag.current
    const lk = lock.current
    let report = null // 'free' | 'pending' | 'X' | 'Z'

    if (d) {
      state.raycaster.setFromCamera(state.pointer, camera)
      if (state.raycaster.ray.intersectPlane(plane, hit)) {
        const rx = hit.x + d.ox
        const rz = hit.z + d.oz
        const want = shiftRef.current || toggleRef.current
        if (want && !lk.on) {
          // lock just engaged: remember where we are and where the pointer is
          lk.on = true
          lk.axis = null
          lk.ax = s.tx
          lk.az = s.tz
          lk.rx = rx
          lk.rz = rz
        } else if (!want && lk.on) {
          lk.on = false
          lk.axis = null
        }
        let tx = rx
        let tz = rz
        if (lk.on) {
          const dx = rx - lk.rx
          const dz = rz - lk.rz
          if (!lk.axis && Math.max(Math.abs(dx), Math.abs(dz)) > PICK) lk.axis = Math.abs(dx) >= Math.abs(dz) ? 'X' : 'Z'
          tx = lk.axis === 'Z' ? lk.ax : lk.ax + dx
          tz = lk.axis === 'X' ? lk.az : lk.az + dz
          if (!lk.axis) {
            tx = lk.ax
            tz = lk.az
          }
          report = lk.axis || 'pending'
        } else report = 'free'
        tx = THREE.MathUtils.clamp(snapV(tx), -BOUNDS, BOUNDS)
        tz = THREE.MathUtils.clamp(snapV(tz), -BOUNDS, BOUNDS)
        s.tx = tx
        s.tz = tz
      }
    }
    if (report !== reportedAxis.current) {
      reportedAxis.current = report
      onAxis(report)
    }
    const ty = d && !reduced ? LIFT : 0

    if (reduced) {
      s.x = s.tx
      s.z = s.tz
      s.y = 0
      s.vx = s.vz = s.vy = 0
    } else if (dt > 1e-5) {
      const N = 4
      const h = dt / N
      const K = 170
      const C = 2 * 0.85 * Math.sqrt(K)
      const KY = d ? 150 : 220
      const CY = 2 * (d ? 0.9 : 0.4) * Math.sqrt(KY)
      for (let i = 0; i < N; i++) {
        s.vx += (K * (s.tx - s.x) - C * s.vx) * h
        s.vz += (K * (s.tz - s.z) - C * s.vz) * h
        s.x += s.vx * h
        s.z += s.vz * h
        s.vy += (KY * (ty - s.y) - CY * s.vy) * h
        s.y += s.vy * h
        if (s.y < 0) {
          s.y = 0
          s.vy = -s.vy * 0.35 // the settle bounce
          if (Math.abs(s.vy) < 0.06) s.vy = 0
        }
      }
    }

    group.current.position.set(s.x, s.y + SIZE / 2, s.z)
    group.current.rotation.set(reduced ? 0 : THREE.MathUtils.clamp(s.vz * 0.04, -0.2, 0.2), 0, reduced ? 0 : THREE.MathUtils.clamp(-s.vx * 0.04, -0.2, 0.2))
    const k = Math.min(1.5, s.y / LIFT)
    shadow.current.position.set(s.x, 0.004, s.z)
    shadow.current.scale.set(SIZE * (1.7 + k * 0.7), SIZE * (1.7 + k * 0.7), 1)
    mats.shadow.opacity = 0.6 / (1 + k * 1.3)

    // guide line along the locked axis, through the anchor
    const gx = guideX.current
    const gz = guideZ.current
    gx.visible = lk.on && lk.axis === 'X' && !!d
    gz.visible = lk.on && lk.axis === 'Z' && !!d
    if (gx.visible) gx.position.set(0, 0.012, lk.az)
    if (gz.visible) gz.position.set(lk.ax, 0.012, 0)
    if (rootRef.current) rootRef.current.dataset.pos = `${s.tx.toFixed(2)},${s.tz.toFixed(2)}`
  })

  const hoverProps = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }

  return (
    <>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} material={mats.shadow} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={guideX} rotation-x={-Math.PI / 2} material={mats.guide} renderOrder={2} visible={false}>
        <planeGeometry args={[BOUNDS * 2 + 3, 0.06]} />
      </mesh>
      <mesh ref={guideZ} rotation-x={-Math.PI / 2} material={mats.guide} renderOrder={2} visible={false}>
        <planeGeometry args={[0.06, BOUNDS * 2 + 3]} />
      </mesh>
      <group ref={group} onPointerDown={onDown} {...hoverProps}>
        <RoundedBox args={[SIZE, SIZE, SIZE]} radius={0.08} smoothness={4} material={mats.body} />
        {/* slats and corner straps so the crate reads as a crate */}
        {[-0.28, 0.28].map((y) => (
          <mesh key={y} material={mats.accent} position={[0, y, 0]}>
            <boxGeometry args={[SIZE + 0.02, 0.12, SIZE + 0.02]} />
          </mesh>
        ))}
        <mesh material={mats.accent} position={[0, 0, SIZE / 2 + 0.012]}>
          <boxGeometry args={[0.34, 0.34, 0.03]} />
        </mesh>
      </group>
    </>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(17))
    const dist = Math.max(9 / 2 / tan, 9.5 / 2 / (tan * aspect)) * 0.95
    camera.position.set(0, dist * 0.78, dist * 0.62)
    camera.lookAt(0, 0.2, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function AxisLockDrag({ bodyColor = '#e8e4da', accentColor = '#ff4d1a', floorColor = '#d9d4cb', snapToGrid = false, gridSize = 0.5 }) {
  const shiftRef = useRef(false)
  const toggleRef = useRef(false)
  const rootRef = useRef(null)
  const [axis, setAxis] = useState(null)
  const [lockOn, setLockOn] = useState(false)

  useEffect(() => {
    const kd = (e) => {
      if (e.key === 'Shift') shiftRef.current = true
    }
    const ku = (e) => {
      if (e.key === 'Shift') shiftRef.current = false
    }
    const blur = () => {
      shiftRef.current = false
    }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const mono = 'ui-monospace, Menlo, Consolas, monospace'
  const locked = axis === 'X' || axis === 'Z'
  const showBadge = axis === 'X' || axis === 'Z' || axis === 'pending'

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 9, 8], fov: 34, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={[floorColor]} />
        <fog attach="fog" args={[floorColor, 18, 36]} />
        <hemisphereLight args={['#ffffff', '#8a7a68', 0.35]} />
        <directionalLight position={[-5, 9, 6]} intensity={0.6} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color={floorColor} roughness={0.9} />
        </mesh>
        <gridHelper args={[BOUNDS * 2 + 2, Math.max(2, Math.round((BOUNDS * 2 + 2) / gridSize)), '#6d675d', '#a8a196']} position-y={0.002} />
        <Crate bodyColor={bodyColor} accentColor={accentColor} snap={snapToGrid} gridSize={gridSize} shiftRef={shiftRef} toggleRef={toggleRef} onAxis={setAxis} rootRef={rootRef} />
        <Rig />
      </Canvas>

      {showBadge && (
        <div role="status" style={{ position: 'absolute', left: 12, top: 12, padding: '6px 12px', borderRadius: 999, background: accentColor, color: '#fff', font: '700 12px/1.4 ' + mono, letterSpacing: '0.04em', boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
          {locked ? `Axis locked: ${axis}` : 'Axis lock: move to choose'}
        </div>
      )}

      <button
        type="button"
        aria-pressed={lockOn}
        onClick={() => {
          toggleRef.current = !toggleRef.current
          setLockOn(toggleRef.current)
        }}
        style={{ position: 'absolute', left: 12, bottom: 12, padding: '9px 14px', minHeight: 40, borderRadius: 999, border: 'none', cursor: 'pointer', font: '700 12px/1 ' + mono, background: lockOn ? '#1c1a16' : 'rgba(255,255,255,0.92)', color: lockOn ? '#f4f1ea' : '#2a2925', boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)' }}
      >
        Lock axis: {lockOn ? 'on' : 'off'}
      </button>
      <div style={{ position: 'absolute', right: 12, bottom: 14, font: '500 11px/1.5 ' + mono, color: '#2a2925', textShadow: '0 1px 0 rgba(255,255,255,.5)', pointerEvents: 'none', textAlign: 'right' }}>
        Drag the crate · hold Shift to lock to one axis
      </div>
    </div>
  )
}
