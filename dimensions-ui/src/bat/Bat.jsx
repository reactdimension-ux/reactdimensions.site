import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createBatAudio } from './audio.js'
import { BALL, Body, ballBody, collide } from './physics.js'

// A cricket bat: an English willow blade with a flat, slightly cambered
// face, a spine built up behind the middle, thick rolled edges, a rounded
// toe and sloping shoulders, a cane handle spliced in with a V, twine
// binding, and a textured rubber grip. It is a solid rigid body: pick it up
// and it hangs from your hand, swing it, let go and it flies, lands on an
// edge, rocks over its curved back and settles. Knock it over, or stand it
// back up. Swing it through the ball and the ball comes off the face.
// SI units: metres. Bat frame: toe at the origin, up the handle along +y,
// the face looking along -z.

// a short-handle senior bat (Laws of Cricket: at most 965 mm long, 108 mm
// wide, 67 mm deep, edges at most 40 mm)
const BLADE_L = 0.56
const BLADE_HW = 0.054
const FACE_Z = -0.022
const BAT_L = 0.955
const HANDLE_R = 0.0158
const GRIP_R = 0.0186
const MASS = 1.18
// the balance point, about a third of the way up from the toe on a modern bat
const COM = new THREE.Vector3(0, 0.33, -0.004)
const SUB = 1 / 1500

const sm = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// The blade's cross-section at height y up from the toe: its half width, the
// depth of its edges, the depth at the spine, and where the face is.
function section(y) {
  const sh = sm(BLADE_L - 0.065, BLADE_L, y) // the shoulders slope into the handle
  const rc = 0.014 // toe corners are rounded off
  const toeIn = y < rc ? rc - Math.sqrt(rc * rc - (rc - y) ** 2) : 0
  const mid = Math.exp(-(((y - 0.19) / 0.21) ** 2)) // the middle: where the wood is
  const hw = BLADE_HW * (1 - 0.69 * sh) - toeIn * 0.9
  const ts = (0.044 + 0.022 * mid) * (1 - 0.52 * sh) - toeIn * 0.7
  const te = (0.035 + 0.003 * mid) * (1 - 0.6 * sh) - toeIn * 0.7
  const z0 = FACE_Z + 0.0035 * Math.sin((Math.PI * Math.min(y, BLADE_L)) / BLADE_L) * (1 - sh)
  return { hw, ts, te, z0, sh }
}
// where the handle sits: centred on the blade's depth at the shoulder
const HANDLE_Z = (() => {
  const s = section(BLADE_L)
  return s.z0 + s.ts * 0.5
})()

