// The lion's skeleton and the shapes it is sculpted from.
//
// Units are metres. The lion stands on y = 0, faces +z, and +x is its left.
// Every shape is a signed-distance primitive (an ellipsoid or a tapered
// capsule) tied to a bone; sculpt.js blends them into one smooth skin and uses
// the same primitives to work out skin weights, fur length and markings.

export const SPINE = {
  pelvis: [0, 0.98, -0.55],
  lumbar: [0, 1.0, -0.25],
  thorax: [0, 1.02, 0.08],
  chest: [0, 1.04, 0.36],
  neck: [0, 1.04, 0.56],
  head: [0, 1.2, 0.86],
}
export const SNOUT = [0, 1.17, 1.25]

// Hangs from the croup, curving forward a little at the tip.
export const TAIL = [
  [0, 0.95, -0.76],
  [0, 0.87, -0.88],
  [0, 0.76, -0.97],
  [0, 0.62, -1.03],
  [0, 0.48, -1.06],
  [0, 0.35, -1.07],
  [0, 0.24, -1.04],
  [0, 0.16, -0.98],
]

// Left side (x > 0); the right side mirrors it.
export const FRONT = {
  scap: [0.12, 1.05, 0.38], // top of the shoulder blade
  shoulder: [0.18, 0.8, 0.5],
  elbow: [0.175, 0.52, 0.38],
  wrist: [0.17, 0.135, 0.43],
  ball: [0.17, 0.045, 0.49], // under the main pad
  toe: [0.17, 0.03, 0.57],
}
export const HIND = {
  hip: [0.15, 0.92, -0.58],
  knee: [0.175, 0.62, -0.43],
  hock: [0.17, 0.4, -0.76],
  ball: [0.17, 0.045, -0.665],
  toe: [0.17, 0.03, -0.585],
}

export const EYE = [0.066, 1.236, 1.072]
export const EYE_R = 0.0225

const X = (v, s) => [v[0] * s, v[1], v[2]]
export const SIDES = [
  [1, 'L'],
  [-1, 'R'],
]

// name, joint, tip (the joint the bone points at)
export function boneList() {
  const B = []
  const add = (name, j, tip) => B.push({ name, j, tip })
  add('pelvis', SPINE.pelvis, SPINE.lumbar)
  add('lumbar', SPINE.lumbar, SPINE.thorax)
  add('thorax', SPINE.thorax, SPINE.chest)
  add('chest', SPINE.chest, SPINE.neck)
  add('neck', SPINE.neck, SPINE.head)
  add('head', SPINE.head, SNOUT)
  for (let i = 0; i < TAIL.length - 1; i++) add(`tail${i}`, TAIL[i], TAIL[i + 1])
  for (const [s, n] of SIDES) {
    const f = (k) => X(FRONT[k], s)
    const h = (k) => X(HIND[k], s)
    add(`scap${n}`, f('scap'), f('shoulder'))
    add(`hum${n}`, f('shoulder'), f('elbow'))
    add(`rad${n}`, f('elbow'), f('wrist'))
    add(`fmc${n}`, f('wrist'), f('ball'))
    add(`fpaw${n}`, f('ball'), f('toe'))
    add(`fem${n}`, h('hip'), h('knee'))
    add(`tib${n}`, h('knee'), h('hock'))
    add(`mt${n}`, h('hock'), h('ball'))
    add(`hpaw${n}`, h('ball'), h('toe'))
  }
  return B
}

// Torso shapes use 'spine': their weight is shared along the back by z.
export const SPINE_TENT = [
  ['pelvis', -0.55],
  ['lumbar', -0.25],
  ['thorax', 0.08],
  ['chest', 0.36],
]

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

const COMB_BODY = [0, -0.3, -1]
const COMB_LEG = [0, -1, -0.15]
const COMB_HEAD = [0, 0.15, -1]
const COMB_MANE = [0, -0.65, -1]

// Region values carried by a shape: mane, light (belly / muzzle), dark, fur length.
const R = (o = {}) => ({ mane: 0, light: 0, dark: 0, fur: 1, ...o })

