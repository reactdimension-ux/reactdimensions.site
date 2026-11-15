import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { Flat, Stage, facet, useGeo, useKick } from './kit.jsx'

// A low-poly man at full sprint, built from faceted blocks: a red and orange
// top with yellow sleeves, one leg in teal and blue, the other in navy and
// violet, orange and yellow trainers, clenched fists, swept-back dark hair and
// a set jaw. He is rigged at the hips, waist, neck, shoulders, elbows, knees
// and ankles and runs on a procedural cycle: legs drive, arms pump against
// them, the hips bob twice a stride, the shoulders counter-twist and the head
// stays level. Turn running off and he eases into a frozen lunge, the hero
// pose. Tap him and he leaps, tucks and lands back in stride.

const OUTFITS = {
  classic: {
    torso: '#e4392c', chest: '#f0732a', waist: '#f6b11f', sleeveL: '#f6b11f', sleeveR: '#f0732a',
    skin: '#f3c3a1', hair: '#1a2746', brow: '#1a2746',
    thighF: '#3fb8c8', shinF: '#2f7fcf', thighB: '#303a78', shinB: '#5a3e8c',
    shoeF: '#f07b2a', soleF: '#f6c22e', shoeB: '#f6c22e', soleB: '#f07b2a',
  },
  cool: {
    torso: '#2457d6', chest: '#5c9cf5', waist: '#e6f1ff', sleeveL: '#e6f1ff', sleeveR: '#5c9cf5',
    skin: '#e9b795', hair: '#0e1630', brow: '#0e1630',
    thighF: '#1d2a55', shinF: '#2f3f7a', thighB: '#36b4b0', shinB: '#1f8d94',
    shoeF: '#f6f7fb', soleF: '#2457d6', shoeB: '#f6f7fb', soleB: '#36b4b0',
  },
  mono: {
    torso: '#26262b', chest: '#3c3c44', waist: '#d6d6dc', sleeveL: '#d6d6dc', sleeveR: '#3c3c44',
    skin: '#f1d0b4', hair: '#101013', brow: '#101013',
    thighF: '#56565f', shinF: '#76767f', thighB: '#2a2a30', shinB: '#1a1a1e',
    shoeF: '#e8e11c', soleF: '#26262b', shoeB: '#e8e11c', soleB: '#26262b',
  },
}

// Blocks hang from their pivot (the joint above them) so the rig rotates them
// at the right place. A 4-sided tapered cylinder turned 45 degrees is a
// square prism.
const limb = (rt, rb, h, seed, amt = 0.012) => facet(new THREE.CylinderGeometry(rt, rb, h, 4, 1).rotateY(Math.PI / 4).translate(0, -h / 2, 0), amt, seed)
const block = (w, h, d, seed, amt = 0.012) => facet(new THREE.BoxGeometry(w, h, d), amt, seed)
const wedge = (r, h, seed) => facet(new THREE.ConeGeometry(r, h, 4, 1).rotateY(Math.PI / 4).translate(0, h / 2, 0), r * 0.1, seed)

const TAU = Math.PI * 2
const lerp = (a, b, w) => a + (b - a) * w
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// One stride of the run cycle at phase p (0..2π). Leg 1 (+x) leads at p = π/2.
function runPose(p) {
  const legs = [0, 1].map((i) => {
    const q = p + i * Math.PI
    const thigh = 0.95 * Math.sin(q)
    // the knee folds after toe-off and through the forward swing (heel kick),
    // and is nearly straight as the foot reaches ahead
    const knee = 0.2 + 1.35 * Math.max(0, -Math.cos(q - 0.75 * Math.PI))
    const foot = clamp(0.5 * (thigh - knee), -0.45, 0.9)
    return { thigh, knee, foot }
  })
  const arms = [0, 1].map((i) => {
    const q = p + i * Math.PI + Math.PI // against the same-side leg
    return { sh: 0.85 * Math.sin(q) - 0.1, el: 1.55 + 0.45 * Math.max(0, Math.sin(q)), out: 0.2 }
  })
  return {
    legs,
    arms,
    y: 0.93 + 0.045 * Math.sin(2 * p + 0.4),
    lean: 0.3,
    twist: 0.17 * Math.sin(p),
    sway: 0.035 * Math.sin(p),
    head: -0.22,
  }
}

