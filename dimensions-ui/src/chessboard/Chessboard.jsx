import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GRAIN, buildPeel, buildWood, mitredRail } from '../gameboard/textures.js'

// An inlaid wooden chessboard: 55 mm squares of walnut and maple veneer, a
// maple stringing line and a walnut border round them, in a moulded, mitred
// hardwood frame, all under a high-gloss lacquer.
//
// The veneer is worked out per square in the shader from the world position:
// each square samples its own window of the shared hardwood grain (so no
// two match), the grain runs one way on dark squares and across on light
// ones, the walnut keeps its strong figure while the maple stays pale and
// quiet, and hairline joints show where the pieces of veneer meet. The
// border's grain follows its own side. The frame is swept from a stepped
// moulding profile (plinth, cove, rounded top band, inner bevel) with the
// game board's mitred-rail builder.

export const CHESS = {
  cell: 0.055,
  stringGap: 0.0025, // from the squares to the stringing line
  string: 0.0016, // the stringing line itself
  border: 0.011, // squares' edge to the frame
  frameW: 0.042,
  frameH: 0.024,
  top: 0.019, // the veneered surface
}
export const GRID = CHESS.cell * 8
export const OPEN = GRID + 2 * CHESS.border
export const OUTER = OPEN / 2 + CHESS.frameW

const { frameW, frameH, top } = CHESS
const f = (n) => n.toFixed(5)

// the moulding, outer bottom edge inwards: [inset, height]; doubled points keep an edge crisp
const PROFILE = (() => {
  const p = [[0, 0], [0, 0], [0, 0.007]]
  // the plinth's rounded top edge, then a small step in
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2)
    p.push([0.0016 - Math.cos(a) * 0.0016, 0.007 + Math.sin(a) * 0.0016])
  }
  p.push([0.0042, 0.0086], [0.0042, 0.0086])
  // a cove sweeping up to the top band
  for (let i = 1; i <= 8; i++) {
    const t = i / 8
    p.push([0.0042 + 0.0068 * Math.sin((t * Math.PI) / 2), 0.0086 + 0.0112 * (1 - Math.cos((t * Math.PI) / 2))])
  }
  // round over onto the flat top
  for (let i = 1; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2)
    p.push([0.011 + 0.0042 - Math.cos(a) * 0.0042, frameH - 0.0042 + Math.sin(a) * 0.0042])
  }
  p.push([0.035, frameH], [0.035, frameH])
  // the inner bevel down to a small lip over the veneer
  p.push([frameW - 0.0018, top + 0.0016], [frameW - 0.0018, top + 0.0016], [frameW, top + 0.0005], [frameW, top], [frameW, top])
  return p
})()

const HASH = `
uvec2 pcg2(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}
vec4 h4(vec2 id) {
  uvec2 a = pcg2(uvec2(ivec2(id) + 200000));
  uvec2 b = pcg2(a ^ uvec2(0x9e3779b9u, 0x7f4a7c15u));
  return vec4(vec2(a), vec2(b)) * (1.0 / 4294967295.0);
}`

