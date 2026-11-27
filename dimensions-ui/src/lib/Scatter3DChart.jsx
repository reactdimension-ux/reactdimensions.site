import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Instance, Instances, Lightformer, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D scatter plot: glossy balls placed in an x / y / z box with a floor and two
// back walls that swap sides as you orbit, so they never block the view. Each ball can
// drop a line and a soft shadow to the floor, and a fourth value can set its size.
// Hover a ball for its values and guide lines out to all three walls; drag to orbit.
// Rows are "Name:x|y|z|size|group" (size and group optional), or leave `data` empty
// for a demo of clustered groups.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : NaN
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// springy ease-out with a small overshoot
const pop = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
function rng(seed) {
  let s = (Math.abs(Math.round(seed)) % 2147483646) + 1
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())

// tidy ticks covering lo..hi, widened outward to round numbers
function niceTicks(lo, hi, count = 4) {
  if (!(hi > lo)) hi = lo + 1
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
  const a = Math.floor(lo / step + 1e-9) * step
  const b = Math.ceil(hi / step - 1e-9) * step
  const ticks = []
  for (let t = a; t <= b + step * 1e-6; t += step) ticks.push(Math.abs(t) < step * 1e-6 ? 0 : t)
  return { lo: a, hi: b, ticks }
}
const tickFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function parsePoints(data, groupNames) {
  const groups = []
  const pts = String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => {
      const k = s.lastIndexOf(':')
      const name = k < 0 ? `#${i + 1}` : s.slice(0, k).trim()
      const parts = (k < 0 ? s : s.slice(k + 1)).split('|').map((x) => x.trim())
      const [x, y, z, size] = parts.slice(0, 4).map(num)
      // the group is the 5th part, or the 4th when that one isn't a number ("x|y|z|Group")
      const gName = parts[4] || (!Number.isFinite(size) && parts[3] ? parts[3] : '') || groupNames[0] || 'All'
      let g = groups.indexOf(gName)
      if (g < 0) g = groups.push(gName) - 1
      return { name, x, y, z, size: Number.isFinite(size) ? size : NaN, g }
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
  return { pts, groups }
}
// three loose clusters, each stretched along its own direction
function demoPoints(count, groupCount, seed, names) {
  const r = rng(seed)
  const G = clamp(Math.round(groupCount), 1, 6)
  const per = clamp(Math.round(count), 3, 200)
  const pts = []
  const groups = Array.from({ length: G }, (_, g) => names[g] ?? `Group ${g + 1}`)
  for (let g = 0; g < G; g++) {
    const c = [20 + r() * 60, 20 + r() * 60, 20 + r() * 60]
    const d = [gauss(r), gauss(r), gauss(r)]
    for (let i = 0; i < per; i++) {
      const t = gauss(r) * 9
      pts.push({
        name: `${groups[g].slice(0, 1).toUpperCase()}${i + 1}`,
        x: clamp(c[0] + d[0] * t + gauss(r) * 6, 0, 100),
        y: clamp(c[1] + d[1] * t + gauss(r) * 6, 0, 100),
        z: clamp(c[2] + d[2] * t + gauss(r) * 6, 0, 100),
        size: 10 + r() * 90,
        g,
      })
    }
  }
  return { pts, groups }
}

// floor + two back walls with grid lines and tick labels; the walls sit on whichever
// sides face away from the camera (sx, sz are +1 or -1)
function AxisBox({ S, T, map, labels, sides, wallColor, gridColor, mutedColor, textColor, fmt }) {
  const [SX, SY, SZ] = S
  const { sx, sz } = sides
  const wallX = sx * (SX / 2)
  const backZ = sz * (SZ / 2)
  const front = -backZ
  const near = -wallX
  const inX = wallX - sx * 0.004
  const inZ = backZ - sz * 0.004
  const segs = []
  T.x.forEach((v) => {
    const p = map.x(v)
    segs.push([p, 0.003, -SZ / 2], [p, 0.003, SZ / 2], [p, 0, inZ], [p, SY, inZ])
  })
  T.z.forEach((v) => {
    const p = map.z(v)
    segs.push([-SX / 2, 0.003, p], [SX / 2, 0.003, p], [inX, 0, p], [inX, SY, p])
  })
  T.y.forEach((v) => {
    const p = map.y(v)
    segs.push([-SX / 2, p, inZ], [SX / 2, p, inZ], [inX, p, -SZ / 2], [inX, p, SZ / 2])
  })
  const tick = { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: mutedColor, whiteSpace: 'nowrap', userSelect: 'none' }
  const title = { fontFamily: FONT, fontSize: 12, fontWeight: 700, color: textColor, whiteSpace: 'nowrap', userSelect: 'none' }
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[SX, SZ]} />
        <meshStandardMaterial color={wallColor} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, SY / 2, backZ]}>
        <planeGeometry args={[SX, SY]} />
        <meshStandardMaterial color={wallColor} roughness={1} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh position={[wallX, SY / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[SZ, SY]} />
        <meshStandardMaterial color={wallColor} roughness={1} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <Line segments points={segs} color={gridColor} lineWidth={1} />
      {T.x.map((v, i) => (
        <Html key={`x${i}`} position={[map.x(v), 0, front - sz * 0.32]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={tick}>{fmt.x(v)}</div>
        </Html>
      ))}
      {T.z.map((v, i) => (
        <Html key={`z${i}`} position={[near - sx * 0.36, 0, map.z(v)]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={tick}>{fmt.z(v)}</div>
        </Html>
      ))}
      {T.y.map((v, i) => (
        <Html key={`y${i}`} position={[wallX + sx * 0.3, map.y(v), front]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={tick}>{fmt.y(v)}</div>
        </Html>
      ))}
      {labels.x && (
        <Html position={[0, 0, front - sz * 0.75]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={title}>{labels.x}</div>
        </Html>
      )}
      {labels.z && (
        <Html position={[near - sx * 0.85, 0, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={title}>{labels.z}</div>
        </Html>
      )}
      {labels.y && (
        <Html position={[wallX + sx * 0.3, SY + 0.38, front]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div style={title}>{labels.y}</div>
        </Html>
      )}
    </group>
  )
}

// camera on the tilt / turn angles, backed off to fit the box and its labels
function Rig({ tilt, turn, S }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 5, 80) * Math.PI) / 180
    const a = (turn * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const rad = 0.5 * Math.hypot(S[0] + 1.4, S[1] + 0.8, S[2] + 1.4)
    const d = (rad * 1.02) / (tanH * Math.min(aspect, 1.15))
    const cy = S[1] * 0.42
    camera.position.set(Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(0, cy, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, cy, 0)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, S[0], S[1], S[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function Ball({ p, i, n, progress, hov, setHov }) {
  const ref = useRef()
  const cur = useRef(0)
  useFrame((_, dt) => {
    if (!ref.current) return
    const k = clamp((progress.current - (n > 1 ? (i / (n - 1)) * 0.5 : 0)) / 0.5, 0, 1)
    cur.current += ((hov === i ? 1.6 : hov >= 0 ? 0.85 : 1) - cur.current) * (1 - Math.exp(-dt * 14))
    ref.current.scale.setScalar(Math.max(0.0001, p.r * pop(k) * cur.current))
  })
  return (
    <Instance
      ref={ref}
      position={[p.px, p.py, p.pz]}
      color={p.color}
      onPointerOver={(e) => { e.stopPropagation(); setHov(i); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHov(-1); document.body.style.cursor = '' }}
    />
  )
}

function Scene(props) {
  const { pts, groups, palette, S, xLabel, yLabel, zLabel, xSuffix, ySuffix, zSuffix, pointSize, sizeBy, dropLines, floorShadows, gloss, animate, duration, autoRotate, interactive, wallColor, gridColor, textColor, mutedColor, tilt, turn } = props
  const [hov, setHov] = useState(-1)
  const [sides, setSides] = useState({ sx: 1, sz: -1 })
  const [SX, SY, SZ] = S

  const ext = (k) => {
    const v = pts.map((q) => q[k])
    return niceTicks(Math.min(...v), Math.max(...v))
  }
  const TX = ext('x')
  const TY = ext('y')
  const TZ = ext('z')
  const map = {
    x: (v) => ((v - TX.lo) / (TX.hi - TX.lo) - 0.5) * SX,
    y: (v) => ((v - TY.lo) / (TY.hi - TY.lo)) * SY,
    z: (v) => ((v - TZ.lo) / (TZ.hi - TZ.lo) - 0.5) * SZ,
  }
  const sizes = pts.map((q) => q.size).filter(Number.isFinite)
  const sLo = sizes.length ? Math.min(...sizes) : 0
  const sHi = sizes.length ? Math.max(...sizes) : 1
  const base = 0.06 * pointSize
  const balls = pts.map((q) => {
    const t = sizeBy && Number.isFinite(q.size) && sHi > sLo ? (q.size - sLo) / (sHi - sLo) : 0.35
    return { ...q, px: map.x(q.x), py: map.y(q.y), pz: map.z(q.z), r: sizeBy ? base * (0.75 + Math.sqrt(t) * 1.25) : base, color: palette[q.g % palette.length] }
  })

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, props.data, props.seed, props.count, props.groups])
  const dropMat = useRef()
  const shadowRefs = useRef([])
  useFrame(({ camera }) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    const sx = camera.position.x > 0 ? -1 : 1
    const sz = camera.position.z > 0 ? -1 : 1
    if (sx !== sides.sx || sz !== sides.sz) setSides({ sx, sz })
    if (dropMat.current) dropMat.current.opacity = 0.45 * clamp((progress.current - 0.55) / 0.4, 0, 1)
  })

  const drops = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const a = new Float32Array(balls.length * 6)
    balls.forEach((b, i) => a.set([b.px, b.py, b.pz, b.px, 0.004, b.pz], i * 6))
    g.setAttribute('position', new THREE.BufferAttribute(a, 3))
    return g
  }, [balls.map((b) => `${b.px},${b.py},${b.pz}`).join(';')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => drops.dispose(), [drops])

  const h = hov >= 0 ? balls[hov] : null
  const wallX = sides.sx * (SX / 2)
  const backZ = sides.sz * (SZ / 2)
  const f = (v, s) => `${tickFmt.format(v)}${s}`

  return (
    <>
      <Rig tilt={tilt} turn={turn} S={S} />
      <OrbitControls makeDefault enabled={interactive} enablePan={false} enableZoom={false} autoRotate={autoRotate && hov < 0} autoRotateSpeed={0.6} minPolarAngle={Math.PI * 0.12} maxPolarAngle={Math.PI * 0.48} />
      <AxisBox
        S={S}
        T={{ x: TX.ticks, y: TY.ticks, z: TZ.ticks }}
        map={map}
        labels={{ x: xLabel, y: yLabel, z: zLabel }}
        sides={sides}
        wallColor={wallColor}
        gridColor={gridColor}
        mutedColor={mutedColor}
        textColor={textColor}
        fmt={{ x: (v) => f(v, xSuffix), y: (v) => f(v, ySuffix), z: (v) => f(v, zSuffix) }}
      />
      {dropLines && (
        <lineSegments geometry={drops}>
          <lineBasicMaterial ref={dropMat} color={mutedColor} transparent opacity={0} />
        </lineSegments>
      )}
      {floorShadows &&
        balls.map((b, i) => (
          <mesh key={`s${i}`} ref={(el) => (shadowRefs.current[i] = el)} position={[b.px, 0.006, b.pz]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[b.r * 0.9, 20]} />
            <meshBasicMaterial color={textColor} transparent opacity={hov >= 0 && hov !== i ? 0.04 : 0.09} depthWrite={false} />
          </mesh>
        ))}
      <Instances limit={Math.max(1, balls.length)} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <meshPhysicalMaterial roughness={0.35} clearcoat={gloss} clearcoatRoughness={0.15} envMapIntensity={0.6} />
        {balls.map((b, i) => (
          <Ball key={i} p={b} i={i} n={balls.length} progress={progress} hov={hov} setHov={setHov} />
        ))}
      </Instances>
      {h && (
        <>
          <Line points={[[h.px, h.py, h.pz], [h.px, 0.005, h.pz]]} color={h.color} lineWidth={1.6} dashed dashSize={0.06} gapSize={0.05} />
          <Line points={[[h.px, h.py, h.pz], [h.px, h.py, backZ - sides.sz * 0.006]]} color={h.color} lineWidth={1.6} dashed dashSize={0.06} gapSize={0.05} />
          <Line points={[[h.px, h.py, h.pz], [wallX - sides.sx * 0.006, h.py, h.pz]]} color={h.color} lineWidth={1.6} dashed dashSize={0.06} gapSize={0.05} />
          <Html position={[h.px, h.py + h.r * 1.6 + 0.25, h.pz]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
            <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i style={{ width: 8, height: 8, borderRadius: '50%', background: h.color }} />
                {h.name}
                {groups.length > 1 && <span style={{ opacity: 0.7, fontWeight: 500 }}>· {groups[h.g]}</span>}
              </div>
              <div style={{ opacity: 0.85 }}>
                {xLabel || 'x'} {f(h.x, xSuffix)} · {yLabel || 'y'} {f(h.y, ySuffix)} · {zLabel || 'z'} {f(h.z, zSuffix)}
              </div>
              {Number.isFinite(h.size) && sizeBy && <div style={{ opacity: 0.7 }}>size {tickFmt.format(h.size)}</div>}
            </div>
          </Html>
        </>
      )}
    </>
  )
}

export default function Scatter3DChart({
  data = '',
  count = 28,
  groups = 3,
  seed = 3,
  names = 'Basic, Plus, Pro',
  title = 'Plans in three dimensions',
  subtitle = 'Price, usage and satisfaction. Size: revenue. Drag to orbit',
  xLabel = 'Price',
  yLabel = 'Usage',
  zLabel = 'Satisfaction',
  xSuffix = '',
  ySuffix = '',
  zSuffix = '',
  pointSize = 1,
  sizeBy = true,
  dropLines = true,
  floorShadows = true,
  tilt = 26,
  turn = 35,
  boxHeight = 2.6,
  gloss = 0.6,
  autoRotate = true,
  interactive = true,
  showLegend = true,
  animate = true,
  duration = 1600,
  color = '#2f8fff',
  color2 = '#ef4a3a',
  color3 = '#14a89e',
  color4 = '#ff9a2e',
  color5 = '#a93ce0',
  color6 = '#c49a12',
  background = '#f2f2f3',
  wallColor = '#ffffff',
  gridColor = '#dfe2ea',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const nm = useMemo(() => String(names).split(',').map((s) => s.trim()).filter(Boolean), [names])
  const { pts, groups: gNames } = useMemo(() => (String(data).trim() ? parsePoints(data, nm) : demoPoints(count, groups, seed, nm)), [data, count, groups, seed, nm])
  const palette = [color, color2, color3, color4, color5, color6]
  const S = [4, clamp(boxHeight, 1, 4), 4]

  return (
    <div
      role="img"
      aria-label={`${title}. 3D scatter plot of ${pts.length} points${gNames.length > 1 ? ` in ${gNames.length} groups (${gNames.join(', ')})` : ''}, ${xLabel} by ${yLabel} by ${zLabel}.`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [6, 5, 8] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene {...{ pts, groups: gNames, palette, S, xLabel, yLabel, zLabel, xSuffix, ySuffix, zSuffix, pointSize, sizeBy, dropLines, floorShadows, gloss, animate, duration, autoRotate, interactive, wallColor, gridColor, textColor, mutedColor, tilt, turn, data, seed, count }} />
          <Environment resolution={128}>
            <color attach="background" args={['#d9dadd']} />
            <Lightformer form="rect" intensity={1.3} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[-6, 1, 3]} rotation-y={Math.PI / 2.4} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2.4} scale={[3, 6, 1]} />
          </Environment>
        </Suspense>
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 9, 6]} intensity={0.9} />
      </Canvas>
      {showLegend && gNames.length > 1 && (
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 18px', zIndex: 40, pointerEvents: 'none' }}>
          {gNames.map((g, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: mutedColor, fontSize: 13, fontWeight: 600 }}>
              <i style={{ width: 10, height: 10, borderRadius: '50%', background: palette[i % palette.length] }} />
              {g}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
