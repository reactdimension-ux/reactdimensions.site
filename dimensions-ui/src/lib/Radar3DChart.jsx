import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D radar chart: a flat web (rings and spokes) lies on a soft plate, and every
// series polygon is extruded into a glossy, softly bevelled slab floating above it at its
// own height, stacked like layers. Slabs grow out from the centre one after another, and
// thin drop lines tie each vertex back to its spot on the web. Axis names (with each
// series' value) float around the outside. Hover a slab to lift it, fade the others and
// read the nearest axis value; drag to turn the chart.
// Data is one row per axis, "Axis:v1|v2", with `series` naming the values, the same
// format as the 2D radar charts.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function parseRows(data) {
  if (Array.isArray(data)) return data.map((d) => ({ label: String(d.label ?? ''), values: (Array.isArray(d.values) ? d.values : [d.value]).map((v) => Math.max(0, num(v))) }))
  return String(data ?? '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(':')
      return { label: i < 0 ? s : s.slice(0, i).trim(), values: (i < 0 ? '0' : s.slice(i + 1)).split('|').map((v) => Math.max(0, num(v))) }
    })
}
const splitNames = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// springy ease-out with a small overshoot
const pop = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
const easeOut = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
// a tidy top for the value scale
function niceMax(v) {
  if (!(v > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(v))
  const n = v / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
}

// axis i of n: angle 0 is the far side (-z), clockwise seen from above.
// Shape coords (x, y) lie flat as world (x, -y), so a point is [sin a * r, cos a * r].
const angleOf = (i, n) => (i / n) * Math.PI * 2
const shapePt = (a, r) => [Math.sin(a) * r, Math.cos(a) * r]
const worldPt = (a, r, y = 0) => [Math.sin(a) * r, y, -Math.cos(a) * r]

// a closed outline extruded upward by h, base on y = 0. The bevel is pulled inward
// (bevelOffset) so the walls sit exactly on the outline. Caps are group 0, walls group 1.
function slabGeometry(pts, h, bevel) {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  const b = Math.max(0, Math.min(bevel, h * 0.3))
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.01, h - b * 2),
    curveSegments: 1,
    bevelEnabled: b > 0.002,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 4,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, b, 0)
  g.computeVertexNormals()
  return g
}
// a flat ring (or disc when r0 = 0) on the floor, as a polygon or a circle
function ringGeometry(n, r0, r1, circle) {
  const outline = (r) => (circle ? Array.from({ length: 72 }, (_, i) => shapePt((i / 72) * Math.PI * 2, r)) : Array.from({ length: n }, (_, i) => shapePt(angleOf(i, n), r)))
  const s = new THREE.Shape()
  outline(r1).forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  if (r0 > 0) {
    const hole = new THREE.Path()
    outline(r0).reverse().forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)))
    hole.closePath()
    s.holes.push(hole)
  }
  const g = new THREE.ShapeGeometry(s)
  g.rotateX(-Math.PI / 2)
  return g
}

