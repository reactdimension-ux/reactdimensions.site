import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeSky, sunDirection, sunlight } from '../cloud/sun.js'
import { facet, rng } from '../lowpoly/kit.jsx'
import { GROUND, RIVER_W, SIZE_X, SIZE_Z, WATER_Y, buildRiver, buildTerrain, fbm, heightAt, riverX, scatter, slopeAt, sstep } from './terrain.js'
import { waterFragment, waterVertex } from './waterShader.js'

// A low-poly valley: a river winding between forested banks under mountains,
// lit by a physical sky. The ground is one faceted heightfield coloured by
// height and slope; the river is a flowing shader ribbon that mirrors the
// sky; the woods are two instanced tree species swaying in the wind; rocks
// sit on the banks and the peaks; clouds drift over and shadow the ground;
// a flock of birds circles the valley; haze thickens to the far ridges.

const TREES = {
  summer: { pine: ['#2f7a3a', '#3b8c3f', '#4f9f45', '#2a6b3b'], leaf: ['#6fb04f', '#86bf4e', '#5e9d43', '#a3c850'], trunk: '#5b3d2c' },
  autumn: { pine: ['#2f6f3a', '#3b7f3f', '#4a8a40', '#2a5f36'], leaf: ['#d9822b', '#c9502e', '#e8a83a', '#b8402a'], trunk: '#4e3226' },
  winter: { pine: ['#1f4f3a', '#27604a', '#2e6c52', '#1c4635'], leaf: ['#dfe6ec', '#d2dbe3', '#e8eef3', '#c7d1da'], trunk: '#4b3328' },
}
const WATER = {
  summer: { deep: '#19546e', shallow: '#5fb1c8', foam: '#eef7f8' },
  autumn: { deep: '#1d4f62', shallow: '#6aaab6', foam: '#f0f4f2' },
  winter: { deep: '#1b3f5a', shallow: '#7fb3cc', foam: '#f4f8fb' },
}

// A flat-shaded material whose instances sway in the wind (top more than foot).
function useWindMaterial(color = '#ffffff') {
  const shader = useRef()
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 })
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = { value: 0 }
      s.uniforms.uWind = { value: 1 }
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.27;
            float hgt = max(transformed.y, 0.0);
            float sw = (sin(uTime * 1.5 + ph) + 0.5 * sin(uTime * 2.7 + ph * 1.7)) * uWind * 0.028 * hgt;
            transformed.x += sw;
            transformed.z += sw * 0.5;
          #endif`,
        )
      shader.current = s
    }
    m.customProgramCacheKey = () => 'forest-wind'
    return m
  }, [color])
  useEffect(() => () => mat.dispose(), [mat])
  return [mat, shader]
}

// Instances placed from a scatter list, each with its own tint.
function Instances({ geometry, material, items, scaleOf, colors, seed = 1, cast = true }) {
  const ref = useRef()
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const r = rng(seed)
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      const s = scaleOf(it, r)
      o.position.set(it.x, it.y - 0.15, it.z)
      o.rotation.set(0, r() * Math.PI * 2, 0)
      o.scale.set(s[0], s[1], s[2])
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      c.set(colors[Math.floor(r() * colors.length)]).multiplyScalar(0.92 + r() * 0.16)
      m.setColorAt(i, c)
    })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, geometry, scaleOf, colors, seed])
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, items.length)]} castShadow={cast} receiveShadow frustumCulled={false} />
}

