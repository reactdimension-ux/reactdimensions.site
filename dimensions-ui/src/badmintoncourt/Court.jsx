import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { COURT, EMBOSS_TILE, FX, FZ, GRAIN, MAT_T, MX, MZ, ROLL, ROLL0, SLAB, buildEmboss, buildFeather, buildGrain, buildWear } from './textures.js'

// A BWF badminton court as it is laid in a sports hall: a green PVC court
// mat, rolled out in four lengths with welded seams, on a varnished maple
// strip floor; the net on weighted, wheeled posts.
//
// Both surfaces are worked out in their shaders from the world position:
//   the floor: 57 mm maple strips in random lengths with staggered joints,
//     each board its own window of a grain texture and its own shade, under
//     a glossy clearcoat that mirrors the hall lights;
//   the mat: exact 40 mm lines (antialiased, sharp at any zoom), the roll
//     seams, an embossed "sand" finish, and sole marks and dull patches
//     where play happens.
// The net is a box-filtered 19 mm mesh (no shimmer at a distance) under a
// 75 mm white tape, 1.55 m at the posts and 1.524 m at the centre.

const { L2, W2, S2, short, longD, line, netPost, netCentre, netDepth, tape, postR } = COURT
const f = (n) => n.toFixed(4)
const TOP = MAT_T // the playing surface

// shared GLSL: a small integer hash
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

function floorMaterial(uni) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.12 })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uGrain;\nuniform vec3 uWood;\nvarying vec2 vWP;\n${HASH}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float woodGap;
        {
          const float BW = 0.057; // strip width
          vec2 p = vWP;
          float rowF = p.y / BW + 1000.0;
          float row = floor(rowF);
          vec4 hr = h4(vec2(row, 3.0));
          float segLen = mix(0.7, 2.3, hr.x);
          float sx = (p.x + 60.0 + hr.y * 7.0) / segLen;
          float seg = floor(sx);
          vec4 hb = h4(vec2(row, seg + 17.0));
          vec2 guv = vec2((fract(sx) * segLen + hb.x * 5.0) / ${f(GRAIN.along)}, (fract(rowF) * BW + hb.y * 0.24) / ${f(GRAIN.across)});
          // gradients from the continuous position, so joints don't upset the mip level
          vec2 gdx = vec2(dFdx(p.x) / ${f(GRAIN.along)}, dFdx(p.y) / ${f(GRAIN.across)});
          vec2 gdy = vec2(dFdy(p.x) / ${f(GRAIN.along)}, dFdy(p.y) / ${f(GRAIN.across)});
          vec4 g = textureGrad(uGrain, guv, gdx, gdy);
          vec3 c = uWood * (0.6 + 0.8 * g.r);
          c *= mix(0.84, 1.1, hb.z);
          c = mix(c, c * vec3(1.06, 0.95, 0.84), hb.w * 0.7);
          c *= 0.93 + 0.14 * g.g;
          vec2 fw = fwidth(p) + 1e-6;
          float dy = min(fract(rowF), 1.0 - fract(rowF)) * BW;
          float dx = min(fract(sx), 1.0 - fract(sx)) * segLen;
          woodGap = max(1.0 - smoothstep(0.0003, 0.0003 + fw.y, dy), 1.0 - smoothstep(0.0003, 0.0003 + fw.x, dx));
          c *= 1.0 - 0.6 * woodGap;
          diffuseColor.rgb *= c;
        }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.9, woodGap);')
  }
  m.customProgramCacheKey = () => 'badminton-floor'
  return m
}

