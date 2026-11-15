// The dune field's shape, once in GLSL (for the terrain shader) and once in
// JavaScript (for the camera and the blowing sand), built from the same
// constants so they agree.
//
// Dunes are transverse: long crests at right angles to the wind. In wind
// coordinates (u along the crests, w downwind) a ridged value noise, warped
// downwind by its own height so the slip faces steepen, is stretched along
// the crests and summed over three octaves under a slow modulation so some
// dunes stand taller than others. Units are metres.

export const STRETCH = 0.32 // how much slower the shape changes along a crest than across it
export const LEAN = 0.3 // how far a crest is pushed downwind, per unit height: the slip face
export const OCTAVES = [
  [1.0, 1.0, 0.0],
  [0.47, 2.13, 3.7],
  [0.21, 4.31, 1.3],
]

// ---------------------------------------------------------------- GLSL
export const duneGLSL = /* glsl */ `
float dhash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(dhash(i), dhash(i + vec2(1.0, 0.0)), u.x), mix(dhash(i + vec2(0.0, 1.0)), dhash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// a crest: the fold of the noise, rounded off by 'soft' (0 = a knife edge)
float ridge(vec2 q, float soft) {
  float v = vnoise(q) * 2.0 - 1.0;
  float n = 1.0 - (sqrt(v * v + soft * soft) - soft);
  return n * n;
}
// the dune field's height at a point of the ground, in wind coordinates
// already divided by the dune spacing; octaves beyond \`n\` are left out, and
// \`fade\` (0..1) softens the finer two so distant crests do not alias
float duneShape(vec2 q, int n, float fade, float soft) {
  float warp = vnoise(q * 0.5 + 7.3) - 0.5;
  q.y += warp * 0.6;
  float mod1 = 0.45 + 0.7 * vnoise(q * 0.21 + 11.0);
  float h = 0.0;
  vec2 s = vec2(${STRETCH}, 1.0);
  for (int i = 0; i < 3; i++) {
    if (i >= n) break;
    vec3 o = i == 0 ? vec3(${OCTAVES[0].join(', ')}) : i == 1 ? vec3(${OCTAVES[1].join(', ')}) : vec3(${OCTAVES[2].join(', ')});
    vec2 p = q * s * o.y + o.z;
    float r0 = ridge(p, soft);
    // the crest leans downwind by its own height, steepening the slip face
    float r = ridge(p - vec2(0.0, ${LEAN} * r0 * o.x), soft);
    h += r * o.x * (i == 0 ? 1.0 : fade);
  }
  h *= mod1;
  // a gentle swell under everything
  h += (vnoise(q * 0.37 + 23.0) - 0.5) * 0.5;
  return h;
}
`

// ---------------------------------------------------------------- JavaScript
const fract = (x) => x - Math.floor(x)
function dhash(x, y) {
  let px = fract(x * 0.1031)
  let py = fract(y * 0.1031)
  let pz = fract(x * 0.1031)
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33)
  px += d
  py += d
  pz += d
  return fract((px + py) * pz)
}
function vnoise(x, y) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const a = dhash(ix, iy)
  const b = dhash(ix + 1, iy)
  const c = dhash(ix, iy + 1)
  const d = dhash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}
function ridge(x, y, soft) {
  const v = vnoise(x, y) * 2 - 1
  const n = 1 - (Math.sqrt(v * v + soft * soft) - soft)
  return n * n
}
export function duneShape(qx, qy, n = 3, soft = 0.03) {
  const warp = vnoise(qx * 0.5 + 7.3, qy * 0.5 + 7.3) - 0.5
  qy += warp * 0.6
  const mod1 = 0.45 + 0.7 * vnoise(qx * 0.21 + 11, qy * 0.21 + 11)
  let h = 0
  for (let i = 0; i < Math.min(n, 3); i++) {
    const [amp, f, off] = OCTAVES[i]
    const px = qx * STRETCH * f + off
    const py = qy * f + off
    const r0 = ridge(px, py, soft)
    h += ridge(px, py - LEAN * r0 * amp, soft) * amp
  }
  h *= mod1
  h += (vnoise(qx * 0.37 + 23, qy * 0.37 + 23) - 0.5) * 0.5
  return h
}

// A dune field in world units: wind direction in degrees (where it blows
// to), the crest-to-crest spacing and the height of a full dune.
export function duneField({ windDirection = 25, spacing = 120, height = 14 }) {
  const a = (windDirection * Math.PI) / 180
  const wx = Math.sin(a)
  const wz = Math.cos(a)
  const toWind = (x, z) => [(x * wz - z * wx) / spacing, (x * wx + z * wz) / spacing]
  return {
    wind: [wx, wz],
    height: (x, z) => {
      const [u, w] = toWind(x, z)
      return duneShape(u, w) * height
    },
  }
}
