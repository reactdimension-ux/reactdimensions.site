import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, TAU, blob, cone, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly crab on a little patch of beach: a broad, flattened faceted
// shell with a few bumps and a toothed front edge, two eyes on stalks, small
// mouthparts, two big claws on jointed arms, each with a fixed and a moving
// pincer, and four jointed walking legs a side, angled down to points. A
// couple of shells and pebbles lie about and foam laps at one edge. Left
// alone, it scuttles sideways across the sand and back, its legs stepping in
// two alternating sets and its body bobbing, claws held up and working
// slowly, eye stalks twitching. Tap it and it stops, throws both claws up
// high and snaps them shut again and again, its eyes shooting up on their
// stalks, with a puff of sand and a ring across the beach.

const LOOKS = {
  red: { shell: '#d8442f', dark: '#a52e1e', belly: '#f3c9a2', leg: '#c93b28', tip: '#3a2420', bump: '#e8604a' },
  blue: { shell: '#3a6fb0', dark: '#2a5288', belly: '#eadfc4', leg: '#4a82c4', tip: '#d8402c', bump: '#5a8ccc' },
  orange: { shell: '#ee7a2a', dark: '#c25a18', belly: '#fbe0b4', leg: '#f08a3c', tip: '#4a2a18', bump: '#f89a50' },
  sand: { shell: '#e2c994', dark: '#b89a62', belly: '#f6ecd2', leg: '#dcc08a', tip: '#7a6040', bump: '#ecd8aa' },
}

const BODY_Y = 0.27
const LEG_Z = [0.13, 0.03, -0.07, -0.16]
const LEG_FAN = [0.55, 0.18, -0.2, -0.6]
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
// a long along-z rod from the origin: a limb segment
const rod = (r0, r1, len, n, seed) => facet(new THREE.CylinderGeometry(r1, r0, len, n, 1).translate(0, len / 2, 0).rotateX(Math.PI / 2), r0 * 0.08, seed)

