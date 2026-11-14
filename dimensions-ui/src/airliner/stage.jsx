import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

// The hangar-sized photo studio shared by the aircraft (the airliner and the
// helicopter): the soft boxes their paint mirrors, the camera that flies
// between the views of a reference sheet, and the "i" hint.

export const FOV = 26
export const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))

// One huge soft box overhead and long strips down each side, which is what
// the paint and the glass mirror.
export function Studio() {
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={['#8d9195']} />
      <Lightformer form="rect" intensity={1.9} color="#ffffff" position={[0, 60, 0]} rotation-x={Math.PI / 2} scale={[150, 90, 1]} />
      <Lightformer form="rect" intensity={1.25} color="#fff6ea" position={[-30, 22, 70]} rotation-y={Math.PI} scale={[110, 22, 1]} />
      <Lightformer form="rect" intensity={1.0} color="#eaf1ff" position={[30, 22, -70]} scale={[110, 22, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[-80, 18, 0]} rotation-y={Math.PI / 2} scale={[70, 20, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#ffffff" position={[80, 18, 0]} rotation-y={-Math.PI / 2} scale={[70, 20, 1]} />
      {/* the studio floor, so the belly reflects something */}
      <Lightformer form="rect" intensity={0.5} color="#c9cbcd" position={[0, -30, 0]} rotation-x={-Math.PI / 2} scale={[300, 300, 1]} />
    </Environment>
  )
}

// Helpers for a table of views. Each view is a function of the canvas aspect
// giving { pos, target }: the whole-aircraft ones back off until it fits.
export const fit = (w, h, aspect) => Math.max(h / 2 / TAN, w / 2 / (TAN * aspect)) * 1.1
export const V = (x, y, z) => new THREE.Vector3(x, y, z)
export const from = (target, dir, dist) => ({ target, pos: target.clone().addScaledVector(dir.normalize(), dist) })

// Flies the camera to views[view]: straight there the first time, then on an
// eased path, and lets go again so the view can be orbited from where it lands.
export function CameraRig({ view, views, fallback = 'three-quarter' }) {
  const { camera, controls, size } = useThree()
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
      return
    }
    anim.current = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: v.pos, t1: v.target }
    // only the view (or the first sight of the controls) moves the camera: a resize leaves the user's orbit alone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, controls])
  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !controls) return
    a.t = Math.min(1, a.t + Math.min(dt, 1 / 30) / 1.6)
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2
    // swing round the aircraft rather than cutting through it
    const r = THREE.MathUtils.lerp(a.p0.distanceTo(a.t0), a.p1.distanceTo(a.t1), k)
    controls.target.lerpVectors(a.t0, a.t1, k)
    const d0 = a.p0.clone().sub(a.t0).normalize()
    const d1 = a.p1.clone().sub(a.t1).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(d0, d1)
    const dir = d0.applyQuaternion(new THREE.Quaternion().slerp(q, k))
    camera.position.copy(controls.target).addScaledVector(dir, r)
    controls.update()
    if (a.t >= 1) anim.current = null
  })
  return null
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