function Woods({ season, density, wind }) {
  const T = TREES[season] || TREES.summer
  const G = GROUND[season] || GROUND.summer
  const geo = useMemo(() => {
    const tiers = [
      [1.7, 2.6, 1.0],
      [1.3, 2.3, 2.5],
      [0.9, 2.5, 3.9],
    ].map(([r, h, y], i) => facet(new THREE.ConeGeometry(r, h, 7, 1).translate(0, y + h / 2, 0), 0.09, 10 + i))
    const pine = mergeGeometries(tiers)
    const trunk = facet(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 6, 1).translate(0, 0.8, 0), 0.02, 3)
    const leaf = mergeGeometries([facet(new THREE.IcosahedronGeometry(1.9, 1).translate(0, 3.4, 0), 0.22, 21), facet(new THREE.IcosahedronGeometry(1.3, 1).translate(0.9, 4.3, 0.4), 0.16, 22), facet(new THREE.IcosahedronGeometry(1.2, 1).translate(-0.8, 4.1, -0.5), 0.16, 23)])
    const leafTrunk = facet(new THREE.CylinderGeometry(0.22, 0.32, 2.6, 6, 1).translate(0, 1.3, 0), 0.02, 4)
    return { pine, trunk, leaf, leafTrunk }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const [crownMat, crownShader] = useWindMaterial()
  const [trunkMat] = useWindMaterial(T.trunk)
  useFrame(({ clock }) => {
    if (crownShader.current) {
      crownShader.current.uniforms.uTime.value = clock.elapsedTime
      crownShader.current.uniforms.uWind.value = wind
    }
  })
  const pines = useMemo(
    () =>
      scatter(Math.round(1500 * density), 31, (x, z, y, d, r) => {
        if (y < WATER_Y + 1.8 || y > G.snowline - 3 || d < RIVER_W + 2.5 || slopeAt(x, z) > 0.8) return 0
        const clump = 0.25 + 0.75 * fbm(x * 0.04 + 20, z * 0.04)
        const mid = sstep(RIVER_W + 5, RIVER_W + 20, d) * (1 - 0.5 * sstep(45, 80, d))
        return r() < clump * mid * 0.9 ? 1 : 0
      }),
    [density, G.snowline],
  )
  const leafy = useMemo(
    () =>
      scatter(Math.round(520 * density), 47, (x, z, y, d, r) => {
        if (y < WATER_Y + 1.5 || y > 11 || d < RIVER_W + 1.5 || slopeAt(x, z) > 0.7) return 0
        const near = 1 - sstep(10, 40, d)
        return r() < 0.35 + 0.65 * near ? 1 : 0
      }),
    [density],
  )
  const pineScale = useMemo(() => (it, r) => {
    const s = 0.75 + r() * 0.75
    return [s, s * (0.9 + r() * 0.35), s]
  }, [])
  const leafScale = useMemo(() => (it, r) => {
    const s = 0.6 + r() * 0.6
    return [s, s * (0.85 + r() * 0.3), s]
  }, [])
  return (
    <group>
      <Instances geometry={geo.pine} material={crownMat} items={pines} scaleOf={pineScale} colors={T.pine} seed={5} />
      <Instances geometry={geo.trunk} material={trunkMat} items={pines} scaleOf={pineScale} colors={['#ffffff']} seed={5} cast={false} />
      <Instances geometry={geo.leaf} material={crownMat} items={leafy} scaleOf={leafScale} colors={T.leaf} seed={9} />
      <Instances geometry={geo.leafTrunk} material={trunkMat} items={leafy} scaleOf={leafScale} colors={['#ffffff']} seed={9} cast={false} />
    </group>
  )
}

function Rocks({ season }) {
  const G = GROUND[season] || GROUND.summer
  const geo = useMemo(() => facet(new THREE.DodecahedronGeometry(1, 0), 0.18, 8), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), [])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  const items = useMemo(
    () => [
      ...scatter(260, 61, (x, z, y, d, r) => (d > RIVER_W + 0.2 && d < RIVER_W + 6 && y > WATER_Y - 0.6 && r() < 0.8 ? 1 : 0)),
      ...scatter(220, 67, (x, z, y, d) => (y > 15 && slopeAt(x, z) < 1.3 ? 2 : 0)),
    ],
    [],
  )
  const scaleOf = useMemo(() => (it, r) => {
    const s = it.v === 2 ? 1.2 + r() * 2.4 : 0.35 + r() * 1.1
    return [s * (0.8 + r() * 0.5), s * (0.55 + r() * 0.5), s * (0.8 + r() * 0.5)]
  }, [])
  return <Instances geometry={geo} material={mat} items={items} scaleOf={scaleOf} colors={[G.rock, '#9a948d', '#7c7873']} seed={11} />
}

