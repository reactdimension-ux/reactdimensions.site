import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Hinge, Particles, Stage, blob, facet, pulse, useGeo, useTap } from './kit.jsx'

// A low-poly corner bakery on a patch of pavement: a painted shop front with
// a striped awning over a display window of loaves and cakes, a sign board
// with a golden loaf, a swinging pretzel sign, a glazed door, windows with
// flower boxes upstairs, a pitched tile roof and a chimney, and a bench out
// front. Warm smoke curls from the chimney, the awning's scallops flutter and
// the windows glow. Tap it and the door swings open, a baker's peel slides
// out with a fresh loaf that hops in a puff of flour, then goes back in.

const LOOKS = {
  classic: { wall: '#f3e5c6', shop: '#2f5d4a', trim: '#fbf5e8', roof: '#a54e38', roof2: '#8c412f', awn: ['#d9473c', '#fbf3e6'], door: '#2f5d4a', pave: '#d3ccbf', pave2: '#bbb3a5', glow: '#ffd28a', glowI: 0.75, lamp: 0.6, gold: '#d8a640', sky: null },
  pastel: { wall: '#f8dce1', shop: '#86c8b9', trim: '#fffaf4', roof: '#8fb0d4', roof2: '#7b9cc2', awn: ['#f2a0b5', '#fffaf4'], door: '#f2c94c', pave: '#ebe4dc', pave2: '#d9d0c6', glow: '#ffe2a8', glowI: 0.6, lamp: 0.5, gold: '#e6b84f', sky: null },
  evening: { wall: '#7d7262', shop: '#1b332e', trim: '#998f80', roof: '#4a2a24', roof2: '#3c221d', awn: ['#8a322c', '#b3a896'], door: '#1b332e', pave: '#57535f', pave2: '#48454f', glow: '#ffbf5c', glowI: 1.6, lamp: 2.4, gold: '#e8b448', sky: '#2b3150' },
}

const W = 1.3 // building width
const D = 0.8 // building depth
const FZ = 0.2 // front face (z)
const Y0 = 0.06 // pavement top
const H = 1.12 // wall height
const RH = 0.42 // roof rise
const DX = 0.27 // door centre (x)
const OPEN = 2.9 // seconds the door stands open

const LOAF = '#c98a45'
const CRUST = '#a96a32'

function gable(w, h, d) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)
}

// a loaf: a squashed faceted blob with slashes across its top
function Loaf({ geo, scale = 1, color = LOAF, slashes = 3, ...props }) {
  return (
    <group scale={scale} {...props}>
      <mesh geometry={geo.loaf}>
        <Flat color={color} />
      </mesh>
      {Array.from({ length: slashes }, (_, i) => (
        <mesh key={i} geometry={geo.slash} position={[(i - (slashes - 1) / 2) * 0.03, 0.033, 0]} rotation={[0, 0.5, 0]}>
          <Flat color="#f0d3a0" />
        </mesh>
      ))}
    </group>
  )
}

function Cake({ geo, L, ...props }) {
  return (
    <group {...props}>
      <mesh geometry={geo.stand}>
        <Flat color="#f4f1ea" />
      </mesh>
      <mesh geometry={geo.cake} position-y={0.03}>
        <Flat color={L.awn[0] === '#f2a0b5' ? '#c98ad6' : '#f2a7b8'} />
      </mesh>
      <mesh geometry={geo.icing} position-y={0.075}>
        <Flat color="#fff8ee" />
      </mesh>
      <mesh geometry={geo.cherry} position-y={0.095}>
        <Flat color="#d8283a" roughness={0.4} />
      </mesh>
    </group>
  )
}

