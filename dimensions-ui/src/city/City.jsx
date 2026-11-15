import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makeSky, sunDirection, sunlight } from '../cloud/sun.js'
import { broadleaf, leafTexture, barkTextures } from '../valley/trees.js'
import { foliageMaterial } from '../valley/shaders.js'
import { buildCity } from './buildings.js'
import { PAINTS, contactShadowTexture, vehicleTypes } from './cars.js'
import { AVE_HALF, I, J0, J1, ST_HALF, aveDir, aveX, rng, signal, sstep, stDir, stZ } from './layout.js'
import { facadeMaterial, streetMaterial } from './shaders.js'
import { carPose, makePeople, makeTraffic, parkedCars, stepTraffic } from './traffic.js'

// A city on a Manhattan grid, drawn for realism. Avenues and cross streets
// run between blocks of brick walk-ups with fire escapes, limestone prewar
// buildings crowned with water tanks, deco towers stepping up to spires and
// glass towers that mirror the sky; behind every window is a room you can
// see into. Signals cycle on every corner and the traffic obeys them,
// queueing at the lights and rolling up the avenues on a green wave; cabs,
// buses and trucks among the cars; people on the sidewalks. The sun and
// sky light it all, and as the sun goes down the windows, shopfronts,
// street lamps and headlights come on.

const o3 = new THREE.Object3D()
const col = new THREE.Color()

function useDispose(...things) {
  useEffect(() => () => things.forEach((t) => t && t.dispose && t.dispose()), things) // eslint-disable-line react-hooks/exhaustive-deps
}

