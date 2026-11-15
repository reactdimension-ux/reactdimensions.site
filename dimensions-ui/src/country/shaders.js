import * as THREE from 'three'
import { NOISE } from '../valley/shaders.js'
import { CH, CW, FARM, FIELD_C, FIELD_S, LANE_W, LANE_Z, YARD_R } from './land.js'

// Shader code for the countryside. Every surface is a MeshStandardMaterial
// patched in onBeforeCompile, so it keeps three's physical lighting, the
// sky's image-based light, shadows and fog; only colour, roughness and fine
// relief are made procedurally here. The ground reads the same field layout
// as the JavaScript that plants the hedges, crops and sheep (land.js).

const WORLD_VARYINGS = /* glsl */ `
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
const BUMP = 'normal = bumpNormal(-vViewPosition, normal, gH, faceDirection);'

function patch(material, key, { uniforms = {}, fragmentHead = '', color = '', rough = '', bump = BUMP, emissive = '' }) {
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms)
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${WORLD_VERTEX}`)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}\n${NOISE}\nfloat gH; float gRough;\n${fragmentHead}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${color}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${rough}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${bump}`)
      .replace('#include <opaque_fragment>', `${emissive}\n#include <opaque_fragment>`)
    material.userData.shader = s
  }
  material.customProgramCacheKey = () => key
  return material
}

const f = (v) => v.toFixed(6)

// The field layout, mirrored from land.js.
const FIELDS = /* glsl */ `
uniform sampler2D uCells;
uniform float uTime;
uniform float uWind;
const float CW = ${f(CW)};
const float CH = ${f(CH)};
vec2 toField(vec2 p) {
  float a = p.x * ${f(FIELD_C)} + p.y * ${f(FIELD_S)};
  float b = -p.x * ${f(FIELD_S)} + p.y * ${f(FIELD_C)};
  float u = a; float v = b;
  for (int k = 0; k < 4; k++) {
    u = a - (10.0 * sin(v * 0.012 + 1.0) + 4.0 * sin(v * 0.031));
    v = b - (8.0 * sin(u * 0.01) + 3.0 * sin(u * 0.027 + 2.0));
  }
  return vec2(u, v);
}
vec4 cellData(float i, float j) { return texture2D(uCells, (vec2(i, j) + 128.5) / 256.0); }
float laneX(float z) { return 18.0 + 22.0 * sin((z - 40.0) * 0.0065) + 9.0 * sin(z * 0.017 + 1.0); }
// 1 on a stripe of the given width repeating every period, antialiased by fw
float stripe(float x, float period, float width, float fw) {
  float d = abs(fract(x / period + 0.5) - 0.5) * period;
  return 1.0 - smoothstep(width * 0.5 - fw, width * 0.5 + fw, d);
}
`

// ---------------------------------------------------------------- ground

