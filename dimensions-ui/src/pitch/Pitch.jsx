import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { DETAIL_TILE, LEN, PITCH, SIDE_TILE, STUMP, STUMPS_Z, STUMP_X, buildDetail, buildPitchTextures, buildSoilSide, buildWood } from './textures.js'

// A full-size cricket pitch: 20.12 m between the stumps, 3.05 m wide, cut out
// of the ground as a block so its soil shows at the sides.
//
// The surface is a displaced mesh (footmarks and ball marks are pressed into
// it) with a 6 mm colour map over the whole strip and a tiled half-millimetre
// soil map for close-ups. The grass is real: fourteen shells stacked over the
// surface, each cutting out the cross-sections of individual blades at its
// height, so the turf has depth, leans, thins out where the pitch is worn and
// turns white where the creases are painted over it.

const SHELLS = 14
const SHELL_H = 0.009 // the longest blades, 9 mm (pitch grass is cut short)
const DENSITY = 300 // blade cells per metre: one every 3.3 mm

// the value, once it has stopped changing for a moment (rebuilding the
// surface takes a few hundred ms, so sliders should not do it every tick)
function useSettled(value, ms = 220) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

// ---- shaders ----
// the ground: soil detail and albedo from the tiled map, and the macro
// bump (cracks, spike holes, ball marks) from the data map's height
function groundMaterial(uni) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, normalScale: new THREE.Vector2(0.9, 0.9) })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uData;\nuniform float uBump;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float a1 = texture2D(normalMap, vNormalMapUv).a;
          float a2 = texture2D(normalMap, vNormalMapUv * 0.37 + vec2(0.13, 0.71)).a;
          diffuseColor.rgb *= (0.55 + 0.9 * a1) * (0.8 + 0.4 * a2);
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 st = vMapUv;
          vec2 sdx = dFdx(st);
          vec2 sdy = dFdy(st);
          float h0 = texture2D(uData, st).r;
          vec2 dH = vec2(texture2D(uData, st + sdx).r - h0, texture2D(uData, st + sdy).r - h0) * uBump;
          vec3 px = dFdx(-vViewPosition);
          vec3 py = dFdy(-vViewPosition);
          vec3 r1 = cross(py, normal);
          vec3 r2 = cross(normal, px);
          float det = dot(px, r1) * faceDirection;
          vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
          normal = normalize(abs(det) * normal - grad);
        }`,
      )
  }
  m.customProgramCacheKey = () => 'pitch-ground'
  return m
}

// one shell of grass at height layer (0..1 of SHELL_H)
function shellMaterial(uni, layer) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.72, alphaHash: true })
  const uLayer = { value: layer }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni, { uLayer })
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGUv;\nvarying vec2 vGPos;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvGUv = uv;\nvGPos = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uData;
        uniform float uLayer;
        uniform float uDensity;
        uniform float uWear;
        varying vec2 vGUv;
        varying vec2 vGPos;
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
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 bladeN = vec3(0.0, 1.0, 0.0);
        {
          vec2 p = vGPos * uDensity;
          // blades smaller than a pixel only shimmer: hand over to the
          // painted map with distance
          float fade = 1.0 - smoothstep(0.45, 1.0, length(fwidth(p)));
          if (fade <= 0.0) discard;
          vec4 gd = texture2D(uData, vGUv);
          float cov = gd.b;
          bool hit = false;
          vec4 hh = vec4(0.5);
          float tt = 0.0;
          for (int g = 0; g < 2; g++) {
            vec2 q = p + (g == 1 ? vec2(0.5, 0.5) : vec2(0.0));
            vec2 id = floor(q) + (g == 1 ? vec2(7919.0, 104.0) : vec2(0.0));
            vec2 f = fract(q) - 0.5;
            vec4 h = h4(id);
            if (h.y > cov * 1.1) continue;
            float bh = (0.3 + 0.7 * h.x) * (0.5 + 0.5 * cov);
            if (uLayer > bh) continue;
            float t = uLayer / bh;
            float ang = h.z * 6.2832;
            vec2 dir = vec2(cos(ang), sin(ang));
            vec2 perp = vec2(-dir.y, dir.x);
            // the blade bends over its face as it rises
            vec2 lean = perp * (h.w - 0.35) * 0.55 * t * t;
            vec2 c = (vec2(h.w, fract(h.z * 7.13)) - 0.5) * 0.4 + lean;
            vec2 d = f - c;
            float al = dot(d, dir);
            float ac = dot(d, perp);
            float bl = 0.36 * (1.0 - 0.6 * t) + 0.04;
            float bw = 0.07 * (1.0 - 0.7 * t) + 0.025;
            if (al * al / (bl * bl) + ac * ac / (bw * bw) < 1.0) {
              hit = true;
              hh = h;
              tt = t;
              float sd = ac >= 0.0 ? 1.0 : -1.0;
              bladeN = normalize(vec3(perp.x * sd * 0.8 + lean.x * 2.0, 0.45 + 0.4 * t, perp.y * sd * 0.8 + lean.y * 2.0));
              break;
            }
          }
          if (!hit) discard;
          float dryB = clamp(uWear * 0.55 + (hh.x - 0.5) * 0.6 + (1.0 - cov) * 0.4, 0.0, 1.0);
          vec3 green = mix(vec3(0.07, 0.115, 0.028), vec3(0.16, 0.21, 0.055), hh.w);
          vec3 straw = mix(vec3(0.29, 0.24, 0.1), vec3(0.42, 0.36, 0.18), hh.z);
          vec3 col = mix(green, straw, smoothstep(0.35, 0.85, dryB));
          col *= mix(0.32, 1.15, tt);
          col = mix(col, vec3(0.8, 0.8, 0.76) * mix(0.75, 1.0, tt), gd.a * 0.95);
          diffuseColor.rgb = col;
          diffuseColor.a = fade;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize((viewMatrix * vec4(bladeN, 0.0)).xyz), 0.6));`,
      )
  }
  m.customProgramCacheKey = () => 'pitch-grass-shell'
  return m
}

