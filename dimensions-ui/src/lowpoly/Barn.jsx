import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Hinge, Stage, blob, cone, facet, useGeo, useKick, useTap, wobble } from './kit.jsx'

// A low-poly farmyard: a barn with a gambrel roof, white corner and gable
// trim, a pair of X-braced doors and a hay loft window, a tall banded silo
// with a dome cap beside it, a weathervane (arrow, compass arms and a
// rooster) on the roof ridge, and a bit of rail fence on the grass. Left
// alone, the weathervane swings round slowly, gusting this way and that in
// the wind. Tap it and both barn doors swing open on their hinges to show
// hay bales inside, a puff of hay and feathers bursts out, the vane gives a
// startled spin, and a few seconds later the doors swing shut.

const LOOKS = {
  red: { wall: '#b8392e', roof: '#4a4a52', trim: '#f4f1ea', silo: '#c9cdd2', band: '#9aa0a8', dome: '#8d949c', door: '#a8322a' },
  white: { wall: '#f0ece2', roof: '#7a2e2a', trim: '#b8392e', silo: '#a8b0b8', band: '#7f8890', dome: '#7a2e2a', door: '#e4dfd2' },
  grey: { wall: '#8a8d92', roof: '#3a3c42', trim: '#f4f1ea', silo: '#b8bcc2', band: '#8f949b', dome: '#5c6068', door: '#7c7f85' },
  blue: { wall: '#3f6fa8', roof: '#2f3a4a', trim: '#f4f1ea', silo: '#d8dde2', band: '#a9b2bc', dome: '#3f6fa8', door: '#386398' },
}

const GY = 0.06 // top of the lawn
const BX = -0.27 // the barn's centre (x)
const BW = 1.0 // barn width (x)
const BD = 1.0 // barn depth (z)
const EAVE = 0.6
const KNEE = [0.3, 0.88]
const RIDGE = 1.02
const DW = 0.46 // door opening
const DH = 0.48
const SX = 0.62 // silo
const SZ = -0.18
const SR = 0.26
const SH = 1.2
const OPEN = 3

// The barn's end: walls up to the eaves, a gambrel roof (steep, then
// shallow), and a notch at the foot for the doorway, which the extrusion
// turns into a passage through the barn.
function barnShape() {
  const s = new THREE.Shape()
  const w = BW / 2
  s.moveTo(-w, 0)
  s.lineTo(-DW / 2, 0)
  s.lineTo(-DW / 2, DH)
  s.lineTo(DW / 2, DH)
  s.lineTo(DW / 2, 0)
  s.lineTo(w, 0)
  s.lineTo(w, EAVE)
  s.lineTo(KNEE[0], KNEE[1])
  s.lineTo(0, RIDGE)
  s.lineTo(-KNEE[0], KNEE[1])
  s.lineTo(-w, EAVE)
  s.closePath()
  return s
}

// The roof line, eave to ridge, on the right; the left is its mirror.
const ROOF = [
  [[BW / 2, EAVE], KNEE],
  [KNEE, [0, RIDGE]],
]

// One door leaf, hinged at x = 0 and reaching out along +x: boards, a white
// frame and an X brace.
function Leaf({ geo, L }) {
  const w = DW / 2
  const diag = Math.atan2(DH - 0.04, w - 0.04)
  return (
    <group>
      <mesh geometry={geo.leaf} position={[w / 2, DH / 2, 0]}>
        <Flat color={L.door} />
      </mesh>
      {[0.015, DH - 0.015].map((y) => (
        <mesh key={y} geometry={geo.trimH} position={[w / 2, y, 0.016]}>
          <Flat color={L.trim} />
        </mesh>
      ))}
      {[0.015, w - 0.015].map((x) => (
        <mesh key={x} geometry={geo.trimV} position={[x, DH / 2, 0.016]}>
          <Flat color={L.trim} />
        </mesh>
      ))}
      {[-1, 1].map((k) => (
        <mesh key={k} geometry={geo.brace} position={[w / 2, DH / 2, 0.018]} rotation-z={k * diag}>
          <Flat color={L.trim} />
        </mesh>
      ))}
    </group>
  )
}

