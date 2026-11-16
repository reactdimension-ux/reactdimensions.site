import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, Sway, blinkAt, blob, facet, lookAround, useGeo, useTap } from './kit.jsx'

// A low-poly macaw-like parrot on a wooden perch, a branch set on two posts:
// a faceted body, a round head with a big hooked beak (the upper bill hooked
// over the lower), a pale bare eye patch (or, on the cockatoo, a fan of crest
// feathers), folded wings with coloured flight feathers, a long tapered tail
// hanging below the perch and zygodactyl feet, two toes forward and two back,
// gripping the branch. It bobs its head, sidesteps a little along the perch,
// tilts its head to look, blinks, and its tail sways. Tap it and it squawks:
// the beak gapes, the head thrusts forward, it puffs up and shivers, the
// wings half spread with a flap, the crest (or the head feathers) flares up
// and a few feathers fly off, then it settles.

const LOOKS = {
  scarlet: { body: '#de2f2b', breast: '#e0342c', head: '#e2362e', forehead: null, throat: null, wing: '#de2f2b', band: '#f6c63a', flight: '#2f6fd0', tail: ['#2f6fd0', '#d62a2a', '#2f6fd0'], patch: '#f4efe6', upper: '#efe4cf', lower: '#2a2830', feet: '#5a5560', crest: null, ruff: '#e2362e' },
  blue: { body: '#2a8fd8', breast: '#f7b928', head: '#2a8fd8', forehead: '#58b85a', throat: '#1d1d24', wing: '#2a8fd8', band: '#2378c6', flight: '#1d55a6', tail: ['#2a6fc0', '#2a8fd8', '#2a6fc0'], patch: '#f6f4ee', upper: '#26252b', lower: '#26252b', feet: '#4a4650', crest: null, ruff: '#2a8fd8' },
  green: { body: '#46a948', breast: '#5cbc54', head: '#4cae4c', forehead: '#e23b32', throat: null, wing: '#3f9e44', band: '#7ccf54', flight: '#2f62c0', tail: ['#2f62c0', '#d8392f', '#2f62c0'], patch: '#f2eee4', upper: '#3a3840', lower: '#2a2830', feet: '#5a5560', crest: null, ruff: '#4cae4c' },
  cockatoo: { body: '#f6f5ef', breast: '#ffffff', head: '#fbfaf6', forehead: null, throat: null, wing: '#f2f1ea', band: '#f7f5ec', flight: '#e9e4d2', tail: ['#efece0', '#f6f4ec', '#efece0'], patch: null, ring: '#cfe3f2', upper: '#2c2b31', lower: '#2c2b31', feet: '#55515c', crest: '#ffd23a', ruff: null },
}

const PERCH_Y = 1.0 // the branch's centre line
const PERCH_R = 0.045
const SQUAWK = 2.2 // seconds a squawk lasts

