import * as THREE from 'three'
import { AVE, AVE_HALF, AVE_STOP, CURB, ST, ST_HALF, ST_STOP } from './layout.js'

// Shaders for the city. Buildings and streets are MeshStandardMaterials
// patched in onBeforeCompile: they keep three's physical lighting, sky
// reflections, shadows and fog, while their surfaces are drawn here.
//
// Facades: every wall carries its building's style, seed, storey height and
// bay width; the shader lays out the bays and storeys, recesses punched
// windows with a parallax reveal, and behind every pane draws a room
// (interior mapping: the eye ray is traced into a box the size of the room,
// so walls, floor and ceiling shift with the view), lit or dark, with blinds.
//
// Streets: asphalt with patches, cracks and worn lanes; paint for lanes, the
// green bike lane, zebra crossings and stop lines; manholes; concrete slab
// sidewalks; pools of street light at night.

export const NOISE = /* glsl */ `
float vh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vh(i), vh(i + vec2(1.0, 0.0)), u.x), mix(vh(i + vec2(0.0, 1.0)), vh(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm2(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 3.1; a *= 0.5; }
  return s / 0.9375;
}
float box2(vec2 p, vec2 lo, vec2 hi) { return step(lo.x, p.x) * step(p.x, hi.x) * step(lo.y, p.y) * step(p.y, hi.y); }
`

const WORLD_VARY = /* glsl */ `
varying vec3 vGW;
varying vec3 vGN;
`
const WORLD_VERTEX = /* glsl */ `
  {
    vec4 gw = vec4(transformed, 1.0);
    vec3 gn = objectNormal;
    #ifdef USE_INSTANCING
      gw = instanceMatrix * gw;
      gn = mat3(instanceMatrix) * gn;
    #endif
    vGW = (modelMatrix * gw).xyz;
    vGN = normalize(mat3(modelMatrix) * gn);
  }
`

