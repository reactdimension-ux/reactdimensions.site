// The river: a flowing low-poly surface. The vertex shader rolls small
// waves along the flow (calm at the banks); the fragment shader takes each
// facet's normal from screen derivatives, mirrors the sky cube in it with
// a Fresnel blend, puts the sun's glint on it, and lays foam along the
// banks and in streaks that drift downstream.

export const waterVertex = /* glsl */ `
uniform float uTime;
uniform float uFlow;
varying vec2 vUv;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec3 p = position;
  float along = uv.y;
  float across = uv.x;
  float edge = 1.0 - pow(abs(across * 2.0 - 1.0), 3.0);
  float w = sin(along * 0.9 - uTime * uFlow * 2.2 + across * 4.0) * 0.09
          + sin(along * 2.3 - uTime * uFlow * 3.1 + across * 9.0) * 0.05
          + sin(across * 12.0 + uTime * 1.7 + along * 0.4) * 0.04;
  p.y += w * edge;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

export const waterFragment = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform samplerCube uSky;
uniform float uTime;
uniform float uFlow;
varying vec2 vUv;
varying vec3 vWorld;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (n.y < 0.0) n = -n;
  vec3 v = normalize(cameraPosition - vWorld);
  float a = abs(vUv.x * 2.0 - 1.0);
  float depth = 1.0 - a * a;
  vec3 col = mix(uShallow, uDeep, depth);
  // streaks drifting downstream
  float s = vnoise(vec2(vUv.x * 6.0, vUv.y * 0.6 - uTime * uFlow * 0.9));
  col += smoothstep(0.62, 0.8, s) * 0.22 * uShallow;
  // foam: a broken line along each bank and flecks mid-stream
  float f1 = vnoise(vec2(vUv.x * 14.0, vUv.y * 1.6 - uTime * uFlow * 1.6));
  float foam = smoothstep(0.78, 0.98, a + (f1 - 0.5) * 0.25) + smoothstep(0.84, 0.92, f1) * 0.3 * (1.0 - depth * 0.6);
  // the sky in the water
  vec3 refl = reflect(-v, n);
  vec3 sky = textureCube(uSky, vec3(refl.x, max(refl.y, 0.03), refl.z)).rgb;
  float fres = 0.08 + 0.92 * pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col = mix(col, sky, fres * 0.7);
  // the sun's glint
  vec3 h = normalize(uSunDir + v);
  float nh = max(dot(n, h), 0.0);
  col += uSunColor * (pow(nh, 260.0) * 3.0 + pow(nh, 24.0) * 0.18);
  col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
  gl_FragColor = vec4(col, 0.93);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`