// The blade as one closed, solid surface: rows of cross-sections up its
// length, each a back (edges rolled round into the spine) and a face (flat,
// with a hair of camber across), stitched into quads, and capped flat at the
// toe and the top of the shoulders.
function bladeGeometry() {
  const N = 110
  const M = 44
  const F = 16
  const pos = []
  const uv = []
  const idx = []
  const rows = []
  // Up through the shoulders the flat, edged section rounds off into the
  // handle's circle, so the blade meets the handle (and the twine over the
  // joint) as one smooth neck instead of a thin slab with fins for edges.
  const R = HANDLE_R * 1.03 + 0.0004
  const round = (x, z, phi, b) => [x + (R * Math.cos(phi) - x) * b, z + (HANDLE_Z + R * Math.sin(phi) - z) * b]
  for (let i = 0; i <= N; i++) {
    const y = (i / N) * BLADE_L
    const { hw, ts, te, z0 } = section(y)
    const b = sm(BLADE_L - 0.07, BLADE_L, y) ** 1.6
    const ring = []
    for (let k = 0; k <= M; k++) {
      const s = -1 + (2 * k) / M
      const roll = Math.sqrt(Math.max(0, 1 - Math.abs(s) ** 9))
      const zb = z0 + (te + (ts - te) * (1 - s * s) ** 0.8) * roll
      const [x, z] = round(s * hw, zb, (Math.PI * (1 - s)) / 2, b)
      ring.push([x, y, z, 0.5 + s * 0.25])
    }
    for (let k = 1; k < F; k++) {
      const s = 1 - (2 * k) / F
      const [x, z] = round(s * hw, z0 - 0.0016 * (1 - s * s), (-Math.PI * (1 - s)) / 2, b)
      ring.push([x, y, z, 0.5 + s * 0.25 + 0.5])
    }
    rows.push(ring)
  }
  const P = rows[0].length
  for (const ring of rows) {
    for (const [x, y, z, u] of ring) {
      pos.push(x, y, z)
      uv.push(u, y / BLADE_L)
    }
  }
  for (let i = 0; i < N; i++)
    for (let k = 0; k < P; k++) {
      const a = i * P + k
      const b = i * P + ((k + 1) % P)
      const c = (i + 1) * P + k
      const d = (i + 1) * P + ((k + 1) % P)
      idx.push(a, b, c, b, d, c) // wound so the outside faces out
    }
  // caps, on their own vertices so the toe and shoulders keep a crisp edge
  for (const [i, up] of [
    [0, false],
    [N, true],
  ]) {
    const ring = rows[i]
    const base = pos.length / 3
    const cz = ring.reduce((t, p) => t + p[2], 0) / P
    pos.push(0, ring[0][1], cz)
    uv.push(0.5, up ? 1 : 0)
    for (const [x, y, z] of ring) {
      pos.push(x, y, z)
      uv.push(0.5 + x * 4, (z - FACE_Z) * 4)
    }
    for (let k = 0; k < P; k++) {
      const a = base + 1 + k
      const b = base + 1 + ((k + 1) % P)
      up ? idx.push(base, a, b) : idx.push(base, b, a)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

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

// English willow: pale, close straight grain running the length of the blade
// (the lines vary across u, run along v), a soft darker streak of heartwood
// here and there, and tiny elongated pores.
function willowTexture(color, grains) {
  const S = 1024
  const r = rng(17)
  const base = new THREE.Color(color)
  const dark = base.clone().multiplyScalar(0.72)
  const heart = base.clone().lerp(new THREE.Color('#9c7240'), 0.45)
  const col = new Float32Array(S)
  const bump = new Float32Array(S)
  // grain lines across the width
  let x = 0
  while (x < S) {
    const w = 1 + r() * 2.2
    const strength = 0.35 + r() * 0.5
    for (let k = -3; k <= 3; k++) {
      const xi = Math.floor(x + k)
      if (xi < 0 || xi >= S) continue
      const f = Math.exp(-(k * k) / (w * w))
      col[xi] = Math.max(col[xi], f * strength)
      bump[xi] = Math.max(bump[xi], f)
    }
    x += S / grains * (0.6 + r() * 0.8)
  }
  // broad streaks
  const streak = new Float32Array(S)
  for (let i = 0; i < 5; i++) {
    const cx = r() * S
    const w = 20 + r() * 60
    const a = r() * 0.5
    for (let k = 0; k < S; k++) streak[k] += a * Math.exp(-(((k - cx) / w) ** 2))
  }
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const b = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const ci = c.getContext('2d').createImageData(S, S)
  const bi = b.getContext('2d').createImageData(S, S)
  const tmp = new THREE.Color()
  for (let y = 0; y < S; y++) {
    const wob = Math.sin(y / 140) * 2.5 + Math.sin(y / 37) * 0.6
    for (let xx = 0; xx < S; xx++) {
      const sx = Math.min(S - 1, Math.max(0, Math.round(xx + wob)))
      tmp.copy(base).lerp(heart, Math.min(1, streak[sx])).lerp(dark, col[sx] * 0.55)
      const i = (y * S + xx) * 4
      ci.data[i] = tmp.r * 255
      ci.data[i + 1] = tmp.g * 255
      ci.data[i + 2] = tmp.b * 255
      ci.data[i + 3] = 255
      const v = 170 - bump[sx] * 60
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = v
      bi.data[i + 3] = 255
    }
  }
  // pores: short dashes along the grain
  const cg = c.getContext('2d')
  cg.putImageData(ci, 0, 0)
  b.getContext('2d').putImageData(bi, 0, 0)
  cg.fillStyle = dark.clone().multiplyScalar(0.85).getStyle()
  for (let i = 0; i < 3500; i++) {
    cg.globalAlpha = 0.15 + r() * 0.25
    cg.fillRect(r() * S, r() * S, 1, 3 + r() * 7)
  }
  const mk = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    return t
  }
  return { map: mk(c, true), bump: mk(b) }
}

// A rubber grip: a field of raised diamonds, wound on as a spiral so the
// wraps show as a faint helical seam.
function gripTexture() {
  const S = 256
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.fillStyle = '#9a9a9a'
  g.fillRect(0, 0, S, S)
  const n = 16
  const s = S / n
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = i * s + (j % 2 ? s / 2 : 0)
      const y = j * s
      g.fillStyle = '#ececec'
      g.beginPath()
      g.moveTo(x, y + s * 0.12)
      g.lineTo(x + s * 0.38, y + s / 2)
      g.lineTo(x, y + s * 0.88)
      g.lineTo(x - s * 0.38, y + s / 2)
      g.closePath()
      g.fill()
    }
  g.strokeStyle = '#6d6d6d'
  g.lineWidth = 3
  for (const o of [-S, 0, S]) {
    g.beginPath()
    g.moveTo(o, S)
    g.lineTo(o + S, 0)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 7)
  t.anisotropy = 8
  return t
}

// Twine: fine cord wound tight round the top of the blade, as bump lines.
function twineTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 64, height: 128 })
  const g = c.getContext('2d')
  for (let y = 0; y < 128; y++) {
    const v = 120 + 110 * Math.abs(Math.sin((y / 128) * Math.PI * 24))
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(0, y, 64, 1)
  }
  return new THREE.CanvasTexture(c)
}

