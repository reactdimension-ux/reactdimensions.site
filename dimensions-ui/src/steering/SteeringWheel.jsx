import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { createSteeringAudio } from './audio.js'

// A three-spoke steering wheel: a round rim with an oval grip, a band of
// open-pore walnut across the top and black Nappa leather, stitched along
// the inside, everywhere else; two side spokes each carrying a knurled
// scroll wheel, a bottom spoke with a chrome trim, and a padded airbag
// cover with the React Dimensions R in chrome.
//
// It steers like a car's. Take hold of the rim and turn it: your hand is a
// stiff spring pulling the wheel after the pointer. Let go and the tyres'
// self-aligning torque (stronger the faster the car goes) pulls it back
// towards centre against its inertia, damping and column friction, so at
// speed it spins back and settles, and parked it stays where you left it.
// The rack stops it at 450° each way. Press the cover for the horn; roll the
// left scroll wheel for volume (press it to mute), the right for speed.
// SI units: metres, kilograms, seconds.

const RIM_R = 0.182 // the rim's centreline
const GRIP_A = 0.0165 // the grip's half depth, radially
const GRIP_B = 0.0158 // and along the wheel's axis
const WOOD = [0.62, 2.52] // the walnut band, rad (0 = three o'clock)
const LOCK = 2.5 * Math.PI // 450°
const RATIO = 12 // steering ratio, wheel to road wheels
const WHEELBASE = 2.875
const I_WHEEL = 0.055 // kg m²: the wheel, column and what the rack reflects

const R_PATH =
  'M168 320 L172 186 L130 172 C150 100 270 42 370 44 C440 46 472 80 462 120 C452 160 380 194 270 236 ' +
  'L376 322 L378 342 L242 344 L240 302 L228 308 L226 318 Z ' +
  'M230 198 L233 150 C254 122 300 102 346 104 C384 106 412 116 422 128 C428 136 420 142 404 147 Z'

