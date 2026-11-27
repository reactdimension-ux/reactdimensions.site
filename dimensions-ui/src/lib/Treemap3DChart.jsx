import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// A real 3D treemap: a squarified treemap laid out on the floor, each tile a glossy
// rounded box whose footprint matches its value and whose height can follow it too.
// Each group sits on its own thin plate in a tint of the group colour, with a wider gap
// between groups than between tiles, and a floating group label lifted above it. Tiles
// rise group by group with a springy pop. Names and values sit on a tile's top face
// only when they fit inside it and nothing in front hides them. Hover a tile and it
// lifts while the rest dims; drag to turn the chart.
// Data is "Group/Item:value, Group/Item:value" (the same format as the 2D Treemap). An
// entry with no "/" becomes a group of one tile. An array of { group, label, value } works too.

const FONT = '"Poppins", "Nunito", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
// springy ease-out with a small overshoot
const pop = (x) => (x >= 1 ? 1 : x <= 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2)
function mix(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0)
  const [A, B] = [h(a), h(b)]
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
const inkOn = (c) => {
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(String(c).slice(i, i + 2), 16) || 0) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62 ? '#2b2f3a' : '#ffffff'
}

// "Group/Item:value, ..." -> [{ name, value, children: [{ name, value }] }], biggest first
function parseGroups(data) {
  const rows = Array.isArray(data)
    ? data.map((d) => ({ group: String(d.group ?? d.label ?? ''), name: String(d.label ?? d.name ?? ''), value: Math.max(0, num(d.value)) }))
    : String(data ?? '')
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const k = s.lastIndexOf(':')
          const path = (k < 0 ? s : s.slice(0, k)).split('/').map((x) => x.trim()).filter(Boolean)
          const value = Math.max(0, num(k < 0 ? 0 : s.slice(k + 1)))
          return { group: path[0] ?? '', name: path.length > 1 ? path.slice(1).join(' / ') : path[0] ?? '', value }
        })
  const groups = []
  rows
    .filter((r) => r.value > 0 && r.name)
    .forEach((r) => {
      let g = groups.find((x) => x.name === r.group)
      if (!g) groups.push((g = { name: r.group, children: [], value: 0 }))
      const c = g.children.find((x) => x.name === r.name)
      if (c) c.value += r.value
      else g.children.push({ name: r.name, value: r.value })
      g.value += r.value
    })
  groups.sort((a, b) => b.value - a.value)
  groups.forEach((g) => g.children.sort((a, b) => b.value - a.value))
  return groups
}

// squarified layout (Bruls et al.) in the floor plane: x across, z from the back
function squarify(items, x, z, w, d) {
  const out = []
  const total = items.reduce((a, n) => a + n.value, 0) || 1
  const area = items.map((n) => ({ n, a: (n.value / total) * w * d }))
  const worst = (r, side) => {
    const s = r.reduce((a, q) => a + q.a, 0)
    const mx = Math.max(...r.map((q) => q.a))
    const mn = Math.min(...r.map((q) => q.a))
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
  }
  const place = (r) => {
    const s = r.reduce((a, q) => a + q.a, 0)
    if (w >= d) {
      const cw = s / d
      let zz = z
      r.forEach((q) => {
        const cd = q.a / cw
        out.push({ n: q.n, x, z: zz, w: cw, d: cd })
        zz += cd
      })
      x += cw
      w -= cw
    } else {
      const rd = s / w
      let xx = x
      r.forEach((q) => {
        const cw = q.a / rd
        out.push({ n: q.n, x: xx, z, w: cw, d: rd })
        xx += cw
      })
      z += rd
      d -= rd
    }
  }
  let row = []
  area.forEach((q) => {
    const side = Math.min(w, d)
    if (!row.length || worst([...row, q], side) <= worst(row, side)) row.push(q)
    else {
      place(row)
      row = [q]
    }
  })
  if (row.length) place(row)
  return out
}

