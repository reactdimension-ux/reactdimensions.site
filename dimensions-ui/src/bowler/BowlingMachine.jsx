import { createRef, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createBowlerAudio } from './audio.js'
import { TennisBallMesh, TENNIS_BALL } from '../tennisball/TennisBall.jsx'
import { CricketBallMesh, CRICKET_BALL } from '../cricketball/CricketBall.jsx'
import { createBall, stepBall } from '../tennisball/physics.js'

// A single-wheel bowling machine on a tripod, with a spiral hopper that
// feeds it on its own.
//
// How it works, and how it is simulated:
//   hopper   balls sit nose to tail on a two-tier spiral ramp. They roll
//            down it under gravity (5/7 g sin(slope) for a rolling ball,
//            less a little rolling drag), queue against a gate at the
//            bottom, and knock into each other as they close up.
//   feed     every few seconds the gate lets the front ball go: it drops
//            down the feed tube, through the funnel and onto the wheel.
//   wheel    a motor turns a rubber-tyred wheel at a few thousand rpm. The
//            ball is squeezed between the wheel and the inside of the
//            housing, rolls along the housing and leaves the mouth at a
//            share of the tyre's speed, with backspin (its bottom is
//            dragged forward by the tyre). Each ball takes energy out of
//            the wheel, so its rpm dips and recovers: fire too fast and the
//            balls come out slower.
//   head     tilting the head sets the length; turning it about its own
//            axis tilts the spin axis, which is how a one-wheel machine
//            bowls swing or spin: the Magnus force bends the ball the way
//            its spin points. The hopper and feed tube sit on a swivel in
//            the funnel's mouth, so they stay upright while the head turns
//            under them (a top-fed machine can turn about 70° each way;
//            it cannot turn over for topspin without tipping its hopper).
//   flight   the ball flies with real drag and Magnus lift and bounces on
//            the turf (the tennis ball's physics, with each ball's own
//            size, mass and bounce), into a net at the far end.
// SI units: metres. The machine stands at the origin and bowls along +x.

const G = 9.81
const RW = 0.095 // throwing wheel radius
const TRACK = 0.131 // the ball's centre as it rides over the wheel
const EXIT = new THREE.Vector3(0.24, TRACK, 0) // the mouth, head frame
const FUNNEL = { x: -0.04, y: 0.19 }
// the swivel where the feed tube sits in the funnel's mouth
const SWIVEL = new THREE.Vector3(FUNNEL.x, 0.26, 0)
const HOP = { r: 0.105, pitch: 0.095, turns: 1.75, yb: 0.39, a0: (200 * Math.PI) / 180 }
const HOP_AXIS = new THREE.Vector3(FUNNEL.x - HOP.r * Math.cos(HOP.a0), 0, -HOP.r * Math.sin(HOP.a0))
const SPACING = 0.075
const EFF = 0.6 // ball speed as a share of the tyre's speed
const POLE_H = 0.95
const NET_X = 14
const COUNT = 12
// the stumps at the far end, which the balls can hit
const STUMPS = { x: 12.5, z: [-0.0968, 0, 0.0968], r: 0.0175, h: 0.711 }

export const BALL_TYPES = { tennis: TENNIS_BALL, cricket: CRICKET_BALL }
const FLIGHT = {
  tennis: { g: G, Cd: 0.55, Cl: 0.75, e0: 0.74, mu: 0.6, crr: 0.03 },
  cricket: { g: G, Cd: 0.45, Cl: 0.28, e0: 0.5, mu: 0.35, crr: 0.06 },
}

