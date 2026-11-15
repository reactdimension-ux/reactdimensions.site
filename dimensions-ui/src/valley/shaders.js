import * as THREE from 'three'

// Shader code for the valley. The ground, rocks, foliage and grass are
// MeshStandardMaterials patched in onBeforeCompile, so they keep three's
// physical lighting, shadows, environment light and fog; only their
// colour, roughness and fine surface relief are made procedurally here.
// The river is a custom shader on a planar Reflector.

// Hash-based noise that stays stable at large coordinates.
export const NOISE = /* glsl */ `
float vh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vh3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vh(i), vh(i + vec2(1.0, 0.0)), u.x), mix(vh(i + vec2(0.0, 1.0)), vh(i + vec2(1.0, 1.0)), u.x), u.y);
}
float vn3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(vh3(i), vh3(i + vec3(1, 0, 0)), u.x), mix(vh3(i + vec3(0, 1, 0)), vh3(i + vec3(1, 1, 0)), u.x), u.y);
  float b = mix(mix(vh3(i + vec3(0, 0, 1)), vh3(i + vec3(1, 0, 1)), u.x), mix(vh3(i + vec3(0, 1, 1)), vh3(i + vec3(1, 1, 1)), u.x), u.y);
  return mix(a, b, u.z);
}
float fbm2(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 3.1; a *= 0.5; }
  return s / 0.96875;
}
float fbm3(vec3 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vn3(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return s / 0.9375;
}
// cells: x = distance to the nearest feature, y = to the second, z = the cell's id
vec3 cells(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  float d1 = 8.0; float d2 = 8.0; float id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(vh(i + g), vh(i + g + 17.7));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = vh(i + g + 3.3); } else if (d < d2) { d2 = d; }
  }
  return vec3(d1, d2, id);
}
// three's bump mapping: tilt the normal by the screen-space slope of a height
vec3 bumpNormal(vec3 surfPos, vec3 surfNorm, float h, float faceDirection) {
  vec3 sx = dFdx(surfPos); vec3 sy = dFdy(surfPos);
  vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 r1 = cross(sy, surfNorm); vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`

// World position and world normal, for any (instanced or not) mesh.
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

function patch(material, key, { uniforms = {}, vertexHead = '', vertex = '', fragmentHead = '', color = '', rough = '', bump = '', emissive = '' }) {
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms)
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}\n${vertexHead}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WORLD_VERTEX}\n${vertex}`)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}\n${NOISE}\n${fragmentHead}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${color}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${rough}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${bump}`)
      .replace('#include <opaque_fragment>', `${emissive}\n#include <opaque_fragment>`)
    material.userData.shader = s
  }
  material.customProgramCacheKey = () => key
  return material
}

// ---------------------------------------------------------------- ground

