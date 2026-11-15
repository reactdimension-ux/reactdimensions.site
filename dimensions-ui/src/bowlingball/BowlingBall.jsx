import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A drilled tenpin bowling ball at real size and weight: 8.5 in (216 mm)
// across, 15 lb (6.8 kg), in a reactive-resin coverstock of swirled pearl
// with a fine glitter of metallic flake under a high-gloss polish.
//
// The grip is drilled, not painted: two finger holes side by side and the
// thumb hole below them, each a real bore with a dark inside, a floor, and a
// rounded, slightly raised lip at its mouth. The skin is cut away inside each
// mouth per pixel in the shader, so the openings stay perfectly round.
//
// Physics: a solid sphere on a hard maple floor. It hardly bounces, slides
// when it is first rolled until friction at the contact patch turns the slide
// into a roll (a ball rolled with side spin hooks as it does), rolls a long
// way on very little resistance, and a spin on the spot dies away slowly.

const R = 0.1085
const M = 6.8
const I = 0.4 * M * R * R
const G = 9.81
const E = 0.12 // restitution on maple
const MU = 0.2 // resin on a lightly oiled floor
const ROLL = 0.05 // rolling resistance, m/s²
const SPIN_DRAG = 0.18 // how fast a spin on the spot dies, 1/s

export const BALL_COLORS = {
  sapphire: ['#061040', '#0d2384', '#2a4cc4', '#8fa8f2'],
  cosmic: ['#0e1a4a', '#3b1d73', '#6a5ad8', '#c9c2ff'],
  ruby: ['#3a0610', '#8a1024', '#d23a46', '#ffc2b8'],
  onyx: ['#0b0b0e', '#2a2a31', '#6a6a78', '#e6e6ee'],
  emerald: ['#04261c', '#0d5a3e', '#2fa77a', '#d4ffe9'],
  amber: ['#3a1a02', '#9a4a06', '#e08a1e', '#ffe2a8'],
}

// The grip. dir is the hole's axis from the ball's centre (the holes face +z,
// fingers above the thumb), a its bore radius, depth how far it goes in, lip
// the tube radius of the rounded edge round its mouth.
const HOLES = [
  { dir: [-0.19, 0.5, 0.845], a: 0.0115, depth: 0.062, lip: 0.0026 },
  { dir: [0.19, 0.5, 0.845], a: 0.0115, depth: 0.062, lip: 0.0026 },
  { dir: [0, -0.56, 0.83], a: 0.0145, depth: 0.07, lip: 0.003 },
].map((h) => {
  const dir = new THREE.Vector3(...h.dir).normalize()
  // where the bore meets the sphere, measured along the axis
  const mouth = Math.sqrt(R * R - h.a * h.a)
  return { ...h, dir, mouth, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir) }
})

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

