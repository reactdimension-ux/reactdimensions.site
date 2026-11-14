import * as THREE from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Geometry and surface detail for a compact striker-fired pistol.
//
// Units are centimetres. The bore axis is the x axis with the muzzle at +x,
// y is up and +z is the pistol's right side (the ejection port side).
// Overall about 18.6 long, 12.7 high and 3 wide, like a typical compact.

export const SLIDE = { rear: -9.0, front: 9.3, top: 1.55, bottom: -1.3, half: 1.275, chamfer: 0.3 }
export const PORT = { rear: -0.95, front: 2.55, sill: 0.35, wall: 0.3 }
export const TRAVEL = 2.85 // how far the slide runs back
export const GRIP_ANGLE = THREE.MathUtils.degToRad(20)
export const GRIP_DIR = new THREE.Vector2(-Math.sin(GRIP_ANGLE), -Math.cos(GRIP_ANGLE)) // down the grip
export const GRIP_ACROSS = new THREE.Vector2(-Math.cos(GRIP_ANGLE), Math.sin(GRIP_ANGLE)) // front strap -> back strap
export const GRIP_TOP = new THREE.Vector2(-3.0, -3.7) // top of the front strap

const v2 = (x, y) => new THREE.Vector2(x, y)
const along = (p, d, k) => v2(p.x + d.x * k, p.y + d.y * k)

// ---------------------------------------------------------------------------
// 2D helpers

// Fillets every corner of a closed polygon with a small arc so edges catch a
// thin highlight instead of rendering razor sharp.
export function fillet(pts, r, seg = 3) {
  const out = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const da = v2(a.x - p.x, a.y - p.y)
    const db = v2(b.x - p.x, b.y - p.y)
    const la = da.length()
    const lb = db.length()
    const rr = Math.min(r, la * 0.45, lb * 0.45)
    if (rr < 1e-4) {
      out.push(p.clone())
      continue
    }
    da.divideScalar(la)
    db.divideScalar(lb)
    const p0 = along(p, da, rr)
    const p1 = along(p, db, rr)
    for (let s = 0; s <= seg; s++) {
      const t = s / seg
      // quadratic bezier p0 -> p -> p1
      const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p.x + t * t * p1.x
      const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p.y + t * t * p1.y
      out.push(v2(x, y))
    }
  }
  return out
}

function circle(cx, cy, r, seg = 40) {
  const out = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    out.push(v2(cx + Math.cos(a) * r, cy + Math.sin(a) * r))
  }
  return out
}

function signedArea(pts) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

// Moves every vertex of a closed polygon outward (d > 0) or inward along its
// mitred vertex normal. Good enough for the gentle offsets used for chamfers.
function offset(pts, d) {
  const ccw = signedArea(pts) > 0
  const n = pts.length
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const e1 = v2(p.x - a.x, p.y - a.y).normalize()
    const e2 = v2(b.x - p.x, b.y - p.y).normalize()
    // outward normals of the two edges
    const n1 = ccw ? v2(e1.y, -e1.x) : v2(-e1.y, e1.x)
    const n2 = ccw ? v2(e2.y, -e2.x) : v2(-e2.y, e2.x)
    const m = v2(n1.x + n2.x, n1.y + n2.y)
    const len = m.length()
    if (len < 1e-6) return along(p, n1, d)
    m.divideScalar(len)
    const k = d / Math.max(0.35, m.dot(n1))
    return along(p, m, k)
  })
}

