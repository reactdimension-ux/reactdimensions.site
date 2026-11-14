import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { CARD_H, CARD_W, cardShape, faceGeometry, paperTexture } from '../deck/faces.js'
import { RANKS, backTexture, faceTexture } from './faces.js'

// the suit, ace to king, and a joker
export const CARDS = [...RANKS, 'JOKER']

// A suit of playing cards dealt out on a felt table. The card itself is the
// Color Cards card (deck/faces.js): the same rounded outline, the same face
// mapping, the same coated stock with its paper grain; only the artwork is
// new. Units are centimetres, the felt is at y = 0.
//
// Cards fly in from the pile one after another and land square, in neat
// rows. Each one can be picked up: press and drag to carry it over the felt
// (it lifts, and drops on top of the others), or click it to turn it over.

const T = 0.03 // card thickness (0.3 mm)
const GAP = 0.7
const PILE = new THREE.Vector3(CARD_W * 5.2, 0, CARD_H * 1.3)
const FELT = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

// where each card lies
export function layoutPoses(layout) {
  return CARDS.map((_, i) => {
    if (layout === 'fan') {
      // a fanned hand, lying on the table
      const a = (i - 6.5) * 0.105
      const P = 26
      return { x: Math.sin(a) * P, z: P - Math.cos(a) * P - 1, rot: -a }
    }
    // two straight rows of seven: ace to 7, then 8 to king and the joker
    const top = i < 7
    const n = 7
    const k = top ? i : i - 7
    return { x: (k - (n - 1) / 2) * (CARD_W + GAP), z: (top ? -1 : 1) * (CARD_H / 2 + GAP * 0.9), rot: 0 }
  })
}

export function cardsExtent(layout) {
  return layout === 'fan' ? { w: 32, h: 16, cz: 2 } : { w: 7 * CARD_W + 6 * GAP, h: 2 * CARD_H + 2 * GAP, cz: 0 }
}