// ---- the feed path: down the spiral, through the gate, down the tube and
// funnel, onto the wheel. Head frame, as a polyline with its arc length.
function feedPath() {
  const pts = []
  const H = 160
  for (let i = 0; i <= H; i++) {
    const k = 1 - i / H
    const th = HOP.a0 + HOP.turns * Math.PI * 2 * k
    pts.push(new THREE.Vector3(HOP_AXIS.x + HOP.r * Math.cos(th), HOP.yb + HOP.pitch * HOP.turns * k, HOP_AXIS.z + HOP.r * Math.sin(th)))
  }
  const gateIndex = pts.length - 1
  pts.push(new THREE.Vector3(FUNNEL.x, HOP.yb - 0.05, 0))
  pts.push(new THREE.Vector3(FUNNEL.x, 0.26, 0))
  pts.push(new THREE.Vector3(FUNNEL.x, 0.2, 0))
  pts.push(new THREE.Vector3(-0.036, 0.16, 0))
  pts.push(new THREE.Vector3(Math.cos(1.8) * TRACK, Math.sin(1.8) * TRACK, 0))
  const len = [0]
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]))
  // above the funnel's mouth the path belongs to the hopper, which swivels
  // to stay upright; below it, to the housing
  return { pts, len, gate: len[gateIndex], end: len[len.length - 1], helixEnd: len[gateIndex], swivel: len[gateIndex + 2] }
}
function along(path, s, out) {
  const { pts, len } = path
  s = Math.min(Math.max(0, s), path.end)
  let i = 1
  while (i < len.length - 1 && len[i] < s) i++
  const t = (s - len[i - 1]) / (len[i] - len[i - 1] || 1)
  out.lerpVectors(pts[i - 1], pts[i], t)
  return (pts[i - 1].y - pts[i].y) / (len[i] - len[i - 1] || 1) // sin of the downhill slope
}

// ---- shapes ----
function smooth(points, n) {
  const c = new THREE.CatmullRomCurve3(
    points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'centripetal',
  )
  return new THREE.Shape(c.getSpacedPoints(n).slice(0, -1).map((p) => new THREE.Vector2(p.x, p.y)))
}
// The housing seen from the side: a round wheel case and a nozzle running
// forward off its top, like a blower's volute. Drawn a bevel inside its edge.
function housingGeometry() {
  const R = 0.118
  const pts = [
    [0.205, 0.172],
    [0.205, 0.09],
    [0.15, 0.084],
    [R * Math.cos(0.55), R * Math.sin(0.55)],
    [R, 0],
    [R * 0.71, -R * 0.71],
    [0, -R],
    [-R * 0.71, -R * 0.71],
    [-R, 0],
    [-R * 0.87, R * 0.5],
    [-0.08, 0.15],
    [-0.02, 0.172],
    [0.1, 0.176],
  ]
  const g = new THREE.ExtrudeGeometry(smooth(pts, 160), { depth: 0.09, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.018, bevelSegments: 6, curveSegments: 12 })
  g.translate(0, 0, -0.045)
  return g
}
// The hopper: a spiral floor with an outer wall, round a central column.
function hopperGeometry() {
  const floor = []
  const wall = []
  const N = 140
  const turns = HOP.turns + 0.12
  for (let i = 0; i <= N; i++) {
    const k = i / N
    const th = HOP.a0 - 0.12 * Math.PI + turns * Math.PI * 2 * k
    const y = HOP.yb - 0.036 - 0.004 + HOP.pitch * (turns * k - 0.06)
    const c = Math.cos(th)
    const s = Math.sin(th)
    floor.push([HOP_AXIS.x + 0.05 * c, y, HOP_AXIS.z + 0.05 * s], [HOP_AXIS.x + 0.155 * c, y, HOP_AXIS.z + 0.155 * s])
    wall.push([HOP_AXIS.x + 0.155 * c, y, HOP_AXIS.z + 0.155 * s], [HOP_AXIS.x + 0.155 * c, y + 0.05, HOP_AXIS.z + 0.155 * s])
  }
  const ribbon = (pairs) => {
    const pos = []
    const idx = []
    pairs.forEach((p) => pos.push(...p))
    for (let i = 0; i < N; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  return { floor: ribbon(floor), wall: ribbon(wall) }
}

// labels: the badge on the motor and the warning sticker by the funnel
function badgeTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 256 })
  const g = c.getContext('2d')
  g.fillStyle = '#1b1b1d'
  g.beginPath()
  g.roundRect(0, 0, 512, 256, 36)
  g.fill()
  g.fillStyle = '#f2f2ee'
  g.font = '800 92px Inter, Arial, sans-serif'
  g.textAlign = 'center'
  g.fillText('PACER', 256, 140)
  g.fillStyle = '#ffb21a'
  g.font = '700 38px Inter, Arial, sans-serif'
  g.fillText('ONE-WHEEL BOWLER', 256, 205)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
function warningTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 320 })
  const g = c.getContext('2d')
  g.fillStyle = '#f4f1ea'
  g.fillRect(0, 0, 256, 320)
  g.fillStyle = '#f08a1c'
  g.fillRect(0, 0, 256, 70)
  g.fillStyle = '#111'
  g.font = '800 44px Arial, sans-serif'
  g.textAlign = 'center'
  g.fillText('WARNING', 128, 52)
  g.font = '600 22px Arial, sans-serif'
  for (const [i, l] of ['Keep hands clear', 'of the wheel and', 'the feed. Never', 'stand in front of', 'the mouth.'].entries()) g.fillText(l, 128, 120 + i * 38)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const easeOut = (t) => 1 - (1 - t) * (1 - t)

// ball: tennis | cricket. speed: km/h. elevation, line: degrees (nose up,
// aim left/right). delivery: backspin | outswing | inswing |
// offspin | legspin (how far the head is turned about its axis). interval:
// seconds between balls. power: the motor. autoFeed: release balls by
// itself. recycle: a fielder sends balls back to the hopper. bodyColor: the
// plastic. sound. feed, collect: bump these numbers to do it.
const DELIVERY = { backspin: 0, outswing: 0.75, inswing: -0.75, offspin: 1.2, legspin: -1.2 }
export const DELIVERIES = Object.keys(DELIVERY)

