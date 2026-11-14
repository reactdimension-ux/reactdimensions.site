import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { CARD_H, CARD_W, KINDS, WILDS, backTexture, cardShape, faceGeometry, faceTexture, paperTexture } from './faces.js'
import { createDeckAudio } from './audio.js'

// A deck of colour cards in four suits, each with 0-9, skip, reverse and +2.
// 1 unit = 1 cm; a card is 5.6 x 8.7 cm and 0.4 mm thick.
//
// layout "hand": a dealt hand fanned out like it's held. Hover a card to lift
// it, click it to flip it over. "Deal" (via the ref) deals a fresh hand.
// layout "single": one card that tilts towards the pointer; click to flip.

const T = 0.04
const HAND = 7
const FAN_R = 14 // the fan's pivot sits this far below the middle card
const FAN_SPREAD = 0.13 // radians between neighbouring cards
const PILE = new THREE.Vector3(0, -15, 6) // where dealt cards fly in from

const rand = (n) => Math.floor(Math.random() * n)
// mostly suit cards, with the odd wild like a real deal
const randomHand = () =>
  Array.from({ length: HAND }, () => ({ kind: Math.random() < 0.12 ? WILDS[rand(2)] : KINDS.filter((k) => !WILDS.includes(k))[rand(KINDS.length - 2)], suit: rand(4) }))

export function fanPose(i, n) {
  const a = (i - (n - 1) / 2) * FAN_SPREAD
  return { x: Math.sin(a) * FAN_R, y: Math.cos(a) * FAN_R - FAN_R, z: i * 0.06, rz: -a }
}
// the area the cards cover, for framing the camera
export function deckView(layout) {
  if (layout === 'single') return { w: CARD_W + 1.5, h: CARD_H + 1.5, cy: 0 }
  const p = fanPose(0, HAND)
  const w = Math.abs(p.x) * 2 + CARD_W * 1.25 + 1.5
  return { w, h: CARD_H + 2.6, cy: -0.6 }
}

const Deck = forwardRef(function Deck(
  {
    layout = 'hand',
    card = '7',
    suit = 1,
    brand = 'RD',
    color1 = '#d8262b',
    color2 = '#f2c418',
    color3 = '#2f9a3a',
    color4 = '#1f7fd1',
    sound = true,
  },
  ref,
) {
  const colors = [color1, color2, color3, color4]
  const [hand, setHand] = useState(randomHand)
  const [dealId, setDealId] = useState(0)

  const audio = useRef(null)
  useEffect(() => {
    if (!sound) return
    audio.current = createDeckAudio()
    return () => {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])

  const deal = () => {
    setHand(randomHand())
    setDealId((d) => d + 1)
    audio.current?.deal(HAND)
  }
  useImperativeHandle(ref, () => ({ deal }), [])

  // ---- shared geometry and materials ----
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

  // coated card stock: a slightly glossy laminate over fine paper grain
  const makeCardMat = (map) =>
    new THREE.MeshPhysicalMaterial({ map, bumpMap: paper, bumpScale: 0.35, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.28, sheen: 0.2, sheenRoughness: 0.6 })

  const edgeMats = useMemo(() => [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.8 })], [])
  useEffect(() => () => edgeMats.forEach((m) => m.dispose()), [edgeMats])

  const backMat = useMemo(() => makeCardMat(backTexture(color1, color2, brand)), [color1, color2, brand, paper]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => (backMat.map.dispose(), backMat.dispose()), [backMat])

  const cards = layout === 'single' ? [{ kind: KINDS.includes(String(card)) ? String(card) : '7', suit: Math.min(3, Math.max(0, Number(suit) - 1)) }] : hand
  const key = cards.map((c) => `${c.kind}.${c.suit}`).join('|') + colors.join('')
  const faceMats = useMemo(
    () => cards.map((c) => makeCardMat(faceTexture(c.kind, colors[c.suit], layout === 'single' ? 200 : 140, colors))),
    [key, layout, paper], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useEffect(() => () => faceMats.forEach((m) => (m.map.dispose(), m.dispose())), [faceMats])

  return (
    <group>
      {cards.map((c, i) => (
        <Card
          key={`${layout}-${dealId}-${i}`}
          geo={geo}
          faceMat={faceMats[i]}
          backMat={backMat}
          edgeMats={edgeMats}
          pose={layout === 'single' ? { x: 0, y: 0, z: 0, rz: 0 } : fanPose(i, cards.length)}
          delay={layout === 'single' ? 0 : i * 0.08}
          single={layout === 'single'}
          audio={audio}
        />
      ))}
    </group>
  )
})

export default Deck

function Card({ geo, faceMat, backMat, edgeMats, pose, delay, single, audio }) {
  const outer = useRef()
  const inner = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const s = useRef({ born: null, flip: 0, fv: 0, target: 0, h: 0 })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const c = s.current
    const now = state.clock.elapsedTime
    if (c.born === null) c.born = now
    // dealing: fly in from the pile with a little spin, ease out
    const t = Math.min(1, Math.max(0, (now - c.born - delay) / 0.5))
    const e = single ? 1 : 1 - Math.pow(1 - t, 3)
    const o = outer.current
    o.position.set(
      THREE.MathUtils.lerp(PILE.x, pose.x, e),
      THREE.MathUtils.lerp(PILE.y, pose.y, e),
      THREE.MathUtils.lerp(PILE.z, pose.z, e),
    )
    o.rotation.z = THREE.MathUtils.lerp(pose.rz + 0.9, pose.rz, e)
    o.visible = single || now - c.born >= delay

    // flip: a spring towards face up (0) or face down (1)
    c.fv += ((c.target - c.flip) * 170 - c.fv * 20) * dt
    c.flip += c.fv * dt
    c.h += ((hover ? 1 : 0) - c.h) * Math.min(1, dt * 12)

    const i = inner.current
    i.rotation.y = Math.PI * c.flip
    const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, c.flip))) // lift while it turns
    if (single) {
      // idle float and a tilt towards the pointer
      i.position.set(0, Math.sin(now * 1.1) * 0.12, arc * 2.2)
      i.rotation.x = -state.pointer.y * 0.28 + Math.sin(now * 0.7) * 0.03
      i.rotation.y += state.pointer.x * 0.32
      i.rotation.z = 0
    } else {
      // hovered cards rise out of the hand
      i.position.set(0, c.h * 1.1 + arc * 0.6, c.h * 0.5 + arc * 2.4)
      i.rotation.x = -0.12 * c.h
    }
  })

  const onClick = (e) => {
    e.stopPropagation()
    const c = s.current
    c.target = c.target ? 0 : 1
    audio.current?.flip()
  }

  return (
    <group ref={outer}>
      <group ref={inner}>
        <group
          onClick={onClick}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
          }}
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
