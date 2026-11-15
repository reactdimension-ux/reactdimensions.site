import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makeSky, sunDirection, sunlight } from '../cloud/sun.js'
import { cloudFragment, cloudVertex, foliageMaterial } from '../valley/shaders.js'
import { barkTextures, bladeGeometry, broadleaf, bush, leafTexture, puffTexture } from '../valley/trees.js'
import { CH, CW, FARM, LANE_W, T, VIEW, YARD_R, buildCells, buildFar, buildNear, cellAt, hedgeRuns, heightAt, laneDist, laneX, rng, scatter, slopeAt, sstep } from './land.js'
import { baleGeometry, flowerHeadGeometry, hedgeGeometry, sheepGeometry, wheatGeometry } from './props.js'
import { buildingMaterial, groundMaterial, hedgeMaterial, strawMaterial, woolMaterial } from './shaders.js'

// Rolling English farmland drawn for realism: the viewer stands in a hay
// meadow full of wild flowers on a rise, a field of ripe wheat at their
// side, looking out over a vale of hedged fields (wheat, barley, oilseed
// rape, plough, mown hay with round bales, young crops, pasture with sheep)
// to wooded hills and a far line of downs. A gravel lane runs down past a
// stone farmhouse and a tarred barn, smoke rising from the chimney. The
// light is a physical sky: it lights the scene (image-based), casts the
// sun's shadows and tints the haze that blues the distance.

// ---------------------------------------------------------------- helpers

const o3 = new THREE.Object3D()
const tint = new THREE.Color()

function useDispose(...things) {
  useEffect(() => () => things.forEach((t) => t && t.dispose && t.dispose()), things) // eslint-disable-line react-hooks/exhaustive-deps
}

// An instanced mesh whose instances come from a list of placements.
function Instanced({ geometry, material, items, colors, cast = true, receive = true }) {
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
      if (colors) m.setColorAt(i, tint.set(it.color || colors[i % colors.length]).multiplyScalar(it.c ?? 1))
    })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, colors, geometry])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={cast} receiveShadow={receive} frustumCulled={false} />
}

const edgeOf = (c) => Math.min(c.fu, CW - c.fu, c.fv, CH - c.fv)
const distView = (x, z) => Math.hypot(x - VIEW.x, z - VIEW.z)

// Where the meadow's front boundary lies straight ahead: a gate goes there.
function findGate() {
  const home = cellAt(VIEW.x, VIEW.z)
  const cross = (x0) => {
    for (let z = VIEW.z; z > VIEW.z - 300; z -= 0.25) {
      const c = cellAt(x0, z)
      if (c.i !== home.i || c.j !== home.j) return [x0, z]
    }
    return [x0, VIEW.z - 300]
  }
  const a = cross(VIEW.x - 4)
  const b = cross(VIEW.x + 4)
  const m = cross(VIEW.x)
  return { x: m[0], z: m[1], ry: -Math.atan2(b[1] - a[1], b[0] - a[0]) }
}

// ---------------------------------------------------------------- hedges & trees

const LEAF_TINTS = ['#ffffff', '#e8f2c8', '#f4f0c0', '#d8e8d0', '#fff2d0', '#cfe0b0']