function patch(m, key, { uniforms, vertexHead = '', vertex = '', fragmentHead = '', color = '', afterLights = '' }) {
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms)
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARY}\n${vertexHead}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WORLD_VERTEX}\n${vertex}`)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARY}\n${NOISE}\n${fragmentHead}\nfloat sRough; float sMetal; vec3 sEmit; vec3 sTilt;`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nsRough = roughness; sMetal = metalness; sEmit = vec3(0.0); sTilt = vec3(0.0);\n${color}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = sRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = sMetal;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + (viewMatrix * vec4(sTilt, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += sEmit;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${afterLights}`)
    m.userData.shader = s
  }
  m.customProgramCacheKey = () => key
  return m
}

// ---------------------------------------------------------------- facades

export function facadeMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 })
  return patch(m, 'city-facade', {
    uniforms,
    vertexHead: 'attribute vec4 aStyle; attribute vec4 aFace; attribute vec2 aUV; varying vec4 vStyle; varying vec4 vFace; varying vec2 vUV;',
    vertex: 'vStyle = aStyle; vFace = aFace; vUV = aUV;',
    fragmentHead: /* glsl */ `
      uniform float uNight;
      uniform float uDay;
      uniform float uTime;
      varying vec4 vStyle;
      varying vec4 vFace;
      varying vec2 vUV;

      // A room behind a pane, traced from the glass. rp: the point on the
      // glass in room space (x across, y up, z = 0 at the glass); d: the eye
      // ray in the same space (z into the room).
      vec3 room(vec3 rp, vec3 d, vec3 size, float seed, float lit, float warm, float office) {
        d.z = max(d.z, 0.05);
        float tx = d.x > 0.0 ? (size.x - rp.x) / d.x : -rp.x / min(d.x, -1e-4);
        float ty = d.y > 0.0 ? (size.y - rp.y) / d.y : -rp.y / min(d.y, -1e-4);
        float tz = size.z / d.z;
        float t = min(min(tx, ty), tz);
        vec3 hp = rp + d * t;
        float r1 = vh(vec2(seed, 3.7));
        float r2 = vh(vec2(seed, 8.1));
        vec3 wall = office > 0.5 ? mix(vec3(0.42, 0.42, 0.40), vec3(0.30, 0.32, 0.34), r1) : mix(vec3(0.48, 0.40, 0.30), vec3(0.36, 0.38, 0.33), r1);
        vec3 col;
        if (t == tz) {
          col = wall;
          // furniture and fittings against the back wall
          float shelf = box2(hp.xy, vec2(size.x * (0.1 + 0.3 * r2), 0.0), vec2(size.x * (0.55 + 0.4 * r2), 0.85 + r1 * 0.9));
          col = mix(col, mix(vec3(0.08, 0.06, 0.05), vec3(0.3, 0.2, 0.12), r1), shelf);
          float art = box2(hp.xy, vec2(size.x * 0.3, 1.5), vec2(size.x * 0.55, 2.1)) * step(0.6, r2);
          col = mix(col, vec3(0.5, 0.3, 0.2) * r1 + 0.15, art);
        } else if (t == tx) {
          col = wall * 0.78;
        } else if (d.y < 0.0) {
          col = office > 0.5 ? vec3(0.12, 0.12, 0.13) : mix(vec3(0.22, 0.13, 0.07), vec3(0.15, 0.12, 0.1), r2); // carpet, boards
          // desks in offices
          col = mix(col, vec3(0.2), office * step(0.5, fract(hp.z / 1.6)) * step(0.3, fract(hp.x / 1.8)) * 0.6);
        } else {
          col = vec3(0.55);
          float panel = office * step(0.75, fract(hp.z / 1.2)) * step(0.3, fract(hp.x / 1.5));
          col += panel * lit * 3.0; // light panels in the ceiling
        }
        float depth = hp.z / size.z;
        vec3 lamp = mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.72, 0.42), warm);
        vec3 dayLight = vec3(0.5, 0.55, 0.62) * uDay * mix(0.55, 0.12, depth);
        float pool = lit * (1.2 - 0.6 * abs(hp.x / size.x - 0.5) - 0.4 * depth);
        return col * (dayLight + lamp * pool * 1.6);
      }
    `,
    color: /* glsl */ `
      vec3 P = vGW;
      vec3 N = normalize(vGN);
      vec3 V = normalize(P - cameraPosition);
      float dist = length(P - cameraPosition);
      float near = 1.0 - smoothstep(60.0, 260.0, dist);
      float type = floor(vStyle.x + 0.5);
      float seed = vStyle.y;
      float fh = vStyle.z;
      float ww = vStyle.w;
      float faceW = max(vFace.x, 0.5);
      vec2 fu = vUV;
      float h1 = vh(vec2(seed, 1.7));
      float h2 = vh(vec2(seed, 9.1));
      float h3 = vh(vec2(seed * 3.1, 4.4));
      vec3 brick = mix(mix(vec3(0.19, 0.065, 0.035), vec3(0.27, 0.115, 0.06), h1), vec3(0.34, 0.25, 0.16), step(0.72, h2));
      vec3 stone = mix(vec3(0.44, 0.40, 0.33), vec3(0.32, 0.31, 0.30), h1);
      vec3 alb = stone;
      float lit = 0.0;
      // weathering: soot streaks down the walls, grime at the foot
      float streak = 0.86 + 0.14 * vn(vec2(fu.x * 1.3 + seed * 17.0, fu.y * 0.04));
      bool roof = N.y > 0.5;
      bool under = N.y < -0.5;
      if (roof || under) {
        vec3 tar = mix(vec3(0.07, 0.07, 0.07), vec3(0.36, 0.36, 0.34), step(0.55, h1));
        alb = tar * (0.75 + 0.45 * fbm2(P.xz * 0.6));
        sRough = 0.95;
        if (type > 4.5) alb = type < 5.5 ? vec3(0.11, 0.075, 0.05) : vec3(0.05);
      } else if (type > 4.5) {
        // 5 wood (water tanks): staves and iron hoops; 6 dark metal; 7 painted cornice; 8 stone trim
        if (type < 5.5) {
          float stave = smoothstep(0.0, 0.06, fract(fu.x / 0.16)) * (0.8 + 0.2 * vh(vec2(floor(fu.x / 0.16), seed)));
          float hoop = step(0.93, fract(fu.y / 0.55));
          alb = mix(vec3(0.17, 0.12, 0.08) * stave * (0.7 + 0.5 * vn(vec2(fu.x * 3.0, fu.y * 0.3))), vec3(0.03), hoop);
          sRough = 0.9;
        } else if (type < 6.5) {
          alb = vec3(0.06, 0.065, 0.07) * (0.8 + 0.3 * step(0.5, fract(fu.y / 0.25)));
          sMetal = 0.6;
          sRough = 0.5;
        } else if (type < 7.5) {
          alb = mix(vec3(0.03, 0.06, 0.045), vec3(0.04), h3) * (0.85 + 0.3 * step(0.5, fract(fu.y / 0.18)));
          sMetal = 0.3;
          sRough = 0.55;
        } else {
          alb = mix(stone, brick, step(0.7, h3)) * 1.05 * (0.85 + 0.25 * step(0.5, fract(fu.y / 0.22)));
        }
      } else {
        // bays and storeys
        float bays = max(1.0, floor(faceW / ww + 0.5));
        float cw = faceW / bays;
        vec3 T = vec3(N.z, 0.0, -N.x);
        vec3 Vt = vec3(dot(V, T), V.y, dot(V, -N)); // the eye ray in facade space, z into the wall
        Vt.z = max(Vt.z, 0.04);
        float GH = 4.6;
        bool street = fu.y < GH && vFace.y < 1.0;
        if (street && type > 0.5) {
          // shopfronts: pillars, a sign band, display glass with the shop behind
          float sw = cw * (bays > 3.0 ? 2.0 : 1.0);
          float sid = floor(fu.x / sw);
          float sx = fu.x - sid * sw;
          float rs = vh(vec2(sid, seed * 7.0 + N.x * 3.0 + N.z * 5.0));
          vec3 signCol = mix(mix(vec3(0.05, 0.12, 0.06), vec3(0.25, 0.03, 0.03), step(0.35, rs)), mix(vec3(0.02, 0.03, 0.09), vec3(0.03), step(0.5, fract(rs * 7.0))), step(0.65, rs));
          alb = mix(stone * 0.6, vec3(0.04), step(0.5, h2));
          if (fu.y > 3.5 && fu.y < 4.5 && sx > 0.25 && sx < sw - 0.25) {
            alb = signCol;
            float letters = box2(vec2(sx, fu.y), vec2(sw * 0.2, 3.78), vec2(sw * 0.8, 4.22)) * step(0.45, vn(vec2(sx * 3.2, rs * 40.0)));
            alb = mix(alb, vec3(0.75, 0.7, 0.55), letters);
            sEmit += letters * vec3(1.0, 0.85, 0.6) * uNight * 2.5;
          } else if (fu.y > 0.35 && fu.y < 3.35 && sx > 0.3 && sx < sw - 0.3) {
            // display window: a deep, bright shop
            vec2 g = vec2(sx - 0.3, fu.y - 0.35);
            vec3 inside = room(vec3(g + Vt.xy / Vt.z * 0.12, 0.0), Vt, vec3(sw - 0.6, 3.0, 8.0), sid + seed * 13.0, 1.0, step(0.5, rs), step(0.7, rs));
            sEmit += inside * (0.16 + 0.84 * uNight);
            alb = vec3(0.0);
            sRough = 0.04;
            sTilt = (T * (rs - 0.5) + vec3(0.0, 1.0, 0.0) * (fract(rs * 13.0) - 0.5)) * 0.02;
            float door = box2(g, vec2(sw * 0.5 - 0.95, 0.0), vec2(sw * 0.5 + 0.05, 2.6)) * step(0.5, fract(rs * 3.0));
            alb = mix(alb, vec3(0.02), door * 0.5);
          }
          alb *= 0.7 + 0.3 * smoothstep(0.0, 0.6, fu.y);
        } else {
          vec2 cell = vec2(fu.x / cw, fu.y / fh);
          vec2 id = floor(cell);
          vec2 f = fract(cell);
          float wid = vh(id + seed * 13.7 + N.xz * 7.0 + 0.5);
          float wid2 = vh(id * 1.3 + seed * 5.1 + N.zx * 3.0);
          float office = step(1.5, type) * step(type, 4.5) * step(0.4, h3) + step(type, 0.5);
          float litChance = mix(mix(0.04, 0.22, office), mix(0.38, 0.62, office), uNight);
          // floors lit together in offices, room by room in flats
          float floorLit = vh(vec2(id.y, seed * 2.3));
          lit = office > 0.5 ? step(floorLit, litChance) * step(0.15, wid2) : step(wid2, litChance);
          float warm = office > 0.5 ? 0.15 + 0.2 * wid : 0.55 + 0.45 * wid;
          if (type < 0.5) {
            // curtain wall: mullions, a spandrel band at each floor slab, vision glass
            vec3 tint = mix(mix(vec3(0.05, 0.09, 0.10), vec3(0.07, 0.075, 0.08), step(0.4, h1)), mix(vec3(0.09, 0.075, 0.055), vec3(0.06, 0.09, 0.12), step(0.5, h2)), step(0.7, h1));
            float mull = 1.0 - box2(f * vec2(cw, fh), vec2(0.06), vec2(cw - 0.06, fh - 0.06));
            float spandrel = step(f.y * fh, 1.05);
            sTilt = (T * (wid - 0.5) + vec3(0.0, 1.0, 0.0) * (wid2 - 0.5)) * 0.03;
            alb = tint;
            sMetal = 0.55;
            sRough = 0.04 + 0.04 * wid;
            if (spandrel < 0.5 && mull < 0.5) {
              vec3 rp = vec3(fu.x - floor(fu.x / (cw * 3.0)) * cw * 3.0, f.y * fh - 1.05, 0.0);
              vec3 inside = room(rp, Vt, vec3(cw * 3.0, fh - 1.05, 9.0), floor(fu.x / (cw * 3.0)) + id.y * 31.0 + seed, lit, warm, 1.0);
              sEmit += inside * tint * 6.0;
            } else {
              alb = mix(tint * 0.6, vec3(0.12, 0.12, 0.13), mull);
              sMetal = mix(0.65, 0.8, mull);
              sRough = mix(0.08, 0.35, mull);
            }
          } else {
            // masonry: brick or limestone wall with punched windows; deco
            // piers; mid-century ribbon windows
            vec3 wall = type < 1.5 ? brick : stone;
            if (type > 3.5) wall = mix(vec3(0.36, 0.36, 0.35), vec3(0.22, 0.23, 0.24), h1);
            vec2 m = f * vec2(cw, fh);
            vec2 lo;
            vec2 hi;
            float depth = 0.22;
            if (type < 2.5) { lo = vec2(cw * 0.24, fh * 0.24); hi = vec2(cw * 0.76, fh * 0.86); }
            else if (type < 3.5) { lo = vec2(cw * 0.2, fh * 0.28); hi = vec2(cw * 0.8, fh * 0.98); depth = 0.45; }
            else { lo = vec2(0.04, fh * 0.36); hi = vec2(cw - 0.04, fh * 0.96); depth = 0.08; }
            float open = box2(m, lo, hi);
            // where the eye meets the glass, set back in the opening
            vec2 g = m + Vt.xy / Vt.z * depth;
            float glass = box2(g, lo, hi) * open;
            // brick coursing, close up
            if (type < 1.5) {
              float row = floor(fu.y / 0.075);
              vec2 bk = vec2(fu.x / 0.2 + mod(row, 2.0) * 0.5, fu.y / 0.075);
              float mortar = 1.0 - box2(fract(bk), vec2(0.04, 0.13), vec2(0.97, 1.0));
              wall *= 0.82 + 0.3 * vh(floor(bk) + seed);
              wall = mix(wall, vec3(0.3, 0.29, 0.27), mortar * near * 0.8);
            }
            alb = wall * streak;
            // stone lintels and sills
            float trim = box2(m, vec2(lo.x - 0.08, hi.y), vec2(hi.x + 0.08, hi.y + 0.22)) + box2(m, vec2(lo.x - 0.05, lo.y - 0.1), vec2(hi.x + 0.05, lo.y));
            if (type < 1.5) alb = mix(alb, stone * 1.1, min(trim, 1.0));
            if (type > 2.5 && type < 3.5) alb = mix(alb, mix(vec3(0.05, 0.06, 0.05), vec3(0.18, 0.12, 0.08), h2), box2(m, vec2(lo.x, 0.0), vec2(hi.x, lo.y))); // spandrel panels
            if (open > 0.5) {
              if (glass > 0.5) {
                vec3 rp = vec3(g, 0.0);
                vec3 inside = room(rp, Vt, vec3(cw, fh - 0.25, 4.5 + 2.0 * wid), id.x + id.y * 57.0 + seed * 3.0, lit, warm, office);
                // blinds and curtains part-drawn
                float blind = step(1.0 - 0.75 * wid * wid, (g.y - lo.y) / (hi.y - lo.y)) * step(0.25, wid2);
                vec3 shade = mix(vec3(0.55, 0.5, 0.42), vec3(0.6, 0.6, 0.58), step(0.5, wid));
                inside = mix(inside, shade * (0.3 * uDay + lit * vec3(1.0, 0.8, 0.55) * 0.9), blind);
                sEmit += inside * 0.9;
                alb = vec3(0.0);
                sRough = 0.03;
                sTilt = (T * (wid - 0.5) + vec3(0.0, 1.0, 0.0) * (wid2 - 0.5)) * 0.025;
                // frame and glazing bars
                vec2 q = g - lo;
                float bar = 1.0 - box2(q, vec2(0.05), hi - lo - 0.05);
                bar = max(bar, step(abs(q.y - (hi.y - lo.y) * 0.55), 0.03) * step(type, 2.5));
                alb = mix(alb, mix(vec3(0.5), vec3(0.03), step(0.5, h3)), bar);
                sEmit *= 1.0 - bar;
                sRough = mix(sRough, 0.5, bar);
              } else {
                alb = wall * 0.45; // the reveal, in its own shade
              }
            }
          }
        }
        alb *= 0.72 + 0.28 * smoothstep(0.0, 2.5, fu.y); // grime at the foot
      }
      // never let a degenerate ray leak a non-finite value into the bloom
      if (!(sEmit.x + sEmit.y + sEmit.z >= 0.0) || sEmit.x + sEmit.y + sEmit.z > 1e4) sEmit = vec3(0.0);
      sEmit = min(sEmit, vec3(12.0));
      diffuseColor.rgb = alb;
    `,
    // In a street canyon, glass mirrors the buildings across the way, not
    // the sky: only rays that climb clear of the rooftops see the sky map.
    afterLights: /* glsl */ `
      {
        vec3 rw = reflect(normalize(vGW - cameraPosition), normalize(vGN));
        float open = smoothstep(-0.05, 0.45, rw.y + vGW.y / 260.0 - 0.15);
        float lum = dot(reflectedLight.indirectSpecular, vec3(0.3, 0.5, 0.2));
        float glossy = 1.0 - smoothstep(0.08, 0.3, sRough);
        vec3 across = vec3(0.055, 0.05, 0.048) * (0.4 + 0.6 * uDay) * mix(1.0, 0.6 + 0.8 * vn(rw.xz * 6.0 + rw.y * 4.0), glossy);
        across += vec3(1.0, 0.8, 0.55) * uNight * 0.04 * step(0.7, vn(rw.xz * 22.0 + rw.y * 9.0)) * glossy;
        reflectedLight.indirectSpecular = mix(across * (0.3 + lum * 2.0), reflectedLight.indirectSpecular, open);
        if (!(dot(reflectedLight.indirectSpecular, vec3(1.0)) >= 0.0)) reflectedLight.indirectSpecular = vec3(0.0);
      }
    `,
  })
}

// ---------------------------------------------------------------- streets

export function streetMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 })
  return patch(m, 'city-street', {
    uniforms,
    fragmentHead: /* glsl */ `
      uniform float uNight;
      #define AVE ${AVE.toFixed(2)}
      #define ST ${ST.toFixed(2)}
      #define AH ${AVE_HALF.toFixed(2)}
      #define SH ${ST_HALF.toFixed(2)}
      #define AVE_STOP ${AVE_STOP.toFixed(2)}
      #define ST_STOP ${ST_STOP.toFixed(2)}
      #define CURB ${CURB.toFixed(2)}
      float lineAt(float x, float c, float w) { return step(abs(x - c), w); }
      float pool(vec2 d) { return 1.0 / (1.0 + dot(d, d) / 30.0) * (1.0 - smoothstep(10.0, 18.0, length(d))); }
    `,
    color: /* glsl */ `
      vec3 P = vGW;
      vec3 N = normalize(vGN);
      float dist = length(P - cameraPosition);
      float near = 1.0 - smoothstep(30.0, 160.0, dist);
      float a = P.x - floor(P.x / AVE + 0.5) * AVE; // across the nearest avenue
      float b = P.z - floor(P.z / ST + 0.5) * ST;   // across the nearest street
      float ai = floor(P.x / AVE + 0.5);
      float bj = floor(P.z / ST + 0.5);
      vec3 alb;
      if (P.y > 0.02) {
        if (N.y < 0.5) {
          alb = vec3(0.26, 0.25, 0.24) * (0.8 + 0.3 * vn(P.xz * 3.0)); // granite curb
          sRough = 0.75;
        } else {
          // concrete slabs, stained, with gum spots
          vec2 sl = P.xz / 1.52;
          vec2 sid = floor(sl);
          vec2 sf = fract(sl);
          float joint = 1.0 - box2(sf, vec2(0.012), vec2(0.988));
          alb = vec3(0.30, 0.295, 0.28) * (0.82 + 0.2 * vh(sid)) * (0.85 + 0.25 * fbm2(P.xz * 0.35));
          alb = mix(alb, vec3(0.12), joint * near * 0.8);
          float gum = step(0.985, vh(floor(P.xz * 7.0))) * near;
          alb = mix(alb, vec3(0.1), gum * 0.7);
          float curbEdge = min(abs(abs(a) - AH), abs(abs(b) - SH));
          alb = mix(alb, vec3(0.34, 0.33, 0.31), step(curbEdge, 0.3) * 0.7);
          sRough = 0.88;
        }
      } else {
        // asphalt
        alb = vec3(0.045, 0.045, 0.048) * (0.75 + 0.5 * fbm2(P.xz * 0.25)) * (0.9 + 0.2 * vn(P.xz * 18.0) * near + 0.1);
        vec2 pc = floor(P.xz / vec2(6.5, 3.8) + vec2(0.3, 0.7));
        float patchy = step(0.86, vh(pc));
        alb = mix(alb, alb * mix(0.7, 1.35, vh(pc + 3.0)), patchy);
        float crack = step(abs(fbm2(P.xz * 0.45) - 0.5), 0.005) * near;
        alb = mix(alb, vec3(0.02), crack);
        sRough = 0.86;
        bool onAve = abs(a) < AH;
        bool onSt = abs(b) < SH;
        float paint = 0.0;
        vec3 paintCol = vec3(0.62, 0.62, 0.58);
        if (onAve && !onSt) {
          float far = abs(b);
          if (far > AVE_STOP + 0.4) {
            float dash = step(fract(P.z / 12.0), 0.27);
            paint += (lineAt(a, -2.0, 0.07) + lineAt(a, 1.2, 0.07) + lineAt(a, 4.4, 0.07)) * dash;
            paint += lineAt(a, -5.2, 0.07) + lineAt(a, 7.6, 0.05) + lineAt(a, -7.9, 0.05);
            // the buffer, hatched, and the green bike lane
            if (a > -6.1 && a < -5.2) paint += step(fract((P.z + a * 1.2) / 2.2), 0.13);
            if (a > -7.9 && a < -6.1) {
              alb = mix(vec3(0.025, 0.14, 0.05), vec3(0.04, 0.09, 0.05), vn(P.xz * 1.5) * 0.6) * (0.75 + 0.35 * fbm2(P.xz * 2.0));
            }
            // worn tracks down each lane
            float tr = 0.0;
            for (int k = 0; k < 4; k++) {
              float c = -3.6 + 3.2 * float(k);
              tr += smoothstep(0.5, 0.1, abs(abs(a - c) - 0.85));
            }
            alb *= 1.0 - tr * 0.18;
          }
          // crosswalk bars across the avenue, and the stop line
          if (far > SH + 0.6 && far < SH + 4.4 && abs(a) < AH - 0.3) paint += step(fract(a / 1.2), 0.5);
          if (far > AVE_STOP - 0.35 && far < AVE_STOP + 0.05 && a > -5.2 && a < 7.6) paint += 1.0;
        } else if (onSt && !onAve) {
          float far = abs(a);
          if (far > ST_STOP + 0.4) {
            paint += lineAt(b, 0.0, 0.06) * step(fract(P.x / 10.0), 0.3);
            alb *= 1.0 - 0.15 * (smoothstep(0.5, 0.1, abs(abs(b - 1.55) - 0.8)) + smoothstep(0.5, 0.1, abs(abs(b + 1.55) - 0.8)));
          }
          if (far > AH + 0.6 && far < AH + 4.4 && abs(b) < SH - 0.3) paint += step(fract(b / 1.2), 0.5);
          if (far > ST_STOP - 0.35 && far < ST_STOP + 0.05 && abs(b) < 3.1) paint += 1.0;
        }
        // worn paint
        paint = clamp(paint, 0.0, 1.0) * (0.55 + 0.45 * smoothstep(0.25, 0.6, fbm2(P.xz * 1.7)));
        alb = mix(alb, paintCol, paint);
        sRough = mix(sRough, 0.6, paint);
        // manholes
        vec2 mc = floor(P.xz / 17.0);
        vec2 mo = (mc + 0.25 + 0.5 * vec2(vh(mc), vh(mc + 5.0))) * 17.0;
        float md = length(P.xz - mo);
        float onRoad = step(abs(P.x - floor(mo.x / AVE + 0.5) * AVE), AH - 1.0) + step(abs(mo.y - floor(mo.y / ST + 0.5) * ST), SH - 1.0);
        if (md < 0.42 && onRoad > 0.5 && vh(mc + 9.0) > 0.4) {
          vec2 q = (P.xz - mo) * 9.0;
          float grid = step(0.5, fract(q.x + 0.5 * step(0.5, fract(q.y * 0.5)))) * step(md, 0.36);
          alb = mix(vec3(0.05, 0.045, 0.04), vec3(0.11, 0.1, 0.09), grid) * (1.0 - step(0.38, md) * 0.4);
          sMetal = 0.7;
          sRough = 0.45;
        }
      }
      // street light at night: pools under the lamps along both kerbs
      if (uNight > 0.01) {
        float zl = (floor(P.z / 30.0) + 0.5) * 30.0;
        float xl = (floor(P.x / 36.0) + 0.5) * 36.0;
        float lp = pool(vec2(a - (AH + 0.7), P.z - zl)) + pool(vec2(a + AH + 0.7, P.z - zl - 15.0));
        lp += pool(vec2(P.x - xl, b - (SH + 0.7))) + pool(vec2(P.x - xl - 18.0, b + SH + 0.7));
        // shop light spilling onto the pavement
        float edgeA = abs(abs(a) - (AH + 5.5));
        float edgeB = abs(abs(b) - (SH + 4.5));
        float spill = (smoothstep(4.0, 0.0, edgeA) * step(SH + 4.5, abs(b)) + smoothstep(4.0, 0.0, edgeB) * step(AH + 5.5, abs(a))) * step(0.02, P.y);
        sEmit += alb * (vec3(1.0, 0.82, 0.6) * lp * 3.0 + vec3(1.0, 0.85, 0.65) * spill * 0.45) * uNight;
      }
      diffuseColor.rgb = alb;
    `,
  })
}
