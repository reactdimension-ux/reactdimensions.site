import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { ARCH_R, FRONT_AXLE, REAR_AXLE, TRACK, WHEEL_R, WHEEL_W, barrelGeometry, bodyGeometry, noseX, railGeometry, sidePoint, spokeGeometry, tailX, tyreGeometry } from './geometry.js'
import { bodyMaterial } from './paint.js'

// A compact electric SUV at real size (4.46 m long). The body is one skin
// whose glass, lamps, grille, cladding and shut lines are drawn by its
// material (see paint.js); the wheels, mirrors, roof rails and number plates
// are separate parts. The nose points towards -x and the left side is +z.

const MAX_STEER = THREE.MathUtils.degToRad(32)
const WHEELS = [
  { x: FRONT_AXLE, side: 1, front: true },
  { x: FRONT_AXLE, side: -1, front: true },
  { x: REAR_AXLE, side: 1 },
  { x: REAR_AXLE, side: -1 },
]

// A prop that can also be changed from inside the scene; `onChange` lets the
// owner stay in sync.
function useTwoWay(prop, key, onChange) {
  const [v, setV] = useState(prop)
  useEffect(() => setV(prop), [prop])
  return [
    v,
    (next) => {
      setV(next)
      onChange?.({ [key]: next })
    },
  ]
}

function plateTexture(text) {
  const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 220 })
  const g = c.getContext('2d')
  g.fillStyle = '#f4f4f1'
  g.fillRect(0, 0, 1024, 220)
  g.strokeStyle = '#15171a'
  g.lineWidth = 10
  g.beginPath()
  g.roundRect(8, 8, 1008, 204, 22)
  g.stroke()
  g.fillStyle = '#15171a'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  let size = 150
  do {
    g.font = `700 ${size}px "Helvetica Neue", Arial, sans-serif`
    size -= 6
  } while (g.measureText(text).width > 900 && size > 40)
  g.fillText(text, 512, 118)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// paint: the body colour. roof: a glass roof. plate: the number plates.