// An instanced mesh with fixed placements: [x, y, z, ry, sx, sy, sz] (+ optional colour).
function Fixed({ geometry, material, items, cast = false, receive = true }) {
  const ref = useRef()
  useEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((it, k) => {
      o3.position.set(it[0], it[1], it[2])
      o3.rotation.set(it[7] || 0, it[3] || 0, it[8] || 0)
      o3.scale.set(it[4] ?? 1, it[5] ?? 1, it[6] ?? 1)
      o3.updateMatrix()
      m.setMatrixAt(k, o3.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={cast} receiveShadow={receive} frustumCulled={false} />
}

// ---------------------------------------------------------------- signals

// A pole on the far right corner for each flow, with a mast arm over the
// lanes, heads hung from it and one on the pole, and walk signals.
function useSignalLayout() {
  return useMemo(() => {
    const poles = []
    const arms = []
    const heads = []
    const lamps = [] // { m: [..], i, j, axis, which: 0 red 1 amber 2 green }
    const peds = []
    const pedLamps = [] // { m, i, j, kind: 'ave'|'st', which: 0 hand 1 walk }
    const head = (x, y, z, face, i, j, axis) => {
      const ry = Math.atan2(face[0], face[2])
      heads.push([x, y, z, ry, 1, 1, 1])
      ;[0.33, 0, -0.33].forEach((dy, w) => lamps.push({ m: [x + face[0] * 0.14, y + dy, z + face[2] * 0.14, ry, 1, 1, 1], i, j, axis, which: w }))
    }
    const ped = (x, y, z, face, i, j, kind) => {
      const ry = Math.atan2(face[0], face[2])
      peds.push([x, y, z, ry, 1, 1, 1])
      ;[0.11, -0.11].forEach((dy, w) => pedLamps.push({ m: [x + face[0] * 0.13, y + dy, z + face[2] * 0.13, ry, 1, 1, 1], i, j, kind, which: w }))
    }
    for (let i = -I; i <= I; i++)
      for (let j = J0; j <= J1; j++) {
        const d = aveDir(i)
        const e = stDir(j)
        // avenue flow
        {
          const px = aveX(i) - d * (AVE_HALF + 0.9)
          const pz = stZ(j) + d * (ST_HALF + 1.6)
          poles.push([px, 0, pz, 0, 1, 1, 1])
          arms.push([px + d * 5.2, 6.1, pz, 0, 1, 1, 1, 0, Math.PI / 2])
          const face = [0, 0, -d]
          head(px + d * 4.5, 5.35, pz, face, i, j, 'z')
          head(px + d * 8.8, 5.35, pz, face, i, j, 'z')
          head(px, 3.3, pz - d * 0.2, face, i, j, 'z')
          ped(px + d * 0.25, 2.6, pz, [d, 0, 0], i, j, 'st')
          ped(px, 2.6, pz - d * 0.25, [0, 0, -d], i, j, 'ave')
        }
        // street flow
        {
          const px = aveX(i) + e * (AVE_HALF + 1.6)
          const pz = stZ(j) + e * (ST_HALF + 0.9)
          poles.push([px, 0, pz, 0, 1, 1, 1])
          arms.push([px, 6.1, pz - e * 2.7, Math.PI / 2, 1, 0.55, 1, 0, Math.PI / 2])
          const face = [-e, 0, 0]
          head(px, 5.35, pz - e * 3.6, face, i, j, 'x')
          head(px - e * 0.2, 3.3, pz, face, i, j, 'x')
          ped(px, 2.6, pz - e * 0.25, [0, 0, -e], i, j, 'ave')
        }
      }
    return { poles, arms, heads, lamps, peds, pedLamps }
  }, [])
}

function Signals({ U }) {
  const L = useSignalLayout()
  const geo = useMemo(
    () => ({
      pole: new THREE.CylinderGeometry(0.11, 0.15, 6.4, 10).translate(0, 3.2, 0),
      arm: new THREE.CylinderGeometry(0.08, 0.1, 10.4, 8),
      head: new THREE.BoxGeometry(0.38, 1.08, 0.26),
      lamp: new THREE.CircleGeometry(0.115, 14),
      ped: new THREE.BoxGeometry(0.42, 0.5, 0.24),
      pedLamp: new THREE.PlaneGeometry(0.26, 0.16),
    }),
    [],
  )
  const mat = useMemo(
    () => ({
      metal: new THREE.MeshStandardMaterial({ color: '#30353a', metalness: 0.6, roughness: 0.45 }),
      housing: new THREE.MeshStandardMaterial({ color: '#141516', metalness: 0.2, roughness: 0.6 }),
      lamp: new THREE.MeshBasicMaterial({ toneMapped: true }),
    }),
    [],
  )
  useEffect(() => () => (Object.values(geo).forEach((g) => g.dispose()), Object.values(mat).forEach((m) => m.dispose())), [geo, mat])
  const lampRef = useRef()
  const pedRef = useRef()
  useEffect(() => {
    for (const [ref, list] of [
      [lampRef, L.lamps],
      [pedRef, L.pedLamps],
    ]) {
      const m = ref.current
      list.forEach((l, k) => {
        o3.position.set(l.m[0], l.m[1], l.m[2])
        o3.rotation.set(0, l.m[3], 0)
        o3.scale.set(1, 1, 1)
        o3.updateMatrix()
        m.setMatrixAt(k, o3.matrix)
        m.setColorAt(k, col.set(0, 0, 0))
      })
      m.instanceMatrix.needsUpdate = true
    }
  }, [L])
  const ON = useMemo(() => [new THREE.Color(4.0, 0.12, 0.05), new THREE.Color(4.0, 1.7, 0.08), new THREE.Color(0.15, 3.6, 1.6)], [])
  const OFF = useMemo(() => [new THREE.Color(0.05, 0.008, 0.006), new THREE.Color(0.05, 0.03, 0.005), new THREE.Color(0.005, 0.04, 0.025)], [])
  const HAND = useMemo(() => new THREE.Color(4.0, 1.2, 0.15), [])
  const WALK = useMemo(() => new THREE.Color(3.2, 3.4, 3.6), [])
  const DARK = useMemo(() => new THREE.Color(0.03, 0.03, 0.03), [])
  useFrame(() => {
    const t = U.uTime.value
    const lm = lampRef.current
    const pm = pedRef.current
    if (!lm || !pm) return
    const cache = new Map()
    const sig = (i, j) => {
      const k = i * 1000 + j
      if (!cache.has(k)) cache.set(k, signal(i, j, t))
      return cache.get(k)
    }
    L.lamps.forEach((l, k) => {
      const s = sig(l.i, l.j)
      const state = l.axis === 'z' ? s.ave : s.st
      lm.setColorAt(k, state === 2 - l.which ? ON[l.which] : OFF[l.which])
    })
    const blink = Math.floor(t * 2) % 2 === 0
    L.pedLamps.forEach((l, k) => {
      const s = sig(l.i, l.j)
      const w = l.kind === 'ave' ? s.aveWalk : s.stWalk
      const on = l.which === 0 ? w === 2 || (w === 1 && blink) : w === 0
      pm.setColorAt(k, on ? (l.which === 0 ? HAND : WALK) : DARK)
    })
    lm.instanceColor.needsUpdate = true
    pm.instanceColor.needsUpdate = true
  })
  return (
    <group>
      <Fixed geometry={geo.pole} material={mat.metal} items={L.poles} cast />
      <Fixed geometry={geo.arm} material={mat.metal} items={L.arms} cast />
      <Fixed geometry={geo.head} material={mat.housing} items={L.heads} cast />
      <Fixed geometry={geo.ped} material={mat.housing} items={L.peds} />
      <instancedMesh ref={lampRef} args={[geo.lamp, mat.lamp, L.lamps.length]} frustumCulled={false} />
      <instancedMesh ref={pedRef} args={[geo.pedLamp, mat.lamp, L.pedLamps.length]} frustumCulled={false} />
    </group>
  )
}

// ---------------------------------------------------------------- street lamps

function StreetLamps({ U }) {
  const items = useMemo(() => {
    const poles = []
    const heads = []
    const add = (x, z, dx, dz) => {
      poles.push([x, 0, z, Math.atan2(dx, dz), 1, 1, 1])
      heads.push([x + dx * 2.3, 8.55, z + dz * 2.3, Math.atan2(dx, dz), 1, 1, 1])
    }
    for (let i = -I; i <= I; i++)
      for (let z = stZ(J0); z <= stZ(J1); z += 15) {
        const k = Math.round(z / 15)
        const b = z - Math.round(z / 72) * 72
        if (Math.abs(b) < ST_HALF + 6) continue
        if (k % 2 === 1) add(aveX(i) + AVE_HALF + 0.7, z, -1, 0)
        else add(aveX(i) - AVE_HALF - 0.7, z, 1, 0)
      }
    for (let j = J0; j <= J1; j++)
      for (let x = aveX(-I - 1); x <= aveX(I + 1); x += 18) {
        const k = Math.round(x / 18)
        const a = x - Math.round(x / 170) * 170
        if (Math.abs(a) < AVE_HALF + 7) continue
        if (k % 2 === 1) add(x, stZ(j) + ST_HALF + 0.7, 0, -1)
        else add(x, stZ(j) - ST_HALF - 0.7, 0, 1)
      }
    return { poles, heads }
  }, [])
  const geo = useMemo(() => {
    const pole = new THREE.CylinderGeometry(0.09, 0.14, 8.6, 8).translate(0, 4.3, 0)
    const arm = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6).rotateX(Math.PI / 2).translate(0, 8.5, 1.2)
    const merged = new THREE.BufferGeometry()
    const parts = [pole, arm].map((g) => g.toNonIndexed())
    const pos = []
    const nor = []
    parts.forEach((g) => (pos.push(...g.attributes.position.array), nor.push(...g.attributes.normal.array)))
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    return { pole: merged, head: new THREE.BoxGeometry(0.42, 0.16, 0.85), glow: new THREE.PlaneGeometry(0.34, 0.7).rotateX(Math.PI / 2).translate(0, -0.085, 0) }
  }, [])
  const mat = useMemo(() => ({ metal: new THREE.MeshStandardMaterial({ color: '#2b2f33', metalness: 0.6, roughness: 0.5 }), glow: new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.DoubleSide }) }), [])
  useEffect(() => () => (Object.values(geo).forEach((g) => g.dispose()), Object.values(mat).forEach((m) => m.dispose())), [geo, mat])
  useFrame(() => {
    const n = U.uNight.value
    mat.glow.color.setRGB(0.2 + 5 * n, 0.18 + 4.2 * n, 0.15 + 3.2 * n)
  })
  return (
    <group>
      <Fixed geometry={geo.pole} material={mat.metal} items={items.poles} cast />
      <Fixed geometry={geo.head} material={mat.metal} items={items.heads} />
      <Fixed geometry={geo.glow} material={mat.glow} items={items.heads} />
    </group>
  )
}