export function groundMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 })
  return patch(m, 'country-ground', {
    uniforms,
    fragmentHead: FIELDS,
    color: /* glsl */ `
      vec3 P = vGW;
      vec3 N = normalize(vGN);
      float h = P.y;
      float dist = length(P - cameraPosition);
      float near = 1.0 - smoothstep(30.0, 160.0, dist);
      float n1 = fbm2(P.xz * 0.018);
      float n2 = fbm2(P.xz * 0.21 + 7.0);
      float n3 = vn(P.xz * 2.3);
      float n4 = vn(P.xz * 8.0 + 4.0);
      float detail = mix(0.5, n3 * 0.6 + n4 * 0.4, near);
      gRough = 0.92;

      // which field, and where in it
      vec2 F = toField(P.xz);
      float j = floor(F.y / CH);
      float off = fract(j * 0.618) * CW;
      float i = floor((F.x - off) / CW);
      float fu = F.x - off - i * CW;
      float fv = F.y - j * CH;
      vec4 cd = cellData(i, j);
      float type = floor(cd.r * 255.0 / 16.0 + 0.5);
      float rnd = cd.g;
      float across = rnd > 0.5 ? fu : fv; // drill rows run along the other axis
      float fwA = fwidth(across) + 1e-4;
      float fine = 1.0 - smoothstep(0.04, 0.16, fwA); // can the rows be resolved?
      float jT = j + 1.0;
      float iT = floor((F.x - fract(jT * 0.618) * CW) / CW);
      float eL = fu; float eR = CW - fu; float eB = fv; float eT = CH - fv;
      float edge = min(min(eL, eR), min(eB, eT));
      float hedgeD = min(min(mix(1e4, eL, step(0.5, cd.b)), mix(1e4, eR, step(0.5, cellData(i + 1.0, j).b))), min(mix(1e4, eB, step(0.5, cd.a)), mix(1e4, eT, step(0.5, cellData(iT, jT).a))));

      // pasture: patches of lush and sun-dried grass, with clumps
      vec3 grass = mix(vec3(0.065, 0.135, 0.028), vec3(0.15, 0.23, 0.05), smoothstep(0.3, 0.75, n1));
      grass = mix(grass, vec3(0.24, 0.25, 0.09), smoothstep(0.6, 0.85, n2) * 0.35);
      grass *= 0.75 + 0.45 * detail;
      vec3 alb = grass;
      gH = detail * 0.04 * near;
      // tramlines: the tractor's wheel tracks, every 24 m across a crop
      float tram = (stripe(across + 0.9, 24.0, 0.45, fwA) + stripe(across - 0.9, 24.0, 0.45, fwA)) * (1.0 - smoothstep(0.4, 1.2, fwA));
      // the wind running over standing crops
      float sheen = vn(F * 0.045 + vec2(uTime * 0.32 * uWind, uTime * 0.11)) * 0.6 + vn(F * 0.11 + vec2(uTime * 0.6 * uWind, 0.0)) * 0.4;
      bool crop = false;
      if (type < 0.5) {
        // pasture, grazed shorter in places
        alb = grass * mix(1.0, 0.85, smoothstep(0.45, 0.7, n2));
      } else if (type < 1.5) {
        // ripe wheat
        vec3 w = mix(vec3(0.40, 0.28, 0.09), vec3(0.56, 0.41, 0.16), n2 * 0.7 + n1 * 0.3);
        float rows = stripe(across, 0.22, 0.08, fwA) * fine;
        w *= (1.0 - 0.3 * rows) * (0.8 + 0.35 * sheen) * (0.85 + 0.3 * detail);
        alb = mix(w, vec3(0.17, 0.14, 0.07), tram);
        gH = rows * 0.03 * near + n4 * 0.03 * near;
        crop = true;
      } else if (type < 2.5) {
        // barley: paler, silkier, still a little green
        vec3 b = mix(vec3(0.42, 0.38, 0.18), vec3(0.55, 0.48, 0.25), n2);
        b = mix(b, vec3(0.30, 0.34, 0.12), smoothstep(0.55, 0.8, n1) * 0.4);
        b *= (0.75 + 0.45 * sheen) * (0.85 + 0.3 * detail);
        alb = mix(b, vec3(0.17, 0.15, 0.08), tram);
        gH = n4 * 0.03 * near;
        crop = true;
      } else if (type < 3.5) {
        // ploughed: furrows of dark earth
        vec3 soil = vec3(0.12, 0.08, 0.05) * (0.75 + 0.5 * n2);
        float fr = 0.5 + 0.5 * sin(across * 6.2832 / 0.9);
        float k = 1.0 - smoothstep(0.15, 0.5, fwA);
        alb = soil * (0.75 + 0.45 * mix(0.5, fr, k)) * (0.85 + 0.3 * detail);
        gH = (fr * 0.12 * k + n4 * 0.04) * near;
        gRough = 0.97;
        crop = true;
      } else if (type < 4.5) {
        // mown hay: the mower's light and dark passes, and the windrows
        vec3 cut = mix(vec3(0.22, 0.26, 0.08), vec3(0.33, 0.33, 0.12), n2);
        float pass = smoothstep(0.45, 0.55, fract(across / 7.0)) * (1.0 - smoothstep(0.3, 2.0, fwA));
        cut *= mix(0.88, 1.1, pass);
        float row = stripe(across, 9.0, 1.1, fwA);
        alb = mix(cut, vec3(0.36, 0.30, 0.12) * (0.8 + 0.4 * n4), row) * (0.85 + 0.3 * detail);
        gH = (row * 0.08 + n4 * 0.03) * near;
        crop = true;
      } else if (type < 5.5) {
        // oilseed rape in flower
        vec3 y = vec3(0.62, 0.48, 0.02) * (0.85 + 0.3 * n2) * (0.85 + 0.25 * sheen);
        y = mix(y, vec3(0.12, 0.18, 0.03), smoothstep(0.62, 0.82, n2) * 0.45);
        y *= 0.85 + 0.3 * detail;
        alb = mix(y, vec3(0.10, 0.14, 0.04), tram);
        gH = n4 * 0.05 * near;
        crop = true;
      } else if (type < 6.5) {
        // a young crop: rows of green shoots over brown earth
        vec3 soil = vec3(0.13, 0.09, 0.055) * (0.8 + 0.4 * n2);
        vec3 shoots = vec3(0.09, 0.17, 0.035) * (0.8 + 0.4 * n4);
        float rows = stripe(across, 0.5, 0.2, fwA);
        alb = mix(mix(soil, shoots, 0.5), mix(soil, shoots, rows), fine);
        alb = mix(alb, soil, tram);
        gH = rows * 0.03 * fine * near;
        crop = true;
      } else if (type < 7.5) {
        // woodland: from afar, a canopy of rounded crowns
        float crowns = vn(P.xz * 0.22) * 0.6 + vn(P.xz * 0.7) * 0.4;
        alb = vec3(0.022, 0.05, 0.02) * (0.5 + 1.1 * crowns);
        gH = crowns * 3.0 * (1.0 - near);
      } else {
        // the hay meadow the viewer stands in, flecked with flowers
        alb = mix(grass, vec3(0.20, 0.25, 0.07), 0.3);
        float fl = smoothstep(0.82, 0.9, vn(P.xz * 3.1 + 2.0));
        alb = mix(alb, vec3(0.7, 0.62, 0.1), fl * 0.3 * (1.0 - near));
      }
      // an uncut margin of rough grass round the crops
      if (crop) {
        float margin = 1.0 - smoothstep(2.0, 3.2, edge + (n3 - 0.5) * 1.2);
        alb = mix(alb, vec3(0.10, 0.14, 0.04) * (0.8 + 0.4 * detail), margin);
      }
      // hedges: dark under the real ones near by, a line of crowns far off
      float hw = 1.5 + dist * 0.0006;
      float fwE = fwidth(hedgeD) + 1e-4;
      float hedge = 1.0 - smoothstep(hw - fwE, hw + fwE, hedgeD);
      // the hills above the fields: rough grazing and rock
      float fields = 1.0 - smoothstep(170.0, 240.0, h + (n1 - 0.5) * 90.0);
      vec3 rough = mix(vec3(0.16, 0.15, 0.08), vec3(0.08, 0.11, 0.04), n2) * (0.8 + 0.3 * detail);
      rough = mix(rough, vec3(0.13, 0.125, 0.12) * (0.8 + 0.4 * n2), smoothstep(0.8, 0.65, N.y));
      alb = mix(rough, alb, fields);
      hedge *= fields;
      // the lane: two wheel ruts, a grass crown, verges
      float inZ = step(${f(LANE_Z[0])}, P.z) * step(P.z, ${f(LANE_Z[1])});
      float dl = abs(P.x - laneX(P.z)) + (1.0 - inZ) * 1e4;
      float lane = 1.0 - smoothstep(${f(LANE_W - 0.3)}, ${f(LANE_W + 0.3)}, dl + (n3 - 0.5) * 0.4);
      float verge = 1.0 - smoothstep(${f(LANE_W + 0.3)}, ${f(LANE_W + 2.6)}, dl);
      // the yard round the farm
      float dy = length(P.xz - vec2(${f(FARM.x)}, ${f(FARM.z)}));
      float yard = 1.0 - smoothstep(${f(YARD_R - 8)}, ${f(YARD_R + 2)}, dy + (n2 - 0.5) * 12.0);
      hedge *= (1.0 - verge) * (1.0 - yard);
      float crownsH = vn(P.xz * 0.4) * 0.6 + vn(P.xz * 1.3) * 0.4;
      alb = mix(alb, vec3(0.025, 0.055, 0.018) * (0.6 + 0.9 * crownsH), hedge);
      gH = mix(gH, crownsH * 1.5 * (1.0 - near), hedge);
      alb = mix(alb, mix(alb, vec3(0.11, 0.15, 0.045) * (0.8 + 0.4 * detail), 0.7), verge * (1.0 - lane));
      vec3 gravel = vec3(0.21, 0.19, 0.16) * (0.7 + 0.6 * n4) * (0.9 + 0.2 * vn(P.xz * 30.0));
      float rut = 1.0 - smoothstep(0.18, 0.4, abs(dl - 0.78));
      gravel = mix(gravel, vec3(0.15, 0.12, 0.09) * (0.85 + 0.3 * n3), rut * 0.7);
      gravel = mix(gravel, grass * 0.9, 1.0 - smoothstep(0.25, 0.42, dl));
      alb = mix(alb, gravel, lane);
      gH = mix(gH, (n4 * 0.05 + vn(P.xz * 30.0) * 0.03) * near, lane);
      vec3 yd = mix(vec3(0.14, 0.135, 0.12) * (0.8 + 0.4 * n4), vec3(0.075, 0.065, 0.045), smoothstep(0.45, 0.7, n2) * 0.85);
      yd = mix(yd, grass * 0.8, smoothstep(0.55, 0.8, n1) * 0.5); // weeds and turf creeping in
      alb = mix(alb, yd, yard);
      gRough = mix(gRough, 0.75, yard * smoothstep(0.5, 0.75, n2));
      diffuseColor.rgb = alb;
    `,
    rough: 'roughnessFactor = gRough;',
  })
}

