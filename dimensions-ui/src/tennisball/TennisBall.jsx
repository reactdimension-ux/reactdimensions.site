import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createBall, stepBall } from './physics.js'
import { createBallAudio } from './audio.js'

// A tennis ball at regulation size and weight: 67 mm across, 57.7 g, a
// pressurised rubber core under two dumbbell-shaped pieces of optic-yellow
// felt.
//
// The felt is real fuzz, not a texture: twenty shells stacked a millimetre
// and a half deep, each keeping only the fibres that reach that high, so
// the surface is dense near the core and wispy at the tips, and the
// silhouette is soft. The fibres stand on the sphere (each one is the same
// spot on every shell, leaning a little as it rises), so they read as nap,
// not noise. The white seam is the classic tennis-ball curve,
//   x = a cos t + b cos 3t,  y = a sin t - b sin 3t,  z = 2 sqrt(ab) sin 2t,
// which lies exactly on the sphere when a + b = 1; the felt stops short of
// it with a bevelled edge. The React Dimensions mark is printed in the
// middle of one felt panel, inked into the fibres.
//
// The physics is the football's (see physics.js), retuned for a tennis
// ball: real drag and Magnus lift (topspin dips, slice floats), a bounce
// that passes the ITF drop test (from 254 cm it should come back up 135 to
// 147 cm), grip at the contact point that turns topspin into a kick
// forward off the bounce, and court surfaces that play differently.

// the React Dimensions mark (kept inline so the component is self-contained)
const R_PATH =
  'M168 320 L172 186 L130 172 C150 100 270 42 370 44 C440 46 472 80 462 120 C452 160 380 194 270 236 ' +
  'L376 322 L378 342 L242 344 L240 302 L228 308 L226 318 Z ' +
  'M230 198 L233 150 C254 122 300 102 346 104 C384 106 412 116 422 128 C428 136 420 142 404 147 Z'

const R = 0.0335
const M = 0.0577
const NAP = 0.0015 // felt depth
const SHELLS = 20
const SEAM_A = 0.73
const SEAM_B = 0.27
const SEAM_W = 0.0017 // half width of the bare seam, m
const DROP_H = 2.54 // ITF drop-test height

// court surfaces: how they bounce and grip (ITF pace: clay slow and high,
// grass fast and low)
export const SURFACES = {
  hard: { e: 1, mu: 0.6, crr: 0.03 },
  clay: { e: 1.02, mu: 0.82, crr: 0.06 },
  grass: { e: 0.9, mu: 0.42, crr: 0.04 },
}

// the seam, on the unit sphere
function seamPoints(n) {
  const c = 2 * Math.sqrt(SEAM_A * SEAM_B)
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2
    return new THREE.Vector3(SEAM_A * Math.cos(t) + SEAM_B * Math.cos(3 * t), SEAM_A * Math.sin(t) - SEAM_B * Math.sin(3 * t), c * Math.sin(2 * t))
  })
}

// the sphere, with each vertex's distance to the seam (m) baked in, and the
// middle of a felt panel for the print
function buildBall() {
  const geo = new THREE.SphereGeometry(R, 192, 128)
  const seam = seamPoints(720)
  const p = geo.attributes.position
  const dist = new Float32Array(p.count)
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize()
    let best = 9
    for (const s of seam) {
      const dx = v.x - s.x
      const dy = v.y - s.y
      const dz = v.z - s.z
      const d = dx * dx + dy * dy + dz * dz
      if (d < best) best = d
    }
    dist[i] = Math.sqrt(best) * R
  }
  geo.setAttribute('seam', new THREE.BufferAttribute(dist, 1))
  // panel centre: the direction furthest from the seam
  let centre = new THREE.Vector3(0, 0, 1)
  let far = -1
  const N = 900
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N
    const r = Math.sqrt(1 - y * y)
    const a = i * Math.PI * (3 - Math.sqrt(5))
    v.set(Math.cos(a) * r, y, Math.sin(a) * r)
    let best = 9
    for (const s of seam) best = Math.min(best, v.distanceToSquared(s))
    if (best > far && v.z > 0) {
      far = best
      centre = v.clone()
    }
  }
  const e1 = new THREE.Vector3(0, 1, 0).cross(centre).normalize()
  const e2 = centre.clone().cross(e1).normalize()
  return { geo, centre, e1, e2 }
}