// The frozen lunge: one leg driven forward and folded, the other stretched
// back on its toes, the near fist up at the chest, the far arm swung back.
const HERO = {
  legs: [
    { thigh: -0.78, knee: 0.14, foot: 0.05 },
    { thigh: 1.05, knee: 1.25, foot: 0.25 },
  ],
  arms: [
    { sh: 1.0, el: 2.25, out: 0.28 },
    { sh: -0.95, el: 1.85, out: 0.22 },
  ],
  y: 0.72,
  lean: 0.42,
  twist: 0.22,
  sway: 0,
  head: -0.34,
}

function blendPose(a, b, w) {
  return {
    legs: a.legs.map((l, i) => ({ thigh: lerp(l.thigh, b.legs[i].thigh, w), knee: lerp(l.knee, b.legs[i].knee, w), foot: lerp(l.foot, b.legs[i].foot, w) })),
    arms: a.arms.map((m, i) => ({ sh: lerp(m.sh, b.arms[i].sh, w), el: lerp(m.el, b.arms[i].el, w), out: lerp(m.out, b.arms[i].out, w) })),
    y: lerp(a.y, b.y, w),
    lean: lerp(a.lean, b.lean, w),
    twist: lerp(a.twist, b.twist, w),
    sway: lerp(a.sway, b.sway, w),
    head: lerp(a.head, b.head, w),
  }
}

