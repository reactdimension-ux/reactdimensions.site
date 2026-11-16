import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Hinge, Stage, TAU, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly food truck parked on a round of pavement: a tall box van with
// a stripe round it and a short cab with a windscreen and headlamps, a
// serving hatch in its side under a striped awning, a counter with a few
// cups on it, a chalk menu board on an A-frame by the cab and a sign on the
// roof topped with what it sells. Left alone, the awning flaps and ripples
// in the breeze and the roof sign bobs. Tap it and the hatch swings up on
// its hinge, the window lights up, the roof sign springs up and spins, a
// burst of confetti flies out, and a few seconds later it all shuts again.

const LOOKS = {
  tacos: { body: '#f2c23a', stripe: '#d8452f', hatch: '#e5b02c', awning: ['#d8452f', '#f7f1e3'], sign: '#3f9a4a', signText: '#f7f1e3', inside: '#ffcf7a', confetti: ['#d8452f', '#3f9a4a', '#f7f1e3', '#ff9a3c'], icon: 'taco' },
  'ice cream': { body: '#f7c9d9', stripe: '#6cc6d8', hatch: '#f2b6ca', awning: ['#ff8fb4', '#ffffff'], sign: '#6cc6d8', signText: '#ffffff', inside: '#fff0d0', confetti: ['#ff8fb4', '#6cc6d8', '#fff3a8', '#ffffff'], icon: 'cone' },
  coffee: { body: '#6a4632', stripe: '#e8d2b0', hatch: '#5a3a28', awning: ['#2f6b5a', '#f2ead8'], sign: '#e8d2b0', signText: '#5a3a28', inside: '#ffd59a', confetti: ['#e8d2b0', '#2f6b5a', '#c98a4a', '#ffffff'], icon: 'cup' },
  burgers: { body: '#d8392f', stripe: '#f2c23a', hatch: '#c4322a', awning: ['#ffffff', '#d8392f'], sign: '#f2c23a', signText: '#d8392f', inside: '#ffd27a', confetti: ['#f2c23a', '#ffffff', '#3f9a4a', '#ff7a3c'], icon: 'burger' },
}

const GY = 0.04 // top of the pavement
const WR = 0.17 // wheel radius
const BZ = 0.4 // half the box body's width
const WIN = { x: -0.25, w: 0.7, y0: GY + 0.55, y1: GY + 0.9 } // the serving window
const OPEN = 3.4 // seconds the hatch stays up
const AW = { len: 0.86, depth: 0.38, slope: 0.32, y: GY + 1.04, stripes: 8 } // the awning

