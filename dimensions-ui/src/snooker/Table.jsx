import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { grid } from '../airliner/geometry.js'
import { buildPeel, buildWood } from '../gameboard/textures.js'
import { WOOD, boxUV, flat, lathe, rectPath, sweep } from '../roulette/build.js'
import { buildFelt, buildLeather } from '../roulette/textures.js'
import { BALL_R, BAULK_X, COLOURS, D_R, HX, HZ, JAW, LEG_X, LEG_Z, OX, OZ, POCKETS, SPOTS, TABLE, reds } from './layout.js'

// A full-size snooker table, built with the roulette and poker tables'
// parts: their sweep and lathe builders, the baize and the leather, and the
// board models' figured mahogany.
//
// The cloth bed with its baulk line, D and spots; cloth-covered rubber
// cushions whose ends are cut back into the pocket jaws; a moulded rail
// mitred round the whole table; six leather pocket plates over throats
// that drop into string nets on brass pocket irons; a deep apron; and eight
// turned legs, fluted on the shaft and the bulb, on square plinths.

const { bed: H, nose, cushion, rail, railTop, apron } = TABLE
const CLOTH = 0.06 // the baize tile, metres

// ---- cross-sections ----
// the cushion, from the nose back onto the rail: [inset from the nose, height above the bed]
const CUSHION = [[-cushion, 0.02], [-cushion, nose + 0.014], [-cushion, nose + 0.014], [-0.03, nose + 0.0135], [-0.016, nose + 0.012], [-0.007, nose + 0.009], [-0.002, nose + 0.005], [0, nose], [0.001, 0.024], [0.0045, 0.012], [0.006, 0.0005], [0.006, 0.0005]]
// the rail: outer face, a rounded top edge, the flat top under the pockets, down to the bed inside
const RAIL = [[0, H - 0.04], [0, H - 0.04], [0, H + railTop - 0.014], [0.003, H + railTop - 0.005], [0.009, H + railTop - 0.001], [0.016, H + railTop], [0.016, H + railTop], [rail - cushion, H + railTop], [rail - cushion, H + railTop], [rail - cushion, H + 0.015], [rail - cushion + 0.003, H]]
// the apron: a cove under the rail, the board, and a bead along the bottom
const APRON = [[0.012, H - 0.04 - apron], [0.012, H - 0.04 - apron], [0.002, H - 0.04 - apron + 0.004], [0.002, H - 0.04 - apron + 0.014], [0.0, H - 0.04 - apron + 0.022], [0.006, H - 0.04 - apron + 0.03], [0.006, H - 0.04 - apron + 0.03], [0.006, H - 0.05], [0.0, H - 0.044], [-0.0, H - 0.04], [-0.0, H - 0.04], [0.06, H - 0.04]]
// a pocket throat: [radius, height]: the leather lip and tube down through the bed
const THROAT = (r) => [[r + 0.012, H + railTop + 0.004], [r + 0.004, H + railTop + 0.0045], [r, H + railTop + 0.002], [r - 0.002, H + railTop - 0.01], [r - 0.002, H - 0.045], [r + 0.004, H - 0.05]]
// the net below it, drawing in to a brass ring at the bottom
const NET = (r) => [[r + 0.004, H - 0.05], [r + 0.01, H - 0.1], [r + 0.004, H - 0.17], [r - 0.012, H - 0.205]]