function Slab({ s, n, R, T, bevel, gloss, opacity, progress, hov, setHov, hoverLift, showDots, dotSize, dropLines, footprint, axes, fmt, textColor, background }) {
  const pts = useMemo(() => s.rs.map((r, i) => shapePt(angleOf(i, n), Math.max(r, R * 0.02))), [s.rs, n, R])
  const geom = useMemo(() => slabGeometry(pts, T, bevel), [pts, T, bevel])
  useEffect(() => () => geom.dispose(), [geom])
  const grow = useRef()
  const rise = useRef()
  const drops = useRef()
  const foot = useRef()
  const capMat = useRef()
  const wallMat = useRef()
  const dotMats = useRef([])
  const cur = useRef({ lift: 0, fade: 1 })
  const active = hov && hov.s === s.i
  const hi = active ? hov.i : -1

  useFrame((_, dt) => {
    const k = clamp((progress.current - s.delay) / 0.6, 0, 1)
    const c = cur.current
    const f = 1 - Math.exp(-dt * 12)
    c.lift += ((active ? hoverLift : 0) - c.lift) * f
    c.fade += ((hov && !active ? 0.22 : 1) - c.fade) * f
    const g = Math.max(0.001, pop(k))
    const y = s.y * (0.15 + 0.85 * easeOut(k * 1.4)) + c.lift
    grow.current.scale.set(g, 1, g)
    rise.current.position.y = y
    if (drops.current) {
      drops.current.position.y = y
      drops.current.scale.set(g, Math.max(0.001, y), g)
    }
    if (foot.current) foot.current.scale.set(g, 1, g)
    const op = opacity * c.fade * clamp(k * 4, 0, 1)
    if (capMat.current) capMat.current.opacity = op
    if (wallMat.current) wallMat.current.opacity = op
    dotMats.current.forEach((m) => m && (m.opacity = clamp((k - 0.55) / 0.35, 0, 1) * (0.25 + 0.75 * c.fade)))
    if (drops.current) drops.current.visible = k > 0.05
  })

  const pick = (e) => {
    e.stopPropagation()
    const p = grow.current.worldToLocal(e.point.clone())
    let a = Math.atan2(p.x, -p.z)
    if (a < 0) a += Math.PI * 2
    const i = Math.round(a / ((Math.PI * 2) / n)) % n
    if (!hov || hov.s !== s.i || hov.i !== i) setHov({ s: s.i, i })
    document.body.style.cursor = 'pointer'
  }
  const ring = [...pts, pts[0]]
  const dotR = 0.045 * dotSize
  const inset = Math.min(bevel, T * 0.3) + dotR * 0.4

  return (
    <group>
      {footprint && (
        <group ref={foot}>
          <Line points={ring.map(([x, y]) => [x, 0.012, -y])} color={s.color} lineWidth={2} transparent opacity={0.55} />
        </group>
      )}
      {dropLines && (
        <group ref={drops}>
          {pts.map(([x, y], i) => (
            <Line key={i} points={[[x, 0, -y], [x, -1, -y]]} color={s.color} lineWidth={1.2} transparent opacity={hov && !active ? 0.15 : 0.5} dashed dashSize={0.05} gapSize={0.04} />
          ))}
        </group>
      )}
      <group ref={rise}>
        <group ref={grow}>
          <mesh geometry={geom} castShadow receiveShadow onPointerOver={pick} onPointerMove={pick} onPointerOut={() => { setHov(null); document.body.style.cursor = '' }} onClick={(e) => e.stopPropagation()}>
            <meshPhysicalMaterial ref={capMat} attach="material-0" color={s.color} transparent opacity={opacity} roughness={0.36} envMapIntensity={0.6} clearcoat={gloss} clearcoatRoughness={0.16} />
            <meshPhysicalMaterial ref={wallMat} attach="material-1" color={mix(s.color, '#000000', 0.18)} transparent opacity={opacity} roughness={0.45} envMapIntensity={0.5} clearcoat={gloss * 0.6} clearcoatRoughness={0.25} />
          </mesh>
          {showDots &&
            s.rs.map((r, i) => {
              const a = angleOf(i, n)
              const rr = Math.max(0, Math.max(r, R * 0.02) - inset)
              return (
                <mesh key={i} position={worldPt(a, rr, T + dotR * 0.15)} scale={i === hi ? 1.6 : 1}>
                  <sphereGeometry args={[dotR, 20, 14]} />
                  <meshPhysicalMaterial ref={(m) => (dotMats.current[i] = m)} color="#ffffff" transparent opacity={0} roughness={0.3} clearcoat={1} emissive="#ffffff" emissiveIntensity={i === hi ? 0.35 : 0.08} />
                </mesh>
              )
            })}
          {hi >= 0 && (
            <Html position={worldPt(angleOf(hi, n), Math.max(s.rs[hi], R * 0.02), T + 0.18)} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
              <div role="tooltip" style={{ fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006', transform: 'translateY(-70%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <i style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                  {s.name}
                </div>
                <div style={{ opacity: 0.85 }}>
                  {axes[hi]} · <b>{fmt(s.values[hi])}</b>
                </div>
              </div>
            </Html>
          )}
        </group>
      </group>
    </group>
  )
}

// the outline of every slab's top face, sampled along each edge, in chart space
function slabTops(stack, n, T, lifted = -1, lift = 0) {
  const out = []
  for (const s of stack)
    for (let j = 0; j < n; j++) {
      const [x0, , z0] = worldPt(angleOf(j, n), s.rs[j])
      const [x1, , z1] = worldPt(angleOf((j + 1) % n, n), s.rs[(j + 1) % n])
      for (let k = 0; k < 6; k++) out.push(new THREE.Vector3(x0 + ((x1 - x0) * k) / 6, s.y + T + (s.i === lifted ? lift : 0), z0 + ((z1 - z0) * k) / 6))
    }
  return out
}
// how far a far-side label must rise so its box (w x h px, nudged by dx, dy) clears every
// slab point that shows in its screen column. Done in real screen space, so perspective counts.
const _v = new THREE.Vector3()
function liftFor(p, w, h, dx, dy, tops, cam, W, H, m) {
  const px = (x, y, z) => {
    _v.set(x, y, z)
    if (m) _v.applyMatrix4(m)
    _v.project(cam)
    return [(_v.x * 0.5 + 0.5) * W, (-_v.y * 0.5 + 0.5) * H]
  }
  const [cx, cy] = px(p[0], 0, p[2])
  const perY = Math.max(1, cy - px(p[0], 1, p[2])[1])
  let top = Infinity
  for (const q of tops) {
    const [qx, qy] = px(q.x, q.y, q.z)
    if (Math.abs(qx - cx - dx) < w / 2 + 6) top = Math.min(top, qy)
  }
  const over = cy + dy + h / 2 - (top - 10)
  return over > 0 ? over / perY : 0
}
const labelRadius = (R, front) => R + 0.42 + Math.max(0, front) * 0.12

// axis names around the rim. Each frame they are pushed outward on screen by their
// own width, and the far ones lift above the top slab, so they never sit on a mark.
function AxisLabels({ axes, series, n, R, T, hoverLift, spin, mode, labelColor, textColor, mutedColor, background, fmt, hov, progress }) {
  const { camera } = useThree()
  const groups = useRef([])
  const divs = useRef([])
  const wrap = useRef()
  const tops = useMemo(() => slabTops(series, n, T, hov ? hov.s : -1, hoverLift), [series, n, T, hov ? hov.s : -1, hoverLift]) // eslint-disable-line react-hooks/exhaustive-deps
  const ys = useRef([])
  useFrame((state, dt) => {
    const f = 1 - Math.exp(-dt * 12)
    const rot = spin.current ? spin.current.rotation.y : 0
    const m = spin.current ? spin.current.matrixWorld : null
    const phi = Math.atan2(camera.position.x, camera.position.z)
    const fade = clamp(progress.current / 0.35, 0, 1)
    for (let i = 0; i < n; i++) {
      const g = groups.current[i]
      const d = divs.current[i]
      if (!g || !d) continue
      const a = angleOf(i, n)
      // world direction of the axis after the idle spin
      const wx = Math.sin(a) * Math.cos(rot) - Math.cos(a) * Math.sin(rot)
      const wz = -Math.sin(a) * Math.sin(rot) - Math.cos(a) * Math.cos(rot)
      const front = wx * Math.sin(phi) + wz * Math.cos(phi) // 1 = towards the camera
      const side = wx * Math.cos(phi) - wz * Math.sin(phi) // 1 = screen right
      const r = labelRadius(R, front)
      const p = worldPt(a, r)
      const w = d.offsetWidth
      const h = d.offsetHeight
      const dy = (front * 0.3 - Math.max(0, -front) * 0.35) * h
      const y = front < 0.25 ? Math.min(liftFor(p, w, h, side * 0.52 * w, dy, tops, camera, state.size.width, state.size.height, m), 3) : 0
      const cy = (ys.current[i] = ys.current[i] == null ? y : ys.current[i] + (y - ys.current[i]) * f)
      g.position.set(p[0], cy, p[2])
      d.style.transform = `translate(${(side * 52).toFixed(1)}%, ${(dy / Math.max(1, h)) * 100}%)`
      d.style.opacity = String(fade)
    }
  })
  return (
    <group ref={wrap}>
      {axes.map((name, i) => (
        <group key={i} ref={(g) => (groups.current[i] = g)}>
          <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={(d) => (divs.current[i] = d)} style={{ opacity: 0, fontFamily: FONT, textAlign: 'center', whiteSpace: 'nowrap', userSelect: 'none', lineHeight: 1.1, textShadow: `0 0 3px ${background}, 0 0 3px ${background}, 0 0 6px ${background}` }}>
              <div style={{ color: hov && hov.i === i ? textColor : labelColor === 'series' ? textColor : mutedColor, fontSize: 13, fontWeight: 700 }}>{name}</div>
              {mode === 'values' && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 2, fontSize: 12, fontWeight: 600 }}>
                  {series.map((s, k) => (
                    <span key={k} style={{ color: labelColor === 'series' ? s.color : mutedColor, opacity: hov && hov.s !== s.i ? 0.35 : 1 }}>
                      {fmt(s.values[i])}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Html>
        </group>
      ))}
    </group>
  )
}

// places the camera on the tilt angle and backs it off until the web, the stack and
// the label ring all fit, leaving room for the title and the legend
function Rig({ tilt, R, n, S, T, hoverLift, series, labels, axes, titled, legend }) {
  const { camera, size, controls } = useThree()
  const names = axes.join('|')
  useEffect(() => {
    const e = (clamp(tilt, 10, 85) * Math.PI) / 180
    const W = Math.max(1, size.width)
    const H = Math.max(1, size.height)
    // what has to fit: the plate rim, the top of the stack and each label's box (px)
    const pts = []
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2
      pts.push({ p: worldPt(a, R + 0.32, -0.1), w: 8, h: 8 })
    }
    series.forEach((s) => s.rs.forEach((r, i) => pts.push({ p: worldPt(angleOf(i, n), r, s.y + T + 0.1 + (s.i === series.length - 1 ? hoverLift : 0)), w: 14, h: 14 })))
    if (labels !== 'none')
      for (let i = 0; i < n; i++) {
        const a = angleOf(i, n)
        const front = -Math.cos(a)
        const side = Math.sin(a)
        const w = Math.max(String(axes[i] ?? '').length * 7.6, labels === 'values' ? S * 26 : 0) + 10
        const h = labels === 'values' ? 34 : 18
        pts.push({ p: worldPt(a, labelRadius(R, front)), lift: front < 0.25, w, h, dx: side * 0.52 * w, dy: (front * 0.3 - Math.max(0, -front) * 0.35) * h })
      }
    // leave room for the top slab's hover lift too
    const tops = slabTops(series, n, T, series.length - 1, hoverLift)
    const cam = camera.clone()
    cam.aspect = W / H
    cam.updateProjectionMatrix()
    const up = new THREE.Vector3(0, Math.cos(e), -Math.sin(e))
    const target = new THREE.Vector3(0, ((series[series.length - 1]?.y ?? 0) + T) * 0.4, 0)
    const v = new THREE.Vector3()
    const y0 = titled ? 70 : 14
    const y1 = H - (legend ? 46 : 14)
    let d = 10
    const place = () => {
      cam.position.set(target.x, target.y + Math.sin(e) * d, target.z + Math.cos(e) * d)
      cam.lookAt(target)
      cam.updateMatrixWorld()
    }
    for (let it = 0; it < 10; it++) {
      place()
      let x0 = Infinity, x1 = -Infinity, t0 = Infinity, t1 = -Infinity
      for (const q of pts) {
        v.set(q.p[0], q.lift ? Math.min(liftFor(q.p, q.w, q.h, q.dx, q.dy, tops, cam, W, H), 3) : q.p[1], q.p[2]).project(cam)
        const px = (v.x * 0.5 + 0.5) * W + (q.dx || 0)
        const py = (-v.y * 0.5 + 0.5) * H + (q.dy || 0)
        x0 = Math.min(x0, px - q.w / 2)
        x1 = Math.max(x1, px + q.w / 2)
        t0 = Math.min(t0, py - q.h / 2)
        t1 = Math.max(t1, py + q.h / 2)
      }
      // content size shrinks roughly with 1 / distance
      const f = Math.max((x1 - x0) / (W - 24), (t1 - t0) / Math.max(40, y1 - y0))
      // move the look point so the content centres between the title and the legend
      const wpp = (2 * Math.tan((cam.fov * Math.PI) / 360) * d) / H
      target.addScaledVector(up, -((t0 + t1) / 2 - (y0 + y1) / 2) * wpp)
      d = clamp(d * f, 3, 60)
    }
    camera.position.set(target.x, target.y + Math.sin(e) * d, target.z + Math.cos(e) * d)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(target)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, R, n, S, T, hoverLift, series, labels, names, titled, legend]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function Scene(p) {
  const { rows, names, levels, maxValue, gridShape, showFloor, banded, showGrid, showScale, thickness, layerGap, baseHeight, bevel, gloss, opacity, palette, hoverLift, showDots, dotSize, dropLines, footprint, axisLabels, labelColor, animate, duration, autoRotate, floorColor, gridColor, textColor, mutedColor, background, fmt } = p
  const [hov, setHov] = useState(null)
  const R = 2
  const n = Math.max(3, rows.length)
  const axes = Array.from({ length: n }, (_, i) => rows[i]?.label ?? '')
  const S = Math.max(1, ...rows.map((r) => r.values.length))
  const T = clamp(thickness, 0.04, 1)
  const top0 = Math.max(0, ...rows.flatMap((r) => r.values))
  const max = maxValue > 0 ? maxValue : niceMax(top0)
  const L = clamp(Math.round(levels), 1, 10)
  const circle = gridShape === 'circle'
  const step = T + Math.max(0, layerGap)

  const series = useMemo(
    () =>
      Array.from({ length: S }, (_, si) => {
        const values = Array.from({ length: n }, (_, i) => rows[i]?.values[si] ?? 0)
        return {
          i: si,
          name: names[si] ?? `Series ${si + 1}`,
          values,
          rs: values.map((v) => R * clamp(v / max, 0, 1.15)),
          y: Math.max(0, baseHeight) + si * step,
          delay: S > 1 ? (si / (S - 1)) * 0.38 : 0,
          color: palette[si % palette.length],
        }
      }),
    [rows, names.join(), S, n, max, baseHeight, step, palette.join()], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const plate = useMemo(() => {
    const pts = circle ? Array.from({ length: 72 }, (_, i) => shapePt((i / 72) * Math.PI * 2, R + 0.3)) : Array.from({ length: n }, (_, i) => shapePt(angleOf(i, n), R + 0.32))
    const g = slabGeometry(pts, 0.1, 0.04)
    g.translate(0, -0.1, 0)
    return g
  }, [circle, n])
  useEffect(() => () => plate.dispose(), [plate])
  const bands = useMemo(() => {
    if (!banded) return []
    const out = []
    for (let l = L; l > 0; l -= 2) out.push(ringGeometry(n, (R * (l - 1)) / L, (R * l) / L, circle))
    return out
  }, [banded, L, n, circle])
  useEffect(() => () => bands.forEach((g) => g.dispose()), [bands])

  const outline = (r) => (circle ? Array.from({ length: 73 }, (_, i) => worldPt((i / 72) * Math.PI * 2, r, 0.006)) : Array.from({ length: n + 1 }, (_, i) => worldPt(angleOf(i % n, n), r, 0.006)))

  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, p.data, S, n])
  const spin = useRef()
  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    if (autoRotate && spin.current && !hov) spin.current.rotation.y += dt * 0.25
  })

  return (
    <>
      <Rig tilt={p.tilt} R={R} n={n} S={S} T={T} hoverLift={hoverLift} series={series} labels={axisLabels} axes={axes} titled={p.titled} legend={p.legend} />
      <group ref={spin}>
        {showFloor && (
          <mesh geometry={plate} receiveShadow>
            <meshStandardMaterial attach="material-0" color={floorColor} roughness={0.85} />
            <meshStandardMaterial attach="material-1" color={mix(floorColor, '#000000', 0.06)} roughness={0.85} />
          </mesh>
        )}
        {bands.map((g, i) => (
          <mesh key={i} geometry={g} position={[0, 0.002, 0]} receiveShadow>
            <meshStandardMaterial color={gridColor} roughness={0.9} transparent opacity={0.35} />
          </mesh>
        ))}
        {showGrid && (
          <>
            {Array.from({ length: L }, (_, l) => (
              <Line key={`r${l}`} points={outline((R * (l + 1)) / L)} color={gridColor} lineWidth={l === L - 1 ? 1.8 : 1.1} />
            ))}
            {axes.map((_, i) => (
              <Line key={`s${i}`} points={[[0, 0.006, 0], worldPt(angleOf(i, n), R, 0.006)]} color={gridColor} lineWidth={1.1} />
            ))}
          </>
        )}
        {showScale &&
          Array.from({ length: L }, (_, l) => (
            <Html key={`t${l}`} position={worldPt(Math.PI / n, ((R * (l + 1)) / L) * Math.cos(Math.PI / n), 0.01)} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: mutedColor, whiteSpace: 'nowrap', userSelect: 'none', textShadow: `0 0 3px ${floorColor}, 0 0 3px ${floorColor}` }}>{fmt((max * (l + 1)) / L)}</div>
            </Html>
          ))}
        {series.map((s) => (
          <Slab key={s.i} {...{ s, n, R, T, bevel, gloss, opacity: clamp(opacity, 0.1, 1), progress, hov, setHov, hoverLift, showDots, dotSize, dropLines, footprint, axes, fmt, textColor, background }} />
        ))}
        {axisLabels !== 'none' && <AxisLabels {...{ axes, series, n, R, T, hoverLift, spin, mode: axisLabels, labelColor, textColor, mutedColor, background, fmt, hov, progress }} />}
      </group>
    </>
  )
}

export default function Radar3DChart({
  data = 'Speed:80|60, Power:65|85, Range:90|55, Comfort:55|75, Price:70|90, Design:85|65',
  series = 'Model A, Model B',
  title = 'Model comparison',
  subtitle = 'Rated out of 100 across six areas',
  gridShape = 'polygon',
  levels = 5,
  maxValue = 0,
  tilt = 46,
  thickness = 0.2,
  layerGap = 0.3,
  baseHeight = 0.14,
  bevel = 0.04,
  gloss = 0.6,
  opacity = 0.88,
  hoverLift = 0.25,
  showDots = true,
  dotSize = 1,
  dropLines = true,
  footprint = true,
  axisLabels = 'values',
  labelColor = 'series',
  showFloor = true,
  bandedRings = true,
  showGrid = true,
  showScale = false,
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
  background = '#f2f2f3',
  floorColor = '#ffffff',
  gridColor = '#d5d8e0',
  textColor = '#2b2f3a',
  mutedColor = '#8a90a0',
  style,
}) {
  const rows = useMemo(() => parseRows(data).filter((r) => r.label || r.values.length), [data])
  const S = Math.max(1, ...rows.map((r) => r.values.length))
  const given = splitNames(series)
  const names = Array.from({ length: S }, (_, i) => given[i] ?? `Series ${i + 1}`)
  const palette = [color, color2, color3, color4, color5, color6]
  const d = clamp(Math.round(decimals), 0, 4)
  const fmt = (v) => `${prefix}${v.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`

  return (
    <div
      role="img"
      aria-label={`${title}. 3D radar chart. ${names.map((nm, si) => `${nm}: ${rows.map((r) => `${r.label} ${fmt(r.values[si] ?? 0)}`).join(', ')}`).join('; ')}`}
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
            {...{ rows, data, names, levels, maxValue, gridShape, showFloor, banded: bandedRings, showGrid, showScale, thickness, layerGap, baseHeight, bevel, gloss, opacity, palette, hoverLift, showDots, dotSize, dropLines, footprint, axisLabels, labelColor, animate, duration, autoRotate, floorColor, gridColor, textColor, mutedColor, background, fmt, tilt, titled: !!(title || subtitle), legend: showLegend }}
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
        <directionalLight position={[3, 9, 5]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-0.0005} />
        <ContactShadows position={[0, -0.11, 0]} opacity={0.32} scale={12} blur={2.4} far={2} />
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
          {names.map((nm, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: mutedColor, fontSize: 13, fontWeight: 600 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: palette[i % palette.length] }} />
              {nm}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