// A striped flap in x/y, pinned along y = 0 and hanging to y = -depth, each
// stripe coloured by vertex so it can ripple as one sheet.
function awningGeo(colors) {
  const g = new THREE.PlaneGeometry(AW.len, AW.depth, AW.stripes * 2, 4).translate(0, -AW.depth / 2, 0).toNonIndexed()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let f = 0; f < p.count; f += 3) {
    const x = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3
    const k = Math.floor(((x + AW.len / 2) / AW.len) * AW.stripes)
    c.set(colors[k % 2])
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// What the truck sells, built about 0.3 tall on y = 0, for the roof sign.
function Icon({ kind, geo }) {
  if (kind === 'taco')
    return (
      <group>
        <mesh geometry={geo.shell} position-y={0.15}>
          <Flat color="#f2c45a" />
        </mesh>
        {[-0.1, -0.05, 0, 0.05, 0.1].map((x, i) => (
          <mesh key={x} geometry={geo.bit} position={[x, 0.15 + (i % 2) * 0.015, 0]} scale={[0.045, 0.04, 0.035]} rotation-y={i}>
            <Flat color={['#5fb043', '#d8452f', '#7a4a2a'][i % 3]} />
          </mesh>
        ))}
      </group>
    )
  if (kind === 'cone')
    return (
      <group>
        <mesh geometry={geo.wafer} position-y={0.1}>
          <Flat color="#e0a85a" />
        </mesh>
        <mesh geometry={geo.scoop} position-y={0.22} scale={0.09}>
          <Flat color="#ff9fc0" />
        </mesh>
        <mesh geometry={geo.scoop} position-y={0.32} scale={0.075}>
          <Flat color="#a8e6c8" />
        </mesh>
        <mesh geometry={geo.scoop} position-y={0.405} scale={0.028}>
          <Flat color="#e0283a" />
        </mesh>
      </group>
    )
  if (kind === 'cup')
    return (
      <group>
        <mesh geometry={geo.cup} position-y={0.1}>
          <Flat color="#f7f3ea" />
        </mesh>
        <mesh geometry={geo.sleeve} position-y={0.09}>
          <Flat color="#a8703a" />
        </mesh>
        <mesh geometry={geo.lid} position-y={0.215}>
          <Flat color="#3a2a22" />
        </mesh>
        {[-0.03, 0.035].map((x, i) => (
          <mesh key={x} geometry={geo.scoop} position={[x, 0.29 + i * 0.05, 0]} scale={0.03 - i * 0.005}>
            <Flat color="#ffffff" transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
    )
  return (
    <group>
      <mesh geometry={geo.bunLow} position-y={0.03}>
        <Flat color="#e0a050" />
      </mesh>
      <mesh geometry={geo.patty} position-y={0.085}>
        <Flat color="#6a3a22" />
      </mesh>
      <mesh geometry={geo.cheese} position-y={0.115} rotation-y={Math.PI / 4}>
        <Flat color="#ffd23a" />
      </mesh>
      <mesh geometry={geo.lettuce} position-y={0.13}>
        <Flat color="#5fb043" />
      </mesh>
      <mesh geometry={geo.bunTop} position-y={0.14} scale={[1, 0.75, 1]}>
        <Flat color="#e8a850" />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={geo.bit} position={[Math.cos(i * 1.3) * 0.08, 0.235 - (i % 2) * 0.012, Math.sin(i * 1.3) * 0.08]} scale={0.012}>
          <Flat color="#fbf3dc" />
        </mesh>
      ))}
    </group>
  )
}

export function FoodTruck({ look = 'tacos' }) {
  const L = LOOKS[look] || LOOKS.tacos
  const { tap, handlers, clock } = useTap(1.2)
  const icon = useRef()
  const inside = useRef()
  const lamp = useRef()
  const cups = useRef()
  const pop = useRef({ x: 0, v: 0 })
  const aw = useGeo(() => awningGeo(L.awning), [look])
  const awBase = useRef(null)

  const geo = useGeo(
    () => ({
      pave: facet(new THREE.CylinderGeometry(1.4, 1.44, GY, 16, 1).translate(0, GY / 2, 0), 0.025, 1, [1, 0.3, 1]),
      box: facet(new THREE.BoxGeometry(1.15, 0.82, BZ * 2), 0.006, 2),
      stripe: new THREE.BoxGeometry(1.162, 0.08, BZ * 2 + 0.012),
      roofLip: new THREE.BoxGeometry(1.18, 0.04, BZ * 2 + 0.03),
      cabLow: facet(new THREE.BoxGeometry(0.55, 0.34, 0.76), 0.006, 3),
      cabUp: facet(new THREE.BoxGeometry(0.38, 0.38, 0.74), 0.006, 4),
      windscreen: new THREE.BoxGeometry(0.02, 0.28, 0.62),
      sideWin: new THREE.BoxGeometry(0.26, 0.22, 0.01),
      bumper: new THREE.BoxGeometry(0.06, 0.08, 0.78),
      grille: new THREE.BoxGeometry(0.02, 0.12, 0.36),
      lamp: new THREE.BoxGeometry(0.02, 0.06, 0.1),
      chassis: new THREE.BoxGeometry(1.7, 0.1, 0.66),
      tyre: facet(new THREE.CylinderGeometry(WR, WR, 0.12, 12, 1).rotateX(Math.PI / 2), 0.004, 5),
      hub: new THREE.CylinderGeometry(WR * 0.5, WR * 0.5, 0.13, 8, 1).rotateX(Math.PI / 2),
      arch: new THREE.CylinderGeometry(WR + 0.04, WR + 0.04, 0.01, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2),
      inside: new THREE.BoxGeometry(WIN.w, WIN.y1 - WIN.y0, 0.01),
      frameH: new THREE.BoxGeometry(WIN.w + 0.06, 0.03, 0.02),
      frameV: new THREE.BoxGeometry(0.03, WIN.y1 - WIN.y0, 0.02),
      hatch: facet(new THREE.BoxGeometry(WIN.w + 0.04, WIN.y1 - WIN.y0 + 0.03, 0.025).translate(0, -(WIN.y1 - WIN.y0 + 0.03) / 2, 0.0125), 0.003, 6),
      handle: new THREE.BoxGeometry(0.1, 0.02, 0.03),
      counter: new THREE.BoxGeometry(WIN.w + 0.08, 0.03, 0.13),
      prop: new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4),
      cupS: new THREE.CylinderGeometry(0.025, 0.02, 0.06, 6),
      valance: new THREE.ConeGeometry(0.03, 0.05, 3).rotateX(Math.PI),
      awBar: new THREE.CylinderGeometry(0.012, 0.012, AW.len + 0.04, 5).rotateZ(Math.PI / 2),
      board: new THREE.BoxGeometry(0.28, 0.4, 0.02),
      boardFace: new THREE.BoxGeometry(0.24, 0.36, 0.005),
      chalk: new THREE.BoxGeometry(0.16, 0.014, 0.004),
      signPost: new THREE.BoxGeometry(0.03, 0.12, 0.03),
      sign: facet(new THREE.BoxGeometry(0.62, 0.17, 0.06), 0.004, 7),
      signFace: new THREE.BoxGeometry(0.54, 0.1, 0.01),
      signDot: new THREE.BoxGeometry(0.05, 0.05, 0.012),
      // the icons
      shell: new THREE.CylinderGeometry(0.15, 0.15, 0.09, 10, 1, false, Math.PI / 2, Math.PI).rotateX(-Math.PI / 2),
      bit: new THREE.IcosahedronGeometry(1, 0),
      wafer: facet(new THREE.ConeGeometry(0.085, 0.2, 8).rotateX(Math.PI), 0.003, 8),
      scoop: blob(1, 9),
      cup: facet(new THREE.CylinderGeometry(0.095, 0.072, 0.2, 10), 0.002, 10),
      sleeve: new THREE.CylinderGeometry(0.093, 0.083, 0.07, 10),
      lid: new THREE.CylinderGeometry(0.085, 0.1, 0.035, 10),
      bunLow: new THREE.CylinderGeometry(0.15, 0.135, 0.06, 10),
      patty: facet(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), 0.004, 11),
      cheese: new THREE.BoxGeometry(0.24, 0.012, 0.24),
      lettuce: facet(new THREE.CylinderGeometry(0.17, 0.165, 0.02, 10), 0.01, 12, [1, 0.4, 1]),
      bunTop: new THREE.SphereGeometry(0.15, 10, 4, 0, TAU, 0, Math.PI / 2),
      hit: new THREE.BoxGeometry(1.8, 1.4, 0.9),
    }),
    [],
  )

  const isOpen = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < OPEN
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const open = s >= 0 && s < OPEN
    // the awning ripples in waves running out from the wall
    const p = aw.attributes.position
    if (!awBase.current || awBase.current.length !== p.array.length) awBase.current = Float32Array.from(p.array)
    const b = awBase.current
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3]
      const u = -b[i * 3 + 1] / AW.depth
      p.setZ(i, u * (0.035 * Math.sin(u * 5 - t * 4.2 + x * 3) + 0.015 * Math.sin(x * 9 + t * 2.3)) + u * u * 0.02 * Math.sin(t * 1.3))
    }
    p.needsUpdate = true
    aw.computeVertexNormals()
    // the roof sign: a spring up to full size and a spin when it opens
    const d = Math.min(dt, 0.033)
    const P = pop.current
    P.v += (((open ? 1 : 0) - P.x) * 80 - P.v * 8) * d
    P.x += P.v * d
    icon.current.position.y = 0.11 + P.x * 0.12 + Math.sin(t * 2) * 0.012
    icon.current.scale.setScalar(Math.max(0.001, 0.62 + P.x * 0.42))
    icon.current.rotation.y = Math.sin(t * 0.9) * 0.35 + Math.min(1, Math.max(0, P.x)) * TAU
    // the window lights up while it is open
    const glow = open ? Math.min(1, s * 3) : Math.max(0, 1 - (s - OPEN) * 3)
    inside.current.material.emissiveIntensity = 0.12 + glow * 0.9
    lamp.current.intensity = glow * 1.6
    cups.current.visible = s >= 0.25 && s < OPEN + 0.2
  })

  const hh = WIN.y1 - WIN.y0
  return (
    <group {...handlers}>
      <mesh geometry={geo.pave}>
        <Flat color="#b9b6b0" />
      </mesh>
      {/* wheels, chassis and arches */}
      <mesh geometry={geo.chassis} position={[0, GY + 0.24, 0]}>
        <Flat color="#33343a" />
      </mesh>
      {[-0.5, 0.55].map((x) =>
        [-1, 1].map((sz) => (
          <group key={`${x}${sz}`} position={[x, GY + WR, sz * 0.34]}>
            <mesh geometry={geo.tyre}>
              <Flat color="#26262b" roughness={0.95} />
            </mesh>
            <mesh geometry={geo.hub}>
              <Flat color="#c9ccd2" metalness={0.4} roughness={0.4} />
            </mesh>
          </group>
        )),
      )}

      {/* the box body */}
      <mesh geometry={geo.box} position={[-0.275, GY + 0.67, 0]}>
        <Flat color={L.body} />
      </mesh>
      <mesh geometry={geo.stripe} position={[-0.275, GY + 0.42, 0]}>
        <Flat color={L.stripe} />
      </mesh>
      <mesh geometry={geo.roofLip} position={[-0.275, GY + 1.09, 0]}>
        <Flat color={L.stripe} />
      </mesh>
      {[-0.5].map((x) =>
        [-1, 1].map((sz) => (
          <mesh key={`${x}${sz}`} geometry={geo.arch} position={[x, GY + WR, sz * (BZ + 0.007)]}>
            <Flat color="#33343a" />
          </mesh>
        )),
      )}
      {/* the cab */}
      <mesh geometry={geo.cabLow} position={[0.575, GY + 0.43, 0]}>
        <Flat color={L.body} />
      </mesh>
      <mesh geometry={geo.cabUp} position={[0.49, GY + 0.79, 0]}>
        <Flat color={L.body} />
      </mesh>
      <mesh geometry={geo.windscreen} position={[0.685, GY + 0.8, 0]}>
        <Flat color="#a9d4e6" roughness={0.15} metalness={0.2} />
      </mesh>
      {[-1, 1].map((sz) => (
        <mesh key={sz} geometry={geo.sideWin} position={[0.5, GY + 0.82, sz * 0.372]}>
          <Flat color="#a9d4e6" roughness={0.15} metalness={0.2} />
        </mesh>
      ))}
      <mesh geometry={geo.bumper} position={[0.86, GY + 0.3, 0]}>
        <Flat color="#c9ccd2" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.bumper} position={[-0.86, GY + 0.3, 0]}>
        <Flat color="#c9ccd2" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.grille} position={[0.855, GY + 0.45, 0]}>
        <Flat color="#33343a" />
      </mesh>
      {[-1, 1].map((sz) => (
        <mesh key={sz} geometry={geo.lamp} position={[0.856, GY + 0.47, sz * 0.27]}>
          <Flat color="#fff4c4" emissive="#ffe08a" emissiveIntensity={0.9} />
        </mesh>
      ))}

      {/* the serving window: a lit interior, a frame, a counter with cups */}
      <mesh ref={inside} geometry={geo.inside} position={[WIN.x, (WIN.y0 + WIN.y1) / 2, BZ + 0.004]}>
        <Flat color={L.inside} emissive={L.inside} emissiveIntensity={0.12} />
      </mesh>
      {[WIN.y0, WIN.y1].map((y) => (
        <mesh key={y} geometry={geo.frameH} position={[WIN.x, y, BZ + 0.01]}>
          <Flat color={L.stripe} />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={geo.frameV} position={[WIN.x + (sx * (WIN.w + 0.03)) / 2, (WIN.y0 + WIN.y1) / 2, BZ + 0.01]}>
          <Flat color={L.stripe} />
        </mesh>
      ))}
      <mesh geometry={geo.counter} position={[WIN.x, WIN.y0 - 0.01, BZ + 0.06]}>
        <Flat color="#e8e4dc" />
      </mesh>
      {/* cups set out on the counter while it is open */}
      <group ref={cups} visible={false}>
        {[-0.22, -0.12, 0.18].map((x, i) => (
          <mesh key={x} geometry={geo.cupS} position={[WIN.x + x, WIN.y0 + 0.035, BZ + 0.07]}>
            <Flat color={i === 1 ? L.stripe : '#f7f3ea'} />
          </mesh>
        ))}
      </group>
      <pointLight ref={lamp} color={L.inside} distance={1.6} decay={2} position={[WIN.x, WIN.y0 + 0.15, BZ + 0.35]} intensity={0} />
      {/* the hatch, hinged along its top edge, swings up and out */}
      <Hinge open={isOpen} axis="x" angle={-1.18} stiffness={60} damping={10} position={[WIN.x, WIN.y1 + 0.015, BZ + 0.012]}>
        <mesh geometry={geo.hatch}>
          <Flat color={L.hatch} />
        </mesh>
        <mesh geometry={geo.handle} position={[0, -hh + 0.01, 0.035]}>
          <Flat color="#33343a" />
        </mesh>
      </Hinge>

      {/* the striped awning above it, flapping in the breeze */}
      <group position={[WIN.x, AW.y, BZ + 0.01]} rotation-x={AW.slope - Math.PI / 2}>
        <mesh geometry={aw}>
          <Flat vertexColors color="#ffffff" side={THREE.DoubleSide} roughness={0.85} />
        </mesh>
      </group>
      <mesh geometry={geo.awBar} position={[WIN.x, AW.y, BZ + 0.015]}>
        <Flat color="#33343a" />
      </mesh>
      {/* a valance of little points along the awning's front edge */}
      {Array.from({ length: AW.stripes }, (_, i) => (
        <mesh key={i} geometry={geo.valance} position={[WIN.x - AW.len / 2 + (i + 0.5) * (AW.len / AW.stripes), AW.y - Math.sin(AW.slope) * AW.depth - 0.03, BZ + 0.01 + Math.cos(AW.slope) * AW.depth]}>
          <Flat color={L.awning[i % 2]} />
        </mesh>
      ))}

      {/* the chalk menu board on an A-frame by the cab */}
      <group position={[0.75, GY, 0.82]} rotation-y={0.5}>
        {[-1, 1].map((sz) => (
          <group key={sz} position={[0, 0.19, sz * 0.05]} rotation-x={sz * 0.24}>
            <mesh geometry={geo.board}>
              <Flat color="#8a5a36" />
            </mesh>
            <mesh geometry={geo.boardFace} position-z={sz * 0.012}>
              <Flat color="#2b2d33" />
            </mesh>
            {[0.12, 0.06, 0.0, -0.06, -0.12].map((y, i) => (
              <mesh key={y} geometry={geo.chalk} position={[i === 0 ? 0 : -0.015, y, sz * 0.016]} scale={[i === 0 ? 1.1 : 0.7 + (i % 2) * 0.2, i === 0 ? 1.6 : 1, 1]}>
                <Flat color={i === 0 ? L.sign : '#efefe8'} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* the roof sign and what it sells, which springs up on a tap */}
      <group position={[-0.3, GY + 1.11, 0]}>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} geometry={geo.signPost} position={[x, 0.06, 0]}>
            <Flat color="#33343a" />
          </mesh>
        ))}
        <group position-y={0.2}>
          <mesh geometry={geo.sign}>
            <Flat color={L.sign} />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.signFace} position-z={sz * 0.031}>
              <Flat color={L.signText} emissive={L.signText} emissiveIntensity={0.15} />
            </mesh>
          ))}
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} geometry={geo.signDot} position={[sx * 0.24, 0, sz * 0.032]}>
                <Flat color={L.stripe} />
              </mesh>
            )),
          )}
          <group ref={icon} position-y={0.11}>
            <Icon kind={L.icon} geo={geo} />
          </group>
        </group>
      </group>

      <Burst tap={tap} count={22} colors={L.confetti} speed={1.7} gravity={3} size={0.045} life={1.4} origin={[WIN.x, (WIN.y0 + WIN.y1) / 2, BZ + 0.2]} spread={0.9} up={1.1} seed={6} />
      {/* an invisible box round the truck, so every tap lands */}
      <mesh geometry={geo.hit} position={[0, GY + 0.7, 0]}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function FoodTruckScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.1, 4.6]} target={[0, 0.82, 0]} hint="The striped awning flaps in the breeze on its own · tap the truck and the serving hatch swings up, the window lights and the roof sign springs up in a burst of confetti · Look swaps tacos, ice cream, coffee and burgers · drag to orbit">
      <FoodTruck {...props} />
    </Stage>
  )
}
