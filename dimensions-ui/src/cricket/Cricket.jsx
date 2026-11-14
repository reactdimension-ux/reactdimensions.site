import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createCricketAudio } from './audio.js'
import { BAIL, BAIL_Y, BALL, STUMP, STUMP_COM, STUMP_X, PlantedStump, ballBody, bailBody, closestOnSegment, collide, stumpBody } from './physics.js'

// A cricket wicket, with the physics that makes it interesting. Bowl and the
// ball is released from the far end, pitches, and comes on to the stumps: the
// struck stump is driven back in the soil (or, at pace, uprooted), and the
// bails jump out of their grooves and tumble to the turf.
// SI units: metres. The stumps stand on the crease at z = 0, the bowler is
// off along -z.



const BOWL_Z = -9 // release point
const RELEASE_Y = 2.1
const SUB = 1 / 3000

const BALL_COLORS = { red: '#8f1a17', white: '#ece8de', pink: '#e2508d' }
export const CRICKET_BALLS = Object.keys(BALL_COLORS)

// ---- textures ----
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
function valueNoise(seed) {
  const h = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  const n = (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = h(xi, yi)
    const b = h(xi + 1, yi)
    const c = h(xi, yi + 1)
    const d = h(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  return (x, y, oct = 4) => {
    let t = 0
    let amp = 0.5
    let f = 1
    for (let i = 0; i < oct; i++) {
      t += n(x * f, y * f) * amp
      f *= 2
      amp *= 0.5
    }
    return t
  }
}

// Wood with its grain running along the texture's v (up the stump):
// fine straight streaks, with ash's bolder growth lines when `rings` is high.
function woodTexture(base, dark, { rings = 1, seed = 2 } = {}) {
  const S = 512
  const fbm = valueNoise(seed)
  const r = rng(seed * 131)
  const b = new THREE.Color(base)
  const k = new THREE.Color(dark)
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const bm = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const ci = c.getContext('2d').createImageData(S, S)
  const bi = bm.getContext('2d').createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // lines run along y: the pattern varies across x
      const warp = fbm(x / 60, y / 220) * 1.6 * rings
      const ring = (x / S) * 9 * rings + warp
      const f = ring - Math.floor(ring)
      const late = Math.pow(f, 6) * rings
      const streak = fbm(x / 1.8, y / 240, 3)
      const pore = r() < 0.006 * rings ? 0.6 : 0
      const t = Math.min(1, Math.max(0, late * 0.55 + (streak - 0.4) * 0.6 + pore * 0.3 + 0.15))
      const i = (y * S + x) * 4
      ci.data[i] = (b.r + (k.r - b.r) * t) * 255
      ci.data[i + 1] = (b.g + (k.g - b.g) * t) * 255
      ci.data[i + 2] = (b.b + (k.b - b.b) * t) * 255
      ci.data[i + 3] = 255
      const v = 190 - t * 90
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = v
      bi.data[i + 3] = 255
    }
  }
  c.getContext('2d').putImageData(ci, 0, 0)
  bm.getContext('2d').putImageData(bi, 0, 0)
  const mk = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    return t
  }
  return { map: mk(c, true), bump: mk(bm) }
}

// The ball: polished leather in four quarters, a raised seam of six rows of
// stitches round its equator and a fainter quarter seam.
function ballTexture(color) {
  const W = 1024
  const H = 512
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, W, H)
  const r = rng(11)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'
    g.fillRect(r() * W, r() * H, 2, 2)
  }
  const light = color === BALL_COLORS.white ? '#5a6a7a' : '#f1e6cf'
  // main seam
  g.fillStyle = 'rgba(0,0,0,0.25)'
  g.fillRect(0, H / 2 - 7, W, 14)
  g.fillStyle = light
  for (const dy of [-22, -15, -8, 8, 15, 22])
    for (let x = 0; x < W; x += 9) {
      g.save()
      g.translate(x, H / 2 + dy)
      g.rotate(dy < 0 ? -0.5 : 0.5)
      g.fillRect(-3, -1.2, 6, 2.4)
      g.restore()
    }
  // quarter seam, running pole to pole on the two halves
  g.strokeStyle = 'rgba(0,0,0,0.3)'
  g.lineWidth = 2
  for (const x of [W * 0.25, W * 0.75]) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H / 2 - 30)
    g.moveTo(x + W * 0.25 * (x < W / 2 ? 1 : -1), H / 2 + 30)
    g.lineTo(x + W * 0.25 * (x < W / 2 ? 1 : -1), H)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// A strip of pitch: dry rolled turf with the creases painted on.
