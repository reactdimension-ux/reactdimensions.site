import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D pie (or donut) chart: every slice is an extruded wedge with softly bevelled
// edges, seen from a tilted three-quarter camera. Slices rise in one after another, the
// smallest (or any chosen) slice is pulled out, and big percentage labels float beside
// each one. Hover lifts a slice and shows its value; click pulls it out or pushes it
// back; drag to turn the chart. Data is "Label:value, Label:value".

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

// one wedge from angle a0 to a1 (radians, 0 = the far side, clockwise seen from above),
// between radii r0 (0 for a pie) and r1, extruded upward by h
function wedgeGeometry(a0, a1, r0, r1, h, bevel) {
  const span = Math.max(1e-3, a1 - a0)
  const t0 = Math.PI / 2 - a0 // three.js arcs use maths angles (anticlockwise from +x)
  const t1 = Math.PI / 2 - a1
  const s = new THREE.Shape()
  s.moveTo(Math.cos(t0) * r1, Math.sin(t0) * r1)
  s.absarc(0, 0, r1, t0, t1, true)
  if (r0 > 0) {
    s.lineTo(Math.cos(t1) * r0, Math.sin(t1) * r0)
    s.absarc(0, 0, r0, t1, t0, false)
  } else {
    s.lineTo(0, 0)
  }
  s.closePath()
  const b = Math.min(bevel, h * 0.3, r1 * span * 0.12, r0 > 0 ? (r1 - r0) * 0.2 : bevel)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.01, h - b * 2),
    curveSegments: Math.max(6, Math.ceil((span / (Math.PI * 2)) * 96)),
    bevelEnabled: b > 0.002,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 4,
  })
  // lie it down: the shape's +y becomes the far side (-z), the extrusion points up (+y)
  g.rotateX(-Math.PI / 2)
  g.translate(0, b, 0)
  g.computeVertexNormals()
  return g
}