export function Runner({ outfit = 'classic', speed = 1.4, run = true }) {
  const C = OUTFITS[outfit] || OUTFITS.classic
  const clock = useThree((s) => s.clock)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tap = useKick(1)
  const r = useRef({})
  const st = useRef({ phase: 0, w: run ? 0 : 1, last: 0 })
  const set = (k) => (o) => (r.current[k] = o)

  const geo = useGeo(
    () => ({
      pelvis: block(0.3, 0.2, 0.2, 1),
      chest: block(0.38, 0.46, 0.24, 2, 0.016),
      belly: block(0.32, 0.18, 0.21, 3),
      shoulder: facet(new THREE.IcosahedronGeometry(0.095, 0), 0.008, 4),
      upperArm: limb(0.082, 0.07, 0.3, 5),
      foreArm: limb(0.072, 0.06, 0.29, 6),
      fist: facet(new THREE.IcosahedronGeometry(0.078, 0), 0.008, 7),
      neck: limb(0.06, 0.07, 0.1, 8),
      head: block(0.25, 0.28, 0.26, 9, 0.02),
      jaw: block(0.19, 0.1, 0.2, 10, 0.012),
      hairCap: block(0.27, 0.12, 0.2, 11, 0.012),
      quiff: wedge(0.08, 0.26, 12),
      ear: block(0.03, 0.07, 0.05, 13, 0.004),
      eye: new THREE.BoxGeometry(0.05, 0.035, 0.02),
      pupil: new THREE.BoxGeometry(0.022, 0.03, 0.01),
      brow: new THREE.BoxGeometry(0.075, 0.02, 0.02),
      mouth: new THREE.BoxGeometry(0.06, 0.012, 0.01),
      thigh: limb(0.1, 0.082, 0.44, 14),
      shin: limb(0.08, 0.062, 0.44, 15),
      shoe: block(0.13, 0.09, 0.28, 16),
      sole: block(0.14, 0.03, 0.3, 17, 0.004),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const o = r.current
    const s = st.current
    const dt = Math.min(0.05, t - s.last)
    s.last = t
    // the stride phase accumulates, so a speed change never jumps the pose
    s.phase = (s.phase + dt * TAU * speed) % TAU
    // ease between the cycle and the frozen lunge
    s.w += ((run ? 0 : 1) - s.w) * (1 - Math.exp(-5 * dt))
    const P = blendPose(runPose(s.phase), HERO, s.w)

    // the leap: up and over in 0.85 s, legs tucked, arms thrown up, then back in stride
    const u = tap.since(t) / 0.85
    const j = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0
    const air = u > 0 && u < 1 ? 4 * u * (1 - u) : 0

    o.root.position.y = P.y + air * 0.8
    o.root.rotation.y = P.twist
    o.root.rotation.z = P.sway
    o.torso.rotation.x = P.lean - j * 0.18
    o.torso.rotation.y = -P.twist * 1.7
    o.head.rotation.x = P.head + j * 0.1
    o.head.rotation.y = P.twist * 0.6
    P.legs.forEach((l, i) => {
      o[`thigh${i}`].rotation.x = -(l.thigh + j * 0.55)
      o[`knee${i}`].rotation.x = l.knee + j * 1.15
      o[`ankle${i}`].rotation.x = l.foot + j * 0.3
    })
    P.arms.forEach((m, i) => {
      o[`arm${i}`].rotation.x = -(m.sh + j * 0.9)
      o[`arm${i}`].rotation.z = (i ? -1 : 1) * m.out
      o[`elbow${i}`].rotation.x = -(m.el - j * 0.4)
    })
    // blink
    const bl = t % 4.1
    o.lidL.scale.y = o.lidR.scale.y = bl < 0.12 ? 0.15 : 1
  })

  const legColors = [
    { thigh: C.thighB, shin: C.shinB, shoe: C.shoeB, sole: C.soleB },
    { thigh: C.thighF, shin: C.shinF, shoe: C.shoeF, sole: C.soleF },
  ]
  const sleeve = [C.sleeveR, C.sleeveL]

  return (
    <group
      ref={set('root')}
      onClick={(e) => {
        e.stopPropagation()
        tap.kick(clock.elapsedTime)
      }}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      {/* pelvis */}
      <mesh geometry={geo.pelvis} position={[0, 0.02, 0]}>
        <Flat color={C.waist} />
      </mesh>

      {/* legs, hanging from the hips */}
      {[0, 1].map((i) => {
        const L = legColors[i]
        return (
          <group key={i} ref={set(`thigh${i}`)} position={[(i ? 1 : -1) * 0.115, -0.03, 0]}>
            <mesh geometry={geo.thigh}>
              <Flat color={L.thigh} />
            </mesh>
            <group ref={set(`knee${i}`)} position={[0, -0.44, 0]}>
              <mesh geometry={geo.shin}>
                <Flat color={L.shin} />
              </mesh>
              <group ref={set(`ankle${i}`)} position={[0, -0.44, 0]}>
                <mesh geometry={geo.shoe} position={[0, -0.035, 0.055]}>
                  <Flat color={L.shoe} />
                </mesh>
                <mesh geometry={geo.sole} position={[0, -0.09, 0.06]}>
                  <Flat color={L.sole} />
                </mesh>
              </group>
            </group>
          </group>
        )
      })}

      {/* torso, leaning from the waist */}
      <group ref={set('torso')} position={[0, 0.1, 0]}>
        <mesh geometry={geo.belly} position={[0, 0.07, 0.005]}>
          <Flat color={C.waist} />
        </mesh>
        <mesh geometry={geo.chest} position={[0, 0.37, 0]}>
          <Flat color={C.torso} />
        </mesh>
        {/* the orange yoke across the shoulders and down one side */}
        <mesh geometry={geo.belly} position={[0, 0.5, 0]} scale={[1.2, 0.75, 1.17]}>
          <Flat color={C.chest} />
        </mesh>
        <mesh geometry={geo.pelvis} position={[-0.13, 0.33, 0]} scale={[0.5, 1.3, 1.22]}>
          <Flat color={C.chest} />
        </mesh>

        {/* arms, swinging from the shoulders */}
        {[0, 1].map((i) => {
          const s = i ? 1 : -1
          return (
            <group key={i} position={[s * 0.235, 0.52, 0]}>
              <mesh geometry={geo.shoulder}>
                <Flat color={C.chest} />
              </mesh>
              <group ref={set(`arm${i}`)}>
                <mesh geometry={geo.upperArm}>
                  <Flat color={sleeve[i]} />
                </mesh>
                <group ref={set(`elbow${i}`)} position={[0, -0.3, 0]}>
                  <mesh geometry={geo.foreArm}>
                    <Flat color={sleeve[i]} />
                  </mesh>
                  <mesh geometry={geo.fist} position={[0, -0.33, 0.01]} scale={[1, 0.95, 1.15]}>
                    <Flat color={C.skin} roughness={0.7} />
                  </mesh>
                </group>
              </group>
            </group>
          )
        })}

        {/* neck and head */}
        <mesh geometry={geo.neck} position={[0, 0.7, 0.01]}>
          <Flat color={C.skin} roughness={0.7} />
        </mesh>
        <group ref={set('head')} position={[0, 0.62, 0.01]}>
          <mesh geometry={geo.head} position={[0, 0.2, 0]}>
            <Flat color={C.skin} roughness={0.7} />
          </mesh>
          <mesh geometry={geo.jaw} position={[0, 0.03, 0.03]}>
            <Flat color={C.skin} roughness={0.7} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.ear} position={[s * 0.135, 0.19, -0.01]}>
              <Flat color={C.skin} roughness={0.7} />
            </mesh>
          ))}
          {/* hair: a cap over the crown, a swept-back quiff and a flick at the back */}
          <mesh geometry={geo.hairCap} position={[0, 0.33, -0.04]}>
            <Flat color={C.hair} />
          </mesh>
          <mesh geometry={geo.quiff} position={[0.02, 0.33, 0.09]} rotation={[-0.75, 0, 0.25]}>
            <Flat color={C.hair} />
          </mesh>
          <mesh geometry={geo.quiff} position={[-0.06, 0.34, 0.03]} rotation={[-1.25, 0, -0.2]} scale={[0.9, 0.85, 0.9]}>
            <Flat color={C.hair} />
          </mesh>
          <mesh geometry={geo.quiff} position={[0.04, 0.3, -0.12]} rotation={[-2.2, 0, 0]} scale={[0.8, 0.7, 0.8]}>
            <Flat color={C.hair} />
          </mesh>
          {/* a set face: narrowed eyes under angled brows, a flat mouth */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.06, 0.22, 0.13]}>
              <mesh ref={set(s < 0 ? 'lidL' : 'lidR')} geometry={geo.eye}>
                <Flat color="#fbfbf7" roughness={0.5} />
              </mesh>
              <mesh geometry={geo.pupil} position={[s * 0.008, 0, 0.01]}>
                <Flat color="#141420" roughness={0.3} />
              </mesh>
              <mesh geometry={geo.brow} position={[s * 0.005, 0.045, 0.01]} rotation-z={-s * 0.32}>
                <Flat color={C.brow} />
              </mesh>
            </group>
          ))}
          <mesh geometry={geo.mouth} position={[0.01, 0.08, 0.135]} rotation-z={0.08}>
            <Flat color="#8b4a3c" />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export default function RunnerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.1, 4.4]} target={[0, 0.95, 0]} hint="He runs on his own: legs drive, arms pump, hips bob and shoulders twist · tap him and he leaps · Speed sets the stride rate · turn Run off and he freezes in the hero lunge · Outfit swaps classic, cool and mono · drag to orbit">
      <Runner {...props} />
    </Stage>
  )
}