// ---------------------------------------------------------------------------
// A prism: a 2D section in the (z, y) plane swept along x from x0 to x1, with
// optional small chamfers on either end and through-holes. This is how the
// slide is built, so its long edges get proper machined chamfers.
export function prism(section, x0, x1, { holes = [], chamferRear = 0, chamferFront = 0, crease = 0.6 } = {}) {
  const outer = signedArea(section) > 0 ? section : [...section].reverse()
  const hs = holes.map((h) => (signedArea(h) < 0 ? h : [...h].reverse()))
  const rings = []
  // a chamfer shrinks the outline; holes stay straight-walled so a hole near
  // an edge can never break through it
  const add = (x, inset) => rings.push({ x, o: inset ? offset(outer, -inset) : outer, h: hs })
  if (chamferRear) add(x0, chamferRear)
  add(x0 + chamferRear, 0)
  add(x1 - chamferFront, 0)
  if (chamferFront) add(x1, chamferFront)

  const pos = []
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d)
  const P = (x, p) => [x, p.y, p.x]
  // walls
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r]
    const B = rings[r + 1]
    const loops = [[A.o, B.o], ...A.h.map((h, k) => [h, B.h[k]])]
    for (const [la, lb] of loops) {
      for (let i = 0; i < la.length; i++) {
        const j = (i + 1) % la.length
        // outline is CCW and holes CW in (z, y), so this order faces out of the material
        quad(P(A.x, la[i]), P(B.x, lb[i]), P(B.x, lb[j]), P(A.x, la[j]))
      }
    }
  }
  // caps
  const cap = (ring, flip) => {
    const tris = THREE.ShapeUtils.triangulateShape(ring.o, ring.h)
    const all = [ring.o, ...ring.h].flat()
    for (const [a, b, c] of tris) {
      const pa = P(ring.x, all[a])
      const pb = P(ring.x, all[b])
      const pc = P(ring.x, all[c])
      if (flip) pos.push(...pa, ...pc, ...pb)
      else pos.push(...pa, ...pb, ...pc)
    }
  }
  cap(rings[0], false)
  cap(rings[rings.length - 1], true)

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return toCreasedNormals(g, crease)
}

// A flat part extruded along z, centred on z = 0, whose rounded edges stay
// inside the outline (so the outline is the true silhouette).
export function slab(shape, width, bevel, segments = 5, curveSegments = 32) {
  const b = Math.min(bevel, width / 2 - 0.01)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - b * 2,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: segments,
    curveSegments,
  })
  g.translate(0, 0, -(width - b * 2) / 2)
  g.deleteAttribute('uv')
  return toCreasedNormals(g, 0.7)
}

// ---------------------------------------------------------------------------
// The slide: three sections swept along x. Behind and in front of the port it
// is a full section with chamfered top edges; through the port it is a U open
// to the top and the right, which the barrel hood fills.
function slideSection() {
  const { top, bottom, half, chamfer } = SLIDE
  return fillet(
    [v2(-half, bottom), v2(half, bottom), v2(half, top - chamfer), v2(half - chamfer, top), v2(-half + chamfer, top), v2(-half, top - chamfer)],
    0.05,
  )
}
function portSection() {
  const { top, bottom, half, chamfer } = SLIDE
  const { sill, wall } = PORT
  return fillet(
    [
      v2(-half, bottom),
      v2(half, bottom),
      v2(half, sill),
      v2(half - wall, sill),
      v2(half - wall, -0.8),
      v2(-half + wall, -0.8),
      v2(-half + chamfer, top),
      v2(-half, top - chamfer),
    ],
    0.035,
  )
}

export function buildSlide() {
  const front = prism(slideSection(), PORT.front, SLIDE.front, {
    // the barrel and the recoil spring guide rod come through the nose
    holes: [circle(0, 0, 0.71, 64), circle(0, -0.97, 0.195, 32)],
    chamferFront: 0.07,
  })
  const port = prism(portSection(), PORT.rear, PORT.front)
  const rear = prism(slideSection(), SLIDE.rear, PORT.rear, { chamferRear: 0.06 })
  return mergeGeometries([rear, port, front])
}

// The barrel's rectangular hood that fills the ejection port, and the tube.
export function buildHood() {
  const z0 = -SLIDE.half + PORT.wall + 0.025
  const z1 = SLIDE.half - 0.03
  const sec = fillet([v2(z0, -0.72), v2(z1, -0.72), v2(z1, SLIDE.top - 0.03), v2(z0, SLIDE.top - 0.03)], 0.06)
  return prism(sec, PORT.rear + 0.025, PORT.front + 0.4, { chamferRear: 0.03 })
}

