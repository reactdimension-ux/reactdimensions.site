import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { lathe } from './build.js'
import { LAY, LAY_H, LAY_W, SPOT, SPOTS, TABLE, WHEEL, spotAt } from './layout.js'
import Table from './Table.jsx'
import { buildChip } from './textures.js'
import Wheel from './Wheel.jsx'

// The whole roulette table, playable: the table, the wheel, and a game on
// top. Click a box on the cloth to put a chip on it (right-click takes one
// back), then spin. When the ball settles a marker drops onto the winning
// number, losing chips are swept away and winning bets are paid: 35 to 1 on
// a number, 2 to 1 on a column or dozen, evens on the outside bets.

const CHIP = { r: 0.0195, h: 0.0033, max: 24 }
const START = 100
// the win marker ("dolly"): a turned brass piece
const DOLLY = [[0, 0], [0.015, 0], [0.016, 0.002], [0.014, 0.006], [0.007, 0.012], [0.0055, 0.03], [0.009, 0.036], [0.011, 0.044], [0.009, 0.052], [0.004, 0.058], [0, 0.059]]

const staked = (bets) => Object.values(bets).reduce((a, b) => a + b, 0)
const newGame = () => ({ phase: 'idle', result: null, history: [], balance: START, bets: {}, won: 0 })

function Chips({ bets, color }) {
  const mesh = useRef()
  const invalidate = useThree((s) => s.invalidate)
  const geo = useMemo(() => new THREE.CylinderGeometry(CHIP.r, CHIP.r, CHIP.h, 48), [])
  const mats = useMemo(() => {
    const [face, edge] = buildChip(color)
    const side = new THREE.MeshPhysicalMaterial({ map: edge, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 })
    const cap = new THREE.MeshPhysicalMaterial({ map: face, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 })
    return [side, cap, cap]
  }, [color])
  useEffect(
    () => () => {
      mats[0].map.dispose()
      mats[1].map.dispose()
      mats[0].dispose()
      mats[1].dispose()
    },
    [mats],
  )
  useEffect(() => () => geo.dispose(), [geo])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const one = new THREE.Vector3(1, 1, 1)
    const p = new THREE.Vector3()
    let n = 0
    for (const [id, count] of Object.entries(bets)) {
      const s = SPOT[id]
      const seed = SPOTS.indexOf(s)
      for (let i = 0; i < Math.min(count, CHIP.max); i++) {
        // a hand-stacked pile: each chip a little off the one below, turned at random
        const a = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453
        const b = Math.sin(seed * 39.3468 + i * 11.135) * 24634.6345
        p.set(s.x + s.w / 2 + ((a - Math.floor(a)) - 0.5) * 0.0016, CHIP.h * (i + 0.5), s.z + s.h / 2 + ((b - Math.floor(b)) - 0.5) * 0.0016)
        q.setFromAxisAngle(up, (a - Math.floor(a)) * Math.PI * 2)
        mesh.current.setMatrixAt(n++, m.compose(p, q, one))
      }
    }
    mesh.current.count = n
    mesh.current.instanceMatrix.needsUpdate = true
    invalidate()
  }, [bets, invalidate])
  return <instancedMesh ref={mesh} args={[geo, undefined, SPOTS.length * CHIP.max]} material={mats} frustumCulled={false} castShadow receiveShadow />
}

// the marker drops onto the winning number, on top of any chips there
function Dolly({ spot, lift, material, geometry }) {
  const ref = useRef()
  const invalidate = useThree((s) => s.invalidate)
  const drop = useRef(1)
  useLayoutEffect(() => {
    drop.current = 1
    invalidate()
  }, [spot, invalidate])
  useFrame((_, dt) => {
    if (drop.current <= 0) return
    drop.current = Math.max(0, drop.current - Math.min(dt, 0.05) / 0.3)
    ref.current.position.y = lift + drop.current * drop.current * 0.09
    invalidate()
  })
  return <mesh ref={ref} geometry={geometry} material={material} position={[spot.x + spot.w / 2, lift + 0.09, spot.z + spot.h / 2]} castShadow />
}

