import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshReflectorMaterial, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createPinAudio } from './audio.js'
import { collidePair, laneSurface } from './physics.js'
import { BALL_R, PIN_COM, PIN_H, RACK, ballBody, pinBody, profile } from './shape.js'

// A tenpin, made to the USBC specification and finished like a new one: a
// hard-maple core under a thick, glossy Surlyn coat, two red neck stripes,
// the maker's mark, and (as it gets used) scuffs and black ball marks round
// the belly where the ball strikes.
//
// It is a real rigid body (see physics.js and shape.js). Tap it and it
// wobbles on its base ring and rights itself; press longer and it goes
// over, rolling round on its belly and head. Pick it up and drop or throw
// it. Rack all ten and bowl: the ball (15 lb, 8.5 in) carries into the
// pocket, and the pins scatter off the ball, each other, the kickbacks and
// the pit curtain.
// SI units: metres. The headpin stands at the origin; the lane runs to +z.

const LANE_W = 1.0541
const PIT_Z = -1.05
const GUTTER_R = 0.118
const PIT_DEPTH = 0.25
const SUB = 1 / 1500

const PIN_FINISHES = {
  classic: { coat: '#f6f4ef', stripe: '#c8102e' },
  black: { coat: '#1e1e21', stripe: '#d9b45a' },
  gold: { coat: '#f4efe4', stripe: '#b8871e' },
  blue: { coat: '#f5f5f2', stripe: '#1f4fb5' },
}
export const PIN_FINISH_NAMES = Object.keys(PIN_FINISHES)
const BALL_STYLES = {
  sapphire: ['#061040', '#0d2384', '#2a4cc4', '#8fa8f2'],
  cosmic: ['#0e1a4a', '#3b1d73', '#6a5ad8', '#c9c2ff'],
  ruby: ['#3a0610', '#8a1024', '#d23a46', '#ffc2b8'],
  pearl: ['#0b0b0e', '#2a2a31', '#6a6a78', '#e6e6ee'],
  emerald: ['#04261c', '#0d5a3e', '#2fa77a', '#d4ffe9'],
}
export const BALL_STYLE_NAMES = Object.keys(BALL_STYLES)

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The pin's coat: u runs round the pin (0 facing +z), v up its height. The
// stripes and mark are printed; the scuffs and ball marks come with use.
// Returns the colour map and a roughness map (worn spots go matt).
function pinMaps(finish, wear) {
  const W = 1024
  const H = 2048
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const q = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  const gr = q.getContext('2d')
  const r = rng(31)
  const vy = (y) => H - (y / PIN_H) * H // height (m) to canvas row
  g.fillStyle = finish.coat
  g.fillRect(0, 0, W, H)
  gr.fillStyle = 'rgb(70,70,70)'
  gr.fillRect(0, 0, W, H)
  // the coat is not perfectly even: faint flow in the plastic
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.008 + r() * 0.012})`
    g.fillRect(r() * W, r() * H, 20 + r() * 80, 2 + r() * 6)
  }
  // the two neck stripes, with a hair of softness at their edges
  for (const [y0, y1] of [
    [0.2555, 0.2675],
    [0.2795, 0.2915],
  ]) {
    g.fillStyle = finish.stripe
    g.fillRect(0, vy(y1), W, vy(y0) - vy(y1))
    g.fillStyle = 'rgba(0,0,0,0.08)'
    g.fillRect(0, vy(y1), W, 1.5)
    g.fillRect(0, vy(y0) - 1.5, W, 1.5)
  }
  // the maker's mark on the front of the neck, below the stripes
  const mark = (x) => {
    g.save()
    g.translate(x, vy(0.222))
    g.fillStyle = finish.stripe
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '800 34px Inter, Arial, sans-serif'
    g.fillText('DIMENSIONS', 0, 0)
    g.font = '600 18px Inter, Arial, sans-serif'
    g.fillText('★  USBC APPROVED  ★', 0, 34)
    g.restore()
  }
  mark(0)
  mark(W)
  // the base: a nylon base ring
  g.fillStyle = '#2a2a2c'
  g.fillRect(0, vy(0.0055), W, H)
  gr.fillStyle = 'rgb(160,160,160)'
  gr.fillRect(0, vy(0.0055), W, H)
  // wear: scuffs everywhere, ball marks round the belly, chips at the base
  if (wear > 0) {
    for (let i = 0; i < 900 * wear; i++) {
      const x = r() * W
      const y = vy(0.02 + r() * 0.34)
      const a = (r() - 0.5) * 0.7
      const l = 6 + r() * 40
      g.strokeStyle = `rgba(110,105,98,${0.05 + r() * 0.12})`
      g.lineWidth = 0.6 + r() * 1.4
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
      g.stroke()
      gr.strokeStyle = 'rgba(255,255,255,0.5)'
      gr.lineWidth = 2
      gr.beginPath()
      gr.moveTo(x, y)
      gr.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
      gr.stroke()
    }
    // black marks where the ball has hit: smudged ovals, mostly 80–160 mm up
    for (let i = 0; i < 26 * wear; i++) {
      const x = r() * W
      const y = vy(0.075 + r() * 0.09)
      const grd = g.createRadialGradient(x, y, 0, x, y, 30 + r() * 50)
      grd.addColorStop(0, `rgba(30,28,30,${0.25 + 0.35 * wear})`)
      grd.addColorStop(1, 'rgba(30,28,30,0)')
      g.fillStyle = grd
      g.save()
      g.translate(x, y)
      g.scale(1.8, 0.7)
      g.translate(-x, -y)
      g.fillRect(x - 100, y - 100, 200, 200)
      g.restore()
    }
    for (let i = 0; i < 30 * wear; i++) {
      const x = r() * W
      const y = vy(0.006 + r() * 0.02)
      g.fillStyle = 'rgba(120,110,95,0.5)'
      g.beginPath()
      g.ellipse(x, y, 3 + r() * 9, 2 + r() * 5, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const rough = new THREE.CanvasTexture(q)
  return { map, rough }
}

// The grip, drilled into the ball: two finger holes side by side and the
// thumb hole below them. dir is the hole's axis from the ball's centre, a its
// bore radius, depth how far it goes in, lip the radius of the rounded,
// slightly raised edge round its mouth. The surface is cut away inside each
// mouth in the shader (see holeCut), so the holes are real openings.
const HOLES = [
  { dir: [-0.19, 0.5, 0.845], a: 0.0115, depth: 0.062, lip: 0.0026 },
  { dir: [0.19, 0.5, 0.845], a: 0.0115, depth: 0.062, lip: 0.0026 },
  { dir: [0, -0.56, 0.83], a: 0.0145, depth: 0.07, lip: 0.003 },
].map((h) => {
  const dir = new THREE.Vector3(...h.dir).normalize()
  // where the bore meets the sphere, measured along the axis
  const mouth = Math.sqrt(BALL_R * BALL_R - h.a * h.a)
  return { ...h, dir, mouth, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir) }
})

// Discard the ball's skin inside each hole's mouth, worked out per pixel from
// the position on the sphere, so the openings stay perfectly round.
function holeCut(mat) {
  const uHoles = { value: HOLES.map((h) => new THREE.Vector4(h.dir.x, h.dir.y, h.dir.z, h.mouth / BALL_R)) }
  mat.onBeforeCompile = (s) => {
    s.uniforms.uHoles = uHoles
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBallLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBallLocal = position;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vBallLocal;\nuniform vec4 uHoles[${HOLES.length}];`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nvec3 bl = normalize(vBallLocal);\nfor (int i = 0; i < ${HOLES.length}; i++) if (dot(bl, uHoles[i].xyz) > uHoles[i].w) discard;`)
  }
  mat.customProgramCacheKey = () => 'ball-holes'
  return mat
}

// A reactive-resin ball: a swirled pearl coverstock with a fine glitter of
// metallic flake in it. (The holes are geometry, not paint.)
function ballMaps(cols) {
  const W = 1024
  const H = 512
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  const img = g.createImageData(W, H)
  const C = cols.map((h) => new THREE.Color(h))
  const n = (x, y) => Math.sin(x * 1.7 + Math.sin(y * 2.3)) * 0.5 + Math.sin(y * 1.3 + Math.sin(x * 2.9) * 1.4) * 0.5
  const tmp = new THREE.Color()
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x / W) * Math.PI * 2
      const v = (y / H) * Math.PI
      // domain-warped swirls, seamless round the ball
      let a = n(Math.cos(u) * 3 + v * 2, Math.sin(u) * 3 + v * 1.4)
      a = n(Math.cos(u) * 3 + a * 1.8 + v, Math.sin(u) * 3 - a * 1.6 + v * 2.2)
      const t = a * 0.5 + 0.5
      if (t < 0.45) tmp.copy(C[0]).lerp(C[1], t / 0.45)
      else if (t < 0.8) tmp.copy(C[1]).lerp(C[2], (t - 0.45) / 0.35)
      else tmp.copy(C[2]).lerp(C[3], (t - 0.8) / 0.2)
      const i = (y * W + x) * 4
      img.data[i] = tmp.r * 255
      img.data[i + 1] = tmp.g * 255
      img.data[i + 2] = tmp.b * 255
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  // flake: tiny bright specks scattered through the resin
  const r = rng(5)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '210,225,255' : '255,255,255'},${0.25 + r() * 0.5})`
    g.fillRect(r() * W, r() * H, 1, 1)
  }
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  return map
}