// a rounded box: a rounded rectangle (w across, d deep) in the floor plane, extruded up
// by h with a bevel on the top and bottom edges. Base on y = 0. Group 0 = caps, 1 = walls.
function boxGeometry(w, d, h, bevel) {
  const b = Math.max(0, Math.min(bevel, w * 0.25, d * 0.25, h * 0.3))
  const hx = Math.max(0.002, w / 2 - b)
  const hz = Math.max(0.002, d / 2 - b)
  const cr = Math.min(hx * 0.9, hz * 0.9, Math.max(0.004, b * 0.8 + Math.min(w, d) * 0.04))
  const sh = new THREE.Shape()
  sh.moveTo(-hx + cr, -hz)
  sh.lineTo(hx - cr, -hz)
  sh.absarc(hx - cr, -hz + cr, cr, -Math.PI / 2, 0, false)
  sh.lineTo(hx, hz - cr)
  sh.absarc(hx - cr, hz - cr, cr, 0, Math.PI / 2, false)
  sh.lineTo(-hx + cr, hz)
  sh.absarc(-hx + cr, hz - cr, cr, Math.PI / 2, Math.PI, false)
  sh.lineTo(-hx, -hz + cr)
  sh.absarc(-hx + cr, -hz + cr, cr, Math.PI, Math.PI * 1.5, false)
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

function Tile({ t, gloss, bevel, setHov, registerMesh }) {
  const geo = useMemo(() => boxGeometry(t.w, t.d, t.h, bevel), [t.w, t.d, t.h, bevel])
  const mats = useMemo(
    () => [
      new THREE.MeshPhysicalMaterial({ color: t.color, roughness: 0.4, envMapIntensity: 0.55, clearcoat: gloss, clearcoatRoughness: 0.18, emissive: t.color, emissiveIntensity: 0 }),
      new THREE.MeshPhysicalMaterial({ color: mix(t.color, '#000000', 0.18), roughness: 0.5, envMapIntensity: 0.5, clearcoat: gloss * 0.6, clearcoatRoughness: 0.25, emissive: t.color, emissiveIntensity: 0 }),
    ],
    [t.color, gloss],
  )
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  const pick = (e) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
    setHov((h) => (h && h.gi === t.gi && h.ki === t.ki ? h : { gi: t.gi, ki: t.ki }))
  }
  return (
    <mesh
      ref={(m) => registerMesh(t.id, m, mats)}
      geometry={geo}
      material={mats}
      castShadow
      receiveShadow
      onPointerOver={pick}
      onPointerMove={pick}
      onPointerOut={() => {
        setHov(null)
        document.body.style.cursor = ''
      }}
    />
  )
}

function Plate({ g, h, bevel, gloss, background }) {
  const geo = useMemo(() => boxGeometry(g.w, g.d, h, Math.min(bevel, h * 0.45)), [g.w, g.d, h, bevel])
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: mix(g.color, background, 0.8), roughness: 0.55, envMapIntensity: 0.5, clearcoat: gloss * 0.4, clearcoatRoughness: 0.3 }), [g.color, background, gloss])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  return <mesh geometry={geo} material={mat} position={[g.x + g.w / 2, 0, g.z + g.d / 2]} receiveShadow />
}