// A turned leg: [radius, height, fluted] rows; where `fluted` is set the
// surface is cut with round flutes. Built on the airliner's grid so the
// seam normals join. UVs follow the roulette lathe's: u laps, v in metres.
const LEG = [
  [0.072, 0.062, 0], [0.072, 0.07, 0], [0.066, 0.076, 0], [0.066, 0.082, 0], [0.078, 0.095, 0], [0.085, 0.125, 1], [0.084, 0.16, 1], [0.077, 0.2, 1], [0.066, 0.235, 1], [0.06, 0.25, 0],
  [0.06, 0.258, 0], [0.066, 0.262, 0], [0.066, 0.27, 0], [0.058, 0.28, 0], [0.058, 0.295, 1], [0.061, 0.4, 1], [0.064, 0.52, 1], [0.064, 0.53, 0],
  [0.07, 0.537, 0], [0.07, 0.545, 0], [0.062, 0.555, 0], [0.062, 0.565, 0], [0.072, 0.571, 0], [0.072, 0.579, 0], [0.062, 0.586, 0], [0.062, 0.6, 0],
]
function legGeometry() {
  const N = LEG.length
  const seg = 128
  const flutes = 14
  const arc = [0]
  for (let i = 1; i < N; i++) arc.push(arc[i - 1] + Math.hypot(LEG[i][0] - LEG[i - 1][0], LEG[i][1] - LEG[i - 1][1]))
  const g = grid(
    N,
    seg + 1,
    (i, j, P, U) => {
      const [r0, y, fl] = LEG[i]
      const a = (j / seg) * Math.PI * 2
      // a round flute: deepest at its centre, with a land between flutes
      const c = Math.cos(a * flutes)
      const cut = fl ? 0.0065 * Math.max(0, c) ** 0.7 * Math.min(1, (arc[i] - 0) * 40) : 0
      const r = r0 - cut
      P.set(r * Math.cos(a), y, r * Math.sin(a))
      U.set((j / seg) * 4, arc[i] / WOOD.across)
    },
    { wrap: true },
  )
  return g
}

// A pocket plate: the leather that covers the rail round the pocket, the
// part of a disc that lands on the rail, with the throat cut out.
function plateGeometry(p) {
  const R = p.corner ? 0.1 : 0.094
  const s = new THREE.Shape()
  const n = 64
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2
    const x = Math.max(-OX, Math.min(OX, p.x + R * Math.cos(a)))
    const z = Math.max(-OZ, Math.min(OZ, p.z + R * Math.sin(a)))
    k ? s.lineTo(x, -z) : s.moveTo(x, -z)
  }
  const hole = new THREE.Path()
  hole.absarc(p.x, -p.z, p.r + 0.009, 0, Math.PI * 2, true)
  s.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0045, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 24 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, H + railTop + 0.0015, 0)
  // leather grain in centimetres
  const uv = g.attributes.uv
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 0.05, uv.getY(k) / 0.05)
  return g
}

// a line of stitching round the plate's edge
function stitchGeometry(p) {
  const R = (p.corner ? 0.1 : 0.094) - 0.007
  const pts = []
  for (let k = 0; k <= 96; k++) {
    const a = (k / 96) * Math.PI * 2
    const x = Math.max(-OX + 0.007, Math.min(OX - 0.007, p.x + R * Math.cos(a)))
    const z = Math.max(-OZ + 0.007, Math.min(OZ - 0.007, p.z + R * Math.sin(a)))
    pts.push(new THREE.Vector3(x, H + railTop + 0.008, z))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 192, 0.0007, 5, true)
}

// The brass pocket iron: a bent rod from under the rail down round the net
// and back, as a tube along a curve.
function ironGeometry(p) {
  const out = new THREE.Vector2(p.sx, p.sz).normalize()
  if (!p.corner) out.set(0, p.sz)
  const side = new THREE.Vector2(-out.y, out.x)
  const at = (o, sd, y) => new THREE.Vector3(p.x + out.x * o + side.x * sd, y, p.z + out.y * o + side.y * sd)
  const r = p.r
  const pts = [at(-0.01, -r - 0.02, H - 0.045), at(0.02, -r - 0.03, H - 0.09), at(0.025, -r - 0.028, H - 0.16), at(0.0, -r + 0.004, H - 0.205), at(-0.03, 0, H - 0.212), at(0.0, r - 0.004, H - 0.205), at(0.025, r + 0.028, H - 0.16), at(0.02, r + 0.03, H - 0.09), at(-0.01, r + 0.02, H - 0.045)]
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.0035, 10, false)
}

