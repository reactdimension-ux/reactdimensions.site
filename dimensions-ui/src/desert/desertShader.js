import { duneGLSL } from './dunes.js'

// The sand. The vertex shader lifts a radial grid onto the dune field and
// takes its normal from the same function. The fragment shader adds what
// makes sand read as sand: wind ripples on the windward slopes that fade on
// the slip faces, grain, glitter from individual grains catching the sun, a
// soft retro-reflective glow when the sun is behind you, a marched sun
// shadow so the lee of every dune goes dark, sky light from above and
// bounced light from the ground, and dusty aerial perspective to the horizon.

export const desertVertex = /* glsl */ `
uniform vec2 uWind;
uniform float uSpacing;
uniform float uHeight;
uniform vec2 uOrigin;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

${duneGLSL}

vec2 toWind(vec2 p) { return vec2(p.x * uWind.y - p.y * uWind.x, p.x * uWind.x + p.y * uWind.y) / uSpacing; }
float ground(vec2 p, float fade, float soft) { return duneShape(toWind(p + uOrigin), 3, fade, soft) * uHeight; }

void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float dist = length(wp.xz - cameraPosition.xz);
  float e = max(0.35, dist * 0.003);
  // the finer dunes fade out where the grid can no longer draw their crests
  float fade = 1.0 - smoothstep(uSpacing * 6.0, uSpacing * 30.0, dist);
  // and the crests round off as the triangles that draw them grow
  float soft = mix(0.03, 0.4, smoothstep(uSpacing * 0.8, uSpacing * 12.0, dist));
  float h = ground(wp.xz, fade, soft);
  float hx = ground(wp.xz + vec2(e, 0.0), fade, soft);
  float hz = ground(wp.xz + vec2(0.0, e), fade, soft);
  wp.y = h;
  vWorldPos = wp;
  vNormal = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
  vHeight = h / uHeight;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`

