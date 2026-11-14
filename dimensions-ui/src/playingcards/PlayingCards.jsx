import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { CARD_H, CARD_W, cardShape, faceGeometry, paperTexture } from '../deck/faces.js'
import { RANKS, backTexture, faceTexture } from './faces.js'

// A suit of playing cards dealt out on a felt table. The card itself is the
// Color Cards card (deck/faces.js): the same rounded outline, the same face
// mapping, the same coated stock with its paper grain; only the artwork is
// new. Units are centimetres, the felt is at y = 0.
//
// Cards fly in from the pile one after another, lie with the slight
// untidiness of real cards, lift when you point at one, and turn over when
// you click it.

const T = 0.03 // card thickness (0.3 mm)
const GAP = 0.7
const PILE = new THREE.Vector3(CARD_W * 5.2, 0, CARD_H * 1.3)

// where each card lies: [x, z, turn]
export function layoutPoses(layout) {
  const r = (i, k) => {
    const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
    return s - Math.floor(s) - 0.5
  }
  return RANKS.map((_, i) => {
    let x
    let z
    let rot
    if (layout === 'fan') {
      // a fanned hand, lying on the table
      const a = (i - 6) * 0.11
      const P = 26
      x = Math.sin(a) * P
      z = P - Math.cos(a) * P - 1
      rot = -a
    } else {
      // two rows: ace to 7, then 8 to king, like the reference sheet
      const top = i < 7
      const n = top ? 7 : 6
      const k = top ? i : i - 7
      x = (k - (n - 1) / 2) * (CARD_W + GAP)
      z = (top ? -1 : 1) * (CARD_H / 2 + GAP * 0.9)
      rot = 0
    }
    return { x: x + r(i, 1) * 0.25, z: z + r(i, 2) * 0.25, rot: rot + r(i, 3) * 0.035, y: layout === 'fan' ? i * T * 1.2 : 0 }
  })
}

export function cardsExtent(layout) {
  return layout === 'fan' ? { w: 30, h: 16, cz: 2 } : { w: 7 * CARD_W + 6 * GAP, h: 2 * CARD_H + 2 * GAP, cz: 0 }
}

function Card({ geo, faceMat, backMat, edgeMats, pose, delay, dealId, flipAll }) {
  const outer = useRef()
  const inner = useRef()
  const invalidate = useThree((s) => s.invalidate)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const s = useRef({ born: null, flip: 0, fv: 0, target: 0, h: 0 })
  useEffect(() => {
    s.current.born = null
    invalidate()
  }, [dealId, invalidate])
  useEffect(() => {
    s.current.target = flipAll ? 1 : 0
    invalidate()
  }, [flipAll, invalidate])
  useEffect(() => void invalidate(), [hover, invalidate])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const c = s.current
    const now = state.clock.elapsedTime
    if (c.born === null) c.born = now
    // dealt from the pile: slides in with a spin and a little lift
    const t = Math.min(1, Math.max(0, (now - c.born - delay) / 0.55))
    const e = 1 - Math.pow(1 - t, 3)
    const o = outer.current
    o.visible = now - c.born >= delay
    o.position.set(
      THREE.MathUtils.lerp(PILE.x, pose.x, e),
      pose.y + Math.sin(Math.PI * t) * 2.2 + T / 2,
      THREE.MathUtils.lerp(PILE.z, pose.z, e),
    )
    o.rotation.y = THREE.MathUtils.lerp(pose.rot + 1.6, pose.rot, e)
    // flip: a spring towards face up (0) or face down (1); hover lifts it
    c.fv += ((c.target - c.flip) * 170 - c.fv * 20) * dt
    c.flip += c.fv * dt
    c.h += ((hover ? 1 : 0) - c.h) * Math.min(1, dt * 12)
    const i = inner.current
    // turning about its long side, the card must rise by half its width
    // times |sin| of the angle to clear the felt
    const swing = Math.abs(Math.sin(Math.PI * c.flip)) * (CARD_W / 2)
    i.rotation.z = Math.PI * c.flip
    i.position.y = swing + c.h * 0.9
    i.rotation.x = -c.h * 0.06
    const settled = t >= 1 && Math.abs(c.target - c.flip) < 1e-3 && Math.abs(c.fv) < 1e-3 && Math.abs((hover ? 1 : 0) - c.h) < 1e-3
    if (!settled) invalidate()
  })

  return (
    <group ref={outer}>
      <group ref={inner}>
        {/* lying flat, face up */}
        <group
          rotation-x={-Math.PI / 2}
          onClick={(e) => {
            e.stopPropagation()
            s.current.target = s.current.target ? 0 : 1
            invalidate()
          }}
          onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
          onPointerOut={() => setHover(false)}
        >
          <mesh geometry={geo.face} material={faceMat} castShadow receiveShadow />
          <mesh geometry={geo.back} material={backMat} castShadow receiveShadow />
          <mesh geometry={geo.edge} material={edgeMats} />
        </group>
      </group>
    </group>
  )
}

const PlayingCards = forwardRef(function PlayingCards({ suit = 'clubs', layout = 'rows', backColor = '#a3202a' }, ref) {
  const [dealId, setDealId] = useState(0)
  const [flipAll, setFlipAll] = useState(false)
  useImperativeHandle(ref, () => ({ deal: () => setDealId((d) => d + 1), flip: () => setFlipAll((f) => !f) }), [])

  const geo = useMemo(() => {
    const shape = cardShape()
    const edge = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 12 })
    edge.translate(0, 0, -T / 2)
    const face = faceGeometry(shape)
    face.translate(0, 0, T / 2 + 0.0004)
    const back = faceGeometry(shape)
    back.rotateY(Math.PI)
    back.translate(0, 0, -T / 2 - 0.0004)
    return { edge, face, back }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const paper = useMemo(() => paperTexture(), [])
  useEffect(() => () => paper.dispose(), [paper])
  // coated card stock, as on the Color Cards
  // (bump strength is in world units: the Color Cards scene is in cm, this
  // one is scaled to metres, so the grain's height is scaled down with it)
  const makeCardMat = (map) => new THREE.MeshPhysicalMaterial({ map, bumpMap: paper, bumpScale: 0.0035, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.28, sheen: 0.2, sheenRoughness: 0.6 })
  const edgeMats = useMemo(() => [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial({ color: '#ebe8e1', roughness: 0.8 })], [])
  useEffect(() => () => edgeMats.forEach((m) => m.dispose()), [edgeMats])
  const backMat = useMemo(() => makeCardMat(backTexture(backColor)), [backColor, paper]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => (backMat.map.dispose(), backMat.dispose()), [backMat])
  const faceMats = useMemo(() => RANKS.map((r) => makeCardMat(faceTexture(r, suit))), [suit, paper]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => faceMats.forEach((m) => (m.map.dispose(), m.dispose())), [faceMats])

  const poses = useMemo(() => layoutPoses(layout), [layout])
  return (
    <group>
      {RANKS.map((r, i) => (
        <Card key={r} geo={geo} faceMat={faceMats[i]} backMat={backMat} edgeMats={edgeMats} pose={poses[i]} delay={i * 0.07} dealId={`${dealId}-${layout}`} flipAll={flipAll} />
      ))}
    </group>
  )
})

export default PlayingCards
