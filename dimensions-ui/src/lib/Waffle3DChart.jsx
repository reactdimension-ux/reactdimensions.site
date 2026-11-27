import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D waffle chart: a grid of glossy rounded cubes (10×10 by default), one cube
// per cell. Cells fill in reading order by category; each category's cubes rise out of
// the floor in a diagonal wave with a springy pop, and the cells nobody owns stay as
// thin flat tiles. Big percentage labels float beside the grid. Hover a cube and its
// whole category lifts while the rest dims; drag to turn the chart.
// Data is "Label:value, Label:value". With `total` set, values are out of that total
// and the rest of the grid is the remainder; with `total` 0 the categories fill it.

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
    .filter((r) => r.value > 0)
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// springy ease-out with a small overshoot
const pop = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// a rounded cube: a rounded square in the floor plane, extruded up by h with a bevel on
// the top and bottom edges. The base sits on y = 0. Group 0 = caps, group 1 = walls.
function cubeGeometry(s, h, bevel) {
  const b = Math.max(0, Math.min(bevel, s * 0.3, h * 0.3))
  const w = s / 2 - b
  const cr = Math.min(w * 0.9, Math.max(0.004, b * 0.8 + s * 0.04))
  const sh = new THREE.Shape()
  sh.moveTo(-w + cr, -w)
  sh.lineTo(w - cr, -w)
  sh.absarc(w - cr, -w + cr, cr, -Math.PI / 2, 0, false)
  sh.lineTo(w, w - cr)
  sh.absarc(w - cr, w - cr, cr, 0, Math.PI / 2, false)
  sh.lineTo(-w + cr, w)
  sh.absarc(-w + cr, w - cr, cr, Math.PI / 2, Math.PI, false)
  sh.lineTo(-w, -w + cr)
  sh.absarc(-w + cr, -w + cr, cr, Math.PI, Math.PI * 1.5, false)
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(0.004, h - b * 2),
    curveSegments: 5,
    bevelEnabled: b > 0.002,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 4,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, b, 0)
  return g
}

// largest-remainder rounding: whole cells per category that add up exactly
function allocate(values, total, N) {
  const sum = values.reduce((a, v) => a + v, 0)
  if (!sum) return values.map(() => 0)
  const T = Math.max(total > 0 ? total : sum, sum)
  const raw = values.map((v) => (v / T) * N)
  const base = raw.map(Math.floor)
  let left = Math.round((sum / T) * N) - base.reduce((a, b) => a + b, 0)
  raw
    .map((r, i) => [r - Math.floor(r), i])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (left > 0) {
        base[i]++
        left--
      }
    })
  return base
}

// one category (or the remainder): an instanced mesh of identical cubes
function Cubes({ id, cells, size, h, tileH, color, background, gloss, bevel, progress, wave, hov, setHov, lift, flat }) {
  const geo = useMemo(() => cubeGeometry(size, h, bevel), [size, h, bevel])
  const mats = useMemo(() => {
    const top = new THREE.MeshPhysicalMaterial({ color, roughness: flat ? 0.6 : 0.4, envMapIntensity: 0.55, clearcoat: flat ? gloss * 0.4 : gloss, clearcoatRoughness: 0.18, emissive: color, emissiveIntensity: 0 })
    const side = new THREE.MeshPhysicalMaterial({ color: mix(color, '#000000', 0.18), roughness: 0.5, envMapIntensity: 0.5, clearcoat: gloss * 0.6, clearcoatRoughness: 0.25, emissive: color, emissiveIntensity: 0 })
    return [top, side]
  }, [color, gloss, flat])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  const cols = useMemo(() => {
    const dimTo = new THREE.Color(background)
    return [color, mix(color, '#000000', 0.18)].map((c) => ({ base: new THREE.Color(c), dim: new THREE.Color(c).lerp(dimTo, 0.62) }))
  }, [color, background])

  const ref = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cur = useRef({ up: 0, dim: 0, glow: 0 })
  const active = hov?.id === id
  const tileRatio = Math.min(1, tileH / h)

  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    const c = cur.current
    const f = 1 - Math.exp(-dt * 12)
    c.up += ((active ? lift : 0) - c.up) * f
    c.dim += ((hov && !active ? 1 : 0) - c.dim) * f
    c.glow += ((active ? 1 : 0) - c.glow) * f
    const p = progress.current
    const appear = pop(clamp(p / 0.16, 0, 1))
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      let sy
      if (flat) sy = appear
      else {
        const k = clamp((p - 0.1 - cell.t * wave * 0.9) / Math.max(0.05, 0.9 - wave * 0.9), 0, 1)
        sy = tileRatio * appear + (1 - tileRatio) * pop(k)
      }
      dummy.position.set(cell.x, c.up, cell.z)
      dummy.scale.set(1, Math.max(0.001, sy), 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    m.boundingSphere = null
    mats.forEach((mat, j) => {
      mat.color.copy(cols[j].base).lerp(cols[j].dim, c.dim)
      mat.emissiveIntensity = c.glow * 0.16
    })
  })

  const pick = (e) => {
    e.stopPropagation()
    const cell = cells[e.instanceId]
    if (!cell) return
    document.body.style.cursor = 'pointer'
    if (hov?.id !== id || hov.cell !== e.instanceId) setHov({ id, cell: e.instanceId, x: cell.x, z: cell.z, h: flat ? tileH : h })
  }

  return (
    <instancedMesh
      key={cells.length}
      ref={ref}
      args={[geo, mats, cells.length]}
      castShadow={!flat}
      receiveShadow
      frustumCulled={false}
      onPointerOver={pick}
      onPointerMove={pick}
      onPointerOut={() => {
        setHov(null)
        document.body.style.cursor = ''
      }}
    />
  )
}