function pitchTexture() {
  const W = 512
  const H = 2048
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = '#cbbd96'
  g.fillRect(0, 0, W, H)
  const r = rng(5)
  for (let i = 0; i < 40000; i++) {
    const v = r()
    g.fillStyle = v < 0.5 ? `rgba(110,95,60,${0.05 + r() * 0.08})` : `rgba(245,238,215,${0.05 + r() * 0.08})`
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 3)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return { canvas: c, tex: t }
}

// ---- geometry ----
function lathe(profile, segs = 40) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs)
}
// a stump: round shaft, domed top, and a sharpened-pencil spike: the shaft
// ends in a small chamfer, then a straight cone about two and a half
// diameters long runs down to a rounded, blunt tip. Origin at the ground line.
function stumpGeometry() {
  const R = STUMP.r
  const S = STUMP.spike
  return lathe([
    [0, -S],
    [R * 0.12, -S + 0.0012],
    [R * 0.2, -S + 0.0045],
    [R * 0.88, -0.021],
    [R * 0.9, -0.0195],
    [R, -0.0165],
    [R, STUMP.h - 0.016],
    [R * 0.96, STUMP.h - 0.008],
    [R * 0.8, STUMP.h - 0.003],
    [R * 0.45, STUMP.h],
    [0, STUMP.h + 0.0008],
  ])
}
// the loosened soil heaped round a stump where it was driven in: a low,
// crumbly collar rising to a lip at the hole. Origin at the ground line.
function collarGeometry() {
  const R = STUMP.r
  const g = lathe(
    [
      [R * 1.01, -0.006],
      [R * 1.04, 0.0032],
      [R * 1.3, 0.0052],
      [0.032, 0.0034],
      [0.044, 0.0012],
      [0.056, 0.0001],
      [0.062, -0.0004],
    ],
    64,
  )
  // crumble it: lumps and dips round the ring (whole-number frequencies,
  // so the lathe's seam lines up)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (y <= 0) continue
    const x = p.getX(i)
    const z = p.getZ(i)
    const a = Math.atan2(z, x)
    const r = Math.hypot(x, z)
    const n = 0.5 + 0.28 * Math.sin(a * 7 + 1.3) + 0.22 * Math.sin(a * 13 + r * 420)
    p.setY(i, y * (0.55 + 0.9 * n))
  }
  g.computeVertexNormals()
  return g
}
// a bail: two turned barrels with rings, a waist, spigots at each end. Axis x.
function bailGeometry() {
  const L = BAIL.len / 2
  const sp = BAIL.spigot
  const R = BAIL.r
  const half = [
    [0, -L],
    [sp * 0.7, -L + 0.0006],
    [sp, -L + 0.002],
    [sp, -L + 0.019],
    [R * 0.8, -L + 0.021],
    [R, -L + 0.025],
    [R, -0.03],
    [R * 0.84, -0.028],
    [R * 0.84, -0.024],
    [R, -0.022],
    [R, -0.017],
    [R * 0.84, -0.015],
    [R * 0.84, -0.011],
    [R * 0.95, -0.009],
    [R * 0.62, -0.006],
    [R * 0.58, 0],
  ]
  const full = [...half, ...half.slice(0, -1).reverse().map(([r, y]) => [r, -y])]
  return lathe(full, 28).rotateZ(-Math.PI / 2)
}


