import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// A realistic wig on a display head. Units are centimetres; the head sits at
// the origin, +y is up and +z is the face.
//
// The hair is real strands, not a sculpted cap: ~3000 flat ribbons grown from
// roots on the scalp in locks of six. Each strand is walked down from its root,
// resting on the head, neck and shoulders (so it drapes and wraps instead of
// passing through them), then bent into waves or helical curls. All of it is
// one merged mesh. Colour (root to tip, highlights, ombre) and the glossy
// anisotropic highlight are worked out in the shader, so those controls cost
// nothing to change; length, wave, curl, volume and parting rebuild the strands.

const HEAD = [7.9, 11, 9.6] // half-extents of the head ellipsoid
const NECK = { y0: -21, y1: -8, r: 4.7, z: -0.8 }
const BUST = { c: [0, -30, -1.5], r: [19, 9.5, 10.5] }
const POLE = { y0: -44, y1: -9, r: 1.15, z: -0.8 }

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
function rng(seed) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Where the wig's edge runs: polar angle from the crown, by direction round the head.
// Low at the front (the hairline), lower at the nape, and down over the ears.
const phiMax = (th) => 1.62 - 0.6 * Math.cos(th)

// ---------------------------------------------------------------- the display head

function headPoint(n, out, off = 0) {
  let x = n.x * (HEAD[0] + off)
  let y = n.y * (HEAD[1] + off)
  let z = n.z * (HEAD[2] + off)
  const t = Math.max(0, -n.y)
  x *= 1 - 0.32 * t ** 1.6 // the jaw narrows to the chin
  z *= 1 - 0.1 * t
  const fw = sstep(0.3, 0.9, n.z) // the face, the front of the head
  z += 2.0 * Math.exp(-((x / 1.15) ** 2 + ((y + 1.8) / 2.6) ** 2)) * fw // nose
  z += 0.45 * Math.exp(-(((y - 2.8) / 0.9) ** 2)) * fw // brow
  for (const sx of [-1, 1]) z -= 0.55 * Math.exp(-(((x - sx * 3.1) / 1.6) ** 2 + ((y - 1.5) / 0.9) ** 2)) * fw // eye sockets
  z += 0.55 * Math.exp(-((x / 2) ** 2 + ((y + 5) / 0.5) ** 2)) * fw // lips
  z += 0.8 * Math.exp(-((x / 2.2) ** 2 + ((y + 9.4) / 1.3) ** 2)) * fw // chin
  return out.set(x, y, z)
}

function headGeometry() {
  let g = new THREE.SphereGeometry(1, 72, 56)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  const p = g.attributes.position
  const n = new THREE.Vector3()
  const o = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize()
    headPoint(n, o)
    p.setXYZ(i, o.x, o.y, o.z)
  }
  g.computeVertexNormals()
  return g
}

// The wig cap: a thin shell over the head that stops at the wig's edge,
// then tucks under the scalp so there is no step.
function capGeometry() {
  let g = new THREE.SphereGeometry(1, 96, 64)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  const p = g.attributes.position
  const n = new THREE.Vector3()
  const o = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize()
    const th = Math.atan2(n.x, n.z)
    const ph = Math.acos(Math.min(1, Math.max(-1, n.y)))
    const f = 1 - sstep(phiMax(th) - 0.05, phiMax(th) + 0.03, ph)
    headPoint(n, o, -0.4 + f * 1.1)
    p.setXYZ(i, o.x, o.y, o.z)
  }
  g.computeVertexNormals()
  return g
}

function bustGeometry() {
  const g = new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2)
  g.scale(BUST.r[0], BUST.r[1], BUST.r[2])
  g.translate(BUST.c[0], BUST.c[1], BUST.c[2])
  return g
}

// ---------------------------------------------------------------- what the hair rests on

