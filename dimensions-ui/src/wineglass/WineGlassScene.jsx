import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import WineGlass from './WineGlass.jsx'
import { FOOT_R, H, RMAX, RRIM, Y0 } from './geometry.js'
import { CameraRig, Dim, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, ViewTabs, pill } from '../gameboard/stage.jsx'
import ControlDock from '../controls/ControlDock.jsx'

// The wine glass on a pale studio table, as on a product reference sheet,
// in the shared studio from the board models (its dark room and soft boxes
// are what give glass its crisp highlights and dark edges).

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#e3e3e2'
const MID = V(0, H / 2 - 0.006, 0)
// room round the glass for the view tabs above and the buttons below
const fit = (a) => Math.max((H / 2) * 1.62, (0.1 / 2) * 1.5 / Math.min(a, 1)) / T
const near = (a) => Math.max(1, 1 / a)
const close = (target, offset) => (a) => ({ pos: target.clone().add(offset.clone().multiplyScalar(near(a))), target })
const around = (x, z) => (a) => ({ pos: V(x, 0.18, z).normalize().multiplyScalar(fit(a)).add(MID), target: MID })
const VIEWS = {
  Front: (a) => ({ pos: V(0, MID.y, fit(a)), target: MID }),
  Back: (a) => ({ pos: V(0, MID.y, -fit(a)), target: MID }),
  Left: (a) => ({ pos: V(-fit(a), MID.y, 0), target: MID }),
  Right: (a) => ({ pos: V(fit(a), MID.y, 0), target: MID }),
  Top: (a) => ({ pos: V(0, fit(a) * 0.62, 0.0001), target: V(0, 0.1, 0) }),
  Bottom: (a) => ({ pos: V(0, -fit(a) * 0.55, 0.0001), target: V(0, 0.08, 0) }),
  'Front-L': around(-0.6, 0.8),
  'Front-R': around(0.6, 0.8),
  'Back-L': around(-0.6, -0.8),
  'Back-R': around(0.6, -0.8),
  'A · Rim': close(V(0, H - 0.014, 0), V(0.02, 0.045, 0.16)),
  'B · Bowl': close(V(0, Y0 + 0.035, 0), V(0.05, -0.01, 0.16)),
  'C · Stem joint': close(V(0, Y0 - 0.004, 0), V(0.045, 0.015, 0.14)),
  'D · Stem': close(V(0, 0.055, 0), V(0.0, 0.0, 0.15)),
  'E · Foot': close(V(0, 0.006, 0), V(0.05, 0.07, 0.13)),
}
const MAIN = ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom', 'Front-L', 'Front-R', 'Back-L', 'Back-R']
const DETAIL = ['A · Rim', 'B · Bowl', 'C · Stem joint', 'D · Stem', 'E · Foot']

function Dimensions() {
  return (
    <group>
      <Dim a={[-0.075, 0.0005, 0]} b={[-0.075, H, 0]} tick={[0.008, 0, 0]} label="22.5 cm" at={[-0.1, H / 2, 0]} />
      <Dim a={[-RMAX, Y0 + 0.052, 0.06]} b={[RMAX, Y0 + 0.052, 0.06]} tick={[0, 0.006, 0]} label="Ø 8.8 cm" at={[0, Y0 + 0.064, 0.06]} />
      <Dim a={[-RRIM, H + 0.012, 0]} b={[RRIM, H + 0.012, 0]} tick={[0, 0.006, 0]} label="rim Ø 6.6 cm" at={[0, H + 0.024, 0]} />
      <Dim a={[-FOOT_R, 0.0005, 0.06]} b={[FOOT_R, 0.0005, 0.06]} tick={[0, 0, 0.006]} label="foot Ø 7.8 cm" at={[0, 0.01, 0.07]} />
    </group>
  )
}

export default function WineGlassScene({ wine = 'red', fill = 0.35, sound = true, pitch = 760, dimensions = false, ambientOcclusion = false, autoRotate = false, view: initialView = 'Front-L' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const glass = useRef()
  const [info, setInfo] = useState(null)
  const btn = { ...pill, height: 32, padding: '0 14px', border: 'none', cursor: 'pointer', background: '#1c1a16', color: '#f4f1ea', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} dpr={[1, 2]} camera={{ position: [-0.4, 0.3, 0.7], fov: FOV, near: 0.005, far: 20 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c4c4c0', 0.5]} />
        <KeyLight half={0.3} intensity={2.2} />
        <Studio />
        <ContactShadows position={[0, 0.0004, 0]} scale={0.5} resolution={512} blur={1.4} far={0.01} opacity={0.55} color="#18191b" />
        <WineGlass ref={glass} wine={wine} fill={fill} sound={sound} pitch={pitch} onInfo={setInfo} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="Front-L" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.04} maxDistance={3} maxPolarAngle={view === 'Bottom' ? Math.PI : 1.56} target={MID.toArray()} />
        <Effects ao={ambientOcclusion} radius={0.01} />
      </Canvas>
      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} />

      <ControlDock corner="bl">
        <button type="button" style={btn} onClick={() => glass.current?.swirl()} disabled={wine === 'empty'}>
          Swirl
        </button>
        <button type="button" style={{ ...btn, background: 'rgba(255,255,255,0.9)', color: '#1c1a16' }} onClick={() => glass.current?.clink()}>
          Clink
        </button>
        {info && (
          <div style={{ ...pill, height: 32, padding: '0 12px', alignItems: 'center', gap: 10, font: '600 11px/1 ui-monospace, Menlo, monospace', color: '#2a2925' }} aria-live="off">
            <span>{wine === 'empty' ? 'empty' : `${info.ml} ml`}</span>
            <span style={{ opacity: 0.55 }}>of {info.capacity} ml</span>
            <span>rings at {info.hz} Hz</span>
          </div>
        )}
      </ControlDock>
      <InfoHint>
        A classic stemmed wine glass with a thin rolled rim, a thick lens of glass at the bottom of the bowl and a drawn stem · drag the glass to slide it on the table and watch the wine slosh, or press Swirl · click the glass (or Clink) to strike it: the more wine, the lower and shorter the ring · change the wine and how full it is in the controls
      </InfoHint>
    </div>
  )
}
