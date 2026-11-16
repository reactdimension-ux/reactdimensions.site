import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Stage, TAU, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly comet sailing through space: a faceted, icy head, patchy with
// dust, wrapped in a soft glowing coma, trailing two tails of glowing
// faceted motes: a broad dust tail that curves back along its path, and a
// thin, straight ion tail pointing away from the centre of its orbit. A
// scatter of distant stars twinkles behind. Left alone, it loops slowly
// round the frame on a tilted orbit, tumbling as it goes. Tap it and it
// flares: the tails stream out bright, dense and twice as long, the coma
// blazes and a burst of sparkles scatters, then it calms again.

const LOOKS = {
  ice: { ice: '#d8ecff', dust: '#7f9cbc', coma: '#8fd2ff', tail: ['#ffffff', '#bfe6ff', '#4f9dff'], ion: ['#e8f4ff', '#6f8dff'], star: ['#ffffff', '#d4e6ff', '#a8c8ff'] },
  fire: { ice: '#ffe3c0', dust: '#9a5a36', coma: '#ffad55', tail: ['#fff6dc', '#ffb347', '#e0441c'], ion: ['#fff0d0', '#ff6a2c'], star: ['#ffffff', '#ffe9c8', '#ffd0a0'] },
  aurora: { ice: '#dafff2', dust: '#5f9c96', coma: '#78ffc8', tail: ['#f2fff9', '#78ffc8', '#2f8cff'], ion: ['#f6e8ff', '#b06cff'], star: ['#ffffff', '#d8fff0', '#e6d4ff'] },
}

const C = new THREE.Vector3(0, 1.0, 0) // the centre of the orbit
const PERIOD = 26 // seconds per loop
const NTAIL = 320
const ION = 0.35 // share of motes in the ion tail

// The comet's path: a tilted ellipse round C.
const at = (t, out) => {
  const a = (t / PERIOD) * TAU - 1.3
  return out.set(C.x + Math.cos(a) * 1.15, C.y + Math.sin(a) * 0.3 + Math.cos(a) * 0.16, C.z + Math.sin(a) * 0.55)
}

const _o = new THREE.Object3D()
const _c = new THREE.Color()
const _c2 = new THREE.Color()
const _e = new THREE.Vector3()
const _f = new THREE.Vector3()
const _v = new THREE.Vector3()
const _r = new THREE.Vector3()

// A colour along a ramp of stops at a share k (0..1).
function ramp(stops, k, out) {
  const x = Math.min(0.999, Math.max(0, k)) * (stops.length - 1)
  const i = Math.floor(x)
  return out.set(stops[i]).lerp(_c2.set(stops[i + 1]), x - i)
}

