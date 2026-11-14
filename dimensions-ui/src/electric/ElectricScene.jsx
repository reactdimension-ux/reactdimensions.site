import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Electric from './Electric.jsx'
import { CHORDS, TUNINGS } from './strings.js'
import { JACK, KNOBS, NUT_Y, PICKUP_Y, SADDLE_Y, TOP } from './shapes.js'
import { CameraRig, Dim, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, Table, ViewTabs, pill } from '../gameboard/stage.jsx'

// The electric guitar standing upright over a pale studio floor, as on a
// product sheet, in the shared tabletop studio (from the board models).

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#e2e3e4'
const LIFT = 0.07 // the guitar's bottom is this far off the floor
// a little below the middle, so the controls along the bottom don't hide the body
const MID = V(0, LIFT + 0.42, 0)
const near = (a) => Math.max(1, 1 / a)
const fit = (a) => Math.max((0.98 / 2) * 1.12, (0.36 / 2) * 1.12 / Math.min(a, 1)) / T
const at = (x, y, z) => V(x, y + LIFT, z)
const close = (target, offset) => (a) => {
  const k = near(a)
  return { pos: target.clone().add(offset.clone().multiplyScalar(k)), target }
}
const VIEWS = {
  Front: (a) => ({ pos: V(0, MID.y, fit(a)), target: MID }),
  Back: (a) => ({ pos: V(0, MID.y, -fit(a)), target: MID }),
  Left: (a) => ({ pos: V(-fit(a), MID.y, 0), target: MID }),
  Right: (a) => ({ pos: V(fit(a), MID.y, 0), target: MID }),
  Top: (a) => ({ pos: V(0.001, MID.y + fit(a) * 0.9, 0.35), target: at(0, 0.55, 0) }),
  'Front-L': (a) => ({ pos: V(-0.55, 0.1, 0.83).normalize().multiplyScalar(fit(a)).add(MID), target: MID }),
  'Front-R': (a) => ({ pos: V(0.55, 0.1, 0.83).normalize().multiplyScalar(fit(a)).add(MID), target: MID }),
  'Back-L': (a) => ({ pos: V(-0.55, 0.1, -0.83).normalize().multiplyScalar(fit(a)).add(MID), target: MID }),
  'Back-R': (a) => ({ pos: V(0.55, 0.1, -0.83).normalize().multiplyScalar(fit(a)).add(MID), target: MID }),
  'A · Head': close(at(-0.012, NUT_Y + 0.1, TOP), V(0.07, -0.02, 0.26)),
  'B · Neck': close(at(0, NUT_Y - 0.2, TOP), V(0.12, -0.06, 0.2)),
  'C · Pickups': close(at(0, PICKUP_Y.middle, TOP), V(0.1, -0.07, 0.19)),
  'D · Bridge': close(at(0, SADDLE_Y - 0.01, TOP), V(0.06, -0.06, 0.11)),
  'E · Controls': close(at(KNOBS[1].x, KNOBS[1].y + 0.02, TOP), V(0.03, -0.06, 0.12)),
  'F · Jack': close(at(JACK.x - 0.02, JACK.y + 0.01, 0), V(0.14, -0.06, 0.1)),
}
const MAIN = ['Front', 'Back', 'Left', 'Right', 'Top', 'Front-L', 'Front-R', 'Back-L', 'Back-R']
const DETAIL = ['A · Head', 'B · Neck', 'C · Pickups', 'D · Bridge', 'E · Controls', 'F · Jack']
const POSITIONS = ['bridge', 'bridge + middle', 'middle', 'middle + neck', 'neck']

function Dimensions() {
  const top = LIFT + NUT_Y + 0.196
  return (
    <group>
      <Dim a={[-0.24, LIFT + 0.004, 0]} b={[-0.24, top, 0]} tick={[0.012, 0, 0]} label="97 cm · 38″" at={[-0.28, (LIFT + top) / 2, 0]} />
      <Dim a={[-0.16, LIFT - 0.03, 0]} b={[0.152, LIFT - 0.03, 0]} tick={[0, 0.012, 0]} label="32 cm" />
      <Dim a={[0.2, LIFT + SADDLE_Y, 0]} b={[0.2, LIFT + NUT_Y, 0]} tick={[0.012, 0, 0]} label={'scale 25.5″ · 648 mm'} at={[0.27, LIFT + (SADDLE_Y + NUT_Y) / 2, 0]} />
    </group>
  )
}

