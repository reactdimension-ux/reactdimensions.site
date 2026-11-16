import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, TAU, Water, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly wishing well: a round wall of faceted stones in two courses
// (the upper course laid half a stone over), dark water inside with a few
// glints twinkling on it, two wooden posts holding a little gabled roof, and
// a winch between them: an axle with a drum of wound rope and a crank on one
// side, its rope hanging down to a wooden bucket with iron bands. Left
// alone, the bucket bobs gently on its rope and the rope sways. Tap it and
// a coin flips in from the front, tumbling end over end, drops into the
// water and splashes: rings spread across the water, drops fly up, and a
// warm glow rises out of the well with a drift of sparkles: a wish.

const LOOKS = {
  stone: { stones: ['#a8a59d', '#97948c', '#b5b1a8', '#8b8881'], wood: '#8a5a36', woodDark: '#6e4a30', roof: '#9c4a32', water: '#24506e', edge: '#1a3a52', ground: '#86b85a' },
  sandstone: { stones: ['#d9b98a', '#c9a46f', '#e3c89c', '#cfae7c'], wood: '#8a5a36', woodDark: '#6e4a30', roof: '#b5533a', water: '#235a72', edge: '#1a4256', ground: '#a8c46a' },
  mossy: { stones: ['#8f9a86', '#7f8a76', '#9aa58f', '#86917c'], wood: '#7a5634', woodDark: '#5e432a', roof: '#5f7f3a', water: '#1f4a4a', edge: '#173838', ground: '#6fa84a', moss: ['#6f9a3e', '#5f8a34'] },
  slate: { stones: ['#5d6470', '#6b7380', '#4f5560', '#646b78'], wood: '#6a4e3a', woodDark: '#4f3a2c', roof: '#3a4250', water: '#203a58', edge: '#162a40', ground: '#7aa858' },
}

const COUNT = 11 // stones per course
const RING = 0.55 // the wall's mid radius
const COURSE = 0.2
const BASE = 0.04
const WALL_TOP = BASE + COURSE * 2
const WATER_Y = 0.26
const POST_X = 0.68
const AXLE_Y = 1.02
const DRUM = 0.075
const ROPE = 0.2 // the rope's length below the drum
const T_HIT = 0.9 // seconds from tap to the coin hitting the water
const COIN_FROM = new THREE.Vector3(0.28, 1.15, 1.15)
const COIN_TO = new THREE.Vector3(0.2, WATER_Y, 0.12)

