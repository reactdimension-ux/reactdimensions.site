import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A row of glass cylinders, one per metric, each filling with a glossy coloured liquid
// up to its level. The liquid rises with a springy ease, its lighter top surface sloshes
// gently, bubbles drift up the glass and the percentage counts up above each tube.
// Hover a tube to lift it and read its value; drag to turn the row.
// Data is "Label:value, ..." with each value read against `max`.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function parseRows(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), value: Math.max(0, num(d.value)) }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), value: Math.max(0, num(i < 0 ? 0 : s.slice(i + 1))) }
    })
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// springy ease-out with a small overshoot
const pop = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
const easeOut = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// glass: a fresnel shader, nearly clear face-on and denser toward the silhouette, so the
// tube reads on a light background without relying on transmission (which software
// WebGL renders badly)
const glassVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const glassFrag = /* glsl */ `
  uniform vec3 uTint;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uEdge;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
    gl_FragColor = vec4(mix(uTint, uRim, f), clamp(uOpacity + f * uEdge, 0.0, 1.0));
  }
`
function GlassMaterial({ side, tint, rim, opacity, edge }) {
  const uniforms = useMemo(
    () => ({ uTint: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uOpacity: { value: 0 }, uEdge: { value: 0 } }),
    [],
  )
  uniforms.uTint.value.set(tint)
  uniforms.uRim.value.set(rim)
  uniforms.uOpacity.value = opacity
  uniforms.uEdge.value = edge
  return <shaderMaterial uniforms={uniforms} vertexShader={glassVert} fragmentShader={glassFrag} transparent depthWrite={false} side={side} toneMapped={false} />
}

