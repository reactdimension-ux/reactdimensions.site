import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeSky, sunDirection, sunlight } from '../cloud/sun.js'
import { facet, rng } from '../lowpoly/kit.jsx'
import { TEAMS, balloonGeometry, boardTexture, buildFlat, buildGround, buildProps, carGeometry, parkedCars, personGeometry, treeGeometry, tyreGeometry } from './props.js'
import { POND, TRACK as T, WORLD, fbm, groundAt, sstep, wrap } from './track.js'

// A low-poly racing circuit as a whole venue: 1.3 km of asphalt with a
// rubbered-in racing line, kerbs, gravel traps, armco and tyre walls; a pit
// lane with twelve garages and their crews; grandstands full of people; a
// paddock, car park, helipad and pond; woods and hills all round under a
// physical sky. A field of GT cars laps it on the racing line, braking for
// the corners and accelerating out of them.

const RACERS = 12

// Instances placed from a list of { x, y, z, rot, s, c }.
function Instances({ geometry, material, items, cast = true, tint = true }) {
  const ref = useRef()
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      o.position.set(it.x, it.y || 0, it.z)
      o.rotation.set(0, it.rot || 0, 0)
      if (Array.isArray(it.s)) o.scale.set(it.s[0], it.s[1], it.s[2])
      else o.scale.setScalar(it.s ?? 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      if (tint) m.setColorAt(i, c.set(it.c || '#ffffff'))
    })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items, tint, geometry])
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, items.length)]} castShadow={cast} receiveShadow frustumCulled={false} />
}

// A flat-shaded material whose instances move: trees sway from the foot,
// people bob on the spot.
function useLiveMaterial(kind, color = '#ffffff') {
  const shader = useRef()
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, vertexColors: kind === 'people' })
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = { value: 0 }
      s.uniforms.uAmp = { value: 1 }
      const move =
        kind === 'people'
          ? `transformed.y += max(0.0, sin(uTime * 5.0 + ph * 5.0)) * 0.1 * uAmp * step(0.5, position.y);`
          : `float hgt = max(transformed.y, 0.0);
             float sw = (sin(uTime * 1.5 + ph) + 0.5 * sin(uTime * 2.7 + ph * 1.7)) * uAmp * 0.028 * hgt;
             transformed.x += sw;
             transformed.z += sw * 0.5;`
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uAmp;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.27;
          ${move}
        #endif`,
      )
      shader.current = s
    }
    m.customProgramCacheKey = () => `circuit-${kind}`
    return m
  }, [kind, color])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }) => {
    if (shader.current) shader.current.uniforms.uTime.value = clock.elapsedTime
  })
  return [mat, shader]
}

function scatter(count, seed, accept) {
  const r = rng(seed)
  const list = []
  for (let n = 0; n < count; n++) {
    const x = (r() - 0.5) * (WORLD.x - 40)
    const z = (r() - 0.5) * (WORLD.z - 40)
    const g = groundAt(x, z)
    if (g.c < 7 || g.pad < 5 || g.pond < POND.r + 1) continue
    const it = accept(x, z, g, r)
    if (it) list.push({ x, y: g.y - 0.15, z, rot: r() * Math.PI * 2, ...it })
  }
  return list
}

const PINE = ['#2f7a3a', '#3b8c3f', '#4f9f45', '#2a6b3b']
const LEAF = ['#6fb04f', '#86bf4e', '#5e9d43', '#a3c850']
const BUSH = ['#d8c93a', '#c4c23a', '#9fbf45', '#e2b93b', '#7fb548']
const pick = (a, r) => a[Math.floor(r() * a.length)]

