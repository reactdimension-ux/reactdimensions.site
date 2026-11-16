import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, TAU, blob, cone, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly tiny planet: a small faceted globe with a cosy cottage sitting
// on top on its own patch of lawn, a gable roof, a smoking chimney and a
// little fence, a sandy path running away from the door right round the
// world, and trees, rocks and flowers dotted about. Clouds circle the globe.
// Left alone, the globe rolls slowly under the cottage, so the path runs on
// from the door and the trees come round over the horizon and pass by, while
// the clouds drift round. Tap it and day turns to night: the sky darkens,
// the windows light up, stars come out and the moon rises. Tap again, or
// wait a few seconds, and morning comes back.

const LOOKS = {
  meadow: { ground: ['#6cc24f', '#5cb246', '#7fd05a'], path: '#e8cf96', tree: 'round', leaf: ['#3f9a44', '#55b04a', '#2f8a40'], trunk: '#8a5a36', wall: '#f2e2c2', roof: '#d9473a', trim: '#8a5a36', rock: '#a8a8b0', flower: ['#ffe14a', '#ff7aa8', '#ffffff'], cloud: '#ffffff' },
  desert: { ground: ['#e8c27a', '#dcb06a', '#f0d08e'], path: '#c98a52', tree: 'cactus', leaf: ['#4f9a52', '#5aa85a', '#468a48'], trunk: '#8a6a40', wall: '#f0d8b0', roof: '#c96a3a', trim: '#7a4a2a', rock: '#c48a5a', flower: ['#ff6a8a', '#ffd04a', '#ff9a4a'], cloud: '#fff8ee' },
  snow: { ground: ['#eef3f8', '#e0e8f2', '#f8fbfd'], path: '#b8c4d4', tree: 'pine', leaf: ['#2f7050', '#2a6448', '#3a7e5a'], trunk: '#6a4a34', wall: '#e8c48e', roof: '#c8443c', trim: '#6a4a34', rock: '#9aa4b4', flower: ['#ffffff', '#dfe8f4', '#ffffff'], cloud: '#ffffff' },
  autumn: { ground: ['#b8b04a', '#a8a040', '#c8bc58'], path: '#d8b882', tree: 'round', leaf: ['#e8862e', '#d4552a', '#f0b23a'], trunk: '#7a4c2c', wall: '#f0dcb8', roof: '#8a4a2e', trim: '#6a3e24', rock: '#a09a92', flower: ['#ffcf4a', '#e85a2a', '#ffffff'], cloud: '#fdf2e6' },
}

const CY = 1.0 // the globe's centre
const R = 0.8 // the globe's radius
const NIGHT_HOLD = 5.5 // seconds before morning comes back by itself
const ROLL = 0.16 // radians a second the globe rolls

// a point on the globe from a latitude-like tilt about z and an angle round x
const onGlobe = (x, a) => {
  const yz = Math.sqrt(Math.max(0, 1 - x * x))
  return new THREE.Vector3(x, Math.cos(a) * yz, Math.sin(a) * yz)
}

// the globe: faceted, faces tinted grass, with a path band where x is near 0
function globeGeo(L) {
  const g = facet(new THREE.IcosahedronGeometry(R, 3), 0.018, 6).toNonIndexed()
  g.computeVertexNormals()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  const r = rng(9)
  for (let f = 0; f < p.count; f += 3) {
    const x = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3 / R
    const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3 / R
    const z = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3 / R
    const a = Math.atan2(z, y)
    // the path wanders a little either side of the x = 0 circle
    const onPath = Math.abs(x - 0.05 * Math.sin(a * 3)) < 0.085
    c.set(onPath ? L.path : L.ground[Math.floor(r() * 3)]).multiplyScalar(0.95 + r() * 0.1)
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// One tree, standing up along +y, in the look's style.
function Tree({ L, geo, s = 1, v = 0 }) {
  if (L.tree === 'cactus')
    return (
      <group scale={s}>
        <mesh geometry={geo.cactus}>
          <Flat color={L.leaf[v % 3]} />
        </mesh>
        <mesh geometry={geo.arm} position={[0.045, 0.1, 0]}>
          <Flat color={L.leaf[(v + 1) % 3]} />
        </mesh>
        <mesh geometry={geo.arm} position={[-0.045, 0.14, 0]} rotation-y={Math.PI} scale={0.8}>
          <Flat color={L.leaf[(v + 1) % 3]} />
        </mesh>
      </group>
    )
  if (L.tree === 'pine')
    return (
      <group scale={s}>
        <mesh geometry={geo.trunk}>
          <Flat color={L.trunk} />
        </mesh>
        {geo.tier.map((g, j) => (
          <mesh key={j} geometry={g} position-y={0.06 + j * 0.075}>
            <Flat color={j === 2 ? '#f4f8fc' : L.leaf[(v + j) % 3]} />
          </mesh>
        ))}
      </group>
    )
  return (
    <group scale={s}>
      <mesh geometry={geo.trunk}>
        <Flat color={L.trunk} />
      </mesh>
      <mesh geometry={geo.crown} position-y={0.17}>
        <Flat color={L.leaf[v % 3]} />
      </mesh>
      <mesh geometry={geo.crown2} position={[0.04, 0.24, 0.02]}>
        <Flat color={L.leaf[(v + 1) % 3]} />
      </mesh>
    </group>
  )
}

// Stand a prop on the globe at unit direction n (in the globe's own space).
function OnGlobe({ n, children, spin = 0 }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), [n])
  return (
    <group position={n.clone().multiplyScalar(R - 0.015).toArray()} quaternion={q}>
      <group rotation-y={spin}>{children}</group>
    </group>
  )
}