function veneerMaterial(uni, peel) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, clearcoatNormalMap: peel, clearcoatNormalScale: new THREE.Vector2(0.12, 0.12) })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uGrain;\nuniform vec3 uDark;\nuniform vec3 uLight;\nuniform vec3 uBand;\nuniform float uStringing;\nvarying vec2 vP;\n${HASH}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float seam = 0.0;
        {
          const float HALF = ${f(GRID / 2)};
          const float CELL = ${f(CHESS.cell)};
          vec2 p = vP;
          vec2 dpx = dFdx(p);
          vec2 dpy = dFdy(p);
          vec2 fw = fwidth(p) + 1e-6;
          vec2 ap = abs(p);
          float m = max(ap.x, ap.y);
          vec3 col;
          // sample the grain along (g.x) and across (g.y) a piece of veneer
          #define GRAIN_AT(g, gx, gy, off) textureGrad(uGrain, vec2((g.x + off.x) / ${f(GRAIN.along)}, (g.y + off.y) / ${f(GRAIN.across)}), vec2(gx.x / ${f(GRAIN.along)}, gx.y / ${f(GRAIN.across)}), vec2(gy.x / ${f(GRAIN.along)}, gy.y / ${f(GRAIN.across)}))
          if (m < HALF) {
            vec2 c = floor((p + HALF) / CELL);
            // a1, at the front left from white's side, is dark
            bool dark = mod(c.x + c.y, 2.0) > 0.5;
            vec4 h = h4(c);
            vec2 g = dark ? p : p.yx;
            vec2 gx = dark ? dpx : dpx.yx;
            vec2 gy = dark ? dpy : dpy.yx;
            float t = (GRAIN_AT(g, gx, gy, (h.xy * vec2(3.0, 0.05))).r - 0.55) / 0.4;
            col = dark ? uDark * mix(0.58, 1.32, t) : uLight * mix(0.9, 1.05, t);
            col *= 0.94 + 0.12 * h.z;
            vec2 q = fract((p + HALF) / CELL);
            vec2 e = min(q, 1.0 - q) * CELL;
            seam = max(1.0 - smoothstep(0.00005, 0.00005 + fw.x, e.x), 1.0 - smoothstep(0.00005, 0.00005 + fw.y, e.y));
          } else {
            // the border, its grain running along each side, mitred at the corners
            bool sideX = ap.x > ap.y;
            vec2 g = sideX ? p.yx : p;
            vec2 gx = sideX ? dpx.yx : dpx;
            vec2 gy = sideX ? dpy.yx : dpy;
            vec2 off = sideX ? vec2(1.7, 0.02) : vec2(0.4, 0.03);
            float t = (GRAIN_AT(g, gx, gy, off).r - 0.55) / 0.4;
            col = uBand * mix(0.6, 1.3, t);
            float s0 = HALF + ${f(CHESS.stringGap)};
            float s1 = s0 + ${f(CHESS.string)};
            float w = max(fw.x, fw.y);
            float line = smoothstep(s0 - w, s0 + w, m) * (1.0 - smoothstep(s1 - w, s1 + w, m));
            col = mix(col, uLight * 1.04, line * uStringing);
            // the border's mitre joints
            float dm = abs(ap.x - ap.y) * 0.7071;
            seam = (1.0 - smoothstep(0.0001, 0.0001 + w, dm)) * step(s1, m);
          }
          col *= 1.0 - 0.22 * seam;
          diffuseColor.rgb = col;
        }`,
      )
  }
  m.customProgramCacheKey = () => 'chess-veneer'
  return m
}

export default function Chessboard({ frameWood = '#a3622b', darkSquare = '#4b2a16', lightSquare = '#e9d8b6', border = '#4b2a16', stringing = true }) {
  const invalidate = useThree((s) => s.invalidate)
  const grain = useMemo(() => buildWood(), [])
  const peel = useMemo(() => {
    const t = buildPeel()
    t.repeat.set(10, 10)
    return t
  }, [])
  const uni = useMemo(() => ({ uGrain: { value: grain }, uDark: { value: new THREE.Color() }, uLight: { value: new THREE.Color() }, uBand: { value: new THREE.Color() }, uStringing: { value: 1 } }), [grain])
  const mats = useMemo(
    () => ({
      veneer: veneerMaterial(uni, peel),
      frame: new THREE.MeshPhysicalMaterial({ map: grain, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.06, clearcoatNormalMap: peel, clearcoatNormalScale: new THREE.Vector2(0.08, 0.08) }),
      core: new THREE.MeshStandardMaterial({ color: '#2a2219', roughness: 0.9 }),
      felt: new THREE.MeshStandardMaterial({ color: '#1c1f24', roughness: 1 }),
    }),
    [uni, peel, grain],
  )
  const rails = useMemo(() => [0, 1, 2, 3].map((i) => mitredRail(PROFILE, OUTER, i * 0.41)), [])
  useLayoutEffect(() => {
    uni.uDark.value.set(darkSquare)
    uni.uLight.value.set(lightSquare)
    uni.uBand.value.set(border)
    uni.uStringing.value = stringing ? 1 : 0
    mats.frame.color.set(frameWood)
    invalidate()
  }, [uni, mats, darkSquare, lightSquare, border, stringing, frameWood, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      rails.forEach((g) => g.dispose())
      grain.dispose()
      peel.dispose()
    },
    [mats, rails, grain, peel],
  )
  const surface = useMemo(() => new THREE.PlaneGeometry(OPEN, OPEN).rotateX(-Math.PI / 2).translate(0, top, 0), [])
  useEffect(() => () => surface.dispose(), [surface])

  return (
    <group>
      {rails.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.frame} rotation-y={(i * Math.PI) / 2} castShadow receiveShadow />
      ))}
      <mesh material={mats.core} position-y={top / 2}>
        <boxGeometry args={[OPEN, top - 0.0004, OPEN]} />
      </mesh>
      <mesh geometry={surface} material={mats.veneer} receiveShadow />
      <mesh material={mats.felt} rotation-x={Math.PI / 2} position-y={0.0003}>
        <planeGeometry args={[OUTER * 2 - 0.004, OUTER * 2 - 0.004]} />
      </mesh>
    </group>
  )
}
