import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A feathered badminton shuttlecock at real size and weight: 5.1 g, a 26 mm
// cork and sixteen goose feathers 66 mm long opening to a 64 mm skirt.
//
// It is built the way a real one is. Each feather is a tapering quill
// (rachis) pushed into the cork, with a vane of individually drawn barbs
// that fray at the cut edges, split here and there, and let light through.
// The vanes are wide on one side and narrow on the other and are set at a
// slight angle, so each one tucks under its neighbour like a shingle (that
// angle is also what makes a shuttle spin in flight). Two rows of cotton
// thread weave in and out of the quills and are soaked in glue. The cork is
// a hemisphere covered in thin white leather, with a speed-band tape round
// its top.
//
// Physics: a rigid body with the mass mostly in the cork. In the air,
// drag gives it a terminal speed of about 6.8 m/s, the skirt weathervanes
// it so the cork leads (so a shuttle hit upwards flips over, and one dropped
// cork-up turns over on the way down), and the angled feathers spin it up in
// proportion to its speed. On the floor the cork and the feather tips are the
// contact points: the cork bounces, grips and rolls, and the shuttle topples
// onto its side and rocks to rest the way a real one does.

const N = 16 // feathers
const L = 0.066 // feather length from the cork top
const RB = 0.0103 // radius of the feather circle in the cork
const RT = 0.0312 // radius of the skirt at the tips
const FLARE = 0.0007 // the tips flare out slightly
const H = Math.sqrt(L * L - (RT - RB) * (RT - RB))
const Y0 = 0.0246 // cork top
const RC = 0.013 // cork radius
const VANE0 = 0.36 // where the vane starts, as a fraction of the feather
const S0 = 0.33 * L
const S1 = L + 0.0008
const XL = 0.0048 // vane grid, either side of the quill
const XR = 0.0142
const WR = 0.0125 // vane widths: wide side and narrow side
const WL = 0.0038
const TW = 512
const TH = 1024
const AW = 2048
const AH = 2048
const TILES = 8
const THETA = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2)
const TILE_OF = [0, 3, 6, 1, 4, 7, 2, 5, 3, 0, 5, 2, 7, 4, 1, 6]
const RINGS = [0.245, 0.345] // the two rows of binding thread

const M_CORK = 0.0032
const M_FEATHERS = 0.0019
const M = M_CORK + M_FEATHERS
const G = 9.81
const VT = 6.8 // terminal speed
const KD = G / (VT * VT)
const KA = 48 // weathervane stiffness
const CA = 7 // weathervane damping
const SPIN = 7 // axial spin per m/s of airspeed

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

const radiusAt = (f) => RB + (RT - RB) * f + FLARE * f * f * f

// a point on feather i: s along the quill, x across the vane (positive is the
// wide side). The vane is wrapped round the skirt and tilted, wide side in.
function wrap(theta, s, x, out = new THREE.Vector3()) {
  const f = s / L
  const r = radiusAt(f)
  const k = 0.1 + 0.07 * Math.max(0, f)
  const phi = theta + x / r
  const rr = r - k * x
  return out.set(rr * Math.cos(phi), Y0 + H * f, rr * Math.sin(phi))
}

// per-tile feather shape: a little variation in length and width
function tileParams(wear) {
  const r = rng(41)
  return Array.from({ length: TILES }, (_, k) => {
    const len = 1 - r() * 0.012 - (wear > 0.5 && k === 3 ? 0.07 * wear : 0)
    return { len, w: 0.96 + r() * 0.07 }
  })
}

function inside(x, s, P) {
  const u = (s / L - VANE0) / (P.len - VANE0)
  if (u < 0) return false
  if (x >= 0) {
    if (x > WR * P.w * (1 - Math.pow(Math.max(0, 1 - u), 2.6))) return false
  } else if (-x > WL * (1 - Math.pow(Math.max(0, 1 - u), 3))) return false
  return s < L * P.len - (x >= 0 ? 0.5 * x + 9 * x * x : 1.1 * -x)
}