export function Parrot({ look = 'scarlet' }) {
  const L = LOOKS[look] || LOOKS.scarlet
  const { tap, handlers, clock } = useTap(1.2)
  const bird = useRef()
  const body = useRef()
  const head = useRef()
  const headPos = useRef()
  const jaw = useRef()
  const bill = useRef()
  const eyes = useRef([])
  const crest = useRef([])
  const wings = useRef([])
  const feet = useRef([])

  const geo = useGeo(
    () => ({
      base: facet(new THREE.BoxGeometry(1.5, 0.06, 0.4, 3, 1, 2).translate(0, 0.03, 0), 0.01, 1, [1, 0.3, 1]),
      post: facet(new THREE.CylinderGeometry(0.035, 0.045, PERCH_Y, 6, 2).translate(0, PERCH_Y / 2, 0), 0.006, 2),
      branch: facet(new THREE.CylinderGeometry(PERCH_R, PERCH_R * 1.1, 1.5, 7, 4).rotateZ(Math.PI / 2), 0.008, 3),
      knob: blob(0.05, 4, 0),
      leaf: facet(new THREE.IcosahedronGeometry(0.06, 0), 0.004, 5).scale(0.7, 0.2, 1.4),
      body: facet(new THREE.IcosahedronGeometry(0.2, 1).scale(0.95, 1.35, 0.85), 0.012, 6),
      breast: blob(0.15, 7),
      head: facet(new THREE.IcosahedronGeometry(0.14, 1).scale(0.95, 1, 1.05), 0.008, 8),
      cap: blob(0.08, 9, 0),
      // the upper bill: a deep base, then a hook curling down and back
      billBase: facet(new THREE.CylinderGeometry(0.055, 0.08, 0.1, 6, 1).rotateX(Math.PI / 2).translate(0, 0, 0.05).scale(0.8, 1, 1), 0.004, 10),
      hook: facet(new THREE.ConeGeometry(0.055, 0.17, 6, 1).rotateX(Math.PI).translate(0, -0.085, 0).scale(0.75, 1, 1), 0.004, 11),
      jaw: facet(new THREE.ConeGeometry(0.05, 0.1, 5, 1).rotateX(Math.PI / 2).translate(0, 0, 0.05).scale(0.8, 0.6, 1), 0.003, 12),
      patch: new THREE.CylinderGeometry(0.06, 0.06, 0.012, 8, 1).rotateZ(Math.PI / 2).scale(1, 1.1, 1.25),
      eye: new THREE.IcosahedronGeometry(0.022, 0),
      pupil: new THREE.IcosahedronGeometry(0.012, 0),
      crest: facet(new THREE.ConeGeometry(0.028, 0.22, 4, 1).translate(0, 0.11, 0).scale(0.35, 1, 1), 0.003, 13),
      ruff: facet(new THREE.ConeGeometry(0.035, 0.13, 4, 1).translate(0, 0.065, 0).scale(0.4, 1, 1), 0.003, 14),
      covert: facet(new THREE.IcosahedronGeometry(1, 1), 0.04, 15),
      flight: facet(new THREE.ConeGeometry(0.1, 0.38, 5, 1).rotateX(Math.PI).translate(0, -0.19, 0).scale(0.28, 1, 1), 0.004, 16),
      feather: facet(new THREE.ConeGeometry(0.045, 1, 4, 1).rotateX(Math.PI).translate(0, -0.5, 0).scale(1, 1, 0.3), 0.002, 17),
      leg: new THREE.CylinderGeometry(0.018, 0.022, 0.1, 5, 1).translate(0, 0.05, 0),
      toe: facet(new THREE.ConeGeometry(0.014, 0.075, 4, 1).translate(0, 0.0375, 0), 0.001, 18),
      plume: facet(new THREE.ConeGeometry(0.4, 1, 4, 1).scale(1, 1, 0.25), 0.02, 19),
      hit: new THREE.CylinderGeometry(0.28, 0.28, 0.95, 8).translate(0, 0.35, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the squawk envelope: a sharp rise, a long settle (0 before any tap)
    const env = s >= 0 && s < SQUAWK ? (s < 0.12 ? s / 0.12 : s < 0.75 ? 1 : Math.exp(-(s - 0.75) * 3)) : 0
    // sidestep along the perch, the feet stepping in turn while it moves
    const p = t * 0.17
    const x = 0.11 * Math.sin(p * Math.PI * 2)
    const speed = Math.abs(Math.cos(p * Math.PI * 2))
    bird.current.position.set(x, PERCH_Y + PERCH_R, 0)
    bird.current.rotation.y = -0.4 - x * 1.5
    feet.current.forEach((f, i) => {
      if (!f) return
      const lift = Math.max(0, Math.sin(t * 7 + i * Math.PI)) * speed * 0.035
      f.position.y = lift
    })
    // the body: a rock as it steps, a puff and a shiver on the squawk
    const jit = env * 0.035 * Math.sin(s * 47)
    body.current.rotation.set(0.22 + env * 0.12, jit, Math.sin(t * 7) * speed * 0.04 + jit)
    body.current.scale.setScalar(1 + env * 0.13 + Math.sin(t * 1.5) * 0.01)
    // the head: bobs, glances and tilts to look; thrusts forward on the squawk
    const look = lookAround(t, 0.7)
    const tilt = 0.45 * Math.sin(t * 0.31 + 1) ** 5
    const bob = Math.sin(t * 0.23) > 0.5 ? Math.max(0, Math.sin(t * 5.5)) ** 2 * 0.03 : 0
    headPos.current.position.set(0, 0.6 + bob + env * 0.02, 0.07 + env * 0.1)
    head.current.rotation.set(look.pitch * (1 - env) - env * 0.3, look.yaw * (1 - env), tilt * (1 - env) + env * 0.06 * Math.sin(s * 31), 'YXZ')
    // the beak gapes on the squawk, with a stutter
    jaw.current.rotation.x = env * (0.75 + 0.15 * Math.sin(s * 28))
    bill.current.rotation.x = -env * 0.22
    // blink
    const b = blinkAt(t, 3.3)
    eyes.current.forEach((e) => e && (e.scale.y = b))
    // the crest lies back, sometimes half-raised; it flares on the squawk
    const up = Math.min(1, (L.crest ? 0.12 + 0.35 * Math.max(0, Math.sin(t * 0.37)) ** 6 : 0) + env * 1.15)
    crest.current.forEach((c, k) => {
      if (!c) return
      const n = crest.current.length - 1
      const rest = -1.5 + k * 0.05
      const raised = -0.85 + (k / n) * 1.25
      c.rotation.x = rest + (raised - rest) * up
      c.rotation.z = Math.sin(t * 2 + k) * 0.03 * up
    })
    // wings: folded, half spread with a flap on the squawk
    wings.current.forEach((w, i) => {
      if (!w) return
      const side = i ? -1 : 1
      w.rotation.set(0.32 - env * 0.15, 0, side * env * (0.75 + 0.4 * Math.sin(s * 17)))
    })
  })

  const crestCount = L.crest ? 6 : 5

  return (
    <group {...handlers}>
      {/* the perch: a base, two posts and a branch across them */}
      <mesh geometry={geo.base}>
        <Flat color="#a77b52" />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} geometry={geo.post} position-x={x}>
          <Flat color="#8a5e3c" />
        </mesh>
      ))}
      <mesh geometry={geo.branch} position-y={PERCH_Y}>
        <Flat color="#7a5236" />
      </mesh>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} geometry={geo.knob} position={[x, PERCH_Y, 0]} scale={[0.5, 1, 1]}>
          <Flat color="#6a452c" />
        </mesh>
      ))}
      {[
        [0.45, PERCH_Y + 0.05, 0.04, 0.4],
        [0.52, PERCH_Y + 0.03, -0.05, -0.5],
        [-0.48, PERCH_Y + 0.04, 0.03, 2.4],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} geometry={geo.leaf} position={[px, py, pz]} rotation-y={r}>
          <Flat color={i % 2 ? '#4f8a42' : '#5f9a4a'} />
        </mesh>
      ))}

      <group ref={bird} scale={1.25}>
        {/* zygodactyl feet: two toes over the front of the branch, two behind */}
        {[-1, 1].map((x, i) => (
          <group key={x} ref={(el) => (feet.current[i] = el)}>
            <group position-x={x * 0.07}>
              <mesh geometry={geo.leg}>
                <Flat color={L.feet} />
              </mesh>
              {[-1, 1].map((f) =>
                [-1, 1].map((k) => (
                  <mesh key={`${f}${k}`} geometry={geo.toe} position={[k * 0.014, 0.005, f * 0.01]} rotation={[f * 1.85, 0, k * 0.2]}>
                    <Flat color={L.feet} />
                  </mesh>
                )),
              )}
            </group>
          </group>
        ))}

        <group ref={body}>
          <mesh geometry={geo.body} position-y={0.3}>
            <Flat color={L.body} />
          </mesh>
          <mesh geometry={geo.breast} position={[0, 0.25, 0.07]} scale={[1.05, 1.5, 0.8]}>
            <Flat color={L.breast} />
          </mesh>

          {/* the tail: long feathers hanging below the perch */}
          <group position={[0, 0.1, -0.1]} rotation-x={0.28}>
            <Sway rate={0.35} amp={0.06} axis="z">
              <Sway rate={0.27} amp={0.05} axis="x" i={1}>
                {L.tail.map((c, k) => (
                  <mesh key={k} geometry={geo.feather} position={[(k - 1) * 0.035, 0, (k === 1 ? -0.01 : 0)]} rotation-z={(k - 1) * -0.06} scale={[1, k === 1 ? 0.82 : 0.7, 1]}>
                    <Flat color={c} side={THREE.DoubleSide} />
                  </mesh>
                ))}
              </Sway>
            </Sway>
          </group>

          {/* the wings, folded along the flanks */}
          {[1, -1].map((side, i) => (
            <group key={side} ref={(el) => (wings.current[i] = el)} position={[side * 0.17, 0.46, -0.01]}>
              <mesh geometry={geo.covert} position-y={-0.08} scale={[0.05, 0.12, 0.11]}>
                <Flat color={L.wing} />
              </mesh>
              <mesh geometry={geo.covert} position={[side * 0.004, -0.19, -0.01]} scale={[0.045, 0.09, 0.1]}>
                <Flat color={L.band} />
              </mesh>
              <mesh geometry={geo.flight} position={[side * 0.004, -0.21, -0.02]}>
                <Flat color={L.flight} />
              </mesh>
            </group>
          ))}

          {/* the head */}
          <group ref={headPos} position={[0, 0.6, 0.07]}>
            <group ref={head}>
              <mesh geometry={geo.head}>
                <Flat color={L.head} />
              </mesh>
              {L.forehead && (
                <mesh geometry={geo.cap} position={[0, 0.06, 0.08]} scale={[1, 0.6, 0.8]}>
                  <Flat color={L.forehead} />
                </mesh>
              )}
              {L.throat && (
                <mesh geometry={geo.cap} position={[0, -0.09, 0.07]} scale={[0.9, 0.5, 0.7]}>
                  <Flat color={L.throat} />
                </mesh>
              )}
              {/* eye patches (or a pale eye ring) and eyes */}
              {[1, -1].map((x, k) => (
                <group key={x} position={[x * 0.118, 0.015, 0.045]} rotation-y={x * 0.35}>
                  {L.patch && (
                    <mesh geometry={geo.patch}>
                      <Flat color={L.patch} />
                    </mesh>
                  )}
                  {L.ring && (
                    <mesh geometry={geo.patch} scale={0.5}>
                      <Flat color={L.ring} />
                    </mesh>
                  )}
                  <group ref={(el) => (eyes.current[k] = el)} position={[x * 0.008, 0.015, -0.005]}>
                    <mesh geometry={geo.eye}>
                      <Flat color={L.crest ? '#1b1a22' : '#f2d27a'} roughness={0.3} />
                    </mesh>
                    <mesh geometry={geo.pupil} position-x={x * 0.016}>
                      <Flat color="#1b1a22" roughness={0.3} />
                    </mesh>
                  </group>
                </group>
              ))}
              {/* the beak: upper bill hooked over the lower, which drops to gape */}
              <group position={[0, 0.0, 0.1]}>
                <group ref={bill}>
                  <mesh geometry={geo.billBase}>
                    <Flat color={L.upper} />
                  </mesh>
                  <group position={[0, 0.01, 0.095]} rotation-x={0.4}>
                    <mesh geometry={geo.hook}>
                      <Flat color={L.upper} />
                    </mesh>
                  </group>
                </group>
                <group ref={jaw} position={[0, -0.055, 0.0]}>
                  <mesh geometry={geo.jaw}>
                    <Flat color={L.lower} />
                  </mesh>
                </group>
              </group>
              {/* the crest (cockatoo) or a ruff of head feathers (macaws) */}
              <group position={[0, 0.1, -0.01]}>
                {Array.from({ length: crestCount }, (_, k) => (
                  <group key={k} ref={(el) => (crest.current[k] = el)} position-z={0.03 - k * 0.012}>
                    <mesh geometry={L.crest ? geo.crest : geo.ruff} scale={L.crest ? [1, 0.75 + 0.25 * Math.sin((k / (crestCount - 1)) * Math.PI), 1] : 1}>
                      <Flat color={L.crest || L.ruff} />
                    </mesh>
                  </group>
                ))}
              </group>
            </group>
          </group>
        </group>
        {/* an invisible hit area round the bird */}
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>

      <Burst tap={tap} geometry={geo.plume} count={9} colors={[L.body, L.band, L.flight]} speed={1.1} gravity={1.2} size={0.06} life={1.6} origin={[0, PERCH_Y + 0.35, 0.05]} spread={0.9} up={0.9} />
    </group>
  )
}

export default function ParrotScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.9, 1.9, 3.3]} target={[0, 1.2, 0]} hint="It bobs its head, sidesteps along its perch, tilts its head to look and blinks, its long tail swaying · tap it and it squawks: beak wide, head thrust forward, feathers ruffled, wings half spread and its crest flared · Look swaps scarlet, blue-and-gold, green and cockatoo · drag to orbit">
      <Parrot {...props} />
    </Stage>
  )
}
