import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { horizonDirs, makeSky, sunDirection, sunlight } from '../cloud/sun.js'
import { duneField } from './dunes.js'
import { desertFragment, desertVertex } from './desertShader.js'

// A sand sea: transverse dunes to the horizon under the cloud models'
// physical sky. The ground is the ocean's radial grid lifted onto the dune
// field in the vertex shader (dense underfoot, sparse towards the horizon),
// and the sand is shaded for what it is: wind ripples on the windward
// slopes, grains glittering in the sun, the lee of every dune in a marched
// shadow, dust haze to the horizon. Sand streams off the crests in the wind.

// Circular grid: dense near the centre, sparse toward the horizon (as the ocean's).
function createRadialGrid(rings = 280, segments = 360, a = 12, b = 0.0245) {
  const positions = [0, 0, 0]
  for (let i = 1; i <= rings; i++) {
    const r = a * (Math.exp(b * i) - 1)
    for (let j = 0; j < segments; j++) {
      const t = (j / segments) * Math.PI * 2
      positions.push(Math.cos(t) * r, 0, Math.sin(t) * r)
    }
  }
  const index = []
  for (let j = 0; j < segments; j++) index.push(0, 1 + ((j + 1) % segments), 1 + j)
  for (let i = 0; i < rings - 1; i++) {
    const r0 = 1 + i * segments
    const r1 = r0 + segments
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments
      index.push(r0 + j, r0 + j1, r1 + j)
      index.push(r0 + j1, r1 + j1, r1 + j)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  return geo
}

// Sand blown off the crests: grains that stream downwind close to the
// ground, lifting where the ground is high (the crests) and settling again.
const GRAINS = 2600
const RANGE = 90
function Streamers({ field, wind, origin, color }) {
  const pts = useRef()
  const state = useMemo(() => {
    const p = new Float32Array(GRAINS * 3)
    const seed = new Float32Array(GRAINS * 2)
    for (let i = 0; i < GRAINS; i++) {
      p[i * 3] = (Math.random() * 2 - 1) * RANGE
      p[i * 3 + 2] = (Math.random() * 2 - 1) * RANGE
      seed[i * 2] = Math.random()
      seed[i * 2 + 1] = Math.random() * Math.PI * 2
    }
    return { p, seed }
  }, [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(state.p, 3))
    return g
  }, [state])
  const mat = useMemo(() => new THREE.PointsMaterial({ color, size: 0.22, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false }), [color])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const t = useRef(0)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    t.current += dt
    const { p, seed } = state
    const [wx, wz] = field.wind
    const v = wind * 0.9
    for (let i = 0; i < GRAINS; i++) {
      const k = i * 3
      const s = 0.6 + seed[i * 2] * 0.8
      p[k] += wx * v * s * dt
      p[k + 2] += wz * v * s * dt
      // wrap round the square so the stream never runs out
      if (p[k] > RANGE) p[k] -= 2 * RANGE
      if (p[k] < -RANGE) p[k] += 2 * RANGE
      if (p[k + 2] > RANGE) p[k + 2] -= 2 * RANGE
      if (p[k + 2] < -RANGE) p[k + 2] += 2 * RANGE
      const h = field.height(p[k] + origin[0], p[k + 2] + origin[1])
      // grains skip along: a hop that rises with height (crests shed the most) and the wind
      const hop = (0.15 + Math.max(0, h) * 0.05) * (0.5 + 0.5 * Math.sin(t.current * (2 + s * 3) + seed[i * 2 + 1])) * Math.min(1, wind / 4)
      p[k + 1] = h + 0.12 + hop
    }
    geo.attributes.position.needsUpdate = true
    mat.opacity = 0.15 + 0.4 * Math.min(1, wind / 6)
  })
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />
}

