import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { DATA_IN, DATA_OUT, FINISHES, HOLE, LEAD_IN, PROGRAM_OUT, R, STACK_R, T, hubTexture, labelTexture } from './textures.js'

// A recordable CD, built the way one is made: a clear polycarbonate disc
// (with the stacking ring moulded under the hub), a dye layer and a thin
// metal mirror over the program area, and the printed lacquer label on top.
//
// The data side's rainbow is not a texture: the recording groove is a
// spiral 1.6 µm apart, a diffraction grating, so for every light the shader
// works out which wavelengths that point on the disc sends to the eye
// (d · (sin θi + sin θo) = m λ across the tracks, and only where light and
// eye line up along them) and adds those colours. That is why the bands
// sweep across the disc as you move round it but stay still as it spins.
//
// Drag the disc to spin it (it keeps its momentum, as the vinyl record in
// this library does), flip it over, or burn data onto it: the written part
// of a CD-R darkens, from the middle outwards, and a CD-R only takes it once.

const MIRROR_IN = 0.0205 // the metal layer starts a little inside the label
const PITCH = 1600 // track pitch, nm

const DYES = {
  cyanine: { color: '#9cc9cf', burned: '#5d8f9a' }, // blue-green
  phthalo: { color: '#e6d79c', burned: '#b2a26a' }, // pale gold
  azo: { color: '#4e67c4', burned: '#2c3f86' }, // deep blue
}

// a flat ring whose UVs span a square of half-size `span`, so a canvas the
// size of the disc maps straight onto it
function ring(inner, outer, span, segs = 256) {
  const g = new THREE.RingGeometry(inner, outer, segs, 2)
  const p = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) / span + 1) / 2, (p.getY(i) / span + 1) / 2)
  return g
}

// the polycarbonate body, turned from its section: hole wall, data side
// with the stacking ring, the edge, and the top
function bodyGeometry() {
  const p = [
    [HOLE, 0.00025],
    [HOLE + 0.00025, 0],
    [STACK_R - 0.0005, 0],
    [STACK_R - 0.00025, -0.00017],
    [STACK_R + 0.00025, -0.00017],
    [STACK_R + 0.0005, 0],
    [R - 0.0003, 0],
    [R - 0.00008, 0.00009],
    [R, 0.0003],
    [R, T - 0.0003],
    [R - 0.00008, T - 0.00009],
    [R - 0.0003, T],
    [HOLE + 0.00025, T],
    [HOLE, T - 0.00025],
    [HOLE, 0.00025],
  ]
  const g = new THREE.LatheGeometry(
    p.map(([r, y]) => new THREE.Vector2(r, y)),
    192,
  )
  g.computeVertexNormals()
  return g
}