// The markings as one ink mask over the playing area: the baulk line, the
// D and the six spots.
function buildPrint() {
  const W = 4096
  const k = W / PLAYW
  const c = Object.assign(document.createElement('canvas'), { width: W, height: Math.round(PLAYH * k) })
  const g = c.getContext('2d')
  const X = (x) => (x + HX) * k
  const Z = (z) => (z + HZ) * k
  g.fillStyle = '#000'
  g.fillRect(0, 0, c.width, c.height)
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'
  g.lineWidth = 0.0022 * k
  g.beginPath()
  g.moveTo(X(BAULK_X), Z(-HZ))
  g.lineTo(X(BAULK_X), Z(HZ))
  g.stroke()
  g.beginPath()
  g.arc(X(BAULK_X), Z(0), D_R * k, Math.PI / 2, (3 * Math.PI) / 2)
  g.stroke()
  for (const [x, z] of Object.values(SPOTS)) {
    g.beginPath()
    g.arc(X(x), Z(z), 0.0045 * k, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = 16
  return t
}
const PLAYW = HX * 2
const PLAYH = HZ * 2

// the bed cloth: baize with the markings mixed in, cut away over the pockets
function clothMaterial(uni, felt) {
  const m = new THREE.MeshPhysicalMaterial({ map: felt, bumpMap: felt, bumpScale: 0.3, roughness: 0.97, sheen: 0.55, sheenRoughness: 0.65 })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uPrint;\nuniform vec4 uTop;\nuniform vec3 uLine;\nuniform vec3 uPockets[${POCKETS.length}];\nvarying vec2 vP;`)
      .replace(
        '#include <map_fragment>',
        `for (int i = 0; i < ${POCKETS.length}; i++) if (distance(vP, uPockets[i].xy) < uPockets[i].z) discard;
        vec2 pu = vec2((vP.x - uTop.x) / uTop.z, 1.0 - (vP.y - uTop.y) / uTop.w);
        float ink = (pu.x > 0.0 && pu.x < 1.0 && pu.y > 0.0 && pu.y < 1.0) ? texture2D(uPrint, pu).r : 0.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, uLine, ink * 0.9);
        #include <map_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'snooker-cloth'
  return m
}

// A cushion along one side between two pockets. The path runs along the
// nose; at each end the cross-section's plane is turned so the end face is
// cut back into the pocket's jaw.
function cushionGeometry(a, b, n, jawA, jawB) {
  const along = { x: b[0] - a[0], z: b[1] - a[1] }
  const len = Math.hypot(along.x, along.z)
  along.x /= len
  along.z /= len
  // the sheared normal at an end: turned towards `dir` (+1 forwards, -1 back) by the jaw angle
  const sheared = (dir, ang) => ({ nx: n[0] * Math.cos(ang) + dir * along.x * Math.sin(ang), nz: n[1] * Math.cos(ang) + dir * along.z * Math.sin(ang) })
  const path = [
    { x: a[0], z: a[1], s: 0, ...sheared(-1, jawA) },
    { x: b[0], z: b[1], s: len, ...sheared(1, jawB) },
  ]
  return sweep(path, CUSHION.map(([d, y]) => [d, H + y]), { caps: true, along: CLOTH, across: CLOTH })
}

function buildGeometry() {
  const jc = THREE.MathUtils.degToRad(38)
  const jm = THREE.MathUtils.degToRad(18)
  const cushions = []
  for (const sz of [-1, 1]) {
    // the two long cushions on this side, either side of the middle pocket
    const z = sz * HZ
    const n = [0, -sz]
    const run = (x0, x1, j0, j1) => cushions.push(cushionGeometry([x0, z], [x1, z], n, j0, j1))
    if (sz > 0) {
      run(-HX + JAW.corner, -JAW.middle, jc, jm)
      run(JAW.middle, HX - JAW.corner, jm, jc)
    } else {
      run(HX - JAW.corner, JAW.middle, jc, jm)
      run(-JAW.middle, -HX + JAW.corner, jm, jc)
    }
  }
  // the two short cushions
  cushions.push(cushionGeometry([HX, HZ - JAW.corner], [HX, -HZ + JAW.corner], [-1, 0], jc, jc))
  cushions.push(cushionGeometry([-HX, -HZ + JAW.corner], [-HX, HZ - JAW.corner], [1, 0], jc, jc))

  const legs = legGeometry()
  const plinth = boxUV(new THREE.BoxGeometry(0.17, 0.062, 0.17).translate(0, 0.031, 0), 'y')
  const capital = boxUV(new THREE.BoxGeometry(0.15, H - 0.04 - apron - 0.595 + 0.002, 0.15).translate(0, (H - 0.04 - apron + 0.595) / 2, 0), 'y')

  return {
    cloth: flat(
      [[-OX + 0.02, -OZ + 0.02], [OX - 0.02, -OZ + 0.02], [OX - 0.02, OZ - 0.02], [-OX + 0.02, OZ - 0.02]],
      H,
      true,
      CLOTH,
    ),
    cushions,
    rail: sweep(rectPath(OX, OZ), RAIL),
    apron: sweep(rectPath(OX - 0.012, OZ - 0.012), APRON),
    under: flat([[-OX, -OZ], [OX, -OZ], [OX, OZ], [-OX, OZ]], H - 0.04 - apron + 0.001, false, 1),
    bedUnder: flat([[-OX + 0.02, -OZ + 0.02], [OX - 0.02, -OZ + 0.02], [OX - 0.02, OZ - 0.02], [-OX + 0.02, OZ - 0.02]], H - 0.05, false, 1),
    legs,
    plinth,
    capital,
    pockets: POCKETS.map((p) => ({
      p,
      plate: plateGeometry(p),
      stitch: stitchGeometry(p),
      throat: lathe(THROAT(p.r), 48, 1, 0.05),
      net: lathe(NET(p.r), 40, 1, 0),
      ring: new THREE.TorusGeometry(p.r - 0.012, 0.003, 10, 48).rotateX(Math.PI / 2).translate(p.x, H - 0.205, p.z),
      iron: ironGeometry(p),
    })),
    ball: new THREE.SphereGeometry(BALL_R, 48, 32),
  }
}

// the net: a string mesh, drawn as an alpha map
function buildNet() {
  const S = 128
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, S, S)
  g.strokeStyle = '#fff'
  g.lineWidth = 7
  g.lineCap = 'round'
  g.beginPath()
  for (let k = -1; k <= 1; k++) {
    g.moveTo(0, k * S)
    g.lineTo(S, (k + 1) * S)
    g.moveTo(0, (k + 1) * S)
    g.lineTo(S, k * S)
  }
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(10, 3)
  return t
}

