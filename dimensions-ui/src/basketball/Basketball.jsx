import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createBall, stepBall } from './physics.js'
import { createBallAudio } from './audio.js'

// An 8-panel basketball. The black rubber channels follow the classic
// layout: one round the equator, one great circle over the top at right
// angles to it, and two curved seams that loop round the left and right
// sides (seen face-on they're tall ovals reaching nearly to the poles;
// side-on they look like a pair of brackets). The channels are real grooves
// cut into the surface, and the orange rubber is covered in thousands of
// small raised pebbles, worked out in the shader so they're evenly spread
// with no seams. A valve sits in one panel.
//
// Real size and weight (size 7: 24 cm across, 620 g) and real physics (see
// physics.js): it bounces back to about 70% of its drop height on a hard
// floor, as regulations require. Tap to slap it, drag to throw it (throws
// leave the hand with backspin, as a shot does), or dribble it.

export const R = 0.12 // metres
const M = 0.62 // kg
const LOOP_A = 0.74 // the curved seams: half-width of the oval...
const LOOP_B = 0.97 // ...and half-height, on the unit sphere

// angular-ish distance from a point on the unit sphere to the nearest seam
function seamDistance(u) {
  const dEq = Math.abs(u.y)
  const dMer = Math.abs(u.x)
  const f = (u.z / LOOP_A) ** 2 + (u.y / LOOP_B) ** 2 - 1
  const gz = (2 * u.z) / (LOOP_A * LOOP_A)
  const gy = (2 * u.y) / (LOOP_B * LOOP_B)
  const dLoop = Math.abs(f) / Math.max(1e-4, Math.hypot(gz, gy))
  return Math.min(dEq, dMer, dLoop)
}

function buildBall(colors) {
  let geo = new THREE.IcosahedronGeometry(1, 80)
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo)
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  const seamAttr = new Float32Array(pos.count)
  const u = new THREE.Vector3()
  const panel = new THREE.Color(colors.panel)
  const rubber = new THREE.Color(colors.seam)
  const HALF = 0.024 // half the channel width (about 6 mm on the real ball)
  for (let i = 0; i < pos.count; i++) {
    u.fromBufferAttribute(pos, i).normalize()
    const d = seamDistance(u)
    // a rounded channel: deepest in the middle, with soft shoulders
    const k = Math.max(0, 1 - d / HALF)
    const groove = k > 0 ? Math.sqrt(1 - (1 - k) * (1 - k)) : 0
    const shoulder = 1 - THREE.MathUtils.smoothstep(d, HALF, HALF * 1.6)
    const rr = R * (1 - 0.0075 * groove - 0.0015 * shoulder * (1 - groove))
    pos.setXYZ(i, u.x * rr, u.y * rr, u.z * rr)
    const inSeam = THREE.MathUtils.smoothstep(k, 0.0, 0.25)
    const c = panel.clone().lerp(rubber, inSeam)
    col.set([c.r, c.g, c.b], i * 3)
    seamAttr[i] = inSeam
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aSeam', new THREE.BufferAttribute(seamAttr, 1))
  geo.computeVertexNormals()
  // the valve: in a panel just off the crossing of the equator and the
  // great circle, as on a real ball
  const valve = new THREE.Vector3(0.16, 0.11, 1).normalize()
  return { geo, valve }
}

// pebbled rubber: raised round pebbles from 3D cellular noise, none on the
// smooth rubber channels; the channels are a touch glossier
function usePebbles(material, bump) {
  useEffect(() => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uBump = { value: bump }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aSeam;\nvarying vec3 vObj;\nvarying float vSeam;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\nvSeam = aSeam;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uBump;
varying vec3 vObj;
varying float vSeam;
vec3 rdHash(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
float rdCell(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); float d=8.0; for(int a=-1;a<=1;a++) for(int b=-1;b<=1;b++) for(int c=-1;c<=1;c++){ vec3 g=vec3(float(a),float(b),float(c)); vec3 r=g+0.15+rdHash(i+g)*0.7-f; d=min(d,dot(r,r)); } return sqrt(d); }
vec3 rdPerturb(vec3 sp, vec3 sn, vec2 dH, float fd){ vec3 sx=normalize(dFdx(sp)); vec3 sy=normalize(dFdy(sp)); vec3 r1=cross(sy,sn); vec3 r2=cross(sn,sx); float det=dot(sx,r1)*fd; vec3 gr=sign(det)*(dH.x*r1+dH.y*r2); return normalize(abs(det)*sn-gr); }`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.62, vSeam);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
{
  vec3 q = normalize(vObj);
  float cell = rdCell(q * 52.0);
  // a round dome on every pebble, flat valleys between them
  float hgt = 1.0 - smoothstep(0.0, 0.42, cell);
  hgt = hgt * hgt * (3.0 - 2.0 * hgt);
  hgt *= uBump * (1.0 - vSeam);
  normal = rdPerturb(-vViewPosition, normal, vec2(dFdx(hgt), dFdy(hgt)), faceDirection);
}`,
        )
    }
    material.needsUpdate = true
  }, [material, bump])
}

