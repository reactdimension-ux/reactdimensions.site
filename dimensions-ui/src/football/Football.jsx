import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createBall, stepBall } from './physics.js'
import { createBallAudio } from './audio.js'

// A classic 32-panel football: 12 black pentagons and 20 white hexagons,
// the pattern of a truncated icosahedron blown up into a sphere. Each panel
// is a leather pillow: it puffs out a little in the middle and dips into a
// stitched seam at its edges, and the leather has a fine pebbled grain. One
// white panel carries the valve.
//
// Real size and weight (size 5: 22 cm across, 430 g) and real physics (see
// physics.js). Tap the ball to kick it: hit it off-centre and it spins and
// bends in the air. Drag it to pick it up and throw it.

export const R = 0.11 // metres
const M = 0.43 // kg
const PHI = (1 + Math.sqrt(5)) / 2

// the React Dimensions mark (kept inline so the component is self-contained)
const R_PATH =
  'M168 320 L172 186 L130 172 C150 100 270 42 370 44 C440 46 472 80 462 120 C452 160 380 194 270 236 ' +
  'L376 322 L378 342 L242 344 L240 302 L228 308 L226 318 Z ' +
  'M230 198 L233 150 C254 122 300 102 346 104 C384 106 412 116 422 128 C428 136 420 142 404 147 Z'

// the mark as an alpha mask, centred in a square texture
function logoMask() {
  const S = 512
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const s = (S * 0.92) / 352
  g.setTransform(s, 0, 0, s, S / 2 - 298 * s, S / 2 - 193 * s)
  g.fillStyle = '#fff'
  g.fill(new Path2D(R_PATH), 'evenodd')
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  return t
}

// where the mark is printed: the middle of two opposite white hexagons,
// each with a tangent frame so the R reads upright
function decalFrame(dir) {
  const n = new THREE.Vector3(...dir).normalize()
  const up = Math.abs(n.y) > 0.95 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0)
  const t = new THREE.Vector3().crossVectors(up, n).normalize()
  const b = new THREE.Vector3().crossVectors(n, t)
  return { n, t, b }
}
const LOGO_FACES = [decalFrame([-1, 1, 1]), decalFrame([1, -1, -1])]
const LOGO_SIZE = 0.5 // texture width on the unit sphere; a hexagon is ~0.72 across

// truncated icosahedron: vertices are the even permutations of
// (0, ±1, ±3φ), (±1, ±(2+φ), ±2φ), (±φ, ±2, ±(2φ+1))
function truncatedIcosahedron() {
  const base = [
    [0, 1, 3 * PHI],
    [1, 2 + PHI, 2 * PHI],
    [PHI, 2, 2 * PHI + 1],
  ]
  const seen = new Map()
  for (const [a, b, c] of base) {
    for (const [x, y, z] of [[a, b, c], [b, c, a], [c, a, b]]) {
      for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
        const v = [x * sx, y * sy, z * sz]
        seen.set(v.map((n) => n.toFixed(4)).join(), new THREE.Vector3(...v))
      }
    }
  }
  const verts = [...seen.values()]
  const edges = []
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) if (Math.abs(verts[i].distanceTo(verts[j]) - 2) < 1e-3) edges.push([i, j])
  // face normals: icosahedron vertices (pentagons), dodecahedron vertices (hexagons)
  // face normals: icosahedron vertices (the 12 pentagons) and dodecahedron
  // vertices (the 20 hexagons)
  const ico = []
  for (const [x, y, z] of [[0, 1, PHI], [1, PHI, 0], [PHI, 0, 1]]) for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    const v = x === 0 ? [0, y * s1, z * s2] : y === 0 ? [x * s1, 0, z * s2] : [x * s1, y * s2, 0]
    ico.push(new THREE.Vector3(...v))
  }
  const hex = []
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) hex.push(new THREE.Vector3(sx, sy, sz))
  for (const [x, y, z] of [[0, PHI, 1 / PHI], [PHI, 1 / PHI, 0], [1 / PHI, 0, PHI]]) for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    const v = x === 0 ? [0, y * s1, z * s2] : y === 0 ? [x * s1, 0, z * s2] : [x * s1, y * s2, 0]
    hex.push(new THREE.Vector3(...v))
  }
  const faces = [...ico.map((n) => ({ n: n.clone().normalize(), black: true })), ...hex.map((n) => ({ n: n.clone().normalize(), black: false }))]
  // the distance of each face's plane from the centre
  for (const f of faces) f.d = Math.max(...verts.map((v) => v.dot(f.n)))
  return { verts, edges, faces }
}

