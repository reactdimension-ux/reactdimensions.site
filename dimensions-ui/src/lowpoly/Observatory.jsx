import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, TAU, blob, cone, facet, rng, terrainGeo, terrainShape, useGeo, useTap } from './kit.jsx'

// A low-poly observatory on a hilltop: a pale cylindrical drum on a stone
// plinth, with a door, little steps and glowing windows, capped by a dome
// with an up-and-over shutter in its slit and a telescope on a pier inside.
// A few pines dot the slope, stars hang round the sky and a crescent moon
// watches. Left alone, the dome slowly turns, the windows glow and pulse and
// the stars twinkle. Tap it and the shutter slides back over the top, the
// telescope tilts up and slides out through the slit, the stars flare and a
// shooting star streaks across the sky; then it all closes up again.

const LOOKS = {
  night: { sky: '#151a33', grass: ['#2c4a42', '#33554b', '#3c6255'], wall: '#d9dce8', wall2: '#bfc4d6', dome: '#c7cddc', shutter: '#8590aa', trim: '#56607e', stone: '#7d8094', stone2: '#6c6f83', door: '#3a3550', glow: '#ffcf6a', star: '#fff4cf', moon: '#fff1c2', tree: ['#1f3f39', '#28503f'], scope: '#f1eee6', snow: false },
  dusk: { sky: '#4a3962', grass: ['#4d5a3f', '#586845', '#64764d'], wall: '#f1e3d6', wall2: '#dccbbd', dome: '#dcc8bc', shutter: '#a3808a', trim: '#6d4f6a', stone: '#9c8c88', stone2: '#8a7a78', door: '#4a3044', glow: '#ffb45a', star: '#ffe6bd', moon: '#ffd79a', tree: ['#36472f', '#405535'], scope: '#f6efe4', snow: false },
  snow: { sky: '#2a3552', grass: ['#c9d6e6', '#dde6f1', '#f1f5fb'], wall: '#cfd6e3', wall2: '#b7c0d2', dome: '#eef2f8', shutter: '#8794af', trim: '#4f5d7c', stone: '#8b93a6', stone2: '#7a8296', door: '#38405a', glow: '#ffd27a', star: '#ffffff', moon: '#eef3ff', tree: ['#2b4a45', '#33584f'], scope: '#f2f2f2', snow: true },
}

const HILL_R = 1.55
const HILL_H = 0.3
const shape = terrainShape('mesa')
const groundAt = (x, z) => HILL_H * shape(Math.min(1, Math.hypot(x, z) / HILL_R))
const PLINTH = 0.14
const PLINTH_R = 0.58
const DRUM_R = 0.48
const DRUM_H = 0.46
const DOME_R = 0.46
const BASE = HILL_H + PLINTH // top of the plinth
const TOP = BASE + DRUM_H // the dome's equator
const SLIT = 0.17 // half-width of the slit, radians
const SLIT_FROM = -0.3 // the slit runs from just behind the zenith down to the front
const OPEN = 1.8 // how far the shutter slides back (radians)
const HOLD = 5 // seconds the slit stays open
const STARS = 18

const ease = (u) => {
  const x = Math.max(0, Math.min(1, u))
  return x * x * (3 - 2 * x)
}

// A piece of a sphere whose poles lie along x, so phi turns about x (from
// +y towards +z) and theta = pi/2 is the great circle over the top: the slit.
const domePart = (r, t0, tl, p0, pl, ws, hs) => new THREE.SphereGeometry(r, ws, hs, p0, pl, t0, tl).rotateZ(-Math.PI / 2)

// A crescent: a disc with a bite taken out of it.
function crescentGeo(R, d, R2) {
  const x = (d * d + R * R - R2 * R2) / (2 * d)
  const y = Math.sqrt(R * R - x * x)
  const s = new THREE.Shape()
  s.absarc(0, 0, R, Math.atan2(y, x), TAU - Math.atan2(y, x), false)
  s.absarc(d, 0, R2, Math.atan2(-y, x - d), Math.atan2(y, x - d), true)
  return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -0.02)
}