export default function Basketball({
  panel = '#c8582b',
  seam = '#1b1714',
  pressure = 1,
  push = 6,
  backspin = 1,
  gravity = 1,
  dribble = false,
  dribbleHeight = 0.85,
  sound = false,
  follow = true,
  resetKey = 0,
  spinKey = 0,
}) {
  const { camera, controls, gl } = useThree()
  const model = useMemo(() => buildBall({ panel, seam }), [panel, seam])
  const ball = useMemo(() => createBall({ r: R, m: M, y: 1.4 }), [])
  const outer = useRef()
  const inner = useRef()
  const audio = useRef(null)
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.72, clearcoat: 0.12, clearcoatRoughness: 0.6, sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color('#ff9a6a') }), [])
  usePebbles(material, 0.0011)

  useEffect(() => () => audio.current?.dispose(), [])
  const sfx = () => {
    if (!sound) return null
    if (!audio.current) audio.current = createBallAudio()
    return audio.current
  }

  useEffect(() => {
    // drop it from shoulder height
    ball.p.set(0, 1.4, 0)
    ball.v.set(0, 0, 0)
    // a little spin, as with the football, so the bounces kick and it
    // rolls away instead of dying on the spot
    ball.w.set(0.4, 0, 1.2)
    ball.held = null
  }, [resetKey, ball])
  useEffect(() => {
    // spin it on the spot like a spin on a fingertip, then let it fall away
    if (!spinKey) return
    ball.w.set(0.6, 34, 0.3)
  }, [spinKey, ball])

  // a regulation ball dropped from 1.8 m bounces to 1.2-1.4 m: e ~ 0.83
  const P = useMemo(
    () => ({ g: 9.81 * gravity, Cd: 0.5, Cl: 1.0, e0: Math.min(0.92, 0.66 + 0.17 * pressure), mu: 0.62, crr: 0.018 }),
    [gravity, pressure],
  )
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
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  const drag = useRef(null)
  const onDown = (e) => {
    e.stopPropagation()
    const n = new THREE.Vector3()
    camera.getWorldDirection(n)
    drag.current = {
      t: performance.now(),
      x: e.clientX,
      y: e.clientY,
      hit: e.point.clone(),
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n.negate(), ball.p.clone()),
      grabOff: ball.p.clone().sub(e.point),
      hist: [],
      moved: false,
    }
    // keep receiving pointerup even if the release happens off the canvas,
    // otherwise the ball stays "held" and hangs in the air
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
        // a slap: push it away from where you touched it
        const off = d.hit.clone().sub(ball.p)
        const dir = ball.p.clone().sub(d.hit).normalize()
        dir.y = Math.max(dir.y, 0) + 0.25
        dir.normalize()
        ball.v.copy(dir).multiplyScalar(push)
        ball.w.crossVectors(off, dir).multiplyScalar((push * 0.6) / (R * R)).clampLength(0, 60)
        sfx()?.slap(push / 8)
        return
      }
      const h = d.hist
      if (h.length >= 2) {
        const a = h[0]
        const b = h[h.length - 1]
        const dt = Math.max(0.016, (b.t - a.t) / 1000)
        ball.v.copy(b.p).sub(a.p).multiplyScalar(1 / dt).clampLength(0, 18)
        // the fingers roll off the ball as it leaves: backspin, which makes
        // a shot drop softly and a bounce check backwards
        ball.w.crossVectors(UP, ball.v).multiplyScalar((-backspin * 0.35) / R)
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
  }, [camera, controls, gl, push, backspin, sound])

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta)
    // dribbling: the hand meets the ball near the top of its bounce and
    // pushes it back down hard enough to return to the same height, while
    // steering it back under the hand
    if (dribble && !ball.held && !drag.current) {
      const top = Math.max(0.45, dribbleHeight)
      if (ball.p.y > top - 0.05 && ball.v.y > -0.2) {
        const e = P.e0
        // speed needed so that after losing (1 - e) at the floor it climbs back to top
        const vDown = Math.sqrt((2 * P.g * (top - R)) / (e * e) - 2 * P.g * (top - R)) + 0.4
        ball.v.y = -Math.max(2.5, vDown)
        ball.v.x += (0 - ball.p.x) * 1.2
        ball.v.z += (0 - ball.p.z) * 1.2
        sfx()?.slap(0.25)
      }
    }
    const STEPS = Math.ceil(dt / (1 / 480))
    for (let s = 0; s < STEPS; s++) stepBall(ball, dt / STEPS, P, walls, (speed, kind) => sfx()?.bounce(speed / 7, kind))
    const sq = ball.p.y < R * 1.15 ? Math.max(0, ball.squash) : 0
    outer.current.position.set(ball.p.x, ball.p.y - sq * R, ball.p.z)
    outer.current.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5)
    inner.current.quaternion.copy(ball.q)
    if (follow && controls && !drag.current) {
      const goal = new THREE.Vector3(ball.p.x, Math.min(0.7, ball.p.y * 0.5 + 0.08), ball.p.z)
      const step = goal.sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 2.2))
      controls.target.add(step)
      camera.position.add(step)
    }
  })

  const valvePos = model.valve.clone().multiplyScalar(R * 0.999)
  const valveQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), model.valve)
  return (
    <group ref={outer}>
      <group ref={inner}>
        <mesh geometry={model.geo} material={material} castShadow receiveShadow onPointerDown={onDown} />
        {/* the valve: a black rubber collar with a pin hole */}
        <group position={valvePos} quaternion={valveQ}>
          <mesh>
            <cylinderGeometry args={[R * 0.06, R * 0.065, R * 0.008, 32]} />
            <meshStandardMaterial color="#141210" roughness={0.45} />
          </mesh>
          <mesh position={[0, R * 0.0045, 0]}>
            <cylinderGeometry args={[R * 0.014, R * 0.014, R * 0.002, 16]} />
            <meshStandardMaterial color="#000" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
