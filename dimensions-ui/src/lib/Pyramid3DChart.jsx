import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D layered pyramid (or funnel): a cone or square pyramid cut into glossy
// bands with a small gap between them, seen from a slightly raised camera. Layers
// drop into place from the bottom up, each band has its number on the front, and
// big values sit in a column on the right at the end of dotted leader lines.
// Hover a layer to slide it out and see its value; drag to turn the shape.
// Data is "Label:value", listed from the top layer down.

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

const HT = 3.4 // overall height
const RB = 2 // base radius (to the corners, for the square pyramid)

function Layer({ L, shape, gloss, progress, hov, setHov, slide, showNumbers, numberColor }) {
  const sides = shape === 'pyramid' ? 4 : 72
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(Math.max(0.001, L.rTop), L.rBot, L.h, sides, 1, false, shape === 'pyramid' ? Math.PI / 4 : 0)
    g.translate(0, L.h / 2, 0)
    return g
  }, [L.rTop, L.rBot, L.h, sides, shape])
  useEffect(() => () => geo.dispose(), [geo])
  const grp = useRef()
  const mat = useRef()
  const cur = useRef({ out: 0, glow: 0 })
  const active = hov === L.i

  useFrame((_, dt) => {
    const k = clamp((progress.current - L.delay) / 0.5, 0, 1)
    const c = cur.current
    const f = 1 - Math.exp(-dt * 12)
    c.out += ((active ? slide : 0) - c.out) * f
    c.glow += ((active ? 1 : 0) - c.glow) * f
    // drop in from above, landing with a small bounce
    grp.current.position.set(c.out, L.y0 + (1 - pop(k)) * 2.6, 0)
    const s = Math.max(0.001, Math.min(1, k * 3))
    grp.current.scale.set(s, s, s)
    if (mat.current) mat.current.emissiveIntensity = c.glow * 0.2
  })

  // the front face sits a little nearer for a cone than for a square pyramid's flat face
  const rMid = (L.rTop + L.rBot) / 2
  const faceZ = shape === 'pyramid' ? rMid * Math.SQRT1_2 : rMid

  return (
    <group ref={grp}>
      <mesh
        geometry={geo}
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHov(L.i); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHov(-1); document.body.style.cursor = '' }}
      >
        <meshPhysicalMaterial ref={mat} color={L.color} emissive={L.color} emissiveIntensity={0} roughness={0.42} envMapIntensity={0.55} clearcoat={gloss} clearcoatRoughness={0.2} flatShading={shape === 'pyramid'} />
      </mesh>
      {showNumbers && L.h > 0.3 && rMid > 0.35 && (
        <Html position={[0, L.h / 2, faceZ + 0.02]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: numberColor, letterSpacing: '0.02em', userSelect: 'none', textShadow: '0 1px 2px #0003' }}>{String(L.i + 1).padStart(2, '0')}</div>
        </Html>
      )}
    </group>
  )
}

// places the camera and backs it off until the shape and the label column fit
function Rig({ tilt, turn, left, right, labels }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 0, 60) * Math.PI) / 180
    const a = (clamp(turn, -50, 50) * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const half = (right - left) / 2
    const cx = (left + right) / 2
    // leave room at the top for the HTML title
    const vHalf = HT / 2 + 0.75
    const d = Math.max(half / (tanH * aspect), vHalf / tanH) * 1.1
    const cy = HT / 2 + 0.15
    camera.position.set(cx + Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(cx, cy, 0)
    camera.updateProjectionMatrix()
    // orbit round the same point the camera looks at, or the controls would re-aim it
    if (controls) {
      controls.target.set(cx, cy, 0)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, left, right, labels])
  return null
}