// ---------------------------------------------------------------- vehicles

const lightVertex = /* glsl */ `
varying vec3 vC;
varying vec3 vI;
void main() {
  vC = color;
  vI = instanceColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`
const lightFragment = /* glsl */ `
varying vec3 vC;
varying vec3 vI;
void main() {
  vec3 c = vC.r * vec3(1.0, 0.05, 0.03) * vI.r + vC.g * vec3(1.0, 0.92, 0.8) * vI.g;
  gl_FragColor = vec4(c, 1.0);
}
`

function makeLightMaterial() {
  return new THREE.ShaderMaterial({ vertexShader: lightVertex, fragmentShader: lightFragment, vertexColors: true })
}

// One kind of vehicle as three instanced parts sharing their placements.
function useVehicleMeshes(type, n, paints, mats) {
  return useMemo(() => {
    const body = new THREE.InstancedMesh(type.body, mats.paint, Math.max(1, n))
    const trim = new THREE.InstancedMesh(type.trim, mats.trim, Math.max(1, n))
    const lights = new THREE.InstancedMesh(type.lights, mats.lights, Math.max(1, n))
    for (const m of [body, trim, lights]) {
      m.frustumCulled = false
      m.count = n
    }
    body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3)
    lights.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3)
    body.castShadow = false
    body.receiveShadow = true
    trim.receiveShadow = true
    return { body, trim, lights, paints }
  }, [type, n, paints, mats])
}