// places the camera on the tilt / turn angles and backs it off to fit the floor and labels
function Rig({ tilt, turn, span, height, cy }) {
  const { camera, size, controls } = useThree()
  useEffect(() => {
    const e = (clamp(tilt, 10, 85) * Math.PI) / 180
    const a = (clamp(turn, -60, 60) * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    const tanH = Math.tan((camera.fov * Math.PI) / 360)
    const rad = 0.5 * Math.hypot(span[0] + 0.4, span[1] + 0.4)
    const vert = 0.5 * ((span[1] + 0.3) * Math.sin(e) + (height + 0.2) * Math.cos(e))
    const d = Math.max((rad * 0.96) / (tanH * Math.min(aspect, 1.3)), vert / (tanH * 0.72))
    camera.position.set(Math.sin(a) * Math.cos(e) * d, cy + Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d)
    camera.lookAt(0, cy, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, cy, 0)
      controls.update()
    }
  }, [camera, controls, size.width, size.height, tilt, turn, span[0], span[1], height, cy]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

const _v = new THREE.Vector3()
const _w = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _dir = new THREE.Vector3()

function Scene(p) {
  const { groups, tiles, W, D, H, plateH, bevel, gloss, hoverLift, background, textColor, mutedColor, labelColor, labels, showNames, showGroupLabels, showPlates, animate, duration, autoRotate, hov, setHov, fmt, pctFmt, total } = p
  const { camera, size } = useThree()

  // 0 -> 1 over `duration`, restarted when the layout changes
  const progress = useRef(animate ? 0 : 1)
  const started = useRef(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    progress.current = animate && !reduce ? 0 : 1
    started.current = performance.now()
  }, [animate, p.layoutKey])

  const spin = useRef()
  const box = useRef()
  const meshes = useRef({})
  const registerMesh = useMemo(() => (id, m, mats) => (m ? (meshes.current[id] = { m, mats }) : delete meshes.current[id]), [])
  const live = useRef({})
  const tileEls = useRef({})
  const chipEls = useRef({})
  const dimCols = useMemo(() => {
    const bg = new THREE.Color(background)
    const o = {}
    tiles.forEach((t) => {
      const top = new THREE.Color(t.color)
      const side = new THREE.Color(mix(t.color, '#000000', 0.18))
      o[t.id] = [{ base: top, dim: top.clone().lerp(bg, 0.6) }, { base: side, dim: side.clone().lerp(bg, 0.6) }]
    })
    return o
  }, [tiles, background])

  useFrame((_, dt) => {
    if (progress.current < 1) progress.current = Math.min(1, (performance.now() - started.current) / Math.max(1, duration))
    if (autoRotate && spin.current && !hov) spin.current.rotation.y += dt * 0.2
    const pr = progress.current
    const f = 1 - Math.exp(-dt * 12)
    const parent = box.current
    if (!parent) return
    parent.updateWorldMatrix(true, false)
    _cam.copy(camera.position)
    const camLocal = parent.worldToLocal(_cam.clone())

    // grow, lift and dim every tile
    tiles.forEach((t) => {
      const L = (live.current[t.id] ??= { up: 0, dim: 0, glow: 0, vis: 0, mode: 0 })
      const on = hov && hov.gi === t.gi && (hov.ki == null || hov.ki === t.ki)
      const dimTo = !hov || on ? 0 : hov.ki != null && hov.gi === t.gi ? 0.45 : 1
      L.up += ((on && hov.ki != null ? hoverLift : 0) - L.up) * f
      L.dim += (dimTo - L.dim) * f
      L.glow += ((on && hov.ki != null ? 1 : 0) - L.glow) * f
      L.k = clamp((pr - t.delay) / 0.45, 0, 1)
      L.sy = Math.max(0.001, pop(L.k))
      L.top = plateH + L.up + t.h * L.sy
      const M = meshes.current[t.id]
      if (M) {
        M.m.position.set(t.cx, plateH + L.up, t.cz)
        M.m.scale.set(1, L.sy, 1)
        M.mats.forEach((mat, j) => {
          mat.color.copy(dimCols[t.id][j].base).lerp(dimCols[t.id][j].dim, L.dim)
          mat.emissiveIntensity = L.glow * 0.14
        })
      }
    })

    const toPx = (x, y, z) => {
      _v.set(x, y, z)
      parent.localToWorld(_v)
      _v.project(camera)
      return [((_v.x + 1) / 2) * size.width, ((1 - _v.y) / 2) * size.height]
    }
    // the floor-local point on the plane y = Y under screen pixel (px, py)
    const onPlane = (px, py, Y) => {
      _w.set((px / size.width) * 2 - 1, 1 - (py / size.height) * 2, 0.5).unproject(camera)
      _dir.copy(_w).sub(_cam).normalize()
      if (Math.abs(_dir.y) < 1e-6) return null
      const s = (Y - _cam.y) / _dir.y
      if (s <= 0) return null
      return parent.worldToLocal(_w.copy(_cam).addScaledVector(_dir, s))
    }
    // is the segment from the camera to a floor-local point blocked by another tile?
    const blocked = (pt, selfId) => {
      const dx = pt.x - camLocal.x
      const dy = pt.y - camLocal.y
      const dz = pt.z - camLocal.z
      for (const o of tiles) {
        if (o.id === selfId) continue
        const L = live.current[o.id]
        if (!L) continue
        let t0 = 0
        let t1 = 0.998
        const slab = (c, dd, lo, hi) => {
          if (Math.abs(dd) < 1e-9) return c >= lo && c <= hi
          let a = (lo - c) / dd
          let b = (hi - c) / dd
          if (a > b) [a, b] = [b, a]
          t0 = Math.max(t0, a)
          t1 = Math.min(t1, b)
          return t0 <= t1
        }
        if (slab(camLocal.x, dx, o.x0, o.x1) && slab(camLocal.y, dy, plateH + L.up, L.top) && slab(camLocal.z, dz, o.z0, o.z1)) return true
      }
      return false
    }
    const overlaps = (a, list) => list.some((b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1])

    // group labels: biggest group first, a smaller group drops its total, then hides, if it would collide
    const chips = []
    groups.forEach((g) => {
      const el = chipEls.current[g.gi]
      if (!el) return
      const gl = (live.current['g' + g.gi] ??= { dim: 1, mode: 0 })
      if (el.full == null || gl.mode === 0) {
        el.full = [el.offsetWidth, el.offsetHeight]
        el.short = [el.firstChild?.offsetWidth ?? el.offsetWidth, el.offsetHeight]
        if (!el.offsetWidth) el.full = null
      }
      // try the back-left corner, then the back-right corner (label right-aligned)
      const [ax, ay] = toPx(g.x + 0.02, g.top, g.z)
      const [bx, by] = toPx(g.x + g.w - 0.02, g.top, g.z)
      let mode = 2
      let side = 0
      if (el.full) {
        outer: for (const m of [0, 1]) {
          for (const s of [0, 1]) {
            const [w, h] = m === 0 ? el.full : el.short
            const r = s === 0 ? [ax - 3, ay - h - 3, ax + w + 3, ay + 3] : [bx - w - 3, by - h - 3, bx + 3, by + 3]
            if (!overlaps(r, chips) && r[0] >= 0 && r[2] <= size.width) {
              mode = m
              side = s
              chips.push(r)
              break outer
            }
          }
        }
      }
      if (side !== gl.side) {
        gl.side = side
        el.parentNode.style.transform = side === 0 ? 'translate(0, -100%)' : 'translate(-100%, -100%)'
      }
      const grp = chipAnchors.current[g.gi]
      if (grp) grp.position.x = side === 0 ? g.x + 0.02 : g.x + g.w - 0.02
      if (mode !== gl.mode) {
        gl.mode = mode
        if (el.lastChild && el.lastChild !== el.firstChild) el.lastChild.style.display = mode === 0 ? '' : 'none'
      }
      gl.dim += ((hov && hov.gi !== g.gi ? 0.4 : 1) - gl.dim) * f
      const fade = clamp((pr - g.delay - 0.2) / 0.3, 0, 1)
      el.parentNode.style.opacity = String(mode === 2 ? 0 : fade * gl.dim)
    })

    // tile labels: shown only when the whole label lands inside the top face, unblocked,
    // and clear of the group labels. Full (name + value) first, then the value alone.
    tiles.forEach((t) => {
      const el = tileEls.current[t.id]
      const L = live.current[t.id]
      if (!el || !L) return
      const parts = el.children
      if (el.full == null || L.mode === 0) {
        if (el.offsetWidth) {
          el.full = [el.offsetWidth, el.offsetHeight]
          const last = parts[parts.length - 1]
          el.short = [last.offsetWidth, last.offsetHeight]
        }
      }
      let mode = 2
      if (el.full) {
        const [cx, cy] = toPx(t.cx, L.top, t.cz)
        const m = Math.max(0.035, bevel * 0.9)
        const tryFit = (wh) => {
          const [w, h] = wh
          const r = [cx - w / 2 - 3, cy - h / 2 - 2, cx + w / 2 + 3, cy + h / 2 + 2]
          if (overlaps(r, chips)) return false
          const pts = [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]], [cx, cy]]
          for (const [px, py] of pts) {
            const q = onPlane(px, py, L.top)
            if (!q || q.x < t.x0 + m || q.x > t.x1 - m || q.z < t.z0 + m || q.z > t.z1 - m) return false
            if (blocked(q, t.id)) return false
          }
          return true
        }
        if (parts.length > 1 && tryFit(el.full)) mode = 0
        else if (tryFit(parts.length > 1 ? el.short : el.full)) mode = 1
      }
      if (mode !== L.mode) {
        L.mode = mode
        if (parts.length > 1) parts[0].style.display = mode === 0 ? '' : 'none'
      }
      L.vis += ((mode === 2 ? 0 : 1) - L.vis) * (L.vis < 0.05 && mode !== 2 ? 1 : f * 1.6)
      el.parentNode.style.opacity = String(clamp((L.k - 0.6) / 0.4, 0, 1) * (1 - L.dim * 0.72) * clamp(L.vis, 0, 1))
    })
    // anchors follow the animated tops
    tiles.forEach((t) => {
      const a = anchors.current[t.id]
      if (a) a.position.y = live.current[t.id]?.top ?? 0
    })
  })
  const anchors = useRef({})
  const chipAnchors = useRef({})

  const hovTile = hov && hov.ki != null ? tiles.find((t) => t.gi === hov.gi && t.ki === hov.ki) : null
  const showTileLabels = showNames || labels !== 'none'
  const numText = (t) => (labels === 'percent' ? pctFmt((t.value / total) * 100) : labels === 'both' ? `${fmt(t.value)} · ${pctFmt((t.value / total) * 100)}` : fmt(t.value))

  return (
    <>
      <Rig tilt={p.tilt} turn={p.turn} span={[W, D]} height={H + (showGroupLabels ? 0.35 : 0)} cy={H * 0.22} />
      <group ref={spin}>
        <group ref={box}>
          {showPlates && groups.map((g) => <Plate key={`p${g.gi}-${g.x.toFixed(3)}-${g.w.toFixed(3)}`} g={g} h={plateH} bevel={bevel} gloss={gloss} background={background} />)}
          {tiles.map((t) => (
            <Tile key={t.id + '|' + t.w.toFixed(3) + t.d.toFixed(3) + t.h.toFixed(3)} t={t} gloss={gloss} bevel={bevel} setHov={setHov} registerMesh={registerMesh} />
          ))}
          {showTileLabels &&
            tiles.map((t) => (
              <group key={'l' + t.id} ref={(g) => (anchors.current[t.id] = g)} position={[t.cx, t.h, t.cz]}>
                <Html zIndexRange={[18, 0]} style={{ pointerEvents: 'none' }}>
                  <div style={{ transform: 'translate(-50%, -50%)', opacity: 0 }}>
                    <div
                      ref={(el) => (tileEls.current[t.id] = el)}
                      style={{ fontFamily: FONT, textAlign: 'center', whiteSpace: 'nowrap', userSelect: 'none', color: t.ink, lineHeight: 1.15, textShadow: t.ink === '#ffffff' ? '0 1px 2px #0003' : 'none' }}
                    >
                      {showNames && <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.88 }}>{t.name}</div>}
                      {labels !== 'none' && <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{numText(t)}</div>}
                    </div>
                  </div>
                </Html>
              </group>
            ))}
          {showGroupLabels &&
            groups.map((g) => (
              <group key={'g' + g.gi} ref={(o) => (chipAnchors.current[g.gi] = o)} position={[g.x + 0.02, g.top, g.z]}>
              <Html zIndexRange={[24, 19]} style={{ pointerEvents: 'none' }}>
                <div style={{ transform: 'translate(0, -100%)', opacity: 0 }}>
                  <div
                    ref={(el) => (chipEls.current[g.gi] = el)}
                    style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontFamily: FONT, whiteSpace: 'nowrap', userSelect: 'none', background: `${background}e8`, borderRadius: 8, padding: '3px 8px', boxShadow: '0 4px 12px -6px #0004' }}
                  >
                    <span style={{ color: labelColor === 'slice' ? mix(g.color, '#000000', 0.12) : textColor, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{g.name}</span>
                    <span style={{ color: mutedColor, fontSize: 11, fontWeight: 600 }}>{fmt(g.value)}</span>
                  </div>
                </div>
              </Html>
              </group>
            ))}
          {hovTile && (
            <Html position={[hovTile.cx, plateH + hovTile.h + hoverLift + 0.1, hovTile.z0]} zIndexRange={[40, 30]} style={{ pointerEvents: 'none' }}>
              <div role="tooltip" style={{ transform: 'translate(-50%, -100%)', fontFamily: FONT, background: textColor, color: '#fff', padding: '6px 10px', borderRadius: 10, fontSize: 13, whiteSpace: 'nowrap', boxShadow: '0 8px 20px -8px #0006' }}>
                <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{groups[hovTile.gi].name}</div>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i style={{ width: 8, height: 8, borderRadius: 2, background: hovTile.color }} />
                  {hovTile.name}
                </div>
                <div style={{ opacity: 0.8 }}>
                  {fmt(hovTile.value)} · {pctFmt((hovTile.value / total) * 100)} of total · {pctFmt((hovTile.value / groups[hovTile.gi].value) * 100)} of group
                </div>
              </div>
            </Html>
          )}
        </group>
      </group>
    </>
  )
}