export function Comet({ look = 'ice' }) {
  const L = LOOKS[look] || LOOKS.ice
  const { tap, handlers, clock } = useTap(0.9)
  const head = useRef()
  const rock = useRef()
  const coma = useRef()
  const tail = useRef()
  const twinkle = useRef([])
  const burstAt = useMemo(() => [0, 0, 0], [])
  // a soft round glow for the coma
  const glowTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    gr.addColorStop(0.6, 'rgba(255,255,255,0.1)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
  useEffect(() => () => glowTex.dispose(), [glowTex])

  const geo = useGeo(
    () => ({
      // the head: an icosphere knocked about, each face ice or dust
      head: (() => {
        const g = facet(new THREE.IcosahedronGeometry(0.14, 1), 0.025, 4).toNonIndexed()
        const p = g.attributes.position
        const col = new Float32Array(p.count * 3)
        const r = rng(9)
        for (let f = 0; f < p.count; f += 3) {
          const k = r()
          _c.set(k < 0.3 ? L.dust : L.ice).multiplyScalar(0.85 + r() * 0.25)
          for (let j = 0; j < 3; j++) col.set([_c.r, _c.g, _c.b], (f + j) * 3)
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        g.computeVertexNormals()
        return g
      })(),
      mote: new THREE.OctahedronGeometry(1, 0),
      spark: new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.6, 0.5),
      star: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.SphereGeometry(0.42, 10, 6),
      stars: (() => {
        const r = rng(23)
        const pos = []
        for (let i = 0; i < 320; i++) {
          const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(7 + r() * 8)
          pos.push(v.x, v.y * 0.9 + 1, v.z)
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
        return g
      })(),
    }),
    [look],
  )

  // the tail motes: each loops through its life on its own offset
  const P = useMemo(() => {
    const r = rng(17)
    return Array.from({ length: NTAIL }, (_, i) => {
      const ion = i < NTAIL * ION
      return { ion, off: r(), life: ion ? 1.1 + r() * 0.5 : 1.4 + r() * 0.9, j: [r() - 0.5, r() - 0.5, r() - 0.5], s: (ion ? 0.006 : 0.011) + r() * (ion ? 0.008 : 0.013), gate: r(), b: 0.7 + r() * 0.5, roll: r() * TAU }
    })
  }, [])
  const TW = useMemo(() => {
    const r = rng(31)
    return Array.from({ length: 14 }, (_, i) => {
      const a = r() * TAU
      const d = 3.2 + r() * 2.5
      return { p: [Math.cos(a) * d, -0.2 + r() * 3.4, Math.sin(a) * d], s: 0.025 + r() * 0.03, ph: r() * TAU, rate: 1 + r() * 2, c: L.star[i % 3] }
    })
  }, [L])

  useEffect(() => {
    // colours are written every frame; make sure the buffer exists
    tail.current.setColorAt(0, _c.set('#000000'))
  }, [])

  const onClick = (e) => {
    e.stopPropagation()
    const t = clock.elapsedTime
    at(t, _e)
    burstAt[0] = _e.x
    burstAt[1] = _e.y
    burstAt[2] = _e.z
    tap.kick(t)
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const k = tap.value(t) // the flare, 1 at the tap and fading
    // the head: along the orbit, tumbling slowly
    at(t, head.current.position)
    rock.current.rotation.set(t * 0.31, t * 0.47, t * 0.13)
    coma.current.children.forEach((m, i) => {
      const pulse = 1 + 0.06 * Math.sin(t * 2.1 + i * 1.3)
      m.scale.setScalar([0.55, 0.95, 1.6][i] * pulse * (1 + 0.5 * k))
      m.material.opacity = Math.min(1, [0.95, 0.5, 0.2][i] * (1 + 1.2 * k))
    })
    // the tails
    const m = tail.current
    const len = 1 + 1.3 * k
    P.forEach((p, i) => {
      const u = (t / p.life + p.off) % 1
      const age = u * p.life
      const on = p.gate < 0.62 + 0.38 * k
      at(t - age, _e) // where the head was when this mote left it
      at(t - age + 0.05, _f)
      _r.subVectors(_e, _f).normalize() // back along the path
      if (p.ion) {
        // the ion tail: thin and straight, streaming fast
        _o.position.copy(_e).addScaledVector(_r, age * 1.25 * len).add(_v.set(...p.j).multiplyScalar(0.02 + age * 0.05))
      } else {
        // the dust tail: broader, slower, bowed out from the orbit
        _f.subVectors(_e, C).normalize()
        _o.position.copy(_e).addScaledVector(_r, age * 0.75 * len).addScaledVector(_f, age * age * 0.12 * len).add(_v.set(...p.j).multiplyScalar(0.04 + age * 0.26))
      }
      const fade = Math.min(1, u * 8) * (1 - u) ** 1.2
      const sz = p.s * (0.7 + u * 1.3) * (1 + 0.5 * k) * (on ? 1 : 0.0001)
      _o.lookAt(_e)
      _o.rotation.z += p.roll
      _o.scale.set(sz, sz, sz * (p.ion ? 3.2 : 1.7))
      _o.updateMatrix()
      m.setMatrixAt(i, _o.matrix)
      ramp(p.ion ? L.ion : L.tail, u * (p.ion ? 1 : 1.05), _c).multiplyScalar(fade * p.b * (1 + 1.2 * k))
      m.setColorAt(i, _c)
    })
    m.instanceMatrix.needsUpdate = true
    m.instanceColor.needsUpdate = true
    twinkle.current.forEach((s, i) => {
      if (!s) return
      const p = TW[i]
      s.scale.setScalar(p.s * (0.6 + 0.4 * Math.sin(t * p.rate + p.ph)))
      s.rotation.y = t * 0.5 + p.ph
    })
  })

  return (
    <group {...handlers} onClick={onClick}>
      <points geometry={geo.stars}>
        <pointsMaterial color={L.star[1]} size={0.05} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
      </points>
      {TW.map((p, i) => (
        <mesh key={i} ref={(el) => (twinkle.current[i] = el)} geometry={geo.star} position={p.p} scale={[p.s, p.s * 1.6, p.s]}>
          <meshBasicMaterial color={p.c} toneMapped={false} />
        </mesh>
      ))}
      <instancedMesh ref={tail} args={[geo.mote, undefined, NTAIL]} frustumCulled={false} renderOrder={2}>
        <meshBasicMaterial color="#ffffff" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <group ref={head}>
        <group ref={rock}>
          <mesh geometry={geo.head}>
            <meshStandardMaterial vertexColors color="#ffffff" flatShading roughness={0.75} emissive={L.coma} emissiveIntensity={0.18} />
          </mesh>
        </group>
        <group ref={coma}>
          {[0, 1, 2].map((i) => (
            <sprite key={i} renderOrder={3}>
              <spriteMaterial map={glowTex} color={L.coma} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </sprite>
          ))}
        </group>
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
      <Burst tap={tap} geometry={geo.spark} count={22} colors={[L.tail[0], L.tail[1], L.ion[1]]} speed={1.5} gravity={0} size={0.05} life={1.2} origin={burstAt} spread={1} up={0.9} />
    </group>
  )
}

export default function CometScene({ background = '#10131f', autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.0, 5.6]} target={[0, 1.0, 0]} hint="The comet loops slowly round its orbit, tumbling, its dust tail curving back along its path and its ion tail streaming straight out · tap it and the tails flare bright and long with a burst of sparkles, then calm · Look swaps ice, fire and aurora · drag to orbit">
      <Comet {...props} />
    </Stage>
  )
}