export default function ElectricScene({ finish = 'sunburst', guard = '#f1eee4', sound = true, drive = 0.2, vibration = 'slow-motion', dimensions = false, ambientOcclusion = true, autoRotate = false, view: initialView = 'Front-L' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const guitar = useRef()
  const [info, setInfo] = useState(null)
  const [tuning, setTuning] = useState('standard')
  const chip = (on) => ({ height: 26, padding: '0 9px', borderRadius: 13, border: 'none', cursor: 'pointer', background: on ? '#1c1a16' : 'transparent', color: on ? '#f4f1ea' : '#2a2925', font: '600 10.5px/1 ui-monospace, Menlo, monospace' })
  const btn = { ...pill, height: 32, padding: '0 14px', border: 'none', cursor: 'pointer', background: '#1c1a16', color: '#f4f1ea', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }
  const sel = info?.sel
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 2]} camera={{ position: [-0.8, 0.6, 1.4], fov: FOV, near: 0.005, far: 30 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#bdbdb8', 0.45]} />
        <KeyLight half={0.75} intensity={2.3} />
        <Studio />
        <Table scale={1.4} />
        <group position-y={LIFT}>
          <Electric ref={guitar} finish={finish} guard={guard} sound={sound} drive={drive} vibration={vibration} onInfo={setInfo} />
        </group>
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="Front-L" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.4} minDistance={0.05} maxDistance={6} maxPolarAngle={1.55} target={MID.toArray()} />
        <Effects ao={ambientOcclusion} radius={0.02} />
      </Canvas>
      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} />

      <div style={{ position: 'absolute', left: 12, bottom: 12, right: 56, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ ...pill, justifyContent: 'flex-start' }} role="group" aria-label="Chord">
          {Object.keys(CHORDS).map((c) => (
            <button key={c} type="button" style={chip(info?.chord === c)} onClick={() => guitar.current?.setChord(c)}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={btn} onClick={() => guitar.current?.strum()}>
            Strum
          </button>
          <button type="button" style={{ ...btn, background: 'rgba(255,255,255,0.9)', color: '#1c1a16' }} onClick={() => guitar.current?.dive()}>
            Dive
          </button>
          <select value={tuning} onChange={(e) => (setTuning(e.target.value), guitar.current?.tune(e.target.value))} style={{ ...pill, height: 32, padding: '0 10px', border: 'none', font: '600 11px/1 ui-monospace, Menlo, monospace', color: '#1c1a16' }} aria-label="Tuning">
            {Object.keys(TUNINGS).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {sel && (
            <div style={{ ...pill, height: 32, padding: '0 12px', alignItems: 'center', gap: 10, font: '600 11px/1 ui-monospace, Menlo, monospace', color: '#2a2925' }} aria-live="off">
              <span>
                {sel.name}
                <sub style={{ fontSize: 8 }}>{sel.octave}</sub> {sel.hz.toFixed(1)} Hz
              </span>
              <span style={{ color: Math.abs(sel.cents) < 5 ? '#2f8a45' : '#c0392b' }}>{sel.cents > 0 ? '+' : ''}{sel.cents}¢</span>
              <span style={{ opacity: 0.6 }}>{POSITIONS[info.selector]}</span>
            </div>
          )}
        </div>
      </div>
      <InfoHint>
        A classic solid-body electric of our own design, playable: drag across the strings to strum (or click one to pluck), click the fretboard to fret a note or pick a chord · push the vibrato arm down to dive and let go to watch the bridge spring back · drag a tuner key to tune by ear, drag a knob for volume and tone, click the switch to step through the five pickup positions; the sound is what those pickups hear of each string · turn sound on and off in the controls
      </InfoHint>
    </div>
  )
}