function matMaterial(uni) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, normalScale: new THREE.Vector2(1, 1) })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCP = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uMat;
        uniform vec3 uLine;
        uniform float uWear;
        uniform sampler2D uWearMap;
        varying vec2 vCP;
        float box(vec2 p, vec4 r, vec2 w) {
          vec2 a = smoothstep(r.xy - w, r.xy + w, p);
          vec2 b = 1.0 - smoothstep(r.zw - w, r.zw + w, p);
          return a.x * a.y * b.x * b.y;
        }
        // every line is symmetric about both axes, so test |p|
        float courtLines(vec2 q, vec2 w) {
          float m = box(q, vec4(${f(L2 - line)}, -1.0, ${f(L2)}, ${f(W2)}), w);                      // back boundary
          m = max(m, box(q, vec4(-1.0, ${f(W2 - line)}, ${f(L2)}, ${f(W2)}), w));                    // doubles sidelines
          m = max(m, box(q, vec4(-1.0, ${f(S2 - line)}, ${f(L2)}, ${f(S2)}), w));                    // singles sidelines
          m = max(m, box(q, vec4(${f(L2 - longD - line)}, -1.0, ${f(L2 - longD)}, ${f(W2)}), w));    // doubles long service line
          m = max(m, box(q, vec4(${f(short)}, -1.0, ${f(short + line)}, ${f(W2)}), w));             // short service line
          m = max(m, box(q, vec4(${f(short)}, -1.0, ${f(L2)}, ${f(line / 2)}), w));                 // centre line
          return m;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec4 emb = texture2D(normalMap, vNormalMapUv);
        vec4 wm = texture2D(uWearMap, vCP / vec2(${f(2 * MX)}, ${f(2 * MZ)}) + 0.5);
        float lineM;
        float seamM;
        {
          vec2 w = fwidth(vCP) * 0.7 + 1e-5;
          vec2 q = abs(vCP + (vec2(emb.a, emb.r) - 0.5) * 0.0006);
          lineM = courtLines(q, w);
          // welded seams between the rolls
          float sz = (vCP.y - ${f(ROLL0)}) / ${f(ROLL)};
          float ds = abs(fract(sz + 0.5) - 0.5) * ${f(ROLL)};
          seamM = (1.0 - smoothstep(0.0005, 0.0005 + w.y, ds)) * step(-0.5, sz) * step(sz, 2.5);
          vec3 col = uMat * (0.91 + 0.18 * wm.a);
          col = mix(col, col * 1.12 + vec3(0.01), wm.g * uWear * 0.6);
          col = mix(col, uLine * (0.96 + 0.04 * wm.a), lineM);
          col *= 1.0 - 0.35 * seamM;
          col = mix(col, vec3(0.03), clamp(wm.r * uWear * 0.7, 0.0, 0.7));
          col *= 0.8 + 0.4 * emb.a;
          diffuseColor.rgb *= col;
        }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.5, 0.42, lineM) + wm.g * uWear * 0.2 + seamM * 0.2;')
  }
  m.customProgramCacheKey = () => 'badminton-mat'
  return m
}

