import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import FaceBoard from './FaceBoard.jsx'
import ControlDock from '../controls/ControlDock.jsx'

const BG = '#e9e7e3'
const MAX = 50 // the most frames a board can have (5 rows of 10)
const STORE = 'rd-faceboard-photos-v1'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c4c6c9']} />
      <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 6, 2]} rotation-x={Math.PI / 2} scale={[8, 6, 1]} />
      <Lightformer form="rect" intensity={1.3} color="#fff1df" position={[-4, 2, 3]} rotation-y={Math.PI / 4} scale={[2, 5, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#eef3ff" position={[4, 2, 3]} rotation-y={-Math.PI / 4} scale={[2, 5, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 2, -6]} rotation-y={Math.PI} scale={[8, 4, 1]} />
    </Environment>
  )
}

// From where a player sits: in front of the board and above it.
function Rig({ rows, cols }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const w = cols * 0.0395 + 0.06
    const d = rows * 0.074 + 0.14
    const target = new THREE.Vector3(0, 0.04, -0.01)
    const dist = Math.max((d * 0.8 + 0.06) / 2 / tan, w / 2 / (tan * aspect)) * 0.98
    const el = 0.58
    camera.position.set(0.04 * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(el) * dist)
    camera.lookAt(target)
    if (controls) {
      controls.target.copy(target)
      controls.update()
    }
  }, [camera, size.width, size.height, rows, cols, controls])
  return null
}

// a photo, scaled down so a board full of them stays small enough to keep
const shrink = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, 360 / Math.max(img.width, img.height))
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * s), height: Math.round(img.height * s) })
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.86))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
// "anna_smith-2.jpg" -> "Anna"
const nameOf = (file) => {
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[_\-.]+/g, ' ').trim()
  const first = base.split(/\s+/)[0] || ''
  return (first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()).slice(0, 12)
}

const btn = (dark) => ({
  height: 32,
  padding: '0 14px',
  borderRadius: 16,
  border: 'none',
  cursor: 'pointer',
  background: dark ? '#1c1a16' : 'rgba(255,255,255,0.9)',
  color: dark ? '#f4f1ea' : '#2a2925',
  font: '600 11px/1 ui-monospace, Menlo, monospace',
  letterSpacing: '0.05em',
  boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)',
})

export default function FaceBoardScene({ autoRotate = false, rows = 3, cols = 8, ...props }) {
  const [photos, setPhotos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null')
      if (Array.isArray(saved)) return saved.slice(0, MAX)
    } catch {
      /* no storage here: start empty */
    }
    return []
  })
  const [secret, setSecret] = useState(-1)
  const [flipUp, setFlipUp] = useState(0)
  const [drag, setDrag] = useState(false)
  const [note, setNote] = useState('')
  const api = useRef(null)
  const input = useRef(null)
  const R = Math.max(1, Math.min(5, rows | 0))
  const C = Math.max(2, Math.min(10, cols | 0))
  const N = R * C

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(photos))
    } catch {
      /* too big or not allowed: they still show, they just won't be kept */
    }
  }, [photos])
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(''), 2600)
    return () => clearTimeout(t)
  }, [note])

  // put files on the board: the first onto `at` if given, the rest into the
  // empty frames in order
  const place = async (files, at = -1) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    const loaded = (await Promise.all(list.map(async (f) => ({ src: await shrink(f), name: nameOf(f) })))).filter((p) => p.src)
    setPhotos((prev) => {
      const next = Array.from({ length: Math.max(prev.length, N) }, (_, i) => prev[i] || null)
      let k = 0
      if (at >= 0 && at < N && loaded[0]) next[at] = loaded[k++]
      for (let i = 0; i < N && k < loaded.length; i++) if (!next[i]) next[i] = loaded[k++]
      if (k < loaded.length) setNote(`Board full: ${loaded.length - k} photo${loaded.length - k > 1 ? 's' : ''} left over`)
      return next
    })
  }
  const filled = photos.slice(0, N).map((p, i) => (p ? i : -1)).filter((i) => i >= 0)

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', outline: drag ? '3px dashed #2b62d9' : 'none', outlineOffset: -6 }}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault()
          setDrag(true)
        }
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        const at = api.current?.pick(e.clientX, e.clientY) ?? -1
        place(e.dataTransfer.files, at)
      }}
    >
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0.02, 0.35, 0.5], fov: 30, near: 0.01, far: 20 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#d6d3cc', 0.35]} />
        <directionalLight position={[-0.6, 1.6, 1]} intensity={1.15} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.004}>
          <orthographicCamera attach="shadow-camera" args={[-0.5, 0.5, 0.5, -0.5, 0.1, 4]} />
        </directionalLight>
        <Studio />
        <FaceBoard {...props} rows={R} cols={C} photos={photos} secret={secret} flipUp={flipUp} api={api} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.0005, 0]} receiveShadow>
          <planeGeometry args={[6, 6]} />
          <shadowMaterial opacity={0.2} />
        </mesh>
        <ContactShadows position={[0, 0.0002, 0]} opacity={0.45} scale={0.9} blur={1.8} far={0.1} resolution={1024} color="#1e1a14" />
        <Rig rows={R} cols={C} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={0.15} maxDistance={2} minPolarAngle={0.05} maxPolarAngle={1.45} />
      </Canvas>

      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (place(e.target.files), (e.target.value = ''))} />
      <ControlDock corner="bl">
        <button type="button" style={btn(true)} onClick={() => input.current?.click()}>
          Add photos
        </button>
        <button type="button" style={btn(false)} onClick={() => setFlipUp((n) => n + 1)}>
          Flip all up
        </button>
        <button type="button" style={btn(false)} disabled={!filled.length} onClick={() => setSecret(filled[Math.floor(Math.random() * filled.length)] ?? -1)}>
          Pick secret
        </button>
        {photos.some(Boolean) && (
          <button
            type="button"
            style={btn(false)}
            onClick={() => {
              if (window.confirm('Remove all the photos from the board?')) {
                setPhotos([])
                setSecret(-1)
              }
            }}
          >
            Clear
          </button>
        )}
      </ControlDock>
      {(drag || note) && (
        <div style={{ position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)', zIndex: 6, padding: '8px 14px', borderRadius: 12, background: 'rgba(28,26,22,0.88)', color: '#f4f1ea', font: '600 11px/1.4 ui-monospace, Menlo, monospace', letterSpacing: '0.03em', pointerEvents: 'none' }}>
          {drag ? 'Drop photos: onto a frame to put one there, anywhere else to fill the empty frames' : note}
        </div>
      )}
      <InfoHint>Add photos, or drop image files onto the board (onto a frame to put one there) · names come from the file names · click a frame to flip it down, click again to flip it up · Pick secret puts a card in your holder · your photos stay in this browser</InfoHint>
    </div>
  )
}

// The usage tips live behind a small "i" button in the corner instead of a
// line of text over the scene: hover it (or tap it) to read them.
function InfoHint({ children }) {
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
