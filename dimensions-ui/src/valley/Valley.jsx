import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { makeSky, sunDirection, sunlight } from '../cloud/sun.js'
import { NEAR, WATER_Y, buildFar, buildNear, buildRiverMap, fbm, heightAt, riverW, riverX, rng, scatter, slopeAt, sstep } from './land.js'
import { cloudFragment, cloudVertex, foliageMaterial, groundMaterial, rockMaterial, waterShader } from './shaders.js'
import { barkTextures, bladeGeometry, boulderGeometry, broadleaf, bush, conifer, firTexture, leafTexture, puffTexture } from './trees.js'

// A river valley drawn for realism: the camera stands at the water's edge
// looking upstream, the river glassy and clear in the shallows, mirroring
// the trees and the sky; meadow grass and boulders on the banks; broadleaf
// woods and firs climbing the hills; a range of snowy peaks closing the
// valley, blued by the air between; fair-weather cumulus drifting over.
// The light is a physical sky: the same sky lights the scene (image-based),
// casts the sun's shadows, fills the reflections and tints the haze.

// ---------------------------------------------------------------- helpers

const o3 = new THREE.Object3D()
const tint = new THREE.Color()

function useDispose(...things) {
  useEffect(() => () => things.forEach((t) => t && t.dispose && t.dispose()), things) // eslint-disable-line react-hooks/exhaustive-deps
}

// An instanced mesh whose instances come from a list of placements.
function Instanced({ geometry, material, items, colors, cast = true, receive = true, name }) {
  const ref = useRef()
  useEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((it, i) => {
      o3.position.set(it.x, it.y, it.z)
      o3.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0)
      o3.scale.set(it.sx, it.sy, it.sz)
      o3.updateMatrix()
      m.setMatrixAt(i, o3.matrix)
      if (colors) m.setColorAt(i, tint.set(colors[i % colors.length]).multiplyScalar(it.c ?? 1))
    })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, colors, geometry])
  if (!items.length) return null
  return <instancedMesh ref={ref} name={name} args={[geometry, material, items.length]} castShadow={cast} receiveShadow={receive} frustumCulled={false} />
}

// ---------------------------------------------------------------- forest

const LEAF_TINTS = ['#ffffff', '#e8f2c8', '#f4f0c0', '#d8e8d0', '#fff2d0', '#cfe0b0']
const FIR_TINTS = ['#ffffff', '#dfe8e0', '#c8d8cc', '#e8ecd8']