const Roulette = forwardRef(function Roulette({ feltColor = '#0f6b3a', woodColor = '#6a3420', leatherColor = '#33201a', metalColor = '#c9a557', chipColor = '#1f4fbf', betting = true, sound = true, onState }, ref) {
  const invalidate = useThree((s) => s.invalidate)
  const wheel = useRef()
  const [game, setGame] = useState(newGame)
  const [hover, setHover] = useState(null)
  const [overWheel, setOverWheel] = useState(false)
  const idle = game.phase === 'idle'
  useCursor((betting && idle && !!hover) || (idle && overWheel))

  const report = useRef(onState)
  report.current = onState
  useEffect(() => {
    report.current?.({ ...game, staked: staked(game.bets) })
  }, [game])
  useEffect(() => {
    // turning the game off hands the chips back
    if (!betting) setGame((g) => (staked(g.bets) ? { ...g, balance: g.balance + staked(g.bets), bets: {} } : g))
  }, [betting])

  const dolly = useMemo(() => ({ geometry: lathe(DOLLY, 40, 1, 0), material: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.22 }) }), [])
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false }), [])
  const unseen = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), [])
  useLayoutEffect(() => {
    dolly.material.color.set(metalColor)
    invalidate()
  }, [dolly, metalColor, invalidate])
  useEffect(
    () => () => {
      dolly.geometry.dispose()
      dolly.material.dispose()
      glow.dispose()
      unseen.dispose()
    },
    [dolly, glow, unseen],
  )

  const spin = () => {
    if (!wheel.current?.spin()) return
    setHover(null)
    setGame((g) => ({ ...g, phase: 'spinning', won: 0 }))
  }
  const add = (id, n) =>
    setGame((g) => {
      if (g.phase !== 'idle') return g
      const have = g.bets[id] || 0
      const next = Math.max(0, Math.min(have + n, have + g.balance))
      if (next === have) return g
      const bets = { ...g.bets }
      if (next) bets[id] = next
      else delete bets[id]
      return { ...g, bets, balance: g.balance - (next - have), won: 0 }
    })
  const settle = (n) =>
    setGame((g) => {
      // winners are paid and stay on the cloth; the rest are swept away
      const bets = {}
      let won = 0
      for (const [id, count] of Object.entries(g.bets)) {
        if (!SPOT[id].nums.includes(n)) continue
        bets[id] = count
        won += count * SPOT[id].pays
      }
      return { ...g, phase: 'idle', result: n, history: [n, ...g.history].slice(0, 12), bets, balance: g.balance + won, won }
    })
  useImperativeHandle(ref, () => ({
    spin,
    clear: () => setGame((g) => (g.phase === 'idle' && staked(g.bets) ? { ...g, balance: g.balance + staked(g.bets), bets: {}, won: 0 } : g)),
    reset: () => setGame((g) => (g.phase === 'idle' ? newGame() : g)),
  }))

  const point = (e) => (betting && idle ? spotAt(e.point.x, e.point.z) : null)
  const over = hover && SPOT[hover]
  const winner = game.result === null ? null : SPOT[`n${game.result}`]

  return (
    <group>
      <Table feltColor={feltColor} woodColor={woodColor} leatherColor={leatherColor} metalColor={metalColor} />
      <Wheel
        ref={wheel}
        position={[WHEEL.x, TABLE.H, WHEEL.z]}
        woodColor={woodColor}
        metalColor={metalColor}
        sound={sound}
        onResult={settle}
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta < 6) spin()
        }}
        onPointerOver={(e) => (e.stopPropagation(), setOverWheel(true))}
        onPointerOut={() => setOverWheel(false)}
      />
      <group position-y={TABLE.H}>
        {/* the layout answers the pointer through an unseen sheet just over the cloth */}
        <mesh
          material={unseen}
          rotation-x={-Math.PI / 2}
          position={[LAY.x + LAY_W / 2, 0.0004, LAY.z + LAY_H / 2]}
          onPointerMove={(e) => setHover(point(e)?.id ?? null)}
          onPointerOut={() => setHover(null)}
          onClick={(e) => {
            const s = point(e)
            if (s && e.delta < 6) add(s.id, 1)
          }}
          onContextMenu={(e) => {
            e.nativeEvent.preventDefault()
            const s = point(e)
            if (s) add(s.id, -1)
          }}
        >
          <planeGeometry args={[LAY_W, LAY_H]} />
        </mesh>
        {over && betting && idle && (
          <mesh material={glow} rotation-x={-Math.PI / 2} position={[over.x + over.w / 2, 0.0006, over.z + over.h / 2]}>
            <planeGeometry args={[over.w - 0.003, over.h - 0.003]} />
          </mesh>
        )}
        <Chips bets={game.bets} color={chipColor} />
        {winner && idle && <Dolly spot={winner} lift={Math.min(game.bets[winner.id] || 0, CHIP.max) * CHIP.h} {...dolly} />}
      </group>
    </group>
  )
})

export default Roulette
