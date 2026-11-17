import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makeSky, sunDirection, sunlight } from '../cloud/sun.js'
import { Instances, useLiveMaterial } from '../circuit/Circuit.jsx'
import { TEAMS, carGeometry, personGeometry, treeGeometry } from '../circuit/props.js'
import { sstep, wrap } from '../circuit/track.js'
import { rng } from '../lowpoly/kit.jsx'
import { TRACK as T } from './layout.js'
import { buildGround, buildPeaks, buildProps, buildSurfaces, scatterPines } from './world.js'

// The Alpine Ice Circuit: a closed lap marked out on a frozen lake, ringed by
// snowbanks, pine forest and mountains, with a timber chalet for the pit
// garages. A field of GT cars laps it on the racing line (slower through the
// corners than on tarmac would be, but they never lose it); the one you drive
// yourself does.

const RACERS = 12

// The field. Every car follows the same speed profile round the lap, a fixed
// time apart, so they brake and accelerate in the same places and never touch.
function Cars({ count, speed, lead, envMap }) {
  const geo = useMemo(carGeometry, [])
  useEffect(() => () => (geo.paint.dispose(), geo.trim.dispose()), [geo])
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
        phase: -Math.floor(i / 2) * (T.lap / (RACERS / 2)) - (i % 2) * 0.62,
        side: (i % 2 ? -1 : 1) * 0.9,
        color: TEAMS[(i >> 1) % TEAMS.length],
        dark: i % 2 === 1,
      })),
    [],
  )
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), p: {}, q: {}, c: new THREE.Color(), e: new THREE.Euler(0, 0, 0, 'YXZ') }), [])
  useEffect(() => {
    const { c } = tmp
    field.forEach((f, i) => a.current.setColorAt(i, c.set(f.color).multiplyScalar(f.dark ? 0.72 : 1)))
    a.current.instanceColor.needsUpdate = true
  }, [field, tmp])
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
      o.position.set(p.x, 0.06, p.z)
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
  return (
    <group>
      <instancedMesh ref={a} args={[geo.paint, paint, RACERS]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={b} args={[geo.trim, trim, RACERS]} castShadow receiveShadow frustumCulled={false} />
    </group>
  )
}

// Flakes that fall in a box round the camera and wrap as it moves.
function Snowfall({ amount }) {
  const ref = useRef()
  const camera = useThree((s) => s.camera)
  const COUNT = 4500
  const BOX = 110
  const DEPTH = 80
  const data = useMemo(() => {
    const r = rng(5)
    const pos = new Float32Array(COUNT * 3)
    const fall = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (r() - 0.5) * 2 * BOX
      pos[i * 3 + 1] = r() * DEPTH
      pos[i * 3 + 2] = (r() - 0.5) * 2 * BOX
      fall[i] = 1.6 + r() * 2.2
    }
    return { pos, fall }
  }, [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3))
    return g
  }, [data])
  useEffect(() => () => geo.dispose(), [geo])
  const placed = useRef(false)
  useFrame(({ clock }, dt) => {
    const pts = ref.current
    if (!pts) return
    const { pos, fall } = data
    const c = camera.position
    dt = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    if (!placed.current) {
      // first frame: drop the whole box where the camera is
      for (let i = 0; i < COUNT; i++) {
        pos[i * 3] += c.x
        pos[i * 3 + 1] += c.y - 20
        pos[i * 3 + 2] += c.z
      }
      placed.current = true
    }
    for (let i = 0; i < COUNT; i++) {
      const k = i * 3
      pos[k] += (0.9 + Math.sin(t * 0.7 + i) * 0.5) * dt
      pos[k + 1] -= fall[i] * dt
      pos[k + 2] += Math.cos(t * 0.5 + i * 1.7) * 0.35 * dt
      if (pos[k] < c.x - BOX) pos[k] += 2 * BOX
      else if (pos[k] > c.x + BOX) pos[k] -= 2 * BOX
      if (pos[k + 2] < c.z - BOX) pos[k + 2] += 2 * BOX
      else if (pos[k + 2] > c.z + BOX) pos[k + 2] -= 2 * BOX
      if (pos[k + 1] < c.y - 25) pos[k + 1] += DEPTH
      else if (pos[k + 1] > c.y - 25 + DEPTH) pos[k + 1] -= DEPTH
    }
    geo.attributes.position.needsUpdate = true
    geo.setDrawRange(0, Math.round(COUNT * Math.min(1, amount / 2)))
  })
  if (amount <= 0) return null
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={0.34} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}

// A ring of snow-capped mountains, plus the far white ground under them.
function Peaks() {
  const peaks = useMemo(buildPeaks, [])
  useEffect(() => () => peaks.forEach((p) => (p.rock.dispose(), p.cap.dispose())), [peaks])
  return peaks.map((p, i) => (
    <group key={i} position={[p.x, -4, p.z]}>
      <mesh geometry={p.rock}>
        <meshStandardMaterial color={i % 3 ? '#a6b3c4' : '#97a6ba'} flatShading roughness={1} />
      </mesh>
      <mesh geometry={p.cap}>
        <meshStandardMaterial color="#f4f8fb" flatShading roughness={1} />
      </mesh>
    </group>
  ))
}