function Forest({ density, U, setHidden }) {
  const bushRef = useRef()
  useEffect(() => void setHidden('bushes', bushRef.current), [setHidden])
  const tex = useMemo(() => ({ leaf: leafTexture(3, 96), leaf2: leafTexture(8, 78), fir: firTexture(5), ...barkTextures(9) }), [])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])
  const mats = useMemo(() => {
    const leafParams = { alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.72 }
    return {
      bark: foliageMaterial({ map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.95, color: '#a59684' }, U, { flutter: 0, translucent: false, crownNormals: false }),
      leaf: foliageMaterial({ ...leafParams, map: tex.leaf }, U, { flutter: 1 }),
      leaf2: foliageMaterial({ ...leafParams, map: tex.leaf2 }, U, { flutter: 1 }),
      fir: foliageMaterial({ ...leafParams, map: tex.fir, roughness: 0.8 }, U, { flutter: 0.25 }),
      bush: foliageMaterial({ ...leafParams, map: tex.leaf2 }, U, { flutter: 1, bend: 1, amp: 0.05 }),
    }
  }, [tex, U])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  const species = useMemo(
    () => ({
      broad: [broadleaf(11, { height: 6.5 }), broadleaf(23, { height: 5.5, spread: 1.2 }), broadleaf(37, { height: 7.5, spread: 0.85 })],
      fir: [conifer(5, { height: 15 }), conifer(19, { height: 12 }), conifer(41, { height: 18 })],
      bush: [bush(7), bush(13, { size: 1.6 })],
    }),
    [],
  )
  useEffect(
    () => () =>
      Object.values(species)
        .flat()
        .forEach((s) => Object.values(s).forEach((g) => g.dispose())),
    [species],
  )

  const plant = useMemo(() => {
    const box = [NEAR.x0 + 4, NEAR.x1 - 4, NEAR.z0 + 4, NEAR.z1 - 4]
    const wood = (x, z) => fbm(x * 0.011 + 40, z * 0.011 - 7)
    // keep the river's line of sight open from the bank where the viewer stands
    const view = (x, z, d) => !(z > -40 && z < 70 && d < 6)
    const broad = scatter(Math.round(420 * density), 101, box, (x, z, y, d, r) => {
      if (d < 2.5 || y < 0.5 || y > 110 || slopeAt(x, z) > 0.75 || !view(x, z, d)) return 0
      const w = sstep(0.38, 0.6, wood(x, z))
      const lowland = 1 - sstep(40, 110, y)
      return r() < (0.08 + 0.92 * w) * (0.35 + 0.65 * sstep(6, 30, d)) * (0.3 + 0.7 * lowland)
    })
    const firs = scatter(Math.round(640 * density), 202, box, (x, z, y, d, r) => {
      if (d < 4 || y < 0.8 || y > 170 || slopeAt(x, z) > 0.9 || !view(x, z, d)) return 0
      const w = sstep(0.42, 0.62, 1 - wood(x + 300, z))
      return r() < (0.1 + 0.9 * w) * sstep(15, 70, d + y)
    })
    const bushes = scatter(Math.round(480 * density), 303, box, (x, z, y, d, r) => {
      if (d < 1 || y < 0.35 || y > 90 || slopeAt(x, z) > 0.8) return 0
      return r() < (0.25 + 0.75 * sstep(0.4, 0.55, wood(x, z))) * (d < 12 ? 1 : 0.5)
    })
    // a few large trees framing the view, as in a painter's composition
    const at = (side, z, off) => {
      const x = riverX(z) + side * (riverW(z) + off)
      return { x, y: heightAt(x, z), z, r: 0.5 }
    }
    const heroBroad = [
      { ...at(-1, 31, 4), s: 1.45, k: 2 },
      { ...at(1, 22, 6), s: 1.3, k: 0 },
      { ...at(1, 4, 3), s: 1.05, k: 1 },
      { ...at(-1, -18, 6), s: 1.15, k: 0 },
      { ...at(1, -55, 4), s: 1.2, k: 2 },
    ]
    const heroFir = [
      { ...at(-1, 6, 5), s: 0.9, k: 0 },
      { ...at(-1, -42, 3.5), s: 1.0, k: 2 },
      { ...at(1, -28, 9), s: 0.85, k: 1 },
      { ...at(-1, 12, 13), s: 1.1, k: 1 },
    ]
    const r = rng(9)
    const split = (list, n, scale, hero, colorsLen, jitter) => {
      const out = Array.from({ length: n }, () => [])
      list.forEach((it) => {
        const s = scale * (0.7 + it.r * 0.6)
        out[Math.floor(r() * n)].push({ x: it.x, y: it.y - 0.1, z: it.z, ry: r() * Math.PI * 2, rx: (r() - 0.5) * jitter, rz: (r() - 0.5) * jitter, sx: s, sy: s * (0.9 + r() * 0.2), sz: s, c: 0.85 + r() * 0.25 })
      })
      hero.forEach((h) => out[h.k % n].push({ x: h.x, y: h.y - 0.15, z: h.z, ry: r() * Math.PI * 2, sx: h.s, sy: h.s, sz: h.s, c: 1 }))
      return out
    }
    return {
      broad: split(broad, 3, 1, heroBroad, 0, 0.06),
      fir: split(firs, 3, 0.95, heroFir, 0, 0.03),
      bush: split(bushes, 2, 0.9, [], 0, 0.1),
    }
  }, [density])

  return (
    <group>
      {species.broad.map((g, i) => (
        <group key={'b' + i}>
          <Instanced geometry={g.bark} material={mats.bark} items={plant.broad[i]} />
          <Instanced geometry={g.leaves} material={i === 1 ? mats.leaf2 : mats.leaf} items={plant.broad[i]} colors={LEAF_TINTS} />
        </group>
      ))}
      {species.fir.map((g, i) => (
        <group key={'f' + i}>
          <Instanced geometry={g.bark} material={mats.bark} items={plant.fir[i]} />
          <Instanced geometry={g.leaves} material={mats.fir} items={plant.fir[i]} colors={FIR_TINTS} />
        </group>
      ))}
      <group ref={bushRef}>
        {species.bush.map((g, i) => (
          <Instanced key={'s' + i} geometry={g.leaves} material={mats.bush} items={plant.bush[i]} colors={LEAF_TINTS} />
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- grass

const GRASS_TINTS = ['#4d7a1e', '#5f8a26', '#3f6b1c', '#7a8f34', '#6b8e2a', '#8f9a45', '#456f22']

function Grass({ amount, U, setHidden }) {
  const geo = useMemo(() => bladeGeometry(), [])
  const mat = useMemo(() => foliageMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }, U, { flutter: 0, bend: 2, amp: 0.16 }), [U])
  useDispose(geo, mat)
  const items = useMemo(() => {
    const out = []
    const r = rng(404)
    const N = Math.round(110000 * amount)
    let tries = 0
    while (out.length < N && tries++ < N * 4) {
      // blades gather where the viewer can see them: along both banks, close by
      const z = 78 - Math.pow(r(), 1.6) * 190
      const side = r() < 0.5 ? -1 : 1
      const W = riverW(z)
      const off = W - 1.2 + Math.pow(r(), 1.5) * 60
      const x = riverX(z) + side * off
      const y = heightAt(x, z)
      if (y < 0.08) continue
      const d = off - W
      const clump = fbm(x * 0.15 + 3, z * 0.15)
      const near = 1 - sstep(40, 140, Math.hypot(x, z - 50))
      if (r() > (0.25 + 0.75 * sstep(0.35, 0.6, clump)) * (0.3 + 0.7 * near)) continue
      const reed = d < 3 && clump > 0.5 + r() * 0.2
      const tall = reed ? 1.0 + r() * 0.7 : 0.3 + clump * 0.55 + r() * r() * 0.5
      const s = 0.8 + r() * 0.5
      out.push({ x, y: y - 0.05, z, ry: r() * Math.PI * 2, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5, sx: s, sy: tall, sz: s, c: 0.75 + r() * 0.45 })
    }
    return out
  }, [amount])
  const ref = useRef()
  useEffect(() => void setHidden('grass', ref.current), [setHidden, items])
  return (
    <group ref={ref}>
      <Instanced geometry={geo} material={mat} items={items} colors={GRASS_TINTS} cast={false} />
    </group>
  )
}

// ---------------------------------------------------------------- rocks

function Rocks({ list, setHidden }) {
  const geos = useMemo(() => [boulderGeometry(3), boulderGeometry(17), boulderGeometry(29), boulderGeometry(51, 2)], [])
  const mat = useMemo(() => rockMaterial(), [])
  useEffect(() => () => (geos.forEach((g) => g.dispose()), mat.dispose()), [geos, mat])
  const groups = useMemo(() => {
    const out = [[], [], [], []]
    list.forEach((it, i) => out[it.small ? 3 : i % 3].push(it))
    return out
  }, [list])
  const ref = useRef()
  useEffect(() => void setHidden('pebbles', ref.current), [setHidden, groups])
  return (
    <group>
      {geos.slice(0, 3).map((g, i) => (
        <Instanced key={i} geometry={g} material={mat} items={groups[i]} />
      ))}
      <group ref={ref}>
        <Instanced geometry={geos[3]} material={mat} items={groups[3]} cast={false} />
      </group>
    </group>
  )
}

function placeRocks() {
  const r = rng(77)
  const rock = (x, z, s, sink = 0.3, small = false) => {
    const y = heightAt(x, z)
    return { x, y: y - s * sink, z, s, sx: s * (0.8 + r() * 0.6), sy: s * (0.55 + r() * 0.45), sz: s * (0.8 + r() * 0.6), ry: r() * 6.28, rx: (r() - 0.5) * 0.3, rz: (r() - 0.5) * 0.3, small }
  }
  const out = []
  const box = [NEAR.x0 + 4, NEAR.x1 - 4, NEAR.z0 + 4, NEAR.z1 - 4]
  // boulders along the banks, half in the water
  scatter(170, 1, [-140, 140, -380, 110], (x, z, y, d, rr) => d > -2.5 && d < 3.5 && rr() < 0.8).forEach((p) => out.push(rock(p.x, p.z, 0.5 + Math.pow(r(), 2) * 1.9, 0.35)))
  // stones breaking the current
  scatter(60, 2, [-140, 140, -380, 110], (x, z, y, d) => d < -2 && d > -9).forEach((p) => out.push(rock(p.x, p.z, 0.35 + r() * 0.8, 0.2)))
  // scattered in the meadows and woods
  scatter(160, 3, box, (x, z, y, d) => d > 4 && y < 120).forEach((p) => out.push(rock(p.x, p.z, 0.4 + Math.pow(r(), 2.5) * 2.6, 0.45)))
  // outcrops on the steeper hillsides
  scatter(140, 4, box, (x, z, y, d) => slopeAt(x, z) > 0.45 && d > 15).forEach((p) => out.push(rock(p.x, p.z, 2 + r() * 5, 0.4)))
  // foreground boulders, set like the reference: big ones on each shore and in the shallows
  const at = (side, z, off, s, sink) => rock(riverX(z) + side * (riverW(z) + off), z, s, sink)
  out.push(at(-1, 38, -1.5, 2.1, 0.3), at(1, 34, -2.2, 2.6, 0.3), at(-1, 26, 1.0, 1.5, 0.35), at(1, 12, -0.5, 1.7, 0.35), at(-1, 18, -5.5, 0.9, 0.25), at(1, 44, -4.5, 0.7, 0.2), at(-1, 3, 0.2, 1.3, 0.35), at(1, -8, 0.5, 1.6, 0.4), at(-1, 42, 2.5, 1.0, 0.4))
  // and a few standing out of the shallows just ahead of the viewer
  out.push(at(-1, 40, -4.5, 1.5, 0.05), at(1, 38, -5.5, 1.9, 0.05), at(-1, 30, -2.5, 1.1, 0.05), at(1, 46, -3.0, 1.2, 0.1), at(-1, 22, -6.5, 0.9, 0.0), at(1, 25, -2.5, 1.4, 0.1))
  // pebbles on the strand near the viewer
  scatter(700, 5, [-60, 60, -60, 80], (x, z, y, d) => d > -1.6 && d < 2.5).forEach((p) => out.push(rock(p.x, p.z, 0.07 + Math.pow(r(), 2) * 0.28, 0.35, true)))
  return out
}

// ---------------------------------------------------------------- river

function River({ near, rocks, U, sky, hidden }) {
  const map = useMemo(() => buildRiverMap(near, rocks), [near, rocks])
  const reflector = useMemo(() => {
    const W = NEAR.x1 - NEAR.x0
    const D = NEAR.z1 - NEAR.z0
    const r = new Reflector(new THREE.PlaneGeometry(W, D), { shader: waterShader, textureWidth: 640, textureHeight: 640, clipBias: 0.002 })
    r.rotation.x = -Math.PI / 2
    r.position.set((NEAR.x0 + NEAR.x1) / 2, WATER_Y, (NEAR.z0 + NEAR.z1) / 2)
    r.material.transparent = true
    r.material.fog = true
    r.material.depthWrite = false
    r.renderOrder = 2
    r.material.uniforms.uRegion.value.set(NEAR.x0, NEAR.z0, W, D)
    // leave the grass, bushes and pebbles out of the mirror: too small to see in it, costly to draw
    // and redraw the mirror every other frame: the ripples hide the difference
    const draw = r.onBeforeRender
    let frame = 0
    r.onBeforeRender = function (...a) {
      if (frame++ % 2) return
      const off = Object.values(hidden.current).filter(Boolean)
      off.forEach((o) => (o.visible = false))
      draw.apply(this, a)
      off.forEach((o) => (o.visible = true))
    }
    return r
  }, [hidden])
  useEffect(() => {
    reflector.material.uniforms.uMap.value = map
  }, [reflector, map])
  useEffect(() => () => (reflector.dispose(), reflector.geometry.dispose(), map.dispose()), [reflector, map])
  useFrame(() => {
    const u = reflector.material.uniforms
    u.uTime.value = U.uTime.value
    u.uFlow.value = U.uFlow.value
    u.uSunDir.value.copy(U.uSunDir.value)
    u.uSunColor.value.copy(U.uSunColor.value)
    u.uSkyColor.value.copy(U.uSkyColor.value)
  })
  return <primitive object={reflector} />
}

// ---------------------------------------------------------------- clouds

function Clouds({ U, wind }) {
  const camera = useThree((s) => s.camera)
  const tex = useMemo(() => puffTexture(), [])
  const { geo, puffs } = useMemo(() => {
    const r = rng(55)
    // the two big ones sit where the reference has them, over the shoulders of the range
    const spots = [
      [-700, 980, -1500, 1.5],
      [820, 1050, -1700, 1.4],
      [-2100, 1100, -2600, 1.8],
      [2300, 1000, -2900, 1.8],
      [200, 1250, -3300, 1.6],
      [-1200, 1100, 600, 1.7],
      [1500, 1000, -300, 1.5],
      [-300, 1300, -4200, 2.2],
    ]
    const puffs = []
    spots.forEach(([cx, cy, cz, k], ci) => {
      const W = 230 * k
      const H = 130 * k
      const n = Math.round(46 * k)
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2
        const rr = Math.sqrt(r())
        const x = Math.cos(a) * rr * W
        const z = Math.sin(a) * rr * W * 0.55
        const top = Math.sqrt(Math.max(0, 1 - rr * rr))
        const y = top * H * (0.25 + r() * 0.75)
        const size = (70 + r() * 80) * k * (0.6 + 0.4 * top)
        puffs.push({ c: ci, x: cx + x, y: cy + y, z: cz + z, size, rot: r() * 6.28, shade: Math.min(1, 0.25 + 0.8 * (y / H)), seed: r() })
      }
    })
    const geo = new THREE.InstancedBufferGeometry()
    const quad = new THREE.PlaneGeometry(1, 1)
    geo.index = quad.index
    geo.attributes.position = quad.attributes.position
    geo.attributes.uv = quad.attributes.uv
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(puffs.length * 3), 3))
    geo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(new Float32Array(puffs.length * 4), 4))
    geo.instanceCount = puffs.length
    return { geo, puffs }
  }, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          { uTex: { value: null }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uSkyColor: { value: new THREE.Color() }, uShadowColor: { value: new THREE.Color() }, uOpacity: { value: 0.95 } },
        ]),
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    [],
  )
  useDispose(geo, mat, tex)
  const drift = useRef(0)
  const order = useMemo(() => puffs.map((_, i) => i), [puffs])
  const depth = useMemo(() => new Float32Array(puffs.length), [puffs])
  useFrame((_, dt) => {
    drift.current += Math.min(dt, 0.1) * wind * 4
    const u = mat.uniforms
    u.uTex.value = tex
    u.uSunDir.value.copy(U.uSunDir.value)
    u.uSunColor.value.copy(U.uSunColor.value)
    u.uSkyColor.value.copy(U.uSkyColor.value)
    u.uShadowColor.value.copy(U.uSkyColor.value).multiplyScalar(1.15).lerp(U.uSunColor.value, 0.15)
    // back to front, so the puffs blend correctly
    const off = geo.attributes.aOffset
    const pa = geo.attributes.aPuff
    const cp = camera.position
    const span = 4800
    const xs = puffs.map((p) => ((((p.x + drift.current + span / 2) % span) + span) % span) - span / 2)
    puffs.forEach((p, i) => (depth[i] = (xs[i] - cp.x) ** 2 + (p.y - cp.y) ** 2 + (p.z - cp.z) ** 2))
    order.sort((a, b) => depth[b] - depth[a])
    order.forEach((j, i) => {
      const p = puffs[j]
      off.setXYZ(i, xs[j], p.y, p.z)
      pa.setXYZW(i, p.size, p.rot, p.shade, p.seed)
    })
    off.needsUpdate = true
    pa.needsUpdate = true
  })
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />
}

