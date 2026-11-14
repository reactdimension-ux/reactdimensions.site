import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { ASPHALT_TILE, COURT, GRIT_TILE, HX, HZ, buildAsphalt, buildGrit, buildWear } from './textures.js'

// A regulation tennis court on its slab, with the recommended run-off round
// it: 23.77 m by 10.97 m inside the lines, an acrylic hard surface over
// asphalt, and the net on its posts.
//
// The surface is one plane with a shader that works out everything from the
// world position: which side of the outer lines it is on (court colour or
// surround), the lines themselves (exact rectangles, antialiased, with
// edges that wander by a fraction of a millimetre where the paint met the
// grit), wear from a whole-court map, and a tiled sand-grit normal map for
// the texture of the acrylic up close. So the lines stay sharp at any zoom.
//
// The net is a real mesh pattern, 4.5 cm squares of 3 mm twine with the top
// six rows doubled, drawn by a box-filtered grid so it neither shimmers nor
// vanishes at a distance (it fades to the grey veil a net really is). Its
// cord sags from 1.07 m at the posts to 0.914 m at the centre strap; the
// crank on the winder post tightens it.

const { L2, W2, S2, SV, base, line, mark, postZ, postR, netPost, netCentre } = COURT
const NET_BOTTOM = 0.035
const NET_END = postZ - postR - 0.014
const SAG_SLACK = 0.03
const SAG_TAUT = 0.006

const f = (n) => n.toFixed(4)

function surfaceMaterial(uni) {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2) })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCP = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uCourt;
        uniform vec3 uSurround;
        uniform vec3 uLine;
        uniform float uWear;
        uniform sampler2D uWearMap;
        uniform vec2 uSize;
        varying vec2 vCP;
        // coverage of the rectangle r = (minX, minZ, maxX, maxZ), filtered by w
        float box(vec2 p, vec4 r, vec2 w) {
          vec2 a = smoothstep(r.xy - w, r.xy + w, p);
          vec2 b = 1.0 - smoothstep(r.zw - w, r.zw + w, p);
          return a.x * a.y * b.x * b.y;
        }
        // every line is symmetric about both axes, so test |p|
        float courtLines(vec2 q, vec2 w) {
          float m = box(q, vec4(${f(L2 - base)}, -1.0, ${f(L2)}, ${f(W2)}), w);                 // baselines
          m = max(m, box(q, vec4(-1.0, ${f(W2 - line)}, ${f(L2)}, ${f(W2)}), w));               // doubles sidelines
          m = max(m, box(q, vec4(-1.0, ${f(S2 - line)}, ${f(L2)}, ${f(S2)}), w));               // singles sidelines
          m = max(m, box(q, vec4(${f(SV - line)}, -1.0, ${f(SV)}, ${f(S2)}), w));               // service lines
          m = max(m, box(q, vec4(-1.0, -1.0, ${f(SV)}, ${f(line / 2)}), w));                    // centre service line
          m = max(m, box(q, vec4(${f(L2 - base - mark)}, -1.0, ${f(L2)}, ${f(line / 2)}), w));  // centre marks
          return m;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec4 grit = texture2D(normalMap, vNormalMapUv);
        vec4 wm = texture2D(uWearMap, vCP / uSize + 0.5);
        float lineM;
        float scuffM = wm.r * uWear;
        {
          vec2 w = fwidth(vCP) * 0.7 + 1e-5;
          // paint edges follow the grit a little
          vec2 q = abs(vCP + (vec2(grit.a, grit.r) - 0.5) * 0.0012);
          float inner = box(q, vec4(-1.0, -1.0, ${f(L2)}, ${f(W2)}), w);
          lineM = courtLines(q, w);
          vec3 base = mix(uSurround, uCourt, inner);
          base *= 0.93 + 0.14 * wm.a;
          float fade = wm.g * uWear;
          base = mix(base, base * 1.28 + vec3(0.012), fade * 0.8);
          vec3 col = mix(base, uLine * (0.95 + 0.05 * wm.a), lineM * (1.0 - fade * 0.25));
          col = mix(col, vec3(0.035, 0.031, 0.028), clamp(scuffM * 0.42, 0.0, 0.6));
          col = mix(col, vec3(0.33, 0.35, 0.14), clamp(wm.b * uWear * 0.5, 0.0, 0.6));
          col *= 0.62 + 0.76 * grit.a;
          diffuseColor.rgb *= col;
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.76, 0.56, lineM) - scuffM * 0.14 + (wm.a - 0.5) * 0.06;`,
      )
  }
  m.customProgramCacheKey = () => 'tennis-court-surface'
  return m
}

// the net: a box-filtered grid (lines at integer cells, 1/N of a cell wide)
function netMaterial(uni) {
  const m = new THREE.MeshStandardMaterial({ color: '#15191a', roughness: 0.55, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 gridUv;\nvarying vec2 vGrid;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrid = gridUv;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vGrid;
        uniform float uCell;
        uniform float uTwine;
        float holes(vec2 p, vec2 w, float N) {
          vec2 a = p + 0.5 * w;
          vec2 b = p - 0.5 * w;
          vec2 i = (floor(a) + min(fract(a) * N, 1.0) - floor(b) - min(fract(b) * N, 1.0)) / (N * w);
          return (1.0 - i.x) * (1.0 - i.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vGrid / uCell + vec2(0.5, 0.0);
          vec2 w = max(abs(dFdx(p)), abs(dFdy(p))) + 0.004;
          // the top six rows are double twine
          float tw = vGrid.y < uCell * 6.0 ? uTwine * 1.8 : uTwine;
          float cover = 1.0 - holes(p, w, uCell / tw);
          // knots where the strands cross
          vec2 k = abs(fract(p) - vec2(0.5 * tw / uCell)) ;
          float knot = 1.0 - smoothstep(tw * 0.85 / uCell, tw * 0.85 / uCell + max(w.x, w.y), length(min(k, 1.0 - k)));
          cover = max(cover, knot * (1.0 - smoothstep(0.05, 0.3, max(w.x, w.y))));
          diffuseColor.a *= cover;
          if (diffuseColor.a < 0.004) discard;
        }`,
      )
  }
  m.customProgramCacheKey = () => 'tennis-net-mesh'
  return m
}