// ---------------------------------------------------------------- hedges

// A hedgerow: dense leaves in sprays, a few different shrubs along its
// length, shaded darker toward its foot (vertex colour), glowing a little
// where the sun comes through.
export function hedgeMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, vertexColors: true })
  return patch(m, 'country-hedge', {
    uniforms,
    fragmentHead: 'uniform vec3 uSunView; uniform vec3 uSunColor;',
    color: /* glsl */ `
      vec3 P = vGW;
      float dist = length(P - cameraPosition);
      float near = 1.0 - smoothstep(20.0, 220.0, dist);
      float l1 = vn3(P * 1.3);
      float l2 = vn3(P * 4.2 + 3.0);
      float l3 = vn3(P * 14.0 + 7.0);
      float leaf = l1 * 0.45 + l2 * 0.35 + l3 * 0.2 * near + 0.1 * (1.0 - near);
      vec3 alb = mix(vec3(0.016, 0.036, 0.011), vec3(0.085, 0.145, 0.032), smoothstep(0.3, 0.8, leaf));
      float sp = vn3(P * 0.07 + 11.0);
      alb = mix(alb, alb * vec3(1.3, 1.12, 0.7), smoothstep(0.55, 0.7, sp));
      alb = mix(alb, alb * vec3(0.75, 0.85, 0.95), smoothstep(0.62, 0.75, vn3(P * 0.05 - 4.0)));
      alb *= vColor.rgb;
      gH = (l2 * 0.5 + l3 * 0.5 * near) * 0.4 + l1 * 0.4;
      gRough = 0.82;
      diffuseColor.rgb = alb;
    `,
    rough: 'roughnessFactor = gRough;',
    emissive: `{ float through = pow(max(dot(normalize(-vViewPosition), -uSunView), 0.0), 2.0) * 0.4 + 0.04;
                 outgoingLight += diffuseColor.rgb * uSunColor * through * vec3(0.9, 1.0, 0.45); }`,
  })
}