// the printed mark: black on transparent
function printTexture() {
  const S = 512
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const s = 0.95
  g.save()
  g.setTransform(s, 0, 0, s, S / 2 - 298 * s, S * 0.42 - 193 * s)
  g.fillStyle = '#000'
  g.fill(new Path2D(R_PATH), 'evenodd')
  g.restore()
  g.save()
  g.translate(S / 2, S * 0.83)
  g.fillStyle = '#000'
  g.font = '800 36px Inter, Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('DIMENSIONS  1', 0, 0)
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  return t
}

// shared GLSL: fibre noise, the seam and the print
const GLSL = /* glsl */ `
uniform float uLayer;
uniform float uSeamW;
uniform float uFreq;
uniform vec3 uSeamColor;
uniform vec3 uInk;
uniform float uBrand;
uniform sampler2D uPrint;
uniform vec3 uPC;
uniform vec3 uPE1;
uniform vec3 uPE2;
varying float vSeam;
varying vec3 vDir;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fibre(vec3 d) {
  vec3 p = d * uFreq;
  // fibres lean and curl a little as they rise
  p += uLayer * 0.7 * vec3(sin(p.y * 0.37), cos(p.z * 0.41), sin(p.x * 0.29));
  return vnoise(p) * 0.62 + vnoise(p * 2.7) * 0.38;
}
float printInk(vec3 d) {
  if (uBrand < 0.5 || dot(d, uPC) < 0.6) return 0.0;
  vec2 uv = vec2(dot(d, uPE1), dot(d, uPE2)) / 0.34 * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture2D(uPrint, uv).a;
}
`

function patch(mat, uniforms, shell) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = 'attribute float seam;\nvarying float vSeam;\nvarying vec3 vDir;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeam = seam;\nvDir = normalize(position);')
    let f = GLSL + sh.fragmentShader
    if (shell) {
      f = f.replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float fb = fibre(vDir);
        if (fb < 0.3 + 0.46 * uLayer) discard;
        // the felt is cut back from the seam, the tips more than the roots
        if (vSeam < uSeamW * (1.12 + 0.55 * uLayer)) discard;`,
      )
      f = f.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // deeper fibres sit in the shadow of the ones above
        diffuseColor.rgb *= mix(0.42, 1.08, uLayer) * (0.86 + 0.28 * fb);
        diffuseColor.rgb = mix(diffuseColor.rgb, uInk, printInk(vDir) * 0.9);`,
      )
    } else {
      f = f.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float bare = 1.0 - smoothstep(uSeamW * 0.92, uSeamW * 1.12, vSeam);
        diffuseColor.rgb *= 0.55 + 0.45 * vnoise(vDir * uFreq * 1.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, uInk, printInk(vDir) * 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSeamColor, bare);`,
      )
      f = f.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.45, 1.0 - smoothstep(uSeamW * 0.92, uSeamW * 1.12, vSeam));`,
      )
    }
    sh.fragmentShader = f
  }
  mat.customProgramCacheKey = () => (shell ? 'tennis-felt-shell' : 'tennis-felt-core')
  return mat
}