const smooth = (a, b, k) => a + (b - a) * k

export function TinyPlanet({ look = 'meadow' }) {
  const L = LOOKS[look] || LOOKS.meadow
  const { handlers, clock } = useTap(1.5)
  const scene = useThree((s) => s.scene)
  const globe = useRef()
  const clouds = useRef([])
  const wins = useRef([])
  const lamp = useRef()
  const moon = useRef()
  const moonLight = useRef()
  const starG = useRef()
  const stars = useRef([])
  const night = useRef({ on: false, t0: -99, n: 0 })
  const sky = useRef(null)
  const geo = useGeo(
    () => ({
      globe: globeGeo(L),
      lawn: facet(new THREE.CylinderGeometry(0.3, 0.34, 0.22, 9), 0.01, 3),
      wall: new THREE.BoxGeometry(0.3, 0.2, 0.24),
      // the roof: a triangular prism along x, eaves overhanging
      roof: new THREE.CylinderGeometry(0.17, 0.17, 0.36, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2),
      gable: new THREE.CylinderGeometry(0.13, 0.13, 0.37, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2),
      chimney: new THREE.BoxGeometry(0.05, 0.14, 0.05),
      door: new THREE.BoxGeometry(0.06, 0.1, 0.012),
      win: new THREE.BoxGeometry(0.055, 0.05, 0.012),
      post: new THREE.BoxGeometry(0.02, 0.07, 0.02),
      rail: new THREE.BoxGeometry(0.02, 0.012, 0.24),
      trunk: new THREE.CylinderGeometry(0.014, 0.02, 0.12, 5).translate(0, 0.06, 0),
      crown: blob(0.09, 12, 0),
      crown2: blob(0.06, 13, 0),
      tier: [0, 1, 2].map((i) => cone(0.08 - i * 0.02, 0.12, 6, 20 + i)),
      cactus: facet(new THREE.CylinderGeometry(0.028, 0.032, 0.24, 6).translate(0, 0.12, 0), 0.003, 5),
      arm: facet(new THREE.CylinderGeometry(0.016, 0.018, 0.07, 5).translate(0, 0.035, 0), 0.002, 6).translate(0.02, 0, 0),
      rock: blob(0.05, 14, 0),
      flower: new THREE.IcosahedronGeometry(0.018, 0),
      puff: blob(0.12, 15, 0),
      star: new THREE.OctahedronGeometry(1, 0),
      moon: blob(0.16, 21, 1),
    }),
    [look],
  )
  // props on the globe: trees, rocks and flowers, kept off the path and
  // away from the x = 0 circle so they pass beside the cottage
  const props = useMemo(() => {
    const r = rng(42)
    const trees = [
      [0.58, 1.2],
      [-0.6, 1.9],
      [0.66, 2.8],
      [-0.56, 3.7],
      [0.56, 4.6],
      [-0.66, 5.4],
      [0.72, 0.3],
      [-0.58, 0.75],
    ].map(([x, a], i) => ({ n: onGlobe(x, a), s: 0.95 + r() * 0.5, v: i % 3, spin: r() * TAU }))
    const rocks = Array.from({ length: 7 }, (_, i) => ({ n: onGlobe((i % 2 ? 1 : -1) * (0.5 + r() * 0.35), r() * TAU), s: 0.5 + r() * 0.7, spin: r() * TAU }))
    const flowers = Array.from({ length: 22 }, (_, i) => ({ n: onGlobe((i % 2 ? 1 : -1) * (0.45 + r() * 0.45), r() * TAU), c: i % 3 }))
    return { trees, rocks, flowers }
  }, [])
  const C = useMemo(
    () =>
      [0, 1, 2].map((i) => ({ r: 1.18 + i * 0.08, tilt: [0.5, -0.35, 0.15][i], ph: (i / 3) * TAU, sp: [0.22, -0.18, 0.15][i], puffs: [[0, 0, 0, 1], [0.13, -0.02, 0.02, 0.75], [-0.12, -0.03, -0.01, 0.7], [0.05, 0.06, -0.03, 0.7]] })),
    [],
  )
  const S = useMemo(() => {
    const r = rng(77)
    return Array.from({ length: 46 }, () => {
      const v = new THREE.Vector3(r() - 0.5, r() * 0.9 - 0.15, r() - 0.5).normalize().multiplyScalar(2.6 + r() * 1.2)
      return { p: [v.x, v.y + CY, v.z], s: 0.014 + r() * 0.02, ph: r() * TAU, rate: 1 + r() * 2 }
    })
  }, [])

  // remember the stage's lights and sky so night can dim them, and put them
  // back when the planet goes
  useEffect(() => {
    const lights = scene.children.filter((o) => o.isLight)
    lights.forEach((l) => (l.userData.dayIntensity = l.intensity))
    const bg = scene.background && scene.background.isColor ? scene.background.clone() : null
    sky.current = { lights, bg }
    return () => {
      lights.forEach((l) => (l.intensity = l.userData.dayIntensity))
      if (bg && scene.background?.isColor) scene.background.copy(bg)
    }
  }, [scene])

  const onClick = (e) => {
    e.stopPropagation()
    const N = night.current
    N.on = !N.on
    N.t0 = clock.elapsedTime
  }

  const nightSky = useMemo(() => new THREE.Color('#0b1230'), [])
  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const d = Math.min(dt, 0.05)
    const N = night.current
    if (N.on && t - N.t0 > NIGHT_HOLD) N.on = false
    N.n = smooth(N.n, N.on ? 1 : 0, 1 - Math.exp(-d * 4))
    const n = N.n
    globe.current.rotation.x = -t * ROLL
    C.forEach((c, i) => {
      const m = clouds.current[i]
      if (!m) return
      const a = c.ph + t * c.sp
      m.position.set(Math.cos(a) * c.r, CY + Math.sin(a) * c.r * Math.sin(c.tilt) + 0.15 + Math.sin(t * 0.6 + i) * 0.03, Math.sin(a) * c.r * Math.cos(c.tilt))
      m.rotation.y = -a
    })
    // night: dim the stage, darken the sky, light the windows, rise the moon
    const sk = sky.current
    if (sk) {
      sk.lights.forEach((l) => (l.intensity = l.userData.dayIntensity * (1 - 0.85 * n)))
      if (sk.bg && scene.background?.isColor) scene.background.copy(sk.bg).lerp(nightSky, 1 - (1 - n) ** 3)
    }
    wins.current.forEach((w) => w && (w.material.emissiveIntensity = 0.05 + n * 2.2))
    lamp.current.intensity = n * 1.6
    const m = moon.current
    m.visible = n > 0.01
    m.position.set(-1.45 + 0.15 * n, CY - 0.5 + n * 1.45, 0.9)
    m.scale.setScalar(Math.max(0.001, n))
    moonLight.current.intensity = n * 0.9
    starG.current.visible = n > 0.02
    S.forEach((s, i) => {
      const st = stars.current[i]
      if (st) st.scale.setScalar(Math.max(0.001, s.s * n * (0.6 + 0.4 * Math.sin(t * s.rate + s.ph))))
    })
  })

    return (
    <group {...handlers} onClick={onClick}>
      {/* the globe and everything on it, rolling under the cottage */}
      <group position-y={CY}>
        <group ref={globe}>
          <mesh geometry={geo.globe}>
            <Flat vertexColors color="#ffffff" roughness={0.9} />
          </mesh>
          {props.trees.map((p, i) => (
            <OnGlobe key={i} n={p.n} spin={p.spin}>
              <Tree L={L} geo={geo} s={p.s} v={p.v} />
            </OnGlobe>
          ))}
          {props.rocks.map((p, i) => (
            <OnGlobe key={'r' + i} n={p.n} spin={p.spin}>
              <mesh geometry={geo.rock} scale={[p.s, p.s * 0.7, p.s]}>
                <Flat color={L.rock} />
              </mesh>
            </OnGlobe>
          ))}
          {props.flowers.map((p, i) => (
            <OnGlobe key={'f' + i} n={p.n}>
              <mesh geometry={geo.flower} position-y={0.02}>
                <Flat color={L.flower[p.c]} emissive={L.flower[p.c]} emissiveIntensity={0.1} />
              </mesh>
            </OnGlobe>
          ))}
        </group>
      </group>

      {/* the cottage on its patch of lawn, fixed on top */}
      <group position-y={CY + R - 0.02}>
        <mesh geometry={geo.lawn} position-y={-0.05}>
          <Flat color={L.ground[0]} roughness={0.9} />
        </mesh>
        <group position-y={0.06}>
          <mesh geometry={geo.wall} position-y={0.1}>
            <Flat color={L.wall} />
          </mesh>
          <mesh geometry={geo.gable} position-y={0.2 + 0.065}>
            <Flat color={L.wall} />
          </mesh>
          <mesh geometry={geo.roof} position-y={0.2 + 0.085}>
            <Flat color={L.roof} />
          </mesh>
          <mesh geometry={geo.chimney} position={[0.08, 0.36, -0.05]}>
            <Flat color={L.trim} />
          </mesh>
          <mesh geometry={geo.door} position={[0, 0.05, 0.121]}>
            <Flat color={L.trim} />
          </mesh>
          {[
            [-0.09, 0.11, 0.121, 0],
            [0.09, 0.11, 0.121, 0],
            [0.151, 0.1, 0, Math.PI / 2],
            [-0.151, 0.1, 0, Math.PI / 2],
          ].map(([x, y, z, ry], i) => (
            <mesh key={i} ref={(el) => (wins.current[i] = el)} geometry={geo.win} position={[x, y, z]} rotation-y={ry}>
              <Flat color="#ffd98a" emissive="#ffb84a" emissiveIntensity={0.05} roughness={0.4} />
            </mesh>
          ))}
          <pointLight ref={lamp} position={[0, 0.12, 0.3]} color="#ffb860" distance={1.4} decay={1.6} intensity={0} />
          {/* a little fence along each side of the lawn */}
          {[-1, 1].map((sd) => (
            <group key={sd} position-x={sd * 0.24}>
              {[-0.1, 0, 0.1].map((z) => (
                <mesh key={z} geometry={geo.post} position={[0, 0.035, z]}>
                  <Flat color={L.trim} />
                </mesh>
              ))}
              <mesh geometry={geo.rail} position-y={0.05}>
                <Flat color={L.trim} />
              </mesh>
            </group>
          ))}
        </group>
        <Particles count={10} life={2.6} origin={[0.08, 0.49, -0.05]} spread={0.01} velocity={[-0.06, 0.25, 0]} scatter={0.02} drift={0.06} size={[0.02, 0.06]} colors={['#ffffff', '#e8e8ee']} opacity={[0.8, 0]} seed={4} />
      </group>

      {/* clouds circling the globe */}
      {C.map((c, i) => (
        <group key={i} ref={(el) => (clouds.current[i] = el)}>
          {c.puffs.map(([x, y, z, s], j) => (
            <mesh key={j} geometry={geo.puff} position={[x, y, z]} scale={s * (i === 1 ? 0.8 : 1)}>
              <Flat color={L.cloud} emissive={L.cloud} emissiveIntensity={0.08} />
            </mesh>
          ))}
        </group>
      ))}

      {/* the night: stars and the moon */}
      <group ref={starG} visible={false}>
        {S.map((s, i) => (
          <mesh key={i} ref={(el) => (stars.current[i] = el)} geometry={geo.star} position={s.p} scale={0.001}>
            <meshBasicMaterial color="#fff8e0" toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={moon} geometry={geo.moon} visible={false}>
        <Flat color="#f4f0dc" emissive="#f4ecc4" emissiveIntensity={0.9} />
      </mesh>
      <directionalLight ref={moonLight} position={[-3, 3, -2]} color="#9fb4ff" intensity={0} />
    </group>
  )
}

export default function TinyPlanetScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.4, 4.6]} target={[0, 1.1, 0]} hint="The little globe rolls slowly under the cottage, trees coming round over the horizon, while clouds circle it · tap it and night falls: the sky darkens, the windows glow, stars come out and the moon rises; tap again or wait for morning · Look swaps meadow, desert, snow and autumn · drag to orbit">
      <TinyPlanet {...props} />
    </Stage>
  )
}
