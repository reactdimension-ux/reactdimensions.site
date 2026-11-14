import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Arrow, { ARROW } from '../arrow/Arrow.jsx'
import { buildWood } from '../gameboard/textures.js'

// A field archery target: an 80 cm ten-ring face pinned to a round straw
// boss, leaning back on a wooden tripod stand. Arrows (the library's Arrow
// model) fly in, stick in the straw with a quiver, and score by ring.
//
// Reused: the arrow is arrow/Arrow.jsx, the stand's pine grain is the board
// models' buildWood().

export const BOSS = { r: 0.42, t: 0.2, face: 0.4 }
const TILT = 0.2 // the boss leans back about 11.5 degrees
const C = new THREE.Vector3(0, 1.28, 0) // the boss's centre
const N = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT)) // face normal
const U = new THREE.Vector3(0, Math.cos(TILT), -Math.sin(TILT)) // up the face
const RIGHT = new THREE.Vector3(1, 0, 0)
export const FACE_CENTRE = C.clone().addScaledVector(N, BOSS.t / 2)
export const FACE_NORMAL = N

// ---- textures ----
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const STRAW = ['#d9bf86', '#c9a86a', '#e6d29e', '#b8955a', '#d2b57a', '#a8864d']

// the boss's rim: straw pressed in layers, fibres running round it
function strawSide() {
  const W = 2048
  const H = 512
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  const r = rng(5)
  g.fillStyle = '#c4a46a'
  g.fillRect(0, 0, W, H)
  g.lineCap = 'round'
  for (let i = 0; i < 9000; i++) {
    const x = r() * W
    const y = r() * H
    const len = 30 + r() * 140
    const wob = (r() - 0.5) * 10
    g.strokeStyle = STRAW[Math.floor(r() * STRAW.length)]
    g.globalAlpha = 0.55 + r() * 0.45
    g.lineWidth = 1.5 + r() * 3.5
    for (const o of [-W, 0, W]) {
      g.beginPath()
      g.moveTo(x + o, y)
      g.quadraticCurveTo(x + o + len / 2, y + wob, x + o + len, y + wob * 0.4)
      g.stroke()
    }
  }
  // darker gaps between the layers
  g.globalAlpha = 0.35
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = '#6e5430'
    g.lineWidth = 1 + r() * 2
    const x = r() * W
    const y = r() * H
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + 40 + r() * 160, y + (r() - 0.5) * 4)
    g.stroke()
  }
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}
// the boss's faces: straw coiled round and round
function strawCap() {
  const S = 1024
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const r = rng(9)
  g.fillStyle = '#c7a86d'
  g.fillRect(0, 0, S, S)
  g.lineCap = 'round'
  for (let i = 0; i < 7000; i++) {
    const rad = Math.sqrt(r()) * S * 0.5
    const a = r() * Math.PI * 2
    const span = (20 + r() * 80) / Math.max(rad, 40)
    g.strokeStyle = STRAW[Math.floor(r() * STRAW.length)]
    g.globalAlpha = 0.5 + r() * 0.5
    g.lineWidth = 1.2 + r() * 3
    g.beginPath()
    g.arc(S / 2, S / 2, rad, a, a + span)
    g.stroke()
  }
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// The face: five colours, two rings each, scoring lines between them (black
// on the light rings, white on the black), the inner ten (X) and a centre
// cross, printed on slightly textured paper.
const COLORS = ['#f7f6f1', '#f7f6f1', '#1c1c1e', '#1c1c1e', '#2fa8e0', '#2fa8e0', '#e1262d', '#e1262d', '#f6dc1d', '#f6dc1d']
function faceTexture() {
  const S = 2048
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const R = S / 2
  const ring = R / 10
  g.fillStyle = '#f7f6f1'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 10; i++) {
    g.fillStyle = COLORS[i]
    g.beginPath()
    g.arc(R, R, R - i * ring, 0, Math.PI * 2)
    g.fill()
  }
  // scoring lines
  for (let i = 0; i <= 10; i++) {
    const rad = R - i * ring
    if (rad <= 0) continue
    g.strokeStyle = i === 3 ? '#f2f2ee' : '#141414'
    g.lineWidth = i === 0 ? 3 : 2
    g.beginPath()
    g.arc(R, R, rad - 1, 0, Math.PI * 2)
    g.stroke()
  }
  g.strokeStyle = '#141414'
  g.lineWidth = 1.6
  g.beginPath()
  g.arc(R, R, ring / 2, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.moveTo(R - 12, R)
  g.lineTo(R + 12, R)
  g.moveTo(R, R - 12)
  g.lineTo(R, R + 12)
  g.stroke()
  // paper grain
  const r = rng(3)
  for (let i = 0; i < 60000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)'
    g.fillRect(r() * S, r() * S, 2, 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  return t
}

// ---- the stand ----
// a beam of pine between two points, its narrow side facing `face`
function Beam({ a, b, w = 0.045, d = 0.03, mat, face = N }) {
  const { pos, quat, len } = useMemo(() => {
    const A = new THREE.Vector3(...a)
    const B = new THREE.Vector3(...b)
    const dir = B.clone().sub(A)
    const L = dir.length()
    dir.normalize()
    // orient: y along the beam, z towards `face` (kept square to the beam)
    const zf = face.clone().sub(dir.clone().multiplyScalar(face.dot(dir))).normalize()
    const x = new THREE.Vector3().crossVectors(dir, zf)
    const m = new THREE.Matrix4().makeBasis(x, dir, zf)
    return { pos: A.clone().add(B).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromRotationMatrix(m), len: L }
  }, [a, b, face])
  return (
    <mesh position={pos} quaternion={quat} material={mat} castShadow receiveShadow>
      <boxGeometry args={[w, len, d]} />
    </mesh>
  )
}
function Bolt({ at, dir = N, mat }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), [dir])
  return (
    <mesh position={at} quaternion={q} material={mat} castShadow>
      <cylinderGeometry args={[0.007, 0.007, 0.006, 6]} />
    </mesh>
  )
}

