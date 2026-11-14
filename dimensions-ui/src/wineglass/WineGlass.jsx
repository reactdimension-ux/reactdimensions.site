import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshTransmissionMaterial, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { H, INNER, IN_Y0, Y0, CAPACITY, glassGeometry, levelFor, volumeTo } from './geometry.js'
import { createGlassAudio, pitchFor } from './audio.js'

// The glass, its wine and how they move.
//
// The glass is a transmission material that refracts a live render of the
// scene behind it (so the wine shows through the wall), with a thin dark
// edge where the surface turns away from you, as glass photographs. The
// wine is a real volume: the inside of the bowl up to a level surface. That
// surface is a plane whose slope is a damped oscillator driven by how the
// glass is accelerated, at the sloshing frequency of a bowl this size (about
// 3.3 Hz), so sliding the glass, or swirling it in small circles as you
// would to open a wine, sets it climbing and lapping round the wall. Click
// the glass to strike it: it rings at a pitch set by how much wine is in it.

const WINES = {
  red: { color: '#9a1029', dist: 0.005, shadow: '#b77580' },
  rosé: { color: '#f3958d', dist: 0.03, shadow: '#ecc1bc' },
  white: { color: '#efdc8e', dist: 0.09, shadow: '#efe6c2' },
  water: { color: '#e8f4f2', dist: 1.5, shadow: '#f2f4f4' },
}

const G = 9.81
const SLOSH_W = 2 * Math.PI * 3.3 // first sloshing mode of the bowl
const SLOSH_Z = 0.06 // its damping ratio

// the wine: the bowl's inside, cut off by a (possibly tilted) flat surface
function makeWine(N = 96, M = 30) {
  const cols = N + 1
  const wall = cols * (M + 1)
  const pos = new Float32Array((wall + 1 + cols) * 3)
  const idx = []
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j
      const b = (i + 1) * (M + 1) + j
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  const C = wall
  for (let i = 0; i < N; i++) idx.push(C, C + 2 + i, C + 1 + i)
  const geo = new THREE.BufferGeometry()
  const attr = new THREE.BufferAttribute(pos, 3)
  attr.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', attr)
  geo.setIndex(idx)
  const K = INNER.length - 1
  const at = (t) => {
    const k = Math.min(K - 1, Math.floor(t))
    const f = t - k
    return [INNER[k][0] + (INNER[k + 1][0] - INNER[k][0]) * f, INNER[k][1] + (INNER[k + 1][1] - INNER[k][1]) * f]
  }
  const update = (h, sx, sz) => {
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2
      const c = Math.cos(th)
      const s = Math.sin(th)
      const lean = sx * c + sz * s
      // walk up the wall to where it meets the surface
      let top = K
      for (let k = 1; k <= K; k++) {
        const g = INNER[k][1] - (h + INNER[k][0] * lean)
        if (g >= 0) {
          const g0 = INNER[k - 1][1] - (h + INNER[k - 1][0] * lean)
          top = k - 1 + (g0 < 0 ? -g0 / (g - g0) : 0)
          break
        }
      }
      for (let j = 0; j <= M; j++) {
        // rows bunched towards the surface, where the meniscus line shows
        const [r, y] = at(top * Math.sin(((j / M) * Math.PI) / 2))
        const o = (i * (M + 1) + j) * 3
        pos[o] = r * c
        pos[o + 1] = y
        pos[o + 2] = r * s
      }
      const o = (C + 1 + i) * 3
      const w = (i * (M + 1) + M) * 3
      pos[o] = pos[w]
      pos[o + 1] = pos[w + 1]
      pos[o + 2] = pos[w + 2]
    }
    pos[C * 3] = 0
    pos[C * 3 + 1] = h
    pos[C * 3 + 2] = 0
    attr.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
  }
  return { geo, update }
}