function Card({ geo, faceMat, backMat, edgeMats, pose, index, delay, dealId, flipAll, topLayer }) {
  const outer = useRef()
  const inner = useRef()
  const { invalidate, controls } = useThree()
  const [hover, setHover] = useState(false)
  const [held, setHeld] = useState(false)
  useCursor(hover || held, held ? 'grabbing' : 'grab')
  // x, z: where it rests (cm); layer: its place in the stack
  const s = useRef({ born: null, flip: 0, fv: 0, target: 0, lift: 0, x: pose.x, z: pose.z, layer: index, down: null, drag: false, off: new THREE.Vector3() })
  useEffect(() => {
    const c = s.current
    c.born = null
    c.x = pose.x
    c.z = pose.z
    c.layer = index
    invalidate()
  }, [dealId, pose, index, invalidate])
  useEffect(() => {
    s.current.target = flipAll ? 1 : 0
    invalidate()
  }, [flipAll, invalidate])
  useEffect(() => void invalidate(), [hover, held, invalidate])

  const hit = useMemo(() => new THREE.Vector3(), [])
  // where the pointer's ray meets the felt, in the cards' own (cm) space
  const onFelt = (e) => (e.ray.intersectPlane(FELT, hit) ? outer.current.parent.worldToLocal(hit) : null)

  const handlers = {
    onPointerDown: (e) => {
      e.stopPropagation()
      e.target.setPointerCapture?.(e.pointerId)
      const c = s.current
      c.down = { x: e.clientX, y: e.clientY }
      c.drag = false
      const p = onFelt(e)
      if (p) c.off.set(c.x - p.x, 0, c.z - p.z)
      if (controls) controls.enabled = false
    },
    onPointerMove: (e) => {
      const c = s.current
      if (!c.down) return
      e.stopPropagation()
      if (!c.drag && Math.hypot(e.clientX - c.down.x, e.clientY - c.down.y) > 4) {
        c.drag = true
        c.layer = ++topLayer.current
        setHeld(true)
      }
      if (!c.drag) return
      const p = onFelt(e)
      if (p) {
        c.x = p.x + c.off.x
        c.z = p.z + c.off.z
        invalidate()
      }
    },
    onPointerUp: (e) => {
      const c = s.current
      if (!c.down) return
      e.stopPropagation()
      e.target.releasePointerCapture?.(e.pointerId)
      if (!c.drag) {
        // a click: turn it over (on top of whatever it overlaps)
        c.target = c.target ? 0 : 1
        c.layer = ++topLayer.current
      }
      c.down = null
      c.drag = false
      setHeld(false)
      if (controls) controls.enabled = true
      invalidate()
    },
    onPointerOver: (e) => (e.stopPropagation(), setHover(true)),
    onPointerOut: () => setHover(false),
  }

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
    // held cards lift clear of the others; a pointed-at one rises a touch
    const want = held ? 2.5 : hover ? 0.5 : 0
    c.lift += (want - c.lift) * Math.min(1, dt * 14)
    o.position.set(THREE.MathUtils.lerp(PILE.x, c.x, e), c.layer * T * 1.05 + T / 2 + c.lift + Math.sin(Math.PI * t) * 2.2, THREE.MathUtils.lerp(PILE.z, c.z, e))
    o.rotation.y = THREE.MathUtils.lerp(pose.rot + 1.6, pose.rot, e)
    // flip: a spring towards face up (0) or face down (1)
    c.fv += ((c.target - c.flip) * 170 - c.fv * 20) * dt
    c.flip += c.fv * dt
    const i = inner.current
    // turning about its long side, the card must rise by half its width
    // times |sin| of the angle to clear the felt
    i.rotation.z = Math.PI * c.flip
    i.position.y = Math.abs(Math.sin(Math.PI * c.flip)) * (CARD_W / 2)
    const settled = t >= 1 && Math.abs(c.target - c.flip) < 1e-3 && Math.abs(c.fv) < 1e-3 && Math.abs(want - c.lift) < 1e-3
    if (!settled) invalidate()
  })

  return (
    <group ref={outer}>
      <group ref={inner}>
        {/* lying flat, face up */}
        <group rotation-x={-Math.PI / 2} {...handlers}>
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
  // A satin finish, like casino stock: a glossier coat mirrors the overhead
  // light straight back down the camera in the top view and greys the print.
  // (bump strength is in world units: the Color Cards scene is in cm, this
  // one is scaled to metres, so the grain's height is scaled down with it)
  const makeCardMat = (map) => new THREE.MeshPhysicalMaterial({ map, bumpMap: paper, bumpScale: 0.0035, roughness: 0.58, clearcoat: 0.18, clearcoatRoughness: 0.5 })
  const edgeMats = useMemo(() => [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial({ color: '#ebe8e1', roughness: 0.8 })], [])
  useEffect(() => () => edgeMats.forEach((m) => m.dispose()), [edgeMats])
  const backMat = useMemo(() => makeCardMat(backTexture(backColor)), [backColor, paper]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => (backMat.map.dispose(), backMat.dispose()), [backMat])
  const faceMats = useMemo(() => CARDS.map((r) => makeCardMat(faceTexture(r, suit))), [suit, paper]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => faceMats.forEach((m) => (m.map.dispose(), m.dispose())), [faceMats])

  const poses = useMemo(() => layoutPoses(layout), [layout])
  const topLayer = useRef(CARDS.length)
  useEffect(() => void (topLayer.current = CARDS.length), [dealId, layout])
  return (
    <group>
      {CARDS.map((r, i) => (
        <Card key={r} geo={geo} faceMat={faceMats[i]} backMat={backMat} edgeMats={edgeMats} pose={poses[i]} index={i} topLayer={topLayer} delay={i * 0.07} dealId={`${dealId}-${layout}`} flipAll={flipAll} />
      ))}
    </group>
  )
})

export default PlayingCards
