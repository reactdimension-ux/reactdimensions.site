import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'

// One steel-tip dart, close up and at real size (about 150 mm long, 22 g),
// thrown into a sisal practice target.
//
// The dart is turned like a real one: a needle point with grip grooves, a
// barrel cut with ring grooves, a nylon shaft with a protector ring and four
// printed flights. Its origin is the very tip, so when it sticks it pivots
// about the point buried in the bristle.
//
// Throwing: the launch is solved so gravity drops it onto the aim point.
// In the air the flights keep it lined up with its path, with the small
// fish-tail wobble every dart has just after release, dying away as the
// flights catch up. It goes in nose-first, tilted tail-up by the drop, and
// the tail then shudders round the point and settles (a damped spring).
// Pull it out and the bristle keeps a small hole that slowly closes up.

const G = 9.81
const FACE_R = 0.095 // sisal face radius
const FACE_T = 0.035 // its depth
const START = new THREE.Vector3(0.03, 0.035, 0.95) // the hand, in front of the target
const EMBED = 0.007 // how far the point goes in
const BACK = new THREE.Vector3(0, 0, -1) // the model's nose direction

function flightTexture(color, pattern) {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 })
  const g = c.getContext('2d')
  g.fillStyle = color
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = 'rgba(255,255,255,0.92)'
  if (pattern === 'stripes') {
    for (let k = 0; k < 3; k++) g.fillRect(0, 150 + k * 34, 256, 13)
  } else if (pattern === 'chevron') {
    g.beginPath()
    g.moveTo(0, 120)
    g.lineTo(128, 200)
    g.lineTo(256, 120)
    g.lineTo(256, 160)
    g.lineTo(128, 240)
    g.lineTo(0, 160)
    g.fill()
  } else if (pattern === 'target') {
    for (const [r, a] of [[70, 1], [48, 0], [26, 1]]) {
      g.fillStyle = a ? 'rgba(255,255,255,0.92)' : color
      g.beginPath()
      g.arc(128, 175, r, 0, Math.PI * 2)
      g.fill()
    }
  }
  // the printed film has a faint sheen line along the fold
  g.fillStyle = 'rgba(255,255,255,0.18)'
  g.fillRect(124, 0, 8, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function sisalTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 512 })
  const g = c.getContext('2d')
  g.fillStyle = '#b89a6c'
  g.fillRect(0, 0, 512, 512)
  // end-on fibres: thousands of tiny bristle tips in slightly different tones
  for (let i = 0; i < 26000; i++) {
    const l = 40 + Math.random() * 30
    g.fillStyle = `hsla(${34 + Math.random() * 8}, ${30 + Math.random() * 20}%, ${l}%, 0.55)`
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6)
  }
  // a printed black ring and a red centre to aim at
  g.lineWidth = 16
  g.strokeStyle = 'rgba(20,18,16,0.85)'
  g.beginPath()
  g.arc(256, 256, 150, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = 'rgba(190,24,28,0.9)'
  g.beginPath()
  g.arc(256, 256, 34, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(20,18,16,0.85)'
  g.beginPath()
  g.arc(256, 256, 12, 0, Math.PI * 2)
  g.fill()
  // re-sprinkle fibre over the print so it sits in the bristle, not on it
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '210,180,130' : '70,55,35'},0.18)`
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.4, 1.4)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const BARREL = { brass: ['#c9a24a', 0.3], tungsten: ['#8d9096', 0.28], black: ['#26272b', 0.42] }

// the dart, built along -z from the tip at the origin
function DartBody({ flight, pattern, barrel, shaft }) {
  const parts = useMemo(() => {
    const V = (r, y) => new THREE.Vector2(r, y)
    // point: a needle, with three grip grooves near the barrel
    const pp = [V(0.0001, 0), V(0.0005, -0.0015), V(0.001, -0.01)]
    for (let k = 0; k < 3; k++) pp.push(V(0.0011, -0.014 - k * 0.004), V(0.00095, -0.0155 - k * 0.004), V(0.0011, -0.017 - k * 0.004))
    pp.push(V(0.0012, -0.03), V(0.0012, -0.032))
    // barrel: a nose cone, a ring-cut grip section, a plain rear
    const bp = [V(0.0012, -0.032), V(0.0026, -0.0335), V(0.0033, -0.036)]
    for (let k = 0; k < 14; k++) {
      const z = -0.039 - k * 0.0022
      bp.push(V(0.0035, z), V(0.003, z - 0.0005), V(0.003, z - 0.001), V(0.0035, z - 0.0014))
    }
    bp.push(V(0.0034, -0.072), V(0.0031, -0.08), V(0.0023, -0.083))
    const sp = [V(0.0023, -0.083), V(0.0021, -0.087), V(0.0021, -0.112), V(0.0026, -0.1135), V(0.0026, -0.1155), V(0.0019, -0.117), V(0.0019, -0.121), V(0.0001, -0.1215)]
    const point = new THREE.LatheGeometry(pp, 14)
    const barrelGeo = new THREE.LatheGeometry(bp, 32)
    const shaftGeo = new THREE.LatheGeometry(sp, 18)
    for (const g of [point, barrelGeo, shaftGeo]) g.rotateX(Math.PI / 2) // y -> z
    // a standard flight: narrow at the shaft, flared, with a notched back
    const sh = new THREE.Shape()
    sh.moveTo(0, -0.1)
    sh.lineTo(0.0165, -0.117)
    sh.quadraticCurveTo(0.018, -0.13, 0.017, -0.142)
    sh.lineTo(0, -0.135)
    sh.lineTo(-0.017, -0.142)
    sh.quadraticCurveTo(-0.018, -0.13, -0.0165, -0.117)
    sh.closePath()
    const fl = new THREE.ShapeGeometry(sh, 8)
    const uv = fl.attributes.uv
    const pos = fl.attributes.position
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 0.018) / 0.036, (pos.getY(i) + 0.142) / 0.042)
    fl.rotateX(Math.PI / 2)
    const fl2 = fl.clone().rotateZ(Math.PI / 2)
    return { point, barrelGeo, shaftGeo, fl, fl2 }
  }, [])
  const tex = useMemo(() => flightTexture(flight, pattern), [flight, pattern])
  useEffect(() => () => tex.dispose(), [tex])
  const [bc, br] = BARREL[barrel] || BARREL.tungsten
  // the model is built nose +z; turn it to point -z
  return (
    <group rotation-y={Math.PI}>
      <mesh geometry={parts.point} castShadow>
        <meshStandardMaterial color="#cfd2d8" metalness={1} roughness={0.22} />
      </mesh>
      <mesh geometry={parts.barrelGeo} castShadow>
        <meshStandardMaterial color={bc} metalness={barrel === 'black' ? 0.6 : 1} roughness={br} />
      </mesh>
      <mesh geometry={parts.shaftGeo} castShadow>
        <meshPhysicalMaterial color={shaft} roughness={0.35} clearcoat={0.6} />
      </mesh>
      {[parts.fl, parts.fl2].map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshPhysicalMaterial map={tex} roughness={0.3} clearcoat={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export default function Dart({ flight = '#1f6fd1', pattern = 'stripes', barrel = 'tungsten', shaft = '#18181b', speed = 9, accuracy = 12, slowMotion = 0.15, autoThrow = false, throwKey = 0 }) {
  const dart = useRef()
  const holes = useRef()
  const faceTex = useMemo(() => sisalTexture(), [])
  useEffect(() => () => faceTex.dispose(), [faceTex])
  const [hover, setHover] = useState(false)
  useCursor(hover)

  const HOLES = 24
  const s = useRef({
    phase: 'stuck', // stuck | pulling | flying
    t: 0,
    p: new THREE.Vector3(0.012, 0.018, -EMBED),
    v: new THREE.Vector3(),
    q: new THREE.Quaternion().setFromUnitVectors(BACK, new THREE.Vector3(-0.05, -0.12, -1).normalize()),
    from: null,
    aim: null,
    wob: 0, // tail swing at impact
    holes: [],
    nextAuto: 1.5,
  })
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), e: new THREE.Euler(), d: new THREE.Vector3(), m: new THREE.Object3D() }), [])

  // aim and launch: speed is the release speed, the vertical speed is
  // solved so the drop lands on the aim point
  const launch = (aim) => {
    const st = s.current
    const err = () => (accuracy / 1000) * Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random()) * 0.6
    const target = new THREE.Vector3(aim.x + err(), aim.y + err(), 0)
    target.clampLength(0, FACE_R * 0.92)
    const d = new THREE.Vector3().subVectors(target, START)
    const T = d.length() / speed
    st.v.set(d.x / T, d.y / T + 0.5 * G * T, d.z / T)
    st.p.copy(START)
    st.phase = 'flying'
    st.t = 0
  }
  const pull = (aim) => {
    const st = s.current
    if (st.phase === 'pulling') return
    st.ft = 0
    if (st.phase === 'stuck') st.holes.push({ x: st.p.x, y: st.p.y, age: 0 })
    if (st.holes.length > HOLES) st.holes.shift()
    st.from = { p: st.p.clone(), q: st.q.clone() }
    st.aim = aim
    st.phase = 'pulling'
    st.t = 0
  }
  useEffect(() => {
    if (throwKey) pull({ x: 0, y: 0 })
  }, [throwKey])

  useFrame((_, delta) => {
    const dt = Math.min(1 / 30, delta)
    const st = s.current
    st.t += dt
    if (autoThrow && st.phase === 'stuck') {
      st.nextAuto -= dt
      if (st.nextAuto <= 0) {
        st.nextAuto = 2.2
        pull({ x: 0, y: 0 })
      }
    }
    if (st.phase === 'pulling') {
      // drawn back out to the hand, pointing down the line of the next throw
      const k = Math.min(1, st.t / 0.55)
      const e = k * k * (3 - 2 * k)
      st.p.lerpVectors(st.from.p, START, e)
      st.p.y += Math.sin(e * Math.PI) * 0.06
      tmp.d.subVectors(new THREE.Vector3(st.aim.x, st.aim.y, 0), START).normalize()
      tmp.q.setFromUnitVectors(BACK, tmp.d)
      st.q.slerpQuaternions(st.from.q, tmp.q, e)
      if (k >= 1) launch(st.aim)
    } else if (st.phase === 'flying') {
      // real time slowed down; small steps so the hit is exact
      let rem = dt * slowMotion
      while (rem > 0 && st.phase === 'flying') {
        const h = Math.min(rem, 1 / 2000)
        rem -= h
        st.v.y -= G * h
        st.p.addScaledVector(st.v, h)
        st.ft = (st.ft || 0) + h
        if (st.p.z <= -EMBED) {
          // in: the point stops dead, the tail keeps the swing it had
          const back = (st.p.z + EMBED) / st.v.z
          st.p.addScaledVector(st.v, -back)
          st.phase = 'stuck'
          st.wob = 0.05 + Math.min(0.06, Math.abs(st.fish || 0))
          st.t = 0
          st.qStick = st.q.clone()
        }
      }
      if (st.phase === 'flying') {
        // along the path, plus the fish-tail: about 25 Hz real, dying in ~40 ms
        const ft = st.ft
        st.fish = 0.09 * Math.exp(-ft / 0.04) * Math.sin(2 * Math.PI * 25 * ft)
        tmp.q.setFromUnitVectors(BACK, tmp.d.copy(st.v).normalize())
        st.q.copy(tmp.q).multiply(new THREE.Quaternion().setFromEuler(tmp.e.set(st.fish * 0.5, st.fish, 0)))
      } else st.ft = 0
    } else if (st.phase === 'stuck' && st.qStick) {
      // the tail shudders round the buried point and settles: ~9 Hz, slowed
      const t = st.t * slowMotion
      const w = st.wob * Math.exp(-t / 0.09) * Math.cos(2 * Math.PI * 9 * t)
      st.q.copy(st.qStick).multiply(new THREE.Quaternion().setFromEuler(tmp.e.set(w, w * 0.35, 0)))
    }
    dart.current.position.copy(st.p)
    dart.current.quaternion.copy(st.q)

    // old holes close up as the bristle springs back
    st.holes.forEach((h) => (h.age += dt))
    for (let i = 0; i < HOLES; i++) {
      const h = st.holes[i]
      const k = h ? Math.max(0, 1 - h.age / 40) : 0
      tmp.m.position.set(h ? h.x : 0, h ? h.y : 0, 0.0004)
      tmp.m.scale.setScalar(k * 0.0011 + 1e-6)
      tmp.m.updateMatrix()
      holes.current.setMatrixAt(i, tmp.m.matrix)
    }
    holes.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {/* the practice target: a sisal disc in a turned wooden rim */}
      <mesh position={[0, 0, -FACE_T / 2]} rotation-x={Math.PI / 2} receiveShadow castShadow
        onClick={(e) => {
          e.stopPropagation()
          pull({ x: e.point.x, y: e.point.y })
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <cylinderGeometry args={[FACE_R, FACE_R, FACE_T, 96]} />
        <meshStandardMaterial attach="material-0" color="#8f7550" roughness={1} />
        <meshStandardMaterial attach="material-1" map={faceTex} roughness={1} />
        <meshStandardMaterial attach="material-2" color="#6d5940" roughness={1} />
      </mesh>
      <mesh position={[0, 0, -FACE_T / 2 - 0.004]} castShadow receiveShadow>
        <torusGeometry args={[FACE_R + 0.004, 0.006, 16, 96]} />
        <meshPhysicalMaterial color="#3b2616" roughness={0.45} clearcoat={0.6} />
      </mesh>
      <instancedMesh ref={holes} args={[null, null, HOLES]}>
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color="#2b2014" transparent opacity={0.8} />
      </instancedMesh>
      <group ref={dart}>
        <DartBody flight={flight} pattern={pattern} barrel={barrel} shaft={shaft} />
      </group>
    </group>
  )
}
