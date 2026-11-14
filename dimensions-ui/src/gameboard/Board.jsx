import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { DieMesh, restingOn } from '../dice/Dice.jsx'
import { BOARD, OPEN, OUTER, buildPeel, buildPrint, buildWood, cellCentre, mitredRail } from './textures.js'

// A 10 x 10 race board in a polished hardwood frame, with pawns and a die.
//
// The frame is four rails swept from one moulding profile (rounded outer
// edge, flat top, chamfer and bevel down to a small lip over the board) and
// cut at 45 degrees, so the mitres meet exactly and each rail's grain runs
// along it. The board is a printed, laminated card: a 4K print under a gloss
// coat with a faint orange-peel texture for the highlights to break up on.
//
// Play: each roll tumbles the die onto the table beside the board, then the
// player's pawn hops square by square. 100 must be reached exactly.

const { frameW, frameH, top } = BOARD
export const PLAYERS = [
  { name: 'Red', color: '#c8242b' },
  { name: 'Blue', color: '#1f4fbf' },
  { name: 'Green', color: '#1f8a45' },
  { name: 'Yellow', color: '#f0b51c' },
]

// the moulding, from the outer bottom edge inwards: [inset from outer edge, height]
// (points listed twice keep a crisp edge there)
const PROFILE = (() => {
  const p = [[0, 0], [0, 0], [0, frameH - 0.006]]
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    p.push([0.006 - Math.cos(a) * 0.006, frameH - 0.006 + Math.sin(a) * 0.006])
  }
  p.push([0.024, frameH], [0.024, frameH], [0.029, frameH - 0.004], [0.029, frameH - 0.004])
  p.push([frameW - 0.0015, top + 0.0035], [frameW - 0.0015, top + 0.0035], [frameW, top + 0.0012], [frameW, top], [frameW, top])
  return p
})()

const railGeometry = (uOffset) => mitredRail(PROFILE, OUTER, uOffset)

// a pawn: weighted base, waisted body, collar and ball head
function pawnGeometry() {
  const pts = [
    [0, 0],
    [0.0095, 0],
    [0.0098, 0.0012],
    [0.0094, 0.0032],
    [0.0076, 0.0046],
    [0.0062, 0.0062],
    [0.0045, 0.012],
    [0.0034, 0.0185],
    [0.0052, 0.0198],
    [0.0054, 0.0205],
    [0.0036, 0.0214],
  ]
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + 0.55 + (i / 12) * (Math.PI - 0.55)
    pts.push([Math.cos(a) * 0.0058, 0.0262 + Math.sin(a) * 0.0058])
  }
  return new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y)),
    40,
  )
}

// the library's die (from the Dice component), scaled to 16 mm
const DIE = 0.016
const faceUp = restingOn

// where a player's pawn stands on square n (four players share a square)
const SLOT = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
function pawnSpot(n, p) {
  const [x, z] = cellCentre(n)
  return new THREE.Vector3(x + SLOT[p][0] * 0.0105, top, z + SLOT[p][1] * 0.0105)
}
const DIE_REST = new THREE.Vector3(OUTER + 0.07, DIE / 2, OUTER * 0.7)

