import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line } from '@react-three/drei'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

// The tabletop studio shared by the board models (the game board and the
// chessboard): camera views that fly into place, soft boxes for lacquer to
// mirror, a table with soft contact shadows, dimension callouts, the
// post-processing, the view tabs and the "i" hint.

export const FOV = 30
export const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))

// Flies the camera to views[view] (a function of the canvas aspect giving
// { pos, target }): instantly the first time, then along an easy arc. The
// canvas draws on demand, so the rig asks for frames while it moves.
export function CameraRig({ view, views, fallback }) {
  const { camera, controls, size, invalidate } = useThree()
  const anim = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    if (!controls) return
    const v = (views[view] || views[fallback])(size.width / size.height)
    if (first.current) {
      first.current = false
      camera.position.copy(v.pos)
      controls.target.copy(v.target)
      controls.update()
      invalidate()
      return
    }
    anim.current = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: v.pos, t1: v.target, lift: camera.position.distanceTo(v.pos) * 0.12 }
    invalidate()
  }, [view, views, fallback, controls, camera, size.width, size.height, invalidate])
  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !controls) return
    a.t = Math.min(1, a.t + Math.min(dt, 1 / 30) / 1.4)
    const k = a.t < 0.5 ? 4 * a.t * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 3) / 2
    camera.position.lerpVectors(a.p0, a.p1, k)
    camera.position.y += Math.sin(Math.PI * k) * a.lift
    controls.target.lerpVectors(a.t0, a.t1, k)
    controls.update()
    invalidate()
    if (a.t >= 1) anim.current = null
  })
  return null
}

// soft boxes for the lacquer and the laminate to mirror
export function Studio() {
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={['#4a4c50']} />
      <Lightformer form="rect" intensity={3.2} color="#ffffff" position={[0, 3, 0.5]} rotation-x={Math.PI / 2} scale={[2.2, 1.4, 1]} />
      <Lightformer form="rect" intensity={1.8} color="#fff1e0" position={[-2.5, 1.4, 1.8]} rotation-y={Math.PI / 4} scale={[1.2, 2, 1]} />
      <Lightformer form="rect" intensity={1.0} color="#e9f0ff" position={[2.6, 1.2, -1.2]} rotation-y={-Math.PI / 1.5} scale={[1.6, 1.6, 1]} />
      <Lightformer form="circle" intensity={0.6} color="#ffffff" position={[0, 0.6, 3]} scale={1.5} />
    </Environment>
  )
}

// the key light, its shadow fitted to a tabletop object `half` metres across
export function KeyLight({ half = 0.6, intensity = 2.1 }) {
  return (
    <directionalLight position={[-0.9, 1.6, 0.8]} intensity={intensity} color="#fff6ea" castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0001} shadow-normalBias={0.002}>
      <orthographicCamera attach="shadow-camera" args={[-half, half, half, -half, 0.2, 5]} />
    </directionalLight>
  )
}

export function Table({ scale = 1.6 }) {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.0005} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.32} />
      </mesh>
      <ContactShadows position={[0, 0.0008, 0]} scale={scale} resolution={1024} blur={2} far={0.06} opacity={0.75} color="#101113" frames={1} />
    </>
  )
}

const V = (a) => new THREE.Vector3(...a)
export function Label({ position, children }) {
  return (
    <Html position={position} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ whiteSpace: 'nowrap', padding: '3px 8px', borderRadius: 999, background: 'rgba(20,21,24,0.82)', color: '#efede6', font: '600 10.5px/1.2 ui-monospace, Menlo, monospace', letterSpacing: '0.04em', boxShadow: '0 2px 8px rgba(0,0,0,.3), inset 0 0 0 1px rgba(255,255,255,.12)' }}>{children}</div>
    </Html>
  )
}
// a dimension line from a to b with end ticks along `tick`
export function Dim({ a, b, tick, label, at }) {
  const A = V(a)
  const B = V(b)
  const t = V(tick)
  return (
    <group>
      <Line points={[A.clone().add(t), A.clone().sub(t)]} color="#e8e6e0" lineWidth={1.3} />
      <Line points={[A, B]} color="#e8e6e0" lineWidth={1.3} />
      <Line points={[B.clone().add(t), B.clone().sub(t)]} color="#e8e6e0" lineWidth={1.3} />
      <Label position={at || A.clone().lerp(B, 0.5).toArray()}>{label}</Label>
    </group>
  )
}

export function Effects({ ao, radius = 0.02 }) {
  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {ao && <N8AO aoRadius={radius} distanceFalloff={0.5} intensity={2} quality="medium" halfRes />}
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

export const segBtn = (on) => ({
  height: 28,
  padding: '0 11px',
  borderRadius: 14,
  border: 'none',
  cursor: 'pointer',
  background: on ? '#1c1a16' : 'transparent',
  color: on ? '#f4f1ea' : '#2a2925',
  font: '600 10.5px/1 ui-monospace, Menlo, monospace',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
})
export const pill = { pointerEvents: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, padding: 3, borderRadius: 17, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,.18), inset 0 0 0 1px rgba(0,0,0,.07)' }

// the view picker: one pill of main views and one of close-ups
export function ViewTabs({ main, detail, view, setView, label = (v) => v }) {
  return (
    <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, pointerEvents: 'none', padding: '0 12px' }}>
      {[
        [main, 'Camera view'],
        [detail, 'Close-ups'],
      ].map(([list, aria]) => (
        <div key={aria} role="tablist" aria-label={aria} style={pill}>
          {list.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} style={segBtn(view === v)} onClick={() => setView(v)}>
              {label(v)}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// The usage tips live behind a small "i" button in the corner instead of a
// line of text over the scene: hover it (or tap it) to read them.
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