export function groundMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 })
  return patch(m, 'valley-ground', {
    uniforms,
    fragmentHead: /* glsl */ `
      uniform float uTime;
      uniform float uSnowline;
      float gH; float gRough;
    `,
    color: /* glsl */ `
      vec3 P = vGW;
      vec3 N = normalize(vGN);
      float h = P.y;
      float dist = length(P - cameraPosition);
      float near = 1.0 - smoothstep(25.0, 120.0, dist);
      float mid = 1.0 - smoothstep(120.0, 600.0, dist);
      float n1 = fbm2(P.xz * 0.03);
      float n2 = fbm2(P.xz * 0.37 + 7.0);
      float n3 = vn(P.xz * 2.7);
      float n4 = vn(P.xz * 9.0 + 4.0);
      // meadow grass: patches of lush and sun-dried, with clumps
      vec3 alb = mix(vec3(0.075, 0.15, 0.028), vec3(0.17, 0.25, 0.05), smoothstep(0.32, 0.72, n1));
      alb = mix(alb, vec3(0.30, 0.29, 0.11), smoothstep(0.58, 0.82, n2) * 0.5);
      alb *= 0.72 + 0.5 * mix(0.5, n3 * 0.6 + n4 * 0.4, near);
      gH = (n4 * 0.5 + n3 * 0.5) * 0.04 * near;
      gRough = 0.93;
      // bare earth on banks and the steeper turf
      float dirt = smoothstep(0.88, 0.8, N.y + (n2 - 0.5) * 0.1);
      vec3 soil = vec3(0.16, 0.11, 0.07) * (0.75 + 0.5 * n2);
      alb = mix(alb, soil, dirt);
      // rock on cliffs: dark weathered stone, streaked down the fall line
      float rockAmt = smoothstep(0.76, 0.64, N.y + (n2 - 0.5) * 0.14);
      vec3 rock = vec3(0.11, 0.105, 0.1);
      if (rockAmt > 0.001 || h > 120.0) {
        float streak = fbm2(vec2(P.x + P.z, P.y * 0.15) * 0.09);
        float strata = fbm2(vec2(P.x * 0.01, P.y * 0.08 + n1 * 3.0));
        rock = mix(vec3(0.055, 0.055, 0.058), vec3(0.17, 0.165, 0.16), smoothstep(0.25, 0.8, streak * 0.6 + strata * 0.4));
        rock *= 0.8 + 0.4 * n3;
        alb = mix(alb, rock, rockAmt);
        gH = mix(gH, (fbm2(P.xz * 0.06) * 3.0 + n2 * 0.6) * mid + n4 * 0.04 * near, rockAmt);
        gRough = mix(gRough, 0.82, rockAmt);
      }
      // above the trees: thin alpine turf, scree and stone
      float alpine = smoothstep(150.0, 260.0, h + (n1 - 0.5) * 120.0);
      alb = mix(alb, mix(vec3(0.14, 0.13, 0.09), rock, 0.55 + 0.45 * rockAmt), alpine);
      // distant forest on the hills, where no real trees are planted
      float woods = dist < 240.0 ? 0.0 : smoothstep(0.42, 0.52, fbm2(P.xz * 0.0045 + 3.0)) * (1.0 - smoothstep(100.0, 190.0, h + (n1 - 0.5) * 80.0));
      woods *= smoothstep(4.0, 16.0, h) * smoothstep(0.66, 0.8, N.y) * smoothstep(240.0, 480.0, dist);
      if (woods > 0.001) {
        float crowns = vn(P.xz * 0.22) * 0.6 + vn(P.xz * 0.7) * 0.4;
        alb = mix(alb, vec3(0.022, 0.05, 0.02) * (0.5 + 1.1 * crowns), woods);
        gH = mix(gH, crowns * 3.0, woods);
      }
      // the waterline: damp dark earth, then the pebbled bed
      float wet = 1.0 - smoothstep(0.1, 0.75 + n2 * 0.5, h);
      alb = mix(alb, vec3(0.09, 0.075, 0.055) * (0.8 + 0.4 * n3), wet * 0.85);
      gRough = mix(gRough, 0.45, wet);
      float under = 1.0 - smoothstep(-0.12, 0.2, h);
      if (under > 0.001) {
        vec3 c = cells(P.xz * 5.5);
        float pebble = smoothstep(0.0, 0.18, c.y - c.x);
        vec3 stone = mix(vec3(0.07, 0.06, 0.045), vec3(0.2, 0.17, 0.13), c.z) * (0.7 + 0.3 * n4);
        vec3 bed = mix(vec3(0.06, 0.055, 0.045), stone, mix(0.6, pebble, near));
        bed = mix(bed, vec3(0.10, 0.12, 0.05), smoothstep(0.55, 0.75, n2) * 0.5); // weed and algae
        alb = mix(alb, bed, under);
        gH = mix(gH, pebble * (0.3 + c.z * 0.2) * 0.12 * near, under);
        gRough = mix(gRough, 0.35, under);
        // sunlight dancing on the shallows
        vec2 q = P.xz * 1.7;
        float k1 = vn(q + uTime * vec2(0.13, 0.55));
        float k2 = vn(q * 1.37 - uTime * vec2(0.21, -0.43));
        float caustic = pow(1.0 - abs(k1 - k2), 24.0);
        alb += caustic * vec3(0.16, 0.18, 0.14) * under * smoothstep(-2.4, -0.15, h) * near;
      }
      // snow, lying on everything but the steepest faces
      float snow = smoothstep(uSnowline - 30.0, uSnowline + 30.0, h + (n1 - 0.5) * 170.0 + (n2 - 0.5) * 40.0);
      snow *= smoothstep(0.3, 0.55, N.y + (n2 - 0.5) * 0.3);
      if (snow > 0.001) {
        alb = mix(alb, vec3(0.86, 0.89, 0.93) * (0.92 + 0.08 * n3), snow);
        gH = mix(gH, fbm2(P.xz * 0.08) * 1.5, snow);
        gRough = mix(gRough, 0.6, snow);
      }
      // seen through the water: red goes first, then green
      alb *= exp(min(h, 0.0) * vec3(1.6, 0.6, 0.45));
      diffuseColor.rgb = alb;
    `,
    rough: 'roughnessFactor = gRough;',
    bump: 'normal = bumpNormal(-vViewPosition, normal, gH, faceDirection);',
  })
}

