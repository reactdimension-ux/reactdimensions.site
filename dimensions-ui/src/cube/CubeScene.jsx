import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Cube from './Cube.jsx'

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#c4c4c4']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-8, 10, 6]} rotation-y={Math.PI / 4} scale={[8, 10, 1]} />
      <Lightformer form="rect" intensity={1.3} color="#ffffff" position={[8, 8, 6]} rotation-y={-Math.PI / 4} scale={[8, 8, 1]} />
      <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[16, 8, 1]} />
    </Environment>
  )
}

// three-quarter view onto the front, right and top faces, framed to fit
function Rig({ n }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(15))
    const span = n * 2.35
    const dist = Math.max(span / 2 / tan, span / 2 / (tan * aspect)) * 1.05
    camera.position.copy(new THREE.Vector3(1, 0.85, 1.2).normalize().multiplyScalar(dist))
    camera.lookAt(0, 0, 0)
  }, [camera, size.width, size.height, n])
  return null
}

const clock = (ms) => {
  const t = Math.floor(ms / 1000)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

const KEYS = 'UDLRFBMES'

export default function CubeScene({
  size = '3',
  upColor = '#ffffff',
  downColor = '#f2d500',
  frontColor = '#12a83c',
  backColor = '#1446d6',
  rightColor = '#d81620',
  leftColor = '#f08a10',
  bodyColor = '#111111',
  background = '#e4e4e4',
  speed = 1,
  sound = false,
  autoRotate = false,
}) {
  const n = Math.min(5, Math.max(2, Number(size) || 3))
  const cube = useRef()
  // idle | scrambling | ready | playing | solved | solving
  const [status, setStatus] = useState('idle')
  const [moves, setMoves] = useState(0)
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [, tick] = useState(0)
  // whether the cube is in its solved state right now (any turn, by anyone,
  // can change it); Solve has nothing to do while it is
  const [isSolved, setIsSolved] = useState(true)
  const statusRef = useRef(status)
  statusRef.current = status

  const colors = useMemo(
    () => ({ up: upColor, down: downColor, front: frontColor, back: backColor, right: rightColor, left: leftColor }),
    [upColor, downColor, frontColor, backColor, rightColor, leftColor],
  )

  // a new size is a new, solved cube
  useEffect(() => {
    setStatus('idle')
    setMoves(0)
    setStart(null)
    setEnd(null)
    setIsSolved(true)
  }, [n])

  // the clock only needs repainting while it runs
  useEffect(() => {
    if (status !== 'playing' || !start) return
    const id = setInterval(() => tick((x) => x + 1), 250)
    return () => clearInterval(id)
  }, [status, start])

  const onTurn = ({ tag, turned, solved, drained }) => {
    const now = statusRef.current
    if (turned) setIsSolved(solved)
    if (tag === 'scramble' && drained) {
      setStatus('ready')
      setMoves(0)
      setStart(null)
      setEnd(null)
    } else if (tag === 'solve' && drained) {
      setStatus('idle')
    } else if (tag === 'user' && turned) {
      if (now === 'ready' || now === 'playing') {
        setMoves((m) => m + 1)
        if (now === 'ready') setStart(performance.now())
        if (solved) {
          setEnd(performance.now())
          setStatus('solved')
        } else if (now === 'ready') setStatus('playing')
      } else if (now === 'solved' && !solved) setStatus('idle')
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toUpperCase()
      if (k.length !== 1 || !KEYS.includes(k)) return
      e.preventDefault()
      cube.current?.move(k, e.shiftKey)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const scramble = () => {
    cube.current?.reset()
    setStatus('scrambling')
    cube.current?.scramble()
  }
  const solve = () => {
    setStatus('solving')
    cube.current?.solve()
  }
  const reset = () => {
    cube.current?.reset()
    setIsSolved(true)
    setStatus('idle')
    setMoves(0)
    setStart(null)
    setEnd(null)
  }

  const busy = status === 'scrambling' || status === 'solving'
  const elapsed = start ? (end ?? performance.now()) - start : 0
  const readout =
    status === 'scrambling' ? 'Scrambling…'
    : status === 'solving' ? 'Solving…'
    : status === 'ready' ? 'Make a move to start the clock'
    : status === 'playing' ? `${moves} ${moves === 1 ? 'move' : 'moves'} · ${clock(elapsed)}`
    : status === 'solved' ? `Solved in ${moves} moves · ${clock(elapsed)}`
    : ''

  const btn = (primary, off = busy) => ({
    pointerEvents: 'auto',
    font: '600 12px/1 ui-monospace, Menlo, monospace',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '11px 16px',
    borderRadius: 999,
    border: primary ? 'none' : '1px solid rgba(28,26,22,.25)',
    background: primary ? '#1c1a16' : 'rgba(255,255,255,.7)',
    color: primary ? '#f4f1ea' : '#1c1a16',
    cursor: off ? 'default' : 'pointer',
    opacity: off ? 0.5 : 1,
  })

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background, userSelect: 'none', WebkitUserSelect: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [6, 5, 7], fov: 30, near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#8a8a8a', 0.5]} />
        <directionalLight position={[-4, 10, 6]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <Studio />
        <Cube ref={cube} size={n} colors={colors} bodyColor={bodyColor} speed={speed} sound={sound} onTurn={onTurn} />
        <ContactShadows position={[0, -n / 2 - 0.35, 0]} opacity={0.35} scale={n * 3.2} blur={2.4} far={n} />
        <Rig n={n} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={n * 2.5} maxDistance={n * 12} />
      </Canvas>

      <div style={{ position: 'absolute', top: 14, left: 12, right: 12, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        <button onClick={scramble} disabled={busy} style={btn(true)}>Scramble</button>
        <button onClick={solve} disabled={busy || isSolved} style={btn(false, busy || isSolved)}>Solve</button>
        <button onClick={reset} disabled={busy} style={btn(false)}>Reset</button>
      </div>
      <div
        aria-live="polite"
        style={{ position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', font: `${status === 'solved' ? 700 : 500} 13px/1 ui-monospace, Menlo, monospace`, color: '#2a2925' }}
      >
        {readout}
      </div>
      <InfoHint>
        Drag a face to turn a layer · drag the background to look around
        <br />
        Keys {n % 2 ? 'U D L R F B M E S' : 'U D L R F B'} · Shift turns the other way
      </InfoHint>
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