// the height of the net cord at z: nearly straight lines from the posts down
// to the strap, with a little sag in each half
function cordY(z, sag) {
  const u = Math.min(1, Math.abs(z) / postZ)
  return netCentre + (netPost - netCentre) * u - sag * Math.sin(Math.PI * u)
}

const NC = 220
const NR = 20
// the headband's cross-section: white tape folded over the cord
const BAND = [
  [-0.0036, -0.066],
  [-0.0036, -0.004],
  [-0.0026, -0.0012],
  [0, 0.0004],
  [0.0026, -0.0012],
  [0.0036, -0.004],
  [0.0036, -0.066],
]

function netGeometries() {
  const net = new THREE.BufferGeometry()
  net.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NC + 1) * (NR + 1) * 3), 3))
  net.setAttribute('gridUv', new THREE.BufferAttribute(new Float32Array((NC + 1) * (NR + 1) * 2), 2))
  const idx = []
  for (let i = 0; i < NC; i++)
    for (let j = 0; j < NR; j++) {
      const a = i * (NR + 1) + j
      const b = (i + 1) * (NR + 1) + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  net.setIndex(idx)
  const band = new THREE.BufferGeometry()
  const P = BAND.length
  band.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NC + 1) * P * 3), 3))
  const bi = []
  for (let i = 0; i < NC; i++)
    for (let k = 0; k < P - 1; k++) {
      const a = i * P + k
      const b = (i + 1) * P + k
      bi.push(a, b, a + 1, b, b + 1, a + 1)
    }
  band.setIndex(bi)
  return { net, band }
}