// a dark edge where the glass turns away from the eye
const rimVert = `
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const rimFrag = `
uniform vec3 tint; uniform float strength;
varying vec3 vN; varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
  gl_FragColor = vec4(tint, f * strength);
}`

// The shadow the glass throws away from the key light: a thin stem line and
// a pale ellipse for the bowl, light in the middle where the round bowl
// focuses the light, and tinted by the wine. Drawn on a canvas and laid on
// the table with multiply blending, so it only ever darkens.
const SUN = new THREE.Vector2(0.9, -0.8) // where the key light's shadow points, per unit height ÷ 1.6
const PER_M = 2133 // canvas px per metre
function drawShadow(cv, level, wine) {
  const c = cv.getContext('2d')
  const u = (m) => (m + 0.02) * PER_M
  const v = (m) => (m + 0.06) * PER_M
  const k = SUN.length() / 1.6 // shadow length per metre of height
  c.filter = 'none'
  c.fillStyle = '#fff'
  c.fillRect(0, 0, cv.width, cv.height)
  c.filter = 'blur(8px)'
  // the stem
  c.strokeStyle = '#b9b9b9'
  c.lineWidth = 0.006 * PER_M
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(u(0.016 * k), v(0))
  c.lineTo(u(0.095 * k), v(0))
  c.stroke()
  // the bowl
  const cu = u(0.168 * k)
  const ru = 0.066 * PER_M
  const rv = 0.045 * PER_M
  c.save()
  c.translate(cu, v(0))
  c.scale(ru / rv, 1)
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rv)
  g.addColorStop(0, '#fdfdfd')
  g.addColorStop(0.5, '#ececec')
  g.addColorStop(0.82, '#d2d2d2')
  g.addColorStop(1, '#ffffff')
  c.fillStyle = g
  c.beginPath()
  c.arc(0, 0, rv, 0, Math.PI * 2)
  c.fill()
  c.restore()
  // the wine colours the part of the shadow the light went through it for
  if (wine && level > IN_Y0 + 0.001) {
    c.save()
    c.beginPath()
    c.ellipse(cu, v(0), ru * 0.92, rv * 0.92, 0, 0, Math.PI * 2)
    c.clip()
    c.globalCompositeOperation = 'multiply'
    c.fillStyle = wine.shadow
    c.fillRect(u((Y0 - 0.01) * k), 0, (level - Y0 + 0.012) * k * PER_M, cv.height)
    c.restore()
  }
}

const WineGlass = forwardRef(function WineGlass({ wine = 'red', fill = 0.35, sound = true, pitch = 760, onInfo }, ref) {
  const { invalidate, controls } = useThree()
  const glassGeo = useMemo(() => glassGeometry(), [])
  const liquid = useMemo(() => makeWine(), [])
  useEffect(() => () => (glassGeo.dispose(), liquid.geo.dispose()), [glassGeo, liquid])
  const rim = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: rimVert,
        fragmentShader: rimFrag,
        uniforms: { tint: { value: new THREE.Color('#2b2d31') }, strength: { value: 0.85 } },
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  )
  const shadowCanvas = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = 256
    // drawn straight away, so the first frame has no blank rectangle
    drawShadow(cv, IN_Y0, null)
    return cv
  }, [])
  const shadowTex = useMemo(() => {
    const t = new THREE.CanvasTexture(shadowCanvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [shadowCanvas])
  useEffect(() => () => (rim.dispose(), shadowTex.dispose()), [rim, shadowTex])

  const W = WINES[wine]
  const S = useRef({
    pos: new THREE.Vector2(),
    vel: new THREE.Vector2(),
    acc: new THREE.Vector2(),
    target: new THREE.Vector2(),
    home: new THREE.Vector2(),
    s: new THREE.Vector2(),
    sv: new THREE.Vector2(),
    level: W ? levelFor(fill) : IN_Y0,
    built: '',
    shadowAt: -1,
    swirl: null,
    drag: null,
  })
  const group = useRef()
  const wineMesh = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover, 'grab')

  const audio = useRef(null)
  useEffect(() => () => audio.current?.dispose(), [])

  const report = () => {
    const st = S.current
    const ml = W ? volumeTo(st.level) : 0
    const depth = W ? (st.level - IN_Y0) / (H - IN_Y0) : 0
    onInfo?.({ ml: Math.round(ml / 5) * 5, capacity: Math.round(CAPACITY / 10) * 10, hz: Math.round(pitchFor(pitch, depth)) })
  }
  const ring = (strength = 1) => {
    const st = S.current
    const depth = W ? (st.level - IN_Y0) / (H - IN_Y0) : 0
    if (sound) {
      if (!audio.current) audio.current = createGlassAudio()
      audio.current?.ring(pitchFor(pitch, depth), strength, Math.min(1, depth * 1.6))
    }
    // the strike sets the surface trembling
    st.sv.x += (Math.random() - 0.5) * 0.25 * strength
    st.sv.y += (Math.random() - 0.5) * 0.25 * strength
    report()
    invalidate()
  }

  useImperativeHandle(ref, () => ({
    swirl() {
      const st = S.current
      st.swirl = { t: 0 }
      st.home.copy(st.target)
      invalidate()
    },
    clink: () => ring(0.85),
    centre() {
      S.current.target.set(0, 0)
      invalidate()
    },
  }))

  // a new wine or fill: the level eases there (and the report follows)
  useEffect(() => {
    invalidate()
  }, [wine, fill, invalidate])

  useFrame((_, delta) => {
    const st = S.current
    const dt = Math.min(delta, 1 / 30)
    let active = !!st.drag

    // the level eases towards the pour
    const goal = W ? levelFor(fill) : IN_Y0
    if (Math.abs(st.level - goal) > 2e-5) {
      st.level += (goal - st.level) * (1 - Math.exp(-dt * 2.5))
      active = true
      report()
    } else if (st.level !== goal) {
      st.level = goal
      report()
    }

    // swirling: the base slides round a small circle, 2.1 times a second
    if (st.swirl) {
      const T = 3.6
      st.swirl.t += dt
      const t = st.swirl.t
      const env = Math.max(0, Math.min(1, t / 0.7, (T - t) / 0.7))
      const R = 0.011 * env * env * (3 - 2 * env)
      const w = 2 * Math.PI * 2.1 * t
      st.target.set(st.home.x + R * Math.cos(w) - R, st.home.y + R * Math.sin(w))
      if (t >= T) {
        st.swirl = null
        st.target.copy(st.home)
      }
      active = true
    }

    // substeps: the glass follows its target on a stiff spring, and the
    // surface slope chases -acceleration / g as a damped oscillator
    const n = 4
    const h = dt / n
    for (let i = 0; i < n; i++) {
      const ax = 900 * (st.target.x - st.pos.x) - 60 * st.vel.x
      const az = 900 * (st.target.y - st.pos.y) - 60 * st.vel.y
      st.vel.x += ax * h
      st.vel.y += az * h
      st.pos.x += st.vel.x * h
      st.pos.y += st.vel.y * h
      const ex = -ax / G
      const ez = -az / G
      st.sv.x += (SLOSH_W * SLOSH_W * (ex - st.s.x) - 2 * SLOSH_Z * SLOSH_W * st.sv.x) * h
      st.sv.y += (SLOSH_W * SLOSH_W * (ez - st.s.y) - 2 * SLOSH_Z * SLOSH_W * st.sv.y) * h
      st.s.x += st.sv.x * h
      st.s.y += st.sv.y * h
    }
    const len = st.s.length()
    if (len > 0.85) st.s.multiplyScalar(0.85 / len)
    if (st.vel.lengthSq() > 1e-8 || st.pos.distanceToSquared(st.target) > 1e-10) active = true
    if (st.s.lengthSq() > 1e-8 || st.sv.lengthSq() > 1e-6) active = true
    else st.s.set(0, 0)
    group.current.position.set(st.pos.x, 0, st.pos.y)

    // rebuild the wine when its surface has moved
    const has = st.level > IN_Y0 + 0.0008
    if (wineMesh.current) wineMesh.current.visible = has
    const key = `${st.level.toFixed(5)}:${st.s.x.toFixed(4)}:${st.s.y.toFixed(4)}`
    if (has && key !== st.built) {
      st.built = key
      liquid.update(st.level, st.s.x, st.s.y)
    }
    if (Math.abs(st.shadowAt - st.level) > 0.0005 || st.shadowWine !== wine) {
      st.shadowAt = st.level
      st.shadowWine = wine
      drawShadow(shadowCanvas, st.level, W)
      shadowTex.needsUpdate = true
    }
    if (active) invalidate()
  })
  useEffect(report, [wine, pitch]) // eslint-disable-line react-hooks/exhaustive-deps

  // drag the glass about the table; a click without moving strikes it
  const down = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    const st = S.current
    st.swirl = null
    st.drag = { y: e.point.y, ox: e.point.x - st.pos.x, oz: e.point.z - st.pos.y, x0: e.clientX, y0: e.clientY, moved: 0, at: performance.now(), high: e.point.y > Y0 }
    if (controls) controls.enabled = false
    invalidate()
  }
  const move = (e) => {
    const d = S.current.drag
    if (!d) return
    d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.x0, e.clientY - d.y0))
    if (d.moved < 4) return
    const r = e.ray
    if (Math.abs(r.direction.y) < 1e-4) return
    const t = (d.y - r.origin.y) / r.direction.y
    if (t < 0) return
    let x = r.origin.x + r.direction.x * t - d.ox
    let z = r.origin.z + r.direction.z * t - d.oz
    const m = Math.hypot(x, z)
    if (m > 0.3) (x *= 0.3 / m), (z *= 0.3 / m)
    S.current.target.set(x, z)
    invalidate()
  }
  const up = (e) => {
    const st = S.current
    const d = st.drag
    if (!d) return
    e.target.releasePointerCapture?.(e.pointerId)
    st.drag = null
    if (controls) controls.enabled = true
    if (d.moved < 4 && performance.now() - d.at < 450) ring(d.high ? 1 : 0.45)
    invalidate()
  }

  const sunAngle = Math.atan2(-SUN.y, SUN.x)
  return (
    <group ref={group}>
      <mesh geometry={glassGeo} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <MeshTransmissionMaterial
          backside={false}
          samples={6}
          resolution={1024}
          transmission={1}
          roughness={0}
          thickness={0.012}
          ior={1.5}
          chromaticAberration={0.035}
          anisotropicBlur={0.02}
          distortion={0}
          clearcoat={1}
          clearcoatRoughness={0}
          envMapIntensity={1.5}
          attenuationColor="#eef6f2"
          attenuationDistance={0.4}
          color="#ffffff"
        />
        {/* a child of the glass, so it is hidden too while the glass renders what is behind it */}
        <mesh geometry={glassGeo} material={rim} renderOrder={2} raycast={() => null} />
      </mesh>
      <mesh ref={wineMesh} geometry={liquid.geo} renderOrder={1} raycast={() => null} visible={false}>
        <meshPhysicalMaterial color="#ffffff" transmission={1} roughness={0.02} ior={1.34} thickness={0.06} attenuationColor={W?.color ?? '#ffffff'} attenuationDistance={W?.dist ?? 1} specularIntensity={1} envMapIntensity={1.2} />
      </mesh>
      {/* the shadow on the table */}
      <group rotation-y={sunAngle} position-y={0.0007}>
        <mesh position-x={0.1} rotation-x={-Math.PI / 2} raycast={() => null}>
          <planeGeometry args={[0.24, 0.12]} />
          <meshBasicMaterial map={shadowTex} transparent blending={THREE.MultiplyBlending} premultipliedAlpha depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
})

export default WineGlass
