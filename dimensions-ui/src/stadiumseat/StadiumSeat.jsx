import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { canvasTexture } from '../airliner/textures.js'
import { L, LEG, SJ, boltGeometry, clampPoint, footGeometry, gussetGeometry, legGeometry, ribsGeometry, shellGeometry, width } from './geometry.js'

// A one-piece moulded stadium seat on two powder-coated steel brackets: the
// shell (seat pan with a rolled front lip, drain slots, a raised panel on the
// backrest, a truss of ribs underneath) clamped by black blocks to the
// uprights, which stand on foot plates bolted to the tread. `seats` sets a
// row of them; `explode` lifts the shell off its brackets to show how it is
// put together (click a seat to toggle it).

// A prop that can also be changed from inside the scene; `onChange` lets the
// host keep its controls in step.
function useTwoWay(prop, key, onChange) {
  const [v, setV] = useState(prop)
  useEffect(() => setV(prop), [prop])
  return [
    v,
    (next) => {
      setV(next)
      onChange?.({ [key]: next })
    },
  ]
}

export const SPACING = 0.5 // seat centres along a row
const FINISH = { matte: { r: 0.7, cc: 0, env: 0.4 }, satin: { r: 0.5, cc: 0.08, env: 0.45 }, gloss: { r: 0.26, cc: 0.5, env: 0.8 } }

// the drain slots at the back of the seat pan
const SLOT_S = SJ - 0.048
const SLOTS = [-0.5, 0, 0.5]

// The moulding on the sitting side, drawn on the shell's unwrapped surface
// (across the seat by along the profile): the raised panel on the backrest,
// its stepped edge, the countersunk drain slots and the fine spark-eroded
// texture of the tool. `alpha` cuts the slots right through.
function shellMaps() {
  const W = 512
  const H = 1024
  // draw in metres about (u, s): x across the seat, y along the profile
  const at = (ctx, u, s, fn) => {
    ctx.save()
    ctx.translate(((u + 1) / 2) * W, (1 - s / L) * H)
    ctx.scale(W / 2 / width(s), H / L)
    fn()
    ctx.restore()
  }
  const slots = (ctx, grow) =>
    SLOTS.forEach((u) =>
      at(ctx, u, SLOT_S, () => {
        ctx.beginPath()
        ctx.roundRect(-0.032 - grow, -0.0045 - grow, 0.064 + grow * 2, 0.009 + grow * 2, 0.0045 + grow)
        ctx.fill()
      }),
    )
  const panelS = (SJ + 0.075 + L - 0.06) / 2
  const panelH = L - 0.06 - (SJ + 0.075)
  const panel = (ctx, grow) =>
    at(ctx, 0, panelS, () => {
      const w = 0.165 + grow
      const h = panelH / 2 + grow
      ctx.beginPath()
      ctx.roundRect(-w, -h, w * 2, h * 2, 0.05 + grow)
    })

  const bump = canvasTexture(W, H, (ctx) => {
    ctx.fillStyle = 'rgb(128,128,128)'
    ctx.fillRect(0, 0, W, H)
    // the panel stands proud of the backrest, inside a shallow groove
    ctx.filter = 'blur(2px)'
    ctx.lineWidth = 0.006
    ctx.strokeStyle = 'rgb(92,92,92)'
    panel(ctx, 0.004)
    ctx.stroke()
    ctx.fillStyle = 'rgb(150,150,150)'
    panel(ctx, 0)
    ctx.fill()
    // a soft countersink round each slot
    ctx.filter = 'blur(3px)'
    ctx.fillStyle = 'rgb(104,104,104)'
    slots(ctx, 0.003)
    ctx.filter = 'none'
    // the spark-eroded texture of the mould
    const img = ctx.getImageData(0, 0, W, H)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 8
      d[i] += n
      d[i + 1] += n
      d[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
  })
  bump.colorSpace = THREE.NoColorSpace

  const alpha = canvasTexture(W, H, (ctx) => {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#000'
    slots(ctx, 0)
  })
  alpha.colorSpace = THREE.NoColorSpace
  return { bump, alpha }
}

// Everything that does not change with the props, built once and shared by
// every seat in the row.
function useParts() {
  return useMemo(() => {
    const shell = shellGeometry()
    const brackets = [-1, 1].map((side) => {
      const { p } = clampPoint(side)
      const top = p.y + 0.055
      const gx = side > 0 ? p.x + LEG.w / 2 - 0.006 : p.x - LEG.w / 2
      return { side, p, top, leg: legGeometry(top), gusset: gussetGeometry(side, p.z), gx }
    })
    return { shell, ribs: ribsGeometry(), brackets, foot: footGeometry(), bolt: boltGeometry(), maps: shellMaps() }
  }, [])
}

function Seat({ x, parts, mats, explodeRef, onToggle }) {
  const lift = useRef()
  const clamps = useRef()
  const bolts = useRef()
  const anchors = useRef()
  const [hot, setHot] = useState(false)
  useEffect(() => {
    document.body.style.cursor = hot ? 'pointer' : ''
    return () => void (document.body.style.cursor = '')
  }, [hot])
  useFrame(() => {
    const e = explodeRef.current
    // the shell rises first, then the clamps back off and the bolts after them
    const k = (a, b) => THREE.MathUtils.smoothstep(e, a, b)
    lift.current.position.y = 0.17 * k(0.15, 1)
    clamps.current.position.set(0, 0.07 * k(0.15, 1), -0.05 * k(0, 0.6))
    bolts.current.position.set(0, 0.07 * k(0.15, 1), -0.05 * k(0, 0.6) - 0.06 * k(0, 0.45))
    anchors.current.position.y = 0.05 * k(0, 0.5)
  })
  const { shell, ribs, brackets, foot, bolt } = parts
  return (
    <group position-x={x}>
      <group
        ref={lift}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHot(true)
        }}
        onPointerOut={() => setHot(false)}
      >
        <mesh geometry={shell.top} material={mats.top} castShadow receiveShadow />
        <mesh geometry={shell.under} material={mats.under} castShadow receiveShadow />
        <mesh geometry={shell.skirt} material={mats.plain} castShadow receiveShadow />
        <mesh geometry={ribs} material={mats.plain} castShadow receiveShadow />
      </group>
      {brackets.map((b) => (
        <group key={b.side}>
          <mesh geometry={b.leg} material={mats.steel} position={[b.p.x, 0, b.p.z]} castShadow receiveShadow />
          <mesh geometry={b.gusset} material={mats.steel} position-x={b.gx} castShadow receiveShadow />
          <mesh geometry={foot} material={mats.steel} position={[b.p.x, 0, b.p.z + 0.022]} castShadow receiveShadow />
        </group>
      ))}
      <group ref={clamps}>
        {brackets.map((b) => (
          <RoundedBox key={b.side} args={[0.06, 0.112, 0.026]} radius={0.006} smoothness={4} position={[b.p.x, b.top - 0.056 + 0.004, b.p.z - 0.009]} material={mats.clamp} castShadow receiveShadow />
        ))}
      </group>
      <group ref={bolts}>
        {brackets.flatMap((b) =>
          [b.top - 0.088, b.top - 0.032].map((y) => <mesh key={`${b.side}${y}`} geometry={bolt} material={mats.bolt} position={[b.p.x, y, b.p.z - 0.022]} rotation-y={Math.PI} castShadow />),
        )}
      </group>
      <group ref={anchors}>
        {brackets.flatMap((b) =>
          [-0.038, 0.038].map((dz) => <mesh key={`${b.side}${dz}`} geometry={bolt} material={mats.bolt} position={[b.p.x, 0.0068, b.p.z + 0.022 + dz]} rotation-x={-Math.PI / 2} castShadow />),
        )}
      </group>
    </group>
  )
}