// lay the net and headband out for a given sag
function shapeNet({ net, band }, sag) {
  const np = net.attributes.position.array
  const ng = net.attributes.gridUv.array
  const bp = band.attributes.position.array
  for (let i = 0; i <= NC; i++) {
    const z = -NET_END + (2 * NET_END * i) / NC
    const top = cordY(z, sag)
    const u = Math.abs(z) / postZ
    for (let j = 0; j <= NR; j++) {
      const v = j / NR
      const y = top + (NET_BOTTOM - top) * v
      // a slack net bellies out a little below the cord (not at the strap
      // or the posts, which hold it)
      const belly = (0.01 + sag * 1.2) * Math.sin(Math.PI * v) * Math.sin(Math.PI * u)
      const k = i * (NR + 1) + j
      np[k * 3] = belly
      np[k * 3 + 1] = y
      np[k * 3 + 2] = z
      ng[k * 2] = z + NET_END
      ng[k * 2 + 1] = top - y
    }
    BAND.forEach(([dx, dy], k) => {
      const o = (i * BAND.length + k) * 3
      bp[o] = dx
      bp[o + 1] = top + dy
      bp[o + 2] = z
    })
  }
  net.attributes.position.needsUpdate = true
  net.attributes.gridUv.needsUpdate = true
  band.attributes.position.needsUpdate = true
  net.computeVertexNormals()
  band.computeVertexNormals()
  net.computeBoundingSphere()
  band.computeBoundingSphere()
}

function Post({ side, mats, winder, onWind, crankRef }) {
  const [hover, setHover] = useState(false)
  useCursor(hover && winder)
  const z = side * postZ
  const out = side // outward, away from the court
  const H = netPost + 0.03
  return (
    <group position={[0, 0, z]}>
      <mesh material={mats.post} position-y={H / 2} castShadow receiveShadow>
        <cylinderGeometry args={[postR, postR, H, 40]} />
      </mesh>
      {/* domed cap with a lip */}
      <mesh material={mats.post} position-y={H} castShadow>
        <sphereGeometry args={[postR * 1.06, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={mats.post} position-y={H} rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[postR * 1.03, 0.003, 8, 40]} />
      </mesh>
      {/* the ground sleeve it stands in */}
      <mesh material={mats.steel} position-y={0.004} receiveShadow>
        <cylinderGeometry args={[postR + 0.016, postR + 0.02, 0.008, 40]} />
      </mesh>
      {/* the cord guide the net cord passes through, on the court side */}
      <mesh material={mats.steel} position={[0, netPost, -out * (postR + 0.006)]} castShadow>
        <boxGeometry args={[0.026, 0.03, 0.016]} />
      </mesh>
      {winder ? (
        <group
          position={[0, 0.42, out * (postR + 0.012)]}
          onClick={(e) => (e.stopPropagation(), onWind())}
          onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
          onPointerOut={() => setHover(false)}
        >
          {/* gearbox clamped to the post, with the crank on its shaft */}
          <mesh material={mats.post} position-z={out * 0.02} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.048, 0.048, 0.05, 36]} />
          </mesh>
          <mesh material={mats.post} position={[0, 0.045, out * 0.012]} castShadow>
            <boxGeometry args={[0.07, 0.05, 0.034]} />
          </mesh>
          <mesh material={mats.steel} position-z={out * 0.05} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.009, 0.009, 0.02, 16]} />
          </mesh>
          <group ref={crankRef} position-z={out * 0.06}>
            <mesh material={mats.steel} position-y={0.055} castShadow>
              <boxGeometry args={[0.02, 0.13, 0.009]} />
            </mesh>
            <mesh material={mats.steel} position-z={0} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.014, 0.014, 0.012, 20]} />
            </mesh>
            <mesh material={mats.grip} position={[0, 0.112, out * 0.042]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.0115, 0.0105, 0.07, 20]} />
            </mesh>
          </group>
        </group>
      ) : (
        // a cleat on the far post where the cord is tied off
        <mesh material={mats.steel} position={[0, 0.5, out * (postR + 0.008)]} castShadow>
          <boxGeometry args={[0.018, 0.09, 0.016]} />
        </mesh>
      )}
    </group>
  )
}