function buildBall(colors) {
  const { verts, edges, faces } = truncatedIcosahedron()
  // a dense sphere; each point belongs to the face plane its ray meets first
  let geo = new THREE.IcosahedronGeometry(1, 72)
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo)
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  const seamAttr = new Float32Array(pos.count)
  const u = new THREE.Vector3()
  const white = new THREE.Color(colors.panel)
  const black = new THREE.Color(colors.patch)
  const seamCol = new THREE.Color(colors.patch).lerp(new THREE.Color('#000'), 0.4)
  for (let i = 0; i < pos.count; i++) {
    u.fromBufferAttribute(pos, i).normalize()
    let b1 = -1
    let b2 = -1
    let f1 = null
    for (const f of faces) {
      const s = u.dot(f.n) / f.d
      if (s > b1) {
        b2 = b1
        b1 = s
        f1 = f
      } else if (s > b2) b2 = s
    }
    // how far into its panel this point is (0 on the seam)
    const gap = (b1 - b2) / b1
    const seam = 1 - THREE.MathUtils.smoothstep(gap, 0.0, 0.006)
    // the pillow: puffed up in the middle of the panel, dipping into the seam
    const puff = THREE.MathUtils.smoothstep(gap, 0.0, 0.06)
    const rr = R * (1 - 0.006 + 0.012 * puff - 0.012 * seam)
    pos.setXYZ(i, u.x * rr, u.y * rr, u.z * rr)
    const c = (f1.black ? black : white).clone().lerp(seamCol, seam * 0.55)
    col.set([c.r, c.g, c.b], i * 3)
    seamAttr[i] = seam
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aSeam', new THREE.BufferAttribute(seamAttr, 1))
  geo.computeVertexNormals()

  // stitches across every seam: short thread loops along each of the 90 edges
  const stitches = []
  const n = new THREE.Vector3()
  for (const [i, j] of edges) {
    const A = verts[i].clone().normalize()
    const B = verts[j].clone().normalize()
    const PER = 9
    for (let k = 0; k < PER; k++) {
      const t = (k + 0.5) / PER
      const p = A.clone().lerp(B, t).normalize()
      const tangent = B.clone().sub(A).normalize()
      n.copy(p)
      const across = new THREE.Vector3().crossVectors(n, tangent).normalize()
      stitches.push({ p: p.multiplyScalar(R * 0.989), across, n: n.clone() })
    }
  }
  // the valve: on the middle of one hexagon
  const valveFace = faces.find((f) => !f.black)
  return { geo, stitches, valve: valveFace.n.clone() }
}

