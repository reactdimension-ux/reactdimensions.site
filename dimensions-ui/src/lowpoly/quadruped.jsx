import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, TAU, Tail, blinkAt, facet, rng, useGeo, useKick, useTap } from './kit.jsx'

// A four-legged low-poly animal built the way the Low Poly Bear is: a
// faceted ellipsoid body on four stubby legs, a round head with a muzzle,
// a nose, eyes and ears, standing on a round patch of ground. A spec gives
// each animal its proportions and features (round, pointed or floppy ears,
// a mane, stripes or spots, whiskers, a tail) and what it does when tapped;
// a look gives its colours.
//
// Every animal breathes, dips its head to sniff, looks about, blinks, flicks
// its ears and swings its tail. On a tap it does its own thing:
//   roar   - head thrown back, jaw open, mane puffed
//   pounce - crouches, leaps forward with its legs out, lands, pads back
//   hop    - two bouncing hops (the second with a spin), barking, tail wagging
//   arch   - back arched high, fur up, tail straight up, jaw open in a hiss
//
// Units are those of the bear in the Low Poly Diorama; the spec's S scales
// the whole animal up for its stage.

const up = new THREE.Vector3(0, 1, 0)

// 0..1: rises over `a`, holds until `b`, falls back by `c` (seconds)
function envelope(s, a, b, c) {
  if (s < 0 || s > c) return 0
  if (s < a) return Math.sin((s / a) * (Math.PI / 2))
  if (s < b) return 1
  return 1 - ((s - b) / (c - b)) ** 2
}

const DURATION = { roar: 1.7, pounce: 2.3, hop: 1.2, arch: 1.8 }