// The rim between two angles: an oval tube with its long axis across the
// wheel, a little flatter on the inside where the fingers wrap.
function rimGeometry(t0, t1, segs) {
  const M = 36
  const pos = []
  const uv = []
  const idx = []
  for (let i = 0; i <= segs; i++) {
    const t = t0 + ((t1 - t0) * i) / segs
    const c = Math.cos(t)
    const s = Math.sin(t)
    for (let j = 0; j <= M; j++) {
      const f = (j / M) * Math.PI * 2
      // radial: outward positive; the inside (cos f < 0) is pulled in a touch
      const cr = Math.cos(f)
      const r = GRIP_A * cr * (cr < 0 ? 0.88 : 1)
      const z = GRIP_B * Math.sin(f)
      pos.push((RIM_R + r) * c, (RIM_R + r) * s, z)
      uv.push((t * RIM_R) / 0.06, j / M)
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j
      const b = a + M + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Leather: fine pebble grain (bump), with a double row of stitching along
// the inside of the rim (v = 0.5 is the inside). Colour, bump, roughness.
function leatherMaps(stitch) {
  const W = 256
  const H = 256
  const col = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const bmp = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = col.getContext('2d')
  const b = bmp.getContext('2d')
  g.fillStyle = '#17171a'
  g.fillRect(0, 0, W, H)
  b.fillStyle = '#808080'
  b.fillRect(0, 0, W, H)
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const r = 0.8 + Math.random() * 2
    b.fillStyle = `rgba(${Math.random() < 0.5 ? '40,40,40' : '210,210,210'},0.35)`
    b.beginPath()
    b.arc(x, y, r, 0, Math.PI * 2)
    b.fill()
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`
    g.fillRect(x, y, 2, 2)
  }
  // the seam: a pressed channel with stitches either side
  b.fillStyle = '#3a3a3a'
  b.fillRect(0, H * 0.5 - 2, W, 4)
  g.fillStyle = 'rgba(0,0,0,0.4)'
  g.fillRect(0, H * 0.5 - 2, W, 4)
  for (const v of [0.455, 0.545]) {
    for (let x = 0; x < W; x += 16) {
      g.fillStyle = stitch
      g.fillRect(x + 3, H * v - 1.5, 9, 3)
      b.fillStyle = '#e0e0e0'
      b.fillRect(x + 3, H * v - 1.5, 9, 3)
    }
  }
  const mk = (c, srgb) => {
    const t = new THREE.CanvasTexture(c)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    return t
  }
  return { map: mk(col, true), bump: mk(bmp) }
}

// Walnut: warm brown, straight grain running round the rim, darker streaks
// and open pores under a satin finish.
function walnutMap() {
  const W = 1024
  const H = 128
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = '#6b4329'
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 70; i++) {
    const y0 = Math.random() * H
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '40,22,10' : '150,100,60'},${0.15 + Math.random() * 0.3})`
    g.lineWidth = 0.5 + Math.random() * 3
    g.beginPath()
    for (let x = 0; x <= W; x += 16) {
      const y = y0 + Math.sin(x / (90 + Math.random() * 40) + i) * 3
      x ? g.lineTo(x, y) : g.moveTo(x, y)
    }
    g.stroke()
  }
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = 'rgba(25,12,5,0.35)'
    g.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 6, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.25, 1)
  t.anisotropy = 8
  return t
}

// knurling round a scroll wheel
function knurlMap() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 16 })
  const g = c.getContext('2d')
  for (let x = 0; x < 256; x++) {
    const v = x % 8 < 3 ? 40 : 200
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(x, 0, 1, 16)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// The airbag cover: a rounded shield, wider at the top, domed and padded.
function hubGeometry() {
  const pts = [
    [-0.086, 0.052],
    [-0.062, 0.074],
    [0, 0.08],
    [0.062, 0.074],
    [0.086, 0.052],
    [0.082, 0.002],
    [0.052, -0.058],
    [0, -0.078],
    [-0.052, -0.058],
    [-0.082, 0.002],
  ]
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'centripetal',
  )
  const shape = new THREE.Shape(curve.getSpacedPoints(120).map((p) => new THREE.Vector2(p.x, p.y)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.011, bevelSegments: 8, curveSegments: 24, steps: 1 })
  // dome the face: the middle stands proud like a padded cushion
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i)
    if (z > 0.02) {
      const x = p.getX(i)
      const y = p.getY(i)
      const k = Math.max(0, 1 - (x * x) / (0.095 * 0.095) - (y * y) / (0.09 * 0.09))
      p.setZ(i, z + 0.011 * k * Math.min(1, (z - 0.02) / 0.018))
    }
  }
  g.computeVertexNormals()
  g.translate(0, 0, -0.012)
  return g
}

// The R, from the site's mark, extruded as a chrome emblem about 46 mm tall.
function emblemGeometry() {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${R_PATH}" fill="#000" fill-rule="evenodd"/></svg>`)
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p))
  const g = new THREE.ExtrudeGeometry(shapes, { depth: 6, bevelEnabled: true, bevelThickness: 3, bevelSize: 2.2, bevelSegments: 4, curveSegments: 12 })
  const s = 0.046 / 314
  g.translate(-298, -193, 0)
  g.scale(s, -s, s) // SVG's y runs down
  g.computeVertexNormals()
  return g
}

// a hand on the rim, or a finger on a scroll wheel or the horn
const CENTRE = new THREE.Vector3()