export default function BowlingMachine({
  ball = 'tennis',
  speed = 70,
  elevation = 0,
  line = 0,
  delivery = 'backspin',
  interval = 3,
  power: powerProp = true,
  autoFeed = true,
  recycle = true,
  bodyColor = '#d4161b',
  sound = false,
  feed = 0,
  collect = 0,
  onChange,
  onReport,
}) {
  const [power, setPowerState] = useState(powerProp)
  useEffect(() => setPowerState(powerProp), [powerProp])
  const setPower = (v) => {
    setPowerState(v)
    onChange?.({ power: v })
  }
  const [hover, setHover] = useState(false)
  useCursor(hover)

  // ---- geometry and materials ----
  const path = useMemo(() => feedPath(), [])
  const geo = useMemo(() => {
    const hop = hopperGeometry()
    const funnel = new THREE.LatheGeometry(
      [
        [0.04, 0],
        [0.043, 0.012],
        [0.07, 0.06],
        [0.078, 0.07],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      48,
    )
    const leg = new THREE.CylinderGeometry(0.011, 0.011, 1, 16)
    return {
      housing: housingGeometry(),
      hopFloor: hop.floor,
      hopWall: hop.wall,
      column: new THREE.CylinderGeometry(0.05, 0.05, HOP.pitch * (HOP.turns + 0.2) + 0.08, 40),
      cap: new THREE.CylinderGeometry(0.062, 0.062, 0.012, 40),
      tube: new THREE.CylinderGeometry(0.043, 0.043, HOP.yb - 0.05 - 0.255, 32, 1, true),
      funnel,
      mouthRim: new THREE.TorusGeometry(0.047, 0.009, 16, 48),
      mouth: new THREE.CircleGeometry(0.046, 40),
      motor: new THREE.CylinderGeometry(0.062, 0.062, 0.15, 48),
      motorCap: new THREE.CylinderGeometry(0.058, 0.064, 0.022, 48),
      vent: new THREE.BoxGeometry(0.006, 0.028, 0.004),
      dial: new THREE.CylinderGeometry(0.014, 0.016, 0.014, 32),
      switchBase: new THREE.BoxGeometry(0.02, 0.028, 0.006),
      switchLever: new THREE.BoxGeometry(0.008, 0.016, 0.012),
      led: new THREE.SphereGeometry(0.004, 16, 12),
      hub: new THREE.CylinderGeometry(0.035, 0.035, 0.012, 32),
      bolt: new THREE.CylinderGeometry(0.004, 0.004, 0.006, 12),
      badge: new THREE.PlaneGeometry(0.1, 0.05),
      warning: new THREE.PlaneGeometry(0.032, 0.04),
      pole: new THREE.CylinderGeometry(0.019, 0.019, POLE_H - 0.1, 24),
      collar: new THREE.CylinderGeometry(0.03, 0.03, 0.06, 24),
      leg,
      foot: new THREE.SphereGeometry(0.022, 16, 10),
      yoke: new THREE.BoxGeometry(0.05, 0.16, 0.012),
      yokeBase: new THREE.BoxGeometry(0.05, 0.016, 0.21),
      axle: new THREE.CylinderGeometry(0.012, 0.012, 0.23, 20),
      lockKnob: new THREE.CylinderGeometry(0.022, 0.022, 0.018, 7),
      gate: new THREE.BoxGeometry(0.004, 0.05, 0.05),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const tex = useMemo(() => ({ badge: badgeTexture(), warning: warningTexture() }), [])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])
  const mats = useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      bodyInside: new THREE.MeshPhysicalMaterial({ roughness: 0.4, side: THREE.DoubleSide }),
      black: new THREE.MeshPhysicalMaterial({ color: '#141416', roughness: 0.45, clearcoat: 0.3, side: THREE.DoubleSide }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a2a2d', roughness: 0.6 }),
      hole: new THREE.MeshBasicMaterial({ color: '#050505' }),
      steel: new THREE.MeshStandardMaterial({ color: '#2b2c2f', metalness: 0.8, roughness: 0.35 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#d9dbe0', metalness: 1, roughness: 0.2 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.9 }),
      led: new THREE.MeshBasicMaterial({ color: '#2bff6a' }),
      badge: new THREE.MeshStandardMaterial({ map: tex.badge, roughness: 0.5 }),
      warning: new THREE.MeshStandardMaterial({ map: tex.warning, roughness: 0.6 }),
      dialMark: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    }),
    [tex],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.body.color.set(bodyColor)
    mats.bodyInside.color.set(bodyColor).multiplyScalar(0.7)
  }, [mats, bodyColor])
  useEffect(() => {
    mats.led.color.set(power ? '#2bff6a' : '#3a1414')
  }, [mats, power])

  // ---- sound ----
  const audio = useRef(null)
  const live = useRef({})
  live.current = { ball, speed, elevation, line, delivery, interval, power, autoFeed, recycle, sound }
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const lastSound = useRef({})
  const play = (name, ...a) => {
    if (!live.current.sound) return
    const now = performance.now()
    if (now - (lastSound.current[name] || 0) < 35) return
    lastSound.current[name] = now
    if (!audio.current) audio.current = createBowlerAudio()
    audio.current?.[name](...a)
  }

  // ---- the balls ----
  // state: queue (on the feed path, at arc length s) | flight (free body) |
  // fade (being picked up) | wait (with the fielder, coming back)
  const world = useMemo(() => {
    const balls = Array.from({ length: COUNT }, (_, i) => ({ i, state: 'queue', s: Math.max(0, path.gate - i * SPACING), v: 0, released: false, body: null, t: 0, scale: 1, q: new THREE.Quaternion() }))
    return { balls, rpm: 0, release: 0, gate: 0, fired: 0, last: null }
  }, [path])
  const refs = useMemo(() => Array.from({ length: COUNT }, () => createRef()), [])

  const headRef = useRef()
  const aimRef = useRef()
  const tiltRef = useRef()
  const rollRef = useRef()
  const swivelRef = useRef()
  const uprightRef = useRef()
  const hubRef = useRef()
  const dialRef = useRef()
  const gateRef = useRef()
  const leverRef = useRef()
  const ang = useRef({ yaw: 0, tilt: 0, roll: 0 })

  // the wheel speed the dial asks for
  const targetRpm = () => (live.current.speed / 3.6 / EFF / RW) * (60 / (2 * Math.PI))

  const queueBalls = () => world.balls.filter((b) => b.state === 'queue').sort((a, b) => b.s - a.s)
  const releaseOne = () => {
    const front = queueBalls()[0]
    if (!front || front.released) return false
    if (front.s < path.gate - 0.004) return false // not at the gate yet
    front.released = true
    world.gate = 1
    play('clack', 0.6)
    return true
  }
  const collectAll = () => {
    for (const b of world.balls) if (b.state === 'flight') (b.state = 'fade'), (b.t = 0)
  }
  const first = useRef(true)
  useEffect(() => {
    if (!first.current) releaseOne()
  }, [feed]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!first.current) collectAll()
  }, [collect]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    first.current = false
  }, [])

  const P = FLIGHT[ball] || FLIGHT.tennis
  const planes = useMemo(
    () => [
      { n: new THREE.Vector3(0, 1, 0), d: 0, kind: 'floor' },
      { n: new THREE.Vector3(-1, 0, 0), d: -NET_X, kind: 'net' },
      { n: new THREE.Vector3(1, 0, 0), d: -3, kind: 'net' },
      { n: new THREE.Vector3(0, 0, 1), d: -2.6, kind: 'net' },
      { n: new THREE.Vector3(0, 0, -1), d: -2.6, kind: 'net' },
    ],
    [],
  )

  // the wheel flings a ball: out of the mouth along the head's nose, with
  // backspin about the head's own sideways axis
  const launch = (b) => {
    const spec = BALL_TYPES[live.current.ball] || TENNIS_BALL
    const body = createBall({ r: spec.r, m: spec.m, k: spec.k })
    const head = rollRef.current
    head.updateWorldMatrix(true, false)
    body.p.copy(EXIT).applyMatrix4(head.matrixWorld)
    const fwd = new THREE.Vector3(1, 0, 0).transformDirection(head.matrixWorld)
    const side = new THREE.Vector3(0, 0, 1).transformDirection(head.matrixWorld)
    // the ball leaves at a share of the tyre speed the wheel has right now
    const tyre = ((world.rpm * 2 * Math.PI) / 60) * RW
    const v = tyre * EFF * (0.985 + Math.random() * 0.03)
    body.v.copy(fwd).multiplyScalar(v)
    body.v.x += (Math.random() - 0.5) * 0.15
    body.w.copy(side).multiplyScalar((v / spec.r) * 0.12)
    body.q.copy(b.q)
    b.body = body
    b.state = 'flight'
    b.t = 0
    b.rest = 0
    world.fired++
    world.last = { v: v * 3.6, rpm: world.rpm }
    // the ball takes energy out of the wheel
    world.rpm *= live.current.ball === 'cricket' ? 0.86 : 0.94
    play('launch', v / 30)
    onReport?.({ kmh: Math.round(v * 3.6), rpm: Math.round(world.rpm), fired: world.fired })
  }

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(), ax: new THREE.Vector3() }), [])
  const step = (h) => {
    const w = world
    const L = live.current
    // the motor spins the wheel up towards the dial's speed, or coasts down
    const target = L.power ? targetRpm() : 0
    const k = L.power ? (target > w.rpm ? 1.6 : 3) : 0.35
    w.rpm += (target - w.rpm) * (1 - Math.exp(-k * h))
    // the queue on the feed path
    const q = queueBalls()
    q.forEach((b, j) => {
      const prev = b.s
      const slope = along(path, b.s, tmp.a)
      const inHelix = b.s < path.helixEnd
      const acc = G * slope * (inHelix ? 5 / 7 : 0.95) - (inHelix ? 1.4 : 0.3) * b.v
      b.v = Math.max(0, b.v + acc * h)
      b.s += b.v * h
      if (j === 0) {
        if (!b.released && b.s > path.gate) {
          if (b.v > 0.12) play('clack', b.v)
          b.s = path.gate
          b.v = 0
        }
      } else {
        const ahead = q[j - 1]
        const limit = ahead.s - SPACING
        if (b.s > limit) {
          if (b.v - ahead.v > 0.12) play('clack', (b.v - ahead.v) * 2)
          b.s = Math.max(prev, limit)
          b.v = Math.min(b.v, ahead.v)
        }
      }
      if (b.released && b.s >= path.end) {
        // on the wheel: away it goes if the wheel is turning, else it sits there
        if (w.rpm > 300) launch(b)
        else b.s = path.end
      }
    })
    // flying, bouncing, rolling
    for (const b of w.balls) {
      if (b.state !== 'flight') continue
      let net = false
      stepBall(b.body, h, P, planes, (s, kind) => {
        if (kind === 'net') net = true
        play(kind === 'net' ? 'net' : 'bounce', s / 8, L.ball)
      })
      if (net) b.body.v.multiplyScalar(0.18) // the net soaks it up
      // the stumps: a ball meeting one bounces off it
      const bp = b.body.p
      if (Math.abs(bp.x - STUMPS.x) < 0.1 && bp.y < STUMPS.h + b.body.r) {
        for (const z of STUMPS.z) {
          const dx = bp.x - STUMPS.x
          const dz = bp.z - z
          const d = Math.hypot(dx, dz)
          const min = b.body.r + STUMPS.r
          if (d >= min || d < 1e-6) continue
          const nx = dx / d
          const nz = dz / d
          bp.x = STUMPS.x + nx * min
          bp.z = z + nz * min
          const vn = b.body.v.x * nx + b.body.v.z * nz
          if (vn < 0) {
            b.body.v.x -= 1.4 * vn * nx
            b.body.v.z -= 1.4 * vn * nz
            play('clack', -vn / 6)
          }
        }
      }
      b.t += h
      const slow = b.body.onGround && b.body.v.lengthSq() < 0.01
      b.rest = slow ? b.rest + h : 0
      if (L.recycle && (b.rest > 1.2 || b.t > 9)) {
        b.state = 'fade'
        b.t = 0
      }
    }
  }

  const tick = (delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!(dt > 0)) return
    const w = world
    const L = live.current
    // the head moves to its settings
    const a = ang.current
    const kk = 1 - Math.exp(-dt * 5)
    a.yaw += (THREE.MathUtils.degToRad(-L.line) - a.yaw) * kk
    a.tilt += (THREE.MathUtils.degToRad(L.elevation) - a.tilt) * kk
    a.roll += ((DELIVERY[L.delivery] ?? 0) - a.roll) * kk
    aimRef.current.rotation.y = a.yaw
    tiltRef.current.rotation.z = a.tilt
    rollRef.current.rotation.x = a.roll
    swivelRef.current.rotation.x = -a.roll // the hopper stays upright

    const n = Math.max(1, Math.ceil(dt / (1 / 600)))
    for (let i = 0; i < n; i++) step(dt / n)

    // the feed timer
    if (L.autoFeed && L.power && w.rpm > targetRpm() * 0.9) {
      w.release += dt
      if (w.release >= L.interval && releaseOne()) w.release = 0
    } else w.release = Math.min(w.release, L.interval)

    // pick-ups and returns
    for (const b of w.balls) {
      if (b.state === 'fade') {
        b.t += dt
        b.scale = Math.max(0, 1 - b.t / 0.3)
        if (b.t > 0.3) {
          b.state = 'wait'
          b.t = 0
        }
      } else if (b.state === 'wait') {
        b.t += dt
        // back in at the top of the spiral once there is room
        const top = Math.min(...w.balls.filter((o) => o.state === 'queue').map((o) => o.s), 99)
        if (b.t > 0.6 && top > SPACING) {
          b.state = 'queue'
          b.s = 0
          b.v = 0.2
          b.released = false
          b.body = null
          b.t = 0
        }
      } else if (b.state === 'queue' && b.scale < 1) b.scale = Math.min(1, b.scale + dt * 4)
    }

    // draw
    const head = rollRef.current
    head.updateWorldMatrix(true, false)
    const hopper = uprightRef.current
    hopper.updateWorldMatrix(true, false)
    for (const b of w.balls) {
      const g = refs[b.i].current
      if (!g) continue
      g.visible = b.state !== 'wait'
      g.scale.setScalar(b.scale)
      if (b.state === 'queue') {
        along(path, b.s, tmp.a)
        // rolling: turn by the distance it moved
        const moved = b.v * dt
        if (moved > 0) {
          tmp.ax.set(0, 1, 0).cross(tmp.b.subVectors(tmp.a, g.userData.last || tmp.a)).normalize()
          if (tmp.ax.lengthSq() > 0.5) b.q.premultiply(tmp.q.setFromAxisAngle(tmp.ax, moved / 0.035))
        }
        g.userData.last = tmp.a.clone()
        g.position.copy(tmp.a).applyMatrix4(b.s < path.swivel ? hopper.matrixWorld : head.matrixWorld)
        g.quaternion.copy(b.q)
      } else if (b.body) {
        g.position.copy(b.body.p)
        if (b.body.squash > 0 && b.body.p.y < b.body.r * 1.15) g.position.y -= b.body.squash * b.body.r * 0.5
        g.quaternion.copy(b.body.q)
        b.q.copy(b.body.q)
      }
    }
    // the wheel hub turns with the wheel; the dial shows the speed asked for
    hubRef.current.rotation.z -= ((w.rpm * 2 * Math.PI) / 60) * dt
    dialRef.current.rotation.y = -((L.speed - 30) / 120) * Math.PI * 1.5 + Math.PI * 0.75
    w.gate = Math.max(0, w.gate - dt * 3)
    gateRef.current.rotation.z = w.gate * 1.1
    leverRef.current.rotation.x = L.power ? -0.45 : 0.45
    if (audio.current) audio.current.motor(w.rpm)
  }
  useFrame((_, delta) => tick(delta))
  useEffect(() => {
    if (sound && power) play('start')
  }, [sound, power]) // eslint-disable-line react-hooks/exhaustive-deps

  const click = (fn) => ({
    onClick: (e) => {
      e.stopPropagation()
      if (e.delta > 4) return
      fn()
    },
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  })

  const BallMesh = ball === 'cricket' ? CricketBallMesh : TennisBallMesh
  return (
    <group>
      {/* ---- the tripod stand ---- */}
      <mesh geometry={geo.pole} material={mats.steel} position={[0, 0.1 + (POLE_H - 0.1) / 2, 0]} castShadow />
      <mesh geometry={geo.collar} material={mats.steel} position={[0, 0.34, 0]} castShadow />
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2 + 0.5
        const foot = new THREE.Vector3(Math.cos(a) * 0.4, 0.02, Math.sin(a) * 0.4)
        const top = new THREE.Vector3(Math.cos(a) * 0.03, 0.34, Math.sin(a) * 0.03)
        const mid = foot.clone().add(top).multiplyScalar(0.5)
        const dir = top.clone().sub(foot)
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
        return (
          <group key={k}>
            <mesh geometry={geo.leg} material={mats.steel} position={mid} quaternion={q} scale={[1, dir.length(), 1]} castShadow />
            <mesh geometry={geo.foot} material={mats.rubber} position={foot} scale={[1, 0.6, 1]} castShadow />
          </group>
        )
      })}

      {/* ---- the head: turns to aim, tilts for length, rolls for spin ---- */}
      <group ref={aimRef} position={[0, POLE_H, 0]}>
        {/* the yoke and its locking knob */}
        <mesh geometry={geo.yokeBase} material={mats.steel} position={[0, -0.13, 0]} castShadow />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geo.yoke} material={mats.steel} position={[0, -0.06, s * 0.105]} castShadow />
        ))}
        <mesh geometry={geo.lockKnob} material={mats.black} position={[0, 0, -0.122]} rotation-x={Math.PI / 2} castShadow />
        <group ref={tiltRef}>
          <mesh geometry={geo.axle} material={mats.steel} rotation-x={Math.PI / 2} />
          <group ref={rollRef}>
            <group ref={headRef}>
              {/* the wheel housing and its mouth */}
              <mesh geometry={geo.housing} material={mats.body} castShadow receiveShadow />
              <mesh geometry={geo.mouth} material={mats.hole} position={[EXIT.x - 0.004, TRACK, 0]} rotation-y={Math.PI / 2} />
              <mesh geometry={geo.mouthRim} material={mats.body} position={[EXIT.x - 0.006, TRACK, 0]} rotation-y={Math.PI / 2} castShadow />
              {/* the wheel's hub on the far side, turning with it */}
              <group ref={hubRef} position={[0, 0, -0.072]}>
                <mesh geometry={geo.hub} material={mats.dark} rotation-x={Math.PI / 2} />
                {[0, 1, 2, 3, 4].map((k) => (
                  <mesh key={k} geometry={geo.bolt} material={mats.chrome} position={[Math.cos((k / 5) * Math.PI * 2) * 0.022, Math.sin((k / 5) * Math.PI * 2) * 0.022, -0.007]} rotation-x={Math.PI / 2} />
                ))}
              </group>
              {/* the motor, on the wheel's axle, with its controls on the end */}
              <mesh geometry={geo.motor} material={mats.body} position={[0, 0, 0.14]} rotation-x={Math.PI / 2} castShadow />
              <mesh geometry={geo.motorCap} material={mats.dark} position={[0, 0, 0.222]} rotation-x={Math.PI / 2} castShadow />
              {Array.from({ length: 14 }, (_, k) => {
                const a = (k / 14) * Math.PI * 2
                return <mesh key={k} geometry={geo.vent} material={mats.hole} position={[Math.cos(a) * 0.0605, Math.sin(a) * 0.0605, 0.19]} rotation-z={a} />
              })}
              <mesh geometry={geo.badge} material={mats.badge} position={[0.02, -0.035, 0.12]} rotation={[0, 0, 0]} />
              <group position={[0, 0, 0.234]}>
                <group ref={dialRef} position={[0.024, -0.018, 0]} rotation-x={Math.PI / 2}>
                  <mesh geometry={geo.dial} material={mats.black} />
                  <mesh material={mats.dialMark} position={[0, 0.0075, 0.009]}>
                    <boxGeometry args={[0.002, 0.001, 0.009]} />
                  </mesh>
                </group>
                <mesh geometry={geo.switchBase} material={mats.black} position={[-0.024, -0.016, 0]} />
                <group ref={leverRef} position={[-0.024, -0.016, 0.004]} {...click(() => setPower(!live.current.power))}>
                  <mesh geometry={geo.switchLever} material={mats.rubber} position={[0, 0, 0.006]} />
                </group>
                <mesh geometry={geo.led} material={mats.led} position={[0, 0.03, 0.002]} />
              </group>
              {/* the funnel, the feed tube and the spiral hopper */}
              <mesh geometry={geo.funnel} material={mats.body} position={[FUNNEL.x, FUNNEL.y, 0]} castShadow />
              <mesh geometry={geo.warning} material={mats.warning} position={[FUNNEL.x - 0.03, FUNNEL.y + 0.035, 0.066]} rotation={[0, -0.35, 0]} />
              {/* on its swivel: turns against the head, so it stays upright */}
              <group ref={swivelRef} position={SWIVEL}>
                <group ref={uprightRef} position={[-SWIVEL.x, -SWIVEL.y, -SWIVEL.z]}>
              <mesh geometry={geo.tube} material={mats.black} position={[FUNNEL.x, 0.255 + (HOP.yb - 0.05 - 0.255) / 2, 0]} castShadow />
              <group {...click(() => releaseOne())}>
                <mesh geometry={geo.hopFloor} material={mats.black} castShadow receiveShadow />
                <mesh geometry={geo.hopWall} material={mats.black} castShadow receiveShadow />
                <mesh geometry={geo.column} material={mats.black} position={[HOP_AXIS.x, HOP.yb - 0.04 + (HOP.pitch * (HOP.turns + 0.2) + 0.08) / 2 - 0.03, HOP_AXIS.z]} castShadow />
                <mesh geometry={geo.cap} material={mats.black} position={[HOP_AXIS.x, HOP.yb - 0.04 + HOP.pitch * (HOP.turns + 0.2) + 0.05, HOP_AXIS.z]} castShadow />
              </group>
              {/* the gate at the bottom of the spiral: swings open to let one go */}
              <group ref={gateRef} position={[FUNNEL.x + 0.035, HOP.yb + 0.01, 0]}>
                <mesh geometry={geo.gate} material={mats.dark} position={[0, 0.02, 0]} />
              </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* ---- the balls ---- */}
      {world.balls.map((b) => (
        <BallMesh key={`${ball}-${b.i}`} ref={refs[b.i]} {...(ball === 'cricket' ? {} : { shells: 5, segments: 40 })} />
      ))}
    </group>
  )
}
