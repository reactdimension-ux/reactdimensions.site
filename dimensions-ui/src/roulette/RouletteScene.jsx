import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CameraRig, Dim, Effects, FOV, InfoHint, Studio, TAN as T, ViewTabs, pill } from '../gameboard/stage.jsx'
import { INK, LAY, LAY_H, LAY_W, TABLE, WHEEL, colourOf } from './layout.js'
import Roulette from './Roulette.jsx'

// The roulette table on the board models' studio, at full size on a floor:
// the views of the reference sheet, the game's read-out and the buttons.

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#c6c7c5'
const { H } = TABLE
const X0 = WHEEL.x - TABLE.wheelR // the table's extent
const X1 = TABLE.endX + TABLE.endR
const Z0 = WHEEL.z - TABLE.wheelR
const Z1 = TABLE.front
const MID = V((X0 + X1) / 2, 0.45, (Z0 + Z1) / 2)

// far enough back to hold a box w wide and h tall (half sizes) in view
const fit = (w, h, a) => Math.max(w / (T * a), h / T) * 1.1
// side on, from a little above the cloth: w is half the width seen, reach how far the table comes towards the camera
const elevation = (dir, w, reach) => (a) => ({ pos: MID.clone().addScaledVector(dir, fit(w, 0.6, a) + reach).setY(1.0), target: MID.clone() })
const corner = (sx, sz) => (a) => ({ pos: MID.clone().addScaledVector(V(sx * 0.6, 0.5, sz * 0.78).normalize(), fit(1.5, 0.9, a) + 0.35), target: MID.clone() })
const near = (a) => Math.max(1, 1 / a)
const VIEWS = {
  Top: (a) => ({ pos: V(MID.x, H + fit(1.4, 0.7, a), MID.z + 0.001), target: V(MID.x, H, MID.z) }),
  Front: elevation(V(0, 0, 1), 1.4, 0.7),
  Rear: elevation(V(0, 0, -1), 1.4, 0.7),
  Left: elevation(V(-1, 0, 0), 0.75, 1.4),
  Right: elevation(V(1, 0, 0), 0.75, 1.4),
  'Front-L': corner(-1, 1),
  'Front-R': corner(1, 1),
  Wheel: (a) => {
    const k = near(a)
    return { pos: V(WHEEL.x - 0.12 * k, H + 0.78 * k, WHEEL.z + 0.86 * k), target: V(WHEEL.x, H + 0.02, WHEEL.z + 0.02) }
  },
  Pockets: (a) => {
    const k = near(a)
    return { pos: V(WHEEL.x + 0.2 * k, H + 0.2 * k, WHEEL.z + 0.5 * k), target: V(WHEEL.x + 0.03, H + 0.025, WHEEL.z + 0.14) }
  },
  Layout: (a) => {
    const k = near(a)
    const x = LAY.x + LAY_W / 2
    const z = LAY.z + LAY_H / 2
    return { pos: V(x, H + Math.max(1.25, 0.66 / (T * a)) * k ** 0.2, z + 0.5), target: V(x, H, z) }
  },
}
const MAIN = ['Top', 'Front-L', 'Front-R', 'Front', 'Rear', 'Left', 'Right']
const DETAIL = ['Wheel', 'Pockets', 'Layout']

function Dimensions() {
  const cm = (m) => `${Math.round(m * 100)} cm`
  return (
    <group>
      <Dim a={[X0, 0.002, Z1 + 0.22]} b={[X1, 0.002, Z1 + 0.22]} tick={[0, 0, 0.04]} label={cm(X1 - X0)} />
      <Dim a={[X1 + 0.22, 0.002, TABLE.back]} b={[X1 + 0.22, 0.002, Z1]} tick={[0.04, 0, 0]} label={cm(Z1 - TABLE.back)} />
      <Dim a={[X0 - 0.22, 0.002, Z0]} b={[X0 - 0.22, 0.002, Z1]} tick={[0.04, 0, 0]} label={cm(Z1 - Z0)} />
      <Dim a={[X1 + 0.1, 0, Z1 + 0.1]} b={[X1 + 0.1, H, Z1 + 0.1]} tick={[0.03, 0, 0.03]} label={`cloth ${cm(H)}`} />
      <Dim a={[WHEEL.x - 0.4045, H + 0.16, WHEEL.z]} b={[WHEEL.x + 0.4045, H + 0.16, WHEEL.z]} tick={[0, 0.02, 0]} label="wheel ⌀ 81 cm" />
    </group>
  )
}

