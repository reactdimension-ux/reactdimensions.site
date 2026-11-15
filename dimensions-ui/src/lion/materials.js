import * as THREE from 'three'

// Shared uniforms: changing a colour updates every layer at once.
export function furUniforms() {
  return {
    uCoat: { value: new THREE.Color('#c08a4a') },
    uLight: { value: new THREE.Color('#ead7b4') },
    uMane: { value: new THREE.Color('#7a4a22') },
    uManeTip: { value: new THREE.Color('#2a1710') },
    uDark: { value: new THREE.Color('#1a110c') },
    uFurLen: { value: 0.018 },
    uTime: { value: 0 },
    uMove: { value: 0 },
  }
}

const NOISE = /* glsl */ `
float lionHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float lionNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lionHash(i), lionHash(i + vec3(1,0,0)), f.x), mix(lionHash(i + vec3(0,1,0)), lionHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(lionHash(i + vec3(0,0,1)), lionHash(i + vec3(1,0,1)), f.x), mix(lionHash(i + vec3(0,1,1)), lionHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float lionHash2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`

// One layer of the coat. h = 0 is the skin; h > 0 is a fur shell pushed out
// along the normal (and swept along the comb direction) by h * fur length,
// keeping only the fragments that fall inside a strand.
export function furMaterial(U, h) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 })
  if (h > 0) m.alphaToCoverage = true
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U)
    sh.uniforms.uH = { value: h }
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aRegion;
attribute vec3 aComb;
uniform float uH;
uniform float uFurLen;
varying vec4 vRegion;
varying vec3 vRest;
varying vec3 vRestN;`,
      )
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
vRegion = aRegion;
vRest = position;
vRestN = normal;
#ifdef USE_SKINNING
vec3 combDir = (skinMatrix * vec4(aComb, 0.0)).xyz;
#else
vec3 combDir = aComb;
#endif
float furL = aRegion.w * uFurLen * uH;
transformed += normalize(objectNormal) * furL + combDir * furL * uH * 0.9 - vec3(0.0, furL * uH * 0.25, 0.0);`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uH;
uniform vec3 uCoat;
uniform vec3 uLight;
uniform vec3 uMane;
uniform vec3 uManeTip;
uniform vec3 uDark;
varying vec4 vRegion;
varying vec3 vRest;
varying vec3 vRestN;
${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 furC = uCoat * (0.9 + 0.2 * lionNoise(vRest * 7.0));
furC = mix(furC, uLight, vRegion.y);
furC = mix(furC, mix(uMane, uManeTip, clamp(uH * 0.9 + (lionNoise(vRest * 14.0) - 0.5) * 0.6, 0.0, 1.0)), vRegion.x);
furC = mix(furC, uDark, vRegion.z);
diffuseColor.rgb = furC;
if (uH > 0.0) {
  vec3 an = abs(vRestN);
  vec2 q = an.x > an.y && an.x > an.z ? vRest.zy : (an.y > an.z ? vRest.xz : vRest.xy);
  q *= mix(300.0, 130.0, vRegion.x);
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  float r1 = lionHash2(cell);
  float r2 = lionHash2(cell + 17.31);
  vec2 cc = (vec2(r1, r2) - 0.5) * 0.45;
  float len = 0.4 + 0.6 * lionHash2(cell + 5.17);
  float hh = uH / len;
  if (hh > 1.0 || vRegion.w < 0.02) discard;
  float rad = 0.62 * (1.0 - hh * 0.8);
  float a = 1.0 - smoothstep(rad * 0.55, rad, length(f - cc));
  if (a < 0.03) discard;
  diffuseColor.a = a;
  diffuseColor.rgb *= mix(0.68, 1.1, uH) * (0.9 + 0.2 * r1);
} else {
  diffuseColor.rgb *= 0.72;
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.42, (1.0 - smoothstep(0.0, 0.08, vRegion.w)) * vRegion.z);`,
      )
  }
  m.customProgramCacheKey = () => 'lion-fur'
  return m
}

// Mane, tuft and whisker clumps. The normals are those of the skin they grow
// from, so a clump shades like part of the coat's volume, not like a flat card.
export function hairMaterial(U, alpha) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, side: THREE.DoubleSide, alphaMap: alpha, alphaTest: 0.2 })
  m.alphaToCoverage = true
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U)
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec4 aHair;
varying vec4 vHair;
uniform float uTime;
uniform float uMove;`,
      )
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
vHair = aHair;
float ht = aHair.x;
float sway = step(aHair.y, 1.5) * ht * ht * aHair.w * (0.05 + 0.12 * uMove);
transformed += vec3(sin(uTime * 1.9 + aHair.z * 40.0), 0.25 * sin(uTime * 3.1 + aHair.z * 17.0), cos(uTime * 1.4 + aHair.z * 31.0)) * sway;`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uMane;
uniform vec3 uManeTip;
uniform vec3 uDark;
varying vec4 vHair;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float ht = vHair.x;
vec3 hc = mix(uMane, uManeTip, smoothstep(0.15, 1.0, ht + (vHair.z - 0.5) * 0.5)) * (0.78 + 0.44 * vHair.z);
hc *= mix(0.5, 1.0, smoothstep(0.0, 0.4, ht));
if (vHair.y > 0.5 && vHair.y < 1.5) hc = uDark * (0.8 + 0.5 * vHair.z);
if (vHair.y > 1.5) hc = vec3(0.9, 0.88, 0.83);
diffuseColor.rgb = hc;`,
      )
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>\nif (vHair.y > 1.5) diffuseColor.a = 1.0;`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>\nnormal = normalize(vNormal);`)
  }
  m.customProgramCacheKey = () => 'lion-hair'
  return m
}