function Net({ mats, sagRef }) {
  const geo = useMemo(() => netGeometries(), [])
  useLayoutEffect(() => shapeNet(geo, sagRef.current), [geo, sagRef])
  useEffect(() => () => (geo.net.dispose(), geo.band.dispose()), [geo])
  const last = useRef(sagRef.current)
  useFrame(() => {
    if (Math.abs(last.current - sagRef.current) > 1e-5) {
      last.current = sagRef.current
      shapeNet(geo, sagRef.current)
    }
  })
  const strapH = netCentre + 0.004
  return (
    <group>
      <mesh geometry={geo.net} material={mats.net} renderOrder={2} />
      <mesh geometry={geo.band} material={mats.vinyl} castShadow receiveShadow />
      {/* the cord between the net's ends and the posts */}
      {[1, -1].map((s) => (
        <mesh key={s} material={mats.cord} position={[0, netPost - 0.002, s * (NET_END + postZ - postR) / 2]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.0032, 0.0032, postZ - postR - NET_END + 0.004, 8]} />
        </mesh>
      ))}
      {/* tension bars through the net's side edges, laced to the posts */}
      {[1, -1].map((s) => (
        <mesh key={s} material={mats.cord} position={[0, (NET_BOTTOM + netPost - 0.06) / 2, s * NET_END]} castShadow>
          <cylinderGeometry args={[0.005, 0.005, netPost - 0.06 - NET_BOTTOM, 10]} />
        </mesh>
      ))}
      {/* the bottom rope */}
      <mesh material={mats.cord} position-y={NET_BOTTOM} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.0035, 0.0035, NET_END * 2, 8]} />
      </mesh>
      {/* centre strap, its buckle and the anchor set in the court */}
      <mesh material={mats.vinyl} position-y={strapH / 2} castShadow receiveShadow>
        <boxGeometry args={[0.011, strapH, 0.05]} />
      </mesh>
      <mesh material={mats.steel} position-y={0.22} castShadow>
        <boxGeometry args={[0.016, 0.045, 0.058]} />
      </mesh>
      <mesh material={mats.steel} position-y={0.0015} receiveShadow>
        <boxGeometry args={[0.1, 0.003, 0.06]} />
      </mesh>
    </group>
  )
}

