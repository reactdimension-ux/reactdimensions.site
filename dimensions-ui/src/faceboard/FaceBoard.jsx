import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createBoardAudio } from './audio.js'

// A face-guessing board: a moulded plastic tray with rows of little hinged
// frames, each holding a card with a face on it, and a holder at the front
// for your own secret card. The cards start empty; fill them with your own
// photos.
//
// Each frame is a real hinge: it leans a little back from upright, resting
// on a stop under its own weight. Push it forward past vertical and it
// falls toward you under gravity (a pendulum swinging from its foot), lands
// face down on the tray with its plain back showing and bounces once or
// twice. Flick a fallen one up hard enough and it swings back up past
// vertical and drops back against its stop.
// SI units: metres. The player sits along +z; frames fall toward +z.

const FRAME_W = 0.034
const FRAME_H = 0.054
const FRAME_T = 0.0032
const PITCH_X = 0.0395
const ROW_Z = 0.074
const RAIL_H = 0.009
const STEP = 0.011 // each row back stands a little higher, so every face shows
const CARD_W = 0.0276
const CARD_H = 0.0455
const LEAN = 0.12 // rad back from upright, where it rests on its stop
// lying face down on the tray: past flat for the higher rows, until the top touches
const flatFor = (r) => Math.PI / 2 - 0.03 + Math.asin(Math.min(0.9, (RAIL_H + r * STEP - 0.002) / FRAME_H))
const G = 9.81
const M = 0.006
const I_HINGE = (M * FRAME_H * FRAME_H) / 3

function roundedRect(w, h, r, x = -w / 2, y = 0) {
  const s = new THREE.Shape()
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}
function roundedPath(w, h, r, x, y) {
  const p = new THREE.Path()
  p.setFromPoints(roundedRect(w, h, r, x, y).getPoints(6))
  return p
}

// The frame: a moulded surround with a window for the card, a back panel so
// it can't be seen through from behind, and knuckles at its foot.
function frameGeometry() {
  const outer = roundedRect(FRAME_W, FRAME_H, 0.004, -FRAME_W / 2, 0.003)
  outer.holes.push(roundedPath(CARD_W - 0.001, CARD_H - 0.001, 0.0018, -(CARD_W - 0.001) / 2, 0.0065))
  const g = new THREE.ExtrudeGeometry(outer, { depth: FRAME_T - 0.0012, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0005, bevelSegments: 2, curveSegments: 6 })
  g.translate(0, 0, -FRAME_T / 2 + 0.0006)
  return g
}

// A card: the photo, cropped to fill, on white card stock, with a name strip.
function drawCard(canvas, img, name, labels) {
  const g = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  g.fillStyle = '#fbfaf6'
  g.fillRect(0, 0, W, H)
  // paper tooth
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  }
  const pad = W * 0.07
  const ph = labels ? H * 0.72 : H - pad * 2
  const pw = W - pad * 2
  g.save()
  g.beginPath()
  g.roundRect(pad, pad, pw, ph, 10)
  g.clip()
  if (img) {
    // cover: fill the window, cropping the longer side, faces sit high
    const s = Math.max(pw / img.width, ph / img.height)
    const w = img.width * s
    const h = img.height * s
    g.drawImage(img, pad + (pw - w) / 2, pad + (ph - h) * 0.3, w, h)
  } else {
    const grd = g.createLinearGradient(0, pad, 0, pad + ph)
    grd.addColorStop(0, '#eef0f2')
    grd.addColorStop(1, '#dfe3e7')
    g.fillStyle = grd
    g.fillRect(pad, pad, pw, ph)
    // an empty frame: a faint head-and-shoulders outline
    g.strokeStyle = 'rgba(120,130,140,0.35)'
    g.lineWidth = 5
    g.setLineDash([12, 10])
    g.beginPath()
    g.arc(W / 2, pad + ph * 0.4, pw * 0.2, 0, Math.PI * 2)
    g.moveTo(pad + pw * 0.16, pad + ph)
    g.quadraticCurveTo(W / 2, pad + ph * 0.55, pad + pw * 0.84, pad + ph)
    g.stroke()
    g.setLineDash([])
  }
  g.restore()
  g.strokeStyle = 'rgba(0,0,0,0.12)'
  g.lineWidth = 2
  g.beginPath()
  g.roundRect(pad, pad, pw, ph, 10)
  g.stroke()
  if (labels) {
    const ly = pad + ph + H * 0.035
    const lh = H - ly - pad * 0.8
    g.fillStyle = '#ffffff'
    g.fillRect(pad, ly, pw, lh)
    g.strokeStyle = 'rgba(0,0,0,0.15)'
    g.strokeRect(pad, ly, pw, lh)
    g.fillStyle = '#26282c'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let size = lh * 0.55
    g.font = `800 ${size}px Inter, Arial, sans-serif`
    const label = (name || '').toUpperCase()
    while (g.measureText(label).width > pw * 0.9 && size > 10) {
      size -= 2
      g.font = `800 ${size}px Inter, Arial, sans-serif`
    }
    g.fillText(label, W / 2, ly + lh / 2 + 1)
  }
}

