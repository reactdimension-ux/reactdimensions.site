import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Disc from './Disc.jsx'
import { R, T } from './textures.js'
import { CameraRig, Dim, Effects, FOV, InfoHint, KeyLight, Studio, TAN, ViewTabs, pill } from '../gameboard/stage.jsx'

// The disc lying on a pale studio table, in the shared tabletop studio from
// the board models: its dark room and soft boxes are what the mirror and the
// rainbow need to show.

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#e6e5e3'
const MID = V(0, T, 0)
// room for the view tabs above and the buttons below
const fit = (a) => (R * 1.3) / TAN / Math.min(a, 1)
const near = (a) => Math.max(1, 1 / a)
const close = (target, offset) => (a) => ({ pos: target.clone().add(offset.clone().multiplyScalar(near(a))), target })
const around = (x, y, z) => (a) => ({ pos: V(x, y, z).normalize().multiplyScalar(fit(a)).add(MID), target: MID })
const VIEWS = {
  Top: (a) => ({ pos: V(0, fit(a) * 1.02, 0.0001), target: MID }),
  Front: around(0, 0.75, 0.66),
  'Front-L': around(-0.55, 0.7, 0.5),
  'Front-R': around(0.55, 0.7, 0.5),
  Back: around(0, 0.75, -0.66),
  Low: around(0.2, 0.22, 0.97),
  Edge: (a) => ({ pos: V(0, T + 0.004, fit(a) * 0.9), target: MID }),
  'A · Hub': close(V(0, T, 0), V(0.012, 0.075, 0.045)),
  'B · Label': close(V(0.022, T, 0.004), V(0.0, 0.085, 0.06)),
  'C · Edge': close(V(0.0, T / 2, R), V(0.025, 0.012, 0.045)),
  'D · Rainbow': close(V(0, T, 0), V(-0.05, 0.1, 0.13)),
}
const MAIN = ['Top', 'Front', 'Front-L', 'Front-R', 'Back', 'Low', 'Edge']
const DETAIL = ['A · Hub', 'B · Label', 'C · Edge', 'D · Rainbow']

function Dimensions() {
  const y = T + 0.0004
  return (
    <group>
      <Dim a={[-R, y, R + 0.012]} b={[R, y, R + 0.012]} tick={[0, 0, 0.004]} label="Ø 120 mm" at={[0, y, R + 0.02]} />
      <Dim a={[-0.0075, y, 0]} b={[0.0075, y, 0]} tick={[0, 0, 0.003]} label="hole 15 mm" at={[0, y + 0.006, 0]} />
      <Dim a={[R + 0.008, 0, 0]} b={[R + 0.008, T, 0]} tick={[0.002, 0, 0]} label="1.2 mm" at={[R + 0.02, T / 2, 0]} />
    </group>
  )
}

export default function DiscScene({ brand = 'RD', capacity = '700', finish = 'silver', dye = 'cyanine', burned = 0, rainbow = 1, side: initialSide = 'label', dimensions = false, ambientOcclusion = true, autoRotate = false, view: initialView = 'Front' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const [side, setSide] = useState(initialSide)
  useEffect(() => setSide(initialSide), [initialSide])
  // the rainbow detail only makes sense data side up
  useEffect(() => {
    if (view === 'D · Rainbow') setSide('data')
  }, [view])
  const disc = useRef()
  const [info, setInfo] = useState(null)
  const btn = { ...pill, height: 32, padding: '0 14px', border: 'none', cursor: 'pointer', background: '#1c1a16', color: '#f4f1ea', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }
  const ghost = { ...btn, background: 'rgba(255,255,255,0.9)', color: '#1c1a16' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 2]} camera={{ position: [0, 0.2, 0.25], fov: FOV, near: 0.002, far: 20 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#c6c6c2', 0.45]} />
        <KeyLight half={0.12} intensity={2.2} />
        <Studio />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.0002} receiveShadow raycast={() => null}>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial opacity={0.18} />
        </mesh>
        <ContactShadows position={[0, 0.0001, 0]} scale={0.3} resolution={1024} blur={1.6} far={0.02} opacity={0.5} color="#18191b" />
        <Disc ref={disc} brand={brand} capacity={capacity} finish={finish} dye={dye} burned={burned} side={side} rainbow={rainbow} onInfo={setInfo} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="Front" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.02} maxDistance={2} maxPolarAngle={1.55} target={MID.toArray()} />
        <Effects ao={ambientOcclusion} radius={0.004} />
      </Canvas>
      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} />

      <div style={{ position: 'absolute', left: 12, bottom: 12, right: 56, zIndex: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={btn} onClick={() => setSide((s) => (s === 'data' ? 'label' : 'data'))}>
          Flip
        </button>
        <button type="button" style={{ ...ghost, opacity: info?.full ? 0.5 : 1 }} disabled={info?.full || info?.burning} onClick={() => (setSide('data'), disc.current?.burn())}>
          {info?.full ? 'Disc full' : info?.burning ? 'Writing…' : 'Burn'}
        </button>
        {info && (
          <div style={{ ...pill, height: 32, padding: '0 12px', alignItems: 'center', gap: 10, font: '600 11px/1 ui-monospace, Menlo, monospace', color: '#2a2925' }} aria-live="off">
            <span>{info.side === 'data' ? 'data side' : 'label side'}</span>
            <span style={{ opacity: 0.6 }}>{info.mb} / 700 MB written</span>
          </div>
        )}
      </div>
      <InfoHint>
        A recordable CD to the real dimensions: clear polycarbonate with the stacking ring under the hub, a dye and metal layer, a printed label on top · drag the disc to spin it · Flip to see the data side, where the 1.6 µm spiral track splits the studio lights into rainbows that move as you look round but not as it spins · Burn writes 700 MB from the middle out: the written part darkens, and a CD-R can only be written once
      </InfoHint>
    </div>
  )
}