export function buildPrims({ mane = true } = {}) {
  const P = []
  const ell = (c, r, o = {}) => P.push({ type: 'ell', c, r, k: 0.06, reg: R(), comb: COMB_BODY, ...o })
  const cone = (a, b, ra, rb, o = {}) => P.push({ type: 'cone', a, b, ra, rb, k: 0.06, reg: R(), comb: COMB_BODY, ...o })

  // --- Torso ---
  const T = { bone: 'spine', k: 0.09 }
  ell([0, 0.83, 0.27], [0.185, 0.27, 0.32], T) // deep chest
  ell([0, 0.86, -0.02], [0.19, 0.235, 0.3], T) // ribs
  ell([0, 0.88, -0.3], [0.17, 0.19, 0.28], T) // flank, tucked up
  ell([0, 0.9, -0.58], [0.165, 0.16, 0.19], T) // rump
  cone([0, 0.99, 0.42], [0, 0.96, -0.66], 0.09, 0.09, T) // topline
  ell([0, 0.76, 0.5], [0.14, 0.17, 0.12], T) // brisket
  ell([0, 0.73, -0.32], [0.12, 0.06, 0.2], { ...T, k: 0.08, reg: R({ light: 1, fur: 1.6 }) }) // belly skin

  // --- Neck ---
  cone([0, 0.97, 0.44], [0, 1.13, 0.8], 0.19, 0.13, { bone: 'neck', k: 0.09, comb: [0, -0.2, -1] })

  // --- Head ---
  const H = (o = {}) => ({ bone: 'head', k: 0.035, comb: COMB_HEAD, reg: R({ fur: 0.45 }), ...o })
  ell([0, 1.24, 0.91], [0.135, 0.13, 0.165], H({ k: 0.05 })) // cranium
  ell([0, 1.255, 1.015], [0.11, 0.08, 0.09], H()) // brow
  ell([0, 1.2, 1.13], [0.068, 0.062, 0.12], H({ reg: R({ fur: 0.3 }) })) // nose bridge
  ell([0, 1.115, 1.205], [0.035, 0.032, 0.03], H({ reg: R({ light: 1, fur: 0.25 }) })) // upper lip
  ell([0, 1.17, 1.243], [0.044, 0.03, 0.025], H({ k: 0.015, reg: R({ dark: 0.72, fur: 0 }) })) // nose leather
  ell([0, 1.045, 1.095], [0.052, 0.038, 0.085], H({ reg: R({ light: 1, fur: 0.4 }) })) // chin
  for (const [s] of SIDES) {
    ell([0.046 * s, 1.122, 1.18], [0.056, 0.05, 0.062], H({ reg: R({ light: 1, fur: 0.25 }) })) // whisker pad
    cone([0.085 * s, 1.1, 0.9], [0.038 * s, 1.06, 1.1], 0.05, 0.033, H()) // jaw
    ell([0.1 * s, 1.165, 0.97], [0.06, 0.075, 0.085], H()) // cheek
    ell([0.11 * s, 1.355, 0.865], [0.058, 0.055, 0.022], H({ rot: [-0.2, 0.35 * s, 0.3 * s], k: 0.025, reg: R({ fur: 0.8 }), tag: 'ear' }))
  }
  // carved after the blend: ear cups, eye sockets, mouth line
  for (const [s] of SIDES) {
    ell([0.112 * s, 1.36, 0.884], [0.035, 0.035, 0.035], { op: 'sub', k: 0.01 })
    ell(X(EYE, s), [0.027, 0.027, 0.027], { op: 'sub', k: 0.012 })
    cone([0.07 * s, 1.088, 1.03], [0.018 * s, 1.098, 1.195], 0.005, 0.005, { op: 'sub', k: 0.006 })
  }

  // --- Mane (males) ---
  if (mane) {
    const M = (o = {}) => ({ k: 0.1, comb: COMB_MANE, reg: R({ mane: 1, fur: 3.5 }), ...o })
    ell([0, 1.1, 0.66], [0.245, 0.31, 0.27], M({ bone: 'neck' }))
    ell([0, 1.31, 0.76], [0.15, 0.1, 0.12], M({ bone: 'head', k: 0.06 }))
    for (const [s] of SIDES) ell([0.148 * s, 1.16, 0.85], [0.085, 0.19, 0.095], M({ bone: 'head', k: 0.06 }))
    ell([0, 0.85, 0.58], [0.16, 0.24, 0.12], M({ bone: [['chest', 0.5], ['neck', 0.5]] }))
    ell([0, 0.99, 0.98], [0.07, 0.055, 0.07], M({ bone: 'head', k: 0.04, reg: R({ mane: 0.7, fur: 2 }) }))
  }

  // --- Legs ---
  for (const [s, n] of SIDES) {
    const f = (k) => X(FRONT[k], s)
    const h = (k) => X(HIND[k], s)
    const L = (bone, o = {}) => ({ bone: `${bone}${n}`, comb: COMB_LEG, ...o })
    // front
    ell([0.125 * s, 0.93, 0.42], [0.06, 0.17, 0.11], L('scap', { rot: [-0.35, 0, 0], k: 0.07, comb: COMB_BODY }))
    ell([0.17 * s, 0.8, 0.49], [0.085, 0.11, 0.1], L('hum', { comb: COMB_BODY }))
    cone([0.175 * s, 0.79, 0.49], [0.175 * s, 0.55, 0.39], 0.085, 0.07, L('hum'))
    ell([0.16 * s, 0.67, 0.42], [0.075, 0.095, 0.15], L('hum', { dir: sub(f('elbow'), f('shoulder')) })) // triceps
    cone([0.175 * s, 0.52, 0.38], [0.17 * s, 0.15, 0.43], 0.08, 0.052, L('rad'))
    ell([0.175 * s, 0.43, 0.395], [0.078, 0.082, 0.15], L('rad', { dir: sub(f('wrist'), f('elbow')) }))
    ell([0.175 * s, 0.52, 0.355], [0.05, 0.05, 0.04], L('rad')) // point of the elbow
    cone(f('wrist'), [0.17 * s, 0.06, 0.48], 0.054, 0.058, L('fmc', { k: 0.04 }))
    ell([0.17 * s, 0.043, 0.505], [0.066, 0.043, 0.082], L('fpaw', { k: 0.03, reg: R({ fur: 0.6 }), comb: [0, 0, -1] }))
    for (const dx of [-0.042, -0.014, 0.014, 0.042]) {
      ell([(0.17 + dx) * s, 0.032, 0.562 - Math.abs(dx) * 0.5], [0.024, 0.03, 0.03], L('fpaw', { k: 0.012, reg: R({ fur: 0.5 }), comb: [0, 0, -1] }))
    }
    // hind
    ell([0.165 * s, 0.79, -0.53], [0.105, 0.18, 0.22], L('fem', { dir: sub(h('knee'), h('hip')), k: 0.08, comb: COMB_BODY }))
    ell([0.15 * s, 0.8, -0.66], [0.085, 0.14, 0.1], L('fem', { comb: COMB_BODY })) // hamstrings
    cone(h('hip'), h('knee'), 0.1, 0.075, L('fem'))
    cone(h('knee'), [0.17 * s, 0.41, -0.75], 0.076, 0.046, L('tib'))
    ell([0.174 * s, 0.56, -0.53], [0.068, 0.075, 0.14], L('tib', { dir: sub(h('hock'), h('knee')) })) // gaskin
    ell([0.17 * s, 0.415, -0.785], [0.035, 0.04, 0.035], L('mt', { k: 0.03 })) // point of the hock
    cone(h('hock'), [0.17 * s, 0.07, -0.67], 0.045, 0.052, L('mt', { k: 0.04 }))
    ell([0.17 * s, 0.042, -0.65], [0.062, 0.042, 0.078], L('hpaw', { k: 0.03, reg: R({ fur: 0.6 }), comb: [0, 0, -1] }))
    for (const dx of [-0.038, -0.013, 0.013, 0.038]) {
      ell([(0.17 + dx) * s, 0.031, -0.597 - Math.abs(dx) * 0.5], [0.022, 0.028, 0.028], L('hpaw', { k: 0.012, reg: R({ fur: 0.5 }), comb: [0, 0, -1] }))
    }
  }

  // --- Tail ---
  for (let i = 0; i < TAIL.length - 1; i++) {
    const t0 = i / (TAIL.length - 1)
    const t1 = (i + 1) / (TAIL.length - 1)
    const rA = 0.048 + (0.022 - 0.048) * t0
    const rB = 0.048 + (0.022 - 0.048) * t1
    cone(TAIL[i], TAIL[i + 1], rA, rB, { bone: `tail${i}`, k: 0.03, comb: norm(sub(TAIL[i + 1], TAIL[i])), reg: R({ fur: 0.8 }) })
  }
  const tip = TAIL[TAIL.length - 1]
  const tipDir = norm(sub(tip, TAIL[TAIL.length - 2]))
  ell(lerp3(tip, [tip[0], tip[1] - 0.02, tip[2] + 0.012], 1), [0.03, 0.055, 0.03], {
    bone: `tail${TAIL.length - 2}`,
    k: 0.03,
    comb: tipDir,
    reg: R({ dark: 1, fur: 2 }),
    tag: 'tuft',
  })

  return P
}

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}
function segDist(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2]
  const t = Math.min(Math.max(((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / (abx * abx + aby * aby + abz * abz), 0), 1)
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t, p[2] - a[2] - abz * t)
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])