export function Quadruped({ spec, look }) {
  const P = spec
  const C = look
  const S = P.S
  const ears = look.ears || P.ears.kind
  const pattern = look.pattern !== undefined ? look.pattern : P.pattern
  const { tap, handlers, clock } = useTap(1.4)
  const thud = useKick(3)
  const landed = useRef(-99)
  const root = useRef()
  const body = useRef()
  const torso = useRef()
  const head = useRef()
  const jaw = useRef()
  const mane = useRef()
  const tail = useRef()
  const legs = useRef([])
  const earRefs = useRef([])
  const eyes = useRef([])

  const geo = useGeo(() => {
    const [r0, r1] = P.leg.r
    return {
      ball: facet(new THREE.IcosahedronGeometry(1, 1), 0.06, 3),
      leg: facet(new THREE.CylinderGeometry(r1, r0, P.leg.h, 6).translate(0, -P.leg.h / 2, 0), 0.003, 4),
      point: facet(new THREE.ConeGeometry(1, 2.2, 4, 1).translate(0, 1.1, 0), 0.04, 5),
      ground: facet(new THREE.CylinderGeometry(1, 1.04, 0.14, 14, 1).translate(0, -0.07, 0), 0.02, 6, [1, 0.3, 1], (x, y) => y > -0.001),
      bar: new THREE.BoxGeometry(1, 1, 1),
      flower: new THREE.OctahedronGeometry(0.035, 0),
      tuft: new THREE.ConeGeometry(0.03, 0.09, 4).translate(0, 0.045, 0),
      dust: new THREE.IcosahedronGeometry(1, 0),
    }
  }, [P])

  // markings: stripes are thin slices of the body's own ellipsoid, so they
  // wrap it; spots sit on its surface, turned to face out
  const marks = useMemo(() => {
    const out = []
    const b = P.body
    if (pattern === 'stripes') {
      const n = P.stripes || 7
      for (let i = 0; i < n; i++) {
        const z = b.r[2] * (-0.78 + (1.5 * i) / (n - 1))
        const k = Math.sqrt(Math.max(0.05, 1 - (z / b.r[2]) ** 2)) * 1.025
        out.push({ kind: 'band', pos: [0, b.y + 0.004, z], scale: [b.r[0] * k, b.r[1] * k, P.stripeW || 0.012], rot: [((i % 3) - 1) * 0.12, 0, 0], c: 0 })
      }
    } else if (pattern === 'spots' || pattern === 'patches') {
      const r = rng(P.seed || 7)
      const n = pattern === 'patches' ? 9 : P.spots || 34
      const c0 = Math.cos(0.28)
      const c1 = Math.cos(1.52)
      for (let i = 0; i < n; i++) {
        const th = Math.acos(c0 + ((i + 0.5) / n) * (c1 - c0)) + (r() - 0.5) * 0.12
        const ph = i * 2.39996 + (r() - 0.5) * 0.3
        const p = new THREE.Vector3(b.r[0] * Math.sin(th) * Math.cos(ph), b.r[1] * Math.cos(th), b.r[2] * Math.sin(th) * Math.sin(ph))
        const nrm = new THREE.Vector3(p.x / b.r[0] ** 2, p.y / b.r[1] ** 2, p.z / b.r[2] ** 2).normalize()
        const q = new THREE.Quaternion().setFromUnitVectors(up, nrm)
        const sz = (pattern === 'patches' ? 0.05 : P.spotSize || 0.018) * (0.7 + r() * 0.6)
        out.push({ kind: 'spot', pos: [p.x, b.y + p.y, p.z], quat: q, scale: [sz, sz * 0.3, sz * (0.85 + r() * 0.3)], c: i % 2 })
      }
    }
    return out
  }, [P, pattern])
  const markColors = C.marks || [C.mark || '#1b1a22']

  const flowers = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 16 }, (_, i) => {
      const a = r() * TAU
      const d = 0.55 + r() * 0.85
      return [Math.cos(a) * d, Math.sin(a) * d, i % 3 === 0, C.flowers[i % C.flowers.length], r() * 6]
    })
  }, [C])

  const action = P.action
  const dur = DURATION[action]
  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const busy = s >= 0 && s < dur
    let k = 0 // how far into the action pose
    let rx = 0
    let ry = 0
    let x = 0
    let y = 0
    let z = 0
    let legSwing = 0
    let jawOpen = 0
    let headUp = 0
    let tailLift = 0
    let bodyPuff = 0
    let earsBack = 0
    if (busy) {
      if (action === 'roar') {
        k = envelope(s, 0.3, 1.3, 1.7)
        headUp = 0.55 * k
        jawOpen = k * (0.6 + 0.08 * Math.sin(t * 34))
        tailLift = 0.4 * k
      } else if (action === 'arch') {
        k = envelope(s, 0.22, 1.4, 1.8)
        bodyPuff = k
        headUp = -0.3 * k
        jawOpen = 0.5 * k
        tailLift = 1.3 * k
        earsBack = k
      } else if (action === 'pounce') {
        const D = P.leap || 0.55
        if (s < 0.35) {
          const c = Math.sin((s / 0.35) * (Math.PI / 2))
          y = -0.05 * c
          rx = 0.14 * c
          headUp = -0.15 * c
          tailLift = 0.3 * c
        } else if (s < 0.85) {
          const u = (s - 0.35) / 0.5
          z = D * u
          y = 0.42 * 4 * u * (1 - u)
          rx = -0.25 * Math.sin(u * Math.PI) + 0.1 * (u - 0.5)
          legSwing = Math.sin(u * Math.PI)
          tailLift = 0.5
          jawOpen = 0.3 * Math.sin(u * Math.PI)
        } else {
          const u = Math.min(1, (s - 0.85) / (dur - 0.85))
          z = D * (1 - u)
          y = Math.abs(Math.sin(u * Math.PI * 6)) * 0.015
          legSwing = -0.35 * Math.sin(u * Math.PI * 6) * (1 - u)
          ry = 0
        }
        if (s >= 0.85 && landed.current !== tap.since(0)) {
          landed.current = tap.since(0)
          thud.kick(t)
        }
      } else if (action === 'hop') {
        const u = s / dur
        const hop = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5
        y = 0.28 * 4 * hop * (1 - hop)
        ry = u >= 0.5 ? hop * TAU : 0
        legSwing = 0.5 * Math.sin(hop * Math.PI)
        jawOpen = (hop < 0.4 ? Math.sin((hop / 0.4) * Math.PI) : 0) * 0.5
        headUp = 0.2 * Math.sin(hop * Math.PI)
        tailLift = 0.3
      }
    }
    const stretch = 1 + 0.25 * bodyPuff
    root.current.position.set(x, y + (stretch - 1) * P.leg.h * S, z)
    root.current.rotation.set(rx, ry, 0)
    const th = thud.value(t)
    // the body: breathing, a squash on landing, the arch's puff
    torso.current.scale.set(1 + th * 0.06 + bodyPuff * 0.06, 1 + 0.025 * Math.sin(t * 2.2) - th * 0.08 + bodyPuff * 0.38, 1 + th * 0.03)
    torso.current.position.y = bodyPuff * 0.012
    // legs: reach out in a leap (front forward, hind back)
    legs.current.forEach((g, i) => {
      if (!g) return
      g.rotation.x = (i < 2 ? -1 : 1) * 0.8 * legSwing
      g.scale.y = stretch
    })
    // the head: sniffs and looks about when idle
    const dip = Math.max(0, Math.sin(t * 0.55)) ** 3
    const idle = 1 - Math.min(1, k + (busy && action !== 'roar' && action !== 'arch' ? 1 : 0))
    head.current.rotation.x = 0.5 * dip * idle - headUp
    head.current.rotation.y = 0.3 * Math.sin(t * 0.31) * idle
    jaw.current.rotation.x = jawOpen
    if (mane.current) mane.current.scale.setScalar(1 + 0.15 * (action === 'roar' ? k : 0))
    tail.current.rotation.x = (P.tail.lift || 0) + tailLift
    earRefs.current.forEach((e, i) => {
      if (!e) return
      const flick = Math.sin(t * 5 + i * 2) > 0.96 ? 0.35 : 0
      e.rotation.z = (i ? 1 : -1) * flick * (ears === 'floppy' ? 0.6 : 1)
      e.rotation.x = -0.7 * earsBack
    })
    eyes.current.forEach((e) => e && (e.scale.y = blinkAt(t, 3.8, 0.4)))
  })

  const b = P.body
  const H = P.head
  const legPos = [
    [P.leg.x, P.leg.z],
    [-P.leg.x, P.leg.z],
    [P.leg.x, -P.leg.z],
    [-P.leg.x, -P.leg.z],
  ]
  const headC = H.off // the head ball's centre within the head group
  const earSize = P.ears.size
  return (
    <group {...handlers}>
      {/* a round patch of ground with flowers and tufts */}
      <mesh geometry={geo.ground} scale={[1.55, 1, 1.55]}>
        <Flat color={C.ground} />
      </mesh>
      {flowers.map(([fx, fz, tuft, c, r], i) => (
        <mesh key={i} geometry={tuft ? geo.tuft : geo.flower} position={[fx, tuft ? 0 : 0.04, fz]} rotation-y={r}>
          <Flat color={tuft ? C.ground2 : c} emissive={tuft ? '#000000' : c} emissiveIntensity={tuft ? 0 : 0.15} />
        </mesh>
      ))}
      <group ref={root}>
        <group scale={S}>
          <group ref={body}>
            <group ref={torso}>
              <mesh geometry={geo.ball} position-y={b.y} scale={b.r}>
                <Flat color={C.fur} />
              </mesh>
              {C.belly && (
                <mesh geometry={geo.ball} position={[0, b.y - b.r[1] * 0.35, 0.02]} scale={[b.r[0] * 0.82, b.r[1] * 0.7, b.r[2] * 0.85]}>
                  <Flat color={C.belly} />
                </mesh>
              )}
              {marks.map((m, i) =>
                m.kind === 'band' ? (
                  <mesh key={i} geometry={geo.ball} position={m.pos} rotation={m.rot} scale={m.scale}>
                    <Flat color={markColors[0]} />
                  </mesh>
                ) : (
                  <mesh key={i} geometry={geo.ball} position={m.pos} quaternion={m.quat} scale={m.scale}>
                    <Flat color={markColors[m.c % markColors.length]} />
                  </mesh>
                ),
              )}
            </group>
            {/* legs, hinged at the hip and shoulder, with paws */}
            {legPos.map(([lx, lz], i) => (
              <group key={i} ref={(el) => (legs.current[i] = el)} position={[lx, P.leg.h, lz]}>
                <mesh geometry={geo.leg}>
                  <Flat color={C.legs} />
                </mesh>
                <mesh geometry={geo.ball} position={[0, -P.leg.h + 0.012, 0.01]} scale={[P.leg.r[0] * 1.1, 0.016, P.leg.r[0] * 1.4]}>
                  <Flat color={C.paws || C.legs} />
                </mesh>
              </group>
            ))}
            {/* tail, pointing back off the rump */}
            <group ref={tail} position={[0, b.y + (P.tail.y || 0.02), -b.r[2] * 0.92]}>
              <Tail
                segs={P.tail.segs || 6}
                length={P.tail.len}
                r0={P.tail.r[0]}
                r1={P.tail.r[1]}
                colors={P.tail.striped ? [C.fur, markColors[0]] : [C.tail || C.fur]}
                rate={P.tail.rate || 0.6}
                amp={P.tail.amp || 0.2}
                droop={P.tail.droop || 0}
                curl={P.tail.curl || 0}
                kick={tap}
                kickAmp={P.tail.kickAmp || 0.3}
                tip={
                  P.tail.tuft ? (
                    <mesh geometry={geo.ball} position-z={-P.tail.len / (P.tail.segs || 6)} scale={[0.022, 0.022, 0.03]}>
                      <Flat color={C.mane || C.mark} />
                    </mesh>
                  ) : null
                }
              />
            </group>
            {/* head */}
            <group ref={head} position={H.pivot}>
              {P.mane && (
                <group ref={mane} position={headC}>
                  {Array.from({ length: 14 }, (_, i) => {
                    const a = (i / 14) * TAU
                    return (
                      <mesh key={i} geometry={geo.ball} position={[Math.cos(a) * H.r[0] * 1.05, Math.sin(a) * H.r[1] * 1.05, -0.02]} scale={[0.055, 0.055, 0.06]}>
                        <Flat color={i % 2 ? C.mane : C.mane2 || C.mane} />
                      </mesh>
                    )
                  })}
                  <mesh geometry={geo.ball} position={[0, -0.02, -0.05]} scale={[H.r[0] * 1.55, H.r[1] * 1.6, 0.07]}>
                    <Flat color={C.mane} />
                  </mesh>
                  <mesh geometry={geo.ball} position={[0, -H.r[1] * 1.05, -0.03]} scale={[0.07, 0.07, 0.06]}>
                    <Flat color={C.mane2 || C.mane} />
                  </mesh>
                </group>
              )}
              <mesh geometry={geo.ball} position={headC} scale={H.r}>
                <Flat color={C.face || C.fur} />
              </mesh>
              {pattern === 'stripes' &&
                [-1, 0, 1].map((sx) => (
                  <mesh key={sx} geometry={geo.bar} position={[headC[0] + sx * 0.022, headC[1] + H.r[1] * 0.9, headC[2] + 0.02 - Math.abs(sx) * 0.01]} rotation={[0.35, 0, sx * 0.35]} scale={[0.006, 0.006, 0.05]}>
                    <Flat color={markColors[0]} />
                  </mesh>
                ))}
              <mesh geometry={geo.ball} position={P.muzzle.off} scale={P.muzzle.r}>
                <Flat color={C.muzzle} />
              </mesh>
              {/* the lower jaw, which opens to roar, bark or hiss */}
              <group ref={jaw} position={P.jaw.off}>
                <mesh geometry={geo.ball} position={[0, -0.006, P.jaw.len]} scale={[P.muzzle.r[0] * 0.8, 0.013, P.muzzle.r[2] * 0.85]}>
                  <Flat color={C.muzzle} />
                </mesh>
                <mesh geometry={geo.ball} position={[0, 0.004, P.jaw.len]} scale={[P.muzzle.r[0] * 0.6, 0.006, P.muzzle.r[2] * 0.65]}>
                  <Flat color="#8a2b36" />
                </mesh>
              </group>
              <mesh geometry={geo.ball} position={P.nose.off} scale={P.nose.r}>
                <Flat color={C.nose || '#1b1a22'} roughness={0.35} />
              </mesh>
              {P.whiskers &&
                [-1, 1].map((sx) =>
                  [-0.008, 0, 0.008].map((dy, j) => (
                    <mesh key={`${sx}${j}`} geometry={geo.bar} position={[P.muzzle.off[0] + sx * (P.muzzle.r[0] + 0.03), P.muzzle.off[1] + dy, P.muzzle.off[2] + 0.005]} rotation={[0, sx * 0.15, sx * (j - 1) * 0.15]} scale={[0.06, 0.0018, 0.0018]}>
                      <Flat color={C.whisker || '#f4f2ee'} />
                    </mesh>
                  )),
                )}
              {/* ears */}
              {[-1, 1].map((sx, i) => (
                <group key={sx} ref={(el) => (earRefs.current[i] = el)} position={[sx * P.ears.x, P.ears.y, P.ears.z]}>
                  {ears === 'round' && (
                    <>
                      <mesh geometry={geo.ball} scale={earSize}>
                        <Flat color={C.ear || C.fur} />
                      </mesh>
                      <mesh geometry={geo.ball} position={[0, 0, earSize * 0.45]} scale={[earSize * 0.58, earSize * 0.58, earSize * 0.35]}>
                        <Flat color={C.earIn || C.muzzle} />
                      </mesh>
                    </>
                  )}
                  {ears === 'point' && (
                    <group rotation={[-0.1, 0, sx * -0.28]}>
                      <mesh geometry={geo.point} scale={[earSize, earSize, earSize * 0.55]}>
                        <Flat color={C.ear || C.fur} />
                      </mesh>
                      <mesh geometry={geo.point} position={[0, earSize * 0.2, earSize * 0.3]} scale={[earSize * 0.6, earSize * 0.7, earSize * 0.3]}>
                        <Flat color={C.earIn || C.muzzle} />
                      </mesh>
                    </group>
                  )}
                  {ears === 'floppy' && (
                    <mesh geometry={geo.ball} position={[sx * earSize * 0.4, -earSize * 1.1, 0]} rotation-z={sx * 0.35} scale={[earSize * 0.55, earSize * 1.6, earSize * 0.95]}>
                      <Flat color={C.ear || C.fur} />
                    </mesh>
                  )}
                </group>
              ))}
              {/* eyes: plain dark beads, or coloured with a pupil */}
              {[-1, 1].map((sx, i) => (
                <group key={`e${sx}`} ref={(el) => (eyes.current[i] = el)} position={[sx * P.eyes.x, P.eyes.y, P.eyes.z]}>
                  <mesh geometry={geo.ball} scale={P.eyes.r}>
                    <Flat color={C.eye || '#1b1a22'} roughness={0.3} emissive={C.eye || '#000000'} emissiveIntensity={C.eye ? 0.25 : 0} />
                  </mesh>
                  {C.eye && (
                    <mesh geometry={geo.ball} position-z={P.eyes.r * 0.75} scale={[P.eyes.r * (P.slit ? 0.28 : 0.55), P.eyes.r * 0.85, P.eyes.r * 0.3]}>
                      <Flat color="#141218" roughness={0.3} />
                    </mesh>
                  )}
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
      {/* a puff from the mouth on the tap, and dust where it lands */}
      <Burst tap={tap} geometry={geo.dust} count={action === 'roar' ? 12 : 6} colors={['#ffffff', '#f4efe6']} speed={1.3} gravity={-0.4} size={0.045} life={1.1} origin={[0, S * (H.pivot[1] + P.muzzle.off[1]) + 0.05, S * (H.pivot[2] + P.nose.off[2]) + 0.1]} spread={0.7} up={0.6} />
      <Burst tap={thud} geometry={geo.dust} count={14} colors={[C.ground2, '#c9b48a', '#e2d6bc']} speed={1.3} gravity={3} size={0.045} life={0.8} origin={[0, 0.05, 0.5]} spread={1.2} />
      <Ripple tap={action === 'pounce' ? thud : tap} color="#ffffff" radius={1.6} count={2} y={0.012} />
    </group>
  )
}

// The grounds the animals stand on.
export const MEADOW = { ground: '#5cb84e', ground2: '#4fa844', flowers: ['#f4c2d4', '#ffffff', '#ffd6e6'] }
export const SAVANNA = { ground: '#b8b24e', ground2: '#a19a40', flowers: ['#ffd23f', '#ffffff', '#ff9a5c'] }
export const SNOW = { ground: '#eef3f8', ground2: '#dfe7ef', flowers: ['#cfe6ff', '#ffffff', '#b8d8f0'] }