// The coverstock: domain-warped swirls, seamless round the ball, in four
// shades of the colour, with bright flake scattered through it.
function coverMap(cols, flake) {
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
  const r = rng(5)
  for (let i = 0; i < 5200 * flake; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '210,225,255' : '255,255,255'},${0.25 + r() * 0.5})`
    g.fillRect(r() * W, r() * H, 1, 1)
  }
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  return map
}

// Discard the ball's skin inside each hole's mouth, worked out from the
// position on the sphere, so the openings are crisp at any resolution.
function holeCut(mat, on) {
  const uHoles = { value: HOLES.map((h) => new THREE.Vector4(h.dir.x, h.dir.y, h.dir.z, on ? h.mouth / R : 2)) }
  mat.onBeforeCompile = (s) => {
    s.uniforms.uHoles = uHoles
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBallLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBallLocal = position;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vBallLocal;\nuniform vec4 uHoles[${HOLES.length}];`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nvec3 bl = normalize(vBallLocal);\nfor (int i = 0; i < ${HOLES.length}; i++) if (dot(bl, uHoles[i].xyz) > uHoles[i].w) discard;`)
  }
  mat.customProgramCacheKey = () => 'bowling-ball-holes'
  return { mat, uHoles }
}

// ball: the coverstock colour. flake: how much glitter is in it. drilled:
// with the grip, or a blank. rollKey, spinKey: bump these to roll or spin it.
// follow: the camera keeps the ball in view.
export default function BowlingBall({ ball = 'sapphire', flake = 0.5, drilled = true, rollKey = 0, spinKey = 0, follow = true }) {
  const group = useRef()
  const { controls } = useThree()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const cols = BALL_COLORS[ball] || BALL_COLORS.sapphire

  // ---- geometry, textures, materials ----
  const geo = useMemo(
    () => ({
      sphere: new THREE.SphereGeometry(R, 128, 96),
      holes: HOLES.map((h) => ({
        bore: new THREE.CylinderGeometry(h.a, h.a, h.depth, 40, 1, true),
        floor: new THREE.CircleGeometry(h.a, 40).rotateX(-Math.PI / 2),
        lip: new THREE.TorusGeometry(h.a + h.lip, h.lip, 16, 64).rotateX(Math.PI / 2),
      })),
    }),
    [],
  )
  useEffect(
    () => () => {
      geo.sphere.dispose()
      geo.holes.forEach((h) => Object.values(h).forEach((x) => x.dispose()))
    },
    [geo],
  )
  const map = useMemo(() => coverMap(cols, flake), [cols, flake])
  useEffect(() => () => map.dispose(), [map])
  const mats = useMemo(() => {
    const cut = holeCut(new THREE.MeshPhysicalMaterial({ roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.15, iridescenceIOR: 1.4 }), true)
    return {
      cover: cut.mat,
      uHoles: cut.uHoles,
      // the polished lip of each hole: the same resin, its colour averaged
      lip: new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }),
      // inside the holes: a dull, shadowed bore
      bore: new THREE.MeshStandardMaterial({ color: '#0a0c14', roughness: 0.7, side: THREE.BackSide }),
      floor: new THREE.MeshStandardMaterial({ color: '#030308', roughness: 0.9 }),
    }
  }, [])
  useEffect(() => () => ['cover', 'lip', 'bore', 'floor'].forEach((k) => mats[k].dispose()), [mats])
  useEffect(() => {
    mats.cover.map = map
    mats.cover.needsUpdate = true
    mats.lip.color.set(cols[1]).lerp(new THREE.Color(cols[2]), 0.35)
  }, [mats, map, cols])
  useEffect(() => {
    // a blank: push the cut-off past the sphere so nothing is discarded
    mats.uHoles.value.forEach((v, i) => (v.w = drilled ? HOLES[i].mouth / R : 2))
  }, [mats, drilled])

  // ---- motion ----
  const s = useRef({
    p: new THREE.Vector3(0, R, 0),
    v: new THREE.Vector3(),
    w: new THREE.Vector3(),
    // the grip square on to the camera's opening view (see the scene), so the
    // holes read as they do in a product photo: fingers level, thumb centred
    // below them, nothing foreshortened
    q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.12, 0.26 - R, 0.78).normalize()),
  })
  const tmp = useMemo(() => ({ u: new THREE.Vector3(), j: new THREE.Vector3(), rc: new THREE.Vector3(0, -R, 0), dq: new THREE.Quaternion() }), [])

  // rolled out away from the middle, released skidding with side roll so it
  // hooks back as the floor grips it
  const roll = () => {
    const st = s.current
    const a = Math.atan2(-st.p.x, -st.p.z) + (Math.random() - 0.5) * 1.2
    const sp = 1.3 + Math.random() * 0.5
    st.v.set(Math.sin(a) * sp, 0, Math.cos(a) * sp)
    // forward roll for about a third of the speed, plus spin about the
    // direction of travel (that is what bends its path)
    const fwd = tmp.j.set(Math.cos(a), 0, -Math.sin(a)).multiplyScalar((sp / R) * 0.35)
    st.w.copy(fwd).addScaledVector(tmp.u.set(Math.sin(a), 0, Math.cos(a)), (Math.random() < 0.5 ? -1 : 1) * 14)
  }
  // spun on the spot like on a ball return
  const spin = () => {
    const st = s.current
    st.w.set((Math.random() - 0.5) * 0.6, 26, (Math.random() - 0.5) * 0.6)
  }
  useEffect(() => void (rollKey && roll()), [rollKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => void (spinKey && spin()), [spinKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta)
    const st = s.current
    const n = 10
    const h = dt / n
    for (let i = 0; i < n; i++) {
      st.v.y -= G * h
      st.p.addScaledVector(st.v, h)
      if (st.p.y < R) {
        st.p.y = R
        if (st.v.y < 0) {
          const vn = -st.v.y
          st.v.y = vn > 0.3 ? vn * E : 0
        }
      }
      if (st.p.y <= R + 1e-5 && Math.abs(st.v.y) < 1e-3) {
        // sliding: friction at the contact patch drives it towards rolling
        tmp.u.crossVectors(st.w, tmp.rc).add(st.v)
        tmp.u.y = 0
        const slip = tmp.u.length()
        if (slip > 1e-4) {
          const dv = Math.min(MU * G * h, slip * (2 / 7))
          tmp.j.copy(tmp.u).multiplyScalar((-dv * M) / slip)
          st.v.addScaledVector(tmp.j, 1 / M)
          st.w.addScaledVector(tmp.u.crossVectors(tmp.rc, tmp.j), 1 / I)
        }
        // rolling resistance, and the slow decay of a spin about the vertical
        const sp = Math.hypot(st.v.x, st.v.z)
        if (sp > 0) {
          const k = Math.max(0, sp - ROLL * h) / sp
          st.v.x *= k
          st.v.z *= k
          st.w.x *= k
          st.w.z *= k
        }
        st.w.y *= Math.exp(-SPIN_DRAG * h)
        if (Math.abs(st.w.y) < 0.3) st.w.y *= Math.exp(-4 * h)
      }
      const wl = st.w.length()
      if (wl > 1e-6) {
        tmp.dq.setFromAxisAngle(tmp.u.copy(st.w).divideScalar(wl), wl * h)
        st.q.premultiply(tmp.dq)
      }
    }
    st.q.normalize()
    // a shallow dish keeps it on the floor in front of you: past a metre out
    // it is drawn gently back, and it slows as it comes
    const d = Math.hypot(st.p.x, st.p.z)
    if (d > 1) {
      const pull = (d - 1) * 6 * dt
      st.v.x -= (st.p.x / d) * pull
      st.v.z -= (st.p.z / d) * pull
      st.v.x *= Math.exp(-0.8 * dt)
      st.v.z *= Math.exp(-0.8 * dt)
    }
    group.current.position.copy(st.p)
    group.current.quaternion.copy(st.q)
    if (follow && controls) {
      controls.target.lerp(tmp.u.set(st.p.x, R, st.p.z), 1 - Math.exp(-5 * dt))
      controls.update()
    }
  })

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        spin()
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <mesh geometry={geo.sphere} material={mats.cover} castShadow />
      {drilled &&
        HOLES.map((h, i) => (
          <group key={i} quaternion={h.q}>
            <mesh geometry={geo.holes[i].bore} material={mats.bore} position-y={h.mouth - h.depth / 2} />
            <mesh geometry={geo.holes[i].floor} material={mats.floor} position-y={h.mouth - h.depth} />
            <mesh geometry={geo.holes[i].lip} material={mats.lip} position-y={Math.sqrt(R * R - (h.a + h.lip) ** 2) - h.lip * 0.35} castShadow />
          </group>
        ))}
    </group>
  )
}