const mono = '600 11px/1 ui-monospace, Menlo, monospace'
const button = (on = true) => ({ ...pill, height: 32, padding: '0 16px', alignItems: 'center', border: 'none', cursor: on ? 'pointer' : 'default', opacity: on ? 1 : 0.55, background: '#1c1a16', color: '#f4f1ea', font: mono, letterSpacing: '0.08em', textTransform: 'uppercase' })
const Disc = ({ n, size = 22 }) => (
  <span style={{ flex: 'none', width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', background: INK[colourOf(n)], color: '#fff', font: `700 ${Math.round(size * 0.5)}px/1 ui-monospace, Menlo, monospace`, boxShadow: 'inset 0 -2px 3px rgba(0,0,0,.3)' }}>{n}</span>
)

export default function RouletteScene({ feltColor = '#0f6b3a', woodColor = '#6a3420', leatherColor = '#33201a', metalColor = '#c9a557', chipColor = '#1f4fbf', betting = true, sound = true, dimensions = false, ambientOcclusion = true, autoRotate = false, view: initialView = 'Front-L' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const table = useRef()
  const [g, setG] = useState({ phase: 'idle', result: null, history: [], balance: 0, staked: 0, won: 0 })
  const busy = g.phase !== 'idle'

  // S spins (when the page is not typing)
  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 's' || e.key === 'S') table.current?.spin()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const n = g.result
  const call = n === null ? 'Place your bets' : n === 0 ? 'Zero' : `${colourOf(n)} · ${n % 2 ? 'odd' : 'even'}`

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }} onContextMenu={(e) => e.preventDefault()}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [-3, 2.4, 3.4], fov: FOV, near: 0.03, far: 80 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#8a8780', 0.3]} />
        <directionalLight position={[-1.5, 3.4, 2.1]} intensity={2.2} color="#fff6ea" castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.004}>
          <orthographicCamera attach="shadow-camera" args={[-2.1, 2.1, 2.1, -2.1, 0.5, 9]} />
        </directionalLight>
        {/* a soft fill from behind, so the far side is not left in the dark */}
        <directionalLight position={[2, 1.6, -2.6]} intensity={0.55} color="#eef2ff" />
        <Studio />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.001} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.26} />
        </mesh>
        <ContactShadows position={[MID.x, 0.002, MID.z]} scale={5} resolution={1024} blur={2.6} far={1} opacity={0.42} color="#101113" frames={1} />
        <Roulette ref={table} feltColor={feltColor} woodColor={woodColor} leatherColor={leatherColor} metalColor={metalColor} chipColor={chipColor} betting={betting} sound={sound} onState={setG} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="Front-L" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.25} maxDistance={12} maxPolarAngle={1.54} />
        <Effects ao={ambientOcclusion} radius={0.08} />
      </Canvas>

      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} />

      {/* the game: the last numbers, the call, the chips and the buttons */}
      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, maxWidth: 'calc(100% - 64px)' }}>
        {g.history.length > 1 && (
          <div style={{ ...pill, padding: 5, gap: 4, justifyContent: 'flex-start' }} aria-label="Previous numbers">
            {g.history.slice(1).map((h, i) => (
              <span key={g.history.length - i} style={{ opacity: 1 - i * 0.06 }}>
                <Disc n={h} size={18} />
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ ...pill, flexWrap: 'nowrap', padding: '0 12px 0 5px', height: 32, alignItems: 'center', gap: 8, font: mono, letterSpacing: '0.04em', color: '#2a2925' }} aria-live="polite">
            {busy ? <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#f4f1e8', boxShadow: 'inset 0 -3px 4px rgba(0,0,0,.25), 0 0 0 1px rgba(0,0,0,.12)' }} /> : n !== null ? <Disc n={n} /> : <span style={{ width: 4 }} />}
            <span style={{ textTransform: 'capitalize' }}>{busy ? 'No more bets…' : call}</span>
            {!busy && g.won > 0 && <span style={{ color: '#12703a' }}>+{g.won}</span>}
          </div>
          {betting && (
            <div style={{ ...pill, padding: '0 12px', height: 32, alignItems: 'center', font: mono, letterSpacing: '0.04em', color: '#2a2925' }}>
              {g.balance} chips{g.staked > 0 && ` · ${g.staked} on the table`}
            </div>
          )}
          <button type="button" disabled={busy} style={button(!busy)} onClick={() => table.current?.spin()}>
            Spin
          </button>
          {betting && g.staked > 0 && !busy && (
            <button type="button" style={{ ...button(), background: 'rgba(255,255,255,0.9)', color: '#2a2925' }} onClick={() => table.current?.clear()}>
              Clear
            </button>
          )}
          {betting && g.balance + g.staked === 0 && !busy && (
            <button type="button" style={{ ...button(), background: 'rgba(255,255,255,0.9)', color: '#2a2925' }} onClick={() => table.current?.reset()}>
              New stake
            </button>
          )}
        </div>
      </div>
      <InfoHint>
        A full-size single-zero roulette table: baize printed with the layout, a padded leather rail, and a wheel that really works. Spin (or click the wheel, or press S): the rotor turns one way, the ball is flicked round the track the other, slows, peels off, strikes the deflectors and rattles over the separators into a pocket. Nothing is decided in advance · click a box on the cloth to bet a chip, right-click to take it back; a number pays 35 to 1, columns and dozens 2 to 1, the outside bets evens · pick a view, or drag to orbit and scroll in
      </InfoHint>
    </div>
  )
}