// one tube: base puck, liquid column with a lighter top, glass walls, rim, ticks, bubbles, labels
function Tube({ t, R, H, baseH, gloss, glassOpacity, glassColor, rimColor, baseColor, bubbles, wobble, showTicks, hoverLift, progress, hov, setHov, labels, labelColor, textColor, mutedColor, halo, fontSize, bubbleGeo, tickColor, turnRad }) {
  const lift = useRef()
  const col = useRef()
  const top = useRef()
  const liqMat = useRef()
  const lab = useRef()
  const txt = useRef()
  const name = useRef()
  const bub = useRef([])
  const cur = useRef({ glow: 0, dim: 1, lift: 0, kick: 0, shown: '' })
  const active = hov === t.i
  const lr = R * 0.84
  const level = Math.max(0.001, t.frac * H)

  // bubbles cling to the liquid surface, all round it; the far ones hide behind the liquid
  const seeds = useMemo(
    () =>
      Array.from({ length: bubbles ? 8 : 0 }, (_, j) => {
        const s = Math.sin((t.i + 1) * 91.7 + j * 37.3) * 43758.5
        const r1 = s - Math.floor(s)
        const s2 = Math.sin((t.i + 1) * 12.9 + j * 78.2) * 24634.6
        const r2 = s2 - Math.floor(s2)
        return { a: j * 2.4 + r1 * 1.2, phase: r2, speed: 0.12 + r1 * 0.14, size: R * (0.05 + r2 * 0.06) }
      }),
    [bubbles, t.i, R],
  )

  useFrame((state, dt) => {
    const c = cur.current
    const f = 1 - Math.exp(-dt * 12)
    const k = clamp((progress.current - t.delay) / 0.6, 0, 1)
    const fill = pop(k)
    c.glow += ((active ? 1 : 0) - c.glow) * f
    c.dim += ((hov !== null && !active ? 0.4 : 1) - c.dim) * f
    c.lift += ((active ? hoverLift : 0) - c.lift) * f
    c.kick = Math.max(0, c.kick - dt * 0.8)
    if (active && c.glow < 0.15) c.kick = 1
    lift.current.position.y = c.lift
    const h = Math.max(0.001, level * fill)
    col.current.scale.y = h
    col.current.position.y = h / 2
    if (liqMat.current) liqMat.current.emissiveIntensity = c.glow * 0.18
    // the surface sloshes while filling, after a hover kick, and a touch at rest
    const time = state.clock.elapsedTime
    const amp = wobble * (0.025 + 0.16 * (1 - k) * k * 4 + 0.1 * c.kick)
    top.current.position.y = h
    top.current.rotation.x = Math.sin(time * 3.1 + t.i) * amp
    top.current.rotation.z = Math.cos(time * 2.4 + t.i * 1.7) * amp
    top.current.visible = h > 0.01
    for (let j = 0; j < seeds.length; j++) {
      const m = bub.current[j]
      if (!m) continue
      const s = seeds[j]
      const u = (s.phase + time * s.speed) % 1
      const y = 0.06 + u * Math.max(0, h - 0.14)
      const sc = s.size * Math.min(1, u * 6) * (1 - u ** 6) * (h > 0.25 ? 1 : 0)
      const a = s.a + Math.sin(time * 1.3 + j) * 0.05
      m.position.set(Math.sin(a) * lr, y, Math.cos(a) * lr)
      m.scale.setScalar(Math.max(0.0001, sc))
    }
    const op = String(clamp(k / 0.35, 0, 1) * c.dim)
    if (lab.current) lab.current.style.opacity = op
    if (name.current) name.current.style.opacity = String(clamp(k / 0.35, 0, 1) * (0.55 + 0.45 * c.dim))
    if (txt.current) {
      const s = t.fmtLabel(t.value * easeOut(k / 0.9))
      if (s !== c.shown) {
        c.shown = s
        txt.current.textContent = s
      }
    }
  })

  const handlers = {
    onPointerOver: (e) => { e.stopPropagation(); setHov(t.i); document.body.style.cursor = 'pointer' },
    onPointerOut: () => { setHov(null); document.body.style.cursor = '' },
    onClick: (e) => e.stopPropagation(),
  }
  const ticks = [0.25, 0.5, 0.75]
  const arc = (y, from, to) => Array.from({ length: 9 }, (_, j) => { const a = from + ((to - from) * j) / 8; return [Math.sin(a) * R * 1.004, y, Math.cos(a) * R * 1.004] })
  const topY = baseH + H

  return (
    <group position={[t.x, 0, 0]}>
      <group ref={lift}>
        {/* base puck with a rounded lip and a thin colour band */}
        <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[R * 1.22, R * 1.28, baseH, 48]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.35} clearcoat={gloss} clearcoatRoughness={0.25} envMapIntensity={0.6} />
        </mesh>
        <mesh position={[0, baseH, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[R * 1.2, Math.min(0.03, baseH * 0.25), 10, 48]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.3} clearcoat={gloss} envMapIntensity={0.6} />
        </mesh>
        <mesh position={[0, baseH * 0.42, 0]}>
          <cylinderGeometry args={[R * 1.255, R * 1.255, baseH * 0.16, 48, 1, true]} />
          <meshStandardMaterial color={t.color} roughness={0.4} />
        </mesh>

        {/* liquid: a unit-high column scaled to the level, open on top under a lighter surface */}
        <group position={[0, baseH, 0]}>
          <mesh ref={col} castShadow>
            <cylinderGeometry args={[lr, lr, 1, 48, 1, true]} />
            <meshPhysicalMaterial ref={liqMat} color={t.color} emissive={t.color} emissiveIntensity={0} roughness={0.25} clearcoat={gloss} clearcoatRoughness={0.12} envMapIntensity={0.7} side={THREE.DoubleSide} />
          </mesh>
          <group ref={top}>
            <mesh rotation-x={-Math.PI / 2}>
              <circleGeometry args={[lr * 1.01, 48]} />
              <meshPhysicalMaterial color={t.top} roughness={0.18} clearcoat={gloss} clearcoatRoughness={0.1} envMapIntensity={0.8} />
            </mesh>
            {/* meniscus: a soft lighter ring where the liquid meets the glass */}
            <mesh rotation-x={Math.PI / 2}>
              <torusGeometry args={[lr * 0.97, R * 0.045, 8, 48]} />
              <meshPhysicalMaterial color={t.meniscus} roughness={0.2} clearcoat={gloss} envMapIntensity={0.8} />
            </mesh>
          </group>
          {seeds.map((s, j) => (
            <mesh key={j} ref={(m) => (bub.current[j] = m)} geometry={bubbleGeo} renderOrder={2}>
              <meshPhysicalMaterial color="#ffffff" transparent opacity={0.55} roughness={0.1} clearcoat={1} envMapIntensity={1} depthWrite={false} />
            </mesh>
          ))}
        </group>

        {/* glass: back wall first, then the front wall over the liquid */}
        <mesh position={[0, baseH + H / 2 + 0.02, 0]} renderOrder={1}>
          <cylinderGeometry args={[R, R, H + 0.04, 64, 1, true]} />
          <GlassMaterial side={THREE.BackSide} tint={glassColor} rim={rimColor} opacity={glassOpacity * 0.6} edge={0.35} />
        </mesh>
        <mesh position={[0, baseH + H / 2 + 0.02, 0]} renderOrder={3} {...handlers}>
          <cylinderGeometry args={[R, R, H + 0.04, 64, 1, true]} />
          <GlassMaterial side={THREE.FrontSide} tint={glassColor} rim={rimColor} opacity={glassOpacity} edge={0.62} />
        </mesh>
        {/* specular streaks that sell the glass */}
        <mesh position={[0, baseH + H / 2 + 0.02, 0]} renderOrder={4}>
          <cylinderGeometry args={[R * 1.006, R * 1.006, H * 0.86, 16, 1, true, -0.95, 0.2]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.25 + 0.45 * gloss} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, baseH + H / 2 + 0.06, 0]} renderOrder={4}>
          <cylinderGeometry args={[R * 1.006, R * 1.006, H * 0.7, 8, 1, true, 0.62, 0.07]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.15 + 0.35 * gloss} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* rim at the top */}
        <mesh position={[0, topY + 0.04, 0]} rotation-x={Math.PI / 2} renderOrder={5}>
          <torusGeometry args={[R, R * 0.06, 10, 64]} />
          <meshPhysicalMaterial color={glassColor} transparent opacity={0.85} roughness={0.08} clearcoat={1} envMapIntensity={1.2} depthWrite={false} />
        </mesh>
        {showTicks &&
          ticks.map((q) => (
            <group key={q} renderOrder={4}>
              <Line points={arc(baseH + q * H, -0.6 - (q === 0.5 ? 0.25 : 0), -0.2)} color={tickColor} lineWidth={1.3} transparent opacity={0.8} depthWrite={false} />
            </group>
          ))}
      </group>

      {labels !== 'none' && (
        <Html position={[0, topY + 0.36 + R * 0.4, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={lab} style={{ opacity: 0, transform: 'translateY(-30%)',fontFamily: FONT, fontWeight: 700, fontSize, lineHeight: 1, letterSpacing: '-0.02em', whiteSpace: 'nowrap', userSelect: 'none', color: labelColor === 'slice' ? t.labelInk : textColor, textShadow: `0 0 3px ${halo}, 0 0 6px ${halo}` }}>
            <span ref={txt}>{t.fmtLabel(0)}</span>
          </div>
        </Html>
      )}
      <Html position={[Math.sin(turnRad) * (R * 1.28 + 0.3), -0.04, Math.cos(turnRad) * (R * 1.28 + 0.3)]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={name} style={{ opacity: 0, fontFamily: FONT, fontSize: Math.max(11, Math.round(fontSize * 0.5)), fontWeight: 600, color: active ? textColor : mutedColor, whiteSpace: 'nowrap', userSelect: 'none', textShadow: `0 0 3px ${halo}` }}>
          {t.label}
        </div>
      </Html>
      {active && (
        <Html position={[0, topY + 0.36 + R * 0.4 + hoverLift + (labels !== 'none' ? 0.62 : 0.2), 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
          <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
              {t.label}
            </div>
            <div style={{ opacity: 0.85 }}>
              <b>{t.fmtValue(t.value)}</b> of {t.fmtValue(t.max)} · {t.fmtPct(t.pct)}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// places the camera on the tilt / turn angles and backs it off until tubes and labels fit
// `lo`..`hi` is the world height range including the names below and the numbers above;
// `padTop` / `padBottom` are the pixels the HTML title and legend take
function Rig({ tilt, turn, width, depth, lo, hi, padTop, padBottom }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 0, 80) * Math.PI) / 180
    const a = (clamp(turn, -60, 60) * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const frac = clamp(1 - (padTop + padBottom + 16) / Math.max(1, size.height), 0.4, 1)
    // projected extents of the row from this angle, labels included
    const hExt = width * Math.cos(a) + depth * Math.abs(Math.sin(a)) + 0.8
    const vExt = (hi - lo) * Math.cos(e) + depth * Math.sin(e)
    const dW = (hExt / 2) * 1.06 / (tanH * aspect) + depth / 2
    const dH = (vExt / 2) * 1.08 / (tanH * frac) + depth / 2
    const d = Math.max(dW, dH)
    // aim a little above the middle so the row sits centred in the space under the title
    const shift = (((padTop - padBottom) / 2) / Math.max(1, size.height)) * 2 * tanH * d / Math.max(0.3, Math.cos(e))
    const cy = (lo + hi) / 2 + shift
    camera.position.set(Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(0, cy, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, cy, 0)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, width, depth, lo, hi, padTop, padBottom])
  return null
}

function Scene(p) {
  const { rows, max, tubeRadius, tubeHeight, gap, palette, animate, duration, autoRotate, fmtValue, fmtPct } = p
  const [hov, setHov] = useState(null)
  const n = Math.max(1, rows.length)
  const R = clamp(tubeRadius, 0.15, 1.2)
  const H = clamp(tubeHeight, 0.8, 6)
  const baseH = clamp(R * 0.42, 0.1, 0.3)
  const pitch = R * 2.56 + clamp(gap, 0, 3)
  const width = (n - 1) * pitch + R * 2.56
  const M = max > 0 ? max : 100

  const tubes = rows.map((r, i) => {
    const color = palette[i % palette.length]
    const pct = (r.value / M) * 100
    return {
      i,
      label: r.label,
      value: r.value,
      max: M,
      pct,
      frac: clamp(r.value / M, 0, 1),
      x: -((n - 1) * pitch) / 2 + i * pitch,
      delay: n > 1 ? (i / (n - 1)) * 0.36 : 0,
      color,
      top: mix(color, '#ffffff', 0.32),
      meniscus: mix(color, '#ffffff', 0.5),
      labelInk: mix(color, '#000000', 0.08),
      fmtLabel: p.labels === 'value' ? fmtValue : (v) => fmtPct((v / M) * 100),
      fmtValue,
      fmtPct,
    }
  })

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, p.data, max])
  const spin = useRef()
  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    if (autoRotate && spin.current && hov === null) spin.current.rotation.y += dt * 0.25
  })

  const bubbleGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 8), [])
  useEffect(() => () => bubbleGeo.dispose(), [bubbleGeo])
  // number size follows the room each tube gets on screen
  const { size } = useThree()
  const fontSize = clamp(Math.round((Math.min(size.width, size.height * 1.3) / n) * 0.3), 14, 30)

  return (
    <>
      <Rig tilt={p.tilt} turn={p.turn} width={width} depth={R * 2.6 + 0.6} lo={-0.45} hi={baseH + H + 1.0} padTop={p.title && p.subtitle ? 70 : p.title || p.subtitle ? 48 : 0} padBottom={p.showLegend ? 40 : 0} />
      <group ref={spin}>
        {tubes.map((t) => (
          <Tube
            key={t.i}
            t={t}
            R={R}
            H={H}
            baseH={baseH}
            gloss={p.gloss}
            glassOpacity={clamp(p.glassOpacity, 0, 1)}
            glassColor={p.glassColor}
            rimColor={p.rimColor}
            baseColor={p.baseColor}
            bubbles={p.bubbles}
            wobble={clamp(p.wobble, 0, 3)}
            showTicks={p.showTicks}
            hoverLift={p.hoverLift}
            progress={progress}
            hov={hov}
            setHov={setHov}
            labels={p.labels}
            labelColor={p.labelColor}
            textColor={p.textColor}
            mutedColor={p.mutedColor}
            tickColor={p.rimColor}
            turnRad={(clamp(p.turn, -60, 60) * Math.PI) / 180}
            halo={p.background}
            fontSize={fontSize}
            bubbleGeo={bubbleGeo}
          />
        ))}
      </group>
    </>
  )
}