// the vanes: colour, cut-out and bump maps for eight feathers in one atlas,
// drawn barb by barb
function vaneAtlas(wear, tiles) {
  const mk = () => Object.assign(document.createElement('canvas'), { width: AW, height: AH })
  const col = mk()
  const alp = mk()
  const bmp = mk()
  const g = col.getContext('2d')
  const a = alp.getContext('2d')
  const b = bmp.getContext('2d')
  a.fillStyle = '#000'
  a.fillRect(0, 0, AW, AH)
  b.fillStyle = '#3c3c3c'
  b.fillRect(0, 0, AW, AH)
  for (const c of [g, a, b]) {
    c.lineCap = 'round'
    c.lineJoin = 'round'
  }
  for (let k = 0; k < TILES; k++) {
    const r = rng(900 + k * 17)
    const P = tiles[k]
    const ox = (k % 4) * TW
    const oy = Math.floor(k / 4) * TH
    const X = (x) => ox + ((x + XL) / (XL + XR)) * TW
    const Y = (s) => oy + (1 - (s - S0) / (S1 - S0)) * TH
    // goose feathers vary from bright white to faintly cream
    const warm = r()
    g.fillStyle = `hsl(42, ${18 + warm * 22}%, ${91 - warm * 3}%)`
    g.fillRect(ox, oy, TW, TH)
    // splits in the vane, more with wear
    const splits = []
    const ns = Math.floor(r() * (1.6 + wear * 6))
    for (let i = 0; i < ns; i++) {
      splits.push({ side: r() < 0.75 ? 1 : -1, s: L * (0.5 + r() * 0.42), gap: 0.00006 + r() * 0.00014 * (1 + wear), open: 0.03 + r() * 0.08 * (0.5 + wear) })
    }
    for (const side of [1, -1]) {
      const ang0 = side > 0 ? 0.9 : 0.75
      let s = VANE0 * L
      while (s < L * P.len) {
        s += 0.00024 + r() * 0.00006
        let ang = ang0 + (r() - 0.5) * 0.04
        let skip = false
        for (const sp of splits) {
          if (sp.side !== side) continue
          const d = s - sp.s
          if (Math.abs(d) < sp.gap) skip = true
          else if (Math.abs(d) < sp.gap + 0.0012) ang += Math.sign(d) * sp.open * (1 - (Math.abs(d) - sp.gap) / 0.0012)
        }
        if (skip || !inside(side * 0.0003, s, P)) continue
        const pts = [[0, s]]
        let x = 0
        let ss = s
        let dist = 0
        const st = 0.00015
        while (dist < 0.022) {
          const aa = ang - 8 * dist
          const nx = x + side * Math.sin(aa) * st
          const nz = ss + Math.cos(aa) * st
          if (!inside(nx, nz, P)) break
          x = nx
          ss = nz
          dist += st
          pts.push([x, ss])
        }
        // die-cut ends: clean, with only a little unevenness until wear frays them
        const extra = (r() - 0.5) * 0.00025 + (r() < wear * 0.2 ? (r() - 0.6) * 0.004 * wear : 0)
        const more = Math.round(extra / st)
        if (more > 0) {
          for (let i = 0; i < more; i++) {
            const aa = ang - 8 * dist
            x += side * Math.sin(aa) * st
            ss += Math.cos(aa) * st
            dist += st
            pts.push([x, ss])
          }
        } else if (more < 0) pts.splice(Math.max(2, pts.length + more))
        if (pts.length < 2) continue
        const path = (c) => {
          c.beginPath()
          c.moveTo(X(pts[0][0]), Y(pts[0][1]))
          for (let i = 1; i < pts.length; i++) c.lineTo(X(pts[i][0]), Y(pts[i][1]))
          c.stroke()
        }
        a.strokeStyle = '#fff'
        a.lineWidth = 7
        path(a)
        const l = 88 + r() * 7 - warm * 3
        g.strokeStyle = `hsl(${40 + r() * 6}, ${14 + warm * 22}%, ${l}%)`
        g.lineWidth = 6
        path(g)
        const v = 150 + Math.floor(r() * 70)
        b.strokeStyle = `rgb(${v},${v},${v})`
        b.lineWidth = 2.6
        path(b)
      }
    }
    // the quill groove, and the lower vane a touch greyer than the tip
    g.strokeStyle = 'rgba(205,188,150,0.55)'
    g.lineWidth = 9
    g.beginPath()
    g.moveTo(X(0), Y(S0))
    g.lineTo(X(0), Y(L * P.len))
    g.stroke()
    const grad = g.createLinearGradient(0, Y(S0), 0, Y(L))
    grad.addColorStop(0, '#e2dccf')
    grad.addColorStop(0.45, '#f6f3ec')
    grad.addColorStop(1, '#ffffff')
    g.globalCompositeOperation = 'multiply'
    g.fillStyle = grad
    g.fillRect(ox, oy, TW, TH)
    // court dust and string marks on a used shuttle
    if (wear > 0) {
      for (let i = 0; i < 40 * wear; i++) {
        g.fillStyle = `rgba(120,115,105,${0.04 + r() * 0.08 * wear})`
        g.beginPath()
        g.ellipse(X(r() * WR - 0.002), Y(L * (0.75 + r() * 0.25)), 4 + r() * 22, 2 + r() * 8, r() * 3, 0, Math.PI * 2)
        g.fill()
      }
    }
    g.globalCompositeOperation = 'source-over'
  }
  const map = new THREE.CanvasTexture(col)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const alphaMap = new THREE.CanvasTexture(alp)
  alphaMap.anisotropy = 8
  const bumpMap = new THREE.CanvasTexture(bmp)
  bumpMap.anisotropy = 8
  return { map, alphaMap, bumpMap }
}

