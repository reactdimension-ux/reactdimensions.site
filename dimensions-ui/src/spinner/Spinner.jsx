import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// A three-arm fidget spinner at real size, with its mechanism and physics.
//
// Built in the xy plane, facing +z, spinning about z:
//   the body: a smooth three-lobed outline (lobes joined to the hub by a
//     smooth union, so the waists are filleted), 7 mm thick, in anodised
//     aluminium; its chamfers are diamond-cut back to bright metal;
//   three 608 bearings (22 mm) pressed into the lobes as weights;
//   an open 608 bearing in the hub: an outer race turning with the body, an
//     inner race held still, and eight balls in a cage between them;
//   two turned aluminium finger caps, fixed to the inner race, with the
//     concentric tool marks of a lathe (anisotropic highlights).
//
// Physics: one rotational degree of freedom. The moment of inertia comes
// from the parts' masses; friction is the bearing's: a constant (seal and
// grease) part, a viscous part and air drag. The balls orbit at the cage's
// speed, half the body's (less a little for the ball size), and roll.

const MM = 0.001
export const DIM = {
  lobeD: 24 * MM, // hub centre to lobe centre
  lobeR: 14 * MM,
  hubR: 16 * MM,
  fillet: 7 * MM,
  t: 7 * MM, // body thickness
  bevel: 0.9 * MM,
  bearingR: 11 * MM, // 608: 22 mm OD
  bearingIn: 4 * MM, // 8 mm bore
  bearingW: 7 * MM,
  capR: 11 * MM,
  capT: 1.35 * MM,
}
const LOBES = [90, 210, 330].map((d) => (d * Math.PI) / 180)

// ---- the body outline ----
function sdf(x, y) {
  // smooth union (exponential smooth-min) of the hub and the three lobes
  const k = DIM.fillet / 3
  let s = Math.exp(-(Math.hypot(x, y) - DIM.hubR) / k)
  for (const a of LOBES) s += Math.exp(-(Math.hypot(x - Math.cos(a) * DIM.lobeD, y - Math.sin(a) * DIM.lobeD) - DIM.lobeR) / k)
  return -k * Math.log(s)
}
function bodyGeometry() {
  // trace the outline inset by the bevel (the bevel grows it back out)
  const pts = []
  const N = 480
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    let lo = 0
    let hi = 0.06
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2
      if (sdf(Math.cos(a) * m, Math.sin(a) * m) < -DIM.bevel) lo = m
      else hi = m
    }
    pts.push(new THREE.Vector2(Math.cos(a) * lo, Math.sin(a) * lo))
  }
  const shape = new THREE.Shape(pts)
  const hole = (x, y) => {
    const p = new THREE.Path()
    p.absarc(x, y, DIM.bearingR + DIM.bevel, 0, Math.PI * 2, true)
    return p
  }
  shape.holes.push(hole(0, 0))
  for (const a of LOBES) shape.holes.push(hole(Math.cos(a) * DIM.lobeD, Math.sin(a) * DIM.lobeD))
  const depth = DIM.t - 2 * DIM.bevel
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: DIM.bevel, bevelSize: DIM.bevel, bevelSegments: 1, curveSegments: 64 })
  g.translate(0, 0, -depth / 2)
  // mark the chamfers (faces at an angle) as cut metal; flats and walls stay anodised
  const n = g.attributes.normal
  const cut = new Float32Array(n.count)
  for (let i = 0; i < n.count; i += 3) {
    const z = Math.abs(n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)) / 3
    const v = z > 0.25 && z < 0.95 ? 1 : 0
    cut[i] = cut[i + 1] = cut[i + 2] = v
  }
  g.setAttribute('cut', new THREE.BufferAttribute(cut, 1))
  return g
}

// anodised flats and walls, bright cut chamfers: one material, split per face
function bodyMaterial(color) {
  // anodising: the colour is a dyed oxide over the metal, so it reads as
  // coloured satin with a metallic sheen rather than a mirror
  const m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.42, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.28 })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float cut;\nvarying float vCut;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCut = cut;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCut;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.88, 0.9), vCut);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, vCut);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 1.0, vCut);')
  }
  m.customProgramCacheKey = () => 'spinner-body'
  return m
}