function Stand({ wood, steel }) {
  const g = useMemo(() => {
    const back = C.clone().addScaledVector(N, -BOSS.t / 2 - 0.022)
    const at = (s, side) => back.clone().addScaledVector(U, s).addScaledVector(RIGHT, side)
    // front legs, in a plane just behind the boss, splayed at the foot
    const topS = 0.36
    const footS = -back.y / U.y
    const legs = [-1, 1].map((sd) => {
      const top = at(topS, sd * 0.13)
      const foot = at(footS, sd * 0.4)
      foot.y = 0
      return { top, foot }
    })
    const legAt = (leg, y) => leg.foot.clone().lerp(leg.top, y / leg.top.y)
    const apex = at(topS + 0.02, 0)
    const rearFoot = new THREE.Vector3(0, 0, back.z - 0.95)
    // pegs the boss sits on, sticking out of the front legs under its rim
    const pegY = C.y - BOSS.r * Math.cos(TILT) + 0.01
    const pegs = legs.map((l) => {
      const p = legAt(l, pegY)
      return { a: p.clone(), b: p.clone().addScaledVector(N, 0.26) }
    })
    const braceY = 0.5
    const brace = [legAt(legs[0], braceY), legAt(legs[1], braceY)]
    const braceMid = brace[0].clone().lerp(brace[1], 0.5)
    const rearAt = rearFoot.clone().lerp(apex, braceY / apex.y)
    return { legs, apex, rearFoot, pegs, brace, braceMid, rearAt }
  }, [])
  const v = (p) => p.toArray()
  return (
    <group>
      {g.legs.map((l, i) => (
        <Beam key={i} a={v(l.foot)} b={v(l.top)} mat={wood} />
      ))}
      <Beam a={v(g.rearFoot)} b={v(g.apex)} mat={wood} face={new THREE.Vector3(1, 0, 0)} />
      {g.pegs.map((p, i) => (
        <Beam key={i} a={v(p.a)} b={v(p.b)} w={0.04} d={0.045} mat={wood} face={new THREE.Vector3(0, 1, 0)} />
      ))}
      <Beam a={v(g.brace[0])} b={v(g.brace[1])} w={0.04} d={0.02} mat={wood} />
      <Beam a={v(g.braceMid)} b={v(g.rearAt)} w={0.035} d={0.02} mat={wood} face={new THREE.Vector3(1, 0, 0)} />
      {/* the hinge plate at the top, and bolts at the joints */}
      <mesh position={v(g.apex)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), N)} material={steel} castShadow>
        <boxGeometry args={[0.3, 0.05, 0.004]} />
      </mesh>
      {[...g.pegs.map((p) => p.a), ...g.brace, g.braceMid, g.rearAt].map((p, i) => (
        <Bolt key={i} at={v(p.clone().addScaledVector(N, 0.018))} mat={steel} />
      ))}
    </group>
  )
}

// ---- arrows in flight and in the boss ----
const SHOT_TIME = 0.42
const EMBED = 0.13 // how far the point goes into the straw
function StuckArrow({ hit, dir, born, arrowProps }) {
  const group = useRef()
  const invalidate = useThree((s) => s.invalidate)
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), [dir])
  const full = ARROW.len + ARROW.point
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), w: new THREE.Quaternion(), axis: new THREE.Vector3() }), [])
  const axis = useMemo(() => new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), [dir])
  useFrame((state) => {
    const t = state.clock.elapsedTime - born.current
    const g = group.current
    // flying in: the point travels to `hit` minus the embed
    const k = Math.min(1, t / SHOT_TIME)
    const tipEnd = tmp.p.copy(hit).addScaledVector(dir, EMBED)
    const tip = tipEnd.clone().addScaledVector(dir, -(1 - k) * 9)
    tip.y += Math.sin(k * Math.PI) * 0.15 * (1 - k)
    g.position.copy(tip).addScaledVector(dir, -full)
    // after impact, the shaft quivers about the point and settles
    const after = t - SHOT_TIME
    let wobble = 0
    if (after > 0) wobble = Math.sin(after * 70) * Math.exp(-after * 6) * 0.03
    g.quaternion.copy(tmp.w.setFromAxisAngle(axis, wobble)).multiply(q)
    if (wobble) {
      // pivot about the point, not the nock
      const off = new THREE.Vector3(0, full, 0).applyQuaternion(g.quaternion)
      g.position.copy(tipEnd).sub(off)
    }
    if (after < 1.2) invalidate()
  })
  return (
    <group ref={group}>
      <Arrow {...arrowProps} />
    </group>
  )
}