function Woods({ density }) {
  const geo = useMemo(treeGeometry, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const [crown] = useLiveMaterial('tree')
  const [trunk] = useLiveMaterial('tree', '#5b3d2c')
  const sets = useMemo(() => {
    const tall = (r, a, b) => {
      const s = a + r() * b
      return [s, s * (0.9 + r() * 0.35), s]
    }
    const pines = scatter(Math.round(5200 * density), 31, (x, z, g, r) => {
      const p = g.out ? sstep(16, 90, g.c) * (0.25 + 0.75 * fbm(x * 0.01 + 20, z * 0.01)) : 0.12
      return r() < p ? { s: tall(r, 1.3, 1.3), c: pick(PINE, r) } : null
    })
    const leafy = scatter(Math.round(4200 * density), 47, (x, z, g, r) => {
      const clump = sstep(0.36, 0.6, fbm(x * 0.018 + 9, z * 0.018 + 4))
      const p = (g.out ? 1 - 0.65 * sstep(20, 130, g.c) : 0.9) * clump
      return r() < p ? { s: tall(r, 1.0, 1.0), c: pick(LEAF, r) } : null
    })
    const bushes = scatter(Math.round(3600 * density), 59, (x, z, g, r) => {
      if (g.c > 60) return null
      const s = 0.9 + r() * 1.3
      return r() < 0.75 * sstep(0.3, 0.62, fbm(x * 0.03 + 2, z * 0.03 + 11)) ? { s: [s, s * (0.7 + r() * 0.4), s], c: pick(BUSH, r) } : null
    })
    return { pines, leafy, bushes }
  }, [density])
  return (
    <group>
      <Instances geometry={geo.pine} material={crown} items={sets.pines} />
      <Instances geometry={geo.pineTrunk} material={trunk} items={sets.pines} tint={false} cast={false} />
      <Instances geometry={geo.leaf} material={crown} items={sets.leafy} />
      <Instances geometry={geo.leafTrunk} material={trunk} items={sets.leafy} tint={false} cast={false} />
      <Instances geometry={geo.bush} material={crown} items={sets.bushes} />
    </group>
  )
}

function People({ crew, crowd, showCrowd }) {
  const geo = useMemo(personGeometry, [])
  useEffect(() => () => geo.dispose(), [geo])
  const [mat] = useLiveMaterial('people')
  // crews wear their team colour washed towards white
  const suits = useMemo(() => crew.map((p) => ({ ...p, c: '#' + new THREE.Color(p.c).lerp(new THREE.Color('#ffffff'), 0.3).getHexString() })), [crew])
  return (
    <group>
      <Instances geometry={geo} material={mat} items={suits} />
      {showCrowd && <Instances geometry={geo} material={mat} items={crowd} cast={false} />}
    </group>
  )
}

// The field. Every car follows the same speed profile round the lap, a fixed
// time apart, so they brake and accelerate in the same places and never touch.
function Cars({ count, speed, lead, envMap }) {
  const geo = useMemo(carGeometry, [])
  useEffect(() => () => (geo.paint.dispose(), geo.trim.dispose()), [geo])
  const parked = useMemo(parkedCars, [])
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide, envMapIntensity: 0.45 }), [])
  const trim = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.7 }), [])
  useEffect(() => () => (paint.dispose(), trim.dispose()), [paint, trim])
  useEffect(() => {
    paint.envMap = trim.envMap = envMap
    paint.needsUpdate = trim.needsUpdate = true
  }, [paint, trim, envMap])
  const a = useRef()
  const b = useRef()
  const clock = useRef(0)
  const field = useMemo(
    () =>
      Array.from({ length: RACERS }, (_, i) => ({
        // in pairs, nose to tail, the pairs spread round the lap
        phase: -Math.floor(i / 2) * (T.lap / (RACERS / 2)) - (i % 2) * 0.62,
        side: (i % 2 ? -1 : 1) * 0.9,
        color: TEAMS[(i >> 1) % TEAMS.length],
        dark: i % 2 === 1,
      })),
    [],
  )
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), p: {}, q: {}, c: new THREE.Color(), e: new THREE.Euler(0, 0, 0, 'YXZ') }), [])
  useEffect(() => {
    const { o, c } = tmp
    for (const m of [a.current, b.current]) {
      parked.forEach((p, i) => {
        o.position.set(p.x, 0.02, p.z)
        o.rotation.set(0, p.yaw, 0)
        o.scale.setScalar(0.94)
        o.updateMatrix()
        m.setMatrixAt(RACERS + i, o.matrix)
      })
      m.instanceMatrix.needsUpdate = true
    }
    field.forEach((f, i) => a.current.setColorAt(i, c.set(f.color).multiplyScalar(f.dark ? 0.72 : 1)))
    parked.forEach((p, i) => a.current.setColorAt(RACERS + i, c.set(p.c)))
    a.current.instanceColor.needsUpdate = true
  }, [parked, field, tmp])
  useFrame((_, dt) => {
    if (!a.current || !b.current) return
    clock.current += Math.min(dt, 0.1) * speed
    const { o, p, q, e } = tmp
    field.forEach((f, i) => {
      const u = T.uAt(clock.current + f.phase)
      const wide = f.side * (1 - Math.min(1, Math.abs(T.k[wrap(Math.round(u))]) * 60))
      T.sample(u, T.lineAt(u) * 0.86 + wide, p)
      T.sample(u + 2, T.lineAt(u + 2) * 0.86 + wide, q)
      const dx = q.x - p.x
      const dz = q.z - p.z
      const l = Math.hypot(dx, dz)
      const kq = T.k[wrap(Math.round(u))]
      const v = T.v[wrap(Math.round(u))]
      o.position.set(p.x, 0.04, p.z)
      e.set(kq * v * v * 0.0032, Math.atan2(-dz, dx), 0)
      o.quaternion.setFromEuler(e)
      o.scale.setScalar(i < count ? 1 : 0.0001)
      o.updateMatrix()
      a.current.setMatrixAt(i, o.matrix)
      b.current.setMatrixAt(i, o.matrix)
      if (i === 0 && lead) lead.current = { x: p.x, z: p.z, dx: dx / l, dz: dz / l }
    })
    a.current.instanceMatrix.needsUpdate = true
    b.current.instanceMatrix.needsUpdate = true
  })
  const total = RACERS + parked.length
  return (
    <group>
      <instancedMesh ref={a} args={[geo.paint, paint, total]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={b} args={[geo.trim, trim, total]} castShadow receiveShadow frustumCulled={false} />
    </group>
  )
}