export function Bakery({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(1)
  const glows = useRef([])
  const flaps = useRef([])
  const awning = useRef()
  const sign = useRef()
  const peel = useRef()
  const hop = useRef()
  const lamp = useRef()
  const doorLight = useRef()
  // the flour puff goes off as the loaf hops, a moment after the tap
  const puff = useMemo(() => ({ since: (t) => tap.since(t) - 0.8 }), [tap])

  const geo = useGeo(
    () => ({
      pave: facet(new THREE.BoxGeometry(2, Y0, 1.6, 4, 1, 3).translate(0, Y0 / 2, 0.1), 0.012, 1, [1, 0.3, 1], (x, y) => y < 0.001),
      kerb: new THREE.BoxGeometry(2.04, 0.05, 0.1),
      flag: new THREE.BoxGeometry(0.012, 0.004, 1.5),
      body: facet(new THREE.BoxGeometry(W, H, D, 3, 3, 2).translate(0, H / 2, 0), 0.004, 2),
      gable: gable(D, RH * 0.95, W),
      roof: new THREE.BoxGeometry(W + 0.16, 0.045, 1),
      ridge: new THREE.BoxGeometry(W + 0.18, 0.05, 0.06),
      chimney: facet(new THREE.BoxGeometry(0.16, 0.5, 0.16), 0.006, 3),
      ccap: new THREE.BoxGeometry(0.2, 0.04, 0.2),
      bar: new THREE.BoxGeometry(1, 1, 1),
      shopPanel: new THREE.BoxGeometry(1.2, 0.66, 0.03),
      fascia: new THREE.BoxGeometry(1.24, 0.15, 0.05),
      glass: new THREE.PlaneGeometry(0.48, 0.34),
      door: new THREE.BoxGeometry(0.26, 0.46, 0.03).translate(0.13, 0.23, 0),
      doorGlass: new THREE.BoxGeometry(0.16, 0.18, 0.035).translate(0.13, 0.32, 0),
      knob: new THREE.IcosahedronGeometry(0.014, 0),
      loaf: facet(new THREE.IcosahedronGeometry(0.05, 1).scale(1.5, 0.75, 0.9), 0.004, 4),
      slash: new THREE.BoxGeometry(0.008, 0.006, 0.045),
      baguette: facet(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6).rotateZ(Math.PI / 2), 0.002, 5),
      boule: facet(new THREE.IcosahedronGeometry(0.045, 1).scale(1, 0.75, 1), 0.004, 6),
      bun: blob(0.025, 7, 0),
      stand: new THREE.CylinderGeometry(0.06, 0.03, 0.03, 8),
      cake: new THREE.CylinderGeometry(0.06, 0.06, 0.06, 9),
      icing: facet(new THREE.CylinderGeometry(0.064, 0.062, 0.02, 9), 0.003, 8),
      cherry: blob(0.013, 9, 0),
      cupcake: new THREE.CylinderGeometry(0.025, 0.018, 0.03, 7),
      frosting: new THREE.ConeGeometry(0.028, 0.035, 7),
      stripe: new THREE.BoxGeometry(0.1, 0.012, 0.36).translate(0, 0, 0.18),
      scallop: new THREE.CylinderGeometry(0.05, 0.05, 0.012, 8, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(0),
      emblem: facet(new THREE.IcosahedronGeometry(0.05, 1).scale(1.5, 0.8, 0.4), 0.004, 10),
      pretzel: new THREE.TorusGeometry(0.045, 0.012, 4, 10),
      upWin: new THREE.BoxGeometry(0.2, 0.24, 0.02),
      shutter: new THREE.BoxGeometry(0.1, 0.26, 0.02),
      fbox: new THREE.BoxGeometry(0.24, 0.05, 0.07),
      flower: blob(0.028, 11, 0),
      leaf: blob(0.03, 12, 0),
      peel: new THREE.BoxGeometry(0.22, 0.014, 0.2),
      handle: new THREE.CylinderGeometry(0.01, 0.01, 0.5, 5).rotateX(Math.PI / 2).translate(0, 0, -0.33),
      lampBox: new THREE.CylinderGeometry(0.035, 0.05, 0.07, 6),
      lampTop: new THREE.ConeGeometry(0.055, 0.04, 6),
      puff: new THREE.IcosahedronGeometry(1, 0),
      planter: facet(new THREE.BoxGeometry(0.3, 0.12, 0.14).translate(0, 0.06, 0), 0.006, 13),
    }),
    [],
  )

  const isOpen = () => tap.since(clock.elapsedTime) < OPEN

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    glows.current.forEach((m, i) => m && (m.material.emissiveIntensity = L.glowI * (0.8 + pulse(t, 0.25, i * 1.7) * 0.4)))
    // the awning breathes in the breeze and its scallops flutter in a wave
    awning.current.rotation.x = 0.55 + 0.025 * Math.sin(t * 1.9) + 0.015 * Math.sin(t * 4.3)
    flaps.current.forEach((f, i) => f && (f.rotation.x = 0.18 * Math.sin(t * 4.2 - i * 0.7) + 0.08 * Math.sin(t * 7.1 - i * 1.3)))
    sign.current.rotation.x = 0.12 * Math.sin(t * 1.3)
    // the peel slides out through the door, the loaf hops, and back it goes
    const out = s < 0 ? 0 : s < 0.3 ? 0 : s < 0.75 ? THREE.MathUtils.smoothstep(s, 0.3, 0.75) : s < 2.2 ? 1 : 1 - THREE.MathUtils.smoothstep(s, 2.2, 2.7)
    peel.current.position.z = FZ - 0.35 + out * 0.68
    peel.current.visible = out > 0.001
    const hs = s - 0.8
    const jump = hs > 0 && hs < 0.5 ? Math.sin((hs / 0.5) * Math.PI) * 0.22 : 0
    const land = hs > 0.5 ? Math.exp(-(hs - 0.5) * 7) * Math.sin((hs - 0.5) * 22) * 0.25 : 0
    hop.current.position.y = 0.04 + jump
    hop.current.rotation.z = hs > 0 && hs < 0.5 ? (hs / 0.5) * Math.PI * 2 : 0
    hop.current.scale.set(1 + land * 0.5, 1 - land, 1 + land * 0.5)
    const lit = s < 0 ? 0 : s < OPEN ? Math.min(1, s * 4) : Math.max(0, 1 - (s - OPEN) * 3)
    doorLight.current.intensity = lit * 0.9
    lamp.current.intensity = L.lamp * (0.92 + 0.08 * Math.sin(t * 9))
  })

  const slope = Math.atan2(RH, D / 2)
  const slopeLen = Math.hypot(RH, D / 2) + 0.14
  const glass = <meshStandardMaterial color="#cfe6f2" transparent opacity={0.18} roughness={0.1} metalness={0.1} depthWrite={false} />

  return (
    <group {...handlers}>
      {/* pavement: flags, and a kerb along the front */}
      <mesh geometry={geo.pave}>
        <Flat color={L.pave} />
      </mesh>
      {[-0.5, 0, 0.5].map((x) => (
        <mesh key={x} geometry={geo.flag} position={[x, Y0 + 0.001, 0.1]}>
          <Flat color={L.pave2} />
        </mesh>
      ))}
      <mesh geometry={geo.kerb} position={[0, 0.03, 0.88]}>
        <Flat color={L.pave2} />
      </mesh>

      <group position-y={Y0}>
        {/* the building, roof and chimney */}
        <mesh geometry={geo.body} position-z={FZ - D / 2}>
          <Flat color={L.wall} />
        </mesh>
        <group position={[0, H, FZ - D / 2]}>
          <mesh geometry={geo.gable} rotation-y={Math.PI / 2}>
            <Flat color={L.wall} />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.roof} position={[0, RH / 2 + 0.02, sz * (D / 4 + 0.025)]} rotation-x={sz * slope} scale={[1, 1, slopeLen]}>
              <Flat color={sz > 0 ? L.roof : L.roof2} />
            </mesh>
          ))}
          <mesh geometry={geo.ridge} position-y={RH + 0.02}>
            <Flat color={L.roof2} />
          </mesh>
          <group position={[0.38, 0.36, -0.18]}>
            <mesh geometry={geo.chimney}>
              <Flat color="#b0603f" />
            </mesh>
            <mesh geometry={geo.ccap} position-y={0.26}>
              <Flat color="#7f4330" />
            </mesh>
          </group>
        </group>

        {/* upstairs: two shuttered windows with flower boxes */}
        {[-0.32, 0.32].map((x, i) => (
          <group key={x} position={[x, 0.95, FZ + 0.005]}>
            <mesh geometry={geo.bar} scale={[0.25, 0.29, 0.015]}>
              <Flat color={L.trim} />
            </mesh>
            <mesh ref={(el) => (glows.current[i] = el)} geometry={geo.upWin} position-z={0.006}>
              <Flat color={L.glow} emissive={L.glow} emissiveIntensity={L.glowI} />
            </mesh>
            <mesh geometry={geo.bar} position-z={0.018} scale={[0.014, 0.24, 0.01]}>
              <Flat color={L.trim} />
            </mesh>
            <mesh geometry={geo.bar} position-z={0.018} scale={[0.2, 0.014, 0.01]}>
              <Flat color={L.trim} />
            </mesh>
            {[-1, 1].map((sx) => (
              <mesh key={sx} geometry={geo.shutter} position={[sx * 0.18, 0, 0.004]}>
                <Flat color={L.shop} />
              </mesh>
            ))}
            <group position={[0, -0.16, 0.04]}>
              <mesh geometry={geo.fbox}>
                <Flat color="#8a5a3a" />
              </mesh>
              {[-0.08, -0.025, 0.03, 0.085].map((fx, j) => (
                <mesh key={fx} geometry={j % 2 ? geo.leaf : geo.flower} position={[fx, 0.04, 0]}>
                  <Flat color={j % 2 ? '#5f9a4a' : ['#f27aa6', '#f6c22e'][(i + j / 2) % 2]} />
                </mesh>
              ))}
            </group>
          </group>
        ))}

        {/* the shop front: painted panel, sign board, window and door */}
        <mesh geometry={geo.shopPanel} position={[0, 0.33, FZ + 0.015]}>
          <Flat color={L.shop} />
        </mesh>
        <group position={[0, 0.66, FZ + 0.04]}>
          <mesh geometry={geo.fascia}>
            <Flat color={L.shop} />
          </mesh>
          <mesh geometry={geo.bar} position-z={0.026} scale={[1.16, 0.11, 0.005]}>
            <Flat color={L.trim} />
          </mesh>
          <mesh geometry={geo.emblem} position-z={0.035}>
            <Flat color={L.gold} metalness={0.4} roughness={0.4} />
          </mesh>
          {[-1, 1].map((sx) =>
            [0, 1, 2].map((k) => (
              <mesh key={`${sx}${k}`} geometry={geo.bar} position={[sx * (0.16 + k * 0.1), 0, 0.032]} scale={[0.06, 0.025, 0.006]}>
                <Flat color={L.shop} />
              </mesh>
            )),
          )}
        </group>

        {/* the display window, a shallow bay of bread and cakes */}
        <group position={[-0.28, 0.38, FZ + 0.03]}>
          <mesh ref={(el) => (glows.current[2] = el)} geometry={geo.bar} position-z={0.0} scale={[0.48, 0.34, 0.01]}>
            <Flat color={L.glow} emissive={L.glow} emissiveIntensity={L.glowI} />
          </mesh>
          {[
            [0, -0.18, 0.56, 0.03, 0.18],
            [0, 0.18, 0.56, 0.03, 0.14],
            [-0.265, 0, 0.04, 0.4, 0.14],
            [0.265, 0, 0.04, 0.4, 0.14],
          ].map(([x, y, w, h, d], i) => (
            <mesh key={i} geometry={geo.bar} position={[x, y, d / 2 - 0.005]} scale={[w, h, d]}>
              <Flat color={L.trim} />
            </mesh>
          ))}
          {/* a lower shelf of loaves and a baguette, cakes on the upper */}
          <mesh geometry={geo.bar} position={[0, -0.02, 0.05]} scale={[0.48, 0.012, 0.09]}>
            <Flat color="#8a5a3a" />
          </mesh>
          <Loaf geo={geo} position={[-0.15, -0.135, 0.06]} />
          <mesh geometry={geo.boule} position={[0.0, -0.14, 0.06]}>
            <Flat color={CRUST} />
          </mesh>
          <Loaf geo={geo} position={[0.15, -0.135, 0.06]} scale={0.9} slashes={2} color="#d49a52" />
          <mesh geometry={geo.baguette} position={[0, -0.155, 0.11]} rotation-y={0.1}>
            <Flat color="#dba45e" />
          </mesh>
          <Cake geo={geo} L={L} position={[-0.13, 0.0, 0.05]} />
          {[0.03, 0.1, 0.17].map((x, i) => (
            <group key={x} position={[x, 0.0, 0.055]}>
              <mesh geometry={geo.cupcake} position-y={0.015}>
                <Flat color="#e9c27a" />
              </mesh>
              <mesh geometry={geo.frosting} position-y={0.047}>
                <Flat color={['#f7d9e4', '#fff6ea', '#c8e8dc'][i]} />
              </mesh>
            </group>
          ))}
          <mesh geometry={geo.glass} position-z={0.13}>
            {glass}
          </mesh>
        </group>

        {/* the striped awning over the window, with a fluttering scalloped edge */}
        <group ref={awning} position={[-0.28, 0.585, FZ + 0.03]}>
          {Array.from({ length: 6 }, (_, i) => (
            <group key={i} position-x={(i - 2.5) * 0.1}>
              <mesh geometry={geo.stripe}>
                <Flat color={L.awn[i % 2]} />
              </mesh>
              <group ref={(el) => (flaps.current[i] = el)} position={[0, 0, 0.36]}>
                <mesh geometry={geo.scallop} rotation-x={-0.55}>
                  <Flat color={L.awn[i % 2]} side={THREE.DoubleSide} />
                </mesh>
              </group>
            </group>
          ))}
        </group>

        {/* the door, the lit doorway behind it and a lamp over it */}
        <mesh geometry={geo.bar} position={[DX, 0.255, FZ + 0.02]} scale={[0.32, 0.52, 0.03]}>
          <Flat color={L.trim} />
        </mesh>
        <mesh geometry={geo.bar} position={[DX, 0.235, FZ + 0.034]} scale={[0.26, 0.46, 0.01]}>
          <Flat color="#ffd690" emissive="#ffae4a" emissiveIntensity={1.1} />
        </mesh>
        <Hinge open={isOpen} axis="y" angle={-1.75} stiffness={70} damping={9} position={[DX - 0.13, 0.005, FZ + 0.05]}>
          <mesh geometry={geo.door}>
            <Flat color={L.door} />
          </mesh>
          <mesh ref={(el) => (glows.current[3] = el)} geometry={geo.doorGlass}>
            <Flat color={L.glow} emissive={L.glow} emissiveIntensity={L.glowI} />
          </mesh>
          <mesh geometry={geo.knob} position={[0.22, 0.22, 0.024]}>
            <Flat color={L.gold} metalness={0.5} roughness={0.35} />
          </mesh>
        </Hinge>
        <pointLight ref={doorLight} color="#ffb84a" distance={1.6} decay={2} position={[DX, 0.3, FZ + 0.35]} intensity={0} />
        <group position={[DX, 0.56, FZ + 0.1]}>
          <mesh geometry={geo.bar} position-z={-0.04} scale={[0.015, 0.015, 0.09]}>
            <Flat color="#2d2a2a" />
          </mesh>
          <mesh geometry={geo.lampBox} position-y={-0.02}>
            <Flat color="#fff1c4" emissive="#ffc45c" emissiveIntensity={L.lamp > 1 ? 1.6 : 0.7} />
          </mesh>
          <mesh geometry={geo.lampTop} position-y={0.03}>
            <Flat color="#2d2a2a" />
          </mesh>
          <pointLight ref={lamp} color="#ffc45c" distance={1.4} decay={2} position={[0, -0.05, 0.08]} intensity={L.lamp} />
        </group>

        {/* the peel that brings a fresh loaf out through the door */}
        <group ref={peel} position={[DX, 0.24, FZ - 0.35]} visible={false}>
          <mesh geometry={geo.peel}>
            <Flat color="#c8955a" />
          </mesh>
          <mesh geometry={geo.handle}>
            <Flat color="#a8743e" />
          </mesh>
          <group ref={hop}>
            <Loaf geo={geo} scale={1.5} color="#d0913f" />
          </group>
          <Particles geometry={geo.puff} count={6} life={1.6} origin={[0, 0.06, 0]} spread={0.04} velocity={[0, 0.25, 0]} scatter={0.03} drift={0.06} size={[0.012, 0.04]} colors={['#fff6ea']} opacity={[0.6, 0]} seed={5} />
        </group>
        <group position={[DX, 0.24, FZ + 0.33]}>
          <Burst tap={puff} geometry={geo.puff} count={14} colors={['#ffffff', '#f6efe2']} speed={0.9} gravity={-0.4} size={0.035} life={1.1} origin={[0, 0.06, 0]} spread={0.8} up={0.7} seed={7} />
        </group>

        {/* the hanging pretzel sign on its bracket */}
        <group position={[0.66, 0.84, FZ + 0.02]}>
          <mesh geometry={geo.bar} position-z={0.12} scale={[0.015, 0.015, 0.25]}>
            <Flat color="#2d2a2a" />
          </mesh>
          <group ref={sign} position-z={0.18}>
            <mesh geometry={geo.bar} position-y={-0.05} scale={[0.008, 0.1, 0.008]}>
              <Flat color="#2d2a2a" />
            </mesh>
            <group position-y={-0.15} rotation-y={Math.PI / 2}>
              {[-1, 1].map((sx) => (
                <mesh key={sx} geometry={geo.pretzel} position-x={sx * 0.035}>
                  <Flat color={L.gold} metalness={0.35} roughness={0.45} />
                </mesh>
              ))}
              <mesh geometry={geo.pretzel} position-y={-0.045} scale={[1.3, 0.7, 1]}>
                <Flat color={L.gold} metalness={0.35} roughness={0.45} />
              </mesh>
            </group>
          </group>
        </group>

        {/* a bench by the window and a planter by the door */}
        <group position={[-0.42, 0, 0.6]}>
          <mesh geometry={geo.bar} position-y={0.12} scale={[0.5, 0.025, 0.14]}>
            <Flat color="#a8743e" />
          </mesh>
          <mesh geometry={geo.bar} position={[0, 0.21, -0.065]} scale={[0.5, 0.08, 0.02]}>
            <Flat color="#a8743e" />
          </mesh>
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <mesh geometry={geo.bar} position={[sx * 0.21, 0.055, 0]} scale={[0.025, 0.11, 0.12]}>
                <Flat color="#2d2a2a" />
              </mesh>
              <mesh geometry={geo.bar} position={[sx * 0.21, 0.17, -0.065]} scale={[0.02, 0.14, 0.02]}>
                <Flat color="#2d2a2a" />
              </mesh>
            </group>
          ))}
        </group>
        <group position={[0.68, 0, 0.42]}>
          <mesh geometry={geo.planter}>
            <Flat color="#8a5a3a" />
          </mesh>
          {[-0.09, -0.03, 0.03, 0.09].map((x, j) => (
            <mesh key={x} geometry={j % 2 ? geo.flower : geo.leaf} position={[x, 0.15, (j % 2) * 0.02]} scale={1.3}>
              <Flat color={j % 2 ? ['#f27aa6', '#f6c22e'][j >> 1] : '#5f9a4a'} />
            </mesh>
          ))}
        </group>

        <Particles geometry={geo.puff} count={12} life={3.4} origin={[0.38, H + 0.66, FZ - D / 2 - 0.18]} spread={0.03} velocity={[0.05, 0.32, 0]} scatter={0.06} drift={0.22} size={[0.04, 0.15]} colors={['#f1e2cd', '#e5d3bb']} opacity={[0.75, 0]} emissive={L.sky ? 0.25 : 0} seed={2} />
      </group>
    </group>
  )
}

export default function BakeryScene({ background, autoRotate, float, look = 'classic', ...props }) {
  // the library's pale default would wash out the evening, so swap it for the look's own sky
  const sky = (LOOKS[look] || LOOKS.classic).sky
  const bg = sky && (!background || background.toLowerCase() === '#eceaf1') ? sky : background
  return (
    <Stage background={bg} autoRotate={autoRotate} float={float} camera={[3.3, 2.4, 4.9]} target={[0, 0.7, 0.1]} hint="Warm smoke curls from the chimney, the awning flutters and the windows glow on their own · tap the bakery and the door swings open, a fresh loaf slides out on a peel and hops in a puff of flour, then goes back in · Look swaps classic, pastel and evening · drag to orbit">
      <Bakery look={look} {...props} />
    </Stage>
  )
}