// ---- bearings ----
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg).rotateX(Math.PI / 2)
// a ring (annulus with rounded corners) between radii r0 and r1, w wide
function ring(r0, r1, w, round = 0.25 * MM) {
  const h = w / 2
  const p = []
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2)
      p.push([cx + Math.cos(a) * round, cy + Math.sin(a) * round])
    }
  }
  corner(r1 - round, -h + round, -Math.PI / 2)
  corner(r1 - round, h - round, 0)
  corner(r0 + round, h - round, Math.PI / 2)
  corner(r0 + round, -h + round, Math.PI)
  p.push(p[0])
  return lathe(p)
}
// a weight bearing in a lobe: races and a shield between them
function shieldedBearing() {
  const { bearingR: R, bearingIn: r, bearingW: w } = DIM
  return {
    outer: ring(R - 1.4 * MM, R, w),
    inner: ring(r, r + 1.6 * MM, w),
    shield: lathe([[r + 1.6 * MM, w / 2 - 0.5 * MM], [R - 1.4 * MM, w / 2 - 0.5 * MM]], 64),
    shieldB: lathe([[R - 1.4 * MM, -w / 2 + 0.5 * MM], [r + 1.6 * MM, -w / 2 + 0.5 * MM]], 64),
  }
}
// the hub bearing, open: races with ball grooves, a cage, eight balls
const BALLS = 8
const BALL_R = 1.6 * MM
const PITCH = 7.5 * MM // pitch radius of the ball set
function openBearing() {
  const { bearingR: R, bearingIn: r, bearingW: w } = DIM
  const outer = ring(PITCH + BALL_R * 0.55, R, w)
  const inner = ring(r, PITCH - BALL_R * 0.55, w)
  const ball = new THREE.SphereGeometry(BALL_R, 24, 16)
  // a pressed-steel cage: a thin ring with a pocket round each ball
  const cage = new THREE.TorusGeometry(PITCH, 0.35 * MM, 8, 96)
  const pocket = new THREE.TorusGeometry(BALL_R * 1.05, 0.25 * MM, 8, 24)
  return { outer, inner, ball, cage, pocket }
}

// the finger cap: a turned disc with a chamfered rim and a short spigot
function capGeometry() {
  const { capR: R, capT: t } = DIM
  return lathe(
    [
      [0, 0],
      [3.6 * MM, 0],
      [3.6 * MM, -1.2 * MM], // spigot into the bore
      [3.9 * MM, -1.2 * MM],
      [3.9 * MM, -0.05 * MM],
      [R - 0.5 * MM, -0.05 * MM],
      [R, 0.25 * MM],
      [R, t - 0.45 * MM],
      [R - 0.45 * MM, t],
      [R * 0.6, t + 0.05 * MM],
      [0, t + 0.12 * MM],
    ].map(([x, y]) => [x, y]),
    96,
  )
}
// the lathe's tool marks: tangential anisotropy, plus fine concentric grooves
function turnedMaps() {
  const S = 512
  const aniso = new Uint8Array(S * S * 4)
  const bump = new Uint8Array(S * S * 4)
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const x = (i + 0.5) / S - 0.5
      const y = (j + 0.5) / S - 0.5
      const rr = Math.hypot(x, y) + 1e-6
      const k = (j * S + i) * 4
      // direction of the streaks: round the circle
      aniso[k] = (-y / rr) * 127.5 + 127.5
      aniso[k + 1] = (x / rr) * 127.5 + 127.5
      aniso[k + 2] = 255
      aniso[k + 3] = 255
      const g = 128 + Math.sin(rr * 900) * 18 + Math.sin(rr * 2900) * 8
      bump[k] = bump[k + 1] = bump[k + 2] = g
      bump[k + 3] = 255
    }
  const mk = (d) => {
    const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat)
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    t.needsUpdate = true
    return t
  }
  return { aniso: mk(aniso), bump: mk(bump) }
}

// ---- physics ----
const I = 2.3e-5 // kg m^2: three 12 g bearings at 24 mm, plus a 19 g body
const FRICTION = { c: 1.3e-5, b: 4e-8, a: 8e-11 } // N m: constant, viscous, air
export function rpm(w) {
  return (Math.abs(w) * 60) / (Math.PI * 2)
}

const GHOSTS = 24