// a pebbled, slightly dimpled leather grain, worked out in the shader from
// 3D cellular noise so it has no seams or pole pinching
function useLeather(material, bump, logo) {
  useEffect(() => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uBump = { value: bump }
      Object.assign(shader.uniforms, logo)
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
uniform sampler2D uLogo;
uniform float uLogoOn;
uniform float uLogoSize;
uniform vec3 uInk;
uniform vec3 uLogoN[2];
uniform vec3 uLogoT[2];
uniform vec3 uLogoB[2];
// how much printed ink covers this point of the ball
float rdLogo(vec3 q){
  float a = 0.0;
  for (int i = 0; i < 2; i++) {
    if (dot(q, uLogoN[i]) < 0.6) continue;
    vec2 uv = vec2(dot(q, uLogoT[i]), dot(q, uLogoB[i])) / uLogoSize + 0.5;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) a = max(a, texture2D(uLogo, uv).a);
  }
  return a * uLogoOn * (1.0 - vSeam);
}
vec3 rdHash(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
float rdCell(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); float d=8.0; for(int a=-1;a<=1;a++) for(int b=-1;b<=1;b++) for(int c=-1;c<=1;c++){ vec3 g=vec3(float(a),float(b),float(c)); vec3 r=g+rdHash(i+g)-f; d=min(d,dot(r,r)); } return sqrt(d); }
vec3 rdPerturb(vec3 sp, vec3 sn, vec2 dH, float fd){ vec3 sx=normalize(dFdx(sp)); vec3 sy=normalize(dFdy(sp)); vec3 r1=cross(sy,sn); vec3 r2=cross(sn,sx); float det=dot(sx,r1)*fd; vec3 gr=sign(det)*(dH.x*r1+dH.y*r2); return normalize(abs(det)*sn-gr); }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float rdInk = rdLogo(normalize(vObj));
diffuseColor.rgb = mix(diffuseColor.rgb, uInk, rdInk * 0.94);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.7, rdInk);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
{
  vec3 q = normalize(vObj);
  float hgt = (1.0 - smoothstep(0.1, 0.55, rdCell(q * 140.0))) * 0.6 + (1.0 - rdCell(q * 46.0)) * 0.4;
  hgt *= uBump * (1.0 - vSeam);
  normal = rdPerturb(-vViewPosition, normal, vec2(dFdx(hgt), dFdy(hgt)), faceDirection);
}`,
        )
    }
    material.needsUpdate = true
  }, [material, bump, logo])
}

// uniforms for the printed mark; colour and on/off change without a recompile
function useLogoUniforms(on, ink) {
  const u = useMemo(
    () => ({
      uLogo: { value: logoMask() },
      uLogoOn: { value: 1 },
      uLogoSize: { value: LOGO_SIZE },
      uInk: { value: new THREE.Color() },
      uLogoN: { value: LOGO_FACES.map((f) => f.n) },
      uLogoT: { value: LOGO_FACES.map((f) => f.t) },
      uLogoB: { value: LOGO_FACES.map((f) => f.b) },
    }),
    [],
  )
  useEffect(() => () => u.uLogo.value.dispose(), [u])
  u.uLogoOn.value = on ? 1 : 0
  u.uInk.value.set(ink)
  return u
}

export default function Football({ panel = '#f3f3f1', patch = '#121214', thread = '#d8d8d4', logo = true, ink, pressure = 1, kick = 16, curve = 1, gravity = 1, sound = false, follow = true, resetKey = 0, kickKey = 0, onKick }) {
  const { camera, controls, gl } = useThree()
  const model = useMemo(() => buildBall({ panel, patch }), [panel, patch])
  const ball = useMemo(() => createBall({ r: R, m: M, y: 0.9 }), [])
  const outer = useRef()
  const inner = useRef()
  const stitchMesh = useRef()
  const audio = useRef(null)
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.52, clearcoat: 0.55, clearcoatRoughness: 0.32, sheen: 0.2, sheenRoughness: 0.6 }), [])
  const logoU = useLogoUniforms(logo, ink || patch)
  useLeather(material, 0.0009, logoU)

  // place the stitches
  useEffect(() => {
    const m = stitchMesh.current
    if (!m) return
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const basis = new THREE.Matrix4()
    model.stitches.forEach((s, k) => {
      const t = new THREE.Vector3().crossVectors(s.across, s.n)
      basis.makeBasis(s.across, s.n, t)
      q.setFromRotationMatrix(basis)
      mat.compose(s.p, q, new THREE.Vector3(1, 1, 1))
      m.setMatrixAt(k, mat)
    })
    m.instanceMatrix.needsUpdate = true
  }, [model])

  useEffect(() => {
    if (sound && !audio.current) audio.current = createBallAudio()
    return () => {}
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])

  // reset: drop it from a little height
  useEffect(() => {
    ball.p.set(0, 0.9, 0)
    ball.v.set(0, 0, 0)
    ball.w.set(0.4, 0, 1.2)
    ball.held = null
  }, [resetKey, ball])

  // physics parameters: pressure changes how lively the bounce is
  const P = useMemo(
    () => ({ g: 9.81 * gravity, Cd: 0.25, Cl: 0.9 * curve, e0: Math.min(0.93, 0.7 + 0.16 * pressure), mu: 0.55, crr: 0.025 }),
    [gravity, curve, pressure],
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

  // kick in a direction with some spin
  const doKick = (dir, off) => {
    const speed = kick * (0.9 + Math.random() * 0.2)
    ball.held = null
    ball.v.copy(dir).multiplyScalar(speed)
    // spin from where it was struck: off-centre gives curl (and Magnus bend)
    ball.w.crossVectors(off, dir).multiplyScalar((speed * 0.55) / (R * R))
    ball.w.clampLength(0, 70)
    audio.current?.kick(speed / 20)
    onKick?.(speed)
  }
  useEffect(() => {
    if (!kickKey) return
    // the button: a lofted kick away from the camera, with a little bend
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    const dir = fwd.clone().multiplyScalar(0.85).add(new THREE.Vector3(0, 0.55, 0)).normalize()
    const side = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).multiplyScalar(R * 0.45 * (Math.random() < 0.5 ? 1 : -1))
    if (ball.p.y < R * 1.5) doKick(dir, side.add(new THREE.Vector3(0, -R * 0.3, 0)))
    else doKick(dir, side)
  }, [kickKey])

  // pointer: tap = kick from where you hit it, drag = carry and throw
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
        // a tap: kick it from the point you touched, through its centre
        const off = d.hit.clone().sub(ball.p)
        const dir = ball.p.clone().sub(d.hit).normalize()
        dir.y = Math.max(dir.y, 0) + 0.35
        doKick(dir.normalize(), off)
        return
      }
      // a throw: release with the hand's recent velocity
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
  }, [camera, controls, gl, kick])

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta)
    const STEPS = Math.ceil(dt / (1 / 480))
    for (let s = 0; s < STEPS; s++)
      stepBall(ball, dt / STEPS, P, walls, (speed, kind) => {
        if (!sound) return
        if (!audio.current) audio.current = createBallAudio()
        audio.current?.bounce(speed / 8, kind)
      })
    // the ball squashes against the floor, flattening and widening a touch,
    // with its centre sinking by the same amount so it stays on the ground
    const sq = ball.p.y < R * 1.15 ? Math.max(0, ball.squash) : 0
    outer.current.position.set(ball.p.x, ball.p.y - sq * R, ball.p.z)
    outer.current.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5)
    inner.current.quaternion.copy(ball.q)
    // the camera drifts after the ball so a kick doesn't leave the frame
    if (follow && controls && !drag.current) {
      const goal = new THREE.Vector3(ball.p.x, Math.min(0.6, ball.p.y * 0.5 + 0.06), ball.p.z)
      const step = goal.sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 2.2))
      controls.target.add(step)
      camera.position.add(step)
    }
  })

  const valvePos = model.valve.clone().multiplyScalar(R * 1.004)
  const valveQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), model.valve)
  return (
    <group ref={outer}>
      <group ref={inner}>
        <mesh geometry={model.geo} material={material} castShadow receiveShadow onPointerDown={onDown} />
        <instancedMesh ref={stitchMesh} args={[null, null, model.stitches.length]} castShadow={false}>
          <boxGeometry args={[R * 0.034, R * 0.006, R * 0.009]} />
          <meshStandardMaterial color={thread} roughness={0.8} />
        </instancedMesh>
        {/* the valve: a small dark rubber plug with a pin hole */}
        <mesh position={valvePos} quaternion={valveQ}>
          <cylinderGeometry args={[R * 0.045, R * 0.05, R * 0.006, 24]} />
          <meshStandardMaterial color="#1a1a1c" roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}