export function buildBarrel() {
  // a surface of revolution around x: outer tube and the crowned muzzle
  const x1 = SLIDE.front + 0.03
  const x0 = PORT.front - 0.2
  const prof = [v2(0.448, x1 - 0.02), v2(0.5, x1), v2(0.64, x1), v2(0.68, x1 - 0.04), v2(0.68, x0)]
  const g = new THREE.LatheGeometry(prof, 64)
  g.rotateZ(-Math.PI / 2)
  g.computeVertexNormals()
  // bore: dark tube with rifling-free interior, ends deep inside
  const bore = new THREE.CylinderGeometry(0.449, 0.449, 3.2, 48, 1, true)
  bore.rotateZ(Math.PI / 2)
  bore.translate(x1 - 1.6 - 0.02, 0, 0)
  const plug = new THREE.CircleGeometry(0.45, 32).rotateY(Math.PI / 2).translate(x1 - 3.0, 0, 0)
  return { tube: g, bore, plug }
}

// ---------------------------------------------------------------------------
// The frame: an upper part as wide as the rails, the trigger guard and the
// grip, each extruded from its side profile and rounded off.

export function buildUpperFrame() {
  const s = new THREE.Shape()
  s.moveTo(7.6, -1.2)
  s.lineTo(7.6, -2.2)
  s.quadraticCurveTo(7.6, -2.55, 7.25, -2.55)
  s.lineTo(-2.3, -2.55)
  s.lineTo(-7.2, -2.55)
  // beavertail: a short tang over the web of the hand
  s.bezierCurveTo(-8.0, -2.5, -8.65, -2.2, -9.15, -1.95)
  s.quadraticCurveTo(-9.32, -1.86, -9.2, -1.65)
  s.lineTo(-8.85, -1.2)
  s.lineTo(7.6, -1.2)
  return slab(s, 2.35, 0.13, 4)
}

export function buildGuard() {
  const s = new THREE.Shape()
  s.moveTo(3.4, -2.3)
  s.lineTo(4.05, -2.3)
  s.lineTo(4.3, -4.55) // squared front, raked slightly forward
  s.quadraticCurveTo(4.33, -4.98, 3.9, -4.98)
  s.lineTo(0.4, -4.98)
  s.bezierCurveTo(-1.3, -4.98, -2.4, -4.6, -3.35, -3.85)
  s.lineTo(-2.8, -3.3)
  s.bezierCurveTo(-2.2, -3.95, -1.2, -4.42, 0.4, -4.42)
  s.lineTo(3.45, -4.42)
  s.quadraticCurveTo(3.72, -4.42, 3.7, -4.18)
  s.lineTo(3.45, -2.3)
  s.lineTo(3.4, -2.3)
  return slab(s, 1.5, 0.32, 5)
}

// grip outline, front strap down, across the magwell, back strap up
function gripPoints() {
  const d = GRIP_DIR
  const a = GRIP_ACROSS
  const ft = GRIP_TOP
  const fb = along(ft, d, 6.35) // front strap bottom
  const bb = along(fb, a, 4.55) // back strap bottom
  const bt = along(bb, d, -6.1) // back strap top
  return { ft, fb, bb, bt }
}

export const GRIP = gripPoints()