// Coat markings that depend on where a point is rather than which shape it
// came from: pale underside and inner legs, dark eye-liner, lips, pads and
// ear backs, pale patches around the eyes.
export function markings(p, n, a, tags) {
  const s = p[0] >= 0 ? 1 : -1
  if (p[1] < 0.95 && p[2] > -0.85 && p[2] < 0.62) a.light = Math.max(a.light, smooth(-0.2, -0.75, n[1]) * 0.85)
  if (p[1] < 0.78 && Math.abs(p[0]) > 0.06) a.light = Math.max(a.light, smooth(0.2, 0.75, -s * n[0]) * 0.5)
  if (p[1] < 0.036 && n[1] < -0.35) {
    a.dark = Math.max(a.dark, 0.92)
    a.fur = 0
  }
  if (p[1] > 1.0 && p[2] > 0.9) {
    const e = X(EYE, s)
    const de = dist(p, e) - 0.027
    if (de < 0.016) {
      const k = 1 - Math.max(de, 0) / 0.016
      a.dark = Math.max(a.dark, k * 0.95)
      a.light *= 1 - k
      a.mane *= 1 - k
    }
    if (dist(p, [0.06 * s, 1.264, 1.083]) < 0.022) a.light = Math.max(a.light, 0.75)
    if (dist(p, [0.074 * s, 1.21, 1.08]) < 0.018) a.light = Math.max(a.light, 0.7)
    // tear line running down from the inner corner of the eye
    const dt = segDist(p, [0.052 * s, 1.222, 1.088], [0.05 * s, 1.17, 1.14])
    if (dt < 0.008) a.dark = Math.max(a.dark, 0.55 * (1 - dt / 0.008))
    // lips
    const dl = segDist(p, [0.075 * s, 1.086, 1.02], [0.016 * s, 1.098, 1.2])
    if (dl < 0.013) {
      a.dark = Math.max(a.dark, 1 - dl / 0.013)
      a.fur *= dl / 0.013
    }
  }
  if (tags.ear > 0.4 && n[2] < -0.1) a.dark = Math.max(a.dark, 0.7 * smooth(-0.1, -0.5, n[2]))
  if (tags.ear > 0.4 && n[2] > 0.3) a.light = Math.max(a.light, 0.5)
}