// ---------------------------------------------------------------- rocks

export function rockMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 })
  return patch(m, 'valley-rock', {
    fragmentHead: 'float gH; float gRough;',
    color: /* glsl */ `
      vec3 P = vGW;
      vec3 N = normalize(vGN);
      float dist = length(P - cameraPosition);
      float near = 1.0 - smoothstep(20.0, 140.0, dist);
      float n1 = fbm3(P * 0.9);
      float n2 = fbm3(P * 3.7 + 5.0);
      float n3 = vn3(P * 14.0);
      // granite: grey with darker veins and flecks
      vec3 alb = mix(vec3(0.11, 0.105, 0.10), vec3(0.33, 0.32, 0.30), smoothstep(0.25, 0.75, n1));
      alb *= 0.78 + 0.35 * n2;
      alb = mix(alb, vec3(0.05), smoothstep(0.83, 0.9, n3) * 0.5 * near);
      alb = mix(alb, vec3(0.5, 0.49, 0.45), smoothstep(0.86, 0.93, vn3(P * 19.0 + 3.0)) * 0.45 * near);
      // lichen and moss on the faces that catch the rain
      float up = smoothstep(0.35, 0.85, N.y);
      float moss = up * smoothstep(0.45, 0.6, fbm3(P * 1.6 + 11.0));
      alb = mix(alb, vec3(0.07, 0.12, 0.03) * (0.7 + 0.6 * n2), moss);
      float lichen = smoothstep(0.7, 0.76, vn3(P * 5.0 + 2.0)) * (1.0 - moss);
      alb = mix(alb, vec3(0.42, 0.40, 0.30), lichen * 0.6);
      gH = (n1 * 0.08 + n2 * 0.03 + n3 * 0.008 * near) + moss * n3 * 0.01;
      gRough = mix(0.86, 0.95, moss);
      // wet at the waterline, slick below it
      float wet = 1.0 - smoothstep(0.05, 0.45 + n2 * 0.25, P.y);
      alb *= 1.0 - wet * 0.55;
      gRough = mix(gRough, 0.25, wet);
      alb = mix(alb, vec3(0.06, 0.08, 0.04), (1.0 - smoothstep(-0.4, 0.05, P.y)) * 0.6);
      diffuseColor.rgb = alb;
    `,
    rough: 'roughnessFactor = gRough;',
    bump: 'normal = bumpNormal(-vViewPosition, normal, gH, faceDirection);',
  })
}

// ---------------------------------------------------------------- foliage