function SlabSides({ tex }) {
  const T = COURT.slab
  const m = useMemo(() => {
    const mk = (len) => {
      const t = tex.clone()
      t.repeat.set(len / ASPHALT_TILE, 1)
      t.needsUpdate = true
      return new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.002, roughness: 0.92 })
    }
    return { long: mk(2 * HX), short: mk(2 * HZ) }
  }, [tex])
  useEffect(() => () => Object.values(m).forEach((x) => (x.map.dispose(), x.dispose())), [m])
  return (
    <group position-y={-T / 2}>
      <mesh material={m.long} position-z={HZ} receiveShadow>
        <planeGeometry args={[2 * HX, T]} />
      </mesh>
      <mesh material={m.long} position-z={-HZ} rotation-y={Math.PI} receiveShadow>
        <planeGeometry args={[2 * HX, T]} />
      </mesh>
      <mesh material={m.short} position-x={HX} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[2 * HZ, T]} />
      </mesh>
      <mesh material={m.short} position-x={-HX} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[2 * HZ, T]} />
      </mesh>
      {/* invisible block that casts the slab's shadow on the floor */}
      <mesh castShadow>
        <boxGeometry args={[2 * HX, T - 0.01, 2 * HZ]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function Court({ courtColor = '#21406f', surroundColor = '#3a6a3e', lineColor = '#f4f4f0', postColor = '#1f4a30', wear = 0.35, sides = true }) {
  const invalidate = useThree((s) => s.invalidate)
  const grit = useMemo(() => {
    const t = buildGrit()
    t.repeat.set((2 * HX) / GRIT_TILE, (2 * HZ) / GRIT_TILE)
    return t
  }, [])
  const wearMap = useMemo(() => buildWear(), [])
  const asphalt = useMemo(() => buildAsphalt(), [])

  const uni = useMemo(
    () => ({
      uCourt: { value: new THREE.Color() },
      uSurround: { value: new THREE.Color() },
      uLine: { value: new THREE.Color() },
      uWear: { value: 0 },
      uWearMap: { value: wearMap },
      uSize: { value: new THREE.Vector2(2 * HX, 2 * HZ) },
      uCell: { value: 0.045 },
      uTwine: { value: 0.003 },
    }),
    [wearMap],
  )
  const mats = useMemo(() => {
    const surface = surfaceMaterial(uni)
    surface.normalMap = grit
    return {
      surface,
      net: netMaterial(uni),
      vinyl: new THREE.MeshPhysicalMaterial({ color: '#f3f3ef', roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.4, side: THREE.DoubleSide }),
      cord: new THREE.MeshStandardMaterial({ color: '#202322', roughness: 0.7 }),
      post: new THREE.MeshPhysicalMaterial({ color: postColor, roughness: 0.48, metalness: 0.1, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
      steel: new THREE.MeshStandardMaterial({ color: '#b9bdc0', roughness: 0.32, metalness: 1 }),
      grip: new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.6 }),
    }
  }, [uni, grit])

  useLayoutEffect(() => {
    uni.uCourt.value.set(courtColor)
    uni.uSurround.value.set(surroundColor)
    uni.uLine.value.set(lineColor)
    uni.uWear.value = wear
    mats.post.color.set(postColor)
    invalidate()
  }, [uni, mats, courtColor, surroundColor, lineColor, postColor, wear, invalidate])

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      grit.dispose()
      wearMap.dispose()
      asphalt.dispose()
    },
    [mats, grit, wearMap, asphalt],
  )

  // winding the crank takes the net from slack to taut and back
  const sag = useRef(SAG_SLACK)
  const crank = useRef()
  const wind = useRef(null)
  const onWind = () => {
    const taut = !(wind.current ? wind.current.to === SAG_TAUT : sag.current < (SAG_SLACK + SAG_TAUT) / 2)
    wind.current = { t: 0, from: sag.current, to: taut ? SAG_TAUT : SAG_SLACK, a0: crank.current?.rotation.z || 0, dir: taut ? 1 : -1 }
    invalidate()
  }
  useFrame((_, dt) => {
    const w = wind.current
    if (!w) return
    w.t = Math.min(1, w.t + Math.min(dt, 1 / 30) / 1.8)
    const k = w.t < 0.5 ? 2 * w.t * w.t : 1 - Math.pow(-2 * w.t + 2, 2) / 2
    sag.current = w.from + (w.to - w.from) * k
    if (crank.current) crank.current.rotation.z = w.a0 + w.dir * k * Math.PI * 2 * 5
    invalidate()
    if (w.t >= 1) wind.current = null
  })

  const surfGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(2 * HX, 2 * HZ, 1, 1)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  useEffect(() => () => surfGeo.dispose(), [surfGeo])

  return (
    <group>
      <mesh geometry={surfGeo} material={mats.surface} receiveShadow />
      {sides && <SlabSides tex={asphalt} />}
      <Net mats={mats} sagRef={sag} />
      <Post side={-1} mats={mats} winder onWind={onWind} crankRef={crank} />
      <Post side={1} mats={mats} />
    </group>
  )
}