export default function StadiumSeat({ color = '#1e3fc0', bracketColor = '#2a2c30', finish = 'satin', seats = 1, explode: explodeProp = 0, onChange }) {
  const parts = useParts()
  const [explode, setExplode] = useTwoWay(explodeProp, 'explode', onChange)
  const explodeRef = useRef(explode)
  useFrame((_, dt) => {
    explodeRef.current = THREE.MathUtils.damp(explodeRef.current, explode, 5, Math.min(dt, 1 / 30))
  })

  const f = FINISH[finish] || FINISH.satin
  const mats = useMemo(() => {
    const shell = { color, roughness: f.r, clearcoat: f.cc, clearcoatRoughness: 0.35, envMapIntensity: f.env, side: THREE.DoubleSide }
    return {
      top: new THREE.MeshPhysicalMaterial({ ...shell, bumpMap: parts.maps.bump, bumpScale: 2, alphaMap: parts.maps.alpha, alphaTest: 0.5 }),
      under: new THREE.MeshPhysicalMaterial({ ...shell, roughness: Math.min(1, f.r + 0.12), alphaMap: parts.maps.alpha, alphaTest: 0.5 }),
      plain: new THREE.MeshPhysicalMaterial({ ...shell, roughness: Math.min(1, f.r + 0.08) }),
      // fine-textured powder coat
      steel: new THREE.MeshPhysicalMaterial({ color: bracketColor, roughness: 0.5, metalness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.55 }),
      clamp: new THREE.MeshStandardMaterial({ color: '#141517', roughness: 0.62 }),
      bolt: new THREE.MeshStandardMaterial({ color: '#a7abb0', roughness: 0.3, metalness: 1 }),
    }
  }, [color, bracketColor, f, parts])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  const n = Math.max(1, Math.round(seats))
  return (
    <group>
      {Array.from({ length: n }, (_, k) => (
        <Seat key={k} x={(k - (n - 1) / 2) * SPACING} parts={parts} mats={mats} explodeRef={explodeRef} onToggle={() => setExplode(explode > 0.5 ? 0 : 1)} />
      ))}
    </group>
  )
}