// Wind for anything instanced and anchored at its foot: the higher a point,
// the further it moves, in one world-space direction, with gusts rolling
// across the landscape. Leaves also flutter on their own.
const WIND_HEAD = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform float uFlutter;
uniform float uBend;
uniform float uAmp;
`
const WIND_PROJECT = /* glsl */ `
  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  vec4 wp = modelMatrix * mvPosition;
  {
    float base = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;
    float hgt = max(wp.y - base, 0.0);
    float gust = 0.6 + 0.4 * sin(uTime * 0.7 - wp.x * 0.05 - wp.z * 0.03) * sin(uTime * 0.23 + wp.z * 0.02);
    float sw = (sin(uTime * 1.3 + wp.x * 0.11 + wp.z * 0.07) * 0.6 + 0.4) * gust * uWind;
    float k = pow(hgt, uBend);
    wp.x += sw * k * uAmp;
    wp.z += sw * k * uAmp * 0.5;
    float fl = sin(uTime * 7.0 + position.x * 5.0 + position.y * 4.0 + position.z * 3.0) * uFlutter * uWind * gust;
    wp.xyz += normalize(vGN + vec3(0.001)) * fl * 0.035;
  }
  mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
`

export function foliageMaterial(params, uniforms, { flutter = 1, bend = 1.5, amp = 0.012, translucent = true, crownNormals = true } = {}) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, ...params })
  const key = `valley-foliage-${translucent}-${crownNormals}`
  patch(m, key, {
    uniforms: { ...uniforms, uFlutter: { value: flutter }, uBend: { value: bend }, uAmp: { value: amp } },
    // double-sided cards keep the crown's normal on both faces
    bump: crownNormals ? 'normal = normalize(vNormal);' : '',
    vertexHead: WIND_HEAD,
    fragmentHead: 'uniform vec3 uSunView; uniform vec3 uSunColor;',
    // light passing through the leaves when they are seen against the sun
    emissive: translucent
      ? `{ float through = pow(max(dot(normalize(-vViewPosition), -uSunView), 0.0), 2.0) * 0.55 + 0.06;
           outgoingLight += diffuseColor.rgb * uSunColor * through * vec3(0.9, 1.0, 0.45); }`
      : '',
  })
  const inner = m.onBeforeCompile
  m.onBeforeCompile = (s) => {
    inner(s)
    s.vertexShader = s.vertexShader.replace('#include <project_vertex>', WIND_PROJECT)
  }
  return m
}

// ---------------------------------------------------------------- water

export const waterShader = {
  name: 'ValleyRiver',
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      color: { value: new THREE.Color() },
      tDiffuse: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uFlow: { value: 1 },
      uMap: { value: null },
      uRegion: { value: new THREE.Vector4() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uDeep: { value: new THREE.Color('#0b3b3a') },
      uShallow: { value: new THREE.Color('#2f7d72') },
      uSkyColor: { value: new THREE.Color('#9cc3e6') },
    },
  ]),
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vRefl;
    varying vec3 vWorld;
    #include <fog_pars_vertex>
    void main() {
      vRefl = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D uMap;
    uniform vec4 uRegion;
    uniform float uTime;
    uniform float uFlow;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec3 uSkyColor;
    varying vec4 vRefl;
    varying vec3 vWorld;
    #include <fog_pars_fragment>
    ${NOISE}
    // the surface: ripples carried downstream (+z), small chop riding on them
    float waves(vec2 p, float t) {
      float s = 0.0;
      s += vn(p * vec2(0.55, 0.32) + vec2(0.0, -t * 0.9)) * 0.55;
      s += vn(p * vec2(1.3, 0.9) + vec2(t * 0.2, -t * 1.6)) * 0.28;
      s += vn(p * 3.1 + vec2(-t * 0.5, -t * 2.6)) * 0.12;
      s += vn(p * 7.3 + vec2(t * 0.9, -t * 3.4)) * 0.05;
      return s;
    }
    void main() {
      vec2 muv = (vWorld.xz - uRegion.xy) / uRegion.zw;
      vec2 m = texture2D(uMap, muv).rg;
      float depth = max(-m.r, 0.0);
      float dist = length(cameraPosition - vWorld);
      float t = uTime * uFlow;
      float e = 0.05;
      float w0 = waves(vWorld.xz, t);
      float wx = waves(vWorld.xz + vec2(e, 0.0), t);
      float wz = waves(vWorld.xz + vec2(0.0, e), t);
      float amp = 0.11 * mix(0.35, 1.0, smoothstep(0.0, 0.8, depth)) * (1.0 + 2.5 * m.g);
      amp /= 1.0 + dist * 0.004; // calmer to the eye with distance
      vec3 n = normalize(vec3(-(wx - w0) / e * amp, 1.0, -(wz - w0) / e * amp));
      vec3 v = normalize(cameraPosition - vWorld);
      float ndv = max(dot(n, v), 0.0);
      float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
      // the mirrored world, bent by the ripples
      vec4 rc = vRefl;
      rc.xy += n.xz * 1.6 * rc.w * 0.06 / (1.0 + dist * 0.01);
      vec3 refl = texture2DProj(tDiffuse, rc).rgb;
      // light scattered up from within the water, deeper reads darker and greener
      float tr = exp(-depth * 1.05);
      vec3 body = mix(uDeep, uShallow, exp(-depth * 0.7)) * (0.35 + 0.65 * max(uSunDir.y, 0.15));
      // the sun's glitter
      vec3 hv = normalize(uSunDir + v);
      float nh = max(dot(n, hv), 0.0);
      vec3 spec = uSunColor * (pow(nh, 900.0) * 18.0 + pow(nh, 120.0) * 0.6);
      // white water where the river breaks round rocks, and lapping at the shore
      float fn = vn(vWorld.xz * vec2(1.6, 0.7) + vec2(0.0, -t * 1.8)) * 0.6 + vn(vWorld.xz * 4.5 + vec2(0.0, -t * 2.6)) * 0.4;
      float foam = smoothstep(0.5, 0.9, m.g * (0.4 + fn * 0.9)) * smoothstep(0.1, 0.5, depth) * 0.6;
      foam += smoothstep(0.12, 0.03, depth) * smoothstep(0.6, 0.85, fn) * 0.35;
      foam = clamp(foam, 0.0, 1.0) * (1.0 - smoothstep(60.0, 220.0, dist) * 0.7);
      // compose over the riverbed already drawn behind:
      //   out = F * reflection + (1 - F) * [(1 - T) * body + T * bed]
      float a = 1.0 - (1.0 - fres) * tr;
      vec3 col = (fres * refl + (1.0 - fres) * (1.0 - tr) * body) / max(a, 1e-3);
      col += spec;
      vec3 foamCol = (uSunColor * 0.9 + uSkyColor * 0.35) * 0.8;
      col = mix(col, foamCol, foam);
      a = max(a, foam);
      a *= smoothstep(-0.02, 0.06, depth); // feather the shoreline
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }
  `,
}