function Hedgerows({ runs, U, setHidden, trees, cells }) {
  const geo = useMemo(() => hedgeGeometry(runs), [runs])
  const mat = useMemo(() => hedgeMaterial(U), [U])
  useDispose(geo, mat)

  const tex = useMemo(() => ({ leaf: leafTexture(3, 96), leaf2: leafTexture(8, 82), oak: leafTexture(14, 74), ...barkTextures(9) }), [])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])
  const mats = useMemo(() => {
    const leafParams = { alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.72 }
    return {
      bark: foliageMaterial({ map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.95, color: '#a59684' }, U, { flutter: 0, translucent: false, crownNormals: false }),
      leaf: foliageMaterial({ ...leafParams, map: tex.leaf }, U, { flutter: 1 }),
      leaf2: foliageMaterial({ ...leafParams, map: tex.oak }, U, { flutter: 1 }),
      bush: foliageMaterial({ ...leafParams, map: tex.leaf2 }, U, { flutter: 1, bend: 1, amp: 0.04 }),
    }
  }, [tex, U])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  const species = useMemo(() => ({ broad: [broadleaf(11, { height: 7 }), broadleaf(23, { height: 6, spread: 1.3 }), broadleaf(37, { height: 8, spread: 0.95 })], bush: [bush(7), bush(13, { size: 1.6 })] }), [])
  useEffect(
    () => () =>
      Object.values(species)
        .flat()
        .forEach((s) => Object.values(s).forEach((g) => g.dispose())),
    [species],
  )

  const plant = useMemo(() => {
    const r = rng(9)
    const broad = [[], [], []]
    const bushes = [[], []]
    const add = (list, x, z, s, sink = 0.15) => list.push({ x, y: heightAt(x, z) - sink, z, ry: r() * Math.PI * 2, rx: (r() - 0.5) * 0.05, rz: (r() - 0.5) * 0.05, sx: s, sy: s * (0.9 + r() * 0.2), sz: s, c: 0.85 + r() * 0.25 })
    // trees standing in the hedge lines, and bushes breaking up the near ones
    for (const run of runs) {
      let last = -99
      run.forEach(([x, z], k) => {
        const d = distView(x, z)
        if (d < 900 * trees && d > 80 && k - last > 8 && r() < 0.07) {
          last = k
          add(broad[Math.floor(r() * 3)], x, z, 1.4 + r() * 0.8)
        }
        if (d < 230 && r() < 0.8) {
          const H = 0.9 + r() * 0.5
          add(bushes[Math.floor(r() * 2)], x + (r() - 0.5) * 1.2, z + (r() - 0.5) * 1.2, H, 0.3)
        }
      })
    }
    // a few big oaks standing alone in the pastures
    scatter(Math.round(10 * trees), 33, [VIEW.x - 600, VIEW.x + 600, VIEW.z - 800, VIEW.z - 60], (x, z) => {
      const c = cellAt(x, z)
      return cells.type(c.i, c.j) === T.pasture && edgeOf(c) > 18 && laneDist(x, z) > 12 && Math.hypot(x - FARM.x, z - FARM.z) > 60
    }).forEach((p) => add(broad[1], p.x, p.z, 1.9 + p.r * 0.6))
    // the woods: a canopy of trees over whole fields
    scatter(Math.round(1000 * trees), 34, [VIEW.x - 1100, VIEW.x + 1100, VIEW.z - 1150, VIEW.z + 200], (x, z) => {
      if (distView(x, z) > 1100) return false
      const c = cellAt(x, z)
      return cells.type(c.i, c.j) === T.woods && edgeOf(c) > 2 && heightAt(x, z) < 200
    }).forEach((p) => add(broad[Math.floor(p.r * 3)], p.x, p.z, 1.5 + p.r * 0.7))
    return { broad, bushes }
  }, [runs, trees, cells])

  const ref = useRef()
  useEffect(() => void setHidden('bushes', ref.current), [setHidden])
  return (
    <group>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      {species.broad.map((g, i) => (
        <group key={'b' + i}>
          <Instanced geometry={g.bark} material={mats.bark} items={plant.broad[i]} />
          <Instanced geometry={g.leaves} material={i === 1 ? mats.leaf2 : mats.leaf} items={plant.broad[i]} colors={LEAF_TINTS} />
        </group>
      ))}
      <group ref={ref}>
        {species.bush.map((g, i) => (
          <Instanced key={'s' + i} geometry={g.leaves} material={mats.bush} items={plant.bushes[i]} colors={LEAF_TINTS} />
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- grass, flowers, wheat

const GRASS_TINTS = ['#4d7a1e', '#5f8a26', '#3f6b1c', '#7a8f34', '#6b8e2a', '#8f9a45', '#456f22', '#9a9a50']
const FLOWERS = ['#c8231b', '#d42a1e', '#f2f0e6', '#f4f2ea', '#f0c419', '#e8b810', '#4a6fd8', '#a24a9a', '#e7a3c0']
const WHEAT_TINTS = ['#c9a35a', '#d4ad62', '#bf9850', '#d8b56c', '#c49a52']

function Meadow({ amount, U, cells, setHidden }) {
  const geo = useMemo(() => {
    // lit like the ground they grow from, so seen from above the blades do
    // not catch the sky at a grazing angle and read pale against the turf
    const blade = bladeGeometry()
    const n = blade.attributes.normal
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.93, -0.37)
    return { blade, head: flowerHeadGeometry(), wheat: wheatGeometry() }
  }, [])
  const mats = useMemo(
    () => ({
      grass: foliageMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }, U, { flutter: 0, bend: 2, amp: 0.16 }),
      head: foliageMaterial({ side: THREE.DoubleSide, roughness: 0.6 }, U, { flutter: 0, bend: 2, amp: 0.16 }),
      wheat: foliageMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75 }, U, { flutter: 0, bend: 2, amp: 0.1 }),
    }),
    [U],
  )
  useDispose(geo.blade, geo.head, geo.wheat, mats.grass, mats.head, mats.wheat)

  const items = useMemo(() => {
    const r = rng(404)
    const grass = []
    const stems = []
    const heads = []
    const wheat = []
    const N = Math.round(120000 * amount)
    for (let n = 0; n < N * 3 && grass.length < N; n++) {
      // blades gather where the viewer can see them: close by, thinning outward
      const a = r() * Math.PI * 2
      const d = 1.5 + Math.pow(r(), 1.7) * 150
      const x = VIEW.x + Math.cos(a) * d
      const z = VIEW.z + Math.sin(a) * d
      const c = cellAt(x, z)
      const t = cells.type(c.i, c.j)
      const e = edgeOf(c)
      const lane = laneDist(x, z)
      if (lane < LANE_W - 0.2 && Math.abs(lane - 0.0) > 0.35) continue
      const verge = lane < LANE_W + 2.6
      const grassy = t === T.pasture || t === T.meadow || verge || (e < 2.8 && t !== T.woods)
      if (!grassy || e < 1.3) continue
      if (Math.hypot(x - FARM.x, z - FARM.z) < YARD_R) continue
      const y = heightAt(x, z)
      const meadow = t === T.meadow || verge || t !== T.pasture
      const clump = (Math.sin(x * 0.7) * Math.sin(z * 0.9) + 1) / 2
      const tall = (meadow ? 0.28 + clump * 0.3 + r() * r() * 0.35 : 0.14 + clump * 0.14 + r() * 0.1) * (0.45 + 0.55 * sstep(2, 12, d))
      const s = 0.8 + r() * 0.5
      grass.push({ x, y: y - 0.05, z, ry: r() * Math.PI * 2, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5, sx: s, sy: tall, sz: s, c: 0.75 + r() * 0.45 })
      // wild flowers through the meadow and along the verges
      if (meadow && d < 80 && r() < (t === T.meadow ? 0.12 : 0.05)) {
        const sh = 0.35 + r() * 0.45
        const color = FLOWERS[Math.floor(r() * FLOWERS.length)]
        const k = 0.8 + r() * 0.7
        stems.push({ x, y: y - 0.03, z, ry: r() * 6.28, sx: 0.45, sy: sh, sz: 0.45, c: 0.8 })
        heads.push({ x, y: y - 0.03, z, ry: r() * 6.28, rx: (r() - 0.5) * 0.3, sx: k, sy: sh, sz: k, color, c: 0.9 + r() * 0.2 })
      }
    }
    // the wheat field beside the meadow
    const W = Math.round(34000 * amount)
    for (let n = 0; n < W * 6 && wheat.length < W; n++) {
      const x = VIEW.x - 30 + r() * 150
      const z = VIEW.z - 140 + r() * 150
      const d = distView(x, z)
      if (d > 95 || d < 3 || r() > 1 - sstep(45, 95, d)) continue
      const c = cellAt(x, z)
      if (cells.type(c.i, c.j) !== T.wheat || edgeOf(c) < 3) continue
      const s = 0.9 + r() * 0.25
      wheat.push({ x, y: heightAt(x, z) - 0.05, z, ry: r() * 6.28, rx: (r() - 0.5) * 0.12, rz: (r() - 0.5) * 0.12, sx: s, sy: 0.9 + r() * 0.2, sz: s, c: 0.85 + r() * 0.25 })
    }
    return { grass, stems, heads, wheat }
  }, [amount, cells])

  const ref = useRef()
  useEffect(() => void setHidden('grass', ref.current), [setHidden, items])
  return (
    <group ref={ref}>
      <Instanced geometry={geo.blade} material={mats.grass} items={items.grass} colors={GRASS_TINTS} cast={false} />
      <Instanced geometry={geo.blade} material={mats.grass} items={items.stems} colors={['#3f6b1c']} cast={false} />
      <Instanced geometry={geo.head} material={mats.head} items={items.heads} colors={FLOWERS} cast={false} />
      <Instanced geometry={geo.wheat} material={mats.wheat} items={items.wheat} colors={WHEAT_TINTS} cast={false} />
    </group>
  )
}

