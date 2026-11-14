import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Board, { PLAYERS } from './Board.jsx'
import { CameraRig, Dim, Effects, FOV, InfoHint, KeyLight, Studio, TAN as T, Table, ViewTabs, pill } from './stage.jsx'
import { BOARD, GRID, OUTER, cellCentre } from './textures.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BG = '#5d5f63'

// The views on the reference sheet, each fitted to the canvas's aspect.
// Front is the +z edge (square 1's side); A-D are the four raised corners.
const fit = (half, a) => (half * 1.15) / (T * Math.min(a, 1))
const corner = (sx, sz) => (a) => {
  const d = Math.max(1.05, fit(OUTER * 1.25, a))
  return { pos: V(sx * 0.55, 0.78, sz * 0.62).normalize().multiplyScalar(d), target: V(0, 0, 0.01) }
}
const VIEWS = {
  Top: (a) => ({ pos: V(0, fit(OUTER, a) + 0.03, 0.0001), target: V(0, 0, 0) }),
  Front: (a) => {
    const d = (OUTER * 1.12) / (T * a) + OUTER
    return { pos: V(0, d * 0.12, d), target: V(0, 0.01, 0) }
  },
  Rear: (a) => {
    const d = (OUTER * 1.12) / (T * a) + OUTER
    return { pos: V(0, d * 0.12, -d), target: V(0, 0.01, 0) }
  },
  A: corner(-1, 1),
  B: corner(1, 1),
  C: corner(-1, -1),
  D: corner(1, -1),
  Start: (a) => {
    const [x, z] = cellCentre(1)
    const k = Math.max(1, 1 / a)
    return { pos: V(x + 0.07 * k, 0.17 * k, z + 0.16 * k), target: V(x + 0.02, BOARD.top, z - 0.01) }
  },
  Finish: (a) => {
    const [x, z] = cellCentre(100)
    const k = Math.max(1, 1 / a)
    return { pos: V(x + 0.09 * k, 0.17 * k, z + 0.16 * k), target: V(x + 0.02, BOARD.top, z) }
  },
  Frame: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: V(OUTER + 0.07 * k, 0.09 * k, OUTER + 0.1 * k), target: V(OUTER - 0.03, 0.015, OUTER - 0.03) }
  },
}
const MAIN = ['Top', 'Front', 'Rear', 'A', 'B', 'C', 'D']
const DETAIL = ['Start', 'Finish', 'Frame']

function Dimensions() {
  const y = 0.001
  const cm = (m) => `${(m * 100).toFixed(1)} cm`
  return (
    <group>
      <Dim a={[-GRID / 2, y, OUTER + 0.04]} b={[GRID / 2, y, OUTER + 0.04]} tick={[0, 0, 0.012]} label={`10 × 10 grid · ${cm(GRID)}`} />
      <Dim a={[-OUTER - 0.04, y, -OUTER]} b={[-OUTER - 0.04, y, OUTER]} tick={[0.012, 0, 0]} label={cm(2 * OUTER)} />
      <Dim a={[OUTER + 0.025, 0, -OUTER]} b={[OUTER + 0.025, BOARD.frameH, -OUTER]} tick={[0.008, 0, 0]} label={`${(BOARD.frameH * 1000).toFixed(0)} mm`} at={[OUTER + 0.06, BOARD.frameH + 0.012, -OUTER]} />
    </group>
  )
}

export default function BoardScene({ theme = 'classic', woodColor = '#8c4a24', dieColor = '#f5f5f3', pipColor = '#0b0b0c', players = 2, dimensions = true, ambientOcclusion = true, autoRotate = false, view: initialView = 'A' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const board = useRef()
  const [st, setSt] = useState({ turn: 0, phase: 'idle', die: 1, winner: -1 })
  const n = Math.max(1, Math.min(4, Math.round(players)))
  const busy = st.phase === 'rolling' || st.phase === 'moving'
  const who = PLAYERS[st.winner >= 0 ? st.winner : st.turn]

  // R or Space rolls (when the page is not typing)
  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      if (e.key === 'r' || e.key === 'R') board.current?.roll()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [-0.6, 0.8, 0.7], fov: FOV, near: 0.005, far: 40 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#55524c', 0.25]} />
        <KeyLight />
        <Studio />
        <Table />
        <Board ref={board} theme={theme} woodColor={woodColor} dieColor={dieColor} pipColor={pipColor} players={n} onState={setSt} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} views={VIEWS} fallback="A" />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={0.06} maxDistance={4} maxPolarAngle={1.5} />
        <Effects ao={ambientOcclusion} />
      </Canvas>

      <ViewTabs main={MAIN} detail={DETAIL} view={view} setView={setView} label={(v) => (v.length === 1 ? `View ${v}` : v)} />

      {/* the game: whose turn, the last roll, and the button */}
      <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', maxWidth: 'calc(100% - 64px)' }}>
        <div style={{ ...pill, padding: '0 12px 0 8px', height: 32, alignItems: 'center', gap: 8, font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.04em', color: '#2a2925' }} aria-live="polite">
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: who.color, boxShadow: 'inset 0 -2px 3px rgba(0,0,0,.25)' }} />
          {st.winner >= 0 ? `${who.name} wins!` : st.note === 'exact' && !busy ? `${PLAYERS[(st.turn + n - 1) % n].name} needs exactly ${100 - st.pos[(st.turn + n - 1) % n]} · ${who.name} to roll` : `${who.name} · ${busy ? (st.phase === 'rolling' ? 'rolling…' : `moves ${st.die}`) : `on ${st.pos?.[st.turn] ?? 1}`}`}
        </div>
        {st.winner >= 0 ? (
          <button type="button" style={{ ...pill, height: 32, padding: '0 16px', border: 'none', cursor: 'pointer', background: '#1c1a16', color: '#f4f1ea', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }} onClick={() => board.current?.newGame()}>
            New game
          </button>
        ) : (
          <button type="button" disabled={busy} style={{ ...pill, height: 32, padding: '0 16px', border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.55 : 1, background: '#1c1a16', color: '#f4f1ea', font: '600 11px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }} onClick={() => board.current?.roll()}>
            Roll
          </button>
        )}
      </div>
      <InfoHint>
        A 10 × 10 race board, numbered 1 to 100 back and forth up the rows, printed and laminated in a mitred, lacquered hardwood frame · Roll (or click the die, or press R): the die tumbles onto the table and the pawn hops square by square; land exactly on 100 to win · pick a view, or drag to orbit and scroll in to the print and the joints
      </InfoHint>
    </div>
  )
}