function Vehicles({ U, density }) {
  const types = useMemo(() => vehicleTypes(), [])
  useEffect(() => () => Object.values(types).forEach((t) => (t.body.dispose(), t.trim.dispose(), t.lights.dispose())), [types])
  const traffic = useMemo(() => makeTraffic(types, density), [types, density])
  const parked = useMemo(() => parkedCars(types), [types])
  const mats = useMemo(
    () => ({
      paint: new THREE.MeshPhysicalMaterial({ metalness: 0.35, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.06 }),
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.2 }),
      lights: makeLightMaterial(),
      shadow: new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, color: '#000000', polygonOffset: true, polygonOffsetFactor: -2 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => (m.map && m.map.dispose(), m.dispose())), [mats])
  const kinds = Object.keys(types)
  // all vehicles, moving and parked, grouped by kind
  const groups = useMemo(() => {
    const g = {}
    for (const k of kinds) g[k] = { moving: traffic.cars.filter((c) => c.kind === k), parked: parked.filter((c) => c.kind === k) }
    return g
  }, [traffic, parked]) // eslint-disable-line react-hooks/exhaustive-deps
  const meshes = {}
  for (const k of kinds) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    meshes[k] = useVehicleMeshes(types[k], groups[k].moving.length + groups[k].parked.length, PAINTS[k], mats)
  }
  const shadowGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [])
  const total = traffic.cars.length + parked.length
  const shadows = useMemo(() => {
    const m = new THREE.InstancedMesh(shadowGeo, mats.shadow, total)
    m.frustumCulled = false
    m.renderOrder = 1
    return m
  }, [shadowGeo, mats, total])
  useDispose(shadowGeo)
  const place = (m, k, x, z, heading, lift = 0) => {
    o3.position.set(x, lift, z)
    o3.rotation.set(0, heading, 0)
    o3.scale.set(1, 1, 1)
    o3.updateMatrix()
    m.setMatrixAt(k, o3.matrix)
  }
  // parked cars are placed once, after the moving ones in each buffer
  useEffect(() => {
    let s = traffic.cars.length
    for (const k of kinds) {
      const { body, trim, lights, paints } = meshes[k]
      const base = groups[k].moving.length
      groups[k].moving.forEach((c, n) => body.setColorAt(n, col.set(paints[c.paint % paints.length])))
      groups[k].parked.forEach((c, n) => {
        for (const m of [body, trim, lights]) place(m, base + n, c.x, c.z, c.heading)
        body.setColorAt(base + n, col.set(paints[c.paint % paints.length]))
        lights.setColorAt(base + n, col.setRGB(0.15, 0.05, 0))
        o3.position.set(c.x, 0.03, c.z)
        o3.rotation.set(0, c.heading, 0)
        o3.scale.set(types[k].length + 0.5, 1, types[k].width + 0.6)
        o3.updateMatrix()
        shadows.setMatrixAt(s++, o3.matrix)
      })
      for (const m of [body, trim, lights]) m.instanceMatrix.needsUpdate = true
      body.instanceColor.needsUpdate = true
      lights.instanceColor.needsUpdate = true
    }
    shadows.instanceMatrix.needsUpdate = true
  }, [groups, shadows]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1)
    const t = U.uTime.value
    stepTraffic(traffic, t, step / 2)
    stepTraffic(traffic, t, step / 2)
    const night = U.uNight.value
    let s = 0
    for (const k of kinds) {
      const { body, trim, lights, paints } = meshes[k]
      groups[k].moving.forEach((c, n) => {
        const [x, z, h] = carPose(c)
        for (const m of [body, trim, lights]) place(m, n, x, z, h)
        lights.setColorAt(n, col.setRGB(0.35 + night * 1.6 + c.brake * 3.2, 0.25 + night * 5, 0))
        o3.position.set(x, 0.03, z)
        o3.rotation.set(0, h, 0)
        o3.scale.set(types[k].length + 0.5, 1, types[k].width + 0.6)
        o3.updateMatrix()
        shadows.setMatrixAt(s++, o3.matrix)
      })
      for (const m of [body, trim, lights]) m.instanceMatrix.needsUpdate = true
      body.instanceColor.needsUpdate = true
      lights.instanceColor.needsUpdate = true
    }
    shadows.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      {kinds.map((k) => (
        <group key={k}>
          <primitive object={meshes[k].body} />
          <primitive object={meshes[k].trim} />
          <primitive object={meshes[k].lights} />
        </group>
      ))}
      <primitive object={shadows} />
    </group>
  )
}