export function Observatory({ look = 'night' }) {
  const L = LOOKS[look] || LOOKS.night
  const { tap, handlers, clock } = useTap(1.2)
  const camera = useThree((s) => s.camera)
  const dome = useRef()
  const shutter = useRef()
  const tilt = useRef()
  const slide = useRef()
  const glows = useRef([])
  const lamp = useRef()
  const stars = useRef([])
  const moon = useRef()
  const sky = useRef()
  const shoot = useRef()
  const shootMats = useRef([])
  const st = useRef({ spin: 0 })

  const geo = useGeo(
    () => ({
      hill: terrainGeo({ radius: HILL_R, height: HILL_H, seed: 4, rings: 6, segs: 16, rough: 0.08, profile: 'mesa', bands: [[0, L.grass[0]], [0.45, L.grass[1]], [0.85, L.grass[2]]] }),
      plinth: facet(new THREE.CylinderGeometry(PLINTH_R, PLINTH_R + 0.04, PLINTH + 0.04, 12, 1).translate(0, (PLINTH + 0.04) / 2 - 0.04, 0), 0.01, 2, [1, 0.3, 1]),
      drum: new THREE.CylinderGeometry(DRUM_R, DRUM_R, DRUM_H, 14, 1).translate(0, DRUM_H / 2, 0),
      band: new THREE.CylinderGeometry(DRUM_R + 0.025, DRUM_R + 0.025, 0.05, 14, 1),
      domeL: domePart(DOME_R, 0, Math.PI / 2 - SLIT, -Math.PI / 2, Math.PI, 12, 4),
      domeR: domePart(DOME_R, Math.PI / 2 + SLIT, Math.PI / 2 - SLIT, -Math.PI / 2, Math.PI, 12, 4),
      domeBack: domePart(DOME_R, Math.PI / 2 - SLIT, SLIT * 2, -Math.PI / 2, Math.PI / 2 + SLIT_FROM, 4, 1),
      shutter: domePart(DOME_R + 0.014, Math.PI / 2 - SLIT - 0.035, SLIT * 2 + 0.07, SLIT_FROM, Math.PI / 2 - SLIT_FROM, 6, 1),
      inner: new THREE.SphereGeometry(DOME_R - 0.012, 12, 4, 0, TAU, 0, Math.PI / 2),
      rail: new THREE.TorusGeometry((DOME_R + 0.006) * Math.cos(SLIT), 0.014, 3, 12, Math.PI).rotateY(Math.PI / 2),
      box: new THREE.BoxGeometry(1, 1, 1),
      arch: new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2),
      pier: new THREE.CylinderGeometry(0.05, 0.07, 0.12, 6, 1).translate(0, 0.06, 0),
      fork: new THREE.BoxGeometry(0.17, 0.05, 0.06),
      arm: new THREE.BoxGeometry(0.025, 0.09, 0.04),
      tube: new THREE.CylinderGeometry(0.056, 0.048, 0.42, 8, 1).translate(0, 0.09, 0).rotateX(Math.PI / 2),
      ring: new THREE.CylinderGeometry(0.064, 0.064, 0.035, 8, 1).rotateX(Math.PI / 2),
      finder: new THREE.CylinderGeometry(0.016, 0.016, 0.14, 5, 1).rotateX(Math.PI / 2),
      eyepiece: new THREE.CylinderGeometry(0.014, 0.018, 0.05, 5, 1),
      lens: new THREE.CircleGeometry(0.05, 8),
      pine: cone(0.13, 0.32, 6, 7),
      pineTop: cone(0.09, 0.22, 6, 8),
      snowCap: cone(0.055, 0.1, 6, 9),
      trunk: new THREE.CylinderGeometry(0.02, 0.025, 0.08, 5, 1).translate(0, 0.04, 0),
      rock: blob(0.07, 11, 0),
      star: new THREE.OctahedronGeometry(1, 0),
      moon: crescentGeo(0.2, 0.1, 0.17),
      streak: new THREE.ConeGeometry(0.03, 0.75, 5, 1, true).translate(0, 0.375, 0).rotateZ(Math.PI / 2),
      head: new THREE.IcosahedronGeometry(0.03, 0),
      flake: new THREE.OctahedronGeometry(1, 0),
    }),
    [look],
  )

  const starList = useMemo(() => {
    const r = rng(31)
    return Array.from({ length: STARS }, (_, i) => {
      const a = (i / STARS) * TAU + r() * 0.3
      const rad = 1.75 + r() * 0.7
      return { p: [Math.cos(a) * rad, 1.5 + r() * 1.0, Math.sin(a) * rad], s: 0.022 + r() * 0.03, rate: 1.2 + r() * 2.4, ph: r() * TAU }
    })
  }, [])

  const pines = useMemo(
    () =>
      [
        [1.0, 0.45, 1.0],
        [1.12, 0.1, 0.8],
        [-0.95, 0.6, 1.1],
        [-1.1, -0.2, 0.85],
        [0.35, -1.05, 0.9],
        [-0.45, -1.0, 1.05],
      ].map(([x, z, s]) => ({ p: [x, groundAt(x, z) - 0.02, z], s })),
    [],
  )

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const k = tap.value(t)
    const o = s >= 0 ? ease(s / 1.1) * (1 - ease((s - HOLD) / 1.4)) : 0 // 0 shut .. 1 open
    const scopeUp = s >= 0 ? ease((s - 0.5) / 1.1) * (1 - ease((s - HOLD + 0.4) / 1.2)) : 0

    // the dome turns slowly, slowing right down while it is open
    st.current.spin += Math.min(dt, 0.05) * 0.2 * (1 - 0.8 * o)
    dome.current.rotation.y = st.current.spin
    shutter.current.rotation.x = -OPEN * o
    tilt.current.rotation.x = -(0.5 + 0.06 * Math.sin(t * 0.5) + 0.5 * scopeUp)
    slide.current.position.z = 0.27 * scopeUp

    // the windows glow and pulse
    glows.current.forEach((m, i) => m && (m.emissiveIntensity = 1.1 + 0.35 * Math.sin(t * 1.6 + i * 1.3) + 0.12 * Math.sin(t * 4.1 + i) + 1.5 * k))
    if (lamp.current) lamp.current.intensity = 1.2 + 0.3 * Math.sin(t * 1.6) + 2 * k

    // the stars twinkle, and flare once the slit is open
    const bright = 1 + 1.1 * o
    stars.current.forEach((m, i) => {
      if (!m) return
      const S = starList[i]
      const tw = 0.6 + 0.4 * Math.sin(t * S.rate * (1 + o) + S.ph) * Math.sin(t * S.rate * 0.37 + S.ph * 2)
      m.scale.set(S.s * tw * bright, S.s * tw * bright * 1.5, S.s * tw * bright)
      m.rotation.y = t * 0.6 + S.ph
    })
    moon.current.lookAt(camera.position)

    // the shooting star crosses behind the observatory, whichever way you look
    sky.current.rotation.y = Math.atan2(camera.position.x, camera.position.z)
    const u = (s - 0.9) / 1.0
    shoot.current.visible = u > 0 && u < 1
    if (shoot.current.visible) {
      shoot.current.position.set(1.5 - 2.9 * u, 2.65 - 0.85 * u, -1.6)
      const f = Math.min(1, u * 6, (1 - u) * 3)
      shootMats.current.forEach((m) => m && (m.opacity = f))
      shoot.current.scale.set(0.4 + 0.6 * Math.min(1, u * 3), 1, 1)
    }
  })

  const mat = (i) => (m) => (glows.current[i] = m)
  const windows = [0.85, -0.85, 2.3, -2.3]

  return (
    <group {...handlers}>
      {/* the sky: stars, the crescent moon and a shooting star */}
      {starList.map((S, i) => (
        <mesh key={i} ref={(el) => (stars.current[i] = el)} geometry={geo.star} position={S.p}>
          <meshBasicMaterial color={L.star} />
        </mesh>
      ))}
      <mesh ref={moon} geometry={geo.moon} position={[-1.35, 2.15, -1.55]}>
        <meshBasicMaterial color={L.moon} />
      </mesh>
      <group ref={sky}>
        <group ref={shoot} rotation-z={Math.atan2(-0.85, -2.9)} visible={false}>
          <mesh geometry={geo.head}>
            <meshBasicMaterial ref={(m) => (shootMats.current[0] = m)} color="#ffffff" transparent depthWrite={false} />
          </mesh>
          <mesh geometry={geo.streak}>
            <meshBasicMaterial ref={(m) => (shootMats.current[1] = m)} color={L.star} transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* the hill, its pines and rocks */}
      <mesh geometry={geo.hill}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {pines.map((P, i) => (
        <group key={i} position={P.p} scale={P.s} rotation-y={i}>
          <mesh geometry={geo.trunk}>
            <Flat color="#4a3a32" />
          </mesh>
          <mesh geometry={geo.pine} position-y={0.06}>
            <Flat color={L.tree[i % 2]} />
          </mesh>
          <mesh geometry={geo.pineTop} position-y={0.24}>
            <Flat color={L.tree[(i + 1) % 2]} />
          </mesh>
          {L.snow && (
            <mesh geometry={geo.snowCap} position-y={0.37}>
              <Flat color="#f6f9fd" />
            </mesh>
          )}
        </group>
      ))}
      {[
        [0.8, 0.95, 1.2],
        [-0.85, 0.75, 0.9],
        [0.95, -0.55, 1],
        [-0.2, 1.15, 0.8],
      ].map(([x, z, sc], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, groundAt(x, z), z]} scale={[sc * 1.3, sc * 0.8, sc]}>
          <Flat color={i % 2 ? L.stone : L.stone2} />
        </mesh>
      ))}
      {/* a stepping-stone path down the slope */}
      {[0.9, 1.04, 1.18, 1.31, 1.43].map((z, i) => {
        const x = 0.06 * Math.sin(i * 1.7)
        const y = groundAt(x, z)
        const slope = (groundAt(x, z + 0.05) - groundAt(x, z - 0.05)) / 0.1
        return (
          <mesh key={i} geometry={geo.box} position={[x, y + 0.005, z]} rotation={[-Math.atan(slope), i * 0.4, 0]} scale={[0.15, 0.025, 0.1]}>
            <Flat color={i % 2 ? L.stone : L.stone2} />
          </mesh>
        )
      })}

      {/* the plinth, the steps up to it and the drum */}
      <group position-y={HILL_H}>
        <mesh geometry={geo.plinth}>
          <Flat color={L.stone} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const h = (PLINTH * (3 - i)) / 3
          return (
            <mesh key={i} geometry={geo.box} position={[0, h / 2 - 0.03, PLINTH_R + 0.03 + i * 0.075]} scale={[0.28 - i * 0.01, h + 0.06, 0.08]}>
              <Flat color={i % 2 ? L.stone2 : L.stone} />
            </mesh>
          )
        })}
      </group>
      <group position-y={BASE}>
        <mesh geometry={geo.drum}>
          <Flat color={L.wall} />
        </mesh>
        <mesh geometry={geo.band} position-y={0.025}>
          <Flat color={L.wall2} />
        </mesh>
        <mesh geometry={geo.band} position-y={DRUM_H - 0.02}>
          <Flat color={L.trim} />
        </mesh>
        {/* the door, its fanlight and a lamp */}
        <group position-z={DRUM_R}>
          <mesh geometry={geo.box} position-y={0.135} scale={[0.2, 0.27, 0.04]}>
            <Flat color={L.trim} />
          </mesh>
          <mesh geometry={geo.box} position={[0, 0.12, 0.012]} scale={[0.15, 0.24, 0.04]}>
            <Flat color={L.door} />
          </mesh>
          <mesh geometry={geo.arch} position={[0, 0.27, 0.0]} scale={[0.2, 0.2, 0.04]}>
            <Flat color={L.trim} />
          </mesh>
          <mesh geometry={geo.arch} position={[0, 0.27, 0.012]} scale={[0.13, 0.13, 0.04]}>
            <meshStandardMaterial ref={mat(0)} color={L.glow} emissive={L.glow} emissiveIntensity={1.2} flatShading />
          </mesh>
          <mesh geometry={geo.box} position={[0.15, 0.27, 0.02]} scale={[0.045, 0.06, 0.045]}>
            <meshStandardMaterial ref={mat(1)} color={L.glow} emissive={L.glow} emissiveIntensity={1.2} flatShading />
          </mesh>
          <pointLight ref={lamp} color={L.glow} position={[0.1, 0.3, 0.25]} distance={1.6} decay={2} intensity={1.2} />
        </group>
        {/* round-topped windows round the drum */}
        {windows.map((a, i) => (
          <group key={i} position={[Math.sin(a) * DRUM_R, 0.25, Math.cos(a) * DRUM_R]} rotation-y={a}>
            <mesh geometry={geo.box} scale={[0.12, 0.15, 0.03]}>
              <Flat color={L.trim} />
            </mesh>
            <mesh geometry={geo.arch} position-y={0.075} scale={[0.12, 0.12, 0.03]}>
              <Flat color={L.trim} />
            </mesh>
            <mesh geometry={geo.box} position-z={0.01} scale={[0.08, 0.12, 0.03]}>
              <meshStandardMaterial ref={mat(2 + i)} color={L.glow} emissive={L.glow} emissiveIntensity={1.2} flatShading />
            </mesh>
            <mesh geometry={geo.arch} position={[0, 0.06, 0.01]} scale={[0.08, 0.08, 0.03]}>
              <meshStandardMaterial ref={mat(6 + i)} color={L.glow} emissive={L.glow} emissiveIntensity={1.2} flatShading />
            </mesh>
            <mesh geometry={geo.box} position={[0, -0.085, 0.02]} scale={[0.15, 0.025, 0.05]}>
              <Flat color={L.wall2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* the turning dome, its shutter and the telescope inside */}
      <group ref={dome} position-y={TOP}>
        <mesh geometry={geo.domeL}>
          <Flat color={L.dome} />
        </mesh>
        <mesh geometry={geo.domeR}>
          <Flat color={L.dome} />
        </mesh>
        <mesh geometry={geo.domeBack}>
          <Flat color={L.dome} />
        </mesh>
        <mesh geometry={geo.inner}>
          <Flat color="#23253a" side={THREE.BackSide} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={geo.rail} position-x={x * (DOME_R + 0.006) * Math.sin(SLIT + 0.04)}>
            <Flat color={L.trim} />
          </mesh>
        ))}
        <group ref={shutter}>
          <mesh geometry={geo.shutter}>
            <Flat color={L.shutter} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <group position-y={0.0}>
          <mesh geometry={geo.pier}>
            <Flat color="#5a5d70" />
          </mesh>
          <mesh geometry={geo.fork} position-y={0.12}>
            <Flat color="#3f4256" />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.arm} position={[x * 0.075, 0.16, 0]}>
              <Flat color="#3f4256" />
            </mesh>
          ))}
          <group ref={tilt} position-y={0.18}>
            <group ref={slide}>
              <mesh geometry={geo.tube}>
                <Flat color={L.scope} roughness={0.5} />
              </mesh>
              {[-0.1, 0.27].map((z) => (
                <mesh key={z} geometry={geo.ring} position-z={z}>
                  <Flat color={L.trim} />
                </mesh>
              ))}
              <mesh geometry={geo.lens} position-z={0.301}>
                <meshStandardMaterial color="#9fd0ff" emissive="#5a8fd8" emissiveIntensity={0.8} flatShading />
              </mesh>
              <mesh geometry={geo.finder} position={[0.05, 0.05, 0.08]}>
                <Flat color={L.trim} />
              </mesh>
              <mesh geometry={geo.eyepiece} position={[0, 0.06, -0.08]}>
                <Flat color="#2c2a33" />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {L.snow && <Particles geometry={geo.flake} count={40} life={7} origin={[0, 2.7, 0]} spread={1.5} velocity={[0.03, -0.32, 0]} scatter={0.03} drift={0.18} size={[0.016, 0.02]} colors={['#ffffff', '#e8f0ff']} opacity={[0.95, 0.6]} emissive={0.4} spin={1} seed={5} />}
    </group>
  )
}

export default function ObservatoryScene({ background, autoRotate, float, look = 'night', ...props }) {
  // the library's pale default would wash out a night sky, so swap it for the look's own
  const sky = !background || background.toLowerCase() === '#eceaf1' ? (LOOKS[look] || LOOKS.night).sky : background
  return (
    <Stage background={sky} autoRotate={autoRotate} float={float} camera={[3.1, 2.1, 4.25]} target={[0, 1.08, 0]} hint="The dome slowly turns, the windows glow and the stars twinkle on their own · tap it and the shutter slides back, the telescope tilts up and out, the stars flare and a shooting star streaks past · Look swaps night, dusk and snow · drag to orbit">
      <Observatory look={look} {...props} />
    </Stage>
  )
}
