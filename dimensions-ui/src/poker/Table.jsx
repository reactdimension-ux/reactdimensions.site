import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { buildPeel, buildWood } from '../gameboard/textures.js'
import { WOOD, boxUV, flat, inset, lathe, loop, rectPath, sweep } from '../roulette/build.js'
import { buildChip, buildFelt, buildLeather } from '../roulette/textures.js'
import { CUP, CUPS, DIVIDERS, FOOTREST, L, LEG_X, OUTLINE, R, SLOT, TABLE, TRAY, TUBE, roundRect, stadium } from './layout.js'

// A full-size oval poker table, built with the roulette table's own parts:
// its sweep and lathe builders, its baize, pebbled leather and chips, and
// the board models' figured wood.
//
// A padded leather arm rail runs round the edge and stops with rounded ends
// either side of the dealer, where the cloth runs out to the edge. Inside
// the rail is a polished wooden racetrack; steel cup holders are let into
// the rail, one per seat. The dealer has a steel chip tray sunk in the
// cloth and a brass drop slot. Underneath: two octagonal pedestals on
// moulded trestle feet, a stretcher, and a brass foot rail.
//
// The cloth's lines are an ink mask mixed over the cloth colour in the
// shader, so the baize can be any colour and the weave shows through.

const { H, railW, padH, slab, track } = TABLE
const CHIP = { r: 0.0195, h: 0.0033 }
const RACK = ['#b3161c', '#1f4fbf', '#0d7a3c', '#1a1a1c', '#6b2d8f'] // two channels of each
const STEEL = '#aeb2b8'

// ---- cross-sections: [inset from the table's edge, height above the cloth] ----
// the padded rail: tucked under the top at the outside, a full soft crown
// with a sewn seam towards the inside, down onto the racetrack
const crown = (x) => {
  const c = Math.abs(1 - x / (railW / 2)) ** (1 / 0.75)
  return padH * Math.sqrt(1 - c * c) ** 0.55
}
const SEAM = 0.128
const PAD = (() => {
  const p = [[0.035, -0.056], [0.006, -0.056], [0.002, -0.053], [0, -0.048], [0, 0]]
  const n = 28
  let sewn = false
  for (let i = 1; i <= n; i++) {
    const c = Math.cos((i / n) * Math.PI)
    const x = (railW / 2) * (1 - Math.sign(c) * Math.abs(c) ** 0.75)
    if (Math.abs(x - SEAM) < 0.0045) continue
    if (x > SEAM && !sewn) {
      sewn = true
      p.push([SEAM - 0.0035, crown(SEAM - 0.0035)], [SEAM - 0.0014, crown(SEAM) - 0.0003], [SEAM, crown(SEAM) - 0.0024], [SEAM + 0.0014, crown(SEAM) - 0.0003], [SEAM + 0.0035, crown(SEAM + 0.0035)])
    }
    p.push([x, crown(x)])
  }
  return p
})()
const PAD_MID = [railW / 2, -0.006] // the rail's ends shrink towards this
// the racetrack: a polished strip standing a little proud of the cloth
const TRACK = [[railW - 0.012, 0], [railW - 0.012, 0.005], [railW - 0.012, 0.005], [railW + track - 0.006, 0.005], [railW + track - 0.006, 0.005], [railW + track - 0.002, 0.0035], [railW + track, 0]]
// the top's edge, seen where the rail is cut away
const EDGE = [[0.06, -slab], [0.016, -slab], [0.016, -slab], [0.011, -slab + 0.003], [0.008, -slab + 0.008], [0.008, -0.004], [0.0095, -0.0008], [0.013, 0.0012], [0.019, 0.0012], [0.021, 0]]
// the chip tray's rim and wall
const RIM = [[0, 0], [0, 0.0022], [0.0008, 0.003], [0.009, 0.003], [TRAY.lip, 0.0022], [TRAY.lip, 0.0022], [TRAY.lip, TRAY.floor]]
// a trestle foot, closed underneath and over the top
const FOOT = (hx) => [[hx, 0.024], [0, 0.024], [0, 0.024], [0, 0.058], [0.002, 0.063], [0.006, 0.065], [0.016, 0.065], [0.016, 0.065], [0.018, 0.072], [0.026, 0.084], [0.04, 0.092], [0.044, 0.094], [0.044, 0.094], [hx, 0.094]]
// a pedestal: plinth, ogee base, shaft, a necking bead and a coved capital
const COLUMN = [
  [0, 0.085],
  [0, 0.126],
  [0.003, 0.13],
  [0.012, 0.13],
  [0.012, 0.13],
  [0.014, 0.137],
  [0.019, 0.151],
  [0.03, 0.163],
  [0.036, 0.167],
  [0.036, 0.167],
  [0.04, 0.173],
  [0.04, 0.585],
  [0.04, 0.585],
  [0.036, 0.588],
  [0.033, 0.595],
  [0.036, 0.602],
  [0.04, 0.605],
  [0.04, 0.605],
  [0.04, 0.614],
  [0.036, 0.634],
  [0.025, 0.651],
  [0.012, 0.66],
  [0.012, 0.66],
  [0.008, 0.663],
  [0.008, H - slab - 0.034],
]
// [radius, height]: a cup holder (from its rim), a post under the foot rail
const CUP_WELL = [[CUP.flange, -0.001], [CUP.flange, 0.0012], [CUP.flange - 0.0015, 0.002], [CUP.r + 0.0015, 0.002], [CUP.r + 0.0003, 0.0012], [CUP.r, 0], [CUP.r - 0.0015, -0.052], [CUP.r - 0.0045, -0.056], [0, -0.056]]
const POST = [[0.024, 0], [0.024, 0.004], [0.02, 0.008], [0.0095, 0.012], [0.008, 0.02], [0.008, FOOTREST.y - 0.034], [0.012, FOOTREST.y - 0.027], [0.012, FOOTREST.y - 0.008], [0, FOOTREST.y - 0.008]]