// Five red lights come on one by one, hold, then go out.
function StartLights({ at }) {
  const refs = useRef([])
  const on = useMemo(() => new THREE.Color(4, 0.12, 0.08), [])
  const off = useMemo(() => new THREE.Color('#3a0f0f'), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % 12
    const lit = t < 6.5 ? Math.min(5, Math.floor(t)) : 0
    refs.current.forEach((m, i) => m && m.material.color.copy(i < lit ? on : off))
  })
  return at.map((p, i) => (
    <mesh key={i} position={p} ref={(el) => (refs.current[i] = el)}>
      <sphereGeometry args={[0.34, 10, 8]} />
      <meshBasicMaterial color="#3a0f0f" toneMapped={false} />
    </mesh>
  ))
}

function Turbines() {
  const rotors = useRef([])
  const sites = useMemo(() => [[-300, -250], [-222, -306], [-352, -168], [318, -262]].map(([x, z]) => [x, groundAt(x, z).y - 1, z]), [])
  const blade = useMemo(() => new THREE.CylinderGeometry(0.25, 1, 24, 4, 1).translate(0, 12.6, 0).scale(1, 1, 0.3), [])
  const tower = useMemo(() => new THREE.CylinderGeometry(0.9, 1.7, 56, 8, 1).translate(0, 28, 0), [])
  useEffect(() => () => (blade.dispose(), tower.dispose()), [blade, tower])
  useFrame((_, dt) => rotors.current.forEach((r, i) => r && (r.rotation.z -= Math.min(dt, 0.1) * (0.7 + i * 0.13))))
  return sites.map((p, i) => (
    <group key={i} position={p} rotation-y={0.5}>
      <mesh geometry={tower} castShadow>
        <meshStandardMaterial color="#eef0f2" flatShading roughness={0.7} />
      </mesh>
      <mesh position={[0, 56.4, 0.6]} castShadow>
        <boxGeometry args={[2.4, 2.4, 6]} />
        <meshStandardMaterial color="#e6e9ec" flatShading roughness={0.7} />
      </mesh>
      <group position={[0, 56.4, 3.9]} ref={(el) => (rotors.current[i] = el)}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} geometry={blade} rotation-z={(k * Math.PI * 2) / 3} castShadow>
            <meshStandardMaterial color="#f4f5f6" flatShading roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  ))
}