// the V of the splice where the handle is let into the blade
function spliceTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 64, height: 256 })
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.beginPath()
  g.moveTo(10, 0)
  g.lineTo(54, 0)
  g.lineTo(32, 256)
  g.closePath()
  g.fill()
  return new THREE.CanvasTexture(c)
}

// The bat's collision shape: spheres down the face, the edges and the spine,
// and along the handle, in the bat frame relative to its centre of mass.
function batSpheres() {
  const out = []
  for (let i = 0; i <= 14; i++) {
    const y = 0.008 + (i / 14) * (BLADE_L - 0.03)
    const { hw, ts, te, z0 } = section(y)
    const r = Math.min(0.009, hw * 0.3)
    for (const x of [-(hw - r), 0, hw - r]) out.push([x, y, z0 + r, r]) // the face
    for (const x of [-(hw - r), hw - r]) out.push([x, y, z0 + te - r, r]) // the edges
    out.push([0, y, z0 + ts - 0.012, 0.012]) // the spine
  }
  for (let y = BLADE_L + 0.03; y <= BAT_L - 0.01; y += 0.05) out.push([0, y, HANDLE_Z, GRIP_R])
  return out.map(([x, y, z, r]) => [x - COM.x, y - COM.y, z - COM.z, r])
}
function batBody() {
  // a bat is long and its mass is low down in the blade: easy to twist about
  // its length, hard to swing end over end
  return new Body({ m: MASS, I: [0.072, 0.0016, 0.074], spheres: batSpheres(), e: 0.22, mu: 0.5, roll: 1.4 })
}

// standing on its toe, the face turned to the viewer
const STAND_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
const STAND_P = new THREE.Vector3().copy(COM).applyQuaternion(STAND_Q)
const BALL_HOME = new THREE.Vector3(0.3, BALL.r, 0.22)

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