export function buildGrip() {
  const { ft, fb, bb, bt } = GRIP
  const d = GRIP_DIR
  const a = GRIP_ACROSS
  const s = new THREE.Shape()
  s.moveTo(-2.1, -2.35)
  s.lineTo(-7.1, -2.35)
  // back strap, swelling slightly into the palm
  s.quadraticCurveTo(bt.x + 0.05, bt.y + 0.05, along(bt, d, 0.8).x, along(bt, d, 0.8).y)
  const mid = along(along(bt, d, 3.2), a, 0.12)
  s.quadraticCurveTo(mid.x, mid.y, along(bb, d, -0.6).x, along(bb, d, -0.6).y)
  // flared magwell corner at the back
  const bc = along(bb, a, 0.12)
  s.quadraticCurveTo(bc.x, bc.y, along(bb, a, -0.35).x, along(bb, a, -0.35).y)
  // the magwell mouth (bottom), straight across
  const fc = along(fb, a, -0.1)
  s.lineTo(along(fb, a, 0.35).x, along(fb, a, 0.35).y)
  s.quadraticCurveTo(fc.x, fc.y, along(fb, d, -0.5).x, along(fb, d, -0.5).y)
  // front strap, a gentle belly
  const fm = along(along(ft, d, 3.0), a, -0.08)
  s.quadraticCurveTo(fm.x, fm.y, ft.x, ft.y)
  s.quadraticCurveTo(-2.7, -3.2, -2.1, -2.35)
  return slab(s, 2.95, 0.62, 7, 48)
}

// The magazine: body inside the grip plus the baseplate under it, drawn in
// grip space and placed by the caller.
export function buildMagazine() {
  const { fb, bb } = GRIP
  const d = GRIP_DIR
  const a = GRIP_ACROSS
  // baseplate: a touch proud of the grip all round, with a small front lip
  const f0 = along(along(fb, a, -0.06), d, -0.05)
  const b0 = along(along(bb, a, 0.05), d, -0.05)
  const s = new THREE.Shape()
  s.moveTo(f0.x, f0.y)
  const fl = along(f0, d, 0.62)
  s.lineTo(along(fl, a, -0.08).x, along(fl, a, -0.08).y)
  s.lineTo(along(along(b0, d, 0.55), a, 0).x, along(along(b0, d, 0.55), a, 0).y)
  s.lineTo(b0.x, b0.y)
  s.lineTo(f0.x, f0.y)
  const base = slab(s, 2.75, 0.22, 4)
  // body: a steel box running up the grip
  const t0 = along(along(fb, a, 0.55), d, -7.1)
  const t1 = along(along(bb, a, -0.55), d, -7.1)
  const m = new THREE.Shape()
  m.moveTo(along(fb, a, 0.55).x, along(fb, a, 0.55).y)
  m.lineTo(along(bb, a, -0.55).x, along(bb, a, -0.55).y)
  m.lineTo(t1.x, t1.y)
  m.lineTo(t0.x, t0.y)
  m.lineTo(along(fb, a, 0.55).x, along(fb, a, 0.55).y)
  const body = slab(m, 1.9, 0.1, 2)
  return { base, body }
}

export function buildTrigger() {
  // Drawn about its pivot at the origin, +x towards the muzzle. The blade
  // hangs almost straight down; its front (finger) face is gently concave and
  // the tip curls slightly forward, the back face runs parallel behind it.
  const s = new THREE.Shape()
  s.moveTo(-0.3, 0.1)
  s.lineTo(0.12, 0.1)
  s.lineTo(0.14, -0.15)
  s.quadraticCurveTo(-0.12, -0.95, 0.24, -1.62) // front face
  s.quadraticCurveTo(0.27, -1.8, 0.06, -1.76) // rounded tip
  s.quadraticCurveTo(-0.5, -0.92, -0.3, -0.1) // back face
  s.lineTo(-0.3, 0.1)
  const shoe = slab(s, 0.62, 0.12, 4)
  // the safety lever in the middle of the face: stands proud of the front,
  // most at the bottom, and pivots flush when the finger presses it
  const b = new THREE.Shape()
  b.moveTo(0.1, -0.5)
  b.quadraticCurveTo(0.0, -0.97, 0.25, -1.42)
  b.lineTo(0.06, -1.47)
  b.quadraticCurveTo(-0.24, -0.95, -0.1, -0.5)
  b.lineTo(0.1, -0.5)
  const blade = slab(b, 0.16, 0.04, 2)
  return { shoe, blade }
}

