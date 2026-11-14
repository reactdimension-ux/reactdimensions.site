import * as THREE from 'three'

// Geometry builders for the roulette table.
//
// Everything swept here uses one convention: a path of plan points, each
// with an inward normal, and a cross-section listed as [inset from the path,
// height] running bottom -> outside -> top -> inside. Faces then point out
// of the solid. List a point twice to keep a crisp edge there.

// how far the furniture's wood grain texture runs along and across (metres)
export const WOOD = { along: 0.9, across: 0.11 }

export function sweep(path, profile, { caps = false, along = WOOD.along, across = WOOD.across } = {}) {
  const P = profile.length
  const pos = []
  const uv = []
  const idx = []
  const arc = [0]
  for (let i = 1; i < P; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
  const put = (p, i) => pos.push(p.x + p.nx * profile[i][0], profile[i][1], p.z + p.nz * profile[i][0])
  path.forEach((p) => {
    for (let i = 0; i < P; i++) {
      put(p, i)
      uv.push(p.s / along, arc[i] / across)
    }
  })
  for (let j = 0; j < path.length - 1; j++)
    for (let i = 0; i < P - 1; i++) {
      const a = j * P + i
      const b = a + P
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  if (caps) {
    // close an open sweep's two ends with the cross-section itself
    const keep = profile.map((_, i) => i).filter((i) => i === 0 || profile[i][0] !== profile[i - 1][0] || profile[i][1] !== profile[i - 1][1])
    const faces = THREE.ShapeUtils.triangulateShape(keep.map((i) => new THREE.Vector2(profile[i][0], profile[i][1])), [])
    const A = new THREE.Vector3()
    const B = new THREE.Vector3()
    const C = new THREE.Vector3()
    const at = (k, v) => v.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2])
    for (const end of [0, path.length - 1]) {
      const p = path[end]
      const q = path[end ? end - 1 : 1]
      const out = new THREE.Vector3(p.x - q.x, 0, p.z - q.z) // away from the sweep
      const base = pos.length / 3
      keep.forEach((i) => {
        put(p, i)
        uv.push(profile[i][0] / across, profile[i][1] / across)
      })
      for (const [a, b, c] of faces) {
        at(base + a, A)
        at(base + b, B)
        at(base + c, C)
        const flip = B.sub(A).cross(C.sub(A)).dot(out) < 0
        idx.push(base + a, base + (flip ? c : b), base + (flip ? b : c))
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// a closed path for sweep(): the first point again at the end, one lap further on
export const loop = (pts, total) => [...pts, { ...pts[0], s: total }]

// a path moved inwards by d, as plain [x, z] pairs
export const inset = (pts, d) => pts.map((p) => [p.x + p.nx * d, p.z + p.nz * d])

// A rectangle as a sweep path, its corners doubled and mitred so mouldings
// swept round it meet in crisp 45 degree joints.
export function rectPath(hx, hz, cx = 0, cz = 0) {
  const c = [
    [-hx, hz, 1, -1],
    [hx, hz, -1, -1],
    [hx, -hz, -1, 1],
    [-hx, -hz, 1, 1],
  ]
  const out = []
  let s = 0
  for (let i = 0; i <= 4; i++) {
    const [x, z, nx, nz] = c[i % 4]
    if (i > 0) s += Math.hypot(x - c[i - 1][0], z - c[i - 1][1])
    const p = { x: cx + x, z: cz + z, nx, nz, s }
    out.push(p, { ...p })
  }
  return out.slice(1, -1)
}

// a flat sheet filling a plan outline ([x, z] pairs) at height y, facing up or down
export function flat(points, y, up = true, su = 1, sv = su) {
  const faces = THREE.ShapeUtils.triangulateShape(points.map(([x, z]) => new THREE.Vector2(x, z)), [])
  const pos = []
  const uv = []
  const nor = []
  points.forEach(([x, z]) => {
    pos.push(x, y, z)
    uv.push(x / su, z / sv)
    nor.push(0, up ? 1 : -1, 0)
  })
  const idx = []
  for (const [a, b, c] of faces) {
    const ny = (points[b][1] - points[a][1]) * (points[c][0] - points[a][0]) - (points[b][0] - points[a][0]) * (points[c][1] - points[a][1])
    const flip = ny > 0 !== up
    idx.push(a, flip ? c : b, flip ? b : c)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

// Wood-grain UVs for a block-like solid: each face is mapped flat from the
// side it faces, with the grain running along `grain`.
export function boxUV(g, grain = 'x', along = WOOD.along, across = WOOD.across) {
  const p = g.attributes.position
  const n = g.attributes.normal
  const uv = new Float32Array(p.count * 2)
  const ax = { x: 0, y: 1, z: 2 }[grain]
  for (let i = 0; i < p.count; i++) {
    const P = [p.getX(i), p.getY(i), p.getZ(i)]
    const N = [Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i))]
    const d = N[0] >= N[1] && N[0] >= N[2] ? 0 : N[1] >= N[2] ? 1 : 2
    const rest = [0, 1, 2].filter((k) => k !== d)
    const [ua, va] = d === ax ? rest : [ax, rest.find((k) => k !== ax)]
    uv[i * 2] = P[ua] / along
    uv[i * 2 + 1] = P[va] / across + P[d] * 3.1
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

// a lathe turned from [radius, height] pairs, its UVs in real lengths:
// u laps the turning `laps` times, v follows the profile (or 0..1 if `across` is 0)
export function lathe(profile, segments = 96, laps = 4, across = WOOD.across) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments)
  const arc = [0]
  for (let i = 1; i < profile.length; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
  const total = arc[arc.length - 1]
  const uv = g.attributes.uv
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * laps, arc[k % profile.length] / (across || total))
  return g
}

// points along an arc of a profile, in [radius, height]
export function arcPts(cx, cy, r, a0, a1, n) {
  const out = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return out
}