export function Crab({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1.2)
  const walker = useRef()
  const body = useRef()
  const legs = useRef([])
  const arms = useRef([])
  const stalks = useRef([])
  const foam = useRef()
  const st = useRef({ wt: 0, p: 0, x: 0 })

  const geo = useGeo(
    () => {
      // the shell: an icosphere, flattened, wider than long, its belly flatter still
      const shell = new THREE.IcosahedronGeometry(1, 2)
      const p = shell.attributes.position
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i)
        p.setXYZ(i, p.getX(i) * 0.46, y * (y < 0 ? 0.08 : 0.17), p.getZ(i) * 0.33)
      }
      return {
        shell: facet(shell, 0.018, 3),
        belly: facet(new THREE.IcosahedronGeometry(1, 1).scale(0.4, 0.06, 0.28), 0.01, 4),
        bump: blob(0.06, 5, 0),
        tooth: cone(0.03, 0.08, 4, 6).rotateX(Math.PI / 2),
        stalk: facet(new THREE.CylinderGeometry(0.014, 0.02, 0.16, 5, 1).translate(0, 0.08, 0), 0.002, 7),
        eye: new THREE.IcosahedronGeometry(0.036, 1),
        glint: new THREE.IcosahedronGeometry(0.01, 0),
        mouth: facet(new THREE.BoxGeometry(0.05, 0.04, 0.03), 0.004, 8),
        upper: rod(0.05, 0.045, 0.21, 6, 9),
        fore: rod(0.055, 0.065, 0.17, 6, 10),
        palm: facet(new THREE.IcosahedronGeometry(1, 1).scale(0.11, 0.085, 0.15).translate(0, 0, 0.11), 0.008, 11),
        fixed: facet(cone(0.05, 0.2, 5, 12).rotateX(Math.PI / 2).scale(1, 0.75, 1), 0.004, 12),
        moving: facet(cone(0.043, 0.2, 5, 13).rotateX(Math.PI / 2).scale(1, 0.75, 1), 0.004, 13),
        femur: rod(0.03, 0.026, 0.24, 5, 14),
        tibia: rod(0.025, 0.019, 0.26, 5, 15),
        dactyl: facet(cone(0.019, 0.17, 4, 16).rotateX(Math.PI / 2), 0.002, 16),
        sand: facet(new THREE.CylinderGeometry(1.55, 1.68, 0.12, 20, 1).translate(0, -0.07, 0), 0.02, 17),
        foam: new THREE.TorusGeometry(1.53, 0.035, 3, 20, Math.PI * 0.75).rotateX(-Math.PI / 2),
        sea: new THREE.RingGeometry(1.55, 2.05, 20, 1, 0, Math.PI * 0.75).rotateX(-Math.PI / 2),
        shellA: facet(new THREE.ConeGeometry(0.09, 0.05, 7, 1).translate(0, 0.025, 0), 0.006, 18),
        shellB: facet(new THREE.ConeGeometry(0.045, 0.12, 6, 1).rotateZ(Math.PI / 2), 0.004, 19),
        pebble: blob(0.06, 20, 0),
        hit: new THREE.BoxGeometry(1.3, 0.55, 0.9).translate(0, 0.27, 0.1),
      }
    },
    [],
  )

  // a few lumps on the shell
  const bumps = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * TAU + r() * 0.5
      const d = 0.12 + r() * 0.16
      return { p: [Math.cos(a) * d * 1.2, 0.13 - d * 0.2, Math.sin(a) * d * 0.8 - 0.02], s: 0.6 + r() * 0.7 }
    })
  }, [])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const d = Math.min(dt, 0.05)
    const S = st.current
    const s = tap.since(t)
    // the tap envelope: up fast, hold while it snaps, then back down
    const e = s < 0 || s > 2.4 ? 0 : s < 0.25 ? ease(s / 0.25) : s < 1.8 ? 1 : 1 - ease((s - 1.8) / 0.6)
    // scuttle sideways and back; it freezes while showing off
    S.wt += d * (1 - e)
    const x = 0.5 * Math.sin(S.wt * 0.75)
    const v = Math.abs(x - S.x) / Math.max(d, 1e-4)
    S.x = x
    S.p += d * (v * 16 + 0.4) * (1 - e)
    walker.current.position.x = x
    const bob = Math.abs(Math.sin(S.p)) * 0.018
    body.current.position.y = BODY_Y + bob - e * 0.03
    body.current.rotation.z = Math.sin(S.p) * 0.03 * Math.min(1, v * 3)
    body.current.rotation.x = -e * 0.12
    body.current.rotation.y = Math.sin(t * 0.5) * 0.12

    // legs: two alternating sets, each lifting and reaching in turn
    legs.current.forEach((g, i) => {
      if (!g) return
      const side = i < 4 ? 1 : -1
      const k = i % 4
      const set = (k + (side > 0 ? 0 : 1)) % 2
      const ph = S.p * 2 + set * Math.PI
      const lift = Math.max(0, Math.sin(ph)) * Math.min(1, v * 4) * (1 - e)
      g.femur.rotation.x = -0.45 - lift * 0.45 - e * 0.1
      g.knee.rotation.x = 1.15 + Math.cos(ph) * 0.12 * Math.min(1, v * 4) + e * 0.12
    })

    // claws: held up and working slowly, or thrown high and snapping
    const snap = s > 0.25 && s < 1.9 ? Math.max(0, Math.sin((s - 0.25) * TAU * 3.2)) ** 0.6 : 0
    arms.current.forEach((a, i) => {
      if (!a) return
      const side = i ? -1 : 1
      const idle = 0.22 + 0.18 * Math.sin(t * 1.6 + i * 1.3)
      a.shoulder.rotation.x = -1.05 - e * 0.5 + Math.sin(t * 1.1 + i) * 0.05
      a.elbow.rotation.x = 0.55 - e * 1.25
      a.shoulder.rotation.z = side * e * 0.25
      a.finger.rotation.x = -((1 - e) * idle + e * snap * 0.75)
    })
    // eye stalks: twitchy, and shooting up on a tap
    stalks.current.forEach((g, i) => {
      if (!g) return
      const tw = Math.sin(t * 9 + i * 2) * Math.max(0, Math.sin(t * 0.8 + i * 1.7) - 0.6) * 0.6
      g.rotation.z = (i ? -1 : 1) * (0.18 + e * 0.12) + tw
      g.rotation.x = 0.1 + Math.sin(t * 1.3 + i) * 0.08 + e * 0.1
      g.scale.y = 1.25 + e * 0.75
    })
    foam.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.012)
    foam.current.position.y = 0.005 + Math.sin(t * 1.4) * 0.004
  })

  const legSet = (side) =>
    LEG_Z.map((z, k) => (
      <group key={`${side}${k}`} position={[side * 0.36, -0.02, z]} rotation-y={side * (Math.PI / 2) - side * LEG_FAN[k]}>
        <group
          ref={(el) => {
            if (!el) return
            const i = (side > 0 ? 0 : 4) + k
            legs.current[i] = { femur: el, knee: el.children[1] }
          }}
        >
          <mesh geometry={geo.femur}>
            <Flat color={L.leg} />
          </mesh>
          <group position-z={0.24}>
            <mesh geometry={geo.tibia}>
              <Flat color={L.leg} />
            </mesh>
            <group position-z={0.26} rotation-x={0.6}>
              <mesh geometry={geo.dactyl}>
                <Flat color={L.dark} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    ))

  return (
    <group {...handlers}>
      {/* the beach: sand, a lap of sea and its foam, shells and pebbles */}
      <mesh geometry={geo.sand}>
        <Flat color="#ecd29c" />
      </mesh>
      <group rotation-y={1.9}>
        <mesh geometry={geo.sea} position-y={-0.03}>
          <Flat color="#5ab8d2" roughness={0.75} />
        </mesh>
        <mesh ref={foam} geometry={geo.foam}>
          <Flat color="#ffffff" />
        </mesh>
      </group>
      <mesh geometry={geo.shellA} position={[0.95, -0.01, 0.55]} rotation-y={0.6}>
        <Flat color="#f6c8b8" />
      </mesh>
      <mesh geometry={geo.shellB} position={[-0.85, 0.02, 0.7]} rotation-y={-0.8}>
        <Flat color="#f2ead8" />
      </mesh>
      <mesh geometry={geo.pebble} position={[0.7, 0.0, -0.75]} scale={[1.3, 0.6, 1]}>
        <Flat color="#9a958c" />
      </mesh>
      <mesh geometry={geo.pebble} position={[-1.05, 0.0, -0.2]} scale={[0.8, 0.5, 0.9]}>
        <Flat color="#b8aea0" />
      </mesh>

      <group ref={walker}>
        <Ripple tap={tap} count={3} color="#ffffff" radius={1.2} y={0.01} />
        <Burst tap={tap} count={18} colors={['#e8cc90', '#f4e0b0', '#d4b478']} speed={1.6} gravity={6} size={0.05} life={0.9} origin={[0, 0.03, 0]} spread={1.2} up={0.9} />
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
        <group ref={body} position-y={BODY_Y}>
          <mesh geometry={geo.shell}>
            <Flat color={L.shell} />
          </mesh>
          <mesh geometry={geo.belly} position-y={-0.025}>
            <Flat color={L.belly} />
          </mesh>
          {bumps.map((b, i) => (
            <mesh key={i} geometry={geo.bump} position={b.p} scale={[b.s, b.s * 0.5, b.s]}>
              <Flat color={i % 2 ? L.bump : L.shell} />
            </mesh>
          ))}
          {/* the toothed front edge of the shell */}
          {[-1, 1].map((side) =>
            [0, 1, 2, 3].map((k) => {
              const a = 0.35 + k * 0.28
              return <mesh key={`${side}${k}`} geometry={geo.tooth} position={[side * Math.sin(a) * 0.44, 0.01, Math.cos(a) * 0.31]} rotation-y={side * a}><Flat color={L.dark} /></mesh>
            }),
          )}
          {/* face: mouthparts and eyes on stalks */}
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.mouth} position={[x * 0.03, -0.015, 0.315]} rotation-y={x * 0.3}>
              <Flat color={L.belly} />
            </mesh>
          ))}
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (stalks.current[i] = el)} position={[x * 0.085, 0.09, 0.29]}>
              <mesh geometry={geo.stalk}>
                <Flat color={L.shell} />
              </mesh>
              <mesh geometry={geo.eye} position-y={0.17}>
                <Flat color="#141218" roughness={0.3} />
              </mesh>
              <mesh geometry={geo.glint} position={[x * 0.012, 0.185, 0.028]}>
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
          {/* claws: upper arm, forearm, palm with a fixed and a moving pincer */}
          {[1, -1].map((side, i) => (
            <group key={side} position={[side * 0.27, 0, 0.22]} rotation-y={side * 0.95} scale={1.25}>
              <group
                ref={(el) => {
                  if (!el) return
                  arms.current[i] = { shoulder: el, elbow: el.children[1], finger: el.children[1].children[1].children[2] }
                }}
              >
                <mesh geometry={geo.upper}>
                  <Flat color={L.leg} />
                </mesh>
                <group position-z={0.21} rotation-y={-side * 0.95}>
                  <mesh geometry={geo.fore}>
                    <Flat color={L.shell} />
                  </mesh>
                  <group position-z={0.17} rotation-y={-side * 0.25}>
                    <mesh geometry={geo.palm}>
                      <Flat color={L.shell} />
                    </mesh>
                    <mesh geometry={geo.fixed} position={[0, -0.025, 0.22]} rotation-x={-0.12}>
                      <Flat color={L.tip} />
                    </mesh>
                    <group position={[0, 0.035, 0.2]}>
                      <mesh geometry={geo.moving} rotation-x={0.12}>
                        <Flat color={L.tip} />
                      </mesh>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          ))}
          {legSet(1)}
          {legSet(-1)}
        </group>
      </group>
    </group>
  )
}

export default function CrabScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.7, 2.1, 3.9]} target={[0, 0.25, 0]} hint="It scuttles sideways across the sand and back, legs stepping in turn, claws working and eye stalks twitching · tap it and it stops, throws its claws up and snaps them, eyes shooting up · Look swaps red, blue, orange and sand · drag to orbit">
      <Crab {...props} />
    </Stage>
  )
}