const Spinner = forwardRef(function Spinner({ bodyColor = '#1f2c4b', capColor = '#d6d9dd', exploded = false, onStats }, ref) {
  const { invalidate, controls, gl } = useThree()
  const geo = useMemo(() => ({ body: bodyGeometry(), weight: shieldedBearing(), hub: openBearing(), cap: capGeometry() }), [])
  const maps = useMemo(() => turnedMaps(), [])
  const mats = useMemo(() => {
    const steel = new THREE.MeshPhysicalMaterial({ color: '#cfd3d7', metalness: 1, roughness: 0.18 })
    return {
      body: bodyMaterial('#1f2c4b'),
      steel,
      shield: new THREE.MeshPhysicalMaterial({ color: '#8b9096', metalness: 1, roughness: 0.38, side: THREE.DoubleSide }),
      ball: new THREE.MeshPhysicalMaterial({ color: '#e4e7ea', metalness: 1, roughness: 0.06 }),
      cage: new THREE.MeshPhysicalMaterial({ color: '#b9a46a', metalness: 1, roughness: 0.3 }),
      cap: new THREE.MeshPhysicalMaterial({ color: '#d6d9dd', metalness: 1, roughness: 0.22, anisotropy: 0.85, anisotropyMap: maps.aniso, bumpMap: maps.bump, bumpScale: 0.00002 }),
      ghostBody: Object.assign(bodyMaterial('#1f2c4b'), { transparent: true, depthWrite: false }),
      ghostSteel: Object.assign(steel.clone(), { transparent: true, depthWrite: false }),
    }
  }, [maps])
  useLayoutEffect(() => {
    mats.body.color.set(bodyColor)
    mats.ghostBody.color.set(bodyColor)
    mats.cap.color.set(capColor)
    invalidate()
  }, [mats, bodyColor, capColor, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      Object.values(maps).forEach((t) => t.dispose())
      geo.body.dispose()
      geo.cap.dispose()
      Object.values(geo.weight).forEach((g) => g.dispose())
      Object.values(geo.hub).forEach((g) => g.dispose())
    },
    [mats, maps, geo],
  )

  // ---- state ----
  const sim = useRef({ w: 0, a: 0, cage: 0, ballSpin: 0, held: null, explode: 0, t: 0, spinning: 0 })
  const rotor = useRef()
  const ghosts = useRef([])
  const cage = useRef()
  const balls = useRef([])
  const capTop = useRef()
  const capBot = useRef()
  const innerRace = useRef()
  useImperativeHandle(ref, () => ({
    flick: (dir = 1) => {
      const s = sim.current
      s.w = Math.sign(s.w || dir) * Math.min(260, Math.abs(s.w) + 180)
      s.t = 0
      invalidate()
    },
    stop: () => {
      sim.current.w = 0
      invalidate()
    },
  }))

  // grab and spin with the pointer: the body follows the pointer's angle
  // round the hub while held, and keeps the speed it had when let go
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const angleOf = (e) => {
    const g = rotor.current.parent
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld), new THREE.Vector3().setFromMatrixPosition(g.matrixWorld))
    if (!e.ray.intersectPlane(plane, hit)) return null
    g.worldToLocal(hit)
    return Math.atan2(hit.y, hit.x)
  }
  const handlers = {
    onPointerDown: (e) => {
      e.stopPropagation()
      const a = angleOf(e)
      if (a === null) return
      e.target.setPointerCapture?.(e.pointerId)
      sim.current.held = { a, at: performance.now(), w: 0 }
      sim.current.w = 0
      if (controls) controls.enabled = false
      gl.domElement.style.cursor = 'grabbing'
      invalidate()
    },
    onPointerMove: (e) => {
      const s = sim.current
      if (!s.held) return
      e.stopPropagation()
      const a = angleOf(e)
      if (a === null) return
      let d = a - s.held.a
      d = Math.atan2(Math.sin(d), Math.cos(d))
      const now = performance.now()
      const dt = Math.max(1, now - s.held.at) / 1000
      s.held.w = s.held.w * 0.5 + (d / dt) * 0.5
      s.a += d
      s.held.a = a
      s.held.at = now
      invalidate()
    },
    onPointerUp: (e) => {
      const s = sim.current
      if (!s.held) return
      e.target.releasePointerCapture?.(e.pointerId)
      // a flick: keep the speed of the last moments of the drag (finger
      // flicks run a little faster than a pointer can follow)
      const recent = performance.now() - s.held.at < 80
      s.w = recent ? THREE.MathUtils.clamp(s.held.w * 1.6, -280, 280) : 0
      s.t = 0
      s.held = null
      if (controls) controls.enabled = true
      gl.domElement.style.cursor = ''
      invalidate()
    },
    onPointerOver: () => (gl.domElement.style.cursor = 'grab'),
    onPointerOut: () => !sim.current.held && (gl.domElement.style.cursor = ''),
  }

  let lastReport = 0
  useFrame((state, delta) => {
    const s = sim.current
    const dt = Math.min(delta, 1 / 20)
    // spin down: integrate with sub-steps (friction is stiff near a stop)
    if (!s.held && s.w !== 0) {
      const n = 8
      const h = dt / n
      for (let i = 0; i < n; i++) {
        const aw = Math.abs(s.w)
        const tau = FRICTION.c + FRICTION.b * aw + FRICTION.a * aw * aw
        const dw = (tau / I) * h
        if (dw >= aw) {
          s.w = 0
          break
        }
        s.w -= Math.sign(s.w) * dw
        s.a += s.w * h
      }
      s.t += dt
    }
    // the cage turns at about half the body's speed; balls roll as they go
    const wBody = s.held ? s.held.w : s.w
    const ratio = 0.5 * (1 - BALL_R / PITCH)
    s.cage += wBody * ratio * dt
    s.ballSpin += wBody * (PITCH / BALL_R) * 0.5 * dt
    // exploded view: the caps lift off
    s.explode += ((exploded ? 1 : 0) - s.explode) * Math.min(1, dt * 7)

    rotor.current.rotation.z = s.a
    cage.current.rotation.z = s.cage
    balls.current.forEach((b, k) => b && (b.rotation.x = s.ballSpin + k))
    const lift = s.explode * 14 * MM
    capTop.current.position.z = DIM.bearingW / 2 + lift
    capBot.current.position.z = -DIM.bearingW / 2 - lift
    innerRace.current.position.z = 0

    // motion blur: at speed, the shutter sees the arms sweep through an
    // arc. Draw the rotor several times across that arc, faint, instead of
    // the solid one. (Three-fold symmetry: an arc of 120 degrees is a blur.)
    const sweep = Math.min((Math.PI * 2) / 3, Math.abs(wBody) / 60)
    const blur = THREE.MathUtils.smoothstep(sweep, 0.08, 0.4)
    rotor.current.visible = blur < 0.5
    ghosts.current.forEach((g, k) => {
      if (!g) return
      g.visible = blur >= 0.5
      g.rotation.z = s.a - Math.sign(wBody) * sweep * (k / (GHOSTS - 1))
    })
    const op = (1.8 / GHOSTS) * (0.6 + 0.4 * blur)
    mats.ghostBody.opacity = op
    mats.ghostSteel.opacity = op

    const now = state.clock.elapsedTime
    if (now - lastReport > 0.2) {
      lastReport = now
      onStats?.({ rpm: Math.round(rpm(wBody)), time: s.t, spinning: Math.abs(wBody) > 0.05 })
    }
    if (s.w !== 0 || s.held || Math.abs((exploded ? 1 : 0) - s.explode) > 1e-3) invalidate()
  })

  const weights = LOBES.map((a) => [Math.cos(a) * DIM.lobeD, Math.sin(a) * DIM.lobeD, 0])
  const Weight = ({ ghost }) =>
    weights.map((p, i) => (
      <group key={i} position={p}>
        <mesh geometry={geo.weight.outer} material={ghost ? mats.ghostSteel : mats.steel} castShadow={!ghost} />
        <mesh geometry={geo.weight.inner} material={ghost ? mats.ghostSteel : mats.steel} castShadow={!ghost} />
        {!ghost && <mesh geometry={geo.weight.shield} material={mats.shield} />}
        {!ghost && <mesh geometry={geo.weight.shieldB} material={mats.shield} />}
      </group>
    ))

  return (
    <group>
      {/* the rotor: body, weights and the hub bearing's outer race */}
      <group ref={rotor} {...handlers}>
        <mesh geometry={geo.body} material={mats.body} castShadow receiveShadow />
        <Weight />
        <mesh geometry={geo.hub.outer} material={mats.steel} castShadow />
      </group>
      {/* its blurred images at speed */}
      {Array.from({ length: GHOSTS }, (_, k) => (
        <group key={k} ref={(g) => (ghosts.current[k] = g)} visible={false} {...handlers}>
          <mesh geometry={geo.body} material={mats.ghostBody} />
          <Weight ghost />
        </group>
      ))}
      {/* the hub bearing's inner parts */}
      <group ref={cage}>
        <mesh geometry={geo.hub.cage} material={mats.cage} />
        {Array.from({ length: BALLS }, (_, k) => {
          const a = (k / BALLS) * Math.PI * 2
          return (
            <group key={k} position={[Math.cos(a) * PITCH, Math.sin(a) * PITCH, 0]} rotation-z={a}>
              <mesh ref={(m) => (balls.current[k] = m)} geometry={geo.hub.ball} material={mats.ball} castShadow />
              <mesh geometry={geo.hub.pocket} material={mats.cage} rotation-y={Math.PI / 2} />
            </group>
          )
        })}
      </group>
      <mesh ref={innerRace} geometry={geo.hub.inner} material={mats.steel} castShadow />
      {/* finger caps, held still on the inner race */}
      <mesh ref={capTop} geometry={geo.cap} material={mats.cap} castShadow />
      <mesh ref={capBot} geometry={geo.cap} material={mats.cap} rotation-x={Math.PI} castShadow />
    </group>
  )
})

export default Spinner