// places the camera on the tilt / turn angles and backs it off to fit the grid and labels
function Rig({ tilt, turn, span, height, cy }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 10, 85) * Math.PI) / 180
    const a = (clamp(turn, -60, 60) * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const rad = 0.5 * Math.hypot(span[0] + 0.5, span[1] + 0.5, height + 0.5)
    // fit the width, and the height too, leaving room for the title and the legend
    const vert = 0.5 * ((span[1] + 0.4) * Math.sin(e) + (height + 0.3) * Math.cos(e))
    const d = Math.max((rad * 0.98) / (tanH * Math.min(aspect, 1.3)), vert / (tanH * 0.62))
    camera.position.set(Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(0, cy, 0.15)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, cy, 0.15)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, span[0], span[1], height, cy]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function Scene(p) {
  const { cats, remainder, C, R, gap, cubeHeight, heightBy, tileHeight, showRemainder, bevel, gloss, wave, hoverLift, palette, remainderColor, background, textColor, mutedColor, labels, labelColor, animate, duration, autoRotate, hov, setHov, fmt, pctFmt } = p
  const { size } = useThree()
  const pitch = 0.5
  const cube = pitch * (1 - clamp(gap, 0, 0.6))
  const W = C * pitch
  const D = R * pitch
  const maxShare = Math.max(1e-9, ...cats.map((c) => c.value))
  const hOf = (c) => (heightBy === 'value' ? cubeHeight * (0.3 + 0.9 * (c.value / maxShare)) : cubeHeight)
  const H = Math.max(tileHeight, ...cats.map(hOf))
  const tileH = clamp(tileHeight, 0.01, cubeHeight)

  // labels float in a column to the right of the grid; on narrow canvases there is no room
  // beside it, so they move into the HTML legend instead
  const narrow = size.width < 560 || size.width / Math.max(1, size.height) < 1.05
  const { onNarrow } = p
  useEffect(() => onNarrow(narrow), [narrow, onNarrow])
  const showLabels = labels !== 'none' && cats.length > 0 && !narrow
  const LW = showLabels ? 3.0 : 0
  const offX = -LW / 2

  // 0 -> 1 over `duration`, restarted when the data or grid changes
  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, p.data, C, R, p.fillOrder, p.total, heightBy])
  const spin = useRef()
  const labRefs = useRef([])
  const dims = useRef([])
  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    if (autoRotate && spin.current && !hov) spin.current.rotation.y += dt * 0.25
    const f = 1 - Math.exp(-dt * 12)
    const n = cats.length
    labRefs.current.forEach((el, i) => {
      if (!el) return
      dims.current[i] = (dims.current[i] ?? 1) + ((hov && hov.id !== i ? 0.4 : 1) - (dims.current[i] ?? 1)) * f
      const start = 0.42 + (n > 1 ? (i / (n - 1)) * 0.28 : 0)
      el.style.opacity = String(clamp((progress.current - start) / 0.3, 0, 1) * dims.current[i])
    })
  })

  const hovCat = hov ? (hov.id === 'rem' ? remainder : cats[hov.id]) : null
  const big = (c) => (labels === 'value' ? fmt(c.value) : pctFmt(c.pct))
  const fs = cats.length <= 3 ? 36 : cats.length <= 4 ? 30 : 24

  return (
    <>
      <Rig tilt={p.tilt} turn={p.turn} span={[W + LW, D]} height={H} cy={H * 0.25} />
      <group ref={spin}>
        <group position={[offX, 0, 0]}>
          {cats.map((c, i) =>
            c.cells.length ? (
              <Cubes key={`c${i}-${c.cells.length}`} id={i} cells={c.cells} size={cube} h={hOf(c)} tileH={tileH} color={palette[i % palette.length]} background={background} gloss={gloss} bevel={bevel} progress={progress} wave={wave} hov={hov} setHov={setHov} lift={hoverLift} />
            ) : null,
          )}
          {showRemainder && remainder.cells.length > 0 && (
            <Cubes key={`r-${remainder.cells.length}`} id="rem" cells={remainder.cells} size={cube} h={tileH} tileH={tileH} color={remainderColor} background={background} gloss={gloss} bevel={Math.min(bevel, tileH * 0.3)} progress={progress} wave={0} hov={hov} setHov={setHov} lift={hoverLift * 0.4} flat />
          )}
          {showLabels && (
            <Html position={[W / 2 + 1.05, 0, D * 0.06]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  transform: 'translate(0, -50%)',
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridTemplateRows: `repeat(${Math.min(cats.length, 3)}, auto)`,
                  gap: '12px 22px',
                  fontFamily: FONT,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {cats.map((c, i) => (
                  <div key={i} ref={(el) => (labRefs.current[i] = el)} style={{ opacity: 0 }}>
                    <div style={{ color: labelColor === 'slice' ? palette[i % palette.length] : textColor, fontWeight: 600, lineHeight: 1, fontSize: fs, letterSpacing: '-0.02em' }}>
                      {labels === 'percent' ? (
                        <>
                          {c.pct.toFixed(p.decimals)}
                          <span style={{ fontSize: fs * 0.62, marginLeft: 2 }}>%</span>
                        </>
                      ) : (
                        big(c)
                      )}
                    </div>
                    <div style={{ color: mutedColor, fontSize: 12, fontWeight: 600, marginTop: 3 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </Html>
          )}
          {hov && hovCat && (
            <Html position={[hov.x, hov.h + (hov.id === 'rem' ? hoverLift * 0.4 : hoverLift) + 0.3, hov.z]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
              <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i style={{ width: 8, height: 8, borderRadius: 2, background: hov.id === 'rem' ? remainderColor : palette[hov.id % palette.length] }} />
                  {hovCat.label}
                </div>
                <div style={{ opacity: 0.8 }}>
                  {fmt(hovCat.value)} · {hovCat.pct.toFixed(Math.max(1, p.decimals))}% · {hovCat.cells.length} of {C * R}
                </div>
              </div>
            </Html>
          )}
        </group>
      </group>
    </>
  )
}

export default function Waffle3DChart({
  data = 'Search:38, Social:24, Email:14',
  title = 'Where visitors come from',
  subtitle = 'Share of 100 site visits, the grey tiles came direct',
  total = 100,
  remainderLabel = 'Direct',
  columns = 10,
  rows = 10,
  fillOrder = 'rows',
  tilt = 42,
  turn = -20,
  cubeHeight = 0.42,
  heightBy = 'equal',
  tileHeight = 0.07,
  gap = 0.16,
  bevel = 0.06,
  gloss = 0.6,
  wave = 0.6,
  hoverLift = 0.25,
  showRemainder = true,
  labels = 'percent',
  labelColor = 'slice',
  showLegend = true,
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
  remainderColor = '#dcdee4',
  background = '#f2f2f3',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const C = clamp(Math.round(columns), 2, 30)
  const R = clamp(Math.round(rows), 2, 30)
  const N = C * R
  const palette = [color, color2, color3, color4, color5, color6]
  const d = clamp(Math.round(decimals), 0, 4)
  const fmt = (v) => `${prefix}${v.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`
  const pctFmt = (v) => `${v.toFixed(d)}%`
  const [hov, setHov] = useState(null)
  const [narrow, setNarrow] = useState(false)

  const { cats, remainder } = useMemo(() => {
    const rs = parseRows(data)
    const sum = rs.reduce((a, r) => a + r.value, 0)
    const T = Math.max(total > 0 ? total : sum, sum) || 1
    const counts = allocate(rs.map((r) => r.value), total, N)
    // cell k -> grid position; rows fill from the back-left in reading order, columns from the front-left upward
    const pos = (k) => (fillOrder === 'columns' ? [Math.floor(k / R), R - 1 - (k % R)] : [k % C, Math.floor(k / C)])
    const maxDiag = Math.max(1, C - 1 + R - 1)
    const cell = (k) => {
      const [c, r] = pos(k)
      const diag = fillOrder === 'columns' ? c + (R - 1 - r) : c + r
      return { x: (c - (C - 1) / 2) * 0.5, z: (r - (R - 1) / 2) * 0.5, t: diag / maxDiag }
    }
    let k = 0
    const cs = rs.map((r, i) => {
      const cells = []
      for (let j = 0; j < counts[i]; j++) cells.push(cell(k++))
      return { ...r, pct: (r.value / T) * 100, cells }
    })
    const rest = []
    while (k < N) rest.push(cell(k++))
    return { cats: cs, remainder: { label: remainderLabel || 'Remainder', value: Math.max(0, T - sum), pct: ((T - sum) / T) * 100, cells: rest } }
  }, [data, total, N, C, R, fillOrder, remainderLabel])

  const legend = [...cats.map((c, i) => ({ ...c, id: i, color: palette[i % palette.length] })), ...(showRemainder && remainder.cells.length ? [{ ...remainder, id: 'rem', color: remainderColor }] : [])]

  return (
    <div
      role="img"
      aria-label={`${title}. 3D waffle chart of ${N} cells. ${cats.map((c) => `${c.label}: ${fmt(c.value)}, ${c.pct.toFixed(1)} percent`).join('; ')}${remainder.cells.length ? `; ${remainder.label}: ${remainder.pct.toFixed(1)} percent` : ''}`}
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
            {...{ cats, remainder, data, total, C, R, fillOrder, gap, cubeHeight, heightBy, tileHeight, showRemainder, bevel, gloss, wave, hoverLift, palette, remainderColor, background, textColor, mutedColor, labels, labelColor, animate, duration, autoRotate, hov, setHov, fmt, pctFmt, tilt, turn, decimals: d, onNarrow: setNarrow }}
          />
          {/* soft studio: a broad top light for the glossy tops, side strips for the walls */}
          <Environment resolution={128}>
            <color attach="background" args={['#d9dadd']} />
            <Lightformer form="rect" intensity={1.3} position={[0, 6, 1]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[-6, 1, 3]} rotation-y={Math.PI / 2.4} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[6, 1, 3]} rotation-y={-Math.PI / 2.4} scale={[3, 6, 1]} />
          </Environment>
        </Suspense>
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 9, 5]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.32} scale={16} blur={2.4} far={2} />
        <OrbitControls
          makeDefault
          enabled={interactive}
          enablePan={false}
          enableZoom={false}
          minPolarAngle={((90 - clamp(tilt + 25, 15, 88)) * Math.PI) / 180}
          maxPolarAngle={((90 - clamp(tilt - 20, 8, 80)) * Math.PI) / 180}
          minAzimuthAngle={-1.1}
          maxAzimuthAngle={1.1}
        />
      </Canvas>
      {(showLegend || (narrow && labels !== 'none')) && legend.length > 0 && (
        <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 18px', zIndex: 40, padding: '0 16px' }}>
          {legend.map((l) => (
            <span
              key={l.id}
              onPointerEnter={() => l.cells.length && setHov({ id: l.id, cell: 0, x: l.cells[0].x, z: l.cells[0].z, h: l.id === 'rem' ? tileHeight : cubeHeight })}
              onPointerLeave={() => setHov(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: hov?.id === l.id ? textColor : mutedColor, fontSize: 13, fontWeight: 600, cursor: 'default' }}
            >
              <i style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
              {l.label}
              {(labels === 'none' || narrow) && <b style={{ color: textColor, fontWeight: 700 }}>{labels === 'value' ? fmt(l.value) : pctFmt(l.pct)}</b>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