// ---------------------------------------------------------------- people

const CLOTHES = ['#1d1f24', '#2c3e57', '#6b1e22', '#c8c3b6', '#3b3f2a', '#111111', '#7d6a55', '#2a5d7a', '#b5822f', '#5b5e63', '#a33d2e', '#e7e4dc']
const SKIN = ['#e0b896', '#c58c62', '#8d5a3b', '#5a3a28', '#f0cfb0', '#a8734e']

function People({ U }) {
  const people = useMemo(() => makePeople(750), [])
  const geo = useMemo(() => {
    const body = new THREE.CapsuleGeometry(0.19, 0.62, 2, 6).scale(1, 1, 0.7).translate(0, 1.08, 0).toNonIndexed()
    const legs = new THREE.CylinderGeometry(0.15, 0.11, 0.82, 6, 1, true).scale(1, 1, 0.75).translate(0, 0.41, 0).toNonIndexed()
    const n1 = body.attributes.position.count
    const n2 = legs.attributes.position.count
    const pos = [...body.attributes.position.array, ...legs.attributes.position.array]
    const nor = [...body.attributes.normal.array, ...legs.attributes.normal.array]
    const c = [...Array(n1).fill([1, 1, 1]).flat(), ...Array(n2).fill([0.22, 0.22, 0.25]).flat()]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3))
    return { body: g, head: new THREE.SphereGeometry(0.115, 7, 5).translate(0, 1.68, 0) }
  }, [])
  const mats = useMemo(() => ({ body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), head: new THREE.MeshStandardMaterial({ roughness: 0.6 }) }), [])
  useEffect(() => () => (Object.values(geo).forEach((g) => g.dispose()), Object.values(mats).forEach((m) => m.dispose())), [geo, mats])
  const bodyRef = useRef()
  const headRef = useRef()
  useEffect(() => {
    people.forEach((p, k) => {
      bodyRef.current.setColorAt(k, col.set(CLOTHES[p.c % CLOTHES.length]))
      headRef.current.setColorAt(k, col.set(SKIN[(p.c * 7) % SKIN.length]))
    })
    bodyRef.current.instanceColor.needsUpdate = true
    headRef.current.instanceColor.needsUpdate = true
  }, [people])
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1)
    const t = U.uTime.value
    people.forEach((p, k) => {
      p.q += p.speed * step
      if (p.q > p.hi) p.q = p.lo
      if (p.q < p.lo) p.q = p.hi
      const bob = Math.abs(Math.sin(t * 5.5 + p.phase)) * 0.04
      const x = p.axis === 'z' ? p.fixed : p.q
      const z = p.axis === 'z' ? p.q : p.fixed
      const h = p.axis === 'z' ? (p.speed > 0 ? 0 : Math.PI) : p.speed > 0 ? Math.PI / 2 : -Math.PI / 2
      o3.position.set(x, 0.15 + bob, z)
      o3.rotation.set(0, h, Math.sin(t * 5.5 + p.phase) * 0.03)
      o3.scale.setScalar(p.h / 1.8)
      o3.updateMatrix()
      bodyRef.current.setMatrixAt(k, o3.matrix)
      headRef.current.setMatrixAt(k, o3.matrix)
    })
    bodyRef.current.instanceMatrix.needsUpdate = true
    headRef.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[geo.body, mats.body, people.length]} frustumCulled={false} receiveShadow />
      <instancedMesh ref={headRef} args={[geo.head, mats.head, people.length]} frustumCulled={false} receiveShadow />
    </group>
  )
}