// lights: head and tail lamps on. drive / speed: the wheels turn. steer: -1
// left .. 1 right. Click the car for the lights.
export default function Suv({ paint = '#2b4a85', roof = true, plate = 'RD 2026', lights: lightsProp = true, drive = false, speed = 0.4, steer = 0, onChange }) {
  const [lights, setLights] = useTwoWay(lightsProp, 'lights', onChange)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  const geo = useMemo(() => ({ body: bodyGeometry(), tyre: tyreGeometry(), barrel: barrelGeometry(), spokes: spokeGeometry(), rail: railGeometry() }), [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const plateTex = useMemo(() => plateTexture(plate || ' '), [plate])
  useEffect(() => () => plateTex.dispose(), [plateTex])

  const mat = useMemo(
    () => ({
      body: bodyMaterial(),
      paint: new THREE.MeshPhysicalMaterial({ roughness: 0.4, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 }),
      black: new THREE.MeshPhysicalMaterial({ color: '#050607', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
      plastic: new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.75 }),
      liner: new THREE.MeshStandardMaterial({ color: '#0b0c0d', roughness: 0.95, side: THREE.DoubleSide }),
      tyre: new THREE.MeshStandardMaterial({ color: '#111213', roughness: 0.9 }),
      alloy: new THREE.MeshStandardMaterial({ color: '#e6e8eb', metalness: 1, roughness: 0.2 }),
      dark: new THREE.MeshStandardMaterial({ color: '#16181b', metalness: 0.7, roughness: 0.38 }),
      disc: new THREE.MeshStandardMaterial({ color: '#8b8f95', metalness: 1, roughness: 0.35 }),
      caliper: new THREE.MeshStandardMaterial({ color: '#3b3f45', metalness: 0.6, roughness: 0.5 }),
      mirror: new THREE.MeshStandardMaterial({ color: '#aab4c0', metalness: 1, roughness: 0.03 }),
      rail: new THREE.MeshStandardMaterial({ color: '#c6c9cd', metalness: 1, roughness: 0.28 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mat).forEach((m) => m.dispose()), [mat])
  const u = mat.body.userData.uniforms
  u.uPaint.value.set(paint)
  u.uRoof.value = roof ? 1 : 0
  mat.paint.color.set(paint)

  // where the parts that sit on the skin go
  const at = useMemo(() => ({ nose: noseX(0.455), tail: tailX(0.78), mirror: sidePoint(-0.6, 0.462) }), [])

  // ---- motion ----
  const spin = useRef([])
  const steerRefs = useRef([])
  const live = useRef({})
  live.current = { drive, speed, steer, lights }
  const st = useRef({ v: 0, steer, light: lightsProp ? 1 : 0 })
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const w = live.current
    const s = st.current
    s.v += ((w.drive ? 1.5 + w.speed * 12 : 0) - s.v) * (1 - Math.exp(-dt * 1.4))
    s.steer += THREE.MathUtils.clamp(w.steer - s.steer, -dt * 1.6, dt * 1.6)
    s.light += ((w.lights ? 1 : 0) - s.light) * (1 - Math.exp(-dt * 9))
    spin.current.forEach((g, i) => g && (g.rotation.z += ((WHEELS[i].side * s.v) / WHEEL_R) * dt))
    steerRefs.current.forEach((g) => g && (g.rotation.y = -s.steer * MAX_STEER))
    u.uLights.value = s.light
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        setLights(!lights)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <mesh geometry={geo.body} material={mat.body} castShadow receiveShadow />

      {/* ================= wheels ================= */}
      {WHEELS.map((w, i) => (
        <group key={i}>
          {/* the arch liner: a dark tunnel over the wheel, closed on the inside */}
          <group position={[w.x, WHEEL_R, w.side * 0.715]}>
            <mesh rotation-x={Math.PI / 2} material={mat.liner}>
              <cylinderGeometry args={[ARCH_R + 0.012, ARCH_R + 0.012, 0.33, 40, 1, true, Math.PI / 2 - 0.3, Math.PI + 0.6]} />
            </mesh>
            <mesh position-z={-w.side * 0.165} material={mat.liner}>
              <circleGeometry args={[ARCH_R + 0.012, 40]} />
            </mesh>
          </group>
          <group position={[w.x, WHEEL_R, w.side * TRACK]} ref={(g) => w.front && (steerRefs.current[i] = g)}>
            <group rotation-y={w.side > 0 ? 0 : Math.PI}>
              {/* brake caliper: it does not turn with the wheel */}
              <mesh position={[-0.1, 0.11, -0.02]} rotation-z={0.75} material={mat.caliper}>
                <boxGeometry args={[0.07, 0.16, 0.09]} />
              </mesh>
              <group ref={(g) => (spin.current[i] = g)}>
                <mesh geometry={geo.tyre} material={mat.tyre} castShadow />
                <mesh geometry={geo.barrel} material={mat.dark} />
                <mesh geometry={geo.spokes} material={[mat.alloy, mat.dark]} castShadow />
                <mesh position-z={-0.02} rotation-x={Math.PI / 2} material={mat.disc}>
                  <cylinderGeometry args={[0.185, 0.185, 0.024, 48]} />
                </mesh>
                <mesh position-z={WHEEL_W / 2 - 0.012} rotation-x={Math.PI / 2} material={mat.black}>
                  <cylinderGeometry args={[0.034, 0.04, 0.014, 32]} />
                </mesh>
                {Array.from({ length: 5 }, (_, k) => {
                  const a = ((k * 72 + 36) * Math.PI) / 180
                  return (
                    <mesh key={k} position={[Math.cos(a) * 0.062, Math.sin(a) * 0.062, WHEEL_W / 2 - 0.012]} rotation-x={Math.PI / 2} material={mat.dark}>
                      <cylinderGeometry args={[0.009, 0.009, 0.012, 10]} />
                    </mesh>
                  )
                })}
              </group>
            </group>
          </group>
        </group>
      ))}

      {/* ================= door mirrors and roof rails ================= */}
      {[1, -1].map((side) => (
        <group key={side} scale={[1, 1, side]}>
          <group position={[at.mirror.x, at.mirror.y + 0.055, at.mirror.z]}>
            <mesh position={[0.02, -0.03, 0.02]} rotation-x={0.3} material={mat.black} castShadow>
              <boxGeometry args={[0.09, 0.028, 0.1]} />
            </mesh>
            <mesh position={[0.0, 0.012, 0.1]} scale={[0.062, 0.058, 0.1]} material={mat.paint} castShadow>
              <sphereGeometry args={[1, 32, 20]} />
            </mesh>
            <mesh position={[0.045, 0.012, 0.102]} rotation-y={Math.PI / 2} scale={[0.088, 0.048, 1]} material={mat.mirror}>
              <circleGeometry args={[1, 32]} />
            </mesh>
          </group>
          <mesh geometry={geo.rail} material={mat.rail} castShadow />
        </group>
      ))}

      {/* aerial fin on the roof */}
      <mesh position={[1.5, 1.612, 0]} scale={[0.1, 0.045, 0.028]} material={mat.black}>
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* ================= number plates ================= */}
      <mesh position={[at.nose - 0.006, 0.455, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.5, 0.108]} />
        <meshStandardMaterial map={plateTex} roughness={0.45} />
      </mesh>
      <mesh position={[at.tail + 0.006, 0.78, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.5, 0.108]} />
        <meshStandardMaterial map={plateTex} roughness={0.45} />
      </mesh>
    </group>
  )
}