function Balloons() {
  const refs = useRef([])
  const list = useMemo(
    () => [
      { g: balloonGeometry('#e23b2e', '#f4f2ee'), x: -150, y: 96, z: -190, ph: 0 },
      { g: balloonGeometry('#f2b316', '#1f6fd6'), x: 210, y: 128, z: -240, ph: 2.1 },
      { g: balloonGeometry('#17a865', '#f4f2ee'), x: 30, y: 150, z: -330, ph: 4.4 },
    ],
    [],
  )
  useEffect(() => () => list.forEach((b) => b.g.dispose()), [list])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const b = list[i]
      m.position.set(b.x + Math.sin(t * 0.03 + b.ph) * 50, b.y + Math.sin(t * 0.35 + b.ph) * 3, b.z + Math.cos(t * 0.024 + b.ph) * 30)
      m.rotation.y = t * 0.05 + b.ph
    })
  })
  return list.map((b, i) => (
    <mesh key={i} geometry={b.g} ref={(el) => (refs.current[i] = el)} position={[b.x, b.y, b.z]} scale={1.5} castShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  ))
}

function Clouds({ on }) {
  const group = useRef()
  const clouds = useMemo(() => {
    const r = rng(77)
    return Array.from({ length: 12 }, (_, i) => {
      const parts = Array.from({ length: 4 + Math.floor(r() * 3) }, (_, k) => facet(new THREE.IcosahedronGeometry(7 + r() * 9, 1).translate((k - 2) * 10 + (r() - 0.5) * 6, (r() - 0.5) * 5, (r() - 0.5) * 8), 1.1, 100 + i * 7 + k))
      const g = mergeGeometries(parts)
      g.scale(1, 0.55, 1)
      return { g, x: (r() - 0.5) * 900, y: 150 + r() * 50, z: (r() - 0.5) * 800, s: 0.9 + r() * 1.1, v: 0.6 + r() * 0.6 }
    })
  }, [])
  useEffect(() => () => clouds.forEach((c) => c.g.dispose()), [clouds])
  useFrame((_, dt) => {
    if (!group.current) return
    group.current.children.forEach((m, i) => {
      m.position.x += clouds[i].v * 2.2 * Math.min(dt, 0.1)
      if (m.position.x > 520) m.position.x = -520
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

// Soft peaks standing in the haze beyond the ground, so its edge never shows.
function Backdrop() {
  const peaks = useMemo(() => {
    const r = rng(91)
    const list = []
    const peak = (x, z) => {
      const h = 70 + r() * 70
      return { x, z, h, rad: h * (1.3 + r() * 0.6) }
    }
    for (let z = -520; z <= 520; z += 80) for (const sx of [-1, 1]) list.push(peak(sx * (520 + r() * 80), z + (r() - 0.5) * 40))
    for (const sz of [-1, 1]) for (let x = -440; x <= 440; x += 80) list.push(peak(x + (r() - 0.5) * 40, sz * (480 + r() * 80)))
    return list.map((p, i) => {
      const main = facet(new THREE.ConeGeometry(p.rad, p.h, 5 + Math.floor(r() * 4), 1).translate(0, p.h / 2 - 10, 0), p.rad * 0.22, 200 + i, [1, 0.45, 1], (x, y) => y < -9)
      const sh = facet(new THREE.ConeGeometry(p.rad * 0.75, p.h * 0.62, 5 + Math.floor(r() * 3), 1).translate(p.rad * 0.6 * (r() - 0.5) * 2, (p.h * 0.62) / 2 - 10, p.rad * 0.6 * (r() - 0.5) * 2), p.rad * 0.16, 260 + i, [1, 0.45, 1], (x, y) => y < -9)
      return { ...p, g: mergeGeometries([main, sh]) }
    })
  }, [])
  useEffect(() => () => peaks.forEach((p) => p.g.dispose()), [peaks])
  return peaks.map((p, i) => (
    <mesh key={i} geometry={p.g} position={[p.x, -4, p.z]}>
      <meshStandardMaterial color={i % 3 ? '#7f9a78' : '#8792a6'} flatShading roughness={1} />
    </mesh>
  ))
}

export default function Circuit({ elevation = 30, azimuth = -50, exposure = 0.8, haze = 1, cars = 12, speed = 1, trees = 1, crowd = true, clouds = true, lead }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const sky = useMemo(() => makeSky({ turbidity: 5, rayleigh: 1.6, mie: 0.004, mieG: 0.8 }), [])
  useEffect(() => () => sky.dispose(), [sky])
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])
  const sunColor = useMemo(() => sunlight(elevation), [elevation])
  const fogColor = useMemo(() => new THREE.Color('#c9d7e4').lerp(new THREE.Color('#f1c39a'), (1 - sstep(4, 28, elevation)) * 0.8), [elevation])
  useEffect(() => {
    sky.update(gl, sunDir)
    sky.envTexture.needsPMREMUpdate = true
  }, [sky, gl, sunDir])
  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  useEffect(() => {
    scene.fog = new THREE.FogExp2(fogColor, 0.0009 * haze)
    return () => (scene.fog = null)
  }, [scene, fogColor, haze])

  const world = useMemo(() => ({ ground: buildGround(), flat: buildFlat(), ...buildProps(), tyre: tyreGeometry(), boardMap: boardTexture() }), [])
  useEffect(
    () => () => {
      for (const g of [world.ground, world.flat, world.solid, world.glass, world.fence, world.boards, world.tyre, world.boardMap]) g.dispose()
    },
    [world],
  )
  const tyres = useMemo(() => world.tyres.map((t) => ({ ...t, y: -0.02, c: t.c ? '#d8362d' : '#ecebe6' })), [world])
  const tyreMat = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), [])
  useEffect(() => () => tyreMat.dispose(), [tyreMat])

  const lightPos = useMemo(() => sunDir.clone().multiplyScalar(420), [sunDir])
  const sunI = 3.6 * sstep(-2, 8, elevation) + 0.4
  return (
    <group>
      <primitive object={sky.sky} />
      <hemisphereLight args={[fogColor, '#55703d', 0.95]} />
      <directionalLight position={lightPos} color={sunColor} intensity={sunI} castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0003} shadow-normalBias={0.35}>
        <orthographicCamera attach="shadow-camera" args={[-330, 330, 300, -300, 40, 900]} />
      </directionalLight>

      <mesh geometry={world.ground} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={world.flat} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.88} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={world.solid} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={world.glass}>
        <meshStandardMaterial vertexColors flatShading roughness={0.06} metalness={0.75} envMap={sky.envTexture} envMapIntensity={1.1} />
      </mesh>
      <mesh geometry={world.boards} castShadow>
        <meshStandardMaterial map={world.boardMap} roughness={0.6} />
      </mesh>
      <mesh geometry={world.fence} renderOrder={3}>
        <meshStandardMaterial vertexColors transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      {/* the pond in the infield */}
      <mesh position={[POND.x, -0.7, POND.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[POND.r + 2, 18]} />
        <meshStandardMaterial color="#3f8fb5" roughness={0.1} metalness={0.25} envMap={sky.envTexture} envMapIntensity={1.2} />
      </mesh>

      <Instances geometry={world.tyre} material={tyreMat} items={tyres} />
      <People crew={world.crew} crowd={world.crowd} showCrowd={crowd} />
      <Woods density={trees} />
      <Cars count={cars} speed={speed} lead={lead} envMap={sky.envTexture} />
      <StartLights at={world.startLights} />
      <Turbines />
      <Balloons />
      <Backdrop />
      <Clouds on={clouds} />
      {/* the far ground, the colour of the haze */}
      <mesh rotation-x={-Math.PI / 2} position-y={-8.5}>
        <circleGeometry args={[6000, 64]} />
        <meshBasicMaterial color={fogColor} />
      </mesh>
    </group>
  )
}