const Board = forwardRef(function Board({ theme = 'classic', woodColor = '#8c4a24', dieColor = '#f5f5f3', pipColor = '#0b0b0c', players = 2, onState }, ref) {
  const invalidate = useThree((s) => s.invalidate)
  const print = useMemo(() => buildPrint(theme), [theme])
  const peel = useMemo(() => {
    const t = buildPeel()
    t.repeat.set(10, 10)
    return t
  }, [])
  const wood = useMemo(() => buildWood(), [])
  const geo = useMemo(
    () => ({
      rails: [0, 1, 2, 3].map((i) => railGeometry(i * 0.37)),
      pawn: pawnGeometry(),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      print: new THREE.MeshPhysicalMaterial({ map: print, roughness: 0.55, clearcoat: 0.85, clearcoatRoughness: 0.14, clearcoatNormalMap: peel, clearcoatNormalScale: new THREE.Vector2(0.25, 0.25) }),
      frame: new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.07, clearcoatNormalMap: peel, clearcoatNormalScale: new THREE.Vector2(0.08, 0.08) }),
      core: new THREE.MeshStandardMaterial({ color: '#2a2219', roughness: 0.9 }),
      felt: new THREE.MeshStandardMaterial({ color: '#1d2a22', roughness: 1 }),
      pawns: PLAYERS.map((p) => new THREE.MeshPhysicalMaterial({ color: p.color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 })),
    }),
    // the print is swapped in below, so a theme change doesn't rebuild these
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peel, wood],
  )
  useLayoutEffect(() => {
    mats.print.map = print
    mats.print.needsUpdate = true
    invalidate()
    return () => print.dispose()
  }, [mats, print, invalidate])
  useLayoutEffect(() => {
    mats.frame.color.set(woodColor)
    invalidate()
  }, [mats, woodColor, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).flat().forEach((m) => m.dispose())
      geo.rails.forEach((g) => g.dispose())
      geo.pawn.dispose()
      peel.dispose()
      wood.dispose()
    },
    [mats, geo, peel, wood],
  )

  // ---- the game ----
  const pawnRefs = useRef([])
  const dieRef = useRef()
  const game = useRef(null)
  const reset = () => {
    game.current = { pos: [1, 1, 1, 1], turn: 0, phase: 'idle', die: 1, players, winner: -1 }
    pawnRefs.current.forEach((m, p) => m && m.position.copy(pawnSpot(1, p)))
    if (dieRef.current) {
      dieRef.current.position.copy(DIE_REST)
      dieRef.current.quaternion.copy(faceUp(1, 0.4))
    }
    onState?.({ turn: 0, phase: 'idle', die: 1, winner: -1, pos: [1, 1, 1, 1] })
    invalidate()
  }
  useEffect(reset, [players]) // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useRef(null)
  const roll = () => {
    const g = game.current
    if (!g || g.phase !== 'idle') return
    const v = 1 + Math.floor(Math.random() * 6)
    const from = new THREE.Vector3(OUTER + 0.24, 0.12, OUTER * 0.9)
    const to = DIE_REST.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.08))
    const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    anim.current = { kind: 'roll', t: 0, v, from, to, spin, rate: 22 + Math.random() * 10, q0: new THREE.Quaternion().random(), q1: faceUp(v, Math.random() * Math.PI * 2) }
    g.phase = 'rolling'
    onState?.({ ...snapshot(g), phase: 'rolling' })
    invalidate()
  }
  const newGame = () => reset()
  useImperativeHandle(ref, () => ({ roll, newGame }))

  const snapshot = (g) => ({ turn: g.turn, phase: g.phase, die: g.die, winner: g.winner, pos: [...g.pos] })
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])

  useFrame((_, delta) => {
    const a = anim.current
    const g = game.current
    if (!a || !g) return
    const dt = Math.min(delta, 1 / 30)
    if (a.kind === 'roll') {
      a.t = Math.min(1, a.t + dt / 1.1)
      const t = a.t
      // a throw and two shrinking bounces, then the die settles
      const x = a.from.x + (a.to.x - a.from.x) * (1 - Math.pow(1 - t, 2.2))
      const z = a.from.z + (a.to.z - a.from.z) * (1 - Math.pow(1 - t, 2.2))
      let y
      if (t < 0.45) y = a.from.y * (1 - t / 0.45) + Math.sin((t / 0.45) * Math.PI) * 0.05
      else if (t < 0.72) y = Math.sin(((t - 0.45) / 0.27) * Math.PI) * 0.028
      else if (t < 0.88) y = Math.sin(((t - 0.72) / 0.16) * Math.PI) * 0.008
      else y = 0
      dieRef.current.position.set(x, DIE / 2 + y, z)
      const tumble = tmpQ.setFromAxisAngle(a.spin, a.rate * t * (1 - t * 0.6)).premultiply(a.q0)
      const k = THREE.MathUtils.smoothstep(t, 0.55, 0.95)
      dieRef.current.quaternion.slerpQuaternions(tumble, a.q1, k)
      if (t >= 1) {
        g.die = a.v
        const target = g.pos[g.turn] + a.v
        if (target > 100) {
          // overshoot: the turn passes
          g.phase = 'idle'
          g.turn = (g.turn + 1) % g.players
          anim.current = null
          onState?.({ ...snapshot(g), note: 'exact' })
        } else {
          g.phase = 'moving'
          anim.current = { kind: 'move', p: g.turn, from: g.pos[g.turn], to: target, step: 0, t: 0 }
          onState?.(snapshot(g))
        }
      }
    } else if (a.kind === 'move') {
      // one hop per square, a little arc each time
      a.t = Math.min(1, a.t + dt / 0.2)
      const n0 = a.from + a.step
      const p0 = pawnSpot(n0, a.p)
      const p1 = pawnSpot(n0 + 1, a.p)
      const m = pawnRefs.current[a.p]
      m.position.lerpVectors(p0, p1, a.t)
      m.position.y += Math.sin(a.t * Math.PI) * 0.018
      if (a.t >= 1) {
        a.step++
        a.t = 0
        g.pos[a.p] = n0 + 1
        if (n0 + 1 >= a.to) {
          if (a.to === 100) {
            g.phase = 'won'
            g.winner = a.p
          } else {
            g.phase = 'idle'
            g.turn = (g.turn + 1) % g.players
          }
          anim.current = null
          onState?.(snapshot(g))
        }
      }
    }
    invalidate()
  })

  const [hover, setHover] = useState(false)
  useCursor(hover)

  return (
    <group>
      {/* the frame */}
      {geo.rails.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.frame} rotation-y={(i * Math.PI) / 2} castShadow receiveShadow />
      ))}
      {/* the hardboard core and the printed, laminated face */}
      <mesh material={mats.core} position-y={top / 2}>
        <boxGeometry args={[OPEN, top - 0.0004, OPEN]} />
      </mesh>
      <mesh material={mats.print} rotation-x={-Math.PI / 2} position-y={top} receiveShadow>
        <planeGeometry args={[OPEN, OPEN]} />
      </mesh>
      {/* felt underneath */}
      <mesh material={mats.felt} rotation-x={Math.PI / 2} position-y={0.0003}>
        <planeGeometry args={[OUTER * 2 - 0.004, OUTER * 2 - 0.004]} />
      </mesh>

      {PLAYERS.slice(0, players).map((p, i) => (
        <mesh key={p.name} ref={(m) => (pawnRefs.current[i] = m)} geometry={geo.pawn} material={mats.pawns[i]} castShadow receiveShadow />
      ))}

      <group
        // placed (and moved) only imperatively: a transform prop here would
        // snap it back whenever the board re-renders
        ref={dieRef}
        onClick={(e) => (e.stopPropagation(), roll())}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
        onPointerOut={() => setHover(false)}
      >
        <group scale={DIE}>
          <DieMesh dieColor={dieColor} pipColor={pipColor} />
        </group>
      </group>
    </group>
  )
})

export default Board
