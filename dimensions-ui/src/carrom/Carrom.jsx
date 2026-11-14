import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildPeel, buildWood, mitredRail } from '../gameboard/textures.js'

// A tournament carrom board, without the coins: a 74 cm lacquered birch
// playing surface with the standard markings, four corner pockets with
// woven net bags hanging beneath (the board stands on them), in a deep,
// rounded walnut frame.
//
// Reused from the board models: the frame is swept with the game board's
// mitredRail(), and the walnut, the birch grain and the lacquer's orange
// peel come from its texture generators.

export const CARROM = {
  play: 0.74, // playing surface
  frameW: 0.072,
  frameH: 0.042, // frame top, above the board's underside
  top: 0.022, // the playing surface, above the board's underside
  pocketR: 0.0225, // 4.45 cm pockets
  lift: 0.046, // the board stands on its net pockets
}
export const OUTER = CARROM.play / 2 + CARROM.frameW
const { play, frameW, frameH, top, pocketR } = CARROM
const HALF = play / 2
// pocket centres, tucked into the corners against the frame
export const POCKET = HALF - pocketR - 0.0015

// the rail moulding: a big round over the outside, a flat top and a softer
// round down to the playing surface; [inset from the outside, height]
const PROFILE = (() => {
  const p = [[0, 0], [0, 0], [0, frameH - 0.018]]
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2)
    p.push([0.018 - Math.cos(a) * 0.018, frameH - 0.018 + Math.sin(a) * 0.018])
  }
  p.push([frameW - 0.012, frameH])
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    p.push([frameW - 0.012 + Math.sin(a) * 0.009, frameH - 0.009 + Math.cos(a) * 0.009])
  }
  p.push([frameW - 0.003, frameH - 0.012], [frameW, top + 0.004], [frameW, top], [frameW, top])
  return p
})()

// ---- the printed, lacquered playing surface (drawn in cm) ----
const INK = '#17130f'
const RED = '#c21d22'
function surfaceTexture(birch, wood) {
  const S = 4096
  const P = play * 100 // 74 cm
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.scale(S / P, S / P)
  g.fillStyle = birch
  g.fillRect(0, 0, P, P)
  // the grain: strips of the shared hardwood grain, laid along the board
  g.globalCompositeOperation = 'multiply'
  g.globalAlpha = 0.55
  const strip = 7.4
  for (let i = 0; i < P / strip; i++) {
    g.save()
    g.translate(i * strip, 0)
    g.rotate(Math.PI / 2)
    // the wood canvas spans 60 cm along the grain and 6 cm across it
    const off = (i * 37) % 60
    g.drawImage(wood, 0, 0, wood.width, wood.height, -off, -strip, 60, strip)
    g.drawImage(wood, 0, 0, wood.width, wood.height, 60 - off, -strip, 60, strip)
    g.drawImage(wood, 0, 0, wood.width, wood.height, 120 - off, -strip, 60, strip)
    g.restore()
  }
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'

  const lw = 0.3
  g.lineWidth = lw
  g.strokeStyle = INK
  g.lineCap = 'butt'
  const C = P / 2
  const circle = (x, y, r, fill) => {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    if (fill) {
      g.fillStyle = fill
      g.fill()
    }
    g.stroke()
  }
  const arrowHead = (x, y, ang, s = 0.9) => {
    g.save()
    g.translate(x, y)
    g.rotate(ang)
    g.fillStyle = INK
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(-s, -s * 0.42)
    g.lineTo(-s * 0.78, 0)
    g.lineTo(-s, s * 0.42)
    g.closePath()
    g.fill()
    g.restore()
  }
  // each side gets the same markings, turned about the centre
  for (let k = 0; k < 4; k++) {
    g.save()
    g.translate(C, C)
    g.rotate((k * Math.PI) / 2)
    g.translate(-C, -C)
    // the base lines: two lines 3.18 cm apart, 47 cm long, 10.15 cm in from
    // the frame, ending in red base circles
    const yo = P - 10.15
    const yi = yo - 3.18
    const r = 1.59
    const x0 = C - 23.5 + r
    const x1 = C + 23.5 - r
    g.beginPath()
    g.moveTo(x0, yo)
    g.lineTo(x1, yo)
    g.moveTo(x0, yi)
    g.lineTo(x1, yi)
    g.stroke()
    circle(x0, (yo + yi) / 2, r, RED)
    circle(x1, (yo + yi) / 2, r, RED)
    // the foul arrow: from the pocket corner towards the centre, 26.7 cm,
    // with a turning arc at its inner end
    const a = -Math.PI / 4
    const sx = 6.2
    const sy = P - 6.2
    const ex = sx + Math.cos(a) * 26.7
    const ey = sy + Math.sin(a) * 26.7
    g.beginPath()
    g.moveTo(sx + Math.cos(a) * 0.6, sy + Math.sin(a) * 0.6)
    g.lineTo(ex, ey)
    g.stroke()
    arrowHead(sx, sy, a + Math.PI, 1.3)
    const ar = 3.175
    const acx = ex - Math.cos(a) * ar * 0.2
    const acy = ey - Math.sin(a) * ar * 0.2
    const s0 = a + 0.45
    const s1 = a + 2 * Math.PI - 0.45
    g.beginPath()
    g.arc(acx, acy, ar, s0 + 0.9, s1 - 0.9)
    g.stroke()
    arrowHead(acx + Math.cos(s0 + 0.9) * ar, acy + Math.sin(s0 + 0.9) * ar, s0 + 0.9 - Math.PI / 2, 1.0)
    arrowHead(acx + Math.cos(s1 - 0.9) * ar, acy + Math.sin(s1 - 0.9) * ar, s1 - 0.9 + Math.PI / 2, 1.0)
    g.restore()
  }
  // the centre: two rings and the red centre spot
  circle(C, C, 8.5)
  circle(C, C, 8.0)
  g.lineWidth = lw * 0.7
  circle(C, C, 2.2)
  g.lineWidth = lw
  circle(C, C, 1.59, RED)
  // fine paper-like ink texture: speckle the print a touch
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  return t
}