function score(hit) {
  const d = hit.clone().sub(FACE_CENTRE)
  const r = Math.hypot(d.dot(RIGHT), d.dot(U))
  if (r <= BOSS.face / 20) return { label: 'X', value: 10 }
  const ring = 10 - Math.floor(r / (BOSS.face / 10))
  return ring >= 1 ? { label: String(ring), value: ring } : { label: 'M', value: 0 }
}

const Target = forwardRef(function Target({ standColor = '#d8ae72', spread = 0.07, vaneColor, cockColor, nockColor, point, onScores }, ref) {
  const invalidate = useThree((s) => s.invalidate)
  const clock = useThree((s) => s.clock)
  const tex = useMemo(() => {
    const wood = buildWood(7)
    // the grain runs along u; turn it to run along each beam (box v)
    wood.center.set(0.5, 0.5)
    wood.rotation = Math.PI / 2
    wood.repeat.set(1.6, 0.12)
    return { side: strawSide(), cap: strawCap(), face: faceTexture(), wood }
  }, [])
  const mats = useMemo(
    () => ({
      side: new THREE.MeshStandardMaterial({ map: tex.side, bumpMap: tex.side, bumpScale: 0.004, roughness: 0.95 }),
      cap: new THREE.MeshStandardMaterial({ map: tex.cap, bumpMap: tex.cap, bumpScale: 0.004, roughness: 0.95 }),
      face: new THREE.MeshStandardMaterial({ map: tex.face, roughness: 0.82 }),
      wood: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.62 }),
      steel: new THREE.MeshStandardMaterial({ color: '#b9bcbf', metalness: 1, roughness: 0.35 }),
    }),
    [tex],
  )
  useLayoutEffect(() => {
    mats.wood.color.set(standColor)
    invalidate()
  }, [mats, standColor, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      Object.values(tex).forEach((t) => t.dispose())
    },
    [mats, tex],
  )

  // the boss and its face, built facing +z then leaned back
  const boss = useRef()
  const shake = useRef(0)
  const bossQ = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), N), [])

  const [arrows, setArrows] = useState([])
  const r = useMemo(() => rng(Date.now() & 0xffff), [])
  const shoot = () => {
    // a group around the middle: normal-ish scatter on the face
    const gx = Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()) * spread
    const gy = Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()) * spread
    const hit = FACE_CENTRE.clone().addScaledVector(RIGHT, Math.max(-0.4, Math.min(0.4, gx))).addScaledVector(U, Math.max(-0.4, Math.min(0.4, gy)))
    // arrows come in level-ish, a touch downward
    const dir = new THREE.Vector3(-gx * 0.05, -0.04, -1).normalize()
    const born = { current: clock.elapsedTime }
    const s = score(hit)
    setArrows((list) => [...list.slice(-11), { id: Math.random(), hit, dir, born, s }])
    setTimeout(() => {
      shake.current = 1
      invalidate()
    }, SHOT_TIME * 1000)
    invalidate()
  }
  const collect = () => setArrows([])
  useImperativeHandle(ref, () => ({ shoot, collect }))
  useEffect(() => onScores?.(arrows.map((a) => a.s)), [arrows]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (shake.current <= 0) return
    shake.current = Math.max(0, shake.current - delta * 3)
    const s = shake.current
    boss.current.rotation.x = Math.sin(s * 40) * 0.004 * s
    invalidate()
  })

  const arrowProps = { vaneColor, cockColor, nockColor, point }
  return (
    <group>
      <Stand wood={mats.wood} steel={mats.steel} />
      <group position={C.toArray()} quaternion={bossQ}>
        <group ref={boss}>
          {/* straw rim and back, then the face on the front */}
          <mesh rotation-x={Math.PI / 2} material={mats.side} castShadow receiveShadow>
            <cylinderGeometry args={[BOSS.r, BOSS.r * 0.985, BOSS.t, 96, 1, true]} />
          </mesh>
          <mesh position-z={BOSS.t / 2} material={mats.cap} receiveShadow>
            <circleGeometry args={[BOSS.r, 96]} />
          </mesh>
          <mesh position-z={-BOSS.t / 2} rotation-y={Math.PI} material={mats.cap}>
            <circleGeometry args={[BOSS.r * 0.985, 96]} />
          </mesh>
          <mesh position-z={BOSS.t / 2 + 0.001} material={mats.face} receiveShadow>
            <circleGeometry args={[BOSS.face, 128]} />
          </mesh>
        </group>
      </group>
      {arrows.map((a) => (
        <StuckArrow key={a.id} hit={a.hit} dir={a.dir} born={a.born} arrowProps={arrowProps} />
      ))}
    </group>
  )
})

export default Target