// Push p out of an ellipsoid (centre c, half-extents r) grown by off.
function pushEllipsoid(p, c, r, off) {
  const x = (p[0] - c[0]) / (r[0] + off)
  const y = (p[1] - c[1]) / (r[1] + off)
  const z = (p[2] - c[2]) / (r[2] + off)
  const l = Math.hypot(x, y, z)
  if (l >= 1 || l < 1e-6) return
  p[0] = c[0] + (x / l) * (r[0] + off)
  p[1] = c[1] + (y / l) * (r[1] + off)
  p[2] = c[2] + (z / l) * (r[2] + off)
}
// Push p out of a vertical cylinder.
function pushCylinder(p, z0, y0, y1, r, off) {
  if (p[1] < y0 || p[1] > y1) return
  const dz = p[2] - z0
  const l = Math.hypot(p[0], dz)
  if (l >= r + off || l < 1e-6) return
  p[0] *= (r + off) / l
  p[2] = z0 + (dz * (r + off)) / l
}
const ZERO = [0, 0, 0]
// Hair lies on the scalp rather than flying off it: a point that has wandered
// a little way out of the head, above the ears, is drawn back onto its surface.
function hug(p, off) {
  if (p[1] < -3) return
  const x = p[0] / (HEAD[0] + off)
  const y = p[1] / (HEAD[1] + off)
  const z = p[2] / (HEAD[2] + off)
  const l = Math.hypot(x, y, z)
  if (l < 1 || l > 1.4) return
  p[0] /= l
  p[1] /= l
  p[2] /= l
}
function collide(p, off, display) {
  pushEllipsoid(p, ZERO, HEAD, off)
  if (display === 'bust') {
    pushCylinder(p, NECK.z, NECK.y0, NECK.y1, NECK.r, off)
    pushEllipsoid(p, BUST.c, BUST.r, off)
  } else pushCylinder(p, POLE.z, POLE.y0, POLE.y1, POLE.r, off)
}

// ---------------------------------------------------------------- the strands