// ---------------------------------------------------------------- sheep & bales

function Livestock({ cells, show }) {
  const geo = useMemo(() => ({ graze: sheepGeometry('graze'), stand: sheepGeometry('stand'), lie: sheepGeometry('lie'), bale: baleGeometry() }), [])
  const mats = useMemo(() => ({ wool: woolMaterial(), straw: strawMaterial() }), [])
  useDispose(geo.graze, geo.stand, geo.lie, geo.bale, mats.wool, mats.straw)
  const flocks = useMemo(() => {
    const r = rng(71)
    const out = { graze: [], stand: [], lie: [] }
    const centres = scatter(7, 72, [VIEW.x - 500, VIEW.x + 500, VIEW.z - 700, VIEW.z - 40], (x, z) => {
      const c = cellAt(x, z)
      return cells.type(c.i, c.j) === T.pasture && edgeOf(c) > 14 && laneDist(x, z) > 10 && Math.hypot(x - FARM.x, z - FARM.z) > YARD_R + 15 && slopeAt(x, z) < 0.35
    })
    for (const ctr of centres) {
      const home = cellAt(ctr.x, ctr.z)
      const n = 10 + Math.floor(r() * 16)
      for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * 24
        const x = ctr.x + Math.cos(a) * d
        const z = ctr.z + Math.sin(a) * d
        const c = cellAt(x, z)
        if (c.i !== home.i || c.j !== home.j || edgeOf(c) < 3) continue
        const p = r()
        const pose = p < 0.6 ? 'graze' : p < 0.85 ? 'stand' : 'lie'
        const s = 0.9 + r() * 0.2
        out[pose].push({ x, y: heightAt(x, z) - 0.03, z, ry: r() * Math.PI * 2, sx: s, sy: s, sz: s })
        k++
      }
    }
    return out
  }, [cells])
  const bales = useMemo(() => {
    const out = []
    scatter(140, 81, [VIEW.x - 700, VIEW.x + 700, VIEW.z - 800, VIEW.z - 20], (x, z) => {
      const c = cellAt(x, z)
      return cells.type(c.i, c.j) === T.hay && edgeOf(c) > 7
    }).forEach((p) => out.push({ x: p.x, y: heightAt(p.x, p.z) - 0.08, z: p.z, ry: p.r * 6.28, rx: 0, sx: 1, sy: 1, sz: 1 }))
    return out
  }, [cells])
  return (
    <group>
      {show && (
        <>
          <Instanced geometry={geo.graze} material={mats.wool} items={flocks.graze} />
          <Instanced geometry={geo.stand} material={mats.wool} items={flocks.stand} />
          <Instanced geometry={geo.lie} material={mats.wool} items={flocks.lie} />
        </>
      )}
      <Instanced geometry={geo.bale} material={mats.straw} items={bales} />
    </group>
  )
}