export default function Treemap3DChart({
  data = 'Compute/Virtual machines:420, Compute/Containers:260, Compute/Functions:90, Storage/Object storage:310, Storage/Block storage:150, Storage/Backups:70, Database/Postgres:240, Database/Redis:80, Database/Search:60, Network/CDN:130, Network/Load balancers:55, Network/DNS:12, AI/GPU hours:360, AI/Inference API:140',
  title = 'Cloud spend by service',
  subtitle = 'USD thousands last quarter, tile area and height follow spend',
  heightBy = 'value',
  thickness = 0.14,
  maxHeight = 1.1,
  floorDepth = 0.62,
  tilt = 46,
  turn = -16,
  gap = 0.05,
  groupGap = 0.2,
  bevel = 0.035,
  gloss = 0.6,
  shade = 0.4,
  showPlates = true,
  hoverLift = 0.25,
  labels = 'value',
  showNames = true,
  showGroupLabels = true,
  labelColor = 'slice',
  showLegend = false,
  autoRotate = false,
  interactive = true,
  animate = true,
  duration = 1800,
  valueFormat = 'number',
  decimals = 0,
  prefix = '$',
  suffix = 'k',
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
  const palette = [color, color2, color3, color4, color5, color6]
  const d = clamp(Math.round(decimals), 0, 4)
  const nf = useMemo(
    () => (valueFormat === 'compact' ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: Math.max(1, d) }) : new Intl.NumberFormat('en', { minimumFractionDigits: d, maximumFractionDigits: d })),
    [valueFormat, d],
  )
  const fmt = (v) => `${prefix}${nf.format(v)}${suffix}`
  const pctFmt = (v) => `${v.toFixed(Math.max(d, v < 10 ? 1 : 0))}%`
  const [hov, setHov] = useState(null)

  const W = 6
  const D = W * clamp(floorDepth, 0.3, 1.5)
  const plateH = showPlates ? 0.04 : 0
  const tH = clamp(thickness, 0.02, 2)
  const mH = Math.max(tH, maxHeight)

  const { groups, tiles, total, H } = useMemo(() => {
    const gs = parseGroups(data)
    const tot = gs.reduce((a, g) => a + g.value, 0) || 1
    const vmax = Math.max(1e-9, ...gs.flatMap((g) => g.children.map((c) => c.value)))
    const outer = squarify(gs, -W / 2, -D / 2, W, D)
    const G = outer.length
    const gg = clamp(groupGap, 0, 0.8)
    const tg = clamp(gap, 0, 0.4)
    const groupsOut = []
    const tilesOut = []
    outer.forEach((o, gi) => {
      const g = o.n
      const base = palette[gi % palette.length]
      const gx = o.x + gg / 2
      const gz = o.z + gg / 2
      const gw = Math.max(0.02, o.w - gg)
      const gd = Math.max(0.02, o.d - gg)
      const pad = showPlates ? tg : 0
      const kids = squarify(g.children, gx + pad / 2, gz + pad / 2, Math.max(0.02, gw - pad), Math.max(0.02, gd - pad))
      const mx = Math.max(...kids.map((k) => k.n.value))
      const mn = Math.min(...kids.map((k) => k.n.value))
      const delay = G > 1 ? (gi / (G - 1)) * 0.45 : 0
      let top = 0
      kids.forEach((k, ki) => {
        const w = Math.max(0.02, k.w - tg)
        const dd = Math.max(0.02, k.d - tg)
        const h = heightBy === 'value' ? tH + (mH - tH) * (k.n.value / vmax) : tH
        const s = mx === mn ? 0 : 1 - (k.n.value - mn) / (mx - mn)
        const c = mix(base, '#ffffff', clamp(shade, 0, 0.8) * s)
        const cx = k.x + k.w / 2
        const cz = k.z + k.d / 2
        top = Math.max(top, h)
        tilesOut.push({ id: `${gi}:${ki}:${g.name}/${k.n.name}`, gi, ki, name: k.n.name, value: k.n.value, w, d: dd, h, cx, cz, x0: cx - w / 2, x1: cx + w / 2, z0: cz - dd / 2, z1: cz + dd / 2, color: c, ink: inkOn(c), delay: delay + (kids.length > 1 ? (ki / (kids.length - 1)) * 0.1 : 0) })
      })
      groupsOut.push({ gi, name: g.name, value: g.value, color: base, x: gx, z: gz, w: gw, d: gd, top: plateH + top + 0.1, delay })
    })
    return { groups: groupsOut, tiles: tilesOut, total: tot, H: plateH + Math.max(tH, ...tilesOut.map((t) => t.h)) }
  }, [data, D, groupGap, gap, heightBy, tH, mH, shade, showPlates, plateH, color, color2, color3, color4, color5, color6]) // eslint-disable-line react-hooks/exhaustive-deps

  const layoutKey = `${data}|${heightBy}|${D}|${tH}|${mH}`

  return (
    <div
      role="img"
      aria-label={`${title ? title + '. ' : ''}3D treemap. ${groups.map((g) => `${g.name} ${fmt(g.value)}: ${tiles.filter((t) => t.gi === g.gi).map((t) => `${t.name} ${fmt(t.value)}`).join(', ')}`).join('; ')}`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background, touchAction: 'none', fontFamily: FONT, overflow: 'hidden', ...style }}
    >
      {(title || subtitle) && (
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', zIndex: 40, pointerEvents: 'none', padding: '0 16px' }}>
          {title && <div style={{ color: textColor, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>}
          {subtitle && <div style={{ color: mutedColor, fontSize: 13, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [0, 6, 8] }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Scene
            {...{ groups, tiles, total, W, D, H, plateH, bevel, gloss, hoverLift, background, textColor, mutedColor, labelColor, labels, showNames, showGroupLabels, showPlates, animate, duration, autoRotate, hov, setHov, fmt, pctFmt, tilt, turn, layoutKey }}
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
        <directionalLight position={[3, 9, 5]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-bias={-0.0004} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.32} scale={14} blur={2.4} far={2} />
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
      {showLegend && groups.length > 0 && (
        <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 18px', zIndex: 40, padding: '0 16px' }}>
          {groups.map((g) => (
            <span
              key={g.gi}
              onPointerEnter={() => setHov({ gi: g.gi, ki: null })}
              onPointerLeave={() => setHov(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: hov?.gi === g.gi ? textColor : mutedColor, fontSize: 13, fontWeight: 600, cursor: 'default' }}
            >
              <i style={{ width: 10, height: 10, borderRadius: 3, background: g.color }} />
              {g.name}
              <b style={{ color: textColor, fontWeight: 700 }}>{fmt(g.value)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