function Scene(p) {
  const { rows, mode, inverted, shape, gap, gloss, palette, labels, labelColor, showLeaders, showNumbers, animate, duration, autoRotate, slide, textColor, mutedColor, fmt } = p
  const [hov, setHov] = useState(-1)
  const n = Math.max(1, rows.length)
  const total = rows.reduce((a, r) => a + r.value, 0) || 1

  // band heights from the top down: equal, or by value (with a floor so tiny layers stay visible)
  const share = rows.map((r) => (mode === 'value' ? Math.max(r.value / total, 0.07) : 1 / n))
  const sum = share.reduce((a, v) => a + v, 0) || 1
  const g = clamp(gap, 0, 0.3)
  const neck = 0.16 // the funnel's narrowest radius, as a share of the base
  const rAt = (y) => (inverted ? RB * (neck + (1 - neck) * (y / HT)) : RB * (1 - y / HT))
  let yTop = HT
  const layers = rows.map((r, i) => {
    const slot = (share[i] / sum) * HT
    const yBot = yTop - slot
    const y0 = yBot + (i < n - 1 ? g / 2 : 0)
    const y1 = yTop - (i > 0 ? g / 2 : 0)
    yTop = yBot
    const L = { ...r, i, y0, h: Math.max(0.02, y1 - y0), rTop: rAt(y1), rBot: rAt(y0), color: palette[i % palette.length], delay: n > 1 ? ((n - 1 - i) / (n - 1)) * 0.5 : 0 }
    L.yc = y0 + L.h / 2
    return L
  })
  const edge = (L) => {
    const r = (L.rTop + L.rBot) / 2
    return shape === 'pyramid' ? r * Math.SQRT1_2 : r
  }
  const labX = RB * (shape === 'pyramid' ? Math.SQRT1_2 : 1) + 0.7
  // label heights: at each layer's middle, pushed apart top-down so thin layers never overlap,
  // then lifted back up if the bottom one ends up below the floor
  const MIN_GAP = 0.64
  const labY = []
  layers.forEach((L, i) => (labY[i] = i === 0 ? L.yc : Math.min(L.yc, labY[i - 1] - MIN_GAP)))
  const under = Math.max(0, 0.15 - (labY[n - 1] ?? 0.15))
  for (let i = 0; i < n; i++) labY[i] += under

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, p.data, mode, inverted, shape])
  const spin = useRef()
  const labRefs = useRef([])
  const dims = useRef([])
  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    if (autoRotate && spin.current && hov < 0) spin.current.rotation.y += dt * 0.3
    const f = 1 - Math.exp(-dt * 12)
    layers.forEach((L, i) => {
      const el = labRefs.current[i]
      if (!el) return
      const k = clamp((progress.current - L.delay * 0.7 - 0.3) / 0.3, 0, 1)
      dims.current[i] = (dims.current[i] ?? 1) + ((hov >= 0 && hov !== i ? 0.4 : 1) - (dims.current[i] ?? 1)) * f
      el.style.opacity = String(k * dims.current[i])
    })
  })

  return (
    <>
      <Rig tilt={p.tilt} turn={p.turn} left={-RB - 0.3} right={labels === 'none' ? RB + 0.3 : labX + 2.1} labels={labels} />
      <group ref={spin}>
        {layers.map((L) => (
          <Layer key={L.i} L={L} shape={shape} gloss={gloss} progress={progress} hov={hov} setHov={setHov} slide={slide} showNumbers={showNumbers} numberColor="#ffffff" />
        ))}
      </group>
      {labels !== 'none' &&
        layers.map((L, i) => (
          <group key={`l${i}`}>
            {showLeaders && (
              <>
                <Line points={Math.abs(labY[i] - L.yc) < 0.01 ? [[edge(L) + 0.12, L.yc, 0], [labX - 0.08, L.yc, 0]] : [[edge(L) + 0.12, L.yc, 0], [labX - 0.4, L.yc, 0], [labX - 0.08, labY[i], 0]]} color={mutedColor} lineWidth={1.4} dashed dashSize={0.05} gapSize={0.06} transparent opacity={0.8} />
                <mesh position={[labX - 0.04, labY[i], 0]}>
                  <sphereGeometry args={[0.055, 16, 12]} />
                  <meshBasicMaterial color={L.color} />
                </mesh>
              </>
            )}
            <Html position={[labX + 0.16, labY[i], 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div ref={(el) => (labRefs.current[i] = el)} style={{ opacity: 0, transform: 'translate(8px, -50%)', fontFamily: FONT, whiteSpace: 'nowrap', userSelect: 'none' }}>
                <div style={{ color: labelColor === 'layer' ? L.color : textColor, fontWeight: 700, fontSize: 26, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {labels === 'percent' ? `${((L.value / total) * 100).toFixed(p.decimals)}%` : fmt(L.value)}
                </div>
                <div style={{ color: hov === i ? textColor : mutedColor, fontSize: 13, fontWeight: 600, marginTop: 3 }}>{L.label}</div>
              </div>
            </Html>
          </group>
        ))}
      {hov >= 0 && layers[hov] && (
        <Html position={[slide, layers[hov].y0 + layers[hov].h + 0.3, 0]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
          <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
            <div style={{ fontWeight: 700 }}>{layers[hov].label}</div>
            <div style={{ opacity: 0.8 }}>
              {fmt(layers[hov].value)} · {((layers[hov].value / total) * 100).toFixed(1)}%
            </div>
          </div>
        </Html>
      )}
    </>
  )
}

export default function Pyramid3DChart({
  data = 'Vision:10, Strategy:20, Tactics:30, Tasks:40',
  title = 'Planning pyramid',
  subtitle = 'Share of team time by layer',
  shape = 'cone',
  mode = 'equal',
  inverted = false,
  tilt = 16,
  turn = 0,
  gap = 0.1,
  gloss = 0.6,
  slide = 0.35,
  labels = 'value',
  labelColor = 'layer',
  showLeaders = true,
  showNumbers = true,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1500,
  decimals = 0,
  prefix = '',
  suffix = '%',
  color = '#2f8fff',
  color2 = '#ef4a3a',
  color3 = '#14a89e',
  color4 = '#ff9a2e',
  color5 = '#a93ce0',
  color6 = '#c49a12',
  background = '#f2f2f3',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const rows = useMemo(() => parseRows(data).filter((r) => r.label || r.value), [data])
  const total = rows.reduce((a, r) => a + r.value, 0) || 1
  const palette = [color, color2, color3, color4, color5, color6]
  const d = clamp(Math.round(decimals), 0, 4)
  const fmt = (v) => `${prefix}${v.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`

  return (
    <div
      role="img"
      aria-label={`${title}. 3D ${inverted ? 'funnel' : 'pyramid'} chart, top to bottom. ${rows.map((r) => `${r.label}: ${fmt(r.value)} (${((r.value / total) * 100).toFixed(1)} percent)`).join('; ')}`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [0, 3, 10] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene {...{ rows, data, mode, inverted, shape, gap, gloss, palette, labels, labelColor, showLeaders, showNumbers, animate, duration, autoRotate, slide, textColor, mutedColor, fmt, decimals: d, tilt, turn }} />
          {/* soft studio: a broad top light, side strips so each band shades round */}
          <Environment resolution={128}>
            <color attach="background" args={['#d9dadd']} />
            <Lightformer form="rect" intensity={1.3} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[-6, 1, 3]} rotation-y={Math.PI / 2.4} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2.4} scale={[3, 6, 1]} />
          </Environment>
        </Suspense>
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 8, 6]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.32} scale={10} blur={2.4} far={2} />
        <OrbitControls makeDefault enabled={interactive} enablePan={false} enableZoom={false} minPolarAngle={Math.PI * 0.25} maxPolarAngle={Math.PI * 0.52} minAzimuthAngle={-0.9} maxAzimuthAngle={0.9} />
      </Canvas>
    </div>
  )
}