// Floodlights along the outside: lit only when the sun is down.
function Floodlights({ masts, night }) {
  const refs = useRef([])
  const used = useMemo(() => masts.filter((_, i) => i % 2 === 0), [masts])
  useEffect(() => {
    refs.current.forEach((l, i) => {
      if (!l) return
      l.target.position.set(...used[i].to)
      l.target.updateMatrixWorld()
    })
  }, [used])
  return used.map((m, i) => (
    <spotLight key={i} ref={(el) => (refs.current[i] = el)} position={m.at} angle={0.85} penumbra={0.8} intensity={520 * night} distance={190} decay={1.4} color="#fff1d2" visible={night > 0.05} />
  ))
}

export default function Alpine({ elevation = 14, azimuth = -60, exposure = 1.0, haze = 0.8, cars = 12, speed = 1, trees = 1, crowd = true, snow = 0.4, drive = false, lead }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const sky = useMemo(() => makeSky({ turbidity: 2.2, rayleigh: 1.1, mie: 0.003, mieG: 0.8 }), [])
  useEffect(() => () => sky.dispose(), [sky])
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])
  const sunColor = useMemo(() => sunlight(elevation), [elevation])
  const night = 1 - sstep(-3, 7, elevation)
  const fogColor = useMemo(() => {
    const day = new THREE.Color('#cddceb').lerp(new THREE.Color('#f2cfb4'), (1 - sstep(3, 16, elevation)) * 0.7)
    return day.lerp(new THREE.Color('#0d1626'), night)
  }, [elevation, night])
  useEffect(() => {
    sky.update(gl, sunDir)
    sky.envTexture.needsPMREMUpdate = true
  }, [sky, gl, sunDir])
  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  useEffect(() => {
    scene.fog = new THREE.FogExp2(fogColor, 0.0011 * haze)
    return () => (scene.fog = null)
  }, [scene, fogColor, haze])
  // the car wants something to reflect; only turned on while driving
  useEffect(() => {
    if (!drive) return
    scene.environment = sky.envTexture
    scene.environmentIntensity = 0.4
    return () => {
      scene.environment = null
    }
  }, [scene, sky, drive])

  const ground = useMemo(buildGround, [])
  const surf = useMemo(buildSurfaces, [])
  const props = useMemo(buildProps, [])
  const geo = useMemo(() => {
    const t = treeGeometry()
    ;[t.leaf, t.leafTrunk, t.bush].forEach((g) => g.dispose())
    return { pine: t.pine, trunk: t.pineTrunk, person: personGeometry() }
  }, [])
  useEffect(
    () => () => {
      for (const g of [ground, surf.ice, surf.flat, props.solid, props.glass, props.lamps, geo.pine, geo.trunk, geo.person]) g.dispose()
    },
    [ground, surf, props, geo],
  )
  const pines = useMemo(() => scatterPines(Math.round(9000 * trees), 31), [trees])
  const [crown] = useLiveMaterial('tree')
  const [trunk] = useLiveMaterial('tree', '#4a3626')
  const [people] = useLiveMaterial('people')
  const lampMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), [])
  useEffect(() => () => lampMat.dispose(), [lampMat])
  useEffect(() => {
    lampMat.color.setScalar(0.9 + 6 * night)
  }, [lampMat, night])

  const lightPos = useMemo(() => sunDir.clone().multiplyScalar(420), [sunDir])
  const sunI = 3.4 * sstep(-2, 8, elevation) + 0.1
  return (
    <group>
      <primitive object={sky.sky} />
      <hemisphereLight args={[fogColor, '#9fb2c6', 1.0 - 0.7 * night]} />
      <directionalLight position={[-120, 300, 200]} color="#8fa8d8" intensity={0.55 * night} />
      <directionalLight position={lightPos} color={sunColor} intensity={sunI} castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0003} shadow-normalBias={0.35}>
        <orthographicCamera attach="shadow-camera" args={[-340, 340, 260, -260, 40, 900]} />
      </directionalLight>
      <Floodlights masts={props.masts} night={night} />

      <mesh geometry={ground} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.96} />
      </mesh>
      <mesh geometry={surf.flat} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.9} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={surf.ice} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.14} metalness={0.06} envMap={sky.envTexture} envMapIntensity={1.15} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
      <mesh geometry={props.solid} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={props.glass}>
        <meshStandardMaterial vertexColors flatShading roughness={0.06} metalness={0.75} envMap={sky.envTexture} envMapIntensity={1.1} />
      </mesh>
      <mesh geometry={props.lamps} material={lampMat} />

      <Instances geometry={geo.pine} material={crown} items={pines} />
      <Instances geometry={geo.trunk} material={trunk} items={pines} tint={false} cast={false} />
      {crowd && <Instances geometry={geo.person} material={people} items={props.crowd} cast={false} />}
      <Cars count={cars} speed={speed} lead={lead} envMap={sky.envTexture} />
      <Snowfall amount={snow} />
      <Peaks />
      {/* the far ground, the colour of the haze */}
      <mesh rotation-x={-Math.PI / 2} position-y={-9}>
        <circleGeometry args={[6000, 64]} />
        <meshBasicMaterial color={fogColor} />
      </mesh>
    </group>
  )
}
