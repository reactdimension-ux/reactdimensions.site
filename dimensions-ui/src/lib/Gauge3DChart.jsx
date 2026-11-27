import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D gauge: a pale tube arc lies on the floor like a horseshoe, and a glossy coloured
// fill tube with rounded caps sweeps along it to the value with a springy ease. Tick marks
// and their numbers sit outside the arc, thin coloured zone bands inside it, and the big
// value floats in the middle. Optional target pin, riding knob or a flat needle. Hover lifts
// the fill and shows a tooltip; drag to turn.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v, d = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : d
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// springy ease-out with a small overshoot
const pop = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// angles: 0 = the far side (-z), positive = clockwise seen from above (to the right)
const onFloor = (a, r, y = 0) => [Math.sin(a) * r, y, -Math.cos(a) * r]

// cross-section of the tube: an ellipse (round) or a superellipse (flat, rounded corners).
// returns offset (u radial, v up) and its normal for angle phi
function section(phi, w, h, n) {
  const c = Math.cos(phi)
  const s = Math.sin(phi)
  if (n <= 2.01) {
    const nu = c / w
    const nv = s / h
    const l = Math.hypot(nu, nv) || 1
    return [w * c, h * s, nu / l, nv / l]
  }
  const e = 2 / n
  const u = w * Math.sign(c) * Math.abs(c) ** e
  const v = h * Math.sign(s) * Math.abs(s) ** e
  const nu = (Math.sign(c) * Math.abs(c) ** (2 - e)) / w
  const nv = (Math.sign(s) * Math.abs(s) ** (2 - e)) / h
  const l = Math.hypot(nu, nv) || 1
  return [u, v, nu / l, nv / l]
}