// ---------------------------------------------------------------- props

// Fleece: the vertex colour (cream or black face) broken into staples.
export function woolMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, vertexColors: true })
  return patch(m, 'country-wool', {
    color: /* glsl */ `
      vec3 P = vGW;
      float w = vn3(P * 38.0) * 0.6 + vn3(P * 90.0) * 0.4;
      diffuseColor.rgb = vColor.rgb * (0.78 + 0.35 * w) * (0.9 + 0.2 * vn3(P * 3.0));
      gH = w * 0.025;
      gRough = 1.0;
    `,
    rough: 'roughnessFactor = gRough;',
  })
}

// Straw, as on a round bale: fine streaks wound round it, weathered grey.
export function strawMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 })
  return patch(m, 'country-straw', {
    color: /* glsl */ `
      vec3 P = vGW;
      vec3 N = normalize(vGN);
      float s = vn3(P * vec3(40.0, 6.0, 40.0)) * 0.6 + vn3(P * 120.0) * 0.4;
      vec3 alb = mix(vec3(0.34, 0.25, 0.11), vec3(0.56, 0.44, 0.2), s);
      alb = mix(alb, vec3(0.25, 0.23, 0.19), smoothstep(0.55, 0.8, vn3(P * 1.5)) * 0.5);
      diffuseColor.rgb = alb;
      gH = s * 0.03;
      gRough = 0.95;
    `,
    rough: 'roughnessFactor = gRough;',
  })
}

