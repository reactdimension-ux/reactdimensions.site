import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createSandAudio } from './audio.js'

// A turned-walnut hourglass. Two round plates, three spindles turned with
// beads and coves, and a blown glass of two bulbs joined at a narrow neck,
// sitting in a collar on each plate.
//
// The sand behaves as real sand does in an hourglass:
// - It runs out at a constant rate however much is left above (granular
//   flow through an orifice is set by the hole, not the head of sand above
//   it: the Beverloo law), so the time is linear.
// - The top surface sinks into a funnel-shaped crater over the neck, its
//   sides at the angle of repose (about 34 degrees for dry sand).
// - Below, it builds a cone at the same angle of repose, filling outward
//   and upward as the pile grows.
// - The stream falls freely from the neck and lands on the top of the pile.
// - Tip it and the flow slows, and stops once it's past about 50 degrees.
// Click it to turn it over: it swings over with momentum and settles, the
// sand slumps into the neck and starts running again.

const H = 0.088 // height of each bulb above or below the neck, m
const RMAX = 0.042 // widest outer radius of a bulb
const NECK = 0.0032 // outer radius at the neck
const WALL = 0.0018 // glass thickness
const REPOSE = Math.tan(THREE.MathUtils.degToRad(34))
const PLATE_R = 0.074
const PLATE_T = 0.016
const COLLAR_H = 0.009
const HALF = H + COLLAR_H - 0.002 // plate inner face from centre (collars overlap the glass ends)

// outer radius of the glass at height t (0 = neck, 1 = end of the bulb).
// Blown like a real hourglass: a trumpet flare out of the neck, a long
// cone widening to the belly about two thirds of the way up, then a
// rounded shoulder closing in onto the collar.
const BELLY = 0.68
const REND = 0.024
function bulbR(t) {
  t = Math.min(1, Math.max(0, t))
  if (t <= BELLY) {
    const u = t / BELLY
    return NECK + (RMAX - NECK) * Math.pow(Math.sin((u * Math.PI) / 2), 1.6)
  }
  const v = (t - BELLY) / (1 - BELLY)
  return REND + (RMAX - REND) * Math.sqrt(Math.max(0, 1 - v * v))
}
const innerR = (t) => Math.max(0.0008, bulbR(t) - WALL)

// volume of sand in a bulb from the neck up to height h (m), by integration
const N = 400
const VOL = new Float32Array(N + 1)
for (let i = 1; i <= N; i++) {
  const y0 = ((i - 1) / N) * H
  const y1 = (i / N) * H
  const r = innerR((y0 + y1) / (2 * H))
  VOL[i] = VOL[i - 1] + Math.PI * r * r * (y1 - y0)
}
const volTo = (h) => {
  const k = Math.max(0, Math.min(N, (h / H) * N))
  const i = Math.floor(k)
  return i >= N ? VOL[N] : VOL[i] + (VOL[i + 1] - VOL[i]) * (k - i)
}
// the same, measured up from the far end of the bulb
const volFromEnd = (s) => VOL[N] - volTo(H - s)

// upper bulb: level h at the glass, with a crater of depth d over the neck.
// k (0..1) is how far the crater has developed: just after turning, the
// surface is flat, and the funnel digs itself as the first sand drains.
function upperShape(V, k = 1) {
  let lo = 0
  let hi = H
  for (let it = 0; it < 40; it++) {
    const h = (lo + hi) / 2
    const R = innerR(h / H)
    const d = Math.min(h, R * REPOSE * k)
    const v = volTo(h) - (Math.PI * R * R * d) / 3
    if (v > V) hi = h
    else lo = h
  }
  const h = (lo + hi) / 2
  return { h, d: Math.min(h, innerR(h / H) * REPOSE * k) }
}
// lower bulb: level s at the glass (from the far end), with a cone on top
function lowerShape(V) {
  let lo = 0
  let hi = H
  for (let k = 0; k < 40; k++) {
    const s = (lo + hi) / 2
    const R = innerR((H - s) / H)
    const c = Math.min(R * REPOSE, H - s)
    const v = volFromEnd(s) + (Math.PI * R * R * c) / 3
    if (v > V) hi = s
    else lo = s
  }
  const s = (lo + hi) / 2
  return { s, c: Math.min(innerR((H - s) / H) * REPOSE, H - s) }
}