// elevation, azimuth: the sun, in degrees. windDirection: where the wind
// blows to, in degrees; wind: its strength, which drives the blowing sand.
// duneHeight, duneSpacing: the field, in metres. sandColor, dustColor: the
// sand and the haze. haze: how dusty the air is. sparkle: grain glitter.
export default function Desert({
  elevation = 14,
  azimuth = -120,
  exposure = 0.55,
  windDirection = 25,
  wind = 3,
  duneHeight = 14,
  duneSpacing = 120,
  sandColor = '#d9a86c',
  dustColor = '#e0b68a',
  haze = 1,
  sparkle = 1,
  streamers = true,
  sunIntensity = 1,
  onReady,
}) {
  const gl = useThree((s) => s.gl)
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])
  // a dusty sky: more scattering low down, a wide glow round the sun
  const sky = useMemo(() => makeSky({ turbidity: 7, rayleigh: 1.1, mie: 0.006, mieG: 0.8 }), [])
  const field = useMemo(() => duneField({ windDirection, spacing: duneSpacing, height: duneHeight }), [windDirection, duneSpacing, duneHeight])

  // Put the camera's point of interest on a crest: search near the origin
  // for the highest ground and shift the whole field so it lands at 0, 0.
  const origin = useMemo(() => {
    let best = [0, 0]
    let hb = -1e9
    for (let x = -duneSpacing; x <= duneSpacing; x += duneSpacing / 24)
      for (let z = -duneSpacing; z <= duneSpacing; z += duneSpacing / 24) {
        const h = field.height(x, z)
        if (h > hb) {
          hb = h
          best = [x, z]
        }
      }
    return best
  }, [field, duneSpacing])
  useEffect(() => onReady?.(field.height(origin[0], origin[1])), [field, origin, onReady])

  const geometry = useMemo(() => createRadialGrid(), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: desertVertex,
        fragmentShader: desertFragment,
        uniforms: {
          uEnv: { value: sky.envTexture },
          uSunDir: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() },
          uSkyDirs: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
          uSand: { value: new THREE.Color() },
          uDust: { value: new THREE.Color() },
          uHaze: { value: 1 },
          uSparkle: { value: 1 },
          uTime: { value: 0 },
          uWindSpeed: { value: 3 },
          uWind: { value: new THREE.Vector2(0, 1) },
          uSpacing: { value: 120 },
          uHeight: { value: 14 },
          uOrigin: { value: new THREE.Vector2() },
        },
      }),
    [sky],
  )

  useEffect(() => {
    sky.update(gl, sunDir)
    material.uniforms.uSunDir.value.copy(sunDir)
    horizonDirs(sunDir, material.uniforms.uSkyDirs.value)
  }, [sunDir, sky, material, gl])

  useEffect(() => {
    const u = material.uniforms
    u.uSunColor.value.copy(sunlight(elevation)).multiplyScalar(sunIntensity * 2.4)
    u.uSand.value.set(sandColor)
    u.uDust.value.set(dustColor)
    u.uHaze.value = haze
    u.uSparkle.value = sparkle
    u.uWindSpeed.value = wind
    u.uWind.value.set(field.wind[0], field.wind[1])
    u.uSpacing.value = duneSpacing
    u.uHeight.value = duneHeight
    u.uOrigin.value.set(origin[0], origin[1])
  }, [material, elevation, sunIntensity, sandColor, dustColor, haze, sparkle, wind, field, duneSpacing, duneHeight, origin])

  useEffect(() => {
    const prev = gl.toneMappingExposure
    gl.toneMappingExposure = exposure
    return () => (gl.toneMappingExposure = prev)
  }, [gl, exposure])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      sky.dispose()
    },
    [geometry, material, sky],
  )

  useFrame((_, delta) => {
    material.uniforms.uTime.value += Math.min(delta, 0.1)
  })

  // blowing sand is lit by the same sun: pale in the day, dim at dusk
  const grainColor = useMemo(() => new THREE.Color(sandColor).lerp(new THREE.Color('#ffffff'), 0.25).multiply(sunlight(elevation).lerp(new THREE.Color('#ffffff'), 0.25).multiplyScalar(Math.min(1, 0.3 + elevation / 15))), [sandColor, elevation])

  return (
    <>
      <primitive object={sky.sky} />
      <mesh geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
      {streamers && wind > 0.2 && <Streamers field={field} wind={wind} origin={origin} color={grainColor} />}
    </>
  )
}