// line: middle | off | leg | random. pace: km/h. slowMotion: how fast time
// runs (1 = real time). autoBowl: bowl again by itself once things settle.
// bowl, reset: bump these numbers to do it. sound: the cracks.
export default function Cricket({
  line = 'middle',
  pace = 110,
  slowMotion = 0.3,
  autoBowl = false,
  stumpWood = '#c99447',
  ball: ballColor = 'red',
  sound = false,
  bowl = 0,
  reset = 0,
}) {
  const [hover, setHover] = useState(false)
  useCursor(hover)

  // ---- geometry, textures, materials ----
  const geo = useMemo(
    () => ({
      stump: stumpGeometry(),
      notch: new THREE.BoxGeometry(STUMP.r * 2.05, 0.004, 0.008),
      bail: bailGeometry(),
      ball: new THREE.SphereGeometry(BALL.r, 48, 32),
      pitch: new THREE.PlaneGeometry(3.05, 12),
      crease: new THREE.PlaneGeometry(1, 1),
      collar: collarGeometry(),
      hole: new THREE.CircleGeometry(1, 40),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const stumpTex = useMemo(() => woodTexture(stumpWood, new THREE.Color(stumpWood).multiplyScalar(0.62).getStyle(), { rings: 1, seed: 4 }), [stumpWood])
  const ballTex = useMemo(() => ballTexture(BALL_COLORS[ballColor] || BALL_COLORS.red), [ballColor])
  const pitch = useMemo(() => pitchTexture(), [])
  useEffect(() => () => [stumpTex.map, stumpTex.bump].forEach((t) => t.dispose()), [stumpTex])
  useEffect(() => () => ballTex.dispose(), [ballTex])
  useEffect(
    () => () => {
      pitch.tex.dispose()
    },
    [pitch],
  )

  const mats = useMemo(() => {
    // stumps are lacquered ash
    const stump = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25, bumpScale: 0.6 })
    const bail = stump.clone()
    return {
      stump,
      bail,
      notch: new THREE.MeshStandardMaterial({ color: '#4a2f15', roughness: 0.8 }),
      ball: new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      pitch: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
      crease: new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }),
      // loosened soil, darker and damper than the rolled surface
      soil: new THREE.MeshStandardMaterial({ color: '#9a7b52', roughness: 1 }),
      hole: new THREE.MeshStandardMaterial({ color: '#2a1d12', roughness: 1 }),
    }
  }, [])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    for (const m of [mats.stump, mats.bail]) {
      m.map = stumpTex.map
      m.bumpMap = stumpTex.bump
      m.needsUpdate = true
    }
    mats.ball.map = ballTex
    mats.ball.needsUpdate = true
    mats.pitch.map = pitch.tex
    mats.pitch.needsUpdate = true
  }, [mats, stumpTex, ballTex, pitch])

  // ---- sound ----
  const audio = useRef(null)
  const live = useRef({})
  live.current = { line, pace, slowMotion, autoBowl, sound }
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
    if (now - (lastSound.current[name] || 0) < 40) return
    lastSound.current[name] = now
    if (!audio.current) audio.current = createCricketAudio()
    audio.current?.[name](s)
  }

  // ---- the world ----
  const world = useMemo(() => {
    const stumps = STUMP_X.map((x) => new PlantedStump(x))
    return {
      t: 0,
      stumps,
      free: [null, null, null], // stumps once uprooted
      bails: [
        { seated: true, body: bailBody() },
        { seated: true, body: bailBody() },
      ],
      ball: ballBody(),
      bowledAt: -1,
      settleTimer: 0,
      disturbed: false,
    }
  }, [])

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Vector3(), n: new THREE.Vector3(), p: new THREE.Vector3(), v: new THREE.Vector3() }), [])

  // the seat of bail i: on the tops of stumps i and i+1
  const seat = (i, pos, quat) => {
    const ta = world.stumps[i].top(tmp.a)
    const tb = world.stumps[i + 1].top(tmp.b)
    pos.addVectors(ta, tb).multiplyScalar(0.5)
    pos.y += BAIL_Y - STUMP.h
    tmp.v.subVectors(tb, ta).normalize()
    quat.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tmp.v)
  }

  const resetWorld = () => {
    const w = world
    w.stumps.forEach((s) => s.reset())
    w.free = [null, null, null]
    w.bails.forEach((b, i) => {
      b.seated = true
      b.body.active = false
      seat(i, b.body.pos, b.body.quat)
    })
    w.ball.active = false
    w.ball.pos.set(0, -1, BOWL_Z)
    w.bowledAt = -1
    w.disturbed = false
  }

  // where the ball should go: aim it so that, after pitching, it arrives at
  // the stumps at about a third of their height. Found by shooting: fly a
  // ghost ball and adjust its release until it arrives where it should.
  const aim = (x, v) => {
    const ghost = ballBody()
    const fly = (vy) => {
      ghost.active = true
      ghost.pos.set(x, RELEASE_Y, BOWL_Z)
      ghost.vel.set(0, vy, v)
      ghost.ang.set(0, 0, 0)
      ghost.quat.identity()
      let t = 0
      while (t < 3) {
        ghost.step(SUB)
        t += SUB
        if (ghost.pos.z >= 0) return { y: ghost.pos.y }
        if (!ghost.active) break
      }
      return { y: -1 }
    }
    // Two releases reach the stumps at any height: a full toss, and one that
    // pitches first. Search only among those that pitch before the crease
    // (steeper than the one that lands right on it), where a steeper release
    // pitches shorter and comes on higher.
    const target = STUMP.h * 0.56
    const T = -BOWL_Z / v
    const vyCrease = (BALL.r - RELEASE_Y + 0.5 * 9.81 * T * T) / T
    let lo = vyCrease - 14
    let hi = vyCrease - 0.05
    let bestVy = -4
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2
      const r = fly(mid)
      bestVy = mid
      if (r.y < target) hi = mid
      else lo = mid
    }
    return bestVy
  }

  const doBowl = () => {
    const w = world
    if (w.disturbed || w.ball.active || w.bowledAt >= 0) resetWorld()
    const L = live.current
    const lineX = { middle: 0, off: 0.085, leg: -0.085 }[L.line] ?? (Math.random() - 0.5) * 0.36
    const v = L.pace / 3.6
    const vy = aim(lineX, v)
    const b = w.ball
    b.active = true
    b.still = 0
    b.pos.set(lineX, RELEASE_Y, BOWL_Z)
    b.vel.set(0, vy, v)
    b.ang.set(-v / BALL.r * 0.15, 0, 0) // a little backspin off the fingers
    b.quat.identity()
    w.bowledAt = w.t
    w.settleTimer = 0
  }

  // commands from the scene's buttons
  const first = useRef(true)
  useEffect(() => {
    if (first.current) return
    doBowl()
  }, [bowl]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (first.current) return
    resetWorld()
  }, [reset]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    first.current = false
    resetWorld()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- one physics substep ----
  // ball against a stump given its axis a→b
  const ballStump = (a, bEnd, target) => {
    const b = world.ball
    closestOnSegment(a, bEnd, b.pos, tmp.q)
    tmp.n.subVectors(b.pos, tmp.q)
    const d = tmp.n.length()
    if (d >= BALL.r + STUMP.r || d < 1e-7) return
    tmp.n.divideScalar(d)
    const cp = tmp.p.copy(tmp.q).addScaledVector(tmp.n, STUMP.r)
    const speed = collide(b, target, cp, tmp.n.clone(), 0.38, 0.15)
    if (target.invInertia && speed > 0) {
      target.active = true // wake a stump lying on the grass
      target.still = 0
    }
    b.pos.copy(tmp.q).addScaledVector(tmp.n, BALL.r + STUMP.r + 0.0003)
    if (speed > 0.3) {
      play('stump', speed / 25)
      world.disturbed = true
    }
  }

  const freeStumpAxis = (body, a, b) => {
    a.set(0, -STUMP.spike - STUMP_COM, 0).applyQuaternion(body.quat).add(body.pos)
    b.set(0, STUMP.h - STUMP_COM, 0).applyQuaternion(body.quat).add(body.pos)
  }

  const releaseBail = (i, extra) => {
    const bl = world.bails[i]
    if (!bl.seated) return
    bl.seated = false
    world.disturbed = true
    const B = bl.body
    seat(i, B.pos, B.quat)
    // it leaves with the tops of the stumps that were carrying it
    const sa = world.stumps[i]
    const sb = world.stumps[i + 1]
    const va = sa.pointVel(sa.top(tmp.a), new THREE.Vector3())
    const vb = sb.pointVel(sb.top(tmp.b), new THREE.Vector3())
    B.vel.addVectors(va, vb).multiplyScalar(0.55)
    if (extra) B.vel.add(extra)
    const kick = Math.min(6, B.vel.length())
    B.vel.y += 0.6 + kick * (0.35 + Math.random() * 0.35)
    B.ang.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).multiplyScalar(20 + kick * 14)
    B.active = true
    B.still = 0
    play('bail', 0.5)
  }

  const substep = (h) => {
    const w = world
    w.t += h

    // the ball
    const b = w.ball
    if (b.active) {
      b.step(h, (_, s) => play('pitch', s / 8))
      w.stumps.forEach((s) => {
        if (s.planted) ballStump(s.base, s.top(tmp.b).clone(), s)
      })
      w.free.forEach((f) => {
        if (!f) return
        const a = new THREE.Vector3()
        const e = new THREE.Vector3()
        freeStumpAxis(f, a, e)
        ballStump(a, e, f)
      })
      // straight into a seated bail
      w.bails.forEach((bl, i) => {
        if (!bl.seated) return
        const pos = new THREE.Vector3()
        const quat = new THREE.Quaternion()
        seat(i, pos, quat)
        const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).multiplyScalar(BAIL.len / 2)
        closestOnSegment(pos.clone().sub(ax), pos.clone().add(ax), b.pos, tmp.q)
        const d = tmp.q.distanceTo(b.pos)
        if (d < BALL.r + BAIL.r) {
          releaseBail(i, b.vel.clone().multiplyScalar(0.6))
          tmp.n.subVectors(b.pos, tmp.q).normalize()
          collide(b, bl.body, tmp.q.clone().addScaledVector(tmp.n, BAIL.r), tmp.n.clone(), 0.4, 0.1)
        }
      })
      if (b.pos.lengthSq() > 900) b.active = false
    }

    // the stumps
    w.stumps.forEach((s, i) => {
      if (!s.planted) return
      if (s.step(h)) {
        // out of the ground: it flies free from here
        s.planted = false
        const f = stumpBody()
        const u = s.up(new THREE.Vector3())
        f.pos.copy(s.base).addScaledVector(u, STUMP_COM)
        f.quat.copy(s.quat)
        f.vel.copy(s.pointVel(f.pos, new THREE.Vector3()))
        f.vel.y += 0.8
        f.ang.copy(s.ang)
        f.active = true
        w.free[i] = f
      }
    })
    // a stump in the hand: the grabbed point is pulled toward the pointer by
    // a stiff, damped hand (its velocity relaxes toward one that closes the
    // gap, over about 1/60 s), applied as an impulse at that point. Gravity
    // still acts on the whole stump, so it hangs from where you hold it and
    // swings like a real one would.
    const H = grab.current
    if (H?.body) {
      const f = H.body
      const p = H.p.copy(H.local).applyQuaternion(f.quat).add(f.pos)
      const dv = H.dv.subVectors(H.target, p).multiplyScalar(40).sub(f.pointVel(p, H.pv))
      const mag = dv.length()
      if (mag > 1e-6) {
        dv.divideScalar(mag)
        f.invInertia(H.invIw)
        const k = f.kAt(p, dv, H.invIw)
        f.applyImpulse(dv.multiplyScalar((mag / k) * Math.min(1, h * 60)), p, H.invIw)
      }
      // the grip: fingers round the stump soak up its swing (with less, a
      // shake sends it whirling over the hand; with this it swings and
      // settles to hang straight in about half a second)
      f.ang.multiplyScalar(1 - Math.min(1, h * 10))
      f.active = true
      f.still = 0
    }
    w.free.forEach((f) => f?.step(h, (_, s) => play('stump', s / 12)))

    // the bails: they stay seated while the stumps under them stay put
    w.bails.forEach((bl, i) => {
      if (bl.seated) {
        const sa = w.stumps[i]
        const sb = w.stumps[i + 1]
        if (!sa.planted || !sb.planted) return releaseBail(i)
        const da = sa.top(tmp.a).distanceTo(tmp.b.set(sa.base.x, STUMP.h, 0))
        const db = sb.top(tmp.a).distanceTo(tmp.b.set(sb.base.x, STUMP.h, 0))
        if (Math.max(da, db) > 0.005) releaseBail(i)
        return
      }
      const B = bl.body
      B.step(h, (_, s) => play('bail', s / 4))
      // a flying bail knocks against the stumps still standing
      if (!B.active) return
      w.stumps.forEach((s) => {
        if (!s.planted) return
        const top = s.top(new THREE.Vector3())
        for (const sp of B.spheres) {
          const wp = tmp.p.copy(sp.p).applyQuaternion(B.quat).add(B.pos)
          closestOnSegment(s.base, top, wp, tmp.q)
          tmp.n.subVectors(wp, tmp.q)
          const d = tmp.n.length()
          if (d >= sp.r + STUMP.r || d < 1e-7) continue
          tmp.n.divideScalar(d)
          collide(B, s, tmp.q.clone().addScaledVector(tmp.n, STUMP.r), tmp.n.clone(), 0.3, 0.2)
          B.pos.addScaledVector(tmp.n, sp.r + STUMP.r - d)
        }
      })
    })
  }

  // ---- render ----
  const ballRef = useRef()
  const stumpRefs = [useRef(), useRef(), useRef()]
  const holeRefs = [useRef(), useRef(), useRef()]
  const bailRefs = [useRef(), useRef()]
  const autoT = useRef(0)

  // ---- grabbing a stump ----
  // Press on a stump and drag: the first movement pulls it out of the soil
  // (leaving its socket empty) and you hold it by the point you pressed. A
  // tap without dragging still bowls.
  const { camera, gl, controls } = useThree()
  const grab = useRef(null)
  const startHold = (H) => {
    const w = world
    const s = w.stumps[H.i]
    let f = w.free[H.i]
    if (!f) {
      // pull it out as it stands
      s.planted = false
      f = stumpBody()
      f.pos.copy(s.base).addScaledVector(s.up(new THREE.Vector3()), STUMP_COM)
      f.quat.copy(s.quat)
      f.active = true
      w.free[H.i] = f
      play('stump', 0.25)
    }
    w.disturbed = true
    H.body = f
    // the grabbed point, in the stump's own frame
    H.local = H.hit.clone().sub(f.pos).applyQuaternion(f.quat.clone().invert())
    H.target = H.hit.clone()
  }
  const onStumpDown = (i) => (e) => {
    e.stopPropagation()
    const n = new THREE.Vector3()
    camera.getWorldDirection(n)
    grab.current = {
      i,
      x: e.clientX,
      y: e.clientY,
      hit: e.point.clone(),
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n.negate(), e.point),
      body: null,
      p: new THREE.Vector3(),
      dv: new THREE.Vector3(),
      pv: new THREE.Vector3(),
      invIw: new THREE.Matrix3(),
    }
    gl.domElement.setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
  }
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()
    const move = (e) => {
      const H = grab.current
      if (!H) return
      if (!H.body) {
        if (Math.hypot(e.clientX - H.x, e.clientY - H.y) < 6) return
        startHold(H)
      }
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (ray.ray.intersectPlane(H.plane, hit)) H.target.copy(hit)
    }
    const up = () => {
      const H = grab.current
      if (!H) return
      grab.current = null
      if (controls) controls.enabled = true
      // a tap: bowl, as a click on the stumps always did
      if (!H.body) doBowl()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  })

  useFrame((_, delta) => {
    const real = Math.min(delta, 1 / 20)
    if (!(real > 0)) return
    const L = live.current
    // in real time while a stump is in the hand, so it keeps up with you
    const sim = grab.current?.body ? real : real * THREE.MathUtils.clamp(L.slowMotion, 0.05, 1)
    const n = Math.max(1, Math.ceil(sim / SUB))
    for (let i = 0; i < n; i++) substep(sim / n)

    const w = world
    // bowl again by itself once everything has come to rest
    if (L.autoBowl) {
      const busy = !!grab.current || w.ball.active || w.free.some((f) => f?.active) || w.bails.some((b) => b.body.active)
      autoT.current = busy ? 0 : autoT.current + real
      if (autoT.current > (w.bowledAt < 0 ? 0.8 : 1.6)) {
        autoT.current = 0
        doBowl()
      }
    }

    // ball
    const b = w.ball
    ballRef.current.visible = b.active || w.bowledAt >= 0
    ballRef.current.position.copy(b.pos)
    ballRef.current.quaternion.copy(b.quat)
    // stumps: drawn about their centre of mass either way
    w.stumps.forEach((s, i) => {
      const g = stumpRefs[i].current
      const f = w.free[i]
      if (f) {
        g.position.copy(f.pos)
        g.quaternion.copy(f.quat)
      } else {
        g.position.copy(s.base).addScaledVector(s.up(tmp.v), STUMP_COM)
        g.quaternion.copy(s.quat)
      }
      // the hole in the soil. Upright, the stump fills it. Driven back, the
      // stump turns about its base: the spike shoves forward underground and
      // the shaft pulls away from the front of the hole, opening a gap there
      // that widens with the lean. Uprooted, the empty round socket is left.
      const hg = holeRefs[i].current
      if (hg) {
        const R = STUMP.r
        hg.position.set(s.base.x, 0.0018, s.base.z)
        hg.rotation.y = 0
        if (f) hg.scale.set(R * 1.06, 1, R * 1.06)
        else {
          const u = s.up(tmp.v)
          const hl = Math.hypot(u.x, u.z)
          if (hl < 1e-4) hg.scale.set(R * 0.97, 1, R * 0.97)
          else {
            const dx = u.x / hl
            const dz = u.z / hl
            const gap = Math.min(0.02, hl * 0.06)
            hg.position.x -= (dx * gap) / 2
            hg.position.z -= (dz * gap) / 2
            hg.rotation.y = Math.atan2(-dz, dx)
            hg.scale.set(R + gap / 2, 1, R * 1.04)
          }
        }
      }
    })
    // bails
    w.bails.forEach((bl, i) => {
      const g = bailRefs[i].current
      if (bl.seated) seat(i, g.position, g.quaternion)
      else {
        g.position.copy(bl.body.pos)
        g.quaternion.copy(bl.body.quat)
      }
    })
  })

  const clickable = (fn) => ({
    onClick: (e) => {
      e.stopPropagation()
      if (e.delta > 4) return
      fn()
    },
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  })

  return (
    <group>
      {/* the pitch: a strip of rolled turf with the creases on it */}
      <mesh geometry={geo.pitch} material={mats.pitch} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, -4.5]} receiveShadow />
      {/* bowling crease through the stumps, popping crease 1.22 m in front, return creases */}
      <mesh geometry={geo.crease} material={mats.crease} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} scale={[2.64, 0.05, 1]} receiveShadow />
      <mesh geometry={geo.crease} material={mats.crease} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, -1.22]} scale={[3.05, 0.05, 1]} receiveShadow />
      {[-1.32, 1.32].map((x) => (
        <mesh key={x} geometry={geo.crease} material={mats.crease} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.001, -0.6]} scale={[0.05, 2.44, 1]} receiveShadow />
      ))}

      {/* the soil round each stump: a crumbly collar and the hole the spike
          sits in (the spike itself is modelled, below the ground line) */}
      {STUMP_X.map((x, i) => (
        <group key={x}>
          <mesh geometry={geo.collar} material={mats.soil} position={[x, 0, 0]} castShadow receiveShadow />
          <group ref={holeRefs[i]} position={[x, 0.0018, 0]}>
            <mesh geometry={geo.hole} material={mats.hole} rotation={[-Math.PI / 2, 0, 0]} />
          </group>
        </group>
      ))}

      {/* the stumps */}
      {STUMP_X.map((x, i) => (
        <group
          key={x}
          ref={stumpRefs[i]}
          onPointerDown={onStumpDown(i)}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
          }}
          onPointerOut={() => setHover(false)}
        >
          <group position={[0, -STUMP_COM, 0]}>
            <mesh geometry={geo.stump} material={mats.stump} castShadow receiveShadow />
            {/* the groove the bails sit in */}
            <mesh geometry={geo.notch} material={mats.notch} position={[0, STUMP.h - 0.0012, 0]} />
          </group>
        </group>
      ))}
      {/* the bails */}
      {[0, 1].map((i) => (
        <group key={i} ref={bailRefs[i]} {...clickable(doBowl)}>
          <mesh geometry={geo.bail} material={mats.bail} castShadow />
        </group>
      ))}

      {/* the ball */}
      <mesh ref={ballRef} geometry={geo.ball} material={mats.ball} castShadow visible={false} />
    </group>
  )
}