// ---------------------------------------------------------------- scene

export default function Valley({ elevation = 38, azimuth = -40, exposure = 0.55, haze = 1, snowline = 300, trees = 1, grass = 1, wind = 1, flow = 1, clouds = true }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const U = useMemo(
    () => ({
      uTime: { value: 0 },
      uWind: { value: 1 },
      uFlow: { value: 1 },
      uSnowline: { value: 300 },
      uSunView: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color() },
      uSkyColor: { value: new THREE.Color() },
    }),
    [],
  )
  const hidden = useRef({})
  const setHidden = useMemo(() => (k, o) => (hidden.current[k] = o), [])

  // sky, sun and the light the sky itself throws
  const sky = useMemo(() => makeSky({ turbidity: 2.6, rayleigh: 1.25, mie: 0.0035, mieG: 0.82 }), [])
  useEffect(() => () => sky.dispose(), [sky])
  const pmrem = useMemo(() => new THREE.PMREMGenerator(gl), [gl])
  useEffect(() => () => pmrem.dispose(), [pmrem])
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])
  const sunColor = useMemo(() => sunlight(elevation), [elevation])
  const fogColor = useMemo(() => {
    const low = 1 - sstep(3, 25, elevation)
    return new THREE.Color('#a9bfd6').lerp(new THREE.Color('#e9b98f'), low * 0.75).multiplyScalar(0.55 + 0.45 * sstep(-2, 15, elevation))
  }, [elevation])
  useEffect(() => {
    sky.update(gl, sunDir)
    const env = pmrem.fromCubemap(sky.envTexture)
    scene.environment = env.texture
    scene.environmentIntensity = 0.75
    return () => {
      scene.environment = null
      env.dispose()
    }
  }, [sky, gl, sunDir, pmrem, scene])
  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  useEffect(() => {
    scene.fog = new THREE.FogExp2(fogColor, 0.00042 * haze)
    return () => (scene.fog = null)
  }, [scene, fogColor, haze])

  // the land
  const near = useMemo(() => buildNear(), [])
  const far = useMemo(() => buildFar(), [])
  const ground = useMemo(() => groundMaterial(U), [U])
  useEffect(() => () => (near.geometry.dispose(), far.dispose(), ground.dispose()), [near, far, ground])
  const rocks = useMemo(() => placeRocks(), [])

  // Nothing that casts a shadow moves (the sway is too slight to show in
  // one), so the shadow map is drawn only when the light or the land changes.
  const shadowFrames = useRef(0)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    shadowFrames.current = 30 // the instances settle over the first few frames
    return () => void (gl.shadowMap.autoUpdate = true)
  }, [gl, sunDir, trees, grass])

  useFrame(({ clock }) => {
    if (shadowFrames.current > 0) {
      shadowFrames.current--
      gl.shadowMap.needsUpdate = true
    }
    U.uTime.value = clock.elapsedTime
    U.uWind.value = wind
    U.uFlow.value = flow
    U.uSnowline.value = snowline
    U.uSunDir.value.copy(sunDir)
    U.uSunColor.value.copy(sunColor)
    U.uSkyColor.value.copy(fogColor)
    U.uSunView.value.copy(sunDir).transformDirection(camera.matrixWorldInverse)
  })

  const lightTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 0, -70)
    return o
  }, [])
  const lightPos = useMemo(() => sunDir.clone().multiplyScalar(500).add(lightTarget.position), [sunDir, lightTarget])
  const sunI = 4.2 * sstep(-2, 10, elevation) + 0.2

  return (
    <group>
      <primitive object={sky.sky} />
      <primitive object={lightTarget} />
      <hemisphereLight args={['#bcd3ea', '#3c4a2a', 0.25]} />
      <directionalLight position={lightPos} target={lightTarget} color={sunColor} intensity={sunI} castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.35}>
        <orthographicCamera attach="shadow-camera" args={[-190, 190, 190, -190, 50, 1100]} />
      </directionalLight>
      <mesh geometry={near.geometry} material={ground} receiveShadow castShadow />
      <mesh geometry={far} material={ground} receiveShadow />
      <River near={near} rocks={rocks} U={U} sky={sky} hidden={hidden} />
      <Rocks list={rocks} setHidden={setHidden} />
      <Forest density={trees} U={U} setHidden={setHidden} />
      {grass > 0 && <Grass amount={grass} U={U} setHidden={setHidden} />}
      {clouds && <Clouds U={U} wind={wind} />}
      {/* beyond the land's edge, the colour of the haze */}
      <mesh rotation-x={-Math.PI / 2} position-y={-8}>
        <circleGeometry args={[30000, 64]} />
        <meshBasicMaterial color={fogColor} />
      </mesh>
    </group>
  )
}