// wood: the willow colour. grains: straight grains across the face (more is
// a higher grade). gripColor: the rubber. ball: a ball to hit. sound: knocks
// and cracks. stand, topple, resetBall: bump these numbers to do it.
export default function Bat({ wood = '#e6cfa3', grains = 10, gripColor = '#f4f4f2', ball: showBall = true, ballColor = '#8f1a17', sound = false, stand = 0, topple = 0, resetBall = 0 }) {
  const [hover, setHover] = useState(false)
  const [held, setHeld] = useState(false)
  useCursor(hover || held, held ? 'grabbing' : 'grab')
  const { camera, gl, controls } = useThree()

  const geo = useMemo(
    () => ({
      blade: bladeGeometry(),
      // from just inside the top of the blade to just under the grip's cap
      handle: new THREE.CylinderGeometry(HANDLE_R, HANDLE_R * 1.03, BAT_L - BLADE_L - 0.01, 28),
      grip: new THREE.CylinderGeometry(GRIP_R, GRIP_R * 1.01, BAT_L - BLADE_L - 0.045, 48, 1, true),
      gripEnd: new THREE.SphereGeometry(GRIP_R, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      twine: new THREE.CylinderGeometry(HANDLE_R + 0.0018, HANDLE_R + 0.0034, 0.032, 36),
      splice: new THREE.PlaneGeometry(0.03, 0.11),
      ball: new THREE.SphereGeometry(BALL.r, 40, 28),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const willow = useMemo(() => willowTexture(wood, grains), [wood, grains])
  useEffect(() => () => [willow.map, willow.bump].forEach((t) => t.dispose()), [willow])
  const tex = useMemo(() => ({ grip: gripTexture(), twine: twineTexture(), splice: spliceTexture() }), [])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])

  const mats = useMemo(
    () => ({
      // oiled willow: matt, a faint sheen where the light rakes it
      blade: new THREE.MeshPhysicalMaterial({ roughness: 0.58, clearcoat: 0.22, clearcoatRoughness: 0.45, bumpScale: 0.35, sheen: 0.25, sheenRoughness: 0.6 }),
      handle: new THREE.MeshStandardMaterial({ color: '#c9a76e', roughness: 0.6 }),
      grip: new THREE.MeshStandardMaterial({ roughness: 0.78 }),
      twine: new THREE.MeshStandardMaterial({ color: '#a3865a', roughness: 0.85 }),
      splice: new THREE.MeshStandardMaterial({ roughness: 0.65, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      ball: new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.blade.map = willow.map
    mats.blade.bumpMap = willow.bump
    mats.blade.sheenColor.set(wood)
    mats.blade.needsUpdate = true
    mats.grip.map = tex.grip
    mats.grip.bumpMap = tex.grip
    mats.grip.bumpScale = 1.5
    mats.grip.color.set(gripColor)
    mats.grip.needsUpdate = true
    mats.twine.bumpMap = tex.twine
    mats.twine.needsUpdate = true
    mats.splice.alphaMap = tex.splice
    mats.splice.color.set(wood).multiplyScalar(0.7)
    mats.splice.needsUpdate = true
    mats.ball.color.set(ballColor)
  }, [mats, willow, tex, wood, gripColor, ballColor])

  // ---- sound ----
  const audio = useRef(null)
  const live = useRef({})
  live.current = { sound, showBall }
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
    if (now - (lastSound.current[name] || 0) < 50) return
    lastSound.current[name] = now
    if (!audio.current) audio.current = createBatAudio()
    audio.current?.[name](s)
  }

  // ---- the world ----
  const world = useMemo(() => {
    const bat = batBody()
    bat.pos.copy(STAND_P)
    bat.quat.copy(STAND_Q)
    const ball = ballBody()
    ball.pos.copy(BALL_HOME)
    return { bat, ball, mode: 'standing', lift: null, grab: null, target: new THREE.Vector3() }
  }, [])

  const doTopple = () => {
    const w = world
    if (w.mode !== 'standing') return
    w.mode = 'free'
    w.bat.active = true
    w.bat.still = 0
    // a nudge at the top of the handle, backwards or forwards
    const dir = Math.random() < 0.5 ? 1 : -1
    w.bat.ang.set(dir * (1.1 + Math.random() * 0.6), 0, (Math.random() - 0.5) * 0.8)
  }
  const doStand = () => {
    const w = world
    if (w.mode === 'standing' || w.grab) return
    w.mode = 'lifting'
    w.bat.active = false
    w.lift = { t: 0, p: w.bat.pos.clone(), q: w.bat.quat.clone() }
  }
  const doResetBall = () => {
    const b = world.ball
    b.active = false
    b.pos.copy(BALL_HOME)
    b.vel.set(0, 0, 0)
    b.ang.set(0, 0, 0)
  }
  const first = useRef(true)
  useEffect(() => {
    if (!first.current) doTopple()
  }, [topple]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!first.current) doStand()
  }, [stand]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!first.current) doResetBall()
  }, [resetBall]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    first.current = false
  }, [])

  // ---- picking it up ----
  const press = useRef(null)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const pointerTarget = (cx, cy, plane, out) => {
    const rect = gl.domElement.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), camera)
    if (!ray.ray.intersectPlane(plane, out)) return false
    // keep it over the ground and within reach
    out.y = Math.max(0.03, Math.min(1.6, out.y))
    const r = Math.hypot(out.x, out.z)
    if (r > 1.6) {
      out.x *= 1.6 / r
      out.z *= 1.6 / r
    }
    return true
  }
  const onDown = (e) => {
    e.stopPropagation()
    const w = world
    const local = e.point.clone().sub(w.bat.pos).applyQuaternion(w.bat.quat.clone().invert())
    const n = camera.getWorldDirection(new THREE.Vector3()).negate()
    n.y = 0
    n.normalize()
    press.current = { sx: e.clientX, sy: e.clientY, local, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, e.point), moved: false }
    if (controls) controls.enabled = false
  }
  useEffect(() => {
    const move = (e) => {
      const p = press.current
      if (!p) return
      const w = world
      if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 4) {
        p.moved = true
        // take hold: it is a free body from here
        w.mode = 'free'
        w.lift = null
        w.bat.active = true
        w.bat.still = 0
        w.grab = { local: p.local }
        setHeld(true)
      }
      if (p.moved) pointerTarget(e.clientX, e.clientY, p.plane, w.target)
    }
    const up = () => {
      const p = press.current
      if (!p) return
      press.current = null
      if (controls) controls.enabled = true
      const w = world
      if (p.moved) {
        w.grab = null
        setHeld(false)
      } else if (w.mode === 'standing') doTopple()
      else doStand()
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
  const v3 = useMemo(() => new THREE.Vector3(), [])
  const substep = (h) => {
    const w = world
    const bat = w.bat
    const ball = w.ball
    // held: a stiff, damped spring from the hand to the point it was taken by
    if (w.grab && bat.active) {
      const gp = v1.copy(w.grab.local).applyQuaternion(bat.quat).add(bat.pos)
      const gv = bat.pointVel(gp, v2)
      const K = 650
      const C = 2 * Math.sqrt(K * MASS) * 0.85
      const F = v3.subVectors(w.target, gp).multiplyScalar(K).addScaledVector(gv, -C)
      bat.applyImpulse(F.multiplyScalar(h), gp, bat.invInertia(new THREE.Matrix3()))
      bat.ang.multiplyScalar(Math.exp(-2.5 * h)) // the wrist steadies it
      if (bat.vel.length() > 22) bat.vel.setLength(22)
    }
    if (w.mode === 'free') bat.step(h, (_, s) => play('knock', s / 3))
    if (live.current.showBall) {
      ball.step(h, (_, s) => play('thud', s / 4))
      // bat against ball, sphere by sphere
      const R = BALL.r
      for (const s of bat.spheres) {
        const wp = v1.copy(s.p).applyQuaternion(bat.quat).add(bat.pos)
        const n = v2.subVectors(ball.pos, wp)
        const d = n.length()
        if (d >= s.r + R || d < 1e-7) continue
        n.divideScalar(d)
        // a standing bat is woken by a ball rolling into it
        if (w.mode === 'standing') {
          w.mode = 'free'
          bat.active = true
        }
        ball.active = true
        ball.still = 0
        bat.active = w.mode === 'free'
        const cp = v3.copy(wp).addScaledVector(n, s.r)
        const speed = w.mode === 'free' ? collide(ball, bat, cp, n.clone(), 0.5, 0.2) : collide(ball, null, cp, n.clone(), 0.5, 0.2)
        ball.pos.copy(wp).addScaledVector(n, s.r + R + 0.0002)
        if (speed > 0.4) play('crack', speed / 18)
      }
      if (Math.hypot(ball.pos.x, ball.pos.z) > 6) doResetBall()
    }
  }

  const batRef = useRef()
  const ballRef = useRef()
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!(dt > 0)) return
    const w = world
    if (w.mode === 'lifting' && w.lift) {
      // picked up and stood back on its toe
      w.lift.t += dt / 0.8
      const k = easeInOut(Math.min(1, w.lift.t))
      w.bat.pos.lerpVectors(w.lift.p, STAND_P, k)
      w.bat.pos.y += Math.sin(Math.PI * k) * 0.12
      w.bat.quat.slerpQuaternions(w.lift.q, STAND_Q, k)
      if (w.lift.t >= 1) {
        w.mode = 'standing'
        w.lift = null
        w.bat.vel.set(0, 0, 0)
        w.bat.ang.set(0, 0, 0)
        play('knock', 0.25)
      }
    }
    const n = Math.max(1, Math.ceil(dt / SUB))
    for (let i = 0; i < n; i++) substep(dt / n)
    batRef.current.position.copy(w.bat.pos)
    batRef.current.quaternion.copy(w.bat.quat)
    ballRef.current.visible = showBall
    ballRef.current.position.copy(w.ball.pos)
    ballRef.current.quaternion.copy(w.ball.quat)
  })

  const gripLen = BAT_L - BLADE_L - 0.045
  return (
    <group>
      <group
        ref={batRef}
        onPointerDown={onDown}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <group position={[-COM.x, -COM.y, -COM.z]}>
          <mesh geometry={geo.blade} material={mats.blade} castShadow receiveShadow />
          <mesh geometry={geo.splice} material={mats.splice} position={[0, BLADE_L - 0.055, FACE_Z - 0.0022]} rotation={[0, Math.PI, 0]} />
          <mesh geometry={geo.handle} material={mats.handle} position={[0, (BLADE_L - 0.004 + BAT_L - 0.014) / 2, HANDLE_Z]} castShadow />
          <mesh geometry={geo.twine} material={mats.twine} position={[0, BLADE_L + 0.008, HANDLE_Z]} castShadow />
          <mesh geometry={geo.grip} material={mats.grip} position={[0, BLADE_L + 0.024 + gripLen / 2, HANDLE_Z]} castShadow />
          <mesh geometry={geo.gripEnd} material={mats.grip} position={[0, BLADE_L + 0.024 + gripLen, HANDLE_Z]} scale={[1, 0.55, 1]} castShadow />
        </group>
      </group>
      <mesh ref={ballRef} geometry={geo.ball} material={mats.ball} castShadow />
    </group>
  )
}