export function buildHair({ length = 45, wave = 0.4, curl = 0, volume = 0.6, part = 0.25, fringe = true, density = 1, display = 'bust', seed = 7 }) {
  const r = rng(seed)
  const CLUMPS = Math.round(520 * density)
  const PER = 9
  const step = 1.0 - 0.5 * curl
  const waveA = wave * 2.4
  const curlR = curl * 1.15
  const curlK = (Math.PI * 2) / (4.2 - 2.4 * curl)

  const pos = []
  const nor = []
  const col = []
  const tan = []
  const idx = []
  let verts = 0

  const P = [0, 0, 0]
  const Q = [0, 0, 0]
  const d = new THREE.Vector3()
  const N = new THREE.Vector3()
  const S = new THREE.Vector3()
  const prevS = new THREE.Vector3()
  const N2 = new THREE.Vector3()
  const root = new THREE.Vector3()

  for (let c = 0; c < CLUMPS; c++) {
    // a root on the scalp, spread evenly over the area under the wig's edge
    let th = 0
    let ph = 0
    let tries = 0
    do {
      th = (r() * 2 - 1) * Math.PI
      ph = Math.acos(Math.cos(2.3) + Math.pow(r(), 0.8) * (1 - Math.cos(2.3)))
    } while (ph > phiMax(th) - 0.04 && ++tries < 40)
    if (ph > phiMax(th) - 0.04) continue
    const rootY = Math.cos(ph) * HEAD[1]
    const phase = r() * Math.PI * 2
    const phase2 = r() * Math.PI * 2
    const cl = r()
    const wavelen = 10 + r() * 5
    // the fringe is cut short, to the brow
    const frontC = sstep(0.1, 0.9, Math.cos(th)) * (1 - sstep(0.7, 1.45, ph))
    let lengthC = Math.max(5, length * (0.9 + 0.2 * r()) - Math.max(0, HEAD[1] - rootY) * 0.7)
    if (fringe) lengthC = Math.min(lengthC, 9 + 4 * r() + (1 - sstep(0.3, 0.8, frontC)) * 1e3)

    for (let k = 0; k < PER; k++) {
      const t0 = th + (r() - 0.5) * 0.05
      const p0 = Math.min(ph + (r() - 0.5) * 0.05, phiMax(t0) - 0.04)
      N.set(Math.sin(p0) * Math.sin(t0), Math.cos(p0), Math.sin(p0) * Math.cos(t0))
      const shell = r()
      const off = 0.95 + (0.5 + volume * 1.6) * shell
      root.set(N.x * (HEAD[0] + off), N.y * (HEAD[1] + off), N.z * (HEAD[2] + off))
      P[0] = root.x
      P[1] = root.y
      P[2] = root.z

      // combed down the meridian, parted to one side, the front swept across the brow
      d.set(Math.cos(p0) * Math.sin(t0), -Math.sin(p0), Math.cos(p0) * Math.cos(t0))
      const front = sstep(0.1, 0.9, Math.cos(t0)) * (1 - sstep(0.7, 1.45, p0))
      const sw = (root.x < part * 3 ? -1 : 1) * (fringe ? 0.55 : 2.1) * front
      d.x += sw * Math.cos(t0)
      d.z -= sw * Math.sin(t0)
      d.normalize()

      const L = lengthC * (0.94 + 0.12 * r())
      const M = Math.max(6, Math.ceil(L / step))
      const w0 = 0.2 * (0.8 + 0.5 * r())
      const sh = 0.6 + 0.4 * shell
      const strandPhase = phase + (r() - 0.5) * 0.5
      let first = true
      for (let i = 0; i <= M; i++) {
        const s = i * step
        const u = Math.min(1, s / L)
        // the outward direction, from the head axis
        const nl = Math.hypot(P[0], P[1] * 0.35, P[2]) || 1
        N.set(P[0] / nl, (P[1] * 0.35) / nl, P[2] / nl)
        S.crossVectors(d, N)
        if (S.lengthSq() < 1e-6) S.set(1, 0, 0)
        S.normalize()
        if (!first && S.dot(prevS) < 0) S.negate()
        prevS.copy(S)
        N2.crossVectors(S, d).normalize()
        // waves along the lock, a helix for curls; both fade in off the scalp
        const ramp = sstep(0.01, 0.2, u)
        const wv = waveA * Math.sin(((Math.PI * 2) / wavelen) * s + strandPhase) * ramp
        const ca = curlK * s + phase2 + (r() - 0.5) * 0.04
        const cx = curlR * ramp * Math.cos(ca)
        const cy = curlR * ramp * Math.sin(ca)
        Q[0] = P[0] + S.x * (wv + cx) + N2.x * cy
        Q[1] = P[1] + S.y * (wv + cx) + N2.y * cy
        Q[2] = P[2] + S.z * (wv + cx) + N2.z * cy
        collide(Q, 0.12, display)

        const w = w0 * (1 - 0.9 * sstep(0.82, 1, u))
        pos.push(Q[0] - S.x * w, Q[1] - S.y * w, Q[2] - S.z * w, Q[0] + S.x * w, Q[1] + S.y * w, Q[2] + S.z * w)
        nor.push(N2.x, N2.y, N2.z, N2.x, N2.y, N2.z)
        col.push(sh, u, cl, sh, u, cl)
        tan.push(d.x, d.y, d.z, d.x, d.y, d.z)
        if (!first) idx.push(verts - 2, verts - 1, verts, verts - 1, verts + 1, verts)
        verts += 2
        first = false

        // on down the hair: gravity bends it, the head and shoulders hold it up
        const ox = P[0]
        const oy = P[1]
        const oz = P[2]
        P[0] += d.x * step
        P[1] += d.y * step
        P[2] += d.z * step
        d.x += N.x * 0.012 * volume
        d.z += N.z * 0.012 * volume
        d.y -= 0.14
        d.normalize()
        hug(P, off * 0.8)
        collide(P, off * 0.8, display)
        d.set(P[0] - ox, P[1] - oy, P[2] - oz).normalize()
        // hair lands on the shoulders and stays there instead of sliding off them
        if (P[1] < -16) {
          d.x *= 0.35
          d.normalize()
        }
      }
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 3))
  g.setIndex(new THREE.Uint32BufferAttribute(idx, 1))
  g.computeBoundingSphere()
  return g
}