// ---- geometry ----
function surfaceGeometry(heightAt) {
  const g = new THREE.PlaneGeometry(PITCH.w, LEN, 96, 720)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

// a stump: turned ash, domed on top with the bail grooves, standing in the
// ground (the part below the surface is the spike, out of sight)
function stumpGeometry() {
  const R = STUMP.r
  const H = STUMP.h
  const pts = [
    [0, -0.04],
    [R * 0.9, -0.04],
    [R, -0.03],
    [R, H - 0.012],
    [R * 0.985, H - 0.007],
    [R * 0.93, H - 0.0035],
    [R * 0.78, H - 0.0012],
    [R * 0.5, H],
    [0, H + 0.0004],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.LatheGeometry(pts, 48)
}
// a bail: spigots at each end resting in the stump grooves, a turned barrel
// between them with a waist in the middle
function bailGeometry() {
  const half = [
    [0.0, -0.0556],
    [0.003, -0.0553],
    [0.0042, -0.0545],
    [0.0045, -0.041],
    [0.0068, -0.0402],
    [0.0072, -0.0378],
    [0.0058, -0.0365],
    [0.006, -0.0335],
    [0.0088, -0.0305],
    [0.0095, -0.022],
    [0.009, -0.0135],
    [0.0072, -0.0085],
    [0.0076, -0.004],
    [0.008, 0],
  ]
  const pts = [...half, ...half.slice(0, -1).reverse().map(([r, y]) => [r, -y])].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.LatheGeometry(pts, 32)
  g.rotateZ(Math.PI / 2)
  return g
}

function Wicket({ z, geo, mat }) {
  const bailY = STUMP.h + 0.0025
  const cx = (STUMP_X[0] + STUMP_X[1]) / 2
  return (
    <group position={[0, 0, z]}>
      {STUMP_X.map((x) => (
        <mesh key={x} geometry={geo.stump} material={mat} position={[x, 0, 0]} rotation-y={x * 40} castShadow receiveShadow />
      ))}
      <mesh geometry={geo.bail} material={mat} position={[cx, bailY, 0]} castShadow receiveShadow />
      <mesh geometry={geo.bail} material={mat} position={[-cx, bailY, 0]} castShadow receiveShadow />
    </group>
  )
}

// the four cut faces of the block
function SlabSides({ tex }) {
  const faces = useMemo(() => {
    const T = PITCH.slab
    const long = tex.clone()
    long.repeat.set(LEN / SIDE_TILE, 1)
    long.needsUpdate = true
    const short = tex.clone()
    short.repeat.set(PITCH.w / SIDE_TILE, 1)
    short.needsUpdate = true
    const mk = (map) => new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.004, roughness: 0.95 })
    return {
      T,
      long: mk(long),
      short: mk(short),
      dispose() {
        long.dispose()
        short.dispose()
        this.long.dispose()
        this.short.dispose()
      },
    }
  }, [tex])
  useEffect(() => () => faces.dispose(), [faces])
  const { T } = faces
  const y = -T / 2
  return (
    <group>
      <mesh position={[PITCH.w / 2, y, 0]} rotation-y={Math.PI / 2} material={faces.long} receiveShadow>
        <planeGeometry args={[LEN, T]} />
      </mesh>
      <mesh position={[-PITCH.w / 2, y, 0]} rotation-y={-Math.PI / 2} material={faces.long} receiveShadow>
        <planeGeometry args={[LEN, T]} />
      </mesh>
      <mesh position={[0, y, LEN / 2]} material={faces.short} receiveShadow>
        <planeGeometry args={[PITCH.w, T]} />
      </mesh>
      <mesh position={[0, y, -LEN / 2]} rotation-y={Math.PI} material={faces.short} receiveShadow>
        <planeGeometry args={[PITCH.w, T]} />
      </mesh>
      {/* an invisible block that casts the slab's shadow on the floor */}
      <mesh position={[0, -T / 2 - 0.006, 0]} castShadow>
        <boxGeometry args={[PITCH.w, T - 0.012, LEN]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function Pitch({ wear = 0.45, grass = 0.6, stumpWood = '#dcb98a', sides = true }) {
  const invalidate = useThree((s) => s.invalidate)
  const sw = useSettled(wear)
  const sg = useSettled(grass)

  const detail = useMemo(() => {
    const t = buildDetail()
    t.repeat.set(PITCH.w / DETAIL_TILE, LEN / DETAIL_TILE)
    return t
  }, [])
  const side = useMemo(() => buildSoilSide(), [])
  const wood = useMemo(() => buildWood(), [])
  const surf = useMemo(() => buildPitchTextures({ wear: sw, grass: sg }), [sw, sg])
  const geo = useMemo(() => surfaceGeometry(surf.heightAt), [surf])
  const parts = useMemo(() => ({ stump: stumpGeometry(), bail: bailGeometry() }), [])

  const uni = useMemo(() => ({ uData: { value: null }, uBump: { value: 0.009 }, uDensity: { value: DENSITY }, uWear: { value: 0.45 } }), [])
  const mats = useMemo(() => {
    const ground = groundMaterial(uni)
    ground.normalMap = detail
    const shells = Array.from({ length: SHELLS }, (_, i) => shellMaterial(uni, (i + 1) / SHELLS))
    const woodMat = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.22 })
    return { ground, shells, wood: woodMat }
  }, [uni, detail, wood])

  // hand the freshly built maps to the materials before the next frame
  useLayoutEffect(() => {
    mats.ground.map = surf.color
    mats.ground.roughnessMap = surf.data
    mats.ground.needsUpdate = true
    uni.uData.value = surf.data
    uni.uWear.value = sw
    invalidate()
  }, [mats, surf, uni, sw, invalidate])
  useLayoutEffect(() => {
    mats.wood.color.set(stumpWood)
    invalidate()
  }, [mats, stumpWood, invalidate])

  useEffect(() => () => surf.dispose(), [surf])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(
    () => () => {
      mats.ground.dispose()
      mats.shells.forEach((m) => m.dispose())
      mats.wood.dispose()
      parts.stump.dispose()
      parts.bail.dispose()
      detail.dispose()
      side.dispose()
      wood.dispose()
    },
    [mats, parts, detail, side, wood],
  )

  return (
    <group>
      <mesh geometry={geo} material={mats.ground} receiveShadow />
      {mats.shells.map((m, i) => (
        <mesh key={i} geometry={geo} material={m} position-y={(SHELL_H * (i + 1)) / SHELLS} receiveShadow />
      ))}
      {sides && <SlabSides tex={side} />}
      <Wicket z={STUMPS_Z} geo={parts} mat={mats.wood} />
      <Wicket z={-STUMPS_Z} geo={parts} mat={mats.wood} />
    </group>
  )
}
