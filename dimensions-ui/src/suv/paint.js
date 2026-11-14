import * as THREE from 'three'
import { ARCH_R, FRONT_AXLE, REAR_AXLE, WHEEL_R } from './geometry.js'

// The body is a single skin, and everything on it is drawn by its material
// rather than modelled: the glass and its pillars, the lamps, the grille, the
// black cladding, the shut lines of the doors, the battery under the floor.
// Each is a shape measured in metres on the car itself (in side view, end
// view or plan), so the edges stay sharp however close the camera comes.

const f = (n) => n.toFixed(4)

const HEAD = /* glsl */ `
varying vec3 vObj;
varying vec3 vLvl;
varying vec2 vSt;
uniform vec3 uPaint;
uniform float uLights;
uniform float uRoof;
vec3 rCol; float rRough; float rMetal; float rCoat; float rSpec; vec3 rEmis;

float sdBox(vec2 p, vec2 c, vec2 h, float r) {
  vec2 d = abs(p - c) - h + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// 1 inside a shape (distance below zero), with a one-pixel soft edge
float fill(float d) { return clamp(0.5 - d / max(fwidth(d), 1e-5), 0.0, 1.0); }
void put(float m, vec3 c, float rough, float metal, float coat) {
  rCol = mix(rCol, c, m); rRough = mix(rRough, rough, m); rMetal = mix(rMetal, metal, m); rCoat = mix(rCoat, coat, m);
}

const vec3 BLACK = vec3(0.012, 0.013, 0.016);
const vec3 PLASTIC = vec3(0.036, 0.038, 0.042);
const vec3 GLASS = vec3(0.018, 0.024, 0.03);
const vec3 SILVER = vec3(0.62, 0.64, 0.67);

// distance outside the nearer wheel opening, in side view
float rdArch(vec2 S) {
  return min(length(S - vec2(${f(FRONT_AXLE)}, ${f(WHEEL_R)})), length(S - vec2(${f(REAR_AXLE)}, ${f(WHEEL_R)}))) - ${f(ARCH_R)};
}

void rdPaint() {
  vec3 P = vObj;
  float az = abs(P.z);
  float b = vSt.y;
  vec2 S = P.xy;            // side view
  vec2 F = vec2(az, P.y);   // end view, mirrored about the centreline
  // where this point is on its own ring: -1 the nose .. 1 the tail, 0 the centreline .. 1 the side
  float cx = (P.x - 0.5 * (vLvl.x + vLvl.y)) / max(0.5 * (vLvl.y - vLvl.x), 1e-3);
  float sz = az / max(vLvl.z, 1e-3);
  float side = step(0.55, az);
  float front = step(P.x, -1.5) * step(b, 0.345);
  float rear = step(1.55, P.x) * step(b, 0.47);

  rCol = uPaint; rRough = 0.4; rMetal = 0.4; rCoat = 1.0; rSpec = 1.0; rEmis = vec3(0.0);

  // ---- black cladding: sills, lower bumpers, a band round each wheel opening
  float arch = rdArch(S);
  float clad = mix(mix(0.262, 0.3, smoothstep(-2.0, -1.8, P.x)), 0.46, smoothstep(1.86, 2.02, P.x));
  put(max(fill(P.y - clad), side * fill(arch - 0.04) * step(P.y, 0.9)), PLASTIC, 0.72, 0.0, 0.0);

  // ---- shut lines, handles and the charging flap, in side view
  float low = step(b, 0.468) * side;
  float ln = sdSeg(S, vec2(-0.8, 0.3), vec2(-0.8, 1.06));
  ln = min(ln, sdSeg(S, vec2(0.31, 0.3), vec2(0.31, 1.06)));
  ln = min(ln, sdSeg(S, vec2(0.955, 0.3), vec2(0.965, 0.5)));
  ln = min(ln, sdSeg(S, vec2(0.965, 0.5), vec2(1.07, 0.76)));
  ln = min(ln, sdSeg(S, vec2(1.07, 0.76), vec2(1.27, 0.9)));
  ln = min(ln, sdSeg(S, vec2(1.27, 0.9), vec2(1.37, 1.08)));
  float flap = abs(sdBox(S, vec2(1.79, 0.84), vec2(0.085, 0.072), 0.03));
  ln = min(ln, mix(1.0, flap, step(0.0, P.z)));
  put(low * fill(ln - 0.0022), BLACK, 0.5, 0.0, 0.2);
  float handle = min(sdBox(S, vec2(-0.03, 0.965), vec2(0.088, 0.0125), 0.012), sdBox(S, vec2(0.9, 0.985), vec2(0.088, 0.0125), 0.012));
  put(low * fill(handle), SILVER, 0.16, 1.0, 1.0);
  // the bonnet: its two edges, and its leading edge along one ring
  float hood = step(0.345, b) * step(b, 0.455) * step(cx, 0.0);
  put(hood * fill(abs(az - 0.745) - 0.002) * step(P.x, -1.0), BLACK, 0.5, 0.0, 0.2);
  put(step(cx, -0.2) * step(az, 0.745) * fill(abs(b - 0.342) - 0.0012), BLACK, 0.5, 0.0, 0.2);
  // the tailgate
  float tg = min(sdSeg(F, vec2(0.0, 0.56), vec2(0.78, 0.56)), sdSeg(F, vec2(0.78, 0.56), vec2(0.8, 1.04)));
  put(rear * step(2.06, P.x) * fill(tg - 0.0022), BLACK, 0.5, 0.0, 0.2);

  // ---- glass: one band between the base of the screens and the roof
  float band = fill(0.471 - b) * fill(b - 0.58);
  float screen = step(cx, 0.0) * fill(sz - 0.86);
  float back = step(0.0, cx) * fill(sz - 0.82);
  float sides = side * fill(-cx - 0.6) * fill(cx - 0.56);
  float glass = band * max(max(screen, back), sides);
  put(glass, GLASS, 0.035, 0.0, 0.0);
  rSpec = mix(rSpec, 0.5, glass);   // tinted: it mirrors the studio at half strength
  // gloss-black pillars between the side windows, and the strip under them
  float pillar = min(abs(P.x - 0.31) - 0.045, abs(P.x - (1.02 + 0.5 * (P.y - 1.06))) - 0.032);
  put(band * sides * fill(pillar), BLACK, 0.1, 0.0, 1.0);
  put(side * fill(abs(b - 0.463) - 0.008) * fill(-cx - 0.62) * fill(cx - 0.6), BLACK, 0.12, 0.0, 1.0);
  // the black frame printed round the edge of each screen
  put(band * max(screen, back) * max(fill(0.478 - b), fill(b - 0.573)), BLACK, 0.06, 0.0, 1.0);
  // panoramic roof
  float top = uRoof * step(0.62, b) * fill(sdBox(P.xz, vec2(0.9, 0.0), vec2(0.74, 0.5), 0.14));
  put(top, GLASS, 0.035, 0.0, 0.0);
  rSpec = mix(rSpec, 0.5, top);

  // ---- the nose
  float hw = 0.46 + 0.13 * clamp((P.y - 0.53) / 0.3, 0.0, 1.0);
  float grille = sdBox(vec2(az * 0.55 / hw, P.y), vec2(0.0, 0.682), vec2(0.55, 0.148), 0.06);
  put(front * fill(grille), BLACK, 0.09, 0.0, 1.0);
  vec2 cell = vec2(P.z, P.y) / 0.027;
  cell.x += 0.5 * mod(floor(cell.y), 2.0);
  float dots = (length(fract(cell) - 0.5) - 0.16) * 0.027;
  put(front * fill(grille + 0.022) * fill(dots), vec3(0.5, 0.52, 0.55), 0.22, 1.0, 1.0);
  // headlamp: a dark lens that tapers round the corner, lit along its top edge
  float t = clamp((az - 0.47) / 0.4, 0.0, 1.0);
  float lamp = sdSeg(F, vec2(0.47, 0.808), vec2(0.86, 0.866)) - mix(0.036, 0.018, t);
  // on the flank each lamp ends in a point
  float nib = fill(P.x + 1.68 + 1.6 * abs(P.y - 0.86));
  front *= mix(1.0, nib, side * step(0.6, P.y));
  put(front * fill(lamp), vec3(0.03, 0.034, 0.042), 0.06, 0.7, 1.0);
  float eye = min(length(F - vec2(0.585, 0.816)), length(F - vec2(0.68, 0.83))) - 0.017;
  put(front * fill(eye), vec3(0.2, 0.22, 0.25), 0.04, 1.0, 1.0);
  put(front * fill(eye + 0.008), vec3(0.6, 0.64, 0.7), 0.04, 1.0, 1.0);
  float drl = min(sdSeg(F, vec2(0.452, 0.836), vec2(0.87, 0.896)) - 0.0048, sdSeg(F, vec2(0.0, 0.836), vec2(0.452, 0.836)) - 0.0038);
  put(front * fill(drl), vec3(0.86, 0.88, 0.9), 0.2, 0.0, 1.0);
  rEmis += front * (fill(drl) * 2.4 + fill(eye + 0.008) * 0.9) * uLights * vec3(1.0, 0.97, 0.93);
  // lower intake, the air curtains at the corners, a bright skid plate
  put(front * fill(sdBox(F, vec2(0.0, 0.33), vec2(0.5, 0.05), 0.03)), BLACK, 0.55, 0.0, 0.0);
  put(front * fill(sdBox(F, vec2(0.745, 0.415), vec2(0.06, 0.05), 0.03)), BLACK, 0.4, 0.0, 0.3);
  put(front * fill(sdBox(F, vec2(0.0, 0.244), vec2(0.42, 0.012), 0.011)), SILVER, 0.34, 0.9, 0.3);

  // ---- the tail: one lamp across the full width, thicker where it turns the corner
  float bar = min(sdSeg(F, vec2(0.0, 1.1), vec2(0.8, 1.1)) - 0.016, sdSeg(F, vec2(0.62, 1.096), vec2(0.868, 1.11)) - 0.03);
  float tip = mix(1.0, fill(1.8 + 2.2 * abs(P.y - 1.103) - P.x), side);
  put(rear * tip * fill(bar), vec3(0.3, 0.012, 0.014), 0.1, 0.0, 1.0);
  rEmis += rear * tip * fill(bar + 0.006) * uLights * vec3(1.0, 0.02, 0.012) * 1.3;
  put(rear * fill(sdBox(F, vec2(0.7, 0.5), vec2(0.075, 0.012), 0.008)), vec3(0.5, 0.02, 0.02), 0.25, 0.0, 1.0);
  put(rear * fill(sdBox(F, vec2(0.0, 0.335), vec2(0.48, 0.028), 0.02)), SILVER, 0.34, 0.9, 0.3);

  // ---- under the floor: the battery between the axles
  float under = step(b, 0.075);
  put(under, vec3(0.022), 0.85, 0.0, 0.0);
  float pack = sdBox(P.xz, vec2(0.1, 0.0), vec2(0.98, 0.62), 0.05);
  put(under * fill(pack), vec3(0.14, 0.15, 0.16), 0.6, 0.4, 0.0);
  put(under * fill(pack + 0.03) * fill(abs(fract(P.x / 0.196) - 0.5) * 0.196 - 0.004), vec3(0.06), 0.7, 0.2, 0.0);
}
`

// paint: the body colour. lights: 0..1. roof: 1 for the glass roof.
export function bodyMaterial() {
  const uniforms = { uPaint: { value: new THREE.Color('#2b4a85') }, uLights: { value: 1 }, uRoof: { value: 1 } }
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 lvl;\nvarying vec3 vObj;\nvarying vec3 vLvl;\nvarying vec2 vSt;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\nvLvl = lvl;\nvSt = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HEAD)
      // nothing is drawn inside the wheel openings
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (abs(vObj.z) > 0.6 && vObj.y < 0.9 && rdArch(vObj.xy) < 0.0) discard;\nrdPaint();')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = rCol;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = rMetal;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= rCoat;\nmaterial.specularColor *= rSpec;\nmaterial.specularF90 *= rSpec;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += rEmis;')
  }
  m.customProgramCacheKey = () => 'rd-suv-body'
  m.userData.uniforms = uniforms
  return m
}
