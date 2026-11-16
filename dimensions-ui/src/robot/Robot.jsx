import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// A tabletop companion robot. 1 unit is about 10 cm, so it stands about
// half a metre tall. A fabric-wrapped speaker drum is the base, with a small
// ring light at the front; a glossy white body tapers up from it like a bell
// to a champagne collar; a short stalk carries the head, a rounded tablet
// with a black glass screen and two camera eyes above it.
//
// The head is on a two-axis neck (pan and tilt). It turns to follow the
// pointer, drag it to pose it, and tap the screen to change what it shows.
// The neck moves like a real motor: each axis is a spring with damping, so
// it eases into place with a slight overshoot rather than snapping. Each
// screen is drawn live on a canvas: rain falls past the umbrella, the clock
// keeps time, the eyes blink and look where the head is turning.

export const FACES = ['weather', 'clock', 'smile', 'heart', 'music']

const BASE_R = 1.12
const BASE_H = 0.8
const BODY_H = 2.5
const NECK_Y = BASE_H + BODY_H + 0.06 // the pan/tilt joint
const HEAD = { w: 3.5, h: 2.5, d: 0.5, r: 0.85 } // at screenSize 1, screenAspect 1.4

// The head's outline for a screen size (a scale) and shape (width over
// height). The area scales with the size; the shape trades width for height.
function headDims(size, aspect) {
  const k = Math.sqrt(aspect / 1.4)
  const w = HEAD.w * size * k
  const h = HEAD.h * size / k
  return { w, h, d: HEAD.d, r: Math.min(HEAD.r * size, Math.min(w, h) * 0.34), lift: h / 2 + 0.13 }
}
const PAN = 1.05 // how far the head may turn either way (radians)
const TILT = [-0.32, 0.42]

// ---------------------------------------------------------------- textures

// A close knit for the speaker fabric: colour and a matching normal map.
function knitTextures() {
  const S = 256
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  const h = new Float32Array(S * S)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // interlocking loops: two offset sine weaves
      const a = Math.sin((x / S) * Math.PI * 2 * 48 + Math.sin((y / S) * Math.PI * 2 * 64) * 0.9)
      const b = Math.sin((y / S) * Math.PI * 2 * 64)
      h[y * S + x] = 0.5 + 0.25 * a * b + 0.25 * Math.abs(b) + (Math.random() - 0.5) * 0.12
    }
  const nc = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const ng = nc.getContext('2d')
  const nimg = ng.createImageData(S, S)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const k = y * S + x
      const v = 205 + h[k] * 40
      img.data.set([v, v, v * 1.01, 255], k * 4)
      const dx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)]
      const dy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x]
      const n = new THREE.Vector3(-dx * 2.5, dy * 2.5, 1).normalize()
      nimg.data.set([(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255, 255], k * 4)
    }
  g.putImageData(img, 0, 0)
  ng.putImageData(nimg, 0, 0)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  const normalMap = new THREE.CanvasTexture(nc)
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(3, 1)
    t.anisotropy = 8
  }
  return { map, normalMap }
}

// The screen: a canvas redrawn as the face animates.
// Faces are designed on a 640 x 400 frame, fitted into the middle of
// whatever shape the screen is; the background and rain fill all of it.
const SW = 640
const SH = 400