// ---------------------------------------------------------------- the farm

function Building({ x, z, rot, w, d, wallH, roofH, wall, roof, windows = [], doors = [], chimneys = [], smoke = false, wind }) {
  const y = heightAt(x, z)
  const geo = useMemo(() => {
    const gable = new THREE.Shape()
    gable.moveTo(-d / 2, 0)
    gable.lineTo(d / 2, 0)
    gable.lineTo(0, roofH)
    gable.closePath()
    const pitch = Math.atan2(roofH, d / 2)
    const slope = Math.hypot(d / 2 + 0.45, roofH + 0.45 * Math.tan(pitch))
    return {
      walls: new THREE.BoxGeometry(w, wallH + 2, d).translate(0, (wallH - 2) / 2, 0),
      gable: new THREE.ExtrudeGeometry(gable, { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2).rotateY(Math.PI / 2).translate(0, wallH, 0),
      slab: new THREE.BoxGeometry(w + 0.6, 0.14, slope),
      pitch,
      slope,
    }
  }, [w, d, wallH, roofH])
  useDispose(geo.walls, geo.gable, geo.slab)
  const smokeRefs = useRef([])
  const puff = useMemo(() => puffTexture(), [])
  useDispose(puff)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    smokeRefs.current.forEach((s, i) => {
      if (!s) return
      const u = (t * 0.12 + i / 10) % 1
      s.position.set(u * u * 6 * (0.4 + wind), u * 9, u * 1.5)
      s.scale.setScalar(0.8 + u * 5)
      s.material.opacity = 0.32 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u)
    })
  })
  const { pitch } = geo
  const mid = (d / 2 + 0.45) / 2
  const ymid = wallH + (roofH - 0.45 * Math.tan(pitch)) / 2 + 0.07 / Math.cos(pitch)
  return (
    <group position={[x, y, z]} rotation-y={rot}>
      <mesh geometry={geo.walls} material={wall} castShadow receiveShadow />
      <mesh geometry={geo.gable} material={wall} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.slab} material={roof} position={[0, ymid, s * mid]} rotation-x={s * pitch} castShadow receiveShadow />
      ))}
      {chimneys.map(([cx, ch], i) => (
        <group key={i} position={[cx, wallH + roofH, 0]}>
          <mesh material={wall} position-y={ch / 2 - 0.6} castShadow>
            <boxGeometry args={[0.9, ch + 1.2, 1.1]} />
          </mesh>
          <mesh position-y={ch - 0.05}>
            <cylinderGeometry args={[0.13, 0.15, 0.35, 10]} />
            <meshStandardMaterial color="#6e4434" roughness={0.9} />
          </mesh>
          {smoke && i === 0 && (
            <group position-y={ch + 0.2}>
              {Array.from({ length: 10 }, (_, k) => (
                <sprite key={k} ref={(el) => (smokeRefs.current[k] = el)}>
                  <spriteMaterial map={puff} color="#c9c6c0" transparent depthWrite={false} opacity={0} />
                </sprite>
              ))}
            </group>
          )}
        </group>
      ))}
      {windows.map(([wx, wy, side, ww = 0.9, wh = 1.2], i) => (
        <group key={i} position={[wx, wy, (side * d) / 2]}>
          <mesh position-z={side * 0.03}>
            <boxGeometry args={[ww + 0.16, wh + 0.16, 0.06]} />
            <meshStandardMaterial color="#e8e4da" roughness={0.6} />
          </mesh>
          <mesh position-z={side * 0.065}>
            <boxGeometry args={[ww, wh, 0.02]} />
            <meshStandardMaterial color="#141a20" roughness={0.05} metalness={0.1} envMapIntensity={1.4} />
          </mesh>
          <mesh position-z={side * 0.08}>
            <boxGeometry args={[0.05, wh, 0.02]} />
            <meshStandardMaterial color="#e8e4da" roughness={0.6} />
          </mesh>
          <mesh position-z={side * 0.08}>
            <boxGeometry args={[ww, 0.05, 0.02]} />
            <meshStandardMaterial color="#e8e4da" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {doors.map(([dx, side, dw, dh, color], i) => (
        <mesh key={i} position={[dx, dh / 2, (side * d) / 2 + side * 0.04]} castShadow>
          <boxGeometry args={[dw, dh, 0.08]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function Farm({ wind }) {
  const mats = useMemo(() => ({ stone: buildingMaterial('stone'), boards: buildingMaterial('boards'), slate: buildingMaterial('slate'), iron: buildingMaterial('iron') }), [])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  // square to the lane
  const rot = Math.atan2(40, laneX(FARM.z - 20) - laneX(FARM.z + 20))
  const at = (lx, lz) => [FARM.x + lx * Math.cos(rot) + lz * Math.sin(rot), FARM.z - lx * Math.sin(rot) + lz * Math.cos(rot)]
  const [hx, hz] = at(-6, 8)
  const [bx, bz] = at(12, -12)
  const [sx, sz] = at(-14, -14)
  return (
    <group>
      <Building
        x={hx}
        z={hz}
        rot={rot}
        w={11}
        d={6.6}
        wallH={5.4}
        roofH={3.1}
        wall={mats.stone}
        roof={mats.slate}
        smoke
        wind={wind}
        chimneys={[
          [-5.1, 1.6],
          [5.1, 1.6],
        ]}
        windows={[
          [-3.4, 1.4, 1],
          [3.4, 1.4, 1],
          [-3.4, 4.1, 1],
          [0, 4.1, 1],
          [3.4, 4.1, 1],
          [-2.5, 1.4, -1],
          [2.5, 4.1, -1],
        ]}
        doors={[[0, 1, 1.05, 2.15, '#2f4a3a']]}
      />
      <Building x={bx} z={bz} rot={rot + Math.PI / 2} w={20} d={10} wallH={6} roofH={3.8} wall={mats.boards} roof={mats.iron} doors={[[0, 1, 4.4, 4.6, '#1d1a17'], [6, 1, 1.0, 2.1, '#1d1a17']]} wind={wind} />
      <Building x={sx} z={sz} rot={rot} w={9} d={5} wallH={3.2} roofH={1.8} wall={mats.stone} roof={mats.iron} doors={[[-2, 1, 1.0, 2.0, '#3a2a1e'], [2, 1, 1.0, 2.0, '#3a2a1e']]} wind={wind} />
    </group>
  )
}

// A five-bar gate in the meadow's hedge, hung on two oak posts.
function Gate({ gate }) {
  const tex = useMemo(() => barkTextures(41), [])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])
  const post = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, color: '#9a8a76', roughness: 0.95 }), [tex])
  const rail = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8f8576', roughness: 0.9 }), [])
  useDispose(post, rail)
  const y = heightAt(gate.x, gate.z)
  const W = 3.6
  return (
    <group position={[gate.x, y, gate.z]} rotation-y={gate.ry}>
      {[-W / 2 - 0.12, W / 2 + 0.12].map((x) => (
        <mesh key={x} material={post} position={[x, 0.55, 0]} castShadow>
          <boxGeometry args={[0.2, 1.7, 0.2]} />
        </mesh>
      ))}
      {/* the gate stands a little open */}
      <group position={[-W / 2, 0, 0]} rotation-y={-0.5}>
        {[0.25, 0.48, 0.71, 0.94, 1.17].map((ry) => (
          <mesh key={ry} material={rail} position={[W / 2, ry, 0]} castShadow>
            <boxGeometry args={[W, 0.09, 0.05]} />
          </mesh>
        ))}
        {[0.06, W / 2, W - 0.06].map((x) => (
          <mesh key={x} material={rail} position={[x, 0.7, 0]} castShadow>
            <boxGeometry args={[0.1, 1.05, 0.06]} />
          </mesh>
        ))}
        <mesh material={rail} position={[W * 0.27, 0.71, 0.01]} rotation-z={Math.atan2(0.92, W * 0.5)} castShadow>
          <boxGeometry args={[Math.hypot(W * 0.5, 0.92), 0.08, 0.05]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- clouds

function Clouds({ U, wind }) {
  const camera = useThree((s) => s.camera)
  const tex = useMemo(() => puffTexture(), [])
  const { geo, puffs } = useMemo(() => {
    const r = rng(55)
    // fair-weather cumulus scattered over the vale and the downs
    const spots = [
      [-900, 900, -1700, 1.3],
      [700, 980, -2100, 1.5],
      [-2300, 1000, -2900, 1.7],
      [2100, 950, -3200, 1.6],
      [200, 1100, -3800, 1.9],
      [-1400, 1050, 300, 1.5],
      [1600, 950, -800, 1.4],
      [-300, 1200, -5200, 2.2],
      [2900, 1050, -1500, 1.6],
      [-3000, 1100, -1200, 1.7],
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
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: null }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uSkyColor: { value: new THREE.Color() }, uShadowColor: { value: new THREE.Color() }, uOpacity: { value: 0.95 } }]),
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
    const off = geo.attributes.aOffset
    const pa = geo.attributes.aPuff
    const cp = camera.position
    const span = 7000
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

export default function Country({ elevation = 30, azimuth = -62, exposure = 0.55, haze = 1, trees = 1, grass = 1, wind = 1, sheep = true, clouds = true }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const cells = useMemo(() => buildCells(), [])
  const cellTex = useMemo(() => {
    const t = new THREE.DataTexture(cells.data, cells.N, cells.N, THREE.RGBAFormat)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.needsUpdate = true
    return t
  }, [cells])
  useDispose(cellTex)

  const U = useMemo(
    () => ({
      uTime: { value: 0 },
      uWind: { value: 1 },
      uCells: { value: null },
      uSunView: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color() },
      uSkyColor: { value: new THREE.Color() },
    }),
    [],
  )
  U.uCells.value = cellTex
  const hidden = useRef({})
  const setHidden = useMemo(() => (k, o) => (hidden.current[k] = o), [])

  // sky, sun and the light the sky itself throws
  const sky = useMemo(() => makeSky({ turbidity: 3, rayleigh: 1.3, mie: 0.004, mieG: 0.82 }), [])
  useEffect(() => () => sky.dispose(), [sky])
  const pmrem = useMemo(() => new THREE.PMREMGenerator(gl), [gl])
  useEffect(() => () => pmrem.dispose(), [pmrem])
  const sunDir = useMemo(() => sunDirection(elevation, azimuth), [elevation, azimuth])
  const sunColor = useMemo(() => sunlight(elevation), [elevation])
  const fogColor = useMemo(() => {
    const low = 1 - sstep(3, 25, elevation)
    return new THREE.Color('#b4c6d8').lerp(new THREE.Color('#ecbd92'), low * 0.75).multiplyScalar(0.55 + 0.45 * sstep(-2, 15, elevation))
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
    scene.fog = new THREE.FogExp2(fogColor, 0.00026 * haze)
    return () => (scene.fog = null)
  }, [scene, fogColor, haze])

  // the land, its fields and hedges
  const near = useMemo(() => buildNear(), [])
  const far = useMemo(() => buildFar(), [])
  const ground = useMemo(() => groundMaterial(U), [U])
  useDispose(near, far, ground)
  const gate = useMemo(() => findGate(), [])
  const runs = useMemo(() => {
    // leave a gap in the meadow's hedge for the gate
    return hedgeRuns(cells).flatMap((run) => {
      const out = [[]]
      run.forEach((p) => (Math.hypot(p[0] - gate.x, p[1] - gate.z) < 2.6 ? out.push([]) : out[out.length - 1].push(p)))
      return out.filter((r) => r.length > 2)
    })
  }, [cells, gate])

  // Nothing that casts a shadow moves enough to show in one, so the shadow
  // map is drawn only when the light or the planting changes.
  const shadowFrames = useRef(0)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    shadowFrames.current = 30
    return () => void (gl.shadowMap.autoUpdate = true)
  }, [gl, sunDir, trees, grass, sheep])

  useFrame(({ clock }) => {
    if (shadowFrames.current > 0) {
      shadowFrames.current--
      gl.shadowMap.needsUpdate = true
    }
    U.uTime.value = clock.elapsedTime
    U.uWind.value = wind
    U.uSunDir.value.copy(sunDir)
    U.uSunColor.value.copy(sunColor)
    U.uSkyColor.value.copy(fogColor)
    U.uSunView.value.copy(sunDir).transformDirection(camera.matrixWorldInverse)
  })

  const lightTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(10, 0, -110)
    return o
  }, [])
  const lightPos = useMemo(() => sunDir.clone().multiplyScalar(600).add(lightTarget.position), [sunDir, lightTarget])
  const sunI = 4.2 * sstep(-2, 10, elevation) + 0.2

  return (
    <group>
      <primitive object={sky.sky} />
      <primitive object={lightTarget} />
      <hemisphereLight args={['#bcd3ea', '#4a5a2a', 0.25]} />
      <directionalLight position={lightPos} target={lightTarget} color={sunColor} intensity={sunI} castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.35}>
        <orthographicCamera attach="shadow-camera" args={[-260, 260, 260, -260, 50, 1400]} />
      </directionalLight>
      <mesh geometry={near} material={ground} receiveShadow castShadow />
      <mesh geometry={far} material={ground} receiveShadow />
      <Hedgerows runs={runs} U={U} setHidden={setHidden} trees={trees} cells={cells} />
      {grass > 0 && <Meadow amount={grass} U={U} cells={cells} setHidden={setHidden} />}
      <Livestock cells={cells} show={sheep} />
      <Farm wind={wind} />
      <Gate gate={gate} />
      {clouds && <Clouds U={U} wind={wind} />}
      {/* beyond the land's edge, the colour of the haze */}
      <mesh rotation-x={-Math.PI / 2} position-y={-8}>
        <circleGeometry args={[30000, 64]} />
        <meshBasicMaterial color={fogColor} />
      </mesh>
    </group>
  )
}