// build.js's sweep, with one addition: a path point may carry k, a scale for
// the cross-section about `mid` there. That rounds off an open sweep's ends.
function taperSweep(path, profile, mid, along, across) {
  const P = profile.length
  const pos = []
  const uv = []
  const idx = []
  const arc = [0]
  for (let i = 1; i < P; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
  path.forEach((p) => {
    const k = p.k ?? 1
    for (let i = 0; i < P; i++) {
      const d = mid[0] + (profile[i][0] - mid[0]) * k
      pos.push(p.x + p.nx * d, mid[1] + (profile[i][1] - mid[1]) * k, p.z + p.nz * d)
      uv.push(p.s / along, arc[i] / across)
    }
  })
  for (let j = 0; j < path.length - 1; j++)
    for (let i = 0; i < P - 1; i++) {
      const a = j * P + i
      const b = a + P
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

// A convex polygon ([x, z] corners, in the same order as rectPath's) as a
// sweep path, its corners doubled and mitred.
function polyPath(c) {
  const N = c.length
  const normal = (a, b) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]
  }
  const out = []
  let s = 0
  for (let i = 0; i <= N; i++) {
    const p = c[i % N]
    const n1 = normal(c[(i + N - 1) % N], p)
    const n2 = normal(p, c[(i + 1) % N])
    const m = 1 + n1[0] * n2[0] + n1[1] * n2[1]
    if (i > 0) s += Math.hypot(p[0] - c[i - 1][0], p[1] - c[i - 1][1])
    const q = { x: p[0], z: p[1], nx: (n1[0] + n2[0]) / m, nz: (n1[1] + n2[1]) / m, s }
    out.push(q, { ...q })
  }
  return out.slice(1, -1)
}

// a swept moulding's grain runs along its path: stand it up the profile instead
function grainUp(g) {
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getY(i) * WOOD.across) / WOOD.along, (uv.getX(i) * WOOD.along) / WOOD.across)
  return g
}

// the chip tray's floor: a row of half-round channels
function trayFloor() {
  const N = 20
  const z = TRAY.hz - TRAY.lip
  const pos = []
  const idx = []
  for (let t = 0; t < TRAY.tubes; t++) {
    const cx = -(TRAY.hx - TRAY.lip) + (2 * t + 1) * TUBE
    const base = pos.length / 3
    for (let i = 0; i <= N; i++) {
      const a = Math.PI + (i / N) * Math.PI
      const x = cx + TUBE * Math.cos(a)
      const y = TRAY.axis + TUBE * Math.sin(a)
      pos.push(x, y, -z, x, y, z)
    }
    for (let i = 0; i < N; i++) {
      const a = base + i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// The line print, as one ink mask over the whole top: the betting line, the
// lines between the seats and the two that close off the dealer's box.
function buildPrint() {
  const W = 4096
  const k = W / TABLE.len
  const c = Object.assign(document.createElement('canvas'), { width: W, height: Math.round(TABLE.wid * k) })
  const g = c.getContext('2d')
  const X = (x) => (x + TABLE.len / 2) * k
  const Z = (z) => (z + R) * k
  g.fillStyle = '#000'
  g.fillRect(0, 0, c.width, c.height)
  g.strokeStyle = '#fff'
  g.lineWidth = 0.0034 * k
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  inset(OUTLINE.pts, TABLE.inner).forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))))
  g.closePath()
  g.stroke()
  g.beginPath()
  for (const p of DIVIDERS) {
    g.moveTo(X(p.x + p.nx * TABLE.inner), Z(p.z + p.nz * TABLE.inner))
    g.lineTo(X(p.x + p.nx * (railW + 0.02)), Z(p.z + p.nz * (railW + 0.02)))
  }
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = 16
  return t
}