// Amber iris with fine radial fibres, a darker limbal ring and a round pupil.
export function irisTexture(color) {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const m = S / 2
  const base = new THREE.Color(color)
  const hex = (col) => `#${col.getHexString()}`
  const light = base.clone().lerp(new THREE.Color('#fff1c4'), 0.4)
  const deep = base.clone().multiplyScalar(0.55)
  const grad = g.createRadialGradient(m, m, 0, m, m, m)
  grad.addColorStop(0, hex(deep))
  grad.addColorStop(0.3, hex(light))
  grad.addColorStop(0.62, hex(base))
  grad.addColorStop(0.86, hex(deep))
  grad.addColorStop(0.95, '#1a0d05')
  grad.addColorStop(1, '#1a0d05')
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2 + Math.sin(i * 12.9) * 0.02
    const r0 = m * (0.2 + ((i * 37) % 13) / 100)
    const r1 = m * (0.72 + ((i * 53) % 19) / 100)
    g.strokeStyle = i % 3 === 0 ? 'rgba(255,236,180,0.2)' : 'rgba(60,30,8,0.18)'
    g.lineWidth = 1 + (i % 2)
    g.beginPath()
    g.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0)
    g.lineTo(m + Math.cos(a) * r1, m + Math.sin(a) * r1)
    g.stroke()
  }
  const pg = g.createRadialGradient(m, m, S * 0.13, m, m, S * 0.2)
  pg.addColorStop(0, '#020101')
  pg.addColorStop(1, 'rgba(2,1,1,0)')
  g.fillStyle = pg
  g.beginPath()
  g.arc(m, m, S * 0.2, 0, Math.PI * 2)
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// A spherical cap facing +z with a planar uv for the iris image.
export function irisGeometry(r) {
  const g = new THREE.SphereGeometry(r * 1.003, 32, 12, 0, Math.PI * 2, 0, 1.2)
  g.rotateX(Math.PI / 2)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  const rmax = r * Math.sin(1.2)
  for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * rmax), 0.5 + pos.getY(i) / (2 * rmax))
  return g
}