// Plastic with a faint moulded texture (a bump map).
function plasticTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 })
  const g = c.getContext('2d')
  const img = g.createImageData(128, 128)
  for (let i = 0; i < 128 * 128; i++) {
    const v = 120 + Math.random() * 30
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(30, 30)
  return t
}

// rows, cols: the grid. photos: [{ src, name }] (missing entries stay
// empty). secret: index of the card in the front holder, or -1. labels: name
// strips under the faces. trayColor, frameColor: the plastics. sound.
// flipUp: bump to stand every frame back up. api: a ref the scene uses to
// find which frame is under a point (for dropping a photo onto one).
export default function FaceBoard({ rows = 3, cols = 8, photos = [], secret = -1, labels = true, trayColor = '#2b62d9', frameColor = '#f3f2ee', sound = false, flipUp = 0, api }) {
  const R = Math.max(1, Math.min(5, rows | 0))
  const C = Math.max(2, Math.min(10, cols | 0))
  const N = R * C
  const [hover, setHover] = useState(-1)
  useCursor(hover >= 0)
  const { camera, gl } = useThree()

  const W = C * PITCH_X + 0.03
  const D = R * ROW_Z + 0.12
  const rowZ = (r) => D / 2 - 0.1 - r * ROW_Z // front row first; room in front of each to fall
  const colX = (c) => (c - (C - 1) / 2) * PITCH_X

  // ---- geometry and materials ----
  const geo = useMemo(
    () => ({
      frame: frameGeometry(),
      card: new THREE.PlaneGeometry(CARD_W, CARD_H),
      back: new THREE.PlaneGeometry(CARD_W + 0.001, CARD_H + 0.001),
      knuckle: new THREE.CylinderGeometry(0.0022, 0.0022, 0.006, 12).rotateZ(Math.PI / 2),
      holderCard: new THREE.PlaneGeometry(CARD_W * 1.25, CARD_H * 1.25),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const bump = useMemo(() => plasticTexture(), [])
  useEffect(() => () => bump.dispose(), [bump])
  const mats = useMemo(
    () => ({
      tray: new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, bumpMap: bump, bumpScale: 0.15 }),
      frame: new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.18, bumpMap: bump, bumpScale: 0.1 }),
      back: new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.3, side: THREE.DoubleSide }),
      slot: new THREE.MeshStandardMaterial({ color: '#0d0f12', roughness: 0.8 }),
    }),
    [bump],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.tray.color.set(trayColor)
    mats.frame.color.set(frameColor)
    mats.back.color.set(frameColor).multiplyScalar(0.92)
  }, [mats, trayColor, frameColor])

  // ---- the cards: one canvas each, redrawn when its photo or name changes ----
  const cards = useMemo(
    () =>
      Array.from({ length: N + 1 }, () => {
        const canvas = Object.assign(document.createElement('canvas'), { width: 256, height: 422 })
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8
        const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 })
        return { canvas, tex, mat, key: null }
      }),
    [N],
  )
  useEffect(() => () => cards.forEach((c) => (c.tex.dispose(), c.mat.dispose())), [cards])
  const images = useRef(new Map()) // src -> loaded image
  const [, bumpLoaded] = useState(0)
  useEffect(() => {
    const draw = (card, p) => {
      const key = `${p?.src || ''}|${p?.name || ''}|${labels}`
      if (card.key === key) return
      let img = null
      if (p?.src) {
        img = images.current.get(p.src)
        if (!img) {
          img = new Image()
          img.onload = () => bumpLoaded((x) => x + 1)
          img.src = p.src
          images.current.set(p.src, img)
        }
        if (!img.complete || !img.naturalWidth) return // drawn once it loads
      }
      drawCard(card.canvas, img, p?.name, labels)
      card.tex.needsUpdate = true
      card.key = key
    }
    for (let i = 0; i < N; i++) draw(cards[i], photos[i])
    draw(cards[N], secret >= 0 ? photos[secret] : null)
  })

  // ---- sound ----
  const audio = useRef(null)
  const live = useRef({})
  live.current = { sound }
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const play = (name, s) => {
    if (!live.current.sound) return
    if (!audio.current) audio.current = createBoardAudio()
    audio.current?.[name](s)
  }

  // ---- the hinges ----
  // angle: rad forward from vertical (-LEAN standing on its stop, `flat` when down)
  const hinges = useMemo(() => Array.from({ length: N }, (_, i) => ({ a: -LEAN, w: 0, flat: flatFor(Math.floor(i / C)) })), [N, C])
  // speed needed to swing from face-down back past vertical (energy to clear
  // the gravity barrier, plus margin for friction) - back rows lie flatter, so need more
  const flickUp = (h) => -(Math.sqrt(2 * ((3 * G) / (2 * FRAME_H)) * (1 - Math.cos(h.flat))) * 1.08 + 1 + Math.random())
  const flip = (i) => {
    const h = hinges[i]
    if (h.a < 0.6) h.w = 3.2 + Math.random() * 0.8 // a push forward, past vertical
    else h.w = flickUp(h) // flicked up from flat: enough to swing back past vertical
  }
  const first = useRef(true)
  useEffect(() => {
    if (first.current) return
    hinges.forEach((h, i) => {
      if (h.a > 0.6) setTimeout(() => (h.w = flickUp(h)), i * 18)
    })
  }, [flipUp]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    first.current = false
  }, [])

  const stepHinge = (h, dt) => {
    // gravity about the foot of the frame: a pendulum from its hinge
    h.w += ((M * G * (FRAME_H / 2) * Math.sin(h.a)) / I_HINGE) * dt
    h.w *= Math.exp(-0.8 * dt) // air and hinge friction
    h.a += h.w * dt
    if (h.a >= h.flat) {
      // face down on the tray
      if (h.w > 0.6) play('clack', h.w / 8)
      h.a = h.flat
      h.w = h.w > 0 ? -h.w * 0.28 : h.w
      if (Math.abs(h.w) < 0.3) h.w = 0
    }
    if (h.a <= -LEAN) {
      // back against its stop
      if (h.w < -1) play('snap', -h.w / 20)
      h.a = -LEAN
      h.w = h.w < 0 ? -h.w * 0.04 : h.w
      if (Math.abs(h.w) < 0.2) h.w = 0
    }
  }

  // ---- which frame is under a screen point (for drops) ----
  const frameRefs = useRef([])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  useEffect(() => {
    if (!api) return
    api.current = {
      pick(clientX, clientY) {
        const r = gl.domElement.getBoundingClientRect()
        ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera)
        const objs = frameRefs.current.filter(Boolean)
        const hit = ray.intersectObjects(objs, true)[0]
        if (!hit) return -1
        let o = hit.object
        while (o && o.userData.index === undefined) o = o.parent
        return o ? o.userData.index : -1
      },
    }
  })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!(dt > 0)) return
    const n = Math.ceil(dt / (1 / 1000))
    for (let k = 0; k < n; k++) for (const h of hinges) stepHinge(h, dt / n)
    hinges.forEach((h, i) => {
      const g = frameRefs.current[i]
      if (g) g.rotation.x = h.a
    })
  })

  const trayTop = 0.012
  return (
    <group>
      {/* the tray: a moulded base with a raised lip and a rail for each row */}
      <RoundedBox args={[W, trayTop, D]} radius={0.005} smoothness={4} position={[0, trayTop / 2, 0]} material={mats.tray} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <RoundedBox key={`l${s}`} args={[0.008, 0.012, D]} radius={0.003} smoothness={3} position={[s * (W / 2 - 0.004), trayTop + 0.006, 0]} material={mats.tray} castShadow receiveShadow />
      ))}
      <RoundedBox args={[W, 0.012, 0.008]} radius={0.003} smoothness={3} position={[0, trayTop + 0.006, -D / 2 + 0.004]} material={mats.tray} castShadow receiveShadow />
      {Array.from({ length: R }, (_, r) => (
        <RoundedBox key={r} args={[W - 0.016, RAIL_H + r * STEP, 0.012]} radius={0.003} smoothness={3} position={[0, trayTop + (RAIL_H + r * STEP) / 2, rowZ(r) + 0.004]} material={mats.tray} castShadow receiveShadow />
      ))}
      {/* the front: a raised ledge with the holder for your secret card */}
      <RoundedBox args={[W - 0.016, 0.016, 0.03]} radius={0.004} smoothness={3} position={[0, trayTop + 0.008, D / 2 - 0.02]} material={mats.tray} castShadow receiveShadow />
      <group position={[0, trayTop + 0.016, D / 2 - 0.018]} rotation-x={-1.05}>
        <RoundedBox args={[CARD_W + 0.008, CARD_H + 0.008, 0.004]} radius={0.003} smoothness={3} position={[0, CARD_H / 2 + 0.002, -0.002]} material={mats.frame} castShadow />
        <mesh geometry={geo.holderCard} material={cards[N].mat} position={[0, CARD_H / 2 + 0.002, 0.0006]} scale={0.8} />
      </group>
      {/* score slots either side of the holder */}
      {[-1, 1].map((s) =>
        Array.from({ length: 6 }, (_, k) => (
          <mesh key={`${s}${k}`} material={mats.slot} position={[s * (0.04 + k * 0.012), trayTop + 0.0161, D / 2 - 0.02]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.0022, 12]} />
          </mesh>
        )),
      )}

      {/* the frames, each on its hinge at the top of its rail */}
      {Array.from({ length: N }, (_, i) => {
        const r = Math.floor(i / C)
        const c = i % C
        return (
          <group key={i} position={[colX(c), trayTop + RAIL_H + r * STEP, rowZ(r)]}>
            {/* the hinge knuckles on the rail */}
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={geo.knuckle} material={mats.tray} position={[s * (FRAME_W / 2 - 0.004), 0.001, 0]} castShadow />
            ))}
            <group
              ref={(g) => (frameRefs.current[i] = g)}
              userData={{ index: i }}
              onClick={(e) => {
                e.stopPropagation()
                if (e.delta > 4) return
                flip(i)
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                setHover(i)
              }}
              onPointerOut={() => setHover(-1)}
            >
              <mesh geometry={geo.frame} material={mats.frame} castShadow receiveShadow />
              <mesh geometry={geo.card} material={cards[i].mat} position={[0, 0.0065 + CARD_H / 2 - 0.0005, 0.0004]} />
              <mesh geometry={geo.back} material={mats.back} position={[0, 0.0065 + CARD_H / 2 - 0.0005, -0.0004]} />
              <mesh geometry={geo.knuckle} material={mats.frame} position={[0, 0.001, 0]} castShadow />
            </group>
          </group>
        )
      })}
    </group>
  )
}