// the cloth: baize with the line print mixed in, cut away over the chip tray
function clothMaterial(uni, felt) {
  const m = new THREE.MeshPhysicalMaterial({ map: felt, bumpMap: felt, bumpScale: 0.35, roughness: 0.96, sheen: 0.6, sheenRoughness: 0.6 })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uPrint;\nuniform vec4 uTop;\nuniform vec4 uWell;\nuniform vec3 uLine;\nvarying vec2 vP;')
      .replace(
        '#include <map_fragment>',
        `vec2 well = abs(vP - uWell.xy);
        if (well.x < uWell.z && well.y < uWell.w) discard;
        float ink = texture2D(uPrint, vec2((vP.x - uTop.x) / uTop.z, 1.0 - (vP.y - uTop.y) / uTop.w)).r;
        diffuseColor.rgb = mix(diffuseColor.rgb, uLine, ink * 0.92);
        #include <map_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'poker-cloth'
  return m
}

// the rail's leather, holed where the cup holders go through it
function railMaterial(uni, pebble) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.5, normalMap: pebble, normalScale: new THREE.Vector2(0.5, 0.5), sheen: 0.35, sheenRoughness: 0.5, clearcoat: 0.14, clearcoatRoughness: 0.45 })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec2 uCups[${CUPS.length}];\nvarying vec2 vP;`)
      .replace(
        '#include <map_fragment>',
        `float cup = 1.0;
        for (int i = 0; i < ${CUPS.length}; i++) cup = min(cup, distance(vP, uCups[i]));
        if (cup < ${(CUP.r + 0.001).toFixed(4)}) discard;
        #include <map_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'poker-rail'
  return m
}

function buildGeometry() {
  const { pts, total, gap } = OUTLINE
  // the rail runs from one side of the dealer's cut-out all the way round to the other
  const body = [...pts.slice(gap[1]), ...pts.slice(0, gap[0] + 1).map((p) => ({ ...p, s: p.s + total }))]
  // ... and each end is rounded off into the cut-out
  const nose = (p, dir) => {
    const out = []
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2)
      const d = TABLE.nose * Math.sin(a)
      out.push({ ...p, x: p.x + dir * d, s: p.s - dir * d, k: Math.max(0.002, Math.cos(a)) })
    }
    return out
  }
  const pad = taperSweep([...nose(body[0], 1).reverse(), ...body, ...nose(body[body.length - 1], -1)], PAD, PAD_MID, 0.07, 0.07)
  {
    // the leather is drawn down a little round each cup holder's rim
    const p = pad.attributes.position
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      if (y < 0.012) continue
      for (const c of CUPS) {
        const d = Math.hypot(p.getX(i) - c.x, p.getZ(i) - c.z)
        if (d > 0.078) continue
        const w = 1 - THREE.MathUtils.smoothstep(d, CUP.flange + 0.002, 0.078)
        p.setY(i, y + (Math.min(y, CUP.y - 0.0006) - y) * w)
      }
    }
    pad.computeVertexNormals()
  }

  const all = loop(pts, total)
  const cloth = pts.map((p, i) => {
    const d = i >= gap[0] && i <= gap[1] ? 0.018 : railW - 0.006
    return [p.x + p.nx * d, p.z + p.nz * d]
  })

  const tray = roundRect(TRAY.hx, TRAY.hz, 0.012)
  const A = 0.15
  const B = 0.09
  const rest = stadium(FOOTREST.l, FOOTREST.r, 0.02)
  const ring = []
  for (let i = 0; i <= 20; i++) {
    const a = -Math.PI / 2 - (i / 20) * Math.PI * 2
    ring.push([FOOTREST.tube * Math.cos(a), FOOTREST.y + FOOTREST.tube * Math.sin(a)])
  }

  return {
    pad,
    track: sweep(body, TRACK, { caps: true }),
    edge: sweep(all, EDGE),
    under: flat(inset(pts, 0.016), -slab + 0.0005, false, WOOD.along, WOOD.across),
    cloth: flat(cloth, 0, true, 0.06),
    cup: lathe(CUP_WELL, 64, 1, 0),
    trayRim: sweep(loop(tray.pts, tray.total), RIM),
    trayFloor: trayFloor(),
    slotPlate: new RoundedBoxGeometry(SLOT.hx * 2, 0.004, SLOT.hz * 2, 3, 0.0015),
    slit: new THREE.BoxGeometry(0.008, 0.001, SLOT.hz * 2 - 0.026),
    column: grainUp(
      sweep(
        polyPath([
          [-B, A],
          [B, A],
          [A, B],
          [A, -B],
          [B, -A],
          [-B, -A],
          [-A, -B],
          [-A, B],
        ]),
        COLUMN,
      ),
    ),
    foot: sweep(rectPath(0.15, 0.38), FOOT(0.15)),
    toe: boxUV(new RoundedBoxGeometry(0.27, 0.03, 0.11, 3, 0.005)),
    bearer: boxUV(new RoundedBoxGeometry(0.2, 0.036, 0.82, 3, 0.006), 'z'),
    stretcher: boxUV(new RoundedBoxGeometry(2 * LEG_X - 0.2, 0.12, 0.05, 3, 0.006)),
    rest: sweep(loop(rest.pts, rest.total), ring),
    post: lathe(POST, 40, 1, 0),
  }
}

// the dealer's float: stacks of chips lying in the tray's channels
function Rack() {
  const invalidate = useThree((s) => s.invalidate)
  const refs = useRef([])
  const per = Math.floor((2 * (TRAY.hz - TRAY.lip) - 0.002) / CHIP.h)
  const geo = useMemo(() => new THREE.CylinderGeometry(CHIP.r, CHIP.r, CHIP.h, 40), [])
  const sets = useMemo(
    () =>
      RACK.map((color) => {
        const [face, edge] = buildChip(color)
        const look = { roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 }
        const side = new THREE.MeshPhysicalMaterial({ map: edge, ...look })
        const cap = new THREE.MeshPhysicalMaterial({ map: face, ...look })
        return [side, cap, cap]
      }),
    [],
  )
  useEffect(
    () => () => {
      geo.dispose()
      sets.forEach(([side, cap]) => {
        side.map.dispose()
        cap.map.dispose()
        side.dispose()
        cap.dispose()
      })
    },
    [geo, sets],
  )
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const lie = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    const spin = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const one = new THREE.Vector3(1, 1, 1)
    const p = new THREE.Vector3()
    const rnd = (a, b) => {
      const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
      return v - Math.floor(v)
    }
    refs.current.forEach((mesh, c) => {
      let n = 0
      for (const t of [c * 2, c * 2 + 1]) {
        if (t >= TRAY.tubes) continue
        const x = TRAY.x - (TRAY.hx - TRAY.lip) + (2 * t + 1) * TUBE
        const count = per - Math.floor(rnd(t, 7) * 16)
        for (let i = 0; i < count; i++) {
          p.set(x, TRAY.axis - TUBE + CHIP.r + 0.0002, TRAY.z - (TRAY.hz - TRAY.lip) + 0.001 + CHIP.h * (i + 0.5))
          q.copy(lie).multiply(spin.setFromAxisAngle(up, rnd(t, i) * Math.PI * 2))
          mesh.setMatrixAt(n++, m.compose(p, q, one))
        }
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    })
    invalidate()
  }, [per, invalidate])
  return sets.map((mats, c) => <instancedMesh key={c} ref={(el) => (refs.current[c] = el)} args={[geo, undefined, per * 2]} material={mats} frustumCulled={false} castShadow receiveShadow />)
}

export default function PokerTable({ feltColor = '#0c6a34', woodColor = '#74301c', leatherColor = '#17171a', metalColor = '#c9a557', lineColor = '#d8b24a', chips = false }) {
  const invalidate = useThree((s) => s.invalidate)
  const geo = useMemo(buildGeometry, [])
  const tex = useMemo(() => {
    const peel = buildPeel()
    peel.repeat.set(24, 3)
    return { grain: buildWood(), peel, leather: buildLeather(), felt: buildFelt(), print: buildPrint() }
  }, [])
  const uni = useMemo(
    () => ({
      uPrint: { value: tex.print },
      uTop: { value: new THREE.Vector4(-TABLE.len / 2, -R, TABLE.len, TABLE.wid) },
      uWell: { value: new THREE.Vector4(TRAY.x, TRAY.z, TRAY.hx - 0.006, TRAY.hz - 0.006) },
      uLine: { value: new THREE.Color() },
      uCups: { value: CUPS.map((c) => new THREE.Vector2(c.x, c.z)) },
    }),
    [tex],
  )
  const mats = useMemo(
    () => ({
      wood: new THREE.MeshPhysicalMaterial({ map: tex.grain, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.24, clearcoatNormalMap: tex.peel, clearcoatNormalScale: new THREE.Vector2(0.06, 0.06) }),
      leather: railMaterial(uni, tex.leather),
      cloth: clothMaterial(uni, tex.felt),
      brass: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.22 }),
      plate: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.5 }),
      steel: new THREE.MeshStandardMaterial({ color: STEEL, metalness: 1, roughness: 0.34, envMapIntensity: 0.7, side: THREE.DoubleSide }),
      dark: new THREE.MeshStandardMaterial({ color: '#070707', roughness: 0.9 }),
    }),
    [tex, uni],
  )
  useLayoutEffect(() => {
    mats.wood.color.set(woodColor)
    mats.leather.color.set(leatherColor)
    mats.leather.sheenColor.set(leatherColor).lerp(new THREE.Color('#ffffff'), 0.25)
    mats.cloth.color.set(feltColor)
    mats.cloth.sheenColor.set(feltColor).lerp(new THREE.Color('#ffffff'), 0.2)
    mats.brass.color.set(metalColor)
    mats.plate.color.set(metalColor)
    uni.uLine.value.set(lineColor)
    invalidate()
  }, [mats, uni, feltColor, woodColor, leatherColor, metalColor, lineColor, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      Object.values(tex).forEach((t) => t.dispose())
      Object.values(geo).forEach((g) => g.dispose())
    },
    [mats, tex, geo],
  )

  const f = FOOTREST
  const posts = [
    [-LEG_X, f.r],
    [0, f.r],
    [LEG_X, f.r],
    [f.l + f.r, 0],
    [LEG_X, -f.r],
    [0, -f.r],
    [-LEG_X, -f.r],
    [-f.l - f.r, 0],
  ]

  return (
    <group>
      <group position-y={H}>
        <mesh geometry={geo.pad} material={mats.leather} castShadow receiveShadow />
        <mesh geometry={geo.track} material={mats.wood} castShadow receiveShadow />
        <mesh geometry={geo.edge} material={mats.wood} castShadow receiveShadow />
        <mesh geometry={geo.under} material={mats.wood} castShadow />
        <mesh geometry={geo.cloth} material={mats.cloth} castShadow receiveShadow />
        {CUPS.map((c, i) => (
          <mesh key={i} geometry={geo.cup} material={mats.steel} position={[c.x, CUP.y, c.z]} receiveShadow />
        ))}
        <group position={[TRAY.x, 0, TRAY.z]}>
          <mesh geometry={geo.trayRim} material={mats.steel} receiveShadow />
          <mesh geometry={geo.trayFloor} material={mats.steel} receiveShadow />
        </group>
        <mesh geometry={geo.slotPlate} material={mats.plate} position={[SLOT.x, 0.0018, SLOT.z]} castShadow receiveShadow />
        <mesh geometry={geo.slit} material={mats.dark} position={[SLOT.x, 0.0034, SLOT.z]} />
        {chips && <Rack />}
      </group>
      {[-LEG_X, LEG_X].map((x) => (
        <group key={x} position-x={x}>
          {[-0.31, 0.31].map((z) => (
            <mesh key={z} geometry={geo.toe} material={mats.wood} position={[0, 0.015, z]} castShadow receiveShadow />
          ))}
          <mesh geometry={geo.foot} material={mats.wood} castShadow receiveShadow />
          <mesh geometry={geo.column} material={mats.wood} castShadow receiveShadow />
          <mesh geometry={geo.bearer} material={mats.wood} position-y={H - slab - 0.0175} castShadow receiveShadow />
        </group>
      ))}
      <mesh geometry={geo.stretcher} material={mats.wood} position-y={0.4} castShadow receiveShadow />
      <mesh geometry={geo.rest} material={mats.brass} castShadow receiveShadow />
      {posts.map(([x, z], i) => (
        <mesh key={i} geometry={geo.post} material={mats.brass} position={[x, 0, z]} castShadow receiveShadow />
      ))}
    </group>
  )
}