function vaneGeometry() {
  const NX = 24
  const NS = 44
  const pos = []
  const uv = []
  const idx = []
  const v = new THREE.Vector3()
  for (let i = 0; i < N; i++) {
    const k = TILE_OF[i]
    const ox = (k % 4) * TW
    const oy = Math.floor(k / 4) * TH
    const base = pos.length / 3
    for (let b = 0; b <= NS; b++) {
      const s = S0 + ((S1 - S0) * b) / NS
      for (let a = 0; a <= NX; a++) {
        wrap(THETA[i], s, -XL + ((XL + XR) * a) / NX, v)
        pos.push(v.x, v.y, v.z)
        uv.push((ox + (a / NX) * TW) / AW, 1 - (oy + (1 - b / NS) * TH) / AH)
      }
    }
    for (let b = 0; b < NS; b++) {
      for (let a = 0; a < NX; a++) {
        const i0 = base + b * (NX + 1) + a
        idx.push(i0, i0 + NX + 1, i0 + 1, i0 + 1, i0 + NX + 1, i0 + NX + 2)
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// the quills: a hollow round calamus in the cork, tapering to a fine
// rachis at the tip, a little deeper than wide
function quillGeometry(tiles) {
  const NS = 56
  const NR = 10
  const pos = []
  const uv = []
  const idx = []
  const c = new THREE.Vector3()
  const p0 = new THREE.Vector3()
  const p1 = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const rad = new THREE.Vector3()
  const tan = new THREE.Vector3()
  for (let i = 0; i < N; i++) {
    const sEnd = L * tiles[TILE_OF[i]].len - 0.0006
    const base = pos.length / 3
    for (let b = 0; b <= NS; b++) {
      const s = -0.004 + ((sEnd + 0.004) * b) / NS
      const f = Math.max(0, s / L)
      wrap(THETA[i], s, 0, c)
      dir.subVectors(wrap(THETA[i], s + 0.0005, 0, p1), wrap(THETA[i], s - 0.0005, 0, p0)).normalize()
      rad.set(Math.cos(THETA[i]), 0, Math.sin(THETA[i]))
      rad.addScaledVector(dir, -rad.dot(dir)).normalize()
      tan.crossVectors(dir, rad)
      const t = b / NS
      let w = f < VANE0 ? THREE.MathUtils.lerp(0.00078, 0.00062, f / VANE0) : THREE.MathUtils.lerp(0.00058, 0.00016, (f - VANE0) / (1 - VANE0))
      if (t > 0.985) w *= 0.4
      for (let a = 0; a <= NR; a++) {
        const ang = (a / NR) * Math.PI * 2
        pos.push(
          c.x + rad.x * Math.cos(ang) * w * 1.08 + tan.x * Math.sin(ang) * w * 0.84,
          c.y + rad.y * Math.cos(ang) * w * 1.08 + tan.y * Math.sin(ang) * w * 0.84,
          c.z + rad.z * Math.cos(ang) * w * 1.08 + tan.z * Math.sin(ang) * w * 0.84,
        )
        uv.push(a / NR, t)
      }
    }
    for (let b = 0; b < NS; b++) {
      for (let a = 0; a < NR; a++) {
        const i0 = base + b * (NR + 1) + a
        idx.push(i0, i0 + 1, i0 + NR + 1, i0 + 1, i0 + NR + 2, i0 + NR + 1)
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// two strands per row, weaving in and out of the quills in opposite phase
function threadGeometries() {
  const out = []
  for (const f of RINGS) {
    for (const ph of [0, 1]) {
      const pts = []
      for (let k = 0; k < 256; k++) {
        const phi = (k / 256) * Math.PI * 2
        const r = radiusAt(f) + (ph ? -1 : 1) * 0.00085 * Math.cos(8 * phi)
        const y = Y0 + H * f + (ph ? 0.00028 : -0.00028) + 0.0001 * Math.sin(16 * phi + ph * Math.PI)
        pts.push(new THREE.Vector3(r * Math.cos(phi), y, r * Math.sin(phi)))
      }
      out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 640, 0.0004, 7, true))
    }
  }
  return out
}

// glue: a bead where each quill crosses the thread and where it enters the cork
function glueBeads() {
  const geo = new THREE.SphereGeometry(1, 10, 8)
  const mat = new THREE.MeshPhysicalMaterial({ color: '#ece2c6', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 })
  const mesh = new THREE.InstancedMesh(geo, mat, N * (RINGS.length + 1))
  const o = new THREE.Object3D()
  let n = 0
  for (let i = 0; i < N; i++) {
    for (const f of [...RINGS, 0.006]) {
      wrap(THETA[i], f * L, 0, o.position)
      o.lookAt(0, o.position.y, 0)
      const big = f < 0.05
      o.scale.set(big ? 0.0013 : 0.0011, big ? 0.0006 : 0.00085, big ? 0.0011 : 0.0007)
      o.updateMatrix()
      mesh.setMatrixAt(n++, o.matrix)
    }
  }
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// the cork's white leather cover: fine pores, faint mottling, and with wear
// grey scuffs and the criss-cross print of racket strings on the dome
function leatherMaps(wear) {
  const W = 1024
  const Hh = 512
  const col = Object.assign(document.createElement('canvas'), { width: W, height: Hh })
  const bm = Object.assign(document.createElement('canvas'), { width: W, height: Hh })
  const g = col.getContext('2d')
  const b = bm.getContext('2d')
  const r = rng(5)
  g.fillStyle = '#f4f2ed'
  g.fillRect(0, 0, W, Hh)
  b.fillStyle = '#808080'
  b.fillRect(0, 0, W, Hh)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(200,190,170,0.035)' : 'rgba(255,255,255,0.05)'
    g.beginPath()
    g.arc(r() * W, r() * Hh, 10 + r() * 50, 0, Math.PI * 2)
    g.fill()
  }
  for (let i = 0; i < 26000; i++) {
    const x = r() * W
    const y = r() * Hh
    const s = 0.6 + r() * 1.3
    b.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.4})`
    b.beginPath()
    b.arc(x, y, s, 0, Math.PI * 2)
    b.fill()
    if (r() < 0.25) {
      g.fillStyle = 'rgba(150,140,125,0.12)'
      g.fillRect(x, y, 1.2, 1.2)
    }
  }
  // fine wrinkles where the leather was drawn over the dome
  for (let i = 0; i < 400; i++) {
    const x = r() * W
    const y = Hh * (0.45 + r() * 0.5)
    b.strokeStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`
    b.lineWidth = 0.8
    b.beginPath()
    b.moveTo(x, y)
    b.lineTo(x + (r() - 0.5) * 6, y - 4 - r() * 14)
    b.stroke()
  }
  if (wear > 0) {
    // racket string marks: a patch of crossed grey lines on the dome
    for (let p = 0; p < 1 + Math.round(wear * 3); p++) {
      g.save()
      g.translate(W * (0.15 + r() * 0.7), Hh * (0.7 + r() * 0.2))
      g.rotate(r() * Math.PI)
      g.strokeStyle = `rgba(90,92,98,${0.08 + wear * 0.18})`
      g.lineWidth = 1.4
      for (let k = -6; k <= 6; k++) {
        g.beginPath()
        g.moveTo(k * 9, -50)
        g.lineTo(k * 9, 50)
        g.moveTo(-50, k * 9)
        g.lineTo(50, k * 9)
        g.stroke()
      }
      g.restore()
    }
    for (let i = 0; i < 60 * wear; i++) {
      g.fillStyle = `rgba(110,105,100,${0.05 + r() * 0.1 * wear})`
      g.beginPath()
      g.ellipse(r() * W, Hh * (0.4 + r() * 0.6), 3 + r() * 16, 1 + r() * 5, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
  }
  const map = new THREE.CanvasTexture(col)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const bumpMap = new THREE.CanvasTexture(bm)
  bumpMap.anisotropy = 8
  return { map, bumpMap }
}

// the top of the cork, seen inside the skirt: natural cork granules and a
// ring of glue where the quills go in
function corkTop() {
  const S = 512
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const r = rng(11)
  g.fillStyle = '#a9835a'
  g.fillRect(0, 0, S, S)
  const tones = ['#94704a', '#bf9a6e', '#7d5a38', '#b08b62', '#9e7a52', '#c8a67c']
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = tones[Math.floor(r() * tones.length)]
    g.globalAlpha = 0.5 + r() * 0.5
    g.beginPath()
    g.ellipse(r() * S, r() * S, 1 + r() * 4, 1 + r() * 3, r() * 3, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  const R0 = (RB / (RC - 0.0011)) * (S / 2)
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${215 + r() * 25},${185 + r() * 25},${120 + r() * 30},${0.25 + r() * 0.3})`
    g.lineWidth = 4 + r() * 14
    g.beginPath()
    const a0 = r() * Math.PI * 2
    g.arc(S / 2, S / 2, R0 + (r() - 0.5) * 18, a0, a0 + 0.3 + r() * 1.2)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// the speed-band tape, with the overlap where its ends meet
function bandMap() {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 16 })
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 512, 16)
  g.fillStyle = 'rgba(0,0,0,0.35)'
  g.fillRect(318, 0, 2, 16)
  g.fillStyle = 'rgba(255,255,255,0.5)'
  g.fillRect(320, 0, 2, 16)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function corkProfile() {
  const pts = []
  for (let i = 0; i <= 22; i++) {
    const t = (i / 22) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.max(1e-5, RC * Math.sin(t)), RC * (1 - Math.cos(t))))
  }
  for (let i = 1; i <= 8; i++) pts.push(new THREE.Vector2(RC, RC + ((0.0238 - RC) * i) / 8))
  pts.push(new THREE.Vector2(RC - 0.00005, 0.0244), new THREE.Vector2(RC - 0.0003, 0.0249), new THREE.Vector2(RC - 0.0009, 0.0251), new THREE.Vector2(RC - 0.0013, 0.0247))
  return pts
}

function bandProfile() {
  const r0 = RC
  const t = 0.00018
  return [
    new THREE.Vector2(r0, 0.0189),
    new THREE.Vector2(r0 + t * 0.7, 0.01895),
    new THREE.Vector2(r0 + t, 0.0191),
    new THREE.Vector2(r0 + t, 0.0236),
    new THREE.Vector2(r0 + t * 0.7, 0.02375),
    new THREE.Vector2(r0, 0.0238),
  ]
}

// thin keratin lets light through: light arriving on the far side of a
// vane or quill is added to its diffuse colour
function translucent(mat, amount) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTrans = { value: amount }
    sh.fragmentShader = 'uniform float uTrans;\n' + sh.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      {
        vec3 bn = -normal;
        vec3 tl = vec3(0.0);
        #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
          tl += directionalLights[i].color * saturate(dot(bn, directionalLights[i].direction) * 0.8 + 0.2);
        }
        #endif
        #if NUM_HEMI_LIGHTS > 0
        for (int i = 0; i < NUM_HEMI_LIGHTS; i++) {
          tl += getHemisphereLightIrradiance(hemisphereLights[i], bn);
        }
        #endif
        #if defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)
        tl += getIBLIrradiance(bn);
        #endif
        reflectedLight.indirectDiffuse += tl * diffuseColor.rgb * uTrans * RECIPROCAL_PI;
      }`,
    )
  }
  mat.customProgramCacheKey = () => 'shuttle-translucent-' + amount
  return mat
}

// mass properties from a point sampling: cork hemisphere-and-cylinder plus
// sixteen feathers
const BODY = (() => {
  const r = rng(3)
  const pts = []
  const nc = 600
  while (pts.length < nc) {
    const x = (r() * 2 - 1) * RC
    const z = (r() * 2 - 1) * RC
    const y = r() * Y0
    const rr = Math.hypot(x, z)
    if (rr > RC || (y < RC && Math.hypot(rr, y - RC) > RC)) continue
    pts.push([x, y, z, M_CORK / nc])
  }
  const v = new THREE.Vector3()
  const per = M_FEATHERS / (N * 31)
  for (let i = 0; i < N; i++) {
    for (let b = 0; b <= 30; b++) {
      const f = b / 30
      wrap(THETA[i], f * L, f > VANE0 ? 0.003 : 0, v)
      pts.push([v.x, v.y, v.z, per])
    }
  }
  let cy = 0
  for (const p of pts) cy += p[1] * p[3]
  cy /= M
  let Ix = 0
  let Iy = 0
  let Iz = 0
  for (const [x, y, z, m] of pts) {
    Ix += m * ((y - cy) ** 2 + z * z)
    Iy += m * (x * x + z * z)
    Iz += m * (x * x + (y - cy) ** 2)
  }
  const com = new THREE.Vector3(0, cy, 0)
  const tips = THETA.map((th) => wrap(th, L * 0.995, 0.0004).sub(com))
  return { com, invI: new THREE.Vector3(1 / Ix, 1 / Iy, 1 / Iz), sphere: new THREE.Vector3(0, RC - cy, 0), tips }
})()

// sound: the cork struck by strings, and a soft tap on the floor
let actx
function audio() {
  if (!actx) {
    const A = window.AudioContext || window.webkitAudioContext
    if (!A) return null
    actx = new A()
  }
  if (actx.state === 'suspended') actx.resume()
  return actx
}
function thock(level, crisp) {
  const a = audio()
  if (!a) return
  const t = a.currentTime
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * 0.09), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * (0.006 + 0.008 * crisp)))
  const src = a.createBufferSource()
  src.buffer = buf
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 700 + 2200 * crisp
  bp.Q.value = 1.1
  const gn = a.createGain()
  gn.gain.value = 0.6 * level
  src.connect(bp).connect(gn).connect(a.destination)
  src.start(t)
  if (crisp > 0.5) {
    // the string bed's ping
    const o = a.createOscillator()
    const og = a.createGain()
    o.frequency.value = 1150
    og.gain.setValueAtTime(0.12 * level, t)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    o.connect(og).connect(a.destination)
    o.start(t)
    o.stop(t + 0.08)
  }
}

export default function Shuttlecock({ band = '#0e4f38', wear = 0.15, sound = false, follow = true, slowMotion = 1, serveKey = 0, dropKey = 0, standKey = 0 }) {
  const group = useRef()
  const { controls, camera } = useThree()
  const [hover, setHover] = useState(false)
  useCursor(hover)

  const tiles = useMemo(() => tileParams(wear), [wear])
  const vane = useMemo(() => {
    const maps = vaneAtlas(wear, tiles)
    const mat = translucent(
      new THREE.MeshPhysicalMaterial({ ...maps, color: '#f2efe8', bumpScale: 0.7, alphaTest: 0.45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4 }),
      0.32,
    )
    return { geo: vaneGeometry(), mat, maps }
  }, [wear, tiles])
  useEffect(() => () => (vane.geo.dispose(), vane.mat.dispose(), Object.values(vane.maps).forEach((t) => t.dispose())), [vane])

  const quill = useMemo(() => {
    const mat = translucent(new THREE.MeshPhysicalMaterial({ color: '#f2ead8', roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.3, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') }), 0.45)
    return { geo: quillGeometry(tiles), mat }
  }, [tiles])
  useEffect(() => () => (quill.geo.dispose(), quill.mat.dispose()), [quill])

  const parts = useMemo(() => {
    const leather = leatherMaps(wear)
    const top = corkTop()
    const bmap = bandMap()
    return {
      leather,
      top,
      bmap,
      threads: threadGeometries(),
      threadMat: new THREE.MeshPhysicalMaterial({ color: '#ebe3cd', roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color('#fffaf0') }),
      glue: glueBeads(),
      cork: new THREE.LatheGeometry(corkProfile(), 96),
      bandGeo: new THREE.LatheGeometry(bandProfile(), 96),
    }
  }, [wear])
  useEffect(
    () => () => {
      const p = parts
      p.leather.map.dispose()
      p.leather.bumpMap.dispose()
      p.top.dispose()
      p.bmap.dispose()
      p.threads.forEach((g) => g.dispose())
      p.threadMat.dispose()
      p.glue.geometry.dispose()
      p.glue.material.dispose()
      p.cork.dispose()
      p.bandGeo.dispose()
    },
    [parts],
  )

  const s = useRef({ p: new THREE.Vector3(0, BODY.com.y, 0), v: new THREE.Vector3(), w: new THREE.Vector3(), q: new THREE.Quaternion(), sleeping: true, still: 0, grounded: false })
  const tmp = useMemo(
    () => ({
      a: new THREE.Vector3(),
      vh: new THREE.Vector3(),
      cr: new THREE.Vector3(),
      wp: new THREE.Vector3(),
      u: new THREE.Vector3(),
      c: new THREE.Vector3(),
      x: new THREE.Vector3(),
      y: new THREE.Vector3(),
      j: new THREE.Vector3(),
      t: new THREE.Vector3(),
      goal: new THREE.Vector3(),
      d: new THREE.Vector3(),
      qi: new THREE.Quaternion(),
      dq: new THREE.Quaternion(),
      contacts: Array.from({ length: N + 1 }, () => ({ r: new THREE.Vector3(), e: 0, mu: 0, jn: 0, jt: 0 })),
    }),
    [],
  )
  const snd = useRef(sound)
  snd.current = sound

  // world inverse inertia applied to a vector, in place
  const invI = (vec, q) => {
    tmp.qi.copy(q).invert()
    vec.applyQuaternion(tmp.qi).multiply(BODY.invI).applyQuaternion(q)
    return vec
  }
  // effective inverse mass at offset r along unit direction n
  const kEff = (r, n, q) => {
    invI(tmp.x.crossVectors(r, n), q)
    return 1 / M + n.dot(tmp.y.crossVectors(tmp.x, r))
  }
  const impulse = (st, r, J) => {
    st.v.addScaledVector(J, 1 / M)
    st.w.add(invI(tmp.x.crossVectors(r, J), st.q))
  }

  // struck on the cork from below, a touch off-centre
  const serve = () => {
    const st = s.current
    st.sleeping = false
    st.still = 0
    st.v.set((Math.random() - 0.5) * 0.5, 5.2 + Math.random() * 0.6, -0.1 - Math.random() * 0.3)
    const ax = tmp.a.set(0, -1, 0).applyQuaternion(st.q)
    tmp.t.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).cross(ax).normalize()
    st.w.addScaledVector(tmp.t, 6 + Math.random() * 4)
    if (snd.current) thock(1, 1)
  }
  // held cork-up and let go
  const drop = () => {
    const st = s.current
    st.sleeping = false
    st.still = 0
    st.p.set(0, 0.85, 0)
    st.v.set(0, 0, 0)
    st.w.set(0, 0, 0)
    st.q.setFromEuler(new THREE.Euler(Math.PI - 0.3, 0, 0.18))
  }
  // stood upright on its cork
  const stand = () => {
    const st = s.current
    st.sleeping = true
    st.p.set(0, BODY.com.y, 0)
    st.v.set(0, 0, 0)
    st.w.set(0, 0, 0)
    st.q.identity()
  }
  useEffect(() => void (serveKey && serve()), [serveKey])
  useEffect(() => void (dropKey && drop()), [dropKey])
  useEffect(() => void (standKey && stand()), [standKey])

  const step = (st, h) => {
    const sp = st.v.length()
    const a = tmp.a.set(0, -1, 0).applyQuaternion(st.q)
    if (sp > 1e-3) {
      st.v.addScaledVector(st.v, -KD * sp * h)
      const vh = tmp.vh.copy(st.v).divideScalar(sp)
      const cr = tmp.cr.crossVectors(a, vh)
      if (cr.lengthSq() < 1e-6 && a.dot(vh) < 0) cr.set(1e-3, 0, 7e-4)
      st.w.addScaledVector(cr, KA * sp * sp * h)
      const wa = st.w.dot(a)
      tmp.wp.copy(st.w).addScaledVector(a, -wa)
      st.w.addScaledVector(tmp.wp, -Math.min(1, CA * sp * h))
      st.w.addScaledVector(a, (SPIN * st.v.dot(a) - wa) * Math.min(1, 1.2 * sp * h))
    }
    st.w.multiplyScalar(Math.exp(-0.4 * h))
    st.v.y -= G * h
    st.p.addScaledVector(st.v, h)
    const wl = st.w.length()
    if (wl > 1e-7) {
      tmp.dq.setFromAxisAngle(tmp.u.copy(st.w).divideScalar(wl), wl * h)
      st.q.premultiply(tmp.dq).normalize()
    }

    // contacts: the cork and the feather tips
    let nc = 0
    let pen = 0
    const c = tmp.c.copy(BODY.sphere).applyQuaternion(st.q).add(st.p)
    if (c.y < RC) {
      const k = tmp.contacts[nc++]
      k.r.set(c.x, c.y - RC, c.z).sub(st.p)
      k.e = 0.3
      k.mu = 0.55
      pen = Math.max(pen, RC - c.y)
    }
    for (const tip of BODY.tips) {
      tmp.u.copy(tip).applyQuaternion(st.q).add(st.p)
      if (tmp.u.y < 0) {
        const k = tmp.contacts[nc++]
        k.r.copy(tmp.u).sub(st.p)
        k.e = 0.12
        k.mu = 0.6
        pen = Math.max(pen, -tmp.u.y)
      }
    }
    st.grounded = nc > 0
    if (!nc) return
    const up = tmp.t.set(0, 1, 0)
    for (let i = 0; i < nc; i++) tmp.contacts[i].jn = tmp.contacts[i].jt = 0
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < nc; i++) {
        const k = tmp.contacts[i]
        const vel = tmp.u.crossVectors(st.w, k.r).add(st.v)
        if (vel.y < 0) {
          const hard = it === 0 && vel.y < -0.35
          if (hard && k.e > 0.3 && snd.current) thock(Math.min(1, -vel.y / 6) * 0.5, 0)
          const jn = (-(1 + (hard ? k.e : 0)) * vel.y) / kEff(k.r, up, st.q)
          k.jn += jn
          impulse(st, k.r, tmp.j.set(0, jn, 0))
        }
        vel.crossVectors(st.w, k.r).add(st.v)
        vel.y = 0
        const vt = vel.length()
        if (vt > 1e-6 && k.jn > 0) {
          const dir = vel.divideScalar(vt)
          const jt = Math.min(vt / kEff(k.r, dir, st.q), Math.max(0, k.mu * k.jn - k.jt))
          k.jt += jt
          impulse(st, k.r, tmp.j.copy(dir).multiplyScalar(-jt))
        }
      }
    }
    st.p.y += pen * 0.8
    // rolling resistance of leather and feathers on the floor
    st.w.multiplyScalar(Math.exp(-2.5 * h))
    st.v.x *= Math.exp(-1.2 * h)
    st.v.z *= Math.exp(-1.2 * h)
  }

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta)
    const st = s.current
    if (!st.sleeping) {
      const n = 16
      const h = (dt * slowMotion) / n
      for (let i = 0; i < n; i++) step(st, h)
      // keep it on the court
      if (Math.hypot(st.p.x, st.p.z) > 1.2) {
        st.v.x -= st.p.x * 4 * dt
        st.v.z -= st.p.z * 4 * dt
      }
      if (st.grounded && st.v.length() < 0.004 && st.w.length() < 0.06) {
        st.still += dt
        if (st.still > 0.4) {
          st.sleeping = true
          st.v.set(0, 0, 0)
          st.w.set(0, 0, 0)
        }
      } else st.still = 0
    }
    group.current.position.copy(st.p)
    group.current.quaternion.copy(st.q)
    // the camera follows, keeping its framing
    if (follow && controls) {
      tmp.goal.set(st.p.x, st.p.y + 0.014, st.p.z)
      tmp.d.copy(tmp.goal).sub(controls.target).multiplyScalar(1 - Math.exp(-5 * dt))
      controls.target.add(tmp.d)
      camera.position.add(tmp.d)
      controls.update()
    }
  })

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation()
        serve()
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <group position={[0, -BODY.com.y, 0]}>
        <mesh geometry={parts.cork} castShadow receiveShadow>
          <meshPhysicalMaterial map={parts.leather.map} bumpMap={parts.leather.bumpMap} bumpScale={0.5} roughness={0.6} sheen={0.4} sheenColor="#ffffff" clearcoat={0.12} clearcoatRoughness={0.5} />
        </mesh>
        <mesh geometry={parts.bandGeo} castShadow receiveShadow>
          <meshPhysicalMaterial map={parts.bmap} color={band} roughness={0.32} clearcoat={0.7} clearcoatRoughness={0.22} />
        </mesh>
        <mesh position-y={0.0247} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[RC - 0.0011, 64]} />
          <meshStandardMaterial map={parts.top} roughness={0.8} />
        </mesh>
        <mesh geometry={quill.geo} material={quill.mat} castShadow receiveShadow />
        <mesh geometry={vane.geo} material={vane.mat} castShadow receiveShadow />
        {parts.threads.map((g, i) => (
          <mesh key={i} geometry={g} material={parts.threadMat} castShadow receiveShadow />
        ))}
        <primitive object={parts.glue} />
      </group>
    </group>
  )
}