const BALLS = (() => {
  const out = reds().map(([x, z]) => ({ x, z, c: 'red' }))
  for (const [k, [x, z]] of Object.entries(SPOTS)) out.push({ x, z, c: k })
  out.push({ x: BAULK_X - 0.12, z: -0.07, c: 'white' })
  return out
})()

export default function SnookerTable({ feltColor = '#1a7a2e', woodColor = '#6e3419', leatherColor = '#b98a5a', metalColor = '#c9a557', lineColor = '#e9e6dc', balls = true }) {
  const invalidate = useThree((s) => s.invalidate)
  const geo = useMemo(buildGeometry, [])
  const tex = useMemo(() => {
    const peel = buildPeel()
    peel.repeat.set(24, 3)
    const grain = buildWood()
    return { grain, peel, leather: buildLeather(), felt: buildFelt(), print: buildPrint(), net: buildNet() }
  }, [])
  const uni = useMemo(
    () => ({
      uPrint: { value: tex.print },
      uTop: { value: new THREE.Vector4(-HX, -HZ, PLAYW, PLAYH) },
      uLine: { value: new THREE.Color() },
      uPockets: { value: POCKETS.map((p) => new THREE.Vector3(p.x, p.z, p.r)) },
    }),
    [tex],
  )
  const mats = useMemo(() => {
    const m = {
      wood: new THREE.MeshPhysicalMaterial({ map: tex.grain, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.2, clearcoatNormalMap: tex.peel, clearcoatNormalScale: new THREE.Vector2(0.06, 0.06) }),
      cloth: clothMaterial(uni, tex.felt),
      cushion: new THREE.MeshPhysicalMaterial({ map: tex.felt, bumpMap: tex.felt, bumpScale: 0.3, roughness: 0.97, sheen: 0.55, sheenRoughness: 0.65 }),
      leather: new THREE.MeshPhysicalMaterial({ roughness: 0.55, normalMap: tex.leather, normalScale: new THREE.Vector2(0.45, 0.45), sheen: 0.3, sheenRoughness: 0.6, clearcoat: 0.1, clearcoatRoughness: 0.5, side: THREE.DoubleSide }),
      thread: new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.8 }),
      brass: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.25 }),
      net: new THREE.MeshStandardMaterial({ color: '#f1ead8', roughness: 0.9, alphaMap: tex.net, alphaTest: 0.5, side: THREE.DoubleSide }),
      dark: new THREE.MeshStandardMaterial({ color: '#0a0909', roughness: 0.95 }),
      balls: Object.fromEntries(Object.entries(COLOURS).map(([k, c]) => [k, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 })])),
    }
    return m
  }, [tex, uni])
  useLayoutEffect(() => {
    mats.wood.color.set(woodColor)
    mats.cloth.color.set(feltColor)
    mats.cloth.sheenColor.set(feltColor).lerp(new THREE.Color('#ffffff'), 0.2)
    mats.cushion.color.set(feltColor)
    mats.cushion.sheenColor.copy(mats.cloth.sheenColor)
    mats.leather.color.set(leatherColor)
    mats.leather.sheenColor.set(leatherColor).lerp(new THREE.Color('#ffffff'), 0.25)
    mats.brass.color.set(metalColor)
    uni.uLine.value.set(lineColor)
    invalidate()
  }, [mats, uni, feltColor, woodColor, leatherColor, metalColor, lineColor, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => (m.dispose ? m.dispose() : Object.values(m).forEach((b) => b.dispose())))
      Object.values(tex).forEach((t) => t.dispose())
      const dispose = (g) => (g.dispose ? g.dispose() : Array.isArray(g) ? g.forEach(dispose) : Object.values(g).forEach(dispose))
      dispose(geo)
    },
    [mats, tex, geo],
  )

  return (
    <group>
      <mesh geometry={geo.cloth} material={mats.cloth} receiveShadow />
      {geo.cushions.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.cushion} castShadow receiveShadow />
      ))}
      <mesh geometry={geo.rail} material={mats.wood} castShadow receiveShadow />
      <mesh geometry={geo.apron} material={mats.wood} castShadow receiveShadow />
      <mesh geometry={geo.under} material={mats.dark} />
      <mesh geometry={geo.bedUnder} material={mats.dark} />
      {LEG_X.flatMap((x) =>
        [-LEG_Z, LEG_Z].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh geometry={geo.plinth} material={mats.wood} castShadow receiveShadow />
            <mesh geometry={geo.legs} material={mats.wood} castShadow receiveShadow />
            <mesh geometry={geo.capital} material={mats.wood} castShadow receiveShadow />
          </group>
        )),
      )}
      {geo.pockets.map(({ p, plate, stitch, throat, net, ring, iron }, i) => (
        <group key={i}>
          <mesh geometry={plate} material={mats.leather} castShadow receiveShadow />
          <mesh geometry={stitch} material={mats.thread} />
          <mesh geometry={throat} material={mats.leather} position={[p.x, 0, p.z]} />
          <mesh geometry={net} material={mats.net} position={[p.x, 0, p.z]} />
          <mesh geometry={ring} material={mats.brass} castShadow />
          <mesh geometry={iron} material={mats.brass} castShadow />
        </group>
      ))}
      {balls &&
        BALLS.map((b, i) => <mesh key={i} geometry={geo.ball} material={mats.balls[b.c]} position={[b.x, H + BALL_R, b.z]} castShadow receiveShadow />)}
    </group>
  )
}