// The lane: 39 maple boards running its length, each a slightly different
// shade, with fine grain and the seams between them.
function laneTexture() {
  const W = 1024
  const H = 2048
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  const r = rng(13)
  const bw = W / 39
  for (let b = 0; b < 39; b++) {
    const l = 0.92 + r() * 0.1
    g.fillStyle = `rgb(${Math.round(222 * l)},${Math.round(184 * l)},${Math.round(128 * l)})`
    g.fillRect(b * bw, 0, bw, H)
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = `rgba(150,100,50,${0.05 + r() * 0.1})`
      g.lineWidth = 0.5 + r()
      const x0 = b * bw + r() * bw
      g.beginPath()
      for (let y = 0; y <= H; y += 32) {
        const x = x0 + Math.sin(y / (120 + r() * 80) + k) * 1.5
        y ? g.lineTo(x, y) : g.moveTo(x, y)
      }
      g.stroke()
    }
    g.fillStyle = 'rgba(80,50,20,0.35)'
    g.fillRect(b * bw, 0, 1, H)
  }
  // board ends, staggered
  for (let b = 0; b < 39; b++) {
    g.fillStyle = 'rgba(80,50,20,0.25)'
    g.fillRect(b * bw, (r() * H) | 0, bw, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 3)
  t.anisotropy = 8
  return t
}

