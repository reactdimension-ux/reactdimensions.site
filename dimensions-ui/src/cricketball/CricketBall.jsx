import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A cricket ball at real size and weight: 72 mm across, 160 g, cork and
// string inside polished leather.
//
// It is made the way a real one is: four quarters of leather stitched into
// two hemispheres, joined round the middle by the raised main seam, six rows
// of stitches (three each side) slanting across it, and a flat inside-
// stitched quarter seam on each half, turned 90 degrees to each other. A gold
// stamp sits on one side. With wear the two halves age differently, the way
// bowlers make them: one side kept shiny on a trouser leg, the other left
// rough and scuffed (that difference is what makes a ball swing).
//
// Physics: a solid sphere on a dry pitch. It bounces with a restitution of
// about 0.5, the pitch grips it at the contact point (so backspin kicks it
// back when it lands, and sliding turns into rolling), it rolls to a stop on
// rolling resistance, and a spin on the spot dies away on the seam's drag.

const R = 0.036
const M = 0.16
const I = 0.4 * M * R * R
const G = 9.81
const E = 0.5 // pitch restitution
const MU = 0.35 // leather on pitch
const ROLL = 0.55 // rolling resistance, m/s²

export const BALL_COLORS = { red: '#8a1712', white: '#ebe7dc', pink: '#e0508a' }
const THREAD = { red: '#efe6cf', white: '#4c535c', pink: '#1d1b1d' }

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

// colour and roughness maps. The sphere's equator (texture v = 0.5) is the
// main seam; the top half (canvas rows above the middle) is the shiny side.
function leatherMaps(color, thread, wear) {
  const W = 2048
  const H = 1024
  const col = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const rough = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = col.getContext('2d')
  const q = rough.getContext('2d')
  const r = rng(7)
  g.fillStyle = color
  g.fillRect(0, 0, W, H)
  // leather grain: fine mottling
  for (let i = 0; i < 60000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.035)'
    g.fillRect(r() * W, r() * H, 2, 2)
  }
  // shiny side: low roughness; rough side rougher, more so with wear
  q.fillStyle = `rgb(${46},${46},${46})`
  q.fillRect(0, 0, W, H / 2)
  const rr = Math.round(70 + wear * 110)
  q.fillStyle = `rgb(${rr},${rr},${rr})`
  q.fillRect(0, H / 2, W, H / 2)
  // wear: the rough side scuffed lighter and scratched; the shiny side
  // darkened by polish
  if (wear > 0) {
    g.fillStyle = `rgba(20,8,6,${0.1 * wear})`
    g.fillRect(0, 0, W, H / 2)
    for (let i = 0; i < 2600 * wear; i++) {
      const x = r() * W
      const y = H / 2 + 30 + r() * (H / 2 - 40)
      const a = r() * Math.PI
      const l = 6 + r() * 40
      g.strokeStyle = `rgba(235,200,170,${0.08 + r() * 0.2 * wear})`
      g.lineWidth = 0.8 + r() * 1.6
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5)
      g.stroke()
      q.strokeStyle = 'rgba(255,255,255,0.35)'
      q.lineWidth = 2
      q.beginPath()
      q.moveTo(x, y)
      q.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5)
      q.stroke()
    }
    for (let i = 0; i < 40 * wear; i++) {
      g.fillStyle = `rgba(230,195,165,${0.1 + 0.15 * wear})`
      g.beginPath()
      g.ellipse(r() * W, H / 2 + 60 + r() * (H / 2 - 120), 8 + r() * 30, 4 + r() * 14, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
  }
  // the main seam: a pressed channel either side of the raised stitching
  g.fillStyle = 'rgba(0,0,0,0.32)'
  g.fillRect(0, H / 2 - 5, W, 10)
  // the quarter seams: flat, stitched from inside, so just a fine line with
  // the stitch holes beside it; one on each half, 90 degrees apart
  for (const [x, y0, y1] of [[W * 0.25, 40, H / 2 - 50], [W * 0.5, H / 2 + 50, H - 40]]) {
    g.strokeStyle = 'rgba(0,0,0,0.38)'
    g.lineWidth = 2.5
    g.beginPath()
    g.moveTo(x, y0)
    g.lineTo(x, y1)
    g.stroke()
    for (let y = y0; y < y1; y += 9) {
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.fillRect(x - 7, y, 2.5, 2.5)
      g.fillRect(x + 5, y + 4, 2.5, 2.5)
    }
  }
  // a gold-foil maker's stamp on the shiny side, worn off with use
  g.save()
  g.translate(W * 0.75, H * 0.3)
  g.globalAlpha = 1 - wear * 0.75
  g.fillStyle = '#d9b45a'
  g.font = '700 46px Georgia, serif'
  g.textAlign = 'center'
  g.fillText('★  156 g  ★', 0, -30)
  g.font = '700 30px Georgia, serif'
  g.fillText('HAND STITCHED', 0, 22)
  g.font = '700 26px Georgia, serif'
  g.fillText('TEST GRADE', 0, 62)
  g.restore()

  const map = new THREE.CanvasTexture(col)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const rmap = new THREE.CanvasTexture(rough)
  return { map, rmap }
}