// a tube bent along a floor arc from a0 to a1 at radius R. w = half width, h = half height;
// it sits on the floor (centre at y = h). Indices run along the arc so drawRange can clip it.
function arcTube(a0, a1, R, w, h, n, colors) {
  const span = Math.max(1e-4, a1 - a0)
  const N = Math.max(8, Math.ceil((span / (Math.PI * 2)) * 320))
  const M = 28
  const pos = []
  const nor = []
  const col = []
  const idx = []
  const c0 = colors && new THREE.Color(colors[0])
  const c1 = colors && new THREE.Color(colors[1])
  const tmp = new THREE.Color()
  for (let i = 0; i <= N; i++) {
    const a = a0 + (span * i) / N
    const nx = Math.sin(a)
    const nz = -Math.cos(a)
    if (colors) tmp.copy(c0).lerp(c1, i / N)
    for (let j = 0; j <= M; j++) {
      const [u, v, nu, nv] = section((j / M) * Math.PI * 2, w, h, n)
      pos.push(nx * (R + u), h + v, nz * (R + u))
      nor.push(nx * nu, nv, nz * nu)
      if (colors) col.push(tmp.r, tmp.g, tmp.b)
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const A = i * (M + 1) + j
      const B = A + M + 1
      idx.push(A, A + 1, B, B, A + 1, B + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.userData.quadsPerStep = M * 6
  g.userData.steps = N
  return g
}

// a rounded end cap: the outer half of the cross-section revolved about the vertical axis,
// in a local frame (x = outward, z = forward beyond the end, y = up, centre at origin)
function capGeometry(w, h, n) {
  const P = 14
  const T = 16
  const pos = []
  const nor = []
  const idx = []
  for (let i = 0; i <= P; i++) {
    const phi = -Math.PI / 2 + (Math.PI * i) / P
    const [u, v, nu, nv] = section(phi, w, h, n)
    for (let j = 0; j <= T; j++) {
      const th = (Math.PI * j) / T
      const cx = Math.cos(th)
      const cz = Math.sin(th)
      pos.push(Math.abs(u) * cx, v, Math.abs(u) * cz)
      nor.push(Math.abs(nu) * cx, nv, Math.abs(nu) * cz)
    }
  }
  for (let i = 0; i < P; i++)
    for (let j = 0; j < T; j++) {
      const A = i * (T + 1) + j
      const B = A + T + 1
      idx.push(A, B, A + 1, A + 1, B, B + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}
// orient a cap at angle a; dir = +1 for the forward (max) end, -1 for the start
function placeCap(obj, a, R, h, dir, y = 0) {
  obj.position.set(Math.sin(a) * R, h + y, -Math.cos(a) * R)
  obj.rotation.set(0, Math.PI / 2 - a + (dir < 0 ? Math.PI : 0), 0)
}

function useDispose(...gs) {
  useEffect(() => () => gs.forEach((g) => g && g.dispose()), gs) // eslint-disable-line react-hooks/exhaustive-deps
}

// places the camera on the tilt angle and backs it off far enough to fit the arc and labels
function Rig({ tilt, reach, front, back }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 10, 85) * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    // depth also has to fit the canvas height (foreshortened by the tilt), below the title
    const dW = (reach * 1.05) / (tanH * Math.min(aspect, 1.3))
    const dH = (((back + front) / 2) * Math.sin(e) + 0.6 * Math.cos(e)) * 0.95 / (tanH * 0.78)
    const d = Math.max(dW, dH)
    const zc = (front - back) / 2
    camera.position.set(0, Math.sin(e) * d, zc + Math.cos(e) * d)
    camera.lookAt(0, 0.15, zc + 0.2)
    camera.updateProjectionMatrix()
    if (controls?.target) {
      controls.target.set(0, 0.15, zc + 0.2)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, reach, front, back])
  return null
}

function Scene(p) {
  const { min, max, value, target, showTarget, arc, thickness, width, profile, bevel, gloss, pointer, fillMode, zones, zoneMode, showZones, showTicks, majorTicks, minorTicks, hoverLift, autoplay, autoRotate, animate, duration, labels, labelColor, label, decimals, prefix, suffix, color, color2, badColor, okColor, goodColor, trackColor, textColor, mutedColor } = p
  const R = 2
  const span = (clamp(arc, 90, 330) * Math.PI) / 180
  const A0 = -span / 2
  const lo = Math.min(min, max - 1e-6)
  const hi = Math.max(max, lo + 1e-6)
  const toA = (v) => A0 + span * clamp((v - lo) / (hi - lo), 0, 1)
  const w = clamp(width, 0.1, 0.8) / 2
  const h = clamp(thickness, 0.06, 0.8) / 2
  const n = profile === 'flat' ? clamp((1.5 * Math.min(w, h)) / Math.max(0.005, bevel), 3, 14) : 2
  const fw = w * 1.05
  const fh = h * 1.12
  const nf = new Intl.NumberFormat('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const fmt = (v) => `${prefix}${nf.format(v)}${suffix}`

  // zones: bounds between min and max, coloured bad -> ok -> good (or reversed)
  const zs = String(zones ?? '').split(',').map((s) => parseFloat(s)).filter((z) => Number.isFinite(z) && z > lo && z < hi).sort((a, b) => a - b)
  const bounds = [lo, ...zs, hi]
  const nz = bounds.length - 1
  const zoneColor = (i) => {
    const t = nz <= 1 ? 1 : i / (nz - 1)
    const k = zoneMode === 'high is bad' ? 1 - t : t
    return nz <= 1 ? goodColor : k < 0.34 ? badColor : k > 0.66 ? goodColor : okColor
  }
  const zoneName = (i) => {
    const c = zoneColor(i)
    return c === badColor ? 'Needs attention' : c === okColor ? 'Fair' : 'Good'
  }
  const zoneOf = (v) => Math.max(0, bounds.findIndex((b, i) => i < nz && v >= b && v <= bounds[i + 1]))

  const trackG = useMemo(() => arcTube(A0, A0 + span, R, w, h, n), [A0, span, w, h, n])
  const trackCap = useMemo(() => capGeometry(w, h, n), [w, h, n])
  const grad = fillMode === 'gradient' ? [color2, color] : null
  const fillG = useMemo(() => arcTube(A0, A0 + span, R, fw, fh, n, grad), [A0, span, fw, fh, n, grad?.[0], grad?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  const fillCap = useMemo(() => capGeometry(fw, fh, n), [fw, fh, n])
  useDispose(trackG)
  useDispose(trackCap)
  useDispose(fillG)
  useDispose(fillCap)

  // ticks outside the arc, numbers further out
  const nMaj = Math.max(1, Math.round(majorTicks))
  const nMin = Math.max(0, Math.round(minorTicks))
  const ticks = []
  if (showTicks)
    for (let i = 0; i <= nMaj; i++) {
      ticks.push({ v: lo + ((hi - lo) * i) / nMaj, major: true })
      if (i < nMaj) for (let j = 1; j <= nMin; j++) ticks.push({ v: lo + ((hi - lo) * (i + j / (nMin + 1))) / nMaj, major: false })
    }
  const tickR = R + w + 0.16
  const labR = R + w + 0.62
  const zoneR = R - w - 0.16

  // value animation: an eased sweep from wherever it is now to the goal
  const [goal, setGoal] = useState(value)
  useEffect(() => {
    if (!autoplay) return setGoal(value)
    const t = setInterval(() => setGoal(lo + Math.random() * (hi - lo)), 2600)
    setGoal(lo + Math.random() * (hi - lo))
    return () => clearInterval(t)
  }, [autoplay, value, lo, hi])
  const anim = useRef({ from: lo, to: lo, t0: 0, cur: lo, lift: 0, dim: 1, fade: 0, col: new THREE.Color(goodColor) })
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const s = anim.current
    s.from = animate && !reduce ? s.cur : goal
    s.to = goal
    s.t0 = performance.now()
    if (!animate || reduce) s.cur = goal
  }, [goal, animate])
  useEffect(() => {
    // restart the sweep from min when the scale or shape changes
    const s = anim.current
    if (animate) s.cur = s.from = lo
    s.t0 = performance.now()
    s.fade = animate ? 0 : 1
  }, [lo, hi, arc]) // eslint-disable-line react-hooks/exhaustive-deps

  const [hov, setHov] = useState(false)
  const fill = useRef()
  const fillMesh = useRef()
  const endCap = useRef()
  const startCap = useRef()
  const knob = useRef()
  const needle = useRef()
  const tip = useRef()
  const valEl = useRef()
  const tickEls = useRef([])
  const mat = useRef()
  const capMat = useRef()
  const spin = useRef()

  useFrame((_, dt) => {
    const s = anim.current
    const f = 1 - Math.exp(-dt * 12)
    const k = clamp((performance.now() - s.t0) / Math.max(1, duration), 0, 1)
    s.cur = k >= 1 ? s.to : s.from + (s.to - s.from) * pop(k)
    s.fade = Math.min(1, s.fade + dt / Math.max(0.05, (duration / 1000) * 0.5))
    if (!animate) s.fade = 1
    const v = clamp(s.cur, lo, hi)
    const a = toA(v)
    const t = (a - A0) / span
    s.lift += ((hov ? hoverLift : 0) - s.lift) * f
    s.dim += ((hov ? 0.4 : 1) - s.dim) * f
    if (fill.current) fill.current.position.y = s.lift
    if (fillMesh.current) {
      const st = fillG.userData.steps
      const steps = Math.floor(t * st)
      fillMesh.current.visible = t > 0.0005
      if (endCap.current) endCap.current.visible = t > 0.0005
      if (startCap.current) startCap.current.visible = t > 0.0005
      fillMesh.current.geometry.setDrawRange(0, steps * fillG.userData.quadsPerStep)
    }
    const ea = A0 + (Math.floor(t * fillG.userData.steps) / fillG.userData.steps) * span
    if (endCap.current) placeCap(endCap.current, ea, R, fh, 1)
    if (startCap.current) placeCap(startCap.current, A0, R, fh, -1)
    if (knob.current) {
      const [x, , z] = onFloor(a, R)
      knob.current.position.set(x, fh * 2 + 0.02 + s.lift, z)
    }
    if (needle.current) needle.current.rotation.y = -a
    if (tip.current) {
      const [x, , z] = onFloor(a, R)
      tip.current.position.set(x, fh * 2 + s.lift + 0.55, z)
    }
    // fill colour follows the zone it is in (or the end of the gradient)
    const want = fillMode === 'zones' ? zoneColor(zoneOf(v)) : fillMode === 'gradient' ? mix(color2, color, t) : color
    s.col.lerp(new THREE.Color(want), f)
    if (mat.current && fillMode !== 'gradient') mat.current.color.copy(s.col)
    if (capMat.current) capMat.current.color.copy(fillMode === 'gradient' ? new THREE.Color(want) : s.col)
    if (valEl.current) {
      valEl.current.textContent = labels === 'percent' ? nf.format(((v - lo) / (hi - lo)) * 100) : fmt(v)
      if (labelColor === 'fill') valEl.current.style.color = '#' + s.col.getHexString()
    }
    tickEls.current.forEach((el) => el && (el.style.opacity = String(s.fade * s.dim)))
    if (autoRotate && spin.current && !hov) spin.current.rotation.y += dt * 0.25
  })

  const over = (e) => {
    e.stopPropagation()
    setHov(true)
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    setHov(false)
    document.body.style.cursor = ''
  }
  const fillMat = { roughness: 0.32, envMapIntensity: 0.6, clearcoat: gloss, clearcoatRoughness: 0.14 }
  const frontZ = Math.max(0, -Math.cos(span / 2)) * R
  const valueZ = pointer === 'needle' ? Math.max(frontZ * 0.55, R * 0.5) : -0.1
  const cv = clamp(goal, lo, hi)
  const zi = zoneOf(cv)

  // the reach the camera has to fit: arc + ticks + tick numbers
  const outer = R + w + (showTicks ? 1.05 : 0.35)
  const Fz = Math.max(-Math.cos(span / 2) * outer, pointer === 'needle' ? valueZ + 0.6 : 0.4)

  return (
    <>
      <Rig tilt={p.tilt} reach={outer} front={Fz} back={outer} />
      <group ref={spin}>
        <group onPointerOver={over} onPointerOut={out}>
          {/* the pale track with rounded ends */}
          <mesh geometry={trackG} castShadow receiveShadow>
            <meshPhysicalMaterial color={trackColor} roughness={0.62} envMapIntensity={0.45} clearcoat={gloss * 0.25} clearcoatRoughness={0.4} />
          </mesh>
          {[A0, A0 + span].map((ca, i) => (
            <mesh key={i} geometry={trackCap} castShadow ref={(m) => m && placeCap(m, ca, R, h, i ? 1 : -1)}>
              <meshPhysicalMaterial color={trackColor} roughness={0.62} envMapIntensity={0.45} clearcoat={gloss * 0.25} clearcoatRoughness={0.4} />
            </mesh>
          ))}
          {/* the glossy fill: one long tube clipped with drawRange, plus two caps */}
          <group ref={fill}>
            <mesh ref={fillMesh} geometry={fillG} castShadow>
              <meshPhysicalMaterial ref={mat} vertexColors={fillMode === 'gradient'} color={fillMode === 'gradient' ? '#ffffff' : goodColor} {...fillMat} />
            </mesh>
            <mesh ref={startCap} geometry={fillCap} castShadow>
              <meshPhysicalMaterial color={fillMode === 'gradient' ? color2 : goodColor} {...fillMat} />
            </mesh>
            <mesh ref={endCap} geometry={fillCap} castShadow>
              <meshPhysicalMaterial ref={capMat} color={goodColor} {...fillMat} />
            </mesh>
          </group>
        </group>

        {/* a white bead riding on the fill end */}
        {pointer === 'knob' && (
          <mesh ref={knob} castShadow>
            <sphereGeometry args={[Math.max(fw, fh) * 0.62, 32, 20]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.25} clearcoat={1} clearcoatRoughness={0.1} envMapIntensity={0.7} />
          </mesh>
        )}

        {/* a flat tapered needle on a hub */}
        {pointer === 'needle' && (
          <group>
            <group ref={needle}>
              <mesh castShadow position={[0, 0.07, -(R - w - 0.25) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.025, 0.085, R - w - 0.25, 16]} />
                <meshPhysicalMaterial color={textColor} roughness={0.35} clearcoat={gloss} clearcoatRoughness={0.15} />
              </mesh>
            </group>
            <mesh castShadow position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.2, 0.22, 0.14, 40]} />
              <meshPhysicalMaterial color={textColor} roughness={0.35} clearcoat={gloss} clearcoatRoughness={0.15} />
            </mesh>
            <mesh position={[0, 0.145, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.02, 32]} />
              <meshPhysicalMaterial color="#ffffff" roughness={0.3} />
            </mesh>
          </group>
        )}

        {/* thin zone bands inside the arc */}
        {showZones && nz > 0 && bounds.slice(0, -1).map((b, i) => (
          <ZoneBand key={`${i}-${b}-${bounds[i + 1]}`} a0={toA(b) + 0.012} a1={toA(bounds[i + 1]) - 0.012} R={zoneR} color={zoneColor(i)} />
        ))}

        {/* tick marks */}
        {ticks.map((tk, i) => {
          const a = toA(tk.v)
          const len = tk.major ? 0.2 : 0.1
          const [x, , z] = onFloor(a, tickR + len / 2)
          return (
            <mesh key={i} position={[x, 0.015, z]} rotation={[0, -a, 0]} receiveShadow>
              <boxGeometry args={[tk.major ? 0.035 : 0.022, 0.03, len]} />
              <meshStandardMaterial color={tk.major ? mix(mutedColor, '#000000', 0.1) : mix(mutedColor, '#ffffff', 0.35)} roughness={0.6} />
            </mesh>
          )
        })}

        {/* target pin */}
        {showTarget && Number.isFinite(target) && target >= lo && target <= hi && (
          <group position={onFloor(toA(target), R)} rotation={[0, -toA(target), 0]}>
            {/* a slim dark collar around the track */}
            <mesh castShadow position={[0, fh, 0]} rotation={[0, Math.PI / 2, 0]} scale={[fw + 0.035, fh + 0.035, 1]}>
              <torusGeometry args={[1, 0.022 / Math.min(fw + 0.035, fh + 0.035), 12, 48]} />
              <meshPhysicalMaterial color={textColor} roughness={0.3} clearcoat={gloss} clearcoatRoughness={0.12} />
            </mesh>
          </group>
        )}

      {/* HTML labels: they turn with the chart but always face the screen */}
      {showTicks &&
        ticks.filter((tk) => tk.major).map((tk, i) => {
          const a = toA(tk.v)
          const fz = Math.max(0, -Math.cos(a)) // 1 on the camera side
          const [x, , z] = onFloor(a, labR + fz * 0.12)
          return (
            <Html key={i} position={[x, 0.05 - fz * 0.1, z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div ref={(el) => (tickEls.current[i] = el)} style={{ opacity: 0, fontFamily: FONT, color: mutedColor, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', userSelect: 'none' }}>
                {fmt(tk.v)}
              </div>
            </Html>
          )
        })}
      {showTarget && Number.isFinite(target) && target >= lo && target <= hi && (
        <Html position={onFloor(toA(target), R, h * 2 + 0.6)} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={(el) => (tickEls.current[nMaj + 1] = el)} style={{ opacity: 0, fontFamily: FONT, color: textColor, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', userSelect: 'none', background: '#ffffffd9', padding: '2px 8px', borderRadius: 999, boxShadow: '0 4px 12px -6px #0004' }}>
            Target {fmt(target)}
          </div>
        </Html>
      )}
      {labels !== 'none' && (
        <Html position={[0, 0.05, valueZ]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: FONT, textAlign: 'center', whiteSpace: 'nowrap', userSelect: 'none' }}>
            <div style={{ color: textColor, fontWeight: 700, lineHeight: 1, fontSize: 60, letterSpacing: '-0.03em' }}>
              <span ref={valEl}>{labels === 'percent' ? nf.format(0) : fmt(lo)}</span>
              {labels === 'percent' && <span style={{ fontSize: 30, marginLeft: 2 }}>%</span>}
            </div>
            {label && <div style={{ color: mutedColor, fontSize: 14, fontWeight: 600, marginTop: 6 }}>{label}</div>}
          </div>
        </Html>
      )}
      <group ref={tip}>
        {hov && (
          <Html center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
            <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
              <div style={{ fontWeight: 700 }}>{label || 'Value'}</div>
              <div style={{ opacity: 0.8 }}>
                {fmt(cv)} · {(((cv - lo) / (hi - lo)) * 100).toFixed(0)}% of range
                {fillMode === 'zones' && nz > 0 ? ` · ${zoneName(zi)}` : ''}
              </div>
              {showTarget && Number.isFinite(target) && <div style={{ opacity: 0.8 }}>Target {fmt(target)}</div>}
            </div>
          </Html>
        )}
      </group>
      </group>
    </>
  )
}

function ZoneBand({ a0, a1, R, color }) {
  const g = useMemo(() => arcTube(a0, Math.max(a0 + 0.01, a1), R, 0.05, 0.018, 4), [a0, a1, R])
  const cap = useMemo(() => capGeometry(0.05, 0.018, 4), [])
  useDispose(g)
  useDispose(cap)
  return (
    <group>
      <mesh geometry={g} receiveShadow>
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {[a0, Math.max(a0 + 0.01, a1)].map((a, i) => (
        <mesh key={i} geometry={cap} ref={(m) => m && placeCap(m, a, R, 0.018, i ? 1 : -1)}>
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

export default function Gauge3DChart({
  value = 72,
  min = 0,
  max = 100,
  target = 85,
  showTarget = true,
  label = 'System health',
  title = 'Health score',
  subtitle = 'Updated a minute ago',
  arc = 240,
  tilt = 44,
  thickness = 0.34,
  width = 0.42,
  profile = 'round',
  bevel = 0.04,
  gloss = 0.6,
  pointer = 'knob',
  fillMode = 'zones',
  zones = '40, 70',
  zoneMode = 'low is bad',
  showZones = true,
  showTicks = true,
  majorTicks = 5,
  minorTicks = 3,
  hoverLift = 0.25,
  labels = 'value',
  labelColor = 'text',
  autoplay = false,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1600,
  decimals = 0,
  prefix = '',
  suffix = '',
  color = '#2f8fff',
  color2 = '#a93ce0',
  badColor = '#ef4a3a',
  okColor = '#ff9a2e',
  goodColor = '#14a89e',
  trackColor = '#e2e3e8',
  background = '#f2f2f3',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const lo = num(min, 0)
  const hi = num(max, 100)
  const v = num(value, 0)
  const tg = num(target, NaN)
  const nf = new Intl.NumberFormat('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const fmt = (x) => `${prefix}${nf.format(x)}${suffix}`

  return (
    <div
      role="img"
      aria-label={`${title ? title + '. ' : ''}3D gauge. ${label || 'Value'}: ${fmt(v)} on a scale from ${fmt(lo)} to ${fmt(hi)}${showTarget && Number.isFinite(tg) ? `; target ${fmt(tg)}` : ''}.`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [0, 6, 8] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene
            {...{ min: lo, max: hi, value: v, target: tg, showTarget, label, arc: num(arc, 240), tilt, thickness, width, profile, bevel, gloss, pointer, fillMode, zones, zoneMode, showZones, showTicks, majorTicks, minorTicks, hoverLift, autoplay, autoRotate, animate, duration, labels, labelColor, decimals, prefix, suffix, color, color2, badColor, okColor, goodColor, trackColor, textColor, mutedColor }}
          />
          {/* soft studio: a broad top light for the glossy tube, side strips for its flanks */}
          <Environment resolution={128}>
            <color attach="background" args={['#d9dadd']} />
            <Lightformer form="rect" intensity={1.3} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[-6, 1, 3]} rotation-y={Math.PI / 2.4} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2.4} scale={[3, 6, 1]} />
          </Environment>
        </Suspense>
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 8, 5]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.32} scale={12} blur={2.4} far={2} />
        <OrbitControls
          makeDefault
          enabled={interactive}
          enablePan={false}
          enableZoom={false}
          minPolarAngle={((90 - clamp(tilt + 25, 15, 88)) * Math.PI) / 180}
          maxPolarAngle={((90 - clamp(tilt - 20, 8, 80)) * Math.PI) / 180}
        />
      </Canvas>
    </div>
  )
}
