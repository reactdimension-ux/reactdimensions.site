import * as THREE from 'three'
import { SIDES } from './anatomy.js'

// Long hair as clumps of strands: the mane, the tail tuft and the whiskers.
// Each clump is two crossed, tapering ribbons that curve out of the skin and
// droop under gravity. They copy the skin weights of the vertex they grow
// from, so they move with the body. aHair = (t along clump, kind, random, length)
// with kind 0 mane, 1 tuft, 2 whisker.

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

const ROWS = 7

export function buildHair(body, { mane = true, headBone }) {
  const R = rng(7)
  const { position: P, normal: Nn, region, comb, skinIndex, skinWeight, tagTuft, count } = body
  const clumps = []
  for (let v = 0; v < count; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2]
    const m = region[v * 4]
    if (mane && m > 0.5) {
      // keep the face clear
      if (z > 0.9 && y > 1.02 && Math.abs(x) < 0.17) continue
      if (R() > 0.5 * m) continue
      const low = y < 1.0 ? 1 : 0 // chest bib and throat hang longer
      const crown = y > 1.3 ? 1 : 0
      const L = (0.13 + R() * 0.12) * (1 + 0.35 * low) * (1 - 0.3 * crown)
      clumps.push({ v, kind: 0, L, W: 0.026 + R() * 0.014 })
    } else if (tagTuft[v] > 0.5 && R() < 0.85) {
      clumps.push({ v, kind: 1, L: 0.06 + R() * 0.06, W: 0.016 + R() * 0.01 })
    }
  }

  const whiskers = []
  for (const [s] of SIDES) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        whiskers.push({
          root: [s * 0.094, 1.108 + row * 0.013, 1.165 + col * 0.014 - row * 0.004],
          dir: new THREE.Vector3(s * 0.92, -0.08 + row * 0.07, 0.38 + col * 0.06).normalize(),
          L: 0.09 + R() * 0.06 + col * 0.008,
        })
      }
    }
  }

  const total = clumps.length + whiskers.length
  const vPer = ROWS * 4
  const pos = new Float32Array(total * vPer * 3)
  const nrm = new Float32Array(total * vPer * 3)
  const uv = new Float32Array(total * vPer * 2)
  const hair = new Float32Array(total * vPer * 4)
  const sIdx = new Uint16Array(total * vPer * 4)
  const sW = new Float32Array(total * vPer * 4)
  const index = []

  const root = new THREE.Vector3()
  const n = new THREE.Vector3()
  const c = new THREE.Vector3()
  const jit = new THREE.Vector3()
  const pts = Array.from({ length: ROWS }, () => new THREE.Vector3())
  const tan = new THREE.Vector3()
  const s1 = new THREE.Vector3()
  const s2 = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  let w = 0

  const emit = (rootN, kind, L, W, rnd, skinFrom) => {
    const base = w
    for (let r = 0; r < ROWS; r++) {
      const t = r / (ROWS - 1)
      const p = pts[r]
      tan.subVectors(pts[Math.min(r + 1, ROWS - 1)], pts[Math.max(r - 1, 0)]).normalize()
      s1.crossVectors(tan, rootN)
      if (s1.lengthSq() < 1e-6) s1.set(1, 0, 0)
      s1.normalize()
      s2.crossVectors(tan, s1).normalize()
      const width = kind === 2 ? 0.0016 * (1 - 0.7 * t) : W * (1 - 0.82 * t)
      for (let rib = 0; rib < 2; rib++) {
        const side = rib ? s2 : s1
        for (let e = 0; e < 2; e++) {
          const k = base + r * 4 + rib * 2 + e
          tmp.copy(p).addScaledVector(side, (e - 0.5) * width)
          pos.set([tmp.x, tmp.y, tmp.z], k * 3)
          nrm.set([rootN.x, rootN.y, rootN.z], k * 3)
          uv.set([e, t], k * 2)
          hair.set([t, kind, rnd, L], k * 4)
          if (skinFrom >= 0) {
            for (let q = 0; q < 4; q++) {
              sIdx[k * 4 + q] = skinIndex[skinFrom * 4 + q]
              sW[k * 4 + q] = skinWeight[skinFrom * 4 + q]
            }
          } else {
            sIdx[k * 4] = headBone
            sW[k * 4] = 1
          }
        }
      }
    }
    for (let r = 0; r < ROWS - 1; r++) {
      for (let rib = 0; rib < 2; rib++) {
        const a = base + r * 4 + rib * 2
        const b = a + 1
        const c2 = a + 4
        const d = b + 4
        index.push(a, b, d, a, d, c2)
      }
    }
    w += vPer
  }

  for (const cl of clumps) {
    const v = cl.v
    root.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2])
    n.set(Nn[v * 3], Nn[v * 3 + 1], Nn[v * 3 + 2])
    c.set(comb[v * 3], comb[v * 3 + 1], comb[v * 3 + 2])
    jit.set(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.7)
    const L = cl.L
    const out = cl.kind === 1 ? 0.25 : 0.62
    const along = cl.kind === 1 ? 0.95 : 0.55
    const droop = cl.kind === 1 ? 0.1 : 0.38
    for (let r = 0; r < ROWS; r++) {
      const t = r / (ROWS - 1)
      pts[r]
        .copy(root)
        .addScaledVector(n, -0.012 + L * out * t)
        .addScaledVector(c, L * along * t)
        .addScaledVector(jit, L * t * t * 0.35)
      pts[r].y -= L * droop * t * t
    }
    emit(n, cl.kind, L, cl.W, R(), v)
  }
  for (const wh of whiskers) {
    root.fromArray(wh.root)
    for (let r = 0; r < ROWS; r++) {
      const t = r / (ROWS - 1)
      pts[r].copy(root).addScaledVector(wh.dir, wh.L * t)
      pts[r].y -= wh.L * 0.18 * t * t
      pts[r].z -= wh.L * 0.12 * t * t
    }
    emit(n.set(0, 1, 0.3).normalize(), 2, wh.L, 0, R(), -1)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('aHair', new THREE.BufferAttribute(hair, 4))
  g.setAttribute('skinIndex', new THREE.BufferAttribute(sIdx, 4))
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sW, 4))
  g.setIndex(new THREE.Uint32BufferAttribute(index, 1))
  g.computeBoundingSphere()
  return g
}

// Alpha mask for one clump: a bundle of fine, slightly wavy strands that
// taper and end at different lengths. v = 0 is the root.
export function strandTexture() {
  const W = 128
  const H = 256
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')
  const R = rng(3)
  g.lineCap = 'round'
  for (let i = 0; i < 34; i++) {
    const x0 = W * (0.12 + 0.76 * R())
    const len = 0.55 + 0.45 * R()
    const wave = (R() - 0.5) * 10
    const lean = (W / 2 - x0) * (0.3 + 0.5 * R())
    const steps = 24
    for (let k = 0; k < steps; k++) {
      const t0 = (k / steps) * len
      const t1 = ((k + 1) / steps) * len
      const xa = x0 + lean * t0 + Math.sin(t0 * 7 + i) * wave * t0
      const xb = x0 + lean * t1 + Math.sin(t1 * 7 + i) * wave * t1
      g.strokeStyle = `rgba(255,255,255,${0.95 - 0.5 * (t1 / len)})`
      g.lineWidth = (3.6 + R() * 1.4) * (1 - 0.75 * (t1 / len))
      g.beginPath()
      g.moveTo(xa, H * (1 - t0))
      g.lineTo(xb, H * (1 - t1))
      g.stroke()
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.anisotropy = 4
  return t
}