export function buildRearSight() {
  // section in (z, y): a dovetailed block with a U notch
  const y0 = SLIDE.top - 0.02
  const h = 0.48
  const nw = 0.17
  const nd = 0.24
  const poly = [v2(-0.78, y0), v2(0.78, y0), v2(0.62, y0 + h), v2(nw, y0 + h), v2(nw, y0 + h - nd + 0.06), v2(nw * 0.7, y0 + h - nd), v2(-nw * 0.7, y0 + h - nd), v2(-nw, y0 + h - nd + 0.06), v2(-nw, y0 + h), v2(-0.62, y0 + h)]
  return prism(fillet(poly, 0.03), -8.72, -7.95, { chamferRear: 0.03, chamferFront: 0.08 })
}

export function buildFrontSight() {
  const y0 = SLIDE.top - 0.02
  const poly = [v2(-0.17, y0), v2(0.17, y0), v2(0.16, y0 + 0.45), v2(-0.16, y0 + 0.45)]
  return prism(fillet(poly, 0.03), 8.25, 8.8, { chamferRear: 0.02, chamferFront: 0.12 })
}

// The white U on the back of the rear sight, as a flat outline.
export function buildSightU() {
  const y0 = SLIDE.top - 0.02 + 0.48 - 0.24
  const s = new THREE.Shape()
  const w = 0.075
  s.moveTo(-0.17 - w, y0 + 0.24)
  s.lineTo(-0.17 - w, y0 + 0.02)
  s.quadraticCurveTo(-0.17 - w, y0 - w, -0.1, y0 - w)
  s.lineTo(0.1, y0 - w)
  s.quadraticCurveTo(0.17 + w, y0 - w, 0.17 + w, y0 + 0.02)
  s.lineTo(0.17 + w, y0 + 0.24)
  s.lineTo(0.17, y0 + 0.24)
  s.lineTo(0.17, y0 + 0.06)
  s.lineTo(0.12, y0)
  s.lineTo(-0.12, y0)
  s.lineTo(-0.17, y0 + 0.06)
  s.lineTo(-0.17, y0 + 0.24)
  s.lineTo(-0.17 - w, y0 + 0.24)
  const g = new THREE.ShapeGeometry(s, 8)
  g.rotateY(-Math.PI / 2) // face -x (towards the shooter)
  g.translate(-8.725, 0, 0)
  return g
}