const diffVert = `
varying vec3 vP; varying vec3 vN; varying vec3 vC;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vC = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const diffFrag = `
#define NL 5
uniform vec3 lp[NL]; uniform float li[NL]; uniform float ls[NL];
uniform float pitch; uniform float strength; uniform float rIn; uniform float rOut;
varying vec3 vP; varying vec3 vN; varying vec3 vC;
// visible spectrum to RGB (after Zucconi's fit)
vec3 spectral(float w) {
  if (w < 400.0 || w > 700.0) return vec3(0.0);
  float x = (w - 400.0) / 300.0;
  vec3 a = vec3(3.54541723, 2.86670055, 2.29421995) * (x - vec3(0.69548916, 0.49416934, 0.28269708));
  vec3 c = max(1.0 - a * a - vec3(0.02320775, 0.15936245, 0.53520021), 0.0);
  return c * smoothstep(400.0, 425.0, w) * (1.0 - smoothstep(675.0, 700.0, w));
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  float nv = dot(N, V);
  if (nv <= 0.0) discard;
  vec3 d = vP - vC;
  d -= N * dot(d, N);
  float r = length(d);
  vec3 Tr = d / max(r, 1e-7); // across the tracks
  vec3 B = cross(N, Tr); // along them
  vec3 col = vec3(0.0);
  for (int i = 0; i < NL; i++) {
    vec3 L = normalize(lp[i] - vP);
    if (dot(L, N) <= 0.0) continue;
    vec3 h = L + V;
    float along = dot(h, B);
    float w = exp(-along * along / (ls[i] * ls[i]));
    if (w < 0.002) continue;
    float u = abs(dot(h, Tr));
    for (int m = 1; m <= 3; m++) col += spectral(pitch * u / float(m)) * w * li[i] / float(m * m);
  }
  float inside = smoothstep(rIn, rIn + 0.0005, r) * (1.0 - smoothstep(rOut - 0.0008, rOut, r));
  // grazing angles lose the colour into the clear coat's own reflection
  gl_FragColor = vec4(col * strength * inside * smoothstep(0.0, 0.25, nv), 1.0);
}`

// the studio's soft boxes and key light (stage.jsx), as the disc sees them
const LIGHTS = [
  [[0, 3, 0.5], 0.9, 0.11],
  [[-2.5, 1.4, 1.8], 0.6, 0.09],
  [[2.6, 1.2, -1.2], 0.35, 0.09],
  [[0, 0.6, 3], 0.2, 0.1],
  [[-0.9, 1.6, 0.8], 1.4, 0.035],
]

// Colour pickers and text fields fire on every keystroke; the label is a
// 2048 px canvas, so wait until the value settles before redrawing it.
function useSettled(value, ms = 200) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const mbAt = (r) => (700 * Math.max(0, r * r - LEAD_IN * LEAD_IN)) / (PROGRAM_OUT * PROGRAM_OUT - LEAD_IN * LEAD_IN)
const rAt = (frac) => Math.sqrt(LEAD_IN * LEAD_IN + frac * (PROGRAM_OUT * PROGRAM_OUT - LEAD_IN * LEAD_IN))

const Disc = forwardRef(function Disc({ brand = 'RD', capacity = '700', finish = 'silver', dye = 'cyanine', burned = 0, side = 'label', rainbow = 1, onInfo }, ref) {
  const { invalidate, controls } = useThree()
  const body = useMemo(() => bodyGeometry(), [])
  const labelGeo = useMemo(() => ring(DATA_IN, R - 0.0004, R), [])
  const bandGeo = useMemo(() => ring(MIRROR_IN, DATA_IN, R, 192), [])
  const dataGeo = useMemo(() => ring(MIRROR_IN, DATA_OUT, R), [])
  const hubGeo = useMemo(() => ring(HOLE + 0.0002, DATA_IN, DATA_IN, 160), [])
  useEffect(() => () => [body, labelGeo, bandGeo, dataGeo, hubGeo].forEach((g) => g.dispose()), [body, labelGeo, bandGeo, dataGeo, hubGeo])

  const key = useSettled(`${brand}|${capacity}|${finish}`)
  const label = useMemo(() => {
    const [b, c, f] = key.split('|')
    return labelTexture({ brand: b, capacity: c, finish: f })
  }, [key])
  useEffect(() => () => label.dispose(), [label])
  const hub = useMemo(() => hubTexture({}), [])
  useEffect(() => () => hub.dispose(), [hub])
  const F = FINISHES[finish] ?? FINISHES.silver
  const D = DYES[dye] ?? DYES.cyanine

  const diff = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: diffVert,
        fragmentShader: diffFrag,
        uniforms: {
          lp: { value: LIGHTS.map(([p]) => new THREE.Vector3(...p)) },
          li: { value: LIGHTS.map(([, i]) => i) },
          ls: { value: LIGHTS.map(([, , s]) => s) },
          pitch: { value: PITCH },
          strength: { value: 1 },
          rIn: { value: LEAD_IN - 0.0005 },
          rOut: { value: PROGRAM_OUT + 0.0006 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  )
  useEffect(() => () => diff.dispose(), [diff])
  useEffect(() => {
    diff.uniforms.strength.value = 1.15 * rainbow
    invalidate()
  }, [diff, rainbow, invalidate])

  // the written part: a ring from the lead-in out to how far it got
  const [burnR, setBurnR] = useState(rAt(burned))
  const burnGeo = useMemo(() => (burnR > LEAD_IN + 0.0002 ? ring(LEAD_IN, burnR, R) : null), [burnR])
  useEffect(() => () => burnGeo?.dispose(), [burnGeo])

  const flipG = useRef()
  const spinG = useRef()
  const laser = useRef()
  const [hover, setHover] = useState(false)
  useCursor(hover, 'grab')
  const S = useRef({
    angle: 0.4,
    omega: 0,
    drag: null,
    flip: side === 'data' ? 1 : 0,
    flipTo: side === 'data' ? 1 : 0,
    burn: burned,
    burning: false,
    mb: Math.round(mbAt(rAt(burned))),
  })

  const report = () => {
    const st = S.current
    onInfo?.({ side: st.flipTo > 0.5 ? 'data' : 'label', mb: st.mb, burning: st.burning, full: st.burn >= 0.999, rpm: Math.round(Math.abs(st.omega) * 60 / (2 * Math.PI)) })
  }
  useEffect(() => {
    S.current.flipTo = side === 'data' ? 1 : 0
    report()
    invalidate()
  }, [side]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const st = S.current
    st.burn = burned
    st.burning = false
    st.mb = Math.round(mbAt(rAt(burned)))
    setBurnR(rAt(burned))
    report()
    invalidate()
  }, [burned]) // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    flip() {
      const st = S.current
      st.flipTo = st.flipTo > 0.5 ? 0 : 1
      report()
      invalidate()
      return st.flipTo > 0.5 ? 'data' : 'label'
    },
    burn() {
      const st = S.current
      if (st.burn >= 0.999) return
      st.burning = true
      st.flipTo = 1 // you can only see it from the data side
      report()
      invalidate()
    },
  }))

  // where the pointer meets the disc's plane, as an angle round its centre
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -T), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const angleOf = (ray) => (ray.intersectPlane(plane, hit) ? Math.atan2(-hit.z, hit.x) : null)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const st = S.current
    let active = false

    // turning over: lift, half a turn about the x axis, set down
    if (Math.abs(st.flip - st.flipTo) > 1e-4) {
      st.flip += Math.sign(st.flipTo - st.flip) * Math.min(Math.abs(st.flipTo - st.flip), dt / 0.9)
      active = true
    }
    const k = ease(st.flip)
    flipG.current.rotation.x = Math.PI * k
    flipG.current.position.y = T / 2 + Math.sin(Math.PI * st.flip) * 0.045

    // spinning: by hand, on a stand with a little friction; burning spins it up
    if (st.drag) {
      active = true
    } else {
      const target = st.burning ? 22 : 0
      const tau = st.burning ? 0.8 : 2.4
      st.omega += (target - st.omega) * (1 - Math.exp(-dt / tau))
      if (Math.abs(st.omega) < 0.01 && !st.burning) st.omega = 0
      st.angle += st.omega * dt
      if (st.omega !== 0) active = true
    }
    spinG.current.rotation.y = st.angle

    // writing: the laser walks outward at a steady data rate
    if (st.burning && st.flip > 0.98) {
      st.burn = Math.min(1, st.burn + dt / 9)
      const r = rAt(st.burn)
      const mb = Math.round(mbAt(r))
      if (Math.abs(r - burnR) > 0.00025 || st.burn >= 1) setBurnR(r)
      if (mb !== st.mb) {
        st.mb = mb
        report()
      }
      if (st.burn >= 1) {
        st.burning = false
        report()
      }
      active = true
    }
    if (laser.current) {
      laser.current.visible = st.burning && st.flip > 0.98
      laser.current.position.set(rAt(st.burn), T + 0.0004, 0)
    }
    if (active) invalidate()
  })

  const down = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    const a = angleOf(e.ray)
    if (a === null) return
    S.current.drag = { last: a, t: performance.now() }
    S.current.omega = 0
    if (controls) controls.enabled = false
    invalidate()
  }
  const move = (e) => {
    const st = S.current
    if (!st.drag) return
    const a = angleOf(e.ray)
    if (a === null) return
    // the disc is upside down once flipped, so its own sense of turning reverses
    const da = wrap(a - st.drag.last) * (st.flip > 0.5 ? -1 : 1)
    const now = performance.now()
    const dt = Math.max(1, now - st.drag.t) / 1000
    st.drag.last = a
    st.drag.t = now
    st.angle += da
    st.omega += (da / dt - st.omega) * 0.4
    invalidate()
  }
  const up = (e) => {
    const st = S.current
    if (!st.drag) return
    e.target.releasePointerCapture?.(e.pointerId)
    // a flick that stopped before release keeps little momentum
    if (performance.now() - st.drag.t > 80) st.omega *= 0.2
    st.drag = null
    if (controls) controls.enabled = true
    report()
    invalidate()
  }

  const events = { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onPointerOver: () => setHover(true), onPointerOut: () => setHover(false) }
  const flat = -Math.PI / 2
  return (
    <group>
      <group ref={flipG}>
        <group position-y={-T / 2}>
          <group ref={spinG}>
            {/* clear polycarbonate */}
            <mesh geometry={body} castShadow receiveShadow {...events}>
              <meshPhysicalMaterial color="#ffffff" transmission={1} thickness={T} ior={1.58} roughness={0.06} clearcoat={0.6} clearcoatRoughness={0.05} envMapIntensity={1.2} specularIntensity={0.9} />
            </mesh>
            {/* the metal layer under the label, as seen through the data side (dye tinted) */}
            <mesh geometry={dataGeo} rotation-x={-flat} position-y={T - 0.00012} raycast={() => null}>
              {/* the dye glows with its own colour in a lit room; a bare mirror here would only show the dark studio */}
              <meshPhysicalMaterial color={D.color} metalness={0.82} roughness={0.16} envMapIntensity={2.2} emissive={D.color} emissiveIntensity={0.14} />
            </mesh>
            {burnGeo && (
              <mesh geometry={burnGeo} rotation-x={-flat} position-y={T - 0.00016} raycast={() => null}>
                <meshPhysicalMaterial color={D.burned} metalness={0.8} roughness={0.22} envMapIntensity={1.8} emissive={D.burned} emissiveIntensity={0.14} />
              </mesh>
            )}
            {/* the grating's rainbow, laid just outside the data face */}
            <mesh geometry={dataGeo} rotation-x={-flat} position-y={-0.00001} material={diff} raycast={() => null} renderOrder={3} />
            {/* label side: the printed lacquer, and a bare mirror band inside it */}
            <mesh geometry={labelGeo} rotation-x={flat} position-y={T + 0.00001} receiveShadow raycast={() => null}>
              <meshPhysicalMaterial map={label} metalness={F.metal} roughness={F.rough} clearcoat={0.5} clearcoatRoughness={0.25} iridescence={finish === 'white' ? 0 : 0.18} iridescenceIOR={1.4} envMapIntensity={1.2} />
            </mesh>
            <mesh geometry={bandGeo} rotation-x={flat} position-y={T + 0.000008} raycast={() => null}>
              <meshPhysicalMaterial color="#d9dadc" metalness={1} roughness={0.12} envMapIntensity={1.2} />
            </mesh>
            {/* moulded numbers and the frosted clamping band, on both faces */}
            <mesh geometry={hubGeo} rotation-x={flat} position-y={T + 0.00001} raycast={() => null} renderOrder={2}>
              <meshBasicMaterial map={hub} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
            <mesh geometry={hubGeo} rotation-x={flat} position-y={-0.00001} raycast={() => null} renderOrder={2}>
              <meshBasicMaterial map={hub} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
      {/* the writing laser's spot (it stays put while the disc turns under it) */}
      <group ref={laser} visible={false}>
        <mesh rotation-x={flat}>
          <circleGeometry args={[0.0011, 24]} />
          <meshBasicMaterial color="#ff2a1a" toneMapped={false} />
        </mesh>
        <mesh rotation-x={flat} position-y={0.00005}>
          <circleGeometry args={[0.005, 32]} />
          <meshBasicMaterial color="#ff3a20" transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <pointLight color="#ff3020" intensity={0.04} distance={0.05} position-y={0.003} />
      </group>
    </group>
  )
})

export default Disc