// Building surfaces, patterned on each face along the wall (its tangent is
// taken from the face's normal) and up it.
const ALONG = 'vec3 P = vGW; vec3 N = normalize(vGN); float along = dot(P.xz, normalize(vec2(-N.z, N.x) + vec2(1e-4, 0.0)));'
const KINDS = {
  // coursed limestone, honey coloured, lime mortar
  stone: /* glsl */ `
    ${ALONG}
    vec3 c = cells(vec2(along * 1.5, P.y * 2.7));
    float mortar = 1.0 - smoothstep(0.0, 0.09, c.y - c.x);
    vec3 st = mix(vec3(0.33, 0.27, 0.18), vec3(0.50, 0.43, 0.30), c.z) * (0.8 + 0.3 * vn(vec2(along, P.y) * 6.0));
    st = mix(st, vec3(0.16, 0.17, 0.12), smoothstep(0.6, 0.85, vn(vec2(along, P.y) * 0.8)) * 0.35);
    diffuseColor.rgb = mix(st, vec3(0.42, 0.40, 0.35), mortar);
    gH = (1.0 - mortar) * 0.03 + vn(vec2(along, P.y) * 20.0) * 0.006;
    gRough = 0.9;
  `,
  // tarred weatherboarding, as on old barns
  boards: /* glsl */ `
    ${ALONG}
    float b = fract(P.y / 0.24);
    float gap = smoothstep(0.08, 0.0, b);
    float grain = vn(vec2(along * 0.6, P.y * 40.0));
    vec3 col = vec3(0.045, 0.04, 0.035) * (0.8 + 0.5 * grain) * (0.85 + 0.3 * vn(vec2(along * 3.0, floor(P.y / 0.24))));
    diffuseColor.rgb = mix(col, vec3(0.015), gap);
    gH = (1.0 - b) * 0.02 - gap * 0.01;
    gRough = 0.8;
  `,
  // slate in courses
  slate: /* glsl */ `
    ${ALONG}
    float row = floor(P.y / 0.11);
    float u = along / 0.3 + row * 0.5;
    float id = vh(vec2(floor(u), row));
    float edge = max(smoothstep(0.88, 1.0, fract(P.y / 0.11)), smoothstep(0.06, 0.0, abs(fract(u) - 0.5) - 0.44));
    vec3 col = vec3(0.055, 0.06, 0.07) * (0.75 + 0.5 * id);
    col = mix(col, vec3(0.16, 0.17, 0.1), smoothstep(0.65, 0.85, vn(P.xz * 0.9)) * 0.4); // lichen
    diffuseColor.rgb = col * (1.0 - edge * 0.5);
    gH = fract(P.y / 0.11) * 0.012 - edge * 0.004;
    gRough = mix(0.55, 0.85, id);
  `,
  // corrugated iron, rusting
  iron: /* glsl */ `
    ${ALONG}
    float cor = sin(along * 6.2832 / 0.076);
    float rust = smoothstep(0.45, 0.75, vn(vec2(along, P.y) * 0.7) + vn(vec2(along * 8.0, P.y * 0.6)) * 0.3);
    vec3 col = mix(vec3(0.17, 0.17, 0.165), vec3(0.22, 0.09, 0.04), rust);
    diffuseColor.rgb = col * (0.85 + 0.15 * cor);
    gH = cor * 0.006;
    gRough = mix(0.45, 0.9, rust);
  `,
}
export function buildingMaterial(kind) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, side: THREE.DoubleSide })
  return patch(m, `country-${kind}`, { color: KINDS[kind], rough: 'roughnessFactor = gRough;' })
}