// speed: km/h (sets how hard the tyres pull it straight). volume: 0–11.
// leather, wood, stitch: colours. sound. onChange: the wheel changes speed
// and volume from its scroll wheels. onTelemetry({ angle, road, radius,
// volume, muted, speed }) a few times a second.
export default function SteeringWheel({ speed = 40, volume = 6, leather = '#17171a', stitch = '#3c3c42', wood = true, sound = true, onChange, onTelemetry }) {
  const [hover, setHover] = useState(null)
  const [held, setHeld] = useState(false)
  useCursor(!!hover || held, held ? 'grabbing' : hover === 'rim' ? 'grab' : 'pointer')
  const { camera, gl, controls } = useThree()

  // ---- geometry, textures, materials ----
  const geo = useMemo(
    () => ({
      leatherA: rimGeometry(WOOD[1], WOOD[0] + Math.PI * 2, 220),
      woodRim: rimGeometry(WOOD[0], WOOD[1], 120),
      leatherFull: rimGeometry(0, Math.PI * 2, 320),
      seam: new THREE.TorusGeometry((GRIP_A + GRIP_B) / 2 + 0.0002, 0.0011, 8, 48),
      hub: hubGeometry(),
      emblem: emblemGeometry(),
      scroll: new THREE.CylinderGeometry(0.011, 0.011, 0.009, 32).rotateZ(Math.PI / 2),
      recess: new THREE.CylinderGeometry(0.016, 0.016, 0.004, 32).rotateX(Math.PI / 2),
      column: new THREE.CylinderGeometry(0.036, 0.042, 0.26, 32).rotateX(Math.PI / 2),
      shroud: new THREE.CylinderGeometry(0.075, 0.07, 0.07, 40).rotateX(Math.PI / 2),
      trim: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.026, -0.075, 0.0),
          new THREE.Vector3(-0.022, -0.125, 0.0),
          new THREE.Vector3(-0.012, -0.152, 0.0),
          new THREE.Vector3(0.012, -0.152, 0.0),
          new THREE.Vector3(0.022, -0.125, 0.0),
          new THREE.Vector3(0.026, -0.075, 0.0),
        ]),
        60,
        0.0016,
        8,
        false,
      ),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const leatherTex = useMemo(() => leatherMaps(stitch), [stitch])
  useEffect(() => () => (leatherTex.map.dispose(), leatherTex.bump.dispose()), [leatherTex])
  const tex = useMemo(() => ({ wood: walnutMap(), knurl: knurlMap() }), [])
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex])
  const mats = useMemo(
    () => ({
      leather: new THREE.MeshPhysicalMaterial({ roughness: 0.62, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color('#4a4a52'), bumpScale: 0.6 }),
      wood: new THREE.MeshPhysicalMaterial({ roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.28 }),
      hub: new THREE.MeshPhysicalMaterial({ roughness: 0.5, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color('#55555c'), bumpScale: 0.25 }),
      plastic: new THREE.MeshPhysicalMaterial({ color: '#1c1c1f', roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
      gloss: new THREE.MeshPhysicalMaterial({ color: '#0e0e10', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#e6e8ec', metalness: 1, roughness: 0.12 }),
      satin: new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 1, roughness: 0.32 }),
      scroll: new THREE.MeshStandardMaterial({ color: '#2b2b2f', metalness: 0.4, roughness: 0.45 }),
      column: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.7 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.leather.color.set(leather)
    mats.leather.map = leatherTex.map
    mats.leather.bumpMap = leatherTex.bump
    mats.leather.needsUpdate = true
    mats.hub.color.set(leather)
    mats.hub.bumpMap = leatherTex.bump
    mats.hub.needsUpdate = true
    mats.wood.map = tex.wood
    mats.wood.bumpMap = tex.wood
    mats.wood.bumpScale = 0.4
    mats.wood.needsUpdate = true
    mats.scroll.bumpMap = tex.knurl
    mats.scroll.bumpScale = 2
    mats.scroll.needsUpdate = true
  }, [mats, leather, leatherTex, tex])

  // ---- sound ----
  const audio = useRef(null)
  const live = useRef({})
  live.current = { speed, volume, sound }
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const a = () => {
    if (!live.current.sound) return null
    if (!audio.current) audio.current = createSteeringAudio()
    return audio.current
  }

  // ---- state ----
  const st = useRef({ angle: 0, w: 0, hand: null, horn: 0, hornV: 0, honking: false, muted: false, scroll: [0, 0], press: [0, 0], tele: 0 })
  const wheelRef = useRef()
  const columnRef = useRef()
  const hubRef = useRef()
  const scrollRefs = [useRef(), useRef()]

  // pointer → angle round the column, in the column's own (non-turning) frame
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const pointerAngle = (cx, cy) => {
    const col = columnRef.current
    col.updateWorldMatrix(true, false)
    const n = new THREE.Vector3(0, 0, 1).transformDirection(col.matrixWorld)
    const c = new THREE.Vector3().setFromMatrixPosition(col.matrixWorld)
    const r = gl.domElement.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera)
    const hit = new THREE.Vector3()
    if (!ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, c), hit)) return null
    const local = col.worldToLocal(hit.clone())
    return Math.atan2(local.y, local.x)
  }

  // what the finger is on: the rim (steer), the hub (horn) or a scroll wheel
  const drag = useRef(null)
  const onDown = (part, i) => (e) => {
    e.stopPropagation()
    if (controls) controls.enabled = false
    const s = st.current
    if (part === 'rim') {
      const ang = pointerAngle(e.clientX, e.clientY)
      if (ang === null) return
      s.hand = { last: ang, target: s.angle }
      setHeld(true)
    } else if (part === 'hub') {
      s.honking = true
      if (!s.muted) a()?.hornOn(live.current.volume / 11)
    } else if (part === 'scroll') {
      drag.current = { i, y: e.clientY, moved: 0 }
    }
    drag.current = drag.current || { part }
  }
  useEffect(() => {
    const move = (e) => {
      const s = st.current
      if (s.hand) {
        const ang = pointerAngle(e.clientX, e.clientY)
        if (ang === null) return
        // unwrap: follow the hand round past ±180°, clockwise is positive
        let d = ang - s.hand.last
        if (d > Math.PI) d -= Math.PI * 2
        if (d < -Math.PI) d += Math.PI * 2
        s.hand.last = ang
        s.hand.target = THREE.MathUtils.clamp(s.hand.target - d, -LOCK - 0.3, LOCK + 0.3)
      }
      const dr = drag.current
      if (dr && dr.i !== undefined) {
        // rolling a scroll wheel: a detent every 15°
        const dy = e.clientY - dr.y
        dr.y = e.clientY
        dr.moved += Math.abs(dy)
        const before = Math.round(s.scroll[dr.i] / 0.26)
        s.scroll[dr.i] -= dy * 0.035
        const after = Math.round(s.scroll[dr.i] / 0.26)
        if (after !== before) {
          a()?.tick()
          const step = after - before
          if (dr.i === 0) onChange?.({ volume: THREE.MathUtils.clamp(live.current.volume + step, 0, 11) })
          else onChange?.({ speed: THREE.MathUtils.clamp(live.current.speed + step * 5, 0, 200) })
        }
      }
    }
    const up = () => {
      const s = st.current
      const dr = drag.current
      if (dr && dr.i !== undefined && dr.moved < 4) {
        // a press on the scroll wheel: it clicks in
        s.press[dr.i] = 1
        a()?.click()
        if (dr.i === 0) s.muted = !s.muted
      }
      drag.current = null
      if (s.hand) {
        s.hand = null
        setHeld(false)
      }
      if (s.honking) {
        s.honking = false
        audio.current?.hornOff()
      }
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  })

  // ---- the physics of the column ----
  const step = (h) => {
    const s = st.current
    const v = live.current.speed
    // self-aligning torque: the tyres' contact patches pull the road wheels
    // straight, more strongly with speed (and a touch at a standstill)
    const k = 0.012 + 0.03 * v
    const c = 2 * 0.55 * Math.sqrt(k * I_WHEEL) + 0.012
    let tq = -k * s.angle - c * s.w
    if (s.hand) tq += 45 * (s.hand.target - s.angle) - 2.2 * s.w // the hand: a stiff spring
    // column friction: holds it still against a weak pull
    const fr = 0.05
    if (Math.abs(s.w) < 0.02 && Math.abs(tq) < fr) {
      s.w = 0
      tq = 0
    } else tq -= Math.sign(s.w || tq) * fr
    s.w += (tq / I_WHEEL) * h
    s.angle += s.w * h
    // the rack's ends
    if (Math.abs(s.angle) > LOCK) {
      if (Math.abs(s.w) > 1.5) a()?.clunk(Math.abs(s.w) / 10)
      s.angle = Math.sign(s.angle) * LOCK
      s.w = -s.w * 0.15
    }
    // the horn pad: pressed in on a spring
    s.hornV += ((s.honking ? 0.0045 : 0) - s.horn) * 900 * h - s.hornV * 40 * h
    s.horn += s.hornV * h
    s.press = s.press.map((p) => Math.max(0, p - h * 8))
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!(dt > 0)) return
    const n = Math.ceil(dt / (1 / 1000))
    for (let i = 0; i < n; i++) step(dt / n)
    const s = st.current
    wheelRef.current.rotation.z = -s.angle
    hubRef.current.position.z = -s.horn
    scrollRefs.forEach((r, i) => {
      if (!r.current) return
      r.current.rotation.x = s.scroll[i]
      r.current.position.z = 0.012 - s.press[i] * 0.002
    })
    s.tele += dt
    if (s.tele > 0.08) {
      s.tele = 0
      const road = s.angle / RATIO
      onTelemetry?.({ angle: s.angle, road, radius: Math.abs(road) > 1e-3 ? WHEELBASE / Math.tan(Math.abs(road)) : Infinity, volume: live.current.volume, muted: s.muted, speed: live.current.speed })
    }
  })

  const hov = (name) => ({
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(name)
    },
    onPointerOut: () => setHover(null),
  })

  return (
    // the column, tilted like a car's, with the wheel turning on its end
    <group ref={columnRef} rotation-x={-0.36}>
      <mesh geometry={geo.column} material={mats.column} position={[0, 0, -0.19]} castShadow />
      <mesh geometry={geo.shroud} material={mats.column} position={[0, 0, -0.07]} castShadow />
      <group ref={wheelRef}>
        {/* the rim: leather all round, or leather with a walnut top */}
        <group onPointerDown={onDown('rim')} {...hov('rim')}>
          {wood ? (
            <>
              <mesh geometry={geo.leatherA} material={mats.leather} castShadow receiveShadow />
              <mesh geometry={geo.woodRim} material={mats.wood} castShadow receiveShadow />
              {/* the joins between wood and leather */}
              {WOOD.map((t) => (
                <mesh key={t} geometry={geo.seam} material={mats.gloss} position={[RIM_R * Math.cos(t), RIM_R * Math.sin(t), 0]} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-Math.sin(t), Math.cos(t), 0))} />
              ))}
            </>
          ) : (
            <mesh geometry={geo.leatherFull} material={mats.leather} castShadow receiveShadow />
          )}
          {/* the spokes: side arms and the bottom spoke */}
          {[-1, 1].map((s) => (
            <RoundedBox key={s} args={[0.104, 0.05, 0.024]} radius={0.011} smoothness={4} position={[s * 0.122, -0.008, -0.008]} rotation-z={s * -0.08} material={mats.leather} castShadow receiveShadow />
          ))}
          <RoundedBox args={[0.064, 0.11, 0.022]} radius={0.012} smoothness={4} position={[0, -0.118, -0.01]} material={mats.plastic} castShadow receiveShadow />
          <mesh geometry={geo.trim} material={mats.satin} position={[0, 0, 0.0025]} />
        </group>
        {/* the scroll wheels, in gloss-black recesses on the side spokes */}
        {[-1, 1].map((s, i) => (
          <group key={s} position={[s * 0.125, -0.006, 0]}>
            <mesh geometry={geo.recess} material={mats.gloss} position={[0, 0, 0.004]} />
            <group ref={scrollRefs[i]} position={[0, 0, 0.012]} onPointerDown={onDown('scroll', i)} {...hov('scroll')}>
              <mesh geometry={geo.scroll} material={mats.scroll} castShadow />
            </group>
          </group>
        ))}
        {/* the airbag cover: it gives under a press for the horn */}
        <group ref={hubRef} onPointerDown={onDown('hub')} {...hov('hub')}>
          <mesh geometry={geo.hub} material={mats.hub} castShadow receiveShadow />
          <mesh geometry={geo.emblem} material={mats.chrome} position={[0, 0.012, 0.0365]} castShadow />
        </group>
      </group>
    </group>
  )
}