export function WishingWell({ look = 'stone' }) {
  const L = LOOKS[look] || LOOKS.stone
  const { tap, handlers, clock } = useTap(1)
  const rope = useRef()
  const ropeMesh = useRef()
  const bucket = useRef()
  const crank = useRef()
  const coin = useRef()
  const orb = useRef()
  const orbLight = useRef()
  const glints = useRef([])
  // the splash and the wish start when the coin lands, not at the tap
  const hit = useMemo(() => ({ since: (t) => tap.since(t) - T_HIT }), [tap])
  const wish = useMemo(() => ({ since: (t) => tap.since(t) - T_HIT - 0.25 }), [tap])

  const geo = useGeo(() => {
    const roofLen = 0.8 / Math.cos(0.6)
    const gable = new THREE.Shape()
    gable.moveTo(-0.7, 0)
    gable.lineTo(0.7, 0)
    gable.lineTo(0, 0.46)
    gable.closePath()
    return {
      ground: facet(new THREE.CylinderGeometry(0.95, 1.0, BASE, 12, 1).translate(0, BASE / 2, 0), 0.02, 1, [1, 0.3, 1], (x, y) => y < 0.001),
      stones: Array.from({ length: COUNT * 2 }, (_, i) => facet(new THREE.BoxGeometry(0.29, COURSE * 0.9, 0.18, 2, 1, 1), 0.018, 20 + i)),
      inner: new THREE.CylinderGeometry(0.47, 0.47, WALL_TOP - 0.05, 12, 1, true),
      glint: new THREE.OctahedronGeometry(1, 0),
      post: facet(new THREE.BoxGeometry(0.1, 1.3, 0.1, 1, 3, 1).translate(0, 0.65, 0), 0.008, 2),
      roof: facet(new THREE.BoxGeometry(roofLen, 0.05, 1.06, 3, 1, 4), 0.012, 3),
      ridge: new THREE.BoxGeometry(0.07, 0.07, 1.1),
      gable: new THREE.ExtrudeGeometry(gable, { depth: 0.03, bevelEnabled: false }),
      axle: new THREE.CylinderGeometry(0.03, 0.03, 1.56, 6, 1).rotateZ(Math.PI / 2),
      drum: facet(new THREE.CylinderGeometry(DRUM, DRUM, 0.3, 8, 3).rotateZ(Math.PI / 2), 0.004, 4),
      crankArm: new THREE.BoxGeometry(0.04, 0.2, 0.05).translate(0, -0.09, 0),
      crankKnob: new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6, 1).rotateZ(Math.PI / 2).translate(0.06, -0.18, 0),
      rope: new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1).translate(0, -0.5, 0),
      handle: new THREE.TorusGeometry(0.1, 0.008, 3, 10, Math.PI),
      bucket: facet(new THREE.CylinderGeometry(0.1, 0.082, 0.16, 8, 1), 0.004, 5),
      band: new THREE.CylinderGeometry(1, 1, 0.018, 8, 1, true),
      bucketIn: new THREE.CircleGeometry(0.09, 8).rotateX(-Math.PI / 2),
      coin: new THREE.CylinderGeometry(0.055, 0.055, 0.012, 10, 1),
      orb: blob(0.08, 6),
      drop: new THREE.IcosahedronGeometry(1, 0),
      star: new THREE.OctahedronGeometry(1, 0),
      moss: blob(0.06, 7, 0),
      hit: new THREE.CylinderGeometry(0.75, 0.75, 1.8, 8).translate(0, 0.9, 0),
    }
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the bucket bobs on its rope and the rope sways; the crank rocks with it
    const bob = Math.sin(t * 1.3) * 0.025
    const len = ROPE + bob
    rope.current.rotation.set(Math.sin(t * 0.7 + 1) * 0.045, 0, Math.sin(t * 0.9) * 0.06)
    ropeMesh.current.scale.y = len
    bucket.current.position.y = -len
    bucket.current.rotation.y = Math.sin(t * 0.4) * 0.5
    crank.current.rotation.x = bob * 6
    // glints on the water twinkle
    glints.current.forEach((g, i) => g && g.scale.setScalar(Math.max(0.001, 0.016 * Math.max(0, Math.sin(t * (1.3 + i * 0.37) + i * 2.1)) ** 3)))
    // the coin: tumbles in on an arc, then it's gone under
    const c = coin.current
    c.visible = s >= 0 && s < T_HIT
    if (c.visible) {
      const u = s / T_HIT
      c.position.lerpVectors(COIN_FROM, COIN_TO, u)
      c.position.y += 4 * u * (1 - u) * 0.18
      c.rotation.set(s * 15, 0.4, 0.3)
      c.scale.setScalar(Math.min(1, s * 8))
    }
    // the wish: a glow rising out of the water, fading as it goes
    const w = s - T_HIT - 0.15
    const o = orb.current
    o.visible = w >= 0 && w < 2.6
    if (o.visible) {
      const q = w / 2.6
      o.position.set(COIN_TO.x * (1 - q * 0.5), WATER_Y + 0.05 + q * 1.05, COIN_TO.z + q * 0.25)
      o.scale.setScalar(Math.max(0.001, Math.min(1, w * 4) * (1 + 0.15 * Math.sin(w * 12))))
      o.material.opacity = 0.85 * (1 - q * q)
    }
    orbLight.current.intensity = o.visible ? 1.6 * (1 - w / 2.6) : 0
    orbLight.current.position.copy(o.position)
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh geometry={geo.ground}>
        <Flat color={L.ground} />
      </mesh>
      {/* the wall: two courses of stones, the upper one turned half a stone */}
      {geo.stones.map((g, i) => {
        const course = Math.floor(i / COUNT)
        const a = ((i % COUNT) + course * 0.5) * (TAU / COUNT)
        return (
          <mesh key={i} geometry={g} position={[Math.cos(a) * RING, BASE + COURSE * (course + 0.5), Math.sin(a) * RING]} rotation-y={-a + Math.PI / 2}>
            <Flat color={L.stones[(i * 3 + course) % L.stones.length]} />
          </mesh>
        )
      })}
      {L.moss &&
        Array.from({ length: 6 }, (_, i) => {
          const a = (i * 2 + 0.5) * (TAU / COUNT)
          return (
            <mesh key={i} geometry={geo.moss} position={[Math.cos(a) * RING, WALL_TOP - 0.005, Math.sin(a) * RING]} rotation-y={-a} scale={[1.6, 0.35, 1.2]}>
              <Flat color={L.moss[i % 2]} />
            </mesh>
          )
        })}
      <mesh geometry={geo.inner} position-y={BASE + (WALL_TOP - 0.05) / 2}>
        <Flat color={L.edge} side={THREE.BackSide} />
      </mesh>
      {/* the water, its glints and the splash rings */}
      <group position-y={WATER_Y - 0.04}>
        <Water radius={0.47} rings={3} segs={12} color={L.water} edge={L.edge} amp={0.006} speed={0.7} y={0.04} />
      </group>
      {[[0.2, -0.15], [-0.22, 0.1], [0.05, 0.25], [-0.1, -0.25]].map(([x, z], i) => (
        <mesh key={i} ref={(el) => (glints.current[i] = el)} geometry={geo.glint} position={[x, WATER_Y + 0.015, z]} scale={0.001}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      <group position={[COIN_TO.x * 0.4, 0, COIN_TO.z * 0.4]}>
        <Ripple tap={hit} count={3} radius={0.32} color="#ffffff" y={WATER_Y + 0.012} life={1.1} opacity={0.7} />
      </group>
      {/* the posts, the roof and its gables */}
      {[-1, 1].map((x) => (
        <mesh key={x} geometry={geo.post} position-x={x * POST_X}>
          <Flat color={L.wood} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={x} geometry={geo.roof} position={[x * 0.4, 1.78 - 0.4 * Math.tan(0.6) + 0.03, 0]} rotation-z={-x * 0.6}>
          <Flat color={L.roof} />
        </mesh>
      ))}
      <mesh geometry={geo.ridge} position-y={1.8} rotation-z={Math.PI / 4}>
        <Flat color={L.woodDark} />
      </mesh>
      {[-1, 1].map((z) => (
        <mesh key={z} geometry={geo.gable} position={[0, 1.29, z * 0.44 - 0.015]}>
          <Flat color={L.woodDark} />
        </mesh>
      ))}
      {/* the winch: axle, drum of rope, crank */}
      <group position-y={AXLE_Y}>
        <mesh geometry={geo.axle} position-x={0.04}>
          <Flat color={L.woodDark} />
        </mesh>
        <mesh geometry={geo.drum}>
          <Flat color="#c9b07a" />
        </mesh>
        <group ref={crank} position-x={0.8}>
          <mesh geometry={geo.crankArm}>
            <Flat color="#5a5d66" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh geometry={geo.crankKnob}>
            <Flat color={L.wood} />
          </mesh>
        </group>
      </group>
      {/* the rope and the bucket, swinging from under the drum */}
      <group ref={rope} position-y={AXLE_Y - DRUM + 0.01}>
        <mesh ref={ropeMesh} geometry={geo.rope}>
          <Flat color="#c9b07a" />
        </mesh>
        <group ref={bucket}>
          <mesh geometry={geo.handle} position-y={-0.1}>
            <Flat color="#5a5d66" roughness={0.5} metalness={0.3} />
          </mesh>
          <group position-y={-0.18}>
            <mesh geometry={geo.bucket}>
              <Flat color={L.wood} />
            </mesh>
            <mesh geometry={geo.bucketIn} position-y={0.07}>
              <Flat color="#3a2a1e" />
            </mesh>
            {[0.05, -0.05].map((y, i) => (
              <mesh key={y} geometry={geo.band} position-y={y} scale={[0.1 - i * 0.012 + 0.006, 1, 0.1 - i * 0.012 + 0.006]}>
                <Flat color="#5a5d66" roughness={0.5} metalness={0.3} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      {/* the coin and the wish */}
      <mesh ref={coin} geometry={geo.coin} visible={false}>
        <Flat color="#f2c43a" emissive="#f2a81a" emissiveIntensity={0.3} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh ref={orb} geometry={geo.orb} visible={false}>
        <meshStandardMaterial color="#fff1a8" emissive="#ffd84a" emissiveIntensity={1.6} flatShading transparent depthWrite={false} />
      </mesh>
      <pointLight ref={orbLight} color="#ffd84a" distance={2} decay={2} intensity={0} />
      <Burst tap={hit} geometry={geo.drop} count={12} colors={['#9fd4f5', '#cfeaff', '#ffffff']} speed={0.9} gravity={4} size={0.022} life={0.8} origin={[COIN_TO.x, WATER_Y + 0.02, COIN_TO.z]} spread={0.45} up={1.5} />
      <Burst tap={wish} geometry={geo.star} count={16} colors={['#ffd84a', '#fff3b0', '#ffffff']} speed={0.4} gravity={-0.7} size={0.03} life={2.8} origin={[COIN_TO.x, WATER_Y + 0.08, COIN_TO.z]} spread={0.7} up={1.5} seed={9} />
    </group>
  )
}

export default function WishingWellScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.5, 4.2]} target={[0, 0.85, 0]} hint="The bucket bobs gently on its rope and the rope sways; glints twinkle on the water · tap it and a coin flips in, splashes into the water and a wish rises out of the well in a glow of sparkles · Look swaps stone, sandstone, mossy and slate · drag to orbit">
      <WishingWell {...props} />
    </Stage>
  )
}