// ---------------------------------------------------------------- clouds

// Billboarded puffs. Each is shaded by where it sits in its cloud: lit on
// the sun's side and on top, grey-blue underneath.
export const cloudVertex = /* glsl */ `
attribute vec3 aOffset;
attribute vec4 aPuff; // size, rotation, shade, seed
uniform vec3 uSunDir;
varying vec2 vUv;
varying float vShade;
varying float vLit;
varying float vSeed;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 wc = modelMatrix * vec4(aOffset, 1.0);
  vec4 mvPosition = viewMatrix * wc;
  float c = cos(aPuff.y); float s = sin(aPuff.y);
  vec2 corner = mat2(c, s, -s, c) * position.xy * aPuff.x;
  mvPosition.xy += corner;
  vShade = aPuff.z;
  vLit = dot(normalize(aOffset), uSunDir);
  vSeed = aPuff.w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`
export const cloudFragment = /* glsl */ `
uniform sampler2D uTex;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uShadowColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vShade;
varying float vLit;
varying float vSeed;
#include <fog_pars_fragment>
void main() {
  vec2 uv = vUv;
  if (vSeed > 0.5) uv.x = 1.0 - uv.x;
  vec4 t = texture2D(uTex, uv);
  float a = t.a * uOpacity;
  if (a < 0.01) discard;
  // t.r is the puff's own self-shading: bright rim, darker core toward its foot
  float lit = clamp(vShade * 0.7 + vLit * 0.3, 0.0, 1.0) * mix(0.55, 1.0, t.r);
  vec3 col = mix(uShadowColor, uSunColor * 2.6 + uSkyColor * 0.7, smoothstep(0.0, 1.0, lit));
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`