export function Barn({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1.2)
  const puff = useKick(2)
  const fired = useRef(-99)
  const vane = useRef()

  const geo = useGeo(
    () => ({
      lawn: facet(new THREE.CylinderGeometry(1.5, 1.55, GY, 16, 1).translate(0, GY / 2, 0), 0.03, 1, [1, 0.3, 1]),
      path: facet(new THREE.BoxGeometry(0.56, 0.012, 0.62), 0.01, 2, [1, 0, 1]),
      barn: facet(new THREE.ExtrudeGeometry(barnShape(), { depth: BD, bevelEnabled: false }).translate(0, 0, -BD / 2), 0.004, 3),
      roof: facet(new THREE.BoxGeometry(1, 0.045, BD + 0.14), 0.004, 4),
      ridge: new THREE.BoxGeometry(0.07, 0.04, BD + 0.16),
      trim: new THREE.BoxGeometry(1, 0.035, 0.015),
      corner: new THREE.BoxGeometry(0.04, EAVE, 0.04),
      inside: new THREE.BoxGeometry(DW - 0.004, DH - 0.004, 0.5),
      backFill: new THREE.BoxGeometry(DW, DH, BD - 0.5),
      doorTop: new THREE.BoxGeometry(DW + 0.08, 0.04, 0.025),
      doorSide: new THREE.BoxGeometry(0.035, DH, 0.025),
      leaf: facet(new THREE.BoxGeometry(DW / 2 - 0.004, DH - 0.004, 0.025), 0.002, 5),
      trimH: new THREE.BoxGeometry(DW / 2 - 0.01, 0.03, 0.01),
      trimV: new THREE.BoxGeometry(0.03, DH, 0.01),
      brace: new THREE.BoxGeometry(Math.hypot(DW / 2 - 0.04, DH - 0.04), 0.026, 0.01),
      bale: facet(new THREE.BoxGeometry(0.2, 0.12, 0.13), 0.008, 6),
      twine: new THREE.BoxGeometry(0.008, 0.125, 0.135),
      loft: new THREE.BoxGeometry(0.17, 0.15, 0.02),
      loftFrame: new THREE.BoxGeometry(0.22, 0.2, 0.012),
      loftBar: new THREE.BoxGeometry(0.2, 0.02, 0.02),
      beam: new THREE.BoxGeometry(0.04, 0.04, 0.16),
      straw: cone(0.05, 0.09, 4, 7),
      silo: facet(new THREE.CylinderGeometry(SR, SR, SH, 12, 4).translate(0, SH / 2, 0), 0.004, 8, [1, 0, 1]),
      band: new THREE.CylinderGeometry(SR + 0.012, SR + 0.012, 0.03, 12, 1),
      dome: facet(new THREE.SphereGeometry(SR + 0.015, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0.004, 9, [1, 1, 1], (x, y) => y < 0.001),
      vent: new THREE.ConeGeometry(0.05, 0.08, 6),
      rail: new THREE.BoxGeometry(0.025, SH * 0.82, 0.025),
      rung: new THREE.BoxGeometry(0.1, 0.015, 0.015),
      // the weathervane
      vPost: new THREE.CylinderGeometry(0.012, 0.016, 0.34, 5).translate(0, 0.17, 0),
      arm: new THREE.BoxGeometry(0.28, 0.012, 0.012),
      ball: new THREE.IcosahedronGeometry(0.025, 0),
      shaft: new THREE.BoxGeometry(0.42, 0.014, 0.014),
      head: new THREE.ConeGeometry(0.04, 0.09, 4).rotateZ(-Math.PI / 2),
      fin: new THREE.BoxGeometry(0.09, 0.08, 0.008),
      rBody: blob(0.055, 10, 0),
      rTail: new THREE.ConeGeometry(0.045, 0.1, 4),
      rHead: blob(0.03, 11, 0),
      rComb: new THREE.BoxGeometry(0.03, 0.025, 0.008),
      rBeak: new THREE.ConeGeometry(0.012, 0.03, 3).rotateZ(-Math.PI / 2),
      rLeg: new THREE.BoxGeometry(0.008, 0.05, 0.008),
      // the fence
      fPost: facet(new THREE.BoxGeometry(0.05, 0.26, 0.05).translate(0, 0.13, 0), 0.004, 12),
      fRail: new THREE.BoxGeometry(0.62, 0.03, 0.02),
      hay: new THREE.TetrahedronGeometry(1, 0),
      feather: new THREE.BoxGeometry(1, 0.15, 0.45),
      hit: new THREE.BoxGeometry(1.75, 1.3, 1.15),
    }),
    [],
  )
  const isOpen = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < OPEN
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the hay flies out once the doors are part way open
    if (s >= 0.28 && s < 1 && Math.abs(fired.current - (t - s)) > 0.01) {
      fired.current = t - s
      puff.kick(t)
    }
    // the vane gusts round, and spins in a fright on a tap
    vane.current.rotation.y = 0.7 + 0.9 * Math.sin(t * 0.23) + 0.3 * Math.sin(t * 0.81 + 1) + 0.06 * Math.sin(t * 3.1) + wobble(s, 7, 1.4) * 1.6
  })

  const front = BD / 2 + 0.008
  return (
    <group {...handlers}>
      <mesh geometry={geo.lawn}>
        <Flat color="#7fb24f" />
      </mesh>
      <mesh geometry={geo.path} position={[BX, GY + 0.006, BD / 2 + 0.31]}>
        <Flat color="#b8956a" />
      </mesh>

      <group position={[BX, GY, 0]}>
        {/* the barn, with its passage closed off behind the doorway */}
        <mesh geometry={geo.barn}>
          <Flat color={L.wall} />
        </mesh>
        <mesh geometry={geo.backFill} position={[0, DH / 2, -BD / 2 + (BD - 0.5) / 2]}>
          <Flat color={L.wall} />
        </mesh>
        {/* the dark interior, drawn from inside, with hay bales on the floor */}
        <mesh geometry={geo.inside} position={[0, DH / 2, BD / 2 - 0.25]}>
          <Flat color="#4a3524" side={THREE.BackSide} />
        </mesh>
        {[
          [-0.1, 0.06, 0.2, 0.2],
          [0.1, 0.06, 0.16, -0.15],
          [-0.02, 0.18, 0.12, 0.1],
          [0.08, 0.06, 0.36, 0.5],
        ].map(([x, y, z, r], i) => (
          <group key={i} position={[x, y, z]} rotation-y={r}>
            <mesh geometry={geo.bale}>
              <Flat color={i % 2 ? '#d8b24a' : '#e6c25a'} />
            </mesh>
            {[-0.05, 0.05].map((tx) => (
              <mesh key={tx} geometry={geo.twine} position-x={tx}>
                <Flat color="#a8823a" />
              </mesh>
            ))}
          </group>
        ))}
        {/* the roof: two steep and two shallow slopes, and a ridge cap */}
        {[-1, 1].map((m) =>
          ROOF.map(([a, b], i) => {
            const dx = b[0] - a[0]
            const dy = b[1] - a[1]
            const len = Math.hypot(dx, dy)
            const nx = dy / len
            const ny = -dx / len
            return (
              <mesh key={`${m}${i}`} geometry={geo.roof} position={[m * ((a[0] + b[0]) / 2 + nx * 0.022), (a[1] + b[1]) / 2 + ny * 0.022, 0]} rotation-z={m * Math.atan2(dy, dx)} scale={[len + (i === 0 ? 0.1 : 0.02), 1, 1]}>
                <Flat color={L.roof} />
              </mesh>
            )
          }),
        )}
        <mesh geometry={geo.ridge} position-y={RIDGE + 0.03}>
          <Flat color={L.roof} />
        </mesh>
        {/* white trim: corners, gable edges front and back, the doorway */}
        {[-1, 1].map((mx) =>
          [-1, 1].map((mz) => (
            <mesh key={`${mx}${mz}`} geometry={geo.corner} position={[mx * (BW / 2 - 0.012), EAVE / 2, mz * (BD / 2 - 0.012)]}>
              <Flat color={L.trim} />
            </mesh>
          )),
        )}
        {[-1, 1].map((mz) =>
          [-1, 1].map((m) =>
            ROOF.map(([a, b], i) => {
              const dx = b[0] - a[0]
              const dy = b[1] - a[1]
              return (
                <mesh key={`${mz}${m}${i}`} geometry={geo.trim} position={[(m * (a[0] + b[0])) / 2, (a[1] + b[1]) / 2 - 0.012, mz * front]} rotation-z={m * Math.atan2(dy, dx)} scale={[Math.hypot(dx, dy) + 0.02, 1, 1]}>
                  <Flat color={L.trim} />
                </mesh>
              )
            }),
          ),
        )}
        <mesh geometry={geo.doorTop} position={[0, DH + 0.02, front + 0.004]}>
          <Flat color={L.trim} />
        </mesh>
        {[-1, 1].map((m) => (
          <mesh key={m} geometry={geo.doorSide} position={[m * (DW / 2 + 0.017), DH / 2, front + 0.004]}>
            <Flat color={L.trim} />
          </mesh>
        ))}
        {/* the doors, hinged at the sides of the doorway, opening outward */}
        <Hinge open={isOpen} axis="y" angle={-1.95} stiffness={55} damping={8} position={[-DW / 2, 0, BD / 2 + 0.02]}>
          <Leaf geo={geo} L={L} />
        </Hinge>
        <Hinge open={isOpen} axis="y" angle={1.95} stiffness={55} damping={8} position={[DW / 2, 0, BD / 2 + 0.02]}>
          <group scale={[-1, 1, 1]}>
            <Leaf geo={geo} L={L} />
          </group>
        </Hinge>
        {/* the hay loft window with a hoist beam above and hay poking out */}
        <group position={[0, 0.74, front]}>
          <mesh geometry={geo.loftFrame}>
            <Flat color={L.trim} />
          </mesh>
          <mesh geometry={geo.loft} position-z={0.004}>
            <Flat color="#3a2a1e" />
          </mesh>
          {[-0.05, 0, 0.05].map((x, i) => (
            <mesh key={x} geometry={geo.straw} position={[x, -0.075, 0.02]} rotation={[0.6, i, 0]}>
              <Flat color="#e6c25a" />
            </mesh>
          ))}
          <mesh geometry={geo.beam} position={[0, 0.19, 0.06]}>
            <Flat color="#6e4a34" />
          </mesh>
        </group>
        {/* the weathervane on the ridge */}
        <group position={[0, RIDGE + 0.04, 0]}>
          <mesh geometry={geo.vPost}>
            <Flat color="#2b2b31" metalness={0.4} roughness={0.5} />
          </mesh>
          <group position-y={0.18}>
            <mesh geometry={geo.arm}>
              <Flat color="#2b2b31" metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh geometry={geo.arm} rotation-y={Math.PI / 2}>
              <Flat color="#2b2b31" metalness={0.4} roughness={0.5} />
            </mesh>
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} geometry={geo.ball} position={[Math.cos((k * Math.PI) / 2) * 0.14, 0, Math.sin((k * Math.PI) / 2) * 0.14]} scale={0.6}>
                <Flat color="#d9ab3a" metalness={0.5} roughness={0.4} />
              </mesh>
            ))}
          </group>
          <mesh geometry={geo.ball} position-y={0.34}>
            <Flat color="#d9ab3a" metalness={0.5} roughness={0.4} />
          </mesh>
          <group ref={vane} position-y={0.36}>
            <mesh geometry={geo.shaft}>
              <Flat color="#2b2b31" metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh geometry={geo.head} position-x={0.24}>
              <Flat color="#2b2b31" metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh geometry={geo.fin} position-x={-0.19}>
              <Flat color="#2b2b31" metalness={0.4} roughness={0.5} />
            </mesh>
            {/* the rooster, facing along the arrow */}
            <group position-y={0.04}>
              {[-0.012, 0.012].map((z) => (
                <mesh key={z} geometry={geo.rLeg} position={[0, 0.02, z]}>
                  <Flat color="#2b2b31" />
                </mesh>
              ))}
              <mesh geometry={geo.rBody} position-y={0.08} scale={[1.2, 0.85, 0.55]}>
                <Flat color="#2b2b31" metalness={0.4} roughness={0.5} />
              </mesh>
              <mesh geometry={geo.rTail} position={[-0.07, 0.12, 0]} rotation-z={0.6} scale={[1, 1, 0.3]}>
                <Flat color="#2b2b31" metalness={0.4} roughness={0.5} />
              </mesh>
              <mesh geometry={geo.rHead} position={[0.06, 0.15, 0]} scale={[1, 1, 0.7]}>
                <Flat color="#2b2b31" metalness={0.4} roughness={0.5} />
              </mesh>
              <mesh geometry={geo.rComb} position={[0.06, 0.185, 0]}>
                <Flat color="#c8352c" />
              </mesh>
              <mesh geometry={geo.rBeak} position={[0.095, 0.15, 0]}>
                <Flat color="#d9ab3a" />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* the silo, banded, with a dome cap and a ladder */}
      <group position={[SX, GY, SZ]}>
        <mesh geometry={geo.silo}>
          <Flat color={L.silo} metalness={0.15} roughness={0.6} />
        </mesh>
        {[0.25, 0.55, 0.85, 1.15].map((y) => (
          <mesh key={y} geometry={geo.band} position-y={y}>
            <Flat color={L.band} metalness={0.2} roughness={0.55} />
          </mesh>
        ))}
        <mesh geometry={geo.dome} position-y={SH}>
          <Flat color={L.dome} metalness={0.2} roughness={0.5} />
        </mesh>
        <mesh geometry={geo.vent} position-y={SH + SR + 0.04}>
          <Flat color={L.band} />
        </mesh>
        <group rotation-y={0.75}>
          {[-0.045, 0.045].map((x) => (
            <mesh key={x} geometry={geo.rail} position={[x, SH * 0.45, SR + 0.03]}>
              <Flat color="#6a6e76" />
            </mesh>
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} geometry={geo.rung} position={[0, 0.12 + i * 0.11, SR + 0.03]}>
              <Flat color="#6a6e76" />
            </mesh>
          ))}
        </group>
      </group>

      {/* a run of rail fence */}
      <group position={[-1.0, GY, 0.82]} rotation-y={0.45}>
        {[-0.3, 0, 0.3].map((x) => (
          <mesh key={x} geometry={geo.fPost} position-x={x}>
            <Flat color="#8a6a4a" />
          </mesh>
        ))}
        {[0.1, 0.2].map((y) => (
          <mesh key={y} geometry={geo.fRail} position={[0, y, 0.03]}>
            <Flat color="#9c7a56" />
          </mesh>
        ))}
      </group>

      {/* hay and feathers blown out of the doorway */}
      <Burst tap={puff} geometry={geo.hay} count={16} colors={['#e6c25a', '#d8b24a', '#f2d77a']} speed={1.5} gravity={2.4} size={0.04} life={1.4} origin={[BX, GY + 0.22, BD / 2 + 0.12]} spread={0.9} up={0.9} seed={5} />
      <Burst tap={puff} geometry={geo.feather} count={6} colors={['#ffffff', '#f2ece0']} speed={1.1} gravity={0.9} size={0.07} life={1.8} origin={[BX, GY + 0.3, BD / 2 + 0.12]} spread={0.8} up={1.3} seed={9} />
      {/* an invisible box round the barn and silo, so every tap lands */}
      <mesh geometry={geo.hit} position={[0.06, GY + 0.65, 0]}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function BarnScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.2, 4.6]} target={[0, 0.65, 0]} hint="The weathervane swings round in the wind on its own · tap the barn and its doors swing open on the hay, with a puff of hay and feathers · Look swaps red, white, grey and blue · drag to orbit">
      <Barn {...props} />
    </Stage>
  )
}
