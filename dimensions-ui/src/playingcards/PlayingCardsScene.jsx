import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import PlayingCards, { cardsExtent, layoutPoses } from './PlayingCards.jsx'
import { CameraRig, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, ViewTabs, pill } from '../gameboard/stage.jsx'

// The cards on a baize-covered table, in the shared tabletop studio (from
// the board models). The scene is in metres; the cards are modelled in
// centimetres and scaled down.

const CM = 0.01
const V = (x, y, z) => new THREE.Vector3(x, y, z)

// Felt: a dense mat of short fibres lying every which way, a little lighter
// and darker than the cloth, tiled every 10 cm. Used as colour and bump.
function feltTexture() {
  const S = 512
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.fillStyle = 'rgb(128,128,128)'
  g.fillRect(0, 0, S, S)
  let seed = 7
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.lineCap = 'round'
  for (let i = 0; i < 26000; i++) {
    const x = r() * S
    const y = r() * S
    const a = r() * Math.PI * 2
    const l = 2 + r() * 7
    const v = 128 + (r() - 0.5) * 70
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`
    g.lineWidth = 0.6 + r() * 0.8
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        if (Math.abs(x + ox - S / 2) > S / 2 + 10 || Math.abs(y + oy - S / 2) > S / 2 + 10) continue
        g.beginPath()
        g.moveTo(x + ox, y + oy)
        g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l)
        g.stroke()
      }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(30, 30)
  t.anisotropy = 8
  return t
}

function Felt({ color }) {
  const tex = useMemo(() => feltTexture(), [])
  useEffect(() => () => tex.dispose(), [tex])
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ map: tex, bumpMap: tex, bumpScale: 0.0006, roughness: 0.97, sheen: 1, sheenRoughness: 0.75 }), [tex])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => {
    // the map is grey around 0.5: double the colour so it averages out
    mat.color.set(color).multiplyScalar(1.9)
    mat.sheenColor.set(color).lerp(new THREE.Color('#ffffff'), 0.35)
  }, [mat, color])
  return (
    <mesh rotation-x={-Math.PI / 2} material={mat} receiveShadow>
      <planeGeometry args={[3, 3]} />
    </mesh>
  )
}

function makeViews(layout) {
  const ext = cardsExtent(layout)
  const poses = layoutPoses(layout)
  const at = (i) => V(poses[i].x * CM, 0, poses[i].z * CM)
  const w = ext.w * CM
  const h = ext.h * CM
  const cz = ext.cz * CM
  const near = (a) => Math.max(1, 1 / a)
  return {
    Top: (a) => ({ pos: V(0, Math.max((h / 2) * 1.18, ((w / 2) * 1.06) / Math.min(a, 2.2)) / T, cz + 0.0001), target: V(0, 0, cz) }),
    Table: (a) => {
      const d = Math.max(0.5, ((w / 2) * 1.15) / (T * Math.min(a, 2)))
      return { pos: V(0, d * 0.78, cz + d * 0.62), target: V(0, 0, cz + 0.01) }
    },
    Low: (a) => {
      const d = Math.max(0.45, ((w / 2) * 1.05) / (T * Math.min(a, 2)))
      return { pos: V(d * 0.35, d * 0.22, cz + d * 0.92), target: V(0, 0.01, cz) }
    },
    Ace: (a) => {
      const p = at(0)
      const k = near(a)
      return { pos: p.clone().add(V(0.02 * k, 0.15 * k, 0.11 * k)), target: p }
    },
    Court: (a) => {
      const p = at(11).lerp(at(12), 0.5)
      const k = near(a)
      return { pos: p.clone().add(V(-0.03 * k, 0.2 * k, 0.15 * k)), target: p }
    },
    Joker: (a) => {
      const p = at(13)
      const k = near(a)
      return { pos: p.clone().add(V(-0.02 * k, 0.15 * k, 0.11 * k)), target: p }
    },
  }
}

export default function PlayingCardsScene({ suit = 'clubs', layout = 'rows', backColor = '#a3202a', feltColor = '#14572f', ambientOcclusion = false, autoRotate = false, view: initialView = 'Top' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const views = useMemo(() => makeViews(layout), [layout])
  const cards = useRef()
  const btn = { ...pill, height: 32, padding: '0 16px', border: 'none', cursor: 'pointer', background: '#1c1a16', color: '#f4f1ea', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: '#0f2a19' }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [0, 0.8, 0.5], fov: FOV, near: 0.005, far: 20 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#0f2a19']} />
        <hemisphereLight args={['#ffffff', '#1d3a26', 0.45]} />
        <KeyLight half={0.45} intensity={2.4} />
        <Studio />
        <Felt color={feltColor} />
        <group scale={CM}>
          <PlayingCards ref={cards} suit={suit} layout={layout} backColor={backColor} />
        </group>
        <CameraRig view={view} views={views} fallback="Top" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.06} maxDistance={3} maxPolarAngle={1.45} />
        <Effects ao={ambientOcclusion} radius={0.01} />
      </Canvas>
      <ViewTabs main={['Top', 'Table', 'Low']} detail={['Ace', 'Court', 'Joker']} view={view} setView={setView} />
      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, display: 'flex', gap: 8 }}>
        <button type="button" style={btn} onClick={() => cards.current?.deal()}>
          Deal
        </button>
        <button type="button" style={{ ...btn, background: 'rgba(255,255,255,0.9)', color: '#1c1a16' }} onClick={() => cards.current?.flip()}>
          Flip all
        </button>
      </div>
      <InfoHint>
        A full suit, ace to king, and a joker, on the Color Cards card: the same rounded coated stock, with traditional pips, corner indices, an ornamented ace and double-headed court cards · Deal to throw them out again · press and drag any card to pick it up and move it (it lands on top), click a card to turn it over · pick a suit, a layout and the back colour in the controls
      </InfoHint>
    </div>
  )
}