function Slice({ s, i, n, total, r0, R, h, gap, lift, explodeBy, color, colorTop, colorSide, gloss, progress, stagger, hov, setHov, onToggle, labels, labelColor, textColor, mutedColor, decimals, prefix, suffix, bevel }) {
  const g = useMemo(() => wedgeGeometry(s.a0, s.a1, r0, R, h, bevel), [s.a0, s.a1, r0, R, h, bevel])
  useEffect(() => () => g.dispose(), [g])
  const grp = useRef()
  const lab = useRef()
  const cur = useRef({ out: 0, up: 0 })
  const dir = [Math.sin(s.mid), -Math.cos(s.mid)]
  const active = hov === i

  useFrame((_, dt) => {
    const k = clamp((progress.current - (n > 1 ? (i / (n - 1)) * stagger : 0)) / (1 - stagger), 0, 1)
    const grow = pop(k)
    const target = { out: gap + (s.exploded ? explodeBy : 0) + (active ? lift * 0.5 : 0), up: active ? lift : 0 }
    const c = cur.current
    const f = 1 - Math.exp(-dt * 12)
    c.out += (target.out - c.out) * f
    c.up += (target.up - c.up) * f
    grp.current.position.set(dir[0] * c.out, c.up, dir[1] * c.out)
    grp.current.scale.set(1, Math.max(0.001, grow), 1)
    if (lab.current) {
      c.dim = (c.dim ?? 1) + ((hov >= 0 && !active ? 0.4 : 1) - (c.dim ?? 1)) * f
      lab.current.style.opacity = String(clamp((k - 0.6) / 0.4, 0, 1) * c.dim)
    }
  })

  const pct = (s.value / total) * 100
  const fmt = (v) => `${prefix}${v.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
  const front = Math.max(0, dir[1]) // 1 for the slice pointing straight at the camera (+z)
  const back = Math.max(0, -dir[1])
  const labR = R + 0.75 + front * 0.85 + (s.exploded ? explodeBy : 0)
  const labY = h * 0.55 * (1 - front) - front * 0.15 + back * 0.45
  const big = labels === 'percent' ? pct.toFixed(decimals) : fmt(s.value)

  return (
    <group>
      <group ref={grp}>
        <mesh
          geometry={g}
          castShadow
          receiveShadow
          onPointerOver={(e) => { e.stopPropagation(); setHov(i); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { setHov(-1); document.body.style.cursor = '' }}
          onClick={(e) => { e.stopPropagation(); onToggle(i) }}
        >
          {/* group 0 = top and bottom caps, group 1 = the side walls */}
          <meshPhysicalMaterial attach="material-0" color={colorTop} roughness={0.4} envMapIntensity={0.55} clearcoat={gloss} clearcoatRoughness={0.18} />
          <meshPhysicalMaterial attach="material-1" color={colorSide} roughness={0.5} envMapIntensity={0.5} clearcoat={gloss * 0.6} clearcoatRoughness={0.25} />
        </mesh>
      </group>
      {labels !== 'none' && (
        <Html position={[dir[0] * labR, labY, dir[1] * labR]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={lab} style={{ opacity: 0, fontFamily: FONT, textAlign: 'center', whiteSpace: 'nowrap', userSelect: 'none' }}>
            <div style={{ color: labelColor === 'slice' ? color : textColor, fontWeight: 600, lineHeight: 1, fontSize: 40, letterSpacing: '-0.02em' }}>
              {big}
              {labels === 'percent' && <span style={{ fontSize: 26, marginLeft: 2 }}>%</span>}
            </div>
            <div style={{ color: mutedColor, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        </Html>
      )}
      {active && (
        <Html position={[dir[0] * (R * 0.55 + (s.exploded ? explodeBy : 0)), h + lift + 0.35, dir[1] * (R * 0.55 + (s.exploded ? explodeBy : 0))]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
          <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
            <div style={{ fontWeight: 700 }}>{s.label}</div>
            <div style={{ opacity: 0.8 }}>
              {fmt(s.value)} · {pct.toFixed(1)}%
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// places the camera on the tilt angle and backs it off far enough to fit the chart
function Rig({ tilt, R, explodeBy, labels }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 10, 85) * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    // how far the chart reaches sideways: the rim, the explode, and the floating labels
    const reach = R + explodeBy + (labels === 'none' ? 0.9 : 1.9)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const d = (reach * 1.05) / (tanH * Math.min(aspect, 1.3))
    camera.position.set(0, Math.sin(e) * d, Math.cos(e) * d)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height, tilt, R, explodeBy, labels])
  return null
}

function Scene(props) {
  const { rows, startAngle, innerRadius, thickness, heightBy, gap, explode, explodeMode, hoverLift, tilt, palette, animate, duration, autoRotate, bevel, gloss } = props
  const R = 2
  const total = rows.reduce((a, r) => a + r.value, 0) || 1
  const [toggled, setToggled] = useState({})
  const [hov, setHov] = useState(-1)
  useEffect(() => setToggled({}), [props.data, explodeMode])

  const minI = rows.reduce((b, r, i) => (r.value < rows[b].value ? i : b), 0)
  const maxI = rows.reduce((b, r, i) => (r.value > rows[b].value ? i : b), 0)
  const maxV = rows[maxI]?.value || 1
  let acc = 0
  const slices = rows.map((r, i) => {
    const a0 = ((startAngle * Math.PI) / 180) + (acc / total) * Math.PI * 2
    acc += r.value
    const a1 = ((startAngle * Math.PI) / 180) + (acc / total) * Math.PI * 2
    const base = explodeMode === 'all' || (explodeMode === 'smallest' && i === minI) || (explodeMode === 'largest' && i === maxI)
    return { ...r, a0, a1, mid: (a0 + a1) / 2, exploded: toggled[i] ?? base }
  })

  // 0 -> 1 over `duration`, restarted when the data changes
  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, props.data, heightBy, innerRadius])
  const spin = useRef()
  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    if (autoRotate && spin.current && hov < 0) spin.current.rotation.y += dt * 0.25
  })

  return (
    <>
      <Rig tilt={tilt} R={R} explodeBy={explode} labels={props.labels} />
      <group ref={spin}>
        {slices.map((s, i) => {
          const c = palette[i % palette.length]
          const h = heightBy === 'value' ? thickness * (0.45 + 0.75 * (s.value / maxV)) : thickness
          return (
            <Slice
              key={i}
              s={s}
              i={i}
              n={slices.length}
              total={total}
              r0={R * clamp(innerRadius, 0, 0.85)}
              R={R}
              h={h}
              gap={gap}
              lift={hoverLift}
              explodeBy={explode}
              color={c}
              colorTop={c}
              colorSide={mix(c, '#000000', 0.18)}
              gloss={gloss}
              bevel={bevel}
              progress={progress}
              stagger={0.45}
              hov={hov}
              setHov={setHov}
              onToggle={(k) => setToggled((t) => ({ ...t, [k]: !slices[k].exploded }))}
              labels={props.labels}
              labelColor={props.labelColor}
              textColor={props.textColor}
              mutedColor={props.mutedColor}
              decimals={props.decimals}
              prefix={props.prefix}
              suffix={props.suffix}
            />
          )
        })}
      </group>
    </>
  )
}

export default function Pie3DChart({
  data = 'Design:34, Mobile:8, Marketing:32, Sales:26',
  title = 'Budget split',
  subtitle = 'Share of this year’s spend by team',
  tilt = 38,
  thickness = 0.55,
  innerRadius = 0,
  heightBy = 'equal',
  startAngle = 0,
  gap = 0.04,
  explode = 0.35,
  explodeMode = 'smallest',
  hoverLift = 0.25,
  bevel = 0.04,
  gloss = 0.6,
  labels = 'percent',
  labelColor = 'slice',
  showLegend = false,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  color = '#ff9a2e',
  color2 = '#2f8fff',
  color3 = '#a93ce0',
  color4 = '#ef4a3a',
  color5 = '#14a89e',
  color6 = '#c49a12',
  background = '#f2f2f3',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const rows = useMemo(() => parseRows(data), [data])
  const total = rows.reduce((a, r) => a + r.value, 0) || 1
  const palette = [color, color2, color3, color4, color5, color6]

  return (
    <div
      role="img"
      aria-label={`${title}. 3D pie chart. ${rows.map((r) => `${r.label}: ${((r.value / total) * 100).toFixed(1)} percent`).join('; ')}`}
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
            {...{ rows, data, startAngle, innerRadius, thickness, heightBy, gap, explode, explodeMode, hoverLift, tilt, palette, animate, duration, autoRotate, bevel, gloss, labels, labelColor, textColor, mutedColor, decimals, prefix, suffix }}
          />
          {/* soft studio: a broad top light for the glossy caps, side strips for the walls */}
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
      {showLegend && (
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 18px', zIndex: 40, pointerEvents: 'none' }}>
          {rows.map((r, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: mutedColor, fontSize: 13, fontWeight: 600 }}>
              <i style={{ width: 10, height: 10, borderRadius: '50%', background: palette[i % palette.length] }} />
              {r.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