// Engraved lettering as a transparent decal.
export function textDecal(lines, { w = 512, h = 128, font = '600 64px "Helvetica Neue", Arial, sans-serif', color = 'rgba(20,21,23,0.85)', glow = 'rgba(255,255,255,0.12)' } = {}) {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h })
  const g = c.getContext('2d')
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.font = font
  const lh = h / lines.length
  lines.forEach((t, i) => {
    // a light lower edge sells it as cut into the metal
    g.fillStyle = glow
    g.fillText(t, 4, lh * (i + 0.5) + 2)
    g.fillStyle = color
    g.fillText(t, 4, lh * (i + 0.5))
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// ---------------------------------------------------------------------------
// Procedural surface detail. Each material gets an object-space height field
// (bump), an occlusion term and a roughness offset evaluated in its shader, so
// serrations and grip texture work on every face without UVs and stay crisp
// up close. Fine detail fades out once it gets smaller than a pixel.

const NOISE_GLSL = /* glsl */ `
varying vec3 vRdPos;
varying vec3 vRdN;
float rdHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rdNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rdHash(i + vec3(0,0,0)), rdHash(i + vec3(1,0,0)), f.x), mix(rdHash(i + vec3(0,1,0)), rdHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rdHash(i + vec3(0,0,1)), rdHash(i + vec3(1,0,1)), f.x), mix(rdHash(i + vec3(0,1,1)), rdHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 rdPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float fd) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz)) * length(dFdx(surf_pos.xyz));
  vec3 vSigmaY = dFdy(surf_pos.xyz);
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * fd;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`

// slide: rear and front cocking serrations, plus a faint machining grain
export const SLIDE_DETAIL = /* glsl */ `
void rdEval(vec3 p, vec3 n, out float h, out float ao, out float r) {
  float side = smoothstep(0.55, 0.85, abs(n.z));
  float pitch = 0.3;
  float u = p.x / pitch;
  float f = fract(u);
  float g = smoothstep(0.0, 0.14, f) * (1.0 - smoothstep(0.38, 0.52, f));
  float mR = smoothstep(-8.78, -8.74, p.x) * (1.0 - smoothstep(-6.62, -6.58, p.x));
  float mF = smoothstep(5.72, 5.76, p.x) * (1.0 - smoothstep(8.1, 8.14, p.x));
  float my = smoothstep(-1.02, -0.96, p.y) * (1.0 - smoothstep(1.42, 1.5, p.y));
  float aa = clamp(1.6 - fwidth(u) * 2.2, 0.0, 1.0);
  float s = g * (mR + mF) * my * side;
  h = -0.035 * s * aa;
  ao = 1.0 - 0.42 * s;
  float grain = rdNoise(p * vec3(3.0, 90.0, 90.0));
  h += (grain - 0.5) * 0.0012;
  r = (grain - 0.5) * 0.06 + 0.06 * s;
}
`

// polymer frame: a fine moulded texture everywhere, coarse stipple panels on
// the grip (sides, front and back strap) with a crisp border line
export const GRIP_DETAIL = /* glsl */ `
uniform vec2 uGripTop;
uniform vec2 uGripDir;
void rdEval(vec3 p, vec3 n, out float h, out float ao, out float r) {
  vec2 q = p.xy - uGripTop;
  float u = dot(q, uGripDir);
  float m = smoothstep(0.55, 0.62, u) * (1.0 - smoothstep(5.55, 5.62, u));
  vec3 sp = p * 12.0;
  float s = rdNoise(sp) * 0.62 + rdNoise(sp * 2.37 + 7.0) * 0.38;
  s = smoothstep(0.38, 0.72, s);
  float aa = 1.0 - smoothstep(0.45, 1.1, length(fwidth(sp)));
  float line = (1.0 - smoothstep(0.0, 0.035, abs(u - 0.5))) + (1.0 - smoothstep(0.0, 0.035, abs(u - 5.67)));
  float fine = rdNoise(p * 70.0);
  h = 0.018 * s * m * aa - 0.025 * line + 0.0006 * fine;
  ao = 1.0 - (0.28 * (1.0 - s) * m * aa) - 0.4 * line;
  r = 0.22 * m + (fine - 0.5) * 0.05;
}
`

export const POLY_DETAIL = /* glsl */ `
void rdEval(vec3 p, vec3 n, out float h, out float ao, out float r) {
  float fine = rdNoise(p * 70.0);
  float soft = rdNoise(p * 9.0);
  h = 0.0007 * fine;
  ao = 1.0;
  r = (fine - 0.5) * 0.05 + (soft - 0.5) * 0.06;
}
`

export const METAL_DETAIL = /* glsl */ `
void rdEval(vec3 p, vec3 n, out float h, out float ao, out float r) {
  float grain = rdNoise(p * vec3(4.0, 120.0, 120.0));
  h = (grain - 0.5) * 0.0008;
  ao = 1.0;
  r = (grain - 0.5) * 0.08;
}
`

export function withDetail(material, detail, uniforms = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRdPos;\nvarying vec3 vRdN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRdPos = transformed;\nvRdN = objectNormal;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\n${detail}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat rdH; float rdAO; float rdR;\nrdEval(vRdPos, normalize(vRdN), rdH, rdAO, rdR);\ndiffuseColor.rgb *= rdAO;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + rdR, 0.04, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = rdPerturb(-vViewPosition, normal, vec2(dFdx(rdH), dFdy(rdH)), faceDirection);')
  }
  material.customProgramCacheKey = () => detail
  return material
}
