import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildPeel, buildWood } from '../gameboard/textures.js'
import { WOOD, boxUV, flat, inset, lathe, loop, rectPath, sweep } from './build.js'
import { INK, LAY, LAY_H, LAY_W, TABLE, WHEEL, buildOutline } from './layout.js'
import { buildFelt, buildLayout, buildLeather } from './textures.js'

// The roulette table itself, without the wheel: a kidney-shaped top with a
// padded leather arm rail swept round its edge (a plain wooden rail along
// the croupier's stretch), baize printed with the betting layout, a turned
// wooden surround for the wheel, a moulded apron, and two lyre pedestals on
// moulded feet joined by a stretcher.
//
// The cloth's print is three ink masks mixed over the cloth colour in the
// shader, so the baize can be any colour and the weave still shows through
// the ink.

const { H, railW, padH, apron } = TABLE
const LEG_X = 0.7
const LEG_Z = -0.05

// ---- cross-sections: [inset from the table's edge, height above the cloth] ----
// the padded rail: tucked under at the outside, a full soft crown, down to the cloth
const PAD = (() => {
  const p = [[0.02, -0.03], [0.004, -0.03], [0.001, -0.028], [0, -0.024], [0, 0]]
  const n = 22
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI
    const c = Math.cos(a)
    p.push([(railW / 2) * (1 - Math.sign(c) * Math.abs(c) ** 0.75), padH * Math.sin(a) ** 0.55])
  }
  p.push([railW - 0.003, -0.004])
  return p
})()
// the croupier's rail: flat hardwood with eased edges
const BAR = (() => {
  const p = [[0.02, -0.03], [0.006, -0.03], [0.004, -0.028], [0.004, 0.01]]
  for (let i = 1; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2)
    p.push([0.01 - Math.cos(a) * 0.006, 0.01 + Math.sin(a) * 0.006])
  }
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2)
    p.push([railW - 0.008 + Math.sin(a) * 0.006, 0.01 + Math.cos(a) * 0.006])
  }
  p.push([railW - 0.002, -0.002])
  return p
})()
// the apron: underside, a rounded bottom edge, a flat face and a bead under the rail
const APRON = [
  [0.12, -apron],
  [0.03, -apron],
  [0.03, -apron],
  [0.025, -apron + 0.004],
  [0.022, -apron + 0.011],
  [0.022, -0.08],
  [0.022, -0.08],
  [0.017, -0.076],
  [0.013, -0.067],
  [0.016, -0.059],
  [0.018, -0.057],
  [0.018, -0.057],
  [0.018, -0.024],
]
// the wheel's wooden surround: a raised plate with a small bevel
const DECK = [[0, 0], [0.001, 0.004], [0.004, 0.006], [0.004, 0.006], [0.135, 0.006]]
// a foot: plinth, step, cove and a flat top (closed over the middle)
const FOOT = (hx) => {
  const p = [[0, 0], [0, 0], [0, 0.046]]
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2)
    p.push([0.006 - Math.cos(a) * 0.006, 0.046 + Math.sin(a) * 0.006])
  }
  p.push([0.016, 0.052], [0.016, 0.052])
  for (let i = 1; i <= 6; i++) {
    const t = i / 6
    p.push([0.016 + 0.018 * Math.sin((t * Math.PI) / 2), 0.052 + 0.036 * (1 - Math.cos((t * Math.PI) / 2))])
  }
  p.push([0.034, 0.088], [0.038, 0.1], [0.038, 0.1], [hx, 0.1])
  return p
}
// the block a pedestal carries the table on, moulded underneath
const HEAD = (hx) => [[hx, 0.588], [0.034, 0.588], [0.034, 0.588], [0.03, 0.6], [0.012, 0.606], [0.012, 0.606], [0.002, 0.614], [0, 0.62], [0, H - apron + 0.002]]
// a brass stud let into the rail
const STUD = [[0.031, -0.002], [0.031, 0.002], [0.029, 0.0036], [0.022, 0.0036], [0.02, 0.0016], [0, 0.0016]]