const tilt = (q) => Math.acos(THREE.MathUtils.clamp(new THREE.Vector3(0, 1, 0).applyQuaternion(q).y, -1, 1))

// pins: 1 | 10. finish: classic | black | gold | blue. wear: 0 new … 1 well
// used. ball: the ball's swirl. speed: how hard it is bowled, m/s.
// reflections: the oiled lane mirrors the pins. sound.
// bowl, reset: bump these numbers to do it.
export default function BowlingPin({ pins: pinCount = 1, finish = 'classic', wear = 0.25, ball: ballStyle = 'sapphire', speed = 8, reflections = true, sound = false, bowl = 0, reset = 0 }) {
  const n = Number(pinCount) === 10 ? 10 : 1
  const [hover, setHover] = useState(false)
  const [held, setHeld] = useState(false)
  useCursor(hover || held, held ? 'grabbing' : 'pointer')
  const { camera, gl, controls } = useThree()

  // ---- geometry, textures, materials ----
  const geo = useMemo(() => {
    const g = new THREE.LatheGeometry(profile(300), 96)
    // v = height, so the coat's stripes land where they should
    const p = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < p.count; i++) uv.setY(i, p.getY(i) / PIN_H)
    g.computeVertexNormals()
    // each hole: an open bore, its floor, and the rounded lip round its mouth
    const holes = HOLES.map((h) => ({
      bore: new THREE.CylinderGeometry(h.a, h.a, h.depth, 40, 1, true),
      floor: new THREE.CircleGeometry(h.a, 40).rotateX(-Math.PI / 2),
      lip: new THREE.TorusGeometry(h.a + h.lip, h.lip, 16, 64).rotateX(Math.PI / 2),
    }))
    return { pin: g, ball: new THREE.SphereGeometry(BALL_R, 128, 96), holes }
  }, [])
  useEffect(
    () => () => {
      geo.pin.dispose()
      geo.ball.dispose()
      geo.holes.forEach((h) => Object.values(h).forEach((x) => x.dispose()))
    },
    [geo],
  )
  const F = PIN_FINISHES[finish] || PIN_FINISHES.classic
  const maps = useMemo(() => pinMaps(F, wear), [F, wear])
  useEffect(() => () => (maps.map.dispose(), maps.rough.dispose()), [maps])
  const ballCols = BALL_STYLES[ballStyle] || BALL_STYLES.sapphire
  const ballMap = useMemo(() => ballMaps(ballCols), [ballCols])
  useEffect(() => () => ballMap.dispose(), [ballMap])
  const lane = useMemo(() => laneTexture(), [])
  useEffect(() => () => lane.dispose(), [lane])
  const mats = useMemo(
    () => ({
      // Surlyn over maple: a deep, wet gloss
      pin: new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.2, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffffff') }),
      ball: holeCut(new THREE.MeshPhysicalMaterial({ roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.15, iridescenceIOR: 1.4 })),
      // the polished lip of each hole: the same resin, its colour averaged
      lip: new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }),
      // inside the holes: a dull, shadowed bore
      bore: new THREE.MeshStandardMaterial({ color: '#0a0c14', roughness: 0.7, side: THREE.BackSide }),
      boreFloor: new THREE.MeshStandardMaterial({ color: '#030308', roughness: 0.9 }),
      kick: new THREE.MeshStandardMaterial({ color: '#1b1714', roughness: 0.6 }),
      pit: new THREE.MeshStandardMaterial({ color: '#070707', roughness: 1 }),
      gutter: new THREE.MeshStandardMaterial({ color: '#2a2b2e', metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide }),
      floor: new THREE.MeshStandardMaterial({ color: '#d9d6cf', roughness: 0.9 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.pin.map = maps.map
    mats.pin.roughnessMap = maps.rough
    mats.pin.needsUpdate = true
  }, [mats, maps])
  useEffect(() => {
    mats.ball.map = ballMap
    mats.ball.needsUpdate = true
    mats.lip.color.set(ballCols[1]).lerp(new THREE.Color(ballCols[2]), 0.35)
  }, [mats, ballMap, ballCols])

  // ---- sound ----
  const audio = useRef(null)
  const live = useRef({})
  live.current = { n, speed, sound }
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const lastSound = useRef({})
  const play = (name, s) => {
    if (!live.current.sound) return
    const now = performance.now()
    if (now - (lastSound.current[name] || 0) < 25) return
    lastSound.current[name] = now
    if (!audio.current) audio.current = createPinAudio()
    audio.current?.[name](s)
  }

  // ---- the world ----
  const planes = useMemo(
    () => [
      // a full lane: solid half-round gutters either side, capping beyond,
      // and the pit, a drop behind the deck. One pin stands on a plain floor.
      n === 10 ? laneSurface({ halfWidth: LANE_W / 2, R: GUTTER_R, zFrom: PIT_Z, zTo: 4.05, pitDepth: PIT_DEPTH }) : { n: new THREE.Vector3(0, 1, 0), d: 0, floor: true },
      { n: new THREE.Vector3(1, 0, 0), d: -0.86, e: 0.35, mu: 0.3 }, // kickbacks
      { n: new THREE.Vector3(-1, 0, 0), d: -0.86, e: 0.35, mu: 0.3 },
      { n: new THREE.Vector3(0, 0, 1), d: -1.5, e: 0.08, mu: 0.6 }, // the pit curtain
    ],
    [n],
  )
  const world = useMemo(() => {
    const pins = Array.from({ length: 10 }, () => pinBody())
    return { pins, ball: ballBody(), bowled: false }
  }, [])
  const setPins = () => {
    const r = rng(7)
    world.pins.forEach((p, i) => {
      const [x, z] = n === 1 ? [0, 0] : RACK[i]
      p.pos.set(x, PIN_COM, z)
      p.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2) // each one turned differently
      p.vel.set(0, 0, 0)
      p.ang.set(0, 0, 0)
      p.active = false
      p.update()
    })
    const b = world.ball
    b.active = false
    b.pos.set(0, -1, 5)
    b.update()
    world.bowled = false
  }
  useEffect(() => setPins(), [n]) // eslint-disable-line react-hooks/exhaustive-deps

  // a ball down the lane, aimed for the pocket (between the 1 and 3 pins),
  // with a little hook on it
  const doBowl = () => {
    const b = world.ball
    const v = live.current.speed
    const aimX = live.current.n === 10 ? 0.07 : 0.0
    b.pos.set(aimX + 0.16, BALL_R, 3.2)
    b.vel.set(-0.05, 0, -v)
    b.ang.set(-(v / BALL_R) * 0.55, 0, -9) // still skidding, with side-roll for the hook
    b.quat.identity()
    b.update()
    b.wake()
    world.bowled = true
  }
  const first = useRef(true)
  useEffect(() => {
    if (!first.current) doBowl()
  }, [bowl]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!first.current) setPins()
  }, [reset]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    first.current = false
  }, [])

  // ---- touching the pins ----
  // a tap wobbles a pin; the longer you press before letting go, the harder
  // the push, until it goes over. Dragging picks it up.
  const press = useRef(null)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const onDown = (i) => (e) => {
    e.stopPropagation()
    const p = world.pins[i]
    const local = e.point.clone().sub(p.pos).applyQuaternion(p.quat.clone().invert())
    const nrm = camera.getWorldDirection(new THREE.Vector3()).negate()
    nrm.y = 0
    nrm.normalize()
    press.current = { i, t: performance.now(), sx: e.clientX, sy: e.clientY, local, point: e.point.clone(), dir: e.ray.direction.clone(), plane: new THREE.Plane().setFromNormalAndCoplanarPoint(nrm, e.point), moved: false, target: e.point.clone() }
    if (controls) controls.enabled = false
  }
  useEffect(() => {
    const move = (e) => {
      const pr = press.current
      if (!pr) return
      if (!pr.moved && Math.hypot(e.clientX - pr.sx, e.clientY - pr.sy) > 5) {
        pr.moved = true
        world.pins[pr.i].wake()
        setHeld(true)
      }
      if (!pr.moved) return
      const rect = gl.domElement.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera)
      if (ray.ray.intersectPlane(pr.plane, pr.target)) pr.target.y = Math.max(0.03, Math.min(0.9, pr.target.y))
    }
    const up = () => {
      const pr = press.current
      if (!pr) return
      press.current = null
      if (controls) controls.enabled = true
      setHeld(false)
      if (pr.moved) return
      // a push along the line of sight, at the point touched
      const held = (performance.now() - pr.t) / 1000
      const J = Math.min(1.4, 0.12 + held * 1.6)
      const p = world.pins[pr.i]
      const dir = pr.dir.clone()
      dir.y = 0
      dir.normalize()
      p.wake()
      p.applyImpulse(dir.multiplyScalar(J), pr.point)
      play('clack', J)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  })

  // ---- simulation ----
  const v1 = useMemo(() => new THREE.Vector3(), [])
  const v2 = useMemo(() => new THREE.Vector3(), [])
  const step = (h) => {
    const w = world
    const count = live.current.n
    const pr = press.current
    // a pin in the hand hangs from the point it was taken by
    if (pr && pr.moved) {
      const p = w.pins[pr.i]
      const gp = v1.copy(pr.local).applyQuaternion(p.quat).add(p.pos)
      const gv = p.pointVel(gp, v2)
      const K = 900
      const C = 2 * Math.sqrt(K * p.m) * 0.9
      const F = pr.target.clone().sub(gp).multiplyScalar(K).addScaledVector(gv, -C)
      p.applyImpulse(F.multiplyScalar(h), gp)
      p.ang.multiplyScalar(Math.exp(-3 * h))
      p.still = 0
    }
    for (let i = 0; i < count; i++) {
      const p = w.pins[i]
      p.step(h, planes, (_, s) => play('knock', s / 3))
      // a pin rocking upright on its base ring loses its wobble to the deck
      if (p.active && p.grounded && tilt(p.quat) < 0.05) {
        p.ang.x *= Math.exp(-7 * h)
        p.ang.z *= Math.exp(-7 * h)
      }
    }
    const b = w.ball
    if (b.active) {
      b.step(h, planes)
      for (let i = 0; i < count; i++) {
        const s = collidePair(b, w.pins[i], 0.62, 0.15)
        if (s > 0.3) play('thock', s / 7)
      }
      // gone once it has dropped into the pit
      if ((b.pos.z < -1.3 && b.pos.y < -0.1) || b.pos.y < -0.5) {
        b.active = false
        b.pos.set(0, -1, 5)
        b.update()
      }
    }
    for (let i = 0; i < count; i++)
      for (let j = i + 1; j < count; j++) {
        const s = collidePair(w.pins[i], w.pins[j], 0.45, 0.2)
        if (s > 0.3) play('clack', s / 4)
      }
  }

  const pinRefs = useRef([])
  const ballRef = useRef()
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!(dt > 0)) return
    const k = Math.max(1, Math.ceil(dt / SUB))
    for (let i = 0; i < k; i++) step(dt / k)
    world.pins.forEach((p, i) => {
      const g = pinRefs.current[i]
      if (!g) return
      g.position.copy(p.pos)
      g.quaternion.copy(p.quat)
    })
    const b = world.ball
    ballRef.current.visible = b.pos.y > -0.5
    ballRef.current.position.copy(b.pos)
    ballRef.current.quaternion.copy(b.quat)
    if (audio.current) audio.current.roll(b.active && b.grounded ? b.vel.length() : 0)
  })

  return (
    <group>
      {/* the lane and pin deck: oiled maple */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 1.5]} receiveShadow>
        <planeGeometry args={[LANE_W, 5.1]} />
        {reflections ? (
          <MeshReflectorMaterial map={lane} blur={[260, 80]} resolution={512} mixBlur={0.9} mixStrength={0.9} mirror={0.6} roughness={0.25} depthScale={0.8} minDepthThreshold={0.4} maxDepthThreshold={1.2} color="#ffffff" metalness={0.05} />
        ) : (
          <meshStandardMaterial map={lane} roughness={0.3} />
        )}
      </mesh>
      {/* the rest of the house only around a full rack; one pin is a product shot */}
      {n === 10 && (
        <group>
      {/* gutters: half-round channels either side of the lane */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (LANE_W / 2 + GUTTER_R), 0, 1.5]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <cylinderGeometry args={[GUTTER_R, GUTTER_R, 5.1, 24, 1, true, -Math.PI / 2, Math.PI]} />
          <primitive object={mats.gutter} attach="material" />
        </mesh>
      ))}
      {/* capping: flat tops between the gutters and the kickbacks */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (LANE_W / 2 + 2 * GUTTER_R + (0.86 - LANE_W / 2 - 2 * GUTTER_R) / 2), -(PIT_DEPTH + 0.01) / 2, 1.5]} material={mats.kick} receiveShadow>
          <boxGeometry args={[0.86 - LANE_W / 2 - 2 * GUTTER_R, PIT_DEPTH + 0.01, 5.1]} />
        </mesh>
      ))}
      {/* kickbacks and the pit */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.88, 0.32, -0.3]} material={mats.kick} castShadow receiveShadow>
          <boxGeometry args={[0.04, 0.64, 2.4]} />
        </mesh>
      ))}
      {/* the pit: a drop behind the deck, the deck's end face, the curtain */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -PIT_DEPTH, (PIT_Z - 1.55) / 2]} material={mats.pit} receiveShadow>
        <planeGeometry args={[1.8, 1.55 + PIT_Z]} />
      </mesh>
      <mesh position={[0, -PIT_DEPTH / 2, PIT_Z]} rotation-y={Math.PI} material={mats.kick}>
        <planeGeometry args={[1.72, PIT_DEPTH]} />
      </mesh>
      <mesh position={[0, 0.5 - PIT_DEPTH / 2, -1.52]} material={mats.pit}>
        <planeGeometry args={[1.8, 1.0 + PIT_DEPTH]} />
      </mesh>
        </group>
      )}
      <mesh rotation-x={-Math.PI / 2} position={[0, n === 10 ? -PIT_DEPTH - 0.01 : -0.002, 2]} material={mats.floor} receiveShadow>
        <planeGeometry args={[30, 30]} />
      </mesh>

      {/* the pins */}
      {world.pins.map((p, i) => (
        <group
          key={i}
          ref={(g) => (pinRefs.current[i] = g)}
          visible={i < n}
          onPointerDown={i < n ? onDown(i) : undefined}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
          }}
          onPointerOut={() => setHover(false)}
        >
          <mesh geometry={geo.pin} material={mats.pin} position={[0, -PIN_COM, 0]} castShadow receiveShadow />
        </group>
      ))}
      {/* the ball */}
      <group ref={ballRef}>
        <mesh geometry={geo.ball} material={mats.ball} castShadow />
        {HOLES.map((h, i) => (
          <group key={i} quaternion={h.q}>
            <mesh geometry={geo.holes[i].bore} material={mats.bore} position-y={h.mouth - h.depth / 2} />
            <mesh geometry={geo.holes[i].floor} material={mats.boreFloor} position-y={h.mouth - h.depth} />
            <mesh geometry={geo.holes[i].lip} material={mats.lip} position-y={Math.sqrt(BALL_R * BALL_R - (h.a + h.lip) ** 2) - h.lip * 0.35} />
          </group>
        ))}
      </group>
    </group>
  )
}