// ---------------------------------------------------------------- the hair material

// Colour is computed per vertex from uniforms (the vertex colour attribute
// packs shade, position along the strand and a per-lock random). A
// Kajiya-Kay highlight, which runs along each strand rather than across it, is
// added in the fragment shader for the glossy band real hair shows.
function useHairMaterial() {
  const shader = useRef()
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0, sheen: 0.1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff'), envMapIntensity: 0.4 })
    m.onBeforeCompile = (s) => {
      s.uniforms.uBase = { value: new THREE.Color('#5a3a26') }
      s.uniforms.uHigh = { value: new THREE.Color('#a8794a') }
      s.uniforms.uTip = { value: new THREE.Color('#c79a68') }
      s.uniforms.uRoot = { value: new THREE.Color('#2a1a12') }
      s.uniforms.uHighAmt = { value: 0.35 }
      s.uniforms.uOmbre = { value: 0 }
      s.uniforms.uTime = { value: 0 }
      s.uniforms.uSway = { value: 1 }
      s.uniforms.uSpec = { value: 1 }
      s.uniforms.uKey = { value: new THREE.Vector3(-0.45, 0.7, 0.55) }
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aTan;\nvarying vec3 vTan;\nuniform vec3 uBase;\nuniform vec3 uHigh;\nuniform vec3 uTip;\nuniform vec3 uRoot;\nuniform float uHighAmt;\nuniform float uOmbre;\nuniform float uTime;\nuniform float uSway;')
        .replace(
          '#include <color_vertex>',
          `#ifdef USE_COLOR
          float hSh = color.r;
          float hSt = color.g;
          float hCl = color.b;
          float pick = step(1.0 - uHighAmt, fract(hCl * 7.31));
          vec3 hc = mix(uBase, uHigh, pick * (0.45 + 0.55 * fract(hCl * 13.7)));
          hc *= 0.88 + 0.24 * fract(hCl * 3.7);
          hc = mix(hc, uTip, smoothstep(0.3, 1.0, hSt) * uOmbre);
          hc = mix(hc * 0.68, hc, smoothstep(0.0, 0.1, hSt));
          vColor = hc * hSh;
          #endif`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vTan = normalize(mat3(modelViewMatrix) * aTan);
          transformed.x += sin(uTime * 1.1 + hCl * 40.0) * 0.5 * uSway * hSt * hSt;
          transformed.z += cos(uTime * 0.9 + hCl * 31.0) * 0.35 * uSway * hSt * hSt;`,
        )
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTan;\nuniform float uSpec;\nuniform vec3 uKey;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            vec3 Tn = normalize(vTan);
            vec3 Vv = normalize(vViewPosition);
            vec3 Lk = normalize(uKey);
            vec3 Hh = normalize(Lk + Vv);
            float tdh = dot(Tn, Hh);
            float sinTH = sqrt(max(0.0, 1.0 - tdh * tdh));
            float lit = clamp(dot(normal, Lk) * 0.5 + 0.55, 0.0, 1.0);
            float s1 = pow(sinTH, 120.0);
            float s2 = pow(sinTH, 26.0);
            totalEmissiveRadiance += uSpec * lit * (s1 * vec3(1.0, 0.97, 0.92) * 0.32 + s2 * vColor * 0.22);
          }`,
        )
      shader.current = s
    }
    m.customProgramCacheKey = () => 'wig-hair'
    return m
  }, [])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }) => {
    if (shader.current) shader.current.uniforms.uTime.value = clock.elapsedTime
  })
  return [mat, shader]
}

// ---------------------------------------------------------------- the wig