// the stitches: six rows round the equator, slanting across the seam
function seamStitches(thread) {
  const per = 84
  const rows = [-3.2, -2.1, -1.0, 1.0, 2.1, 3.2] // mm either side of the seam
  const geo = new THREE.CapsuleGeometry(0.00042, 0.0016, 3, 6)
  geo.rotateZ(Math.PI / 2) // lie along x
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: thread, roughness: 0.75 }), per * rows.length)
  const o = new THREE.Object3D()
  let n = 0
  for (const mm of rows) {
    const lat = (mm / 1000) / R
    for (let k = 0; k < per; k++) {
      const lon = (k / per) * Math.PI * 2 + (mm > 0 ? 0.02 : 0)
      const rr = R * 1.004
      o.position.set(rr * Math.cos(lat) * Math.cos(lon), rr * Math.sin(lat), -rr * Math.cos(lat) * Math.sin(lon))
      // tangent along the seam, then slanted
      o.lookAt(0, 0, 0)
      o.rotateZ(Math.PI / 2 + (mm > 0 ? 0.55 : -0.55))
      o.updateMatrix()
      mesh.setMatrixAt(n++, o.matrix)
    }
  }
  mesh.castShadow = true
  return mesh
}

export default function CricketBall({ ball = 'red', wear = 0.35, sound = false, tossKey = 0, spinKey = 0, follow = true }) {
  const group = useRef()
  const { controls } = useThree()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const color = BALL_COLORS[ball] || BALL_COLORS.red
  const thread = THREAD[ball] || THREAD.red
  const maps = useMemo(() => leatherMaps(color, thread, wear), [color, thread, wear])
  useEffect(() => () => (maps.map.dispose(), maps.rmap.dispose()), [maps])
  const stitches = useMemo(() => seamStitches(thread), [thread])
  useEffect(() => () => (stitches.geometry.dispose(), stitches.material.dispose()), [stitches])

  const s = useRef({
    p: new THREE.Vector3(0, R, 0),
    v: new THREE.Vector3(),
    w: new THREE.Vector3(),
    // seam upright, facing the camera at an angle
    q: new THREE.Quaternion().setFromEuler(new THREE.Euler(1.05, 0.2, 0.55)),
  })
  const tmp = useMemo(() => ({ u: new THREE.Vector3(), j: new THREE.Vector3(), rc: new THREE.Vector3(0, -R, 0), dq: new THREE.Quaternion(), up: new THREE.Vector3(0, 1, 0) }), [])

  // toss it up from the hand with backspin about the seam's axis, the
  // seam held upright (how a seam bowler releases it)
  const toss = () => {
    const st = s.current
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(st.q) // seam normal
    st.v.set((Math.random() - 0.5) * 0.1, 1.15 + Math.random() * 0.15, (Math.random() - 0.5) * 0.1)
    st.w.copy(axis).multiplyScalar(-(28 + Math.random() * 10))
    st.w.x += (Math.random() - 0.5) * 3
  }
  // spin it on the spot like a top
  const spin = () => {
    const st = s.current
    st.w.set(0, 70, 0)
    st.v.y = Math.max(st.v.y, 0.15)
  }
  useEffect(() => void (tossKey && toss()), [tossKey])
  useEffect(() => void (spinKey && spin()), [spinKey])

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta)
    const st = s.current
    const n = 10
    const h = dt / n
    for (let i = 0; i < n; i++) {
      st.v.y -= G * h
      st.p.addScaledVector(st.v, h)
      const onGround = st.p.y <= R + 1e-5
      if (st.p.y < R) {
        st.p.y = R
        if (st.v.y < 0) {
          const vn = -st.v.y
          st.v.y = vn > 0.25 ? vn * E : 0
          // grip at the contact point: an impulse that kills slip, capped by
          // friction (for a solid sphere 2/7 of the slip takes it to rolling)
          tmp.u.crossVectors(st.w, tmp.rc).add(st.v)
          tmp.u.y = 0
          const need = tmp.u.length() * M * (2 / 7)
          const cap = MU * M * vn * (1 + E)
          if (need > 1e-9) {
            tmp.j.copy(tmp.u).multiplyScalar(-Math.min(need, cap) / tmp.u.length())
            st.v.addScaledVector(tmp.j, 1 / M)
            st.w.addScaledVector(tmp.u.crossVectors(tmp.rc, tmp.j), 1 / I)
          }
        }
      }
      if (onGround && Math.abs(st.v.y) < 1e-3) {
        // sliding: friction drives it towards rolling
        tmp.u.crossVectors(st.w, tmp.rc).add(st.v)
        tmp.u.y = 0
        const slip = tmp.u.length()
        if (slip > 1e-4) {
          const dv = Math.min(MU * G * h, slip * (2 / 7))
          tmp.j.copy(tmp.u).multiplyScalar((-dv * M) / slip)
          st.v.addScaledVector(tmp.j, 1 / M)
          st.w.addScaledVector(tmp.u.crossVectors(tmp.rc, tmp.j), 1 / I)
        }
        // rolling resistance, and the seam dragging on a spin about the vertical
        const sp = Math.hypot(st.v.x, st.v.z)
        if (sp > 0) {
          const k = Math.max(0, sp - ROLL * h) / sp
          st.v.x *= k
          st.v.z *= k
          st.w.x *= k
          st.w.z *= k
        }
        st.w.y *= Math.exp(-0.45 * h)
        if (Math.abs(st.w.y) < 0.4) st.w.y *= Math.exp(-6 * h)
      }
      // integrate the orientation
      const wl = st.w.length()
      if (wl > 1e-6) {
        tmp.dq.setFromAxisAngle(tmp.u.copy(st.w).divideScalar(wl), wl * h)
        st.q.premultiply(tmp.dq)
      }
    }
    st.q.normalize()
    // keep it on the strip
    if (Math.hypot(st.p.x, st.p.z) > 0.9) {
      st.v.x -= st.p.x * 4 * dt
      st.v.z -= st.p.z * 4 * dt
    }
    group.current.position.copy(st.p)
    group.current.quaternion.copy(st.q)
    // the camera keeps half an eye on it
    if (follow && controls) {
      controls.target.lerp(tmp.u.set(st.p.x, R + (st.p.y - R) * 0.85, st.p.z), 1 - Math.exp(-9 * dt))
      controls.update()
    }
  })

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        toss()
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <mesh castShadow>
        <sphereGeometry args={[R, 96, 64]} />
        <meshPhysicalMaterial map={maps.map} roughnessMap={maps.rmap} roughness={1} clearcoat={0.55 - wear * 0.35} clearcoatRoughnessMap={maps.rmap} clearcoatRoughness={1} />
      </mesh>
      {/* the raised seam the stitches sit on */}
      <mesh rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[R * 0.996, 0.0016, 10, 160]} />
        <meshPhysicalMaterial color={color} roughness={0.5} clearcoat={0.6} />
      </mesh>
      <primitive object={stitches} />
    </group>
  )
}