function drawFace(g, face, t, look, accent, pulse) {
  const W = g.canvas.width
  const Hc = g.canvas.height
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.fillStyle = '#07090d'
  g.fillRect(0, 0, W, Hc)
  if (face === 'weather') {
    g.strokeStyle = 'rgba(70, 110, 170, 0.55)'
    g.lineWidth = 2
    const n = Math.round((26 * W * Hc) / (SW * SH))
    for (let i = 0; i < n; i++) {
      const x0 = ((i * 97.3) % W) + ((t * 140) % 80)
      const y0 = ((i * 61.7 + t * 260) % (Hc + 160)) - 120
      g.beginPath()
      g.moveTo(x0, y0)
      g.lineTo(x0 - 26, y0 + 70)
      g.stroke()
    }
  }
  const u = Math.min(W / SW, Hc / SH)
  g.setTransform(u, 0, 0, u, (W - SW * u) / 2, (Hc - SH * u) / 2)
  if (face === 'weather') {
    // a red umbrella in the rain
    const cx = SW / 2
    const cy = SH * 0.47
    const R = 118
    g.fillStyle = accent
    g.beginPath()
    g.arc(cx, cy, R, Math.PI, 0)
    // scalloped hem
    const n = 4
    for (let k = n; k > 0; k--) {
      const xa = cx - R + ((2 * R) / n) * k
      const xb = xa - (2 * R) / n
      g.quadraticCurveTo((xa + xb) / 2, cy - 22, xb, cy)
    }
    g.fill()
    g.strokeStyle = '#f4f2ee'
    g.lineWidth = 9
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(cx, cy - 4)
    g.lineTo(cx, cy + 92)
    g.arc(cx - 20, cy + 92, 20, 0, Math.PI, false)
    g.stroke()
    g.fillStyle = '#f4f2ee'
    g.beginPath()
    g.arc(cx, cy - R - 4, 6, 0, Math.PI * 2)
    g.fill()
  } else if (face === 'clock') {
    const d = new Date()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    g.fillStyle = '#f4f2ee'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '600 150px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
    g.fillText(`${hh}${d.getSeconds() % 2 ? ':' : ' '}${mm}`, SW / 2, SH * 0.45)
    g.font = '500 30px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
    g.fillStyle = accent
    g.fillText(d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase(), SW / 2, SH * 0.78)
  } else if (face === 'smile') {
    // eyes that blink, and look the way the head is turning
    const blink = Math.max(0, 1 - Math.abs(((t * 0.31) % 1) - 0.5) * 40)
    const ex = look.x * 46
    const ey = -look.y * 30
    g.fillStyle = '#f4f2ee'
    for (const s of [-1, 1]) {
      const h = 120 * (1 - blink * 0.92)
      roundRect(g, SW / 2 + s * 120 - 38 + ex, SH * 0.42 - h / 2 + ey, 76, h, 38)
      g.fill()
    }
    g.strokeStyle = accent
    g.lineWidth = 12
    g.lineCap = 'round'
    g.beginPath()
    g.arc(SW / 2 + ex * 0.6, SH * 0.6 + ey * 0.6, 62, 0.2 * Math.PI, 0.8 * Math.PI)
    g.stroke()
  } else if (face === 'heart') {
    const s = 1 + 0.08 * Math.pow(Math.max(0, Math.sin(t * 7.5)), 6) + 0.12 * pulse
    g.save()
    g.translate(SW / 2, SH * 0.52)
    g.scale(s * 5.6, s * 5.6)
    g.fillStyle = accent
    g.beginPath()
    g.moveTo(0, 12)
    g.bezierCurveTo(-26, -6, -14, -26, 0, -12)
    g.bezierCurveTo(14, -26, 26, -6, 0, 12)
    g.fill()
    g.restore()
  } else {
    // music: a spectrum that dances
    const n = 15
    const bw = 22
    const gap = 12
    const x0 = SW / 2 - (n * (bw + gap) - gap) / 2
    for (let i = 0; i < n; i++) {
      const v = 0.25 + 0.75 * Math.abs(Math.sin(t * (2.1 + (i % 5) * 0.7) + i * 1.3) * Math.sin(t * 1.3 + i * 0.4))
      const h = 40 + v * 220
      g.fillStyle = i % 4 === 0 ? accent : '#f4f2ee'
      roundRect(g, x0 + i * (bw + gap), SH * 0.82 - h, bw, h, 11)
      g.fill()
    }
  }
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// ---------------------------------------------------------------- shapes

// A rounded rectangle, a little wider at the top than the bottom.
function headShape(w, h, r, taper = 0.06) {
  const s = new THREE.Shape()
  const wt = w / 2
  const wb = (w / 2) * (1 - taper)
  const hh = h / 2
  s.moveTo(-wb + r, -hh)
  s.lineTo(wb - r, -hh)
  s.quadraticCurveTo(wb, -hh, wb + (wt - wb) * (r / h), -hh + r)
  s.lineTo(wt - (wt - wb) * (r / h), hh - r)
  s.quadraticCurveTo(wt, hh, wt - r, hh)
  s.lineTo(-wt + r, hh)
  s.quadraticCurveTo(-wt, hh, -wt + (wt - wb) * (r / h), hh - r)
  s.lineTo(-wb - (wt - wb) * (r / h), -hh + r)
  s.quadraticCurveTo(-wb, -hh, -wb + r, -hh)
  return s
}

// UVs from the shape's bounding box, so a texture fills it.
function boxUV(g) {
  g.computeBoundingBox()
  const b = g.boundingBox
  const p = g.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x)
    uv[i * 2 + 1] = (p.getY(i) - b.min.y) / (b.max.y - b.min.y)
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

// The body: a bell that narrows to the neck, turned on a lathe from a smooth profile.
function bodyGeometry() {
  const curve = new THREE.CatmullRomCurve3(
    [
      [BASE_R - 0.1, 0],
      [BASE_R - 0.13, 0.25],
      [0.9, 0.85],
      [0.7, 1.5],
      [0.52, 2.05],
      [0.43, 2.4],
      [0.41, BODY_H],
    ].map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    'centripetal',
  )
  const pts = curve.getPoints(48).map((p) => new THREE.Vector2(p.x, p.y))
  pts.push(new THREE.Vector2(0.2, BODY_H + 0.02), new THREE.Vector2(0, BODY_H + 0.02))
  pts.unshift(new THREE.Vector2(0, 0))
  return new THREE.LatheGeometry(pts, 96)
}

// ---------------------------------------------------------------- the robot

export default function Robot({ face = 'weather', screenSize = 1, screenAspect = 1.4, follow = true, shellColor = '#f4f4f1', fabricColor = '#d9d9d6', accentColor = '#e8411f', onChange }) {
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls)
  const pan = useRef()
  const tilt = useRef()
  const ring = useRef()

  const H = useMemo(() => headDims(screenSize, screenAspect), [screenSize, screenAspect])
  const geo = useMemo(() => {
    const shell = new THREE.ExtrudeGeometry(headShape(H.w - 0.24, H.h - 0.24, H.r), { depth: H.d, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.15, bevelSegments: 8, curveSegments: 24 })
    shell.translate(0, 0, -H.d / 2)
    shell.computeVertexNormals()
    const glass = boxUV(new THREE.ShapeGeometry(headShape(H.w - 0.52, H.h - 0.6, Math.max(0.1, H.r - 0.25), 0.06), 24))
    const screen = boxUV(new THREE.ShapeGeometry(headShape(H.w - 0.74, H.h - 0.8, Math.max(0.08, H.r - 0.36), 0.06), 24))
    return { shell, glass, screen, body: bodyGeometry() }
  }, [H])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  const knit = useMemo(() => knitTextures(), [])
  useEffect(() => () => (knit.map.dispose(), knit.normalMap.dispose()), [knit])

  // the live screen
  // drawn at the screen's own proportions, so faces never stretch
  const screen = useMemo(() => {
    const sw = H.w - 0.74
    const sh = H.h - 0.8
    const c = Object.assign(document.createElement('canvas'), { width: SW, height: Math.round((SW * sh) / sw) })
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return { c, g: c.getContext('2d'), tex }
  }, [H])
  useEffect(() => () => screen.tex.dispose(), [screen])

  // neck motion: a damped spring on each axis
  const m = useRef({ pan: 0, tilt: 0.08, vp: 0, vt: 0, tp: 0, tt: 0.08, posed: -10, nod: 0, pulse: 0, drag: null })

  const next = () => {
    const i = FACES.indexOf(face)
    const f = FACES[(i + 1) % FACES.length]
    if (onChange) onChange({ face: f })
    m.current.nod = 1
    m.current.pulse = 1
  }

  // Dragging the head poses it; a press that barely moves is a tap.
  const onDown = (e) => {
    e.stopPropagation()
    m.current.drag = { x: e.clientX, y: e.clientY, p: m.current.tp, t: m.current.tt, moved: false }
    if (controls) controls.enabled = false
    gl.domElement.setPointerCapture?.(e.pointerId)
  }
  useEffect(() => {
    const el = gl.domElement
    const move = (e) => {
      const d = m.current.drag
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (Math.hypot(dx, dy) > 5) d.moved = true
      m.current.tp = THREE.MathUtils.clamp(d.p + dx * 0.006, -PAN, PAN)
      m.current.tt = THREE.MathUtils.clamp(d.t + dy * 0.004, TILT[0], TILT[1])
      m.current.posed = performance.now()
    }
    const up = () => {
      const d = m.current.drag
      if (!d) return
      m.current.drag = null
      if (controls) controls.enabled = true
      if (!d.moved) next()
    }
    el.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  })

  let last = -1
  useFrame((state, dt) => {
    const s = m.current
    const step = Math.min(dt, 1 / 30)
    const t = state.clock.elapsedTime
    // follow the pointer, unless it was just posed by hand
    if (follow && !s.drag && performance.now() - s.posed > 4000) {
      s.tp = THREE.MathUtils.clamp(state.pointer.x * 0.85, -PAN, PAN)
      s.tt = THREE.MathUtils.clamp(-state.pointer.y * 0.32 + 0.06, TILT[0], TILT[1])
    } else if (!follow && !s.drag && performance.now() - s.posed > 6000) {
      // idle: a slow look around
      s.tp = Math.sin(t * 0.23) * 0.45
      s.tt = 0.06 + Math.sin(t * 0.31) * 0.08
    }
    // spring each axis toward its target (a geared motor: brisk, a touch of overshoot)
    const k = 38
    const c = 9.5
    s.vp += ((s.tp - s.pan) * k - s.vp * c) * step
    s.vt += ((s.tt - s.tilt) * k - s.vt * c) * step
    s.pan += s.vp * step
    s.tilt += s.vt * step
    s.nod = Math.max(0, s.nod - step * 1.6)
    s.pulse = Math.max(0, s.pulse - step * 1.2)
    const nod = Math.sin((1 - s.nod) * Math.PI * 2) * s.nod * 0.22
    const breathe = Math.sin(t * 1.4) * 0.012
    if (pan.current) pan.current.rotation.y = s.pan
    if (tilt.current) tilt.current.rotation.x = s.tilt + nod + breathe
    // the ring light breathes
    if (ring.current) ring.current.material.emissiveIntensity = 1.6 + Math.sin(t * 2.2) * 0.9 + s.pulse * 3
    // redraw the screen about 30 times a second
    if (t - last > 1 / 30) {
      last = t
      drawFace(screen.g, face, t, { x: s.pan / PAN, y: (s.tilt - 0.06) / 0.4 }, accentColor, s.pulse)
      screen.tex.needsUpdate = true
    }
  })

  const shell = <meshPhysicalMaterial color={shellColor} roughness={0.22} clearcoat={0.8} clearcoatRoughness={0.08} />
  return (
    <group>
      {/* base: a fabric speaker drum between two white lips */}
      <mesh position-y={BASE_H / 2} castShadow receiveShadow>
        <cylinderGeometry args={[BASE_R, BASE_R, BASE_H - 0.1, 96, 1, true]} />
        <meshStandardMaterial map={knit.map} normalMap={knit.normalMap} normalScale={new THREE.Vector2(0.6, 0.6)} color={fabricColor} roughness={0.95} />
      </mesh>
      <mesh position-y={0.03} castShadow receiveShadow>
        <cylinderGeometry args={[BASE_R + 0.01, BASE_R - 0.02, 0.06, 96]} />
        {shell}
      </mesh>
      <mesh position-y={BASE_H - 0.03} castShadow receiveShadow>
        <cylinderGeometry args={[BASE_R - 0.06, BASE_R + 0.01, 0.06, 96]} />
        {shell}
      </mesh>
      {/* the ring light at the front of the base */}
      <mesh ref={ring} position={[0, BASE_H * 0.28, BASE_R + 0.004]}>
        <torusGeometry args={[0.07, 0.017, 12, 40]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* body */}
      <mesh geometry={geo.body} position-y={BASE_H} castShadow receiveShadow>
        {shell}
      </mesh>
      {/* collar */}
      <mesh position-y={NECK_Y - 0.06} castShadow>
        <cylinderGeometry args={[0.405, 0.42, 0.1, 64]} />
        <meshStandardMaterial color="#d9c6b0" metalness={1} roughness={0.28} />
      </mesh>
      {/* the head on its pan and tilt joints */}
      <group ref={pan} position-y={NECK_Y}>
        <mesh position-y={0.1} castShadow>
          <cylinderGeometry args={[0.24, 0.3, 0.2, 48]} />
          <meshStandardMaterial color="#e9e9e6" roughness={0.4} />
        </mesh>
        <group ref={tilt} position-y={0.22}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.7, 32]} />
            <meshStandardMaterial color="#d9c6b0" metalness={1} roughness={0.3} />
          </mesh>
          <group
            position={[0, H.lift, -0.08]}
            onPointerDown={onDown}
            onPointerOver={(e) => (e.stopPropagation(), (document.body.style.cursor = 'grab'))}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            <mesh geometry={geo.shell} castShadow receiveShadow>
              {shell}
            </mesh>
            {/* black glass, then the lit screen behind it */}
            <mesh geometry={geo.glass} position-z={H.d / 2 + 0.161}>
              <meshPhysicalMaterial color="#030405" roughness={0.06} metalness={0} clearcoat={1} clearcoatRoughness={0.02} />
            </mesh>
            <mesh geometry={geo.screen} position-z={H.d / 2 + 0.164}>
              <meshBasicMaterial map={screen.tex} toneMapped={false} transparent opacity={0.97} />
            </mesh>
            {/* camera eyes, and a sensor */}
            {[-0.09, 0.09].map((x) => (
              <mesh key={x} position={[x, H.h / 2 - 0.2, H.d / 2 + 0.163]}>
                <circleGeometry args={[0.035, 20]} />
                <meshPhysicalMaterial color="#0c0d10" roughness={0.1} clearcoat={1} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}