export default function Cylinders3DChart({
  data = 'Design:82, Build:64, Test:45, Launch:28',
  title = 'Project progress',
  subtitle = 'Completion by phase',
  max = 100,
  tilt = 20,
  turn = -10,
  tubeRadius = 0.42,
  tubeHeight = 2.6,
  gap = 0.5,
  glassOpacity = 0.12,
  gloss = 0.7,
  bubbles = true,
  wobble = 1,
  showTicks = true,
  hoverLift = 0.25,
  labels = 'percent',
  labelColor = 'slice',
  showLegend = false,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1800,
  decimals = 0,
  prefix = '',
  suffix = '',
  color = '#ff9a2e',
  color2 = '#2f8fff',
  color3 = '#a93ce0',
  color4 = '#ef4a3a',
  color5 = '#14a89e',
  color6 = '#c49a12',
  glassColor = '#ffffff',
  rimColor = '#9aa3b5',
  baseColor = '#ffffff',
  background = '#f2f2f3',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const rows = useMemo(() => parseRows(data), [data])
  const palette = [color, color2, color3, color4, color5, color6]
  const d = clamp(Math.round(decimals), 0, 4)
  const f = (v) => v.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })
  const fmtValue = (v) => `${prefix}${f(v)}${suffix}`
  const fmtPct = (v) => `${f(v)}%`
  const M = max > 0 ? max : 100

  return (
    <div
      role="img"
      aria-label={`${title ? `${title}. ` : ''}3D cylinder progress chart. ${rows.map((r) => `${r.label}: ${fmtValue(r.value)} of ${fmtValue(M)} (${fmtPct((r.value / M) * 100)})`).join('; ')}`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 30, position: [0, 4, 10] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene {...{ rows, data, max, tubeRadius, tubeHeight, gap, glassOpacity, gloss, bubbles, wobble, showTicks, hoverLift, labels, labelColor, palette, animate, duration, autoRotate, glassColor, rimColor, baseColor, background, textColor, mutedColor, fmtValue, fmtPct, tilt, turn, title, subtitle, showLegend }} />
          {/* soft studio: a broad top light and two side strips for the glass streaks */}
          <Environment resolution={128}>
            <color attach="background" args={['#d9dadd']} />
            <Lightformer form="rect" intensity={1.3} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
            <Lightformer form="rect" intensity={1.3} position={[-6, 1, 3]} rotation-y={Math.PI / 2.4} scale={[2, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2.4} scale={[2, 6, 1]} />
          </Environment>
        </Suspense>
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 9, 6]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.32} scale={18} blur={2.4} far={2} />
        <OrbitControls makeDefault enabled={interactive} enablePan={false} enableZoom={false} minPolarAngle={(Math.PI / 180) * clamp(90 - tilt - 25, 5, 89)} maxPolarAngle={(Math.PI / 180) * clamp(90 - tilt + 20, 10, 92)} minAzimuthAngle={-1.1} maxAzimuthAngle={1.1} />
      </Canvas>
      {showLegend && (
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 18px', zIndex: 40, pointerEvents: 'none' }}>
          {rows.map((r, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: mutedColor, fontSize: 13, fontWeight: 600 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: palette[i % palette.length] }} />
              {r.label} {fmtPct((r.value / M) * 100)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