export default function Wig({
  hairColor = '#5a3a26',
  highlightColor = '#a8794a',
  highlights = 0.35,
  tipColor = '#c79a68',
  ombre = 0,
  length = 45,
  wave = 0.4,
  curl = 0,
  volume = 0.6,
  part = 0.25,
  fringe = true,
  density = 1,
  shine = 1,
  sway = 1,
  display = 'bust',
  skin = '#ece9e3',
}) {
  const [hairMat, shader] = useHairMaterial()
  const hair = useMemo(() => buildHair({ length, wave, curl, volume, part, fringe, density, display }), [length, wave, curl, volume, part, fringe, density, display])
  useEffect(() => () => hair.dispose(), [hair])
  const head = useMemo(headGeometry, [])
  const cap = useMemo(capGeometry, [])
  const bust = useMemo(bustGeometry, [])
  useEffect(() => () => (head.dispose(), cap.dispose(), bust.dispose()), [head, cap, bust])

  // colours and the highlight live in uniforms; update them without a rebuild
  const capColor = useMemo(() => new THREE.Color(hairColor).multiplyScalar(0.45), [hairColor])
  useEffect(() => {
    const s = shader.current
    if (!s) return
    s.uniforms.uBase.value.set(hairColor)
    s.uniforms.uHigh.value.set(highlightColor)
    s.uniforms.uTip.value.set(tipColor)
    s.uniforms.uRoot.value.set(hairColor).multiplyScalar(0.4)
    s.uniforms.uHighAmt.value = highlights
    s.uniforms.uOmbre.value = ombre
    s.uniforms.uSway.value = sway
    s.uniforms.uSpec.value = shine
  })
  // the shader compiles on first render, after these effects; set them again once it exists
  const set = useRef(false)
  useFrame(() => {
    const s = shader.current
    if (!s || set.current) return
    set.current = true
    s.uniforms.uBase.value.set(hairColor)
    s.uniforms.uHigh.value.set(highlightColor)
    s.uniforms.uTip.value.set(tipColor)
    s.uniforms.uRoot.value.set(hairColor).multiplyScalar(0.4)
    s.uniforms.uHighAmt.value = highlights
    s.uniforms.uOmbre.value = ombre
    s.uniforms.uSway.value = sway
    s.uniforms.uSpec.value = shine
  })

  return (
    <group>
      <mesh geometry={head}>
        <meshStandardMaterial color={skin} roughness={0.5} metalness={0.02} />
      </mesh>
      <mesh geometry={cap}>
        <meshStandardMaterial color={capColor} roughness={0.9} />
      </mesh>
      <mesh geometry={hair} material={hairMat} />
      {display === 'bust' ? (
        <group>
          <mesh position={[0, (NECK.y0 + NECK.y1) / 2, NECK.z]}>
            <cylinderGeometry args={[NECK.r - 0.2, NECK.r + 0.5, NECK.y1 - NECK.y0, 40]} />
            <meshStandardMaterial color={skin} roughness={0.5} metalness={0.02} />
          </mesh>
          <mesh geometry={bust}>
            <meshStandardMaterial color={skin} roughness={0.5} metalness={0.02} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, BUST.c[1] - 0.6, BUST.c[2]]} scale={[BUST.r[0] * 1.01, 1, BUST.r[2] * 1.01]}>
            <cylinderGeometry args={[1, 1, 1.2, 64]} />
            <meshStandardMaterial color="#2a2623" roughness={0.45} metalness={0.2} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[0, (POLE.y0 + POLE.y1) / 2, POLE.z]}>
            <cylinderGeometry args={[POLE.r, POLE.r, POLE.y1 - POLE.y0, 20]} />
            <meshStandardMaterial color="#c9ced6" roughness={0.25} metalness={0.9} />
          </mesh>
          <mesh position={[0, POLE.y0 - 0.5, POLE.z]}>
            <cylinderGeometry args={[9.5, 10.5, 1.4, 56]} />
            <meshStandardMaterial color="#2a2623" roughness={0.45} metalness={0.2} />
          </mesh>
        </group>
      )}
    </group>
  )
}

export const FLOOR = { bust: -37.6, stand: -45.2 }