// the net: a box-filtered grid (lines at integer cells, 1/N of a cell wide)
function netMaterial(uni) {
  const m = new THREE.MeshStandardMaterial({ color: '#2a1915', roughness: 0.6, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 gridUv;\nvarying vec2 vGrid;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrid = gridUv;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vGrid;
        uniform float uCell;
        uniform float uTwine;
        float holes(vec2 p, vec2 w, float N) {
          vec2 a = p + 0.5 * w;
          vec2 b = p - 0.5 * w;
          vec2 i = (floor(a) + min(fract(a) * N, 1.0) - floor(b) - min(fract(b) * N, 1.0)) / (N * w);
          return (1.0 - i.x) * (1.0 - i.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vGrid / uCell + vec2(0.5, 0.0);
          vec2 w = max(abs(dFdx(p)), abs(dFdy(p))) + 0.004;
          float cover = 1.0 - holes(p, w, uCell / uTwine);
          vec2 k = abs(fract(p) - vec2(0.5 * uTwine / uCell));
          float knot = 1.0 - smoothstep(uTwine * 0.9 / uCell, uTwine * 0.9 / uCell + max(w.x, w.y), length(min(k, 1.0 - k)));
          cover = max(cover, knot * (1.0 - smoothstep(0.05, 0.3, max(w.x, w.y))));
          diffuseColor.a *= cover;
          if (diffuseColor.a < 0.004) discard;
        }`,
      )
  }
  m.customProgramCacheKey = () => 'badminton-net-mesh'
  return m
}

// ---- net ----
const NET_END = W2 - postR - 0.012
const SAG = 0.008
function cordY(z) {
  const u = Math.min(1, Math.abs(z) / W2)
  return TOP + netCentre + (netPost - netCentre) * u - SAG * Math.sin(Math.PI * u)
}
const NC = 160
const NR = 14
const BAND = [
  [-0.0025, -tape],
  [-0.0025, -0.003],
  [-0.0018, -0.0008],
  [0, 0.0003],
  [0.0018, -0.0008],
  [0.0025, -0.003],
  [0.0025, -tape],
]

function netGeometries() {
  const pos = []
  const grid = []
  const idx = []
  for (let i = 0; i <= NC; i++) {
    const z = -NET_END + (2 * NET_END * i) / NC
    const top = cordY(z)
    const u = Math.abs(z) / W2
    for (let j = 0; j <= NR; j++) {
      const v = j / NR
      const y = top - netDepth * v
      pos.push(0.006 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u), y, z)
      grid.push(z + NET_END, top - y)
    }
  }
  for (let i = 0; i < NC; i++)
    for (let j = 0; j < NR; j++) {
      const a = i * (NR + 1) + j
      const b = (i + 1) * (NR + 1) + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const net = new THREE.BufferGeometry()
  net.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  net.setAttribute('gridUv', new THREE.Float32BufferAttribute(grid, 2))
  net.setIndex(idx)
  net.computeVertexNormals()

  const bp = []
  const bi = []
  const P = BAND.length
  for (let i = 0; i <= NC; i++) {
    const z = -NET_END + (2 * NET_END * i) / NC
    const top = cordY(z)
    for (const [dx, dy] of BAND) bp.push(dx, top + dy, z)
  }
  for (let i = 0; i < NC; i++)
    for (let k = 0; k < P - 1; k++) {
      const a = i * P + k
      const b = (i + 1) * P + k
      bi.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const band = new THREE.BufferGeometry()
  band.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3))
  band.setIndex(bi)
  band.computeVertexNormals()
  return { net, band }
}

function Net({ mats }) {
  const geo = useMemo(() => netGeometries(), [])
  useEffect(() => () => (geo.net.dispose(), geo.band.dispose()), [geo])
  const endTop = cordY(NET_END)
  return (
    <group>
      <mesh geometry={geo.net} material={mats.net} renderOrder={2} />
      <mesh geometry={geo.band} material={mats.tape} castShadow receiveShadow />
      {[1, -1].map((s) => (
        <group key={s}>
          {/* the tension cord, out of the tape to the post */}
          <mesh material={mats.cord} position={[0, endTop - 0.002, s * (NET_END + W2 - postR) / 2]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.0022, 0.0022, W2 - postR - NET_END + 0.004, 8]} />
          </mesh>
          {/* the side edge, tied to the post top and bottom */}
          <mesh material={mats.cord} position={[0, endTop - netDepth / 2, s * NET_END]}>
            <cylinderGeometry args={[0.0028, 0.0028, netDepth, 8]} />
          </mesh>
          <mesh material={mats.cord} position={[0, endTop - netDepth, s * (NET_END + W2 - postR) / 2]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.0018, 0.0018, W2 - postR - NET_END + 0.004, 6]} />
          </mesh>
        </group>
      ))}
      {/* the bottom cord */}
      <mesh material={mats.cord} position-y={cordY(0) - netDepth} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.0022, 0.0022, NET_END * 2, 8]} />
      </mesh>
    </group>
  )
}

// A post on its weighted base: the tube stands on the doubles sideline; the
// base runs out behind it, off the court, with transport wheels at the end.
function Post({ side, color, mats }) {
  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0.1, clearcoat: 0.45, clearcoatRoughness: 0.25 }), [color])
  useEffect(() => () => paint.dispose(), [paint])
  const s = side
  const baseL = 0.56
  const baseH = 0.11
  const zc = s * (W2 + baseL / 2 - 0.07)
  const postBot = TOP + baseH
  const postH = TOP + netPost + 0.012 - postBot
  return (
    <group>
      <RoundedBox args={[0.36, baseH, baseL]} radius={0.025} smoothness={4} position={[0, TOP + baseH / 2 + 0.006, zc]} material={paint} castShadow receiveShadow />
      {/* rubber feet and the wheels at the outer end */}
      {[-0.13, 0.13].map((x) =>
        [s * (W2 + 0.0), s * (W2 + 0.3)].map((z) => (
          <mesh key={`${x}${z}`} material={mats.rubber} position={[x, TOP + 0.003, z]} receiveShadow>
            <boxGeometry args={[0.05, 0.006, 0.05]} />
          </mesh>
        )),
      )}
      {[-0.19, 0.19].map((x) => (
        <mesh key={x} material={mats.rubber} position={[x, TOP + 0.04, s * (W2 + baseL - 0.12)]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 24]} />
        </mesh>
      ))}
      {/* the post, its collar into the base, cap and cord cleat */}
      <mesh material={paint} position={[0, postBot + postH / 2, s * W2]} castShadow receiveShadow>
        <cylinderGeometry args={[postR, postR, postH, 28]} />
      </mesh>
      <mesh material={mats.steel} position={[0, postBot + 0.02, s * W2]}>
        <cylinderGeometry args={[postR + 0.008, postR + 0.01, 0.04, 28]} />
      </mesh>
      <mesh material={mats.cap} position={[0, postBot + postH + 0.006, s * W2]} castShadow>
        <cylinderGeometry args={[postR + 0.002, postR + 0.002, 0.012, 28]} />
      </mesh>
      <mesh material={mats.steel} position={[0, TOP + netPost - 0.004, s * (W2 - postR - 0.004)]} castShadow>
        <boxGeometry args={[0.014, 0.024, 0.01]} />
      </mesh>
      {/* the tension knob, halfway up the outer face */}
      <mesh material={mats.cap} position={[0, TOP + 0.95, s * (W2 + postR + 0.012)]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.016, 0.016, 0.024, 20]} />
      </mesh>
    </group>
  )
}

// ---- shuttlecocks ----
const CORK_R = 0.0128
const SKIRT_L = 0.064 // feather length
const SKIRT_R0 = 0.0105
const SKIRT_R1 = 0.033
// tilt (above horizontal) at which a shuttle on its side rests on cork and rim
const LIE = (() => {
  const g = (a) => (SKIRT_L + 0.008) * Math.sin(a) - SKIRT_R1 * Math.cos(a) + CORK_R
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    if (g(m) > 0) hi = m
    else lo = m
  }
  return lo
})()

function Shuttle({ position, yaw = 0, lying = true, mats }) {
  const feathers = useMemo(() => {
    const out = []
    const n = 16
    const tilt = Math.atan2(SKIRT_R1 - SKIRT_R0, SKIRT_L)
    for (let i = 0; i < n; i++) out.push({ a: (i / n) * Math.PI * 2, tilt })
    return out
  }, [])
  // local +y is the shuttle's axis, cork at the origin
  const rot = lying ? [0, yaw, -(Math.PI / 2 - LIE), 'YXZ'] : [0, yaw, 0, 'YXZ']
  return (
    <group position={[position[0], TOP + CORK_R, position[2]]} rotation={rot}>
      <mesh material={mats.cork} castShadow>
        <sphereGeometry args={[CORK_R, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <mesh material={mats.cork} position-y={0.0045} castShadow>
        <cylinderGeometry args={[CORK_R * 0.98, CORK_R, 0.009, 28]} />
      </mesh>
      <mesh material={mats.ribbon} position-y={0.0085}>
        <cylinderGeometry args={[CORK_R * 0.985, CORK_R * 0.985, 0.0018, 28]} />
      </mesh>
      {feathers.map(({ a, tilt }) => (
        // tilt each feather outwards and turn it a little so they overlap like shingles
        <group key={a} rotation-y={Math.PI / 2 - a}>
          <mesh material={mats.feather} position={[0, 0.008 + SKIRT_L / 2, (SKIRT_R0 + SKIRT_R1) / 2]} rotation={[tilt, 0.28, 0]} castShadow>
            <planeGeometry args={[0.024, SKIRT_L]} />
          </mesh>
        </group>
      ))}
      {/* two rows of binding thread round the skirt */}
      {[0.026, 0.04].map((h) => (
        <mesh key={h} material={mats.thread} position-y={h} rotation-x={Math.PI / 2}>
          <torusGeometry args={[SKIRT_R0 + ((h - 0.008) / SKIRT_L) * (SKIRT_R1 - SKIRT_R0) + 0.0006, 0.0007, 6, 40]} />
        </mesh>
      ))}
    </group>
  )
}

function Edges({ floorEdge, matEdge }) {
  return (
    <group>
      {/* the cut edge of the sprung floor */}
      {[
        [[0, -SLAB / 2, FZ], 0, 2 * FX],
        [[0, -SLAB / 2, -FZ], Math.PI, 2 * FX],
        [[FX, -SLAB / 2, 0], Math.PI / 2, 2 * FZ],
        [[-FX, -SLAB / 2, 0], -Math.PI / 2, 2 * FZ],
      ].map(([p, ry, w], i) => (
        <mesh key={i} position={p} rotation-y={ry} material={floorEdge} receiveShadow>
          <planeGeometry args={[w, SLAB]} />
        </mesh>
      ))}
      <mesh position-y={-SLAB / 2 - 0.004} castShadow>
        <boxGeometry args={[2 * FX, SLAB - 0.01, 2 * FZ]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      {/* the mat's own edge, standing 4.5 mm proud of the boards */}
      {[
        [[0, MAT_T / 2, MZ], 0, 2 * MX],
        [[0, MAT_T / 2, -MZ], Math.PI, 2 * MX],
        [[MX, MAT_T / 2, 0], Math.PI / 2, 2 * MZ],
        [[-MX, MAT_T / 2, 0], -Math.PI / 2, 2 * MZ],
      ].map(([p, ry, w], i) => (
        <mesh key={i} position={p} rotation-y={ry} material={matEdge} castShadow receiveShadow>
          <planeGeometry args={[w, MAT_T]} />
        </mesh>
      ))}
    </group>
  )
}

export default function Court({ matColor = '#2c7a4b', lineColor = '#f3f3ee', woodColor = '#d9a86c', postColorA = '#b3181d', postColorB = '#1c3f9c', netColor = '#2a1915', wear = 0.3, shuttles = true }) {
  const invalidate = useThree((s) => s.invalidate)
  const emboss = useMemo(() => {
    const t = buildEmboss()
    t.repeat.set((2 * MX) / EMBOSS_TILE, (2 * MZ) / EMBOSS_TILE)
    return t
  }, [])
  const grain = useMemo(() => buildGrain(), [])
  const wearMap = useMemo(() => buildWear(), [])
  const feather = useMemo(() => buildFeather(), [])

  const uni = useMemo(
    () => ({
      uMat: { value: new THREE.Color() },
      uLine: { value: new THREE.Color() },
      uWood: { value: new THREE.Color() },
      uWear: { value: 0 },
      uWearMap: { value: wearMap },
      uGrain: { value: grain },
      uCell: { value: 0.019 },
      uTwine: { value: 0.0016 },
    }),
    [wearMap, grain],
  )
  const mats = useMemo(() => {
    const mat = matMaterial(uni)
    mat.normalMap = emboss
    return {
      floor: floorMaterial(uni),
      mat,
      matEdge: new THREE.MeshStandardMaterial({ roughness: 0.55 }),
      floorEdge: new THREE.MeshStandardMaterial({ color: '#7a5634', roughness: 0.85 }),
      net: netMaterial(uni),
      tape: new THREE.MeshPhysicalMaterial({ color: '#f4f4f0', roughness: 0.55, sheen: 0.4, side: THREE.DoubleSide }),
      cord: new THREE.MeshStandardMaterial({ color: '#1c1614', roughness: 0.75 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c3c7ca', roughness: 0.3, metalness: 1 }),
      cap: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.55 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.85 }),
      cork: new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.75 }),
      ribbon: new THREE.MeshStandardMaterial({ color: '#1f3fa8', roughness: 0.5 }),
      thread: new THREE.MeshStandardMaterial({ color: '#3a1d18', roughness: 0.8 }),
      feather: new THREE.MeshStandardMaterial({ map: feather, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }),
    }
  }, [uni, emboss, feather])

  useLayoutEffect(() => {
    uni.uMat.value.set(matColor)
    uni.uLine.value.set(lineColor)
    uni.uWood.value.set(woodColor)
    uni.uWear.value = wear
    mats.matEdge.color.set(matColor).multiplyScalar(0.8)
    mats.net.color.set(netColor)
    invalidate()
  }, [uni, mats, matColor, lineColor, woodColor, netColor, wear, invalidate])

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      ;[emboss, grain, wearMap, feather].forEach((t) => t.dispose())
    },
    [mats, emboss, grain, wearMap, feather],
  )

  const geo = useMemo(() => {
    // the floor has the mat's footprint cut out, so the two never fight for depth
    const outline = new THREE.Shape([new THREE.Vector2(-FX, -FZ), new THREE.Vector2(FX, -FZ), new THREE.Vector2(FX, FZ), new THREE.Vector2(-FX, FZ)])
    outline.holes.push(new THREE.Path([new THREE.Vector2(-MX, -MZ), new THREE.Vector2(-MX, MZ), new THREE.Vector2(MX, MZ), new THREE.Vector2(MX, -MZ)]))
    const floor = new THREE.ShapeGeometry(outline).rotateX(-Math.PI / 2)
    const mat = new THREE.PlaneGeometry(2 * MX, 2 * MZ, 1, 1).rotateX(-Math.PI / 2).translate(0, MAT_T, 0)
    return { floor, mat }
  }, [])
  useEffect(() => () => (geo.floor.dispose(), geo.mat.dispose()), [geo])

  return (
    <group>
      <mesh geometry={geo.floor} material={mats.floor} receiveShadow />
      <mesh geometry={geo.mat} material={mats.mat} receiveShadow />
      <Edges floorEdge={mats.floorEdge} matEdge={mats.matEdge} />
      <Net mats={mats} />
      <Post side={-1} color={postColorA} mats={mats} />
      <Post side={1} color={postColorB} mats={mats} />
      {shuttles && (
        <>
          <Shuttle position={[1.2, 0, -0.9]} yaw={0.7} mats={mats} />
          <Shuttle position={[2.6, 0, 1.4]} yaw={-2.2} mats={mats} />
          <Shuttle position={[0.5, 0, 0.55]} lying={false} mats={mats} />
        </>
      )}
    </group>
  )
}