// ---------------------------------------------------------------- street trees

function StreetTrees({ U }) {
  const tex = useMemo(() => ({ leaf: leafTexture(4, 88), ...barkTextures(5) }), [])
  const species = useMemo(() => [broadleaf(61, { height: 5.5, spread: 0.8 }), broadleaf(73, { height: 6, spread: 0.7 })], [])
  const mats = useMemo(
    () => ({
      bark: foliageMaterial({ map: tex.map, normalMap: tex.normalMap, roughness: 0.95, color: '#8a7d70' }, U, { flutter: 0, translucent: false, crownNormals: false }),
      leaf: foliageMaterial({ map: tex.leaf, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.75 }, U, { flutter: 1 }),
    }),
    [tex, U],
  )
  useEffect(() => () => (Object.values(tex).forEach((t) => t.dispose()), Object.values(mats).forEach((m) => m.dispose()), species.forEach((s) => (s.bark.dispose(), s.leaves.dispose()))), [tex, mats, species])
  const items = useMemo(() => {
    const r = rng(5)
    const out = [[], []]
    // on the side streets near the viewer: further out they are lost among the buildings
    for (let j = -4; j <= 2; j++)
      for (const side of [-1, 1])
        for (let x = aveX(-2); x <= aveX(2); x += 13 + r() * 6) {
          const a = x - Math.round(x / 170) * 170
          if (Math.abs(a) < AVE_HALF + 14 || Math.abs(a) > 62 || r() < 0.25) continue
          const s = 0.95 + r() * 0.4
          out[Math.floor(r() * 2)].push([x, 0.1, stZ(j) + side * (ST_HALF + 1.1), r() * 6.28, s, s, s])
        }
    return out
  }, [])
  return (
    <group>
      {species.map((s, k) => (
        <group key={k}>
          <Fixed geometry={s.bark} material={mats.bark} items={items[k]} cast />
          <Fixed geometry={s.leaves} material={mats.leaf} items={items[k]} cast />
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- beacons

function Beacons({ list, U }) {
  const geo = useMemo(() => new THREE.SphereGeometry(0.55, 10, 8), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000' }), [])
  useDispose(geo, mat)
  useFrame(() => {
    const t = U.uTime.value
    const on = Math.sin(t * 2.6) > 0.4 ? 1 : 0.08
    mat.color.setRGB(6 * on * (0.2 + U.uNight.value), 0.1 * on, 0.05 * on)
  })
  return <Fixed geometry={geo} material={mat} items={list.map(([x, y, z]) => [x, y, z])} />
}

// ---------------------------------------------------------------- scene

export default function City({ elevation = 32, azimuth = 140, exposure = 0.6, haze = 1, traffic = 1, people = true, trees = true }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const U = useMemo(
    () => ({
      uTime: { value: 0 },
      uNight: { value: 0 },
      uDay: { value: 1 },
      uWind: { value: 0.6 },
      uSunView: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color() },
    }),
    [],
  )
  const sky = useMemo(() => makeSky({ turbidity: 3.5, rayleigh: 1.3, mie: 0.005, mieG: 0.8 }), [])
  useEffect(() => () => sky.dispose(), [sky])
  const pmrem = useMemo(() => new THREE.PMREMGenerator(gl), [gl])
  useEffect(() => () => pmrem.dispose(), [pmrem])
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])
  const sunColor = useMemo(() => sunlight(elevation), [elevation])
  const night = 1 - sstep(-5, 7, elevation)
  const day = sstep(-6, 18, elevation)
  const fogColor = useMemo(() => {
    const low = 1 - sstep(2, 22, elevation)
    return new THREE.Color('#b4c2d0')
      .lerp(new THREE.Color('#e3b48c'), low * 0.7)
      .multiplyScalar(0.08 + 0.92 * sstep(-6, 12, elevation))
      .lerp(new THREE.Color('#1a2130'), night * 0.6)
  }, [elevation, night])
  useEffect(() => {
    sky.update(gl, sunDir)
    const env = pmrem.fromCubemap(sky.envTexture)
    scene.environment = env.texture
    scene.environmentIntensity = 0.85 * (0.22 + 0.78 * sstep(-8, 10, elevation))
    return () => {
      scene.environment = null
      env.dispose()
    }
  }, [sky, gl, sunDir, pmrem, scene, elevation])
  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  useEffect(() => {
    scene.fog = new THREE.FogExp2(fogColor, 0.00026 * haze)
    return () => (scene.fog = null)
  }, [scene, fogColor, haze])

  const city = useMemo(() => buildCity(), [])
  const facade = useMemo(() => facadeMaterial(U), [U])
  const street = useMemo(() => streetMaterial(U), [U])
  const ground = useMemo(() => new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), [])
  useEffect(() => () => (city.buildings.dispose(), city.metal.dispose(), city.sidewalks.dispose(), facade.dispose(), street.dispose(), ground.dispose()), [city, facade, street, ground])

  // buildings don't move: draw the shadow map only when the sun does
  const shadowFrames = useRef(0)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    shadowFrames.current = 20
    return () => void (gl.shadowMap.autoUpdate = true)
  }, [gl, sunDir, trees])

  useFrame(({ clock }) => {
    if (shadowFrames.current > 0) {
      shadowFrames.current--
      gl.shadowMap.needsUpdate = true
    }
    U.uTime.value = clock.elapsedTime
    U.uNight.value = night
    U.uDay.value = day
    U.uSunColor.value.copy(sunColor)
    U.uSunView.value.copy(sunDir).transformDirection(camera.matrixWorldInverse)
  })

  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 0, -220)
    return o
  }, [])
  const lightPos = useMemo(() => sunDir.clone().multiplyScalar(1600).add(target.position), [sunDir, target])
  const sunI = 4.0 * sstep(-1, 8, elevation)

  return (
    <group>
      <primitive object={sky.sky} />
      <primitive object={target} />
      <hemisphereLight args={[night > 0.5 ? '#3a4a6a' : '#c4d2e2', '#2a2826', 0.25 - night * 0.17]} />
      {/* once the sun is down it lights nothing, and must cast nothing */}
      {sunI > 0.001 && (
      <directionalLight position={lightPos} target={target} color={sunColor} intensity={sunI} castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0003} shadow-normalBias={0.6}>
        <orthographicCamera attach="shadow-camera" args={[-520, 520, 520, -520, 100, 3400]} />
      </directionalLight>
      )}
      <mesh geometry={city.buildings} material={facade} castShadow receiveShadow />
      <mesh geometry={city.metal} material={facade} castShadow receiveShadow />
      <mesh geometry={city.sidewalks} material={street} receiveShadow />
      <mesh geometry={ground} material={street} receiveShadow />
      <Signals U={U} />
      <StreetLamps U={U} />
      <Beacons list={city.beacons} U={U} />
      {traffic > 0 && <Vehicles U={U} density={traffic} />}
      {people && <People U={U} />}
      {trees && <StreetTrees U={U} />}
    </group>
  )
}