// the playing surface with the four pockets cut out, mapped 0..1 across it
function boardShape() {
  const s = new THREE.Shape()
  s.moveTo(-HALF, -HALF)
  s.lineTo(HALF, -HALF)
  s.lineTo(HALF, HALF)
  s.lineTo(-HALF, HALF)
  s.closePath()
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const h = new THREE.Path()
    h.absarc(x * POCKET, z * POCKET, pocketR, 0, Math.PI * 2, true)
    s.holes.push(h)
  }
  return s
}

// The net bag: woven string in a diamond mesh, a cut-out texture.
function netTexture() {
  const S = 256
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.clearRect(0, 0, S, S)
  g.strokeStyle = '#d9d4c8'
  g.lineWidth = 7
  g.lineCap = 'round'
  const n = 4
  for (let i = -n; i <= 2 * n; i++) {
    g.beginPath()
    g.moveTo((i * S) / n, 0)
    g.lineTo((i * S) / n + S, S)
    g.moveTo((i * S) / n, S)
    g.lineTo((i * S) / n + S, 0)
    g.stroke()
  }
  // knots
  g.fillStyle = '#e6e1d6'
  for (let y = 0; y <= n; y++)
    for (let x = 0; x <= n; x++) {
      for (const [ox, oy] of [[0, 0], [0.5, 0.5]]) {
        g.beginPath()
        g.arc(((x + ox) * S) / n, ((y + oy) * S) / n, 7, 0, Math.PI * 2)
        g.fill()
      }
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 3)
  t.anisotropy = 8
  return t
}
// a rounded bag, from the pocket's rim down to the floor
function bagGeometry(depth) {
  const pts = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const r = pocketR * 1.05 + Math.sin(t * Math.PI * 0.85) * 0.012
    pts.push(new THREE.Vector2(Math.max(0.001, r * Math.cos(Math.pow(t, 3) * Math.PI * 0.5)), -t * depth))
  }
  return new THREE.LatheGeometry(pts, 40)
}

export default function Carrom({ frameWood = '#6b3820', surface = '#e4c999', netColor = '#dcd6c9' }) {
  const invalidate = useThree((s) => s.invalidate)
  const wood = useMemo(() => buildWood(), [])
  const peel = useMemo(() => {
    const t = buildPeel()
    t.repeat.set(12, 12)
    return t
  }, [])
  const print = useMemo(() => surfaceTexture(surface, wood.image), [surface, wood])
  const net = useMemo(() => netTexture(), [])
  const geo = useMemo(() => {
    const shape = boardShape()
    const face = new THREE.ShapeGeometry(shape, 48)
    face.rotateX(-Math.PI / 2)
    // map u along x and v so the drawing's top (canvas y = 0) is the back (-z)
    const p = face.attributes.position
    const uv = face.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + HALF) / play, (p.getZ(i) + HALF) / play * -1 + 1)
    face.translate(0, top, 0)
    // the board's core, its pocket holes bored through
    const core = new THREE.ExtrudeGeometry(shape, { depth: top - 0.0004, bevelEnabled: false, curveSegments: 48 })
    core.rotateX(Math.PI / 2)
    core.translate(0, top - 0.0004, 0)
    return { face, core, rails: [0, 1, 2, 3].map((i) => mitredRail(PROFILE, OUTER, i * 0.29)), bag: bagGeometry(CARROM.lift) }
  }, [])
  const mats = useMemo(
    () => ({
      surface: new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05, clearcoatNormalMap: peel, clearcoatNormalScale: new THREE.Vector2(0.15, 0.15) }),
      frame: new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.06, clearcoatNormalMap: peel, clearcoatNormalScale: new THREE.Vector2(0.08, 0.08) }),
      core: new THREE.MeshStandardMaterial({ color: '#b48c5c', roughness: 0.8 }),
      net: new THREE.MeshStandardMaterial({ map: net, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 }),
    }),
    [peel, wood, net],
  )
  useLayoutEffect(() => {
    mats.surface.map = print
    mats.surface.needsUpdate = true
    invalidate()
    return () => print.dispose()
  }, [mats, print, invalidate])
  useLayoutEffect(() => {
    mats.frame.color.set(frameWood)
    mats.net.color.set(netColor)
    invalidate()
  }, [mats, frameWood, netColor, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      geo.face.dispose()
      geo.core.dispose()
      geo.bag.dispose()
      geo.rails.forEach((g) => g.dispose())
      ;[wood, peel, net].forEach((t) => t.dispose())
    },
    [mats, geo, wood, peel, net],
  )

  return (
    <group position-y={CARROM.lift}>
      {geo.rails.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.frame} rotation-y={(i * Math.PI) / 2} castShadow receiveShadow />
      ))}
      <mesh geometry={geo.core} material={mats.core} castShadow receiveShadow />
      <mesh geometry={geo.face} material={mats.surface} receiveShadow />
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={geo.bag} material={mats.net} position={[x * POCKET, 0.0005, z * POCKET]} castShadow />
      ))}
    </group>
  )
}
