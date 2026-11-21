import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Piano, { dynamic } from './Piano.jsx'
import { FIRST_NOTE, LAST_NOTE, noteName } from './layout.js'
import ControlDock from '../controls/ControlDock.jsx'

// a concert-hall feel: a big soft light overhead and tall strips either side,
// which is what makes black lacquer read as glossy rather than flat black
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#5c5a58']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 400, 0]} rotation-x={Math.PI / 2} scale={[500, 300, 1]} />
      <Lightformer form="rect" intensity={2.0} color="#fff6ea" position={[-320, 160, 120]} rotation-y={Math.PI / 3} scale={[80, 260, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[320, 160, 60]} rotation-y={-Math.PI / 3} scale={[80, 260, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 120, -360]} scale={[400, 140, 1]} />
    </Environment>
  )
}

const TARGET = [0, 66, -80]

// from the audience side, where the open lid faces
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const tan = Math.tan(THREE.MathUtils.degToRad(17.5))
    const dist = Math.max(215 / 2 / tan, 320 / 2 / (tan * aspect))
    camera.position.copy(new THREE.Vector3(0.62, 0.52, 1).normalize().multiplyScalar(dist).add(new THREE.Vector3(...TARGET)))
    camera.lookAt(...TARGET)
  }, [camera, size.width, size.height])
  return null
}

// computer keys: two rows like a piano keyboard, starting on C
const KEY_MAP = Object.fromEntries('awsedftgyhujkolp;'.split('').map((ch, i) => [ch, i]))

export default function PianoScene({ background = '#e6e4e0', autoRotate = false, ...props }) {
  const piano = useRef()
  const box = useRef()
  const [focused, setFocused] = useState(false)
  const [octave, setOctave] = useState(4)
  const [last, setLast] = useState(null)
  const [state, setState] = useState({ soft: 0, sost: 0, sustain: 0, lid: 'open' })
  const [midi, setMidi] = useState('')
  const down = useRef(new Map()) // computer key -> note index

  const index = (e) => {
    const semi = KEY_MAP[e.key.toLowerCase()]
    if (semi === undefined) return null
    const n = (octave + 1) * 12 + semi
    return n >= FIRST_NOTE && n <= LAST_NOTE ? n - FIRST_NOTE : null
  }
  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.code === 'Space') {
      e.preventDefault()
      return piano.current?.setPedal('sustain', true)
    }
    if (e.key === 'Shift') return piano.current?.setPedal('soft', true)
    if (e.repeat) return
    if (e.key === 'z') return setOctave((o) => Math.max(0, o - 1))
    if (e.key === 'x') return setOctave((o) => Math.min(7, o + 1))
    const i = index(e)
    if (i === null) return
    e.preventDefault()
    down.current.set(e.code, i)
    piano.current?.press(i, e.shiftKey ? 60 : 92)
  }
  const onKeyUp = (e) => {
    if (e.code === 'Space') return piano.current?.setPedal('sustain', false)
    if (e.key === 'Shift') return piano.current?.setPedal('soft', false)
    const i = down.current.get(e.code)
    if (i !== undefined) {
      down.current.delete(e.code)
      piano.current?.release(i)
    }
  }

  // a real MIDI keyboard plays it, pedals included
  const access = useRef(null)
  const connectMidi = async () => {
    if (!navigator.requestMIDIAccess) return setMidi('This browser has no Web MIDI')
    try {
      const a = await navigator.requestMIDIAccess()
      access.current = a
      const hook = () => {
        const names = []
        a.inputs.forEach((input) => {
          names.push(input.name)
          input.onmidimessage = ({ data }) => {
            const [st, d1, d2] = data
            const cmd = st & 0xf0
            const i = d1 - FIRST_NOTE
            if (cmd === 0x90 && d2 > 0) piano.current?.press(i, d2)
            else if (cmd === 0x80 || cmd === 0x90) piano.current?.release(i)
            else if (cmd === 0xb0) {
              const pedal = { 64: 'sustain', 66: 'sost', 67: 'soft' }[d1]
              if (pedal) piano.current?.setPedal(pedal, d2 >= 64)
            }
          }
        })
        setMidi(names.length ? `MIDI: ${names.join(', ')}` : 'No MIDI keyboard found')
      }
      hook()
      a.onstatechange = hook
    } catch {
      setMidi('MIDI access was not allowed')
    }
  }
  useEffect(
    () => () => {
      access.current?.inputs.forEach((input) => (input.onmidimessage = null))
      if (access.current) access.current.onstatechange = null
    },
    [],
  )

  const btn = { pointerEvents: 'auto', font: '600 12px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 16px', borderRadius: 999, border: 'none', background: '#1c1a16', color: '#f4f1ea', cursor: 'pointer' }
  const chip = (on) => ({ ...btn, background: on ? '#1c1a16' : '#f4f1ea', color: on ? '#f4f1ea' : '#1c1a16', boxShadow: 'inset 0 0 0 1.5px #1c1a16' })
  const lidOpen = state.lid === 'open' || state.lid === 'opening'

  return (
    <div
      ref={box}
      tabIndex={0}
      aria-label="Grand piano. Click or drag across the keys to play. With the piano focused: A W S E D F T G Y H U J K O L P ; play from C, Z and X change octave, Space is the sustain pedal, Shift the soft pedal."
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPointerDown={() => box.current?.focus({ preventScroll: true })}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        down.current.clear()
        piano.current?.releaseAll()
        piano.current?.setPedal('sustain', false)
        piano.current?.setPedal('soft', false)
      }}
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background, userSelect: 'none', WebkitUserSelect: 'none', outline: 'none' }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [200, 220, 260], fov: 35, near: 2, far: 2000 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#8b8780', 0.4]} />
        <directionalLight position={[120, 320, 160]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-camera-left={-180} shadow-camera-right={180} shadow-camera-top={180} shadow-camera-bottom={-180} shadow-camera-far={800} />
        <Studio />
        <Piano ref={piano} {...props} onNote={(n, v) => setLast({ n, v })} onState={setState} />
        <ContactShadows position={[0, 0.05, -75]} opacity={0.55} scale={360} blur={2.5} far={90} resolution={1024} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} target={TARGET} autoRotate={autoRotate} autoRotateSpeed={0.4} minDistance={45} maxDistance={900} maxPolarAngle={1.5} />
      </Canvas>

      <ControlDock corner="tl">
        <button onClick={() => piano.current?.toggleLid()} style={btn}>
          {lidOpen ? 'Close lid' : 'Open lid'}
        </button>
        <button
          onPointerDown={() => piano.current?.setPedal('sustain', !state.sustain)}
          style={chip(state.sustain)}
          aria-pressed={!!state.sustain}
        >
          Sustain
        </button>
        <button onClick={connectMidi} style={chip(false)}>
          MIDI
        </button>
        <span aria-live="polite" style={{ font: '600 12px/1 ui-monospace, Menlo, monospace', color: '#1c1a16', background: last ? '#f4f1ea' : 'transparent', padding: '8px 10px', borderRadius: 8, minWidth: 90 }}>
          {last ? `${noteName(last.n)} · ${dynamic(last.v)}` : ''}
        </span>
      </ControlDock>
      <InfoHint>
        {midi && (
          <>
            {midi}
            <br />
          </>
        )}
        Click or drag across the keys (nearer the front is louder) · press the pedals · click the lid
        <br />
        {focused ? `Keys: A W S E D F T G Y H U J K O L P ; from C${octave} · Z X octave · Space sustain · Shift soft pedal` : 'Click the piano to play it from your keyboard too'}
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