function River({ season, flow, sky, sunDir, sunColor }) {
  const W = WATER[season] || WATER.summer
  const geo = useMemo(() => buildRiver(), [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uTime: { value: 0 },
            uFlow: { value: 1 },
            uDeep: { value: new THREE.Color() },
            uShallow: { value: new THREE.Color() },
            uFoam: { value: new THREE.Color() },
            uSunDir: { value: new THREE.Vector3(0, 1, 0) },
            uSunColor: { value: new THREE.Color() },
            uSky: { value: null },
          },
        ]),
        transparent: true,
        fog: true,
      }),
    [],
  )
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  useEffect(() => {
    mat.uniforms.uDeep.value.set(W.deep)
    mat.uniforms.uShallow.value.set(W.shallow)
    mat.uniforms.uFoam.value.set(W.foam)
  }, [mat, W])
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uFlow.value = flow
    mat.uniforms.uSunDir.value.copy(sunDir)
    mat.uniforms.uSunColor.value.copy(sunColor)
    mat.uniforms.uSky.value = sky.envTexture
  })
  return <mesh geometry={geo} material={mat} receiveShadow renderOrder={2} />
}

function Clouds({ wind, on }) {
  const group = useRef()
  const clouds = useMemo(() => {
    const r = rng(77)
    return Array.from({ length: 9 }, (_, i) => {
      const parts = Array.from({ length: 4 + Math.floor(r() * 3) }, (_, k) => facet(new THREE.IcosahedronGeometry(4 + r() * 5, 1).translate((k - 2) * 5.5 + (r() - 0.5) * 3, (r() - 0.5) * 2.5, (r() - 0.5) * 4), 0.6, 100 + i * 7 + k))
      const g = mergeGeometries(parts)
      g.scale(1, 0.55, 1)
      return { g, x: (r() - 0.5) * 320, y: 72 + r() * 22, z: (r() - 0.5) * 320, s: 0.9 + r() * 1.1, v: 0.6 + r() * 0.6 }
    })
  }, [])
  useEffect(() => () => clouds.forEach((c) => c.g.dispose()), [clouds])
  useFrame((_, dt) => {
    if (!group.current) return
    group.current.children.forEach((m, i) => {
      m.position.x += clouds[i].v * wind * 1.4 * Math.min(dt, 0.1)
      if (m.position.x > 180) m.position.x = -180
    })
  })
  if (!on) return null
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <mesh key={i} geometry={c.g} position={[c.x, c.y, c.z]} scale={c.s} castShadow>
          <meshStandardMaterial color="#f6f8fb" emissive="#ffffff" emissiveIntensity={0.42} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

// A flock on a slow circuit over the valley, each bird a body and two flapping wings.
function Birds({ on }) {
  const refs = useRef([])
  const N = 11
  const seeds = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: N }, (_, i) => ({ off: i * 0.11, lat: (r() - 0.5) * 9, up: (r() - 0.5) * 4, ph: r() * 6 }))
  }, [])
  const wing = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.35, 0, 0, 0.35, 1.6, 0.05, 0.1], 3))
    g.computeVertexNormals()
    return g
  }, [])
  const body = useMemo(() => new THREE.ConeGeometry(0.22, 1.2, 5, 1).rotateX(Math.PI / 2), [])
  useEffect(() => () => (wing.dispose(), body.dispose()), [wing, body])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((b, i) => {
      if (!b) return
      const S = seeds[i]
      const a = t * 0.075 + S.off
      const R = 48
      const x = 8 + Math.cos(a) * R + S.lat
      const z = -24 + Math.sin(a) * R * 0.7
      const y = 30 + S.up + Math.sin(t * 0.6 + S.ph) * 1.2
      b.position.set(x, y, z)
      b.rotation.set(0, -a + Math.PI, 0.35)
      const flap = Math.sin(t * 6 + S.ph) * 0.8
      b.children[1].rotation.z = flap
      b.children[2].rotation.z = Math.PI - flap
    })
  })
  if (!on) return null
  return (
    <group>
      {seeds.map((_, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} scale={0.6}>
          <mesh geometry={body}>
            <meshStandardMaterial color="#2a2a30" flatShading />
          </mesh>
          <mesh geometry={wing}>
            <meshStandardMaterial color="#2a2a30" flatShading side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={wing}>
            <meshStandardMaterial color="#2a2a30" flatShading side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Big soft peaks beyond the ground, standing in the haze, so the valley reads
// as part of a range and the edges of the heightfield never show.
function Backdrop({ season }) {
  const G = GROUND[season] || GROUND.summer
  const peaks = useMemo(() => {
    const r = rng(91)
    const list = []
    const peak = (x, z) => {
      const h = 34 + r() * 30
      return { x, z, h, rad: h * (1.15 + r() * 0.5) }
    }
    for (let z = -170; z <= 170; z += 34) for (const sx of [-1, 1]) list.push(peak(sx * (140 + r() * 30), z + (r() - 0.5) * 16))
    for (const sz of [-1, 1])
      for (let ox = -150; ox <= 150; ox += 30) {
        const q = peak(ox + (r() - 0.5) * 14, sz * (170 + r() * 26))
        q.rad = q.h * (1.7 + r() * 0.5)
        list.push(q)
      }
    // each peak is a ragged main cone with a lower shoulder leaning off it
    return list.map((p, i) => {
      const main = facet(new THREE.ConeGeometry(p.rad, p.h, 5 + Math.floor(r() * 4), 1).translate(0, p.h / 2 - 6, 0), p.rad * 0.24, 200 + i, [1, 0.45, 1], (x, y) => y < -5)
      const sh = facet(new THREE.ConeGeometry(p.rad * 0.75, p.h * 0.62, 5 + Math.floor(r() * 3), 1).translate(p.rad * 0.6 * (r() - 0.5) * 2, (p.h * 0.62) / 2 - 6, p.rad * 0.6 * (r() - 0.5) * 2), p.rad * 0.18, 260 + i, [1, 0.45, 1], (x, y) => y < -5)
      return { ...p, g: mergeGeometries([main, sh]) }
    })
  }, [])
  useEffect(() => () => peaks.forEach((p) => p.g.dispose()), [peaks])
  return (
    <group>
      {peaks.map((p, i) => (
        <mesh key={i} geometry={p.g} position={[p.x, -4, p.z]}>
          <meshStandardMaterial color={G.snowline < 10 ? '#aab4c0' : '#8792a6'} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

export default function Forest({ season = 'summer', elevation = 22, azimuth = -115, exposure = 0.6, trees = 1, wind = 1, flow = 1, haze = 1, clouds = true, birds = true }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const sky = useMemo(() => makeSky({ turbidity: 5, rayleigh: 1.6, mie: 0.004, mieG: 0.8 }), [])
  useEffect(() => () => sky.dispose(), [sky])
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])
  const sunColor = useMemo(() => sunlight(elevation), [elevation])
  const fogColor = useMemo(() => {
    const low = 1 - sstep(4, 28, elevation)
    const c = new THREE.Color(season === 'winter' ? '#d7e0ea' : '#c9d7e4').lerp(new THREE.Color('#f1c39a'), low * 0.8)
    return c
  }, [elevation, season])
  useEffect(() => {
    sky.update(gl, sunDir)
  }, [sky, gl, sunDir])
  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  useEffect(() => {
    scene.fog = new THREE.FogExp2(fogColor, 0.0036 * haze)
    return () => (scene.fog = null)
  }, [scene, fogColor, haze])
  const terrain = useMemo(() => buildTerrain(season), [season])
  useEffect(() => () => terrain.dispose(), [terrain])
  const lightPos = useMemo(() => sunDir.clone().multiplyScalar(220), [sunDir])
  const sunI = 3.6 * sstep(-2, 8, elevation) + 0.4
  return (
    <group>
      <primitive object={sky.sky} />
      <hemisphereLight args={[fogColor, season === 'winter' ? '#8e98a2' : '#4f6a3a', 0.9]} />
      <directionalLight position={lightPos} color={sunColor} intensity={sunI} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.00035} shadow-normalBias={0.9}>
        <orthographicCamera attach="shadow-camera" args={[-130, 130, 160, -160, 20, 520]} />
      </directionalLight>
      <mesh geometry={terrain} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.92} metalness={0} />
      </mesh>
      <River season={season} flow={flow} sky={sky} sunDir={sunDir} sunColor={sunColor} />
      <Woods season={season} density={trees} wind={wind} />
      <Rocks season={season} />
      <Backdrop season={season} />
      <Clouds wind={wind} on={clouds} />
      <Birds on={birds} />
      {/* the far ground, the colour of the haze */}
      <mesh rotation-x={-Math.PI / 2} position-y={-6}>
        <circleGeometry args={[4000, 64]} />
        <meshBasicMaterial color={fogColor} />
      </mesh>
    </group>
  )
}

export { heightAt, riverX, SIZE_X, SIZE_Z }