export default function TennisBall({
  felt = '#d6ea2a',
  seam = '#f1f1ea',
  ink = '#161616',
  brand = true,
  surface = 'hard',
  pressure = 1,
  power = 9,
  spin = 'topspin',
  sound = false,
  follow = true,
  hitKey = 0,
  dropKey = 0,
  onReport,
}) {
  const outer = useRef()
  const inner = useRef()
  const { camera, controls, gl } = useThree()
  const audio = useRef(null)

  const model = useMemo(() => buildBall(), [])
  const print = useMemo(() => printTexture(), [])
  useEffect(() => () => (model.geo.dispose(), print.dispose()), [model, print])

  // uniforms shared by the core and every shell (uLayer is per shell)
  const shared = useMemo(
    () => ({
      uSeamW: { value: SEAM_W },
      uFreq: { value: 105 },
      uSeamColor: { value: new THREE.Color(seam) },
      uInk: { value: new THREE.Color(ink) },
      uBrand: { value: 1 },
      uPrint: { value: print },
      uPC: { value: model.centre },
      uPE1: { value: model.e1 },
      uPE2: { value: model.e2 },
    }),
    [print, model],
  )
  shared.uSeamColor.value.set(seam)
  shared.uInk.value.set(ink)
  shared.uBrand.value = brand ? 1 : 0

  const mats = useMemo(() => {
    const core = patch(new THREE.MeshPhysicalMaterial({ color: felt, roughness: 1, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color('#fbffd0') }), { ...shared, uLayer: { value: 0 } }, false)
    const shells = Array.from({ length: SHELLS }, (_, i) => patch(new THREE.MeshStandardMaterial({ color: felt, roughness: 1 }), { ...shared, uLayer: { value: (i + 1) / SHELLS } }, true))
    return { core, shells }
  }, [shared])
  useEffect(() => {
    mats.core.color.set(felt)
    mats.shells.forEach((m) => m.color.set(felt))
  }, [felt, mats])
  useEffect(() => () => (mats.core.dispose(), mats.shells.forEach((m) => m.dispose())), [mats])

  const ball = useMemo(() => {
    const b = createBall({ r: R, m: M, y: R, k: 0.6 })
    // rest with the printed panel turned to the camera, seam curling round it
    b.q.setFromUnitVectors(model.centre, new THREE.Vector3(-0.35, 0.3, 1).normalize())
    return b
  }, [model])
  const test = useRef(null) // the drop test in progress

  useEffect(() => {
    if (!sound) return
    if (!audio.current) audio.current = createBallAudio()
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])

  const S = SURFACES[surface] || SURFACES.hard
  const P = useMemo(() => ({ g: 9.81, Cd: 0.55, Cl: 0.75, e0: 0.79 * S.e * (0.72 + 0.28 * pressure), mu: S.mu, crr: S.crr }), [S, pressure])
  const walls = useMemo(
    () => [
      { n: new THREE.Vector3(0, 1, 0), d: 0, kind: 'floor' },
      { n: new THREE.Vector3(0, 0, 1), d: -3.2, kind: 'wall' },
      { n: new THREE.Vector3(0, 0, -1), d: -2.4, kind: 'wall' },
      { n: new THREE.Vector3(1, 0, 0), d: -3.6, kind: 'wall' },
      { n: new THREE.Vector3(-1, 0, 0), d: -3.6, kind: 'wall' },
    ],
    [],
  )

  // a racket stroke: speed along dir, spin from the stroke type
  const stroke = (dir, spinAxis, rate, speed) => {
    ball.held = null
    test.current = null
    ball.v.copy(dir).multiplyScalar(speed)
    ball.w.copy(spinAxis).multiplyScalar(rate)
    ball.w.clampLength(0, 320)
    if (sound) (audio.current || (audio.current = createBallAudio()))?.hit(speed / 18)
  }
  useEffect(() => {
    if (!hitKey) return
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const lift = spin === 'slice' ? 0.42 : spin === 'flat' ? 0.5 : 0.62
    const dir = fwd.clone().multiplyScalar(0.8).add(up.clone().multiplyScalar(lift)).normalize()
    // topspin turns the top of the ball forward; slice turns it back
    const axis = new THREE.Vector3().crossVectors(up, fwd).normalize()
    const rate = spin === 'topspin' ? 200 : spin === 'slice' ? -120 : 15
    stroke(dir, axis, rate * (0.9 + Math.random() * 0.2), power * (0.92 + Math.random() * 0.16))
  }, [hitKey])

  // the ITF drop test: from 254 cm onto a hard floor
  useEffect(() => {
    if (!dropKey) return
    ball.held = null
    ball.p.set(0, DROP_H + R, 0)
    ball.v.set(0, 0, 0)
    ball.w.set(0, 0, 0)
    test.current = { phase: 'fall', top: 0 }
    onReport?.(null)
  }, [dropKey])

  // pointer: tap = stroke away from where you touched, with spin from how
  // far off-centre; drag = pick it up and throw it
  const drag = useRef(null)
  const onDown = (e) => {
    e.stopPropagation()
    const n = new THREE.Vector3()
    camera.getWorldDirection(n)
    drag.current = { t: performance.now(), x: e.clientX, y: e.clientY, hit: e.point.clone(), plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n.negate(), ball.p.clone()), grabOff: ball.p.clone().sub(e.point), hist: [], moved: false }
    gl.domElement.setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
  }
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const tmp = new THREE.Vector3()
    const move = (e) => {
      const d = drag.current
      if (!d) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true
      if (!d.moved) return
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (ray.ray.intersectPlane(d.plane, tmp)) {
        const target = tmp.clone().add(d.grabOff)
        target.y = Math.max(R, target.y)
        ball.held = { target }
        test.current = null
        d.hist.push({ t: performance.now(), p: target.clone() })
        if (d.hist.length > 8) d.hist.shift()
      }
    }
    const up = () => {
      const d = drag.current
      if (!d) return
      drag.current = null
      if (controls) controls.enabled = true
      if (!d.moved && performance.now() - d.t < 350) {
        const off = d.hit.clone().sub(ball.p)
        const dir = ball.p.clone().sub(d.hit).normalize()
        dir.y = Math.max(dir.y, 0) + 0.45
        dir.normalize()
        const axis = new THREE.Vector3().crossVectors(off, dir)
        const rate = (axis.length() / R) * 260
        stroke(dir, axis.normalize(), rate, power)
        return
      }
      const h = d.hist
      if (h.length >= 2) {
        const a = h[0]
        const b = h[h.length - 1]
        const dt = Math.max(0.016, (b.t - a.t) / 1000)
        ball.v.copy(b.p).sub(a.p).multiplyScalar(1 / dt).clampLength(0, 25)
      }
      ball.held = null
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [camera, controls, gl, power])

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta)
    const STEPS = Math.ceil(dt / (1 / 600))
    for (let s = 0; s < STEPS; s++) {
      stepBall(ball, dt / STEPS, P, walls, (speed, kind) => {
        const t = test.current
        if (t && kind === 'floor' && t.phase === 'fall') t.phase = 'rise'
        if (sound) (audio.current || (audio.current = createBallAudio()))?.bounce(speed / 7, kind)
      })
      const t = test.current
      if (t && t.phase === 'rise') {
        t.top = Math.max(t.top, ball.p.y - R)
        if (ball.v.y < 0 && ball.p.y > R * 2) {
          onReport?.(t.top)
          test.current = null
        }
      }
    }
    // the core squashes against the court, flattening and widening
    const sq = ball.p.y < R * 1.15 ? Math.max(0, ball.squash) : 0
    outer.current.position.set(ball.p.x, ball.p.y - sq * R, ball.p.z)
    outer.current.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5)
    inner.current.quaternion.copy(ball.q)
    if (follow && controls && !drag.current) {
      const goal = new THREE.Vector3(ball.p.x, Math.min(2.6, ball.p.y * 0.85 + 0.01), ball.p.z)
      const step = goal.sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 2.6))
      controls.target.add(step)
      camera.position.add(step)
    }
  })

  return (
    <group ref={outer}>
      <group ref={inner}>
        <mesh geometry={model.geo} material={mats.core} castShadow receiveShadow onPointerDown={onDown} />
        {mats.shells.map((m, i) => (
          <mesh key={i} geometry={model.geo} material={m} scale={1 + (NAP / R) * ((i + 1) / SHELLS)} />
        ))}
      </group>
    </group>
  )
}