// the cloth: baize with the layout's ink masks mixed in
function clothMaterial(uni, felt) {
  const m = new THREE.MeshPhysicalMaterial({ map: felt, bumpMap: felt, bumpScale: 0.35, roughness: 0.96, sheen: 0.6, sheenRoughness: 0.6 })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uPrint;\nuniform vec4 uLay;\nuniform vec3 uRed;\nuniform vec3 uBlack;\nuniform vec3 uLine;\nvarying vec2 vP;')
      .replace(
        '#include <map_fragment>',
        `vec3 ink = texture2D(uPrint, vec2((vP.x - uLay.x) / uLay.z, 1.0 - (vP.y - uLay.y) / uLay.w)).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, uRed, ink.g * 0.95);
        diffuseColor.rgb = mix(diffuseColor.rgb, uBlack, ink.b * 0.95);
        diffuseColor.rgb = mix(diffuseColor.rgb, uLine, ink.r * 0.93);
        #include <map_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'roulette-cloth'
  return m
}

function buildGeometry() {
  const { pts, total, gap } = buildOutline()
  const at = (s) => pts.reduce((best, p) => (Math.abs(p.s - s) < Math.abs(best.s - s) ? p : best))
  // the leather rail runs from the end of the croupier's stretch all the way round to its start
  const padPath = [...pts.slice(gap[1]), ...pts.slice(0, gap[0] + 1).map((p) => ({ ...p, s: p.s + total }))]
  const barPath = pts.slice(gap[0], gap[1] + 1)
  const all = loop(pts, total)

  // the wheel's surround: a disc about the wheel, cut off where it meets the rail
  const lim = inset(pts, railW - 0.008)
  const deckPath = []
  const M = 240
  for (let j = 0; j <= M; j++) {
    const a = (j / M) * Math.PI * 2
    const dx = Math.sin(a)
    const dz = Math.cos(a)
    let r = WHEEL.deck
    for (let i = 0; i < lim.length; i++) {
      const A = lim[i]
      const B = lim[(i + 1) % lim.length]
      const ex = B[0] - A[0]
      const ez = B[1] - A[1]
      const den = dx * ez - dz * ex
      if (Math.abs(den) < 1e-12) continue
      const ox = A[0] - WHEEL.x
      const oz = A[1] - WHEEL.z
      const t = (ox * ez - oz * ex) / den
      const u = (ox * dz - oz * dx) / den
      if (t > 0 && u >= 0 && u <= 1 && t < r) r = t
    }
    deckPath.push({ x: WHEEL.x + dx * r, z: WHEEL.z + dz * r, nx: -dx, nz: -dz, s: a * 0.45 })
  }

  // a pedestal: a lyre-shaped slab, its edges eased
  const lyre = new THREE.Shape()
  lyre.moveTo(-0.27, 0.098)
  lyre.bezierCurveTo(-0.27, 0.2, -0.115, 0.21, -0.115, 0.34)
  lyre.bezierCurveTo(-0.115, 0.47, -0.3, 0.47, -0.3, 0.59)
  lyre.lineTo(0.3, 0.59)
  lyre.bezierCurveTo(0.3, 0.47, 0.115, 0.47, 0.115, 0.34)
  lyre.bezierCurveTo(0.115, 0.21, 0.27, 0.2, 0.27, 0.098)
  lyre.closePath()
  let pedestal = new THREE.ExtrudeGeometry(lyre, { depth: 0.094, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 30 })
  pedestal.translate(0, 0, -0.047).rotateY(Math.PI / 2)
  pedestal = toCreasedNormals(pedestal, 0.7)
  {
    // grain up the slab; the curved edges take it along their length
    const p = pedestal.attributes.position
    const n = pedestal.attributes.normal
    const uv = new Float32Array(p.count * 2)
    for (let i = 0; i < p.count; i++) {
      const face = Math.abs(n.getX(i)) > 0.7
      uv[i * 2] = (p.getY(i) + (face ? 0 : Math.abs(p.getZ(i)) * 0.7)) / WOOD.along
      uv[i * 2 + 1] = face ? p.getZ(i) / WOOD.across + p.getX(i) * 9 : p.getX(i) / WOOD.across + 0.37
    }
    pedestal.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }

  return {
    pad: sweep(padPath, PAD, { caps: true, along: 0.07, across: 0.07 }),
    bar: sweep(barPath, BAR, { caps: true }),
    apron: sweep(all, APRON),
    under: flat(inset(pts, 0.03), -apron + 0.001, false, WOOD.along, WOOD.across),
    cloth: flat(inset(pts, railW - 0.006), 0, true, 0.06),
    deck: sweep(deckPath, DECK),
    studs: [1.15, 1.93, 2.76, 3.57, 4.75, 6.0].map((s) => {
      const p = at(s)
      return [p.x + p.nx * (railW / 2), padH - 0.0012, p.z + p.nz * (railW / 2)]
    }),
    stud: lathe(STUD, 48, 1, 0),
    pedestal,
    foot: sweep(rectPath(0.1, 0.36), FOOT(0.1)),
    head: sweep(rectPath(0.095, 0.345), HEAD(0.095)),
    stretcher: boxUV(new RoundedBoxGeometry(2 * LEG_X - 0.08, 0.1, 0.046, 3, 0.006)),
  }
}

export default function Table({ feltColor = '#0f6b3a', woodColor = '#6a3420', leatherColor = '#33201a', metalColor = '#c9a557' }) {
  const invalidate = useThree((s) => s.invalidate)
  const geo = useMemo(buildGeometry, [])
  const tex = useMemo(() => {
    const peel = buildPeel()
    peel.repeat.set(24, 3)
    const leather = buildLeather()
    return { grain: buildWood(), peel, leather, felt: buildFelt(), print: buildLayout() }
  }, [])
  const uni = useMemo(
    () => ({
      uPrint: { value: tex.print },
      uLay: { value: new THREE.Vector4(LAY.x - LAY.pad, LAY.z - LAY.pad, LAY_W + 2 * LAY.pad, LAY_H + 2 * LAY.pad) },
      uRed: { value: new THREE.Color(INK.red) },
      uBlack: { value: new THREE.Color(INK.black) },
      uLine: { value: new THREE.Color('#efe7d2') },
    }),
    [tex],
  )
  const mats = useMemo(
    () => ({
      wood: new THREE.MeshPhysicalMaterial({ map: tex.grain, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.24, clearcoatNormalMap: tex.peel, clearcoatNormalScale: new THREE.Vector2(0.06, 0.06) }),
      leather: new THREE.MeshPhysicalMaterial({ roughness: 0.52, normalMap: tex.leather, normalScale: new THREE.Vector2(0.55, 0.55), sheen: 0.35, sheenRoughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.5 }),
      cloth: clothMaterial(uni, tex.felt),
      metal: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.24 }),
    }),
    [tex, uni],
  )
  useLayoutEffect(() => {
    mats.wood.color.set(woodColor)
    mats.leather.color.set(leatherColor)
    mats.leather.sheenColor.set(leatherColor).lerp(new THREE.Color('#ffffff'), 0.25)
    mats.cloth.color.set(feltColor)
    mats.cloth.sheenColor.set(feltColor).lerp(new THREE.Color('#ffffff'), 0.2)
    mats.metal.color.set(metalColor)
    invalidate()
  }, [mats, feltColor, woodColor, leatherColor, metalColor, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      Object.values(tex).forEach((t) => t.dispose())
      Object.values(geo).forEach((g) => g.dispose?.())
    },
    [mats, tex, geo],
  )

  return (
    <group>
      <group position-y={H}>
        <mesh geometry={geo.pad} material={mats.leather} castShadow receiveShadow />
        <mesh geometry={geo.bar} material={mats.wood} castShadow receiveShadow />
        <mesh geometry={geo.apron} material={mats.wood} castShadow receiveShadow />
        <mesh geometry={geo.under} material={mats.wood} castShadow />
        <mesh geometry={geo.cloth} material={mats.cloth} castShadow receiveShadow />
        <mesh geometry={geo.deck} material={mats.wood} receiveShadow />
        {geo.studs.map((p, i) => (
          <mesh key={i} geometry={geo.stud} material={mats.metal} position={p} />
        ))}
      </group>
      {[-LEG_X, LEG_X].map((x) => (
        <group key={x} position={[x, 0, LEG_Z]}>
          <mesh geometry={geo.foot} material={mats.wood} castShadow receiveShadow />
          <mesh geometry={geo.pedestal} material={mats.wood} castShadow receiveShadow />
          <mesh geometry={geo.head} material={mats.wood} castShadow receiveShadow />
        </group>
      ))}
      <mesh geometry={geo.stretcher} material={mats.wood} position={[0, 0.33, LEG_Z]} castShadow receiveShadow />
    </group>
  )
}