export const desertFragment = /* glsl */ `
uniform samplerCube uEnv;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyDirs[4];
uniform vec3 uSand;
uniform vec3 uDust;
uniform float uHaze;
uniform float uSparkle;
uniform float uTime;
uniform float uWindSpeed;
uniform vec2 uWind;
uniform float uSpacing;
uniform float uHeight;
uniform vec2 uOrigin;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vHeight;

#define PI 3.14159265

${duneGLSL}

vec2 toWind(vec2 p) { return vec2(p.x * uWind.y - p.y * uWind.x, p.x * uWind.x + p.y * uWind.y) / uSpacing; }
float groundLow(vec2 p) { return duneShape(toWind(p + uOrigin), 1, 1.0, 0.08) * uHeight; }

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

// wind ripples: a sine across the wind, bent by noise, creeping downwind
float ripples(vec2 p) {
  vec2 w = vec2(p.x * uWind.y - p.y * uWind.x, p.x * uWind.x + p.y * uWind.y);
  float bend = vnoise(w * 0.35) * 2.2 + vnoise(w * 1.3) * 0.5;
  float ph = (w.y + bend - uTime * uWindSpeed * 0.004) / 0.13 * 2.0 * PI;
  // asymmetric: a long gentle stoss side and a short steep lee, like the dunes
  float s = sin(ph);
  return 0.5 + 0.5 * (s + 0.35 * sin(ph * 2.0 + 1.2));
}
float grain(vec2 p) { return vnoise(p * 9.0) * 0.6 + vnoise(p * 31.0) * 0.4; }

// the shadow of the dunes upwind: march towards the sun through the low-detail field
float sunShadow(vec3 p, vec3 L) {
  if (L.y <= 0.01) return 0.0;
  float sh = 1.0;
  float t = 1.5;
  for (int i = 0; i < 9; i++) {
    vec3 q = p + L * t;
    float h = groundLow(q.xz);
    sh = min(sh, clamp((q.y - h) / (0.06 * t) + 0.5, 0.0, 1.0));
    if (sh <= 0.0 || q.y > uHeight * 1.6) break;
    t *= 1.75;
  }
  return sh;
}

void main() {
  vec3 toCam = cameraPosition - vWorldPos;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 L = normalize(uSunDir);
  vec3 N = normalize(vNormal);
  vec2 p = vWorldPos.xz;

  // --- the slopes: which way this bit of sand faces the wind ---
  float downwind = dot(N.xz, uWind); // < 0 on the windward (stoss) slope
  float slip = smoothstep(0.05, 0.3, downwind);

  // --- detail normal: ripples (not on the slip faces) and grain, fading with distance ---
  float detail = exp(-dist * 0.014);
  if (detail > 0.01) {
    float e = 0.012;
    float amp = 0.0045 * (1.0 - slip * 0.9);
    float r0 = ripples(p) * amp;
    float rx = ripples(p + vec2(e, 0.0)) * amp;
    float rz = ripples(p + vec2(0.0, e)) * amp;
    float g0 = grain(p) * 0.0012;
    float gx = grain(p + vec2(e, 0.0)) * 0.0012;
    float gz = grain(p + vec2(0.0, e)) * 0.0012;
    vec3 dn = vec3(-((rx - r0) + (gx - g0)) / e, 0.0, -((rz - r0) + (gz - g0)) / e);
    N = normalize(N + dn * detail);
  }

  // --- light ---
  float sunUp = smoothstep(-0.03, 0.12, L.y);
  vec3 sun = uSunColor * sunUp;
  float shadow = sunShadow(vWorldPos + vec3(0.0, 0.3, 0.0), L);
  float NdL = dot(N, L);
  // sand is a rough, forgiving surface: wrap the terminator a little
  float diffuse = clamp((NdL + 0.18) / 1.18, 0.0, 1.0) * shadow;

  vec3 skyUp = textureCube(uEnv, vec3(0.0, 1.0, 0.0)).rgb;
  vec3 skyH = vec3(0.0);
  for (int i = 0; i < 4; i++) skyH += textureCube(uEnv, uSkyDirs[i]).rgb;
  skyH *= 0.25;
  // sky from above, more on the crests than in the troughs; sunlit sand bouncing into the hollows
  float up = N.y * 0.5 + 0.5;
  float ao = mix(0.75, 1.0, clamp(vHeight * 0.8 + 0.3, 0.0, 1.0));
  vec3 ambient = (skyUp * 0.85 * up + skyH * 0.55) * ao;
  vec3 bounce = uSand * sun * 0.22 * (1.0 - up) * (0.4 + 0.6 * shadow);

  // the slip face is finer, smoother sand: a touch darker and warmer
  // patches of darker and lighter sand, grain, and the smoother slip faces
  float patches = vnoise(p * 0.045) * 0.5 + vnoise(p * 0.19 + 5.0) * 0.5;
  vec3 albedo = uSand * mix(1.0, 0.9, slip) * (0.9 + 0.2 * grain(p * 0.7)) * (0.9 + 0.2 * patches);
  albedo *= mix(1.0, 1.04, smoothstep(0.6, 1.0, vHeight)); // crests bleach a little in the sun

  vec3 color = albedo * (sun * diffuse * 1.15 + ambient + bounce);

  // --- the grains: back-scatter when the sun is behind you, and glitter ---
  float back = pow(max(dot(V, L), 0.0), 3.0);
  color += albedo * sun * back * 0.18 * diffuse;
  vec3 H = normalize(L + V);
  // every 4 cm cell has one grain tilted its own way; the ones that face the half vector flash
  vec2 cell = floor(p * 25.0);
  float j1 = dhash(cell);
  float j2 = dhash(cell + 17.0);
  vec3 micro = normalize(N + vec3(j1 - 0.5, 0.0, j2 - 0.5) * 0.9);
  float glint = pow(max(dot(micro, H), 0.0), 320.0);
  float g2 = pow(max(dot(N, H), 0.0), 40.0);
  color += sun * (glint * 4.0 * uSparkle * exp(-dist * 0.05) + g2 * 0.03) * shadow * sunUp;

  // --- aerial perspective: dust in the air, glowing round the sun ---
  float cosT = dot(-V, L);
  // the haze is the sky at the horizon in this direction, tinted by the dust, glowing round the sun
  vec3 horizon = textureCube(uEnv, normalize(vec3(-V.x, max(0.015, -V.y * 0.3), -V.z))).rgb;
  vec3 hazeCol = horizon * mix(vec3(1.0), uDust * 1.6, 0.25) + sun * hg(cosT, 0.72) * 0.6;
  float fog = 1.0 - exp(-dist * 0.00045 * uHaze);
  color = mix(color, hazeCol, fog);
  // and the sky itself at the far horizon, where the ground runs out
  color = mix(color, horizon, 1.0 - exp(-dist * 0.0003));

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