// lathe profiles for the sand, as [radius, y] with y measured from the neck
// (upper, y up) and from the neck downward (lower, negative y)
function upperProfile(V, k) {
  if (V < 1e-9) return null
  const { h, d } = upperShape(V, k)
  const R = innerR(h / H) * 0.985
  const pts = [new THREE.Vector2(0.0001, Math.max(0, h - d))]
  for (let k = 1; k <= 6; k++) pts.push(new THREE.Vector2((R * k) / 6, h - d + (d * k) / 6))
  for (let k = 1; k <= 24; k++) {
    const y = h * (1 - k / 24)
    pts.push(new THREE.Vector2(innerR(y / H) * 0.985, y))
  }
  pts.push(new THREE.Vector2(0.0001, 0))
  return pts.reverse()
}
function lowerProfile(V) {
  if (V < 1e-9) return null
  // the first sand builds a small cone on the bottom, growing from a point
  const R0 = innerR(1) * 0.985
  if (V < (Math.PI * R0 * R0 * R0 * REPOSE) / 3) {
    const rc = Math.cbrt((3 * V) / (Math.PI * REPOSE))
    return [new THREE.Vector2(0.0001, -H + 0.0002), new THREE.Vector2(rc, -H + 0.0002), new THREE.Vector2(rc * 0.5, -H + rc * REPOSE * 0.5), new THREE.Vector2(0.0001, -H + rc * REPOSE)]
  }
  const { s, c } = lowerShape(V)
  const R = innerR((H - s) / H) * 0.985
  const top = -(H - s) // world-ish y of the level at the glass
  const pts = [new THREE.Vector2(0.0001, -H + 0.0002)]
  for (let k = 0; k <= 24; k++) {
    const y = -H + (s * k) / 24
    pts.push(new THREE.Vector2(innerR(-y / H) * 0.985, y))
  }
  for (let k = 1; k <= 6; k++) pts.push(new THREE.Vector2(R * (1 - k / 6), top + (c * k) / 6))
  return pts
}

function walnutTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 1024
  const g = c.getContext('2d')
  const base = g.createLinearGradient(0, 0, 512, 0)
  base.addColorStop(0, '#5a3820')
  base.addColorStop(0.5, '#6b4428')
  base.addColorStop(1, '#583620')
  g.fillStyle = base
  g.fillRect(0, 0, 512, 1024)
  // long wavy grain lines and darker figure
  for (let k = 0; k < 140; k++) {
    const x = Math.random() * 512
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '35,18,8' : '120,80,45'},${0.08 + Math.random() * 0.18})`
    g.lineWidth = 0.6 + Math.random() * 2.4
    g.beginPath()
    g.moveTo(x, 0)
    const amp = 4 + Math.random() * 14
    for (let y = 0; y <= 1024; y += 32) g.lineTo(x + Math.sin(y / 140 + k) * amp, y)
    g.stroke()
  }
  for (let k = 0; k < 2500; k++) {
    g.fillStyle = `rgba(20,10,4,${Math.random() * 0.15})`
    g.fillRect(Math.random() * 512, Math.random() * 1024, 1, 3 + Math.random() * 6)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// a spindle turned on a lathe: beads, coves and a long taper
function spindleProfile(len) {
  const P = [
    [0, 0.0062], [0.03, 0.0062], [0.05, 0.0072], [0.075, 0.0055], [0.1, 0.0068], [0.12, 0.0068],
    [0.15, 0.0048], [0.32, 0.0058], [0.45, 0.0066], [0.5, 0.0068], [0.55, 0.0066], [0.68, 0.0058],
    [0.85, 0.0048], [0.88, 0.0068], [0.9, 0.0068], [0.925, 0.0055], [0.95, 0.0072], [0.97, 0.0062], [1, 0.0062],
  ]
  const pts = [new THREE.Vector2(0.0001, 0)]
  for (const [t, r] of P) pts.push(new THREE.Vector2(r, t * len))
  pts.push(new THREE.Vector2(0.0001, len))
  return pts
}
function plateProfile() {
  const r = PLATE_R
  const t = PLATE_T
  return [
    [0.0001, 0], [r - 0.006, 0], [r - 0.002, 0.0008], [r, 0.004], [r, t - 0.005], [r - 0.002, t - 0.001], [r - 0.007, t],
    [0.034, t], [0.034, t + COLLAR_H], [0.031, t + COLLAR_H + 0.001], [0.0001, t + COLLAR_H + 0.001],
  ].map(([a, b]) => new THREE.Vector2(a, b))
}

export default function Hourglass({ duration = 60, sand = '#c9a24b', wood = 1, glassTint = '#ffffff', sound = false, flipKey = 0, onTime, onPointerFlip }) {
  const turn = useRef()
  const upper = useRef()
  const lower = useRef()
  const stream = useRef()
  const grains = useRef()
  const audio = useRef(null)
  const total = useMemo(() => volTo(H) * 0.62, []) // sand fills about 62% of one bulb
  const st = useRef({ up: total, down: 0, angle: 0, vel: 0, target: 0, flipping: false, settle: 0, drained: total })

  const walnut = useMemo(() => walnutTexture(), [])
  const woodMat = useMemo(() => new THREE.MeshPhysicalMaterial({ map: walnut, roughness: 0.42, clearcoat: 0.65, clearcoatRoughness: 0.28, color: new THREE.Color(1, 1, 1).multiplyScalar(wood) }), [walnut, wood])
  const glassMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: glassTint, transmission: 1, thickness: 0.004, ior: 1.5, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, specularIntensity: 1, envMapIntensity: 1.2 }),
    [glassTint],
  )
  const sandMat = useMemo(() => new THREE.MeshStandardMaterial({ color: sand, roughness: 0.95, side: THREE.DoubleSide }), [sand])

  const glassGeo = useMemo(() => {
    const pts = []
    for (let k = 0; k <= 80; k++) {
      const y = -H + (2 * H * k) / 80
      pts.push(new THREE.Vector2(bulbR(Math.abs(y) / H), y))
    }
    return new THREE.LatheGeometry(pts, 96)
  }, [])
  const spindleGeo = useMemo(() => {
    const g = new THREE.LatheGeometry(spindleProfile(2 * HALF), 28)
    g.translate(0, -HALF, 0)
    return g
  }, [])
  const plateGeo = useMemo(() => new THREE.LatheGeometry(plateProfile(), 96), [])

  useEffect(() => () => audio.current?.dispose(), [])
  // the Flip button
  useEffect(() => {
    if (flipKey) flip()
  }, [flipKey])
  const flip = () => {
    const s = st.current
    if (s.flipping) return
    s.flipping = true
    s.target = s.angle + Math.PI
    s.vel = 0
  }

  // grains in the stream: a handful of instanced specks falling freely
  const GRAINS = 70
  const grainState = useMemo(() => Array.from({ length: GRAINS }, () => ({ y: -Math.random() * H, v: 0, x: 0, z: 0 })), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta)
    const s = st.current
    // turning over: a hand gives it a swing, a damped spring settles it
    if (s.flipping) {
      s.vel += ((s.target - s.angle) * 60 - s.vel * 11) * dt
      s.angle += s.vel * dt
      if (Math.abs(s.target - s.angle) < 0.002 && Math.abs(s.vel) < 0.02) {
        s.angle = 0
        s.target = 0
        s.flipping = false
        // what was below is now above; it slumps down into the neck
        const t = s.up
        s.up = s.down
        s.down = t
        s.settle = 0.35
        s.drained = 0
        audio.current?.knock()
      }
    }
    turn.current.rotation.x = s.angle
    // it is lifted a little while it turns, so the plates clear the table
    turn.current.position.y = Math.abs(Math.sin(s.angle)) * 0.03
    // flow: constant rate while upright, falling off as it tips
    const tilt = Math.abs(Math.cos(s.angle))
    const flowing = !s.flipping && s.settle <= 0 && s.up > 0
    s.settle = Math.max(0, s.settle - dt)
    if (flowing) {
      const q = (total / duration) * Math.min(1, Math.max(0, (tilt - 0.64) / 0.3)) * dt
      const m = Math.min(q, s.up)
      s.up -= m
      s.down += m
      s.drained += m
    }
    if (sound) {
      if (!audio.current) audio.current = createSandAudio()
      audio.current?.hiss(flowing ? 1 : 0)
    } else audio.current?.hiss(0)
    onTime?.((s.up / total) * duration, flowing)

    // rebuild the sand surfaces (cheap lathes)
    const pu = upperProfile(s.up, Math.min(1, s.drained / (total * 0.08)))
    upper.current.visible = !!pu
    if (pu) {
      upper.current.geometry.dispose()
      upper.current.geometry = new THREE.LatheGeometry(pu, 48)
    }
    const pl = lowerProfile(s.down)
    lower.current.visible = !!pl
    let pileTop = -H
    if (pl) {
      lower.current.geometry.dispose()
      lower.current.geometry = new THREE.LatheGeometry(pl, 48)
      pileTop = pl[pl.length - 1].y
    }
    // the stream: from the neck straight down onto the pile
    const len = Math.max(0.001, -pileTop)
    stream.current.visible = flowing
    stream.current.scale.set(1, len, 1)
    stream.current.position.y = -len / 2
    // falling grains: free fall from the neck, so they speed up and spread
    // out lower down (the stream thins as it accelerates)
    grains.current.visible = flowing
    if (flowing) {
      grainState.forEach((gr, k) => {
        gr.v += 9.81 * dt
        gr.y -= gr.v * dt
        if (gr.y < pileTop) {
          gr.y = -Math.random() * 0.004
          gr.v = 0.05 + Math.random() * 0.1
          gr.x = (Math.random() - 0.5) * 0.0012
          gr.z = (Math.random() - 0.5) * 0.0012
        }
        dummy.position.set(gr.x, gr.y, gr.z)
        dummy.updateMatrix()
        grains.current.setMatrixAt(k, dummy.matrix)
      })
      grains.current.instanceMatrix.needsUpdate = true
    }
  })

  const posts = [0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 6
    return [Math.cos(a) * 0.058, 0, Math.sin(a) * 0.058]
  })
  return (
    <group position={[0, HALF + PLATE_T, 0]}>
      <group
        ref={turn}
        onClick={(e) => {
          e.stopPropagation()
          flip()
          onPointerFlip?.()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        {/* plates: the bottom one, and the top one turned over */}
        <mesh geometry={plateGeo} material={woodMat} position={[0, -HALF - PLATE_T, 0]} castShadow receiveShadow />
        <mesh geometry={plateGeo} material={woodMat} position={[0, HALF + PLATE_T, 0]} rotation-x={Math.PI} castShadow receiveShadow />
        {posts.map((p, k) => (
          <mesh key={k} geometry={spindleGeo} material={woodMat} position={p} castShadow receiveShadow />
        ))}
        {/* sand, then the glass over it */}
        <mesh ref={upper} material={sandMat} castShadow>
          <bufferGeometry />
        </mesh>
        <mesh ref={lower} material={sandMat} castShadow>
          <bufferGeometry />
        </mesh>
        <mesh ref={stream} material={sandMat}>
          <cylinderGeometry args={[0.0007, 0.0005, 1, 8]} />
        </mesh>
        <instancedMesh ref={grains} args={[null, null, GRAINS]} material={sandMat}>
          <sphereGeometry args={[0.00045, 5, 4]} />
        </instancedMesh>
        <mesh geometry={glassGeo} material={glassMat} renderOrder={2} />
      </group>
    </group>
  )
}

export const HOURGLASS_HEIGHT = 2 * (HALF + PLATE_T)
