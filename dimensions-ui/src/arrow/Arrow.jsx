import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// A target arrow at real size: a 72 cm carbon shaft (5.6 mm across) in a
// fine twill weave under a satin clear coat, a steel field point with ring
// grooves at its shoulder, three plastic vanes (two coloured, one white cock
// vane) set with a slight helical offset, and a translucent nock with its
// string slot. Built along +y (nock at 0, point at the top); the scene lays
// it down along x.

export const ARROW = {
  len: 0.72, // shaft
  r: 0.0028,
  point: 0.035, // point length beyond the shaft
  nock: 0.021, // nock length behind the shaft
}
const { len, r } = ARROW

// ---- textures ----
// Carbon twill: 2x2 twill of fibre bundles, each a run of fine fibres,
// lighter along its crown where it catches light, darker in the valleys.
function weaveTexture() {
  const S = 256
  const N = 8 // bundles per tile
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  g.fillStyle = '#0d0d0f'
  g.fillRect(0, 0, S, S)
  const cs = S / N
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const horiz = (i + j) % 4 < 2
      const x = i * cs
      const y = j * cs
      const grad = horiz ? g.createLinearGradient(0, y, 0, y + cs) : g.createLinearGradient(x, 0, x + cs, 0)
      grad.addColorStop(0, '#141416')
      grad.addColorStop(0.5, horiz ? '#2c2c31' : '#232327')
      grad.addColorStop(1, '#141416')
      g.fillStyle = grad
      g.fillRect(x + 0.6, y + 0.6, cs - 1.2, cs - 1.2)
      // fibres
      g.strokeStyle = 'rgba(255,255,255,0.05)'
      g.lineWidth = 0.7
      for (let k = 1; k < 8; k++) {
        g.beginPath()
        if (horiz) {
          g.moveTo(x + 1, y + (k * cs) / 8)
          g.lineTo(x + cs - 1, y + (k * cs) / 8)
        } else {
          g.moveTo(x + (k * cs) / 8, y + 1)
          g.lineTo(x + (k * cs) / 8, y + cs - 1)
        }
        g.stroke()
      }
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 16
  // a tile is 8 bundles of ~1.1 mm: twice round the shaft, ~80 times along it
  t.repeat.set(2, len / 0.009)
  return t
}

// The maker's print, a narrow band of small white text along one side.
function printTexture() {
  const W = 128
  const H = 2048
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.clearRect(0, 0, W, H)
  g.save()
  g.translate(W * 0.3, H)
  g.rotate(-Math.PI / 2)
  g.fillStyle = 'rgba(240,240,236,0.92)'
  g.font = '600 17px "Helvetica Neue", Arial, sans-serif'
  g.textBaseline = 'middle'
  g.fillText('RD  CARBON  TARGET   ·   SPINE 500   ·   .204 ID   ·   28.5"', 60, 0)
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// fine plastic grain for the vanes
function vaneTexture() {
  const S = 128
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S })
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const v = 120 + Math.random() * 16
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(60, 12)
  return t
}

// ---- geometry ----
// the field point: a short shank into the shaft, six ring grooves at the
// shoulder, then a turned cone to a fine point
function pointGeometry() {
  const R = r + 0.0001
  const p = [[0, len - 0.012], [r * 0.82, len - 0.012], [r * 0.82, len - 0.0004], [R, len]]
  let y = len + 0.0006
  for (let i = 0; i < 6; i++) {
    p.push([R, y], [R * 0.9, y + 0.0004], [R * 0.9, y + 0.0007], [R, y + 0.0011])
    y += 0.0014
  }
  p.push([R, y + 0.0015])
  const tipStart = y + 0.0015
  const tip = len + ARROW.point
  for (let i = 1; i <= 14; i++) {
    const t = i / 14
    // a slightly ogival cone
    const rr = R * (1 - t) * (1 + 0.18 * Math.sin(t * Math.PI))
    p.push([Math.max(rr, 0.00008), tipStart + (tip - tipStart) * t])
  }
  p.push([0, tip + 0.0001])
  return new THREE.LatheGeometry(p.map(([x, yy]) => new THREE.Vector2(x, yy)), 56)
}

// the nock: a collar over the shaft end, then two prongs either side of the
// string slot (each a round-backed segment, extruded and softly bevelled)
const NOCK_R = 0.0034
const SLOT = 0.0024
function nockGeometries() {
  const base = new THREE.LatheGeometry(
    [
      [0, 0.004],
      [r * 0.8, 0.004],
      [r * 0.8, 0],
      [r + 0.00015, 0],
      [NOCK_R, -0.006],
      [NOCK_R, -0.0105],
      [0, -0.0105],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    48,
  )
  const half = SLOT / 2
  const a = Math.acos(half / NOCK_R)
  const s = new THREE.Shape()
  s.moveTo(half, -Math.sqrt(NOCK_R * NOCK_R - half * half))
  s.absarc(0, 0, NOCK_R, -a, a, false)
  s.lineTo(half, Math.sqrt(NOCK_R * NOCK_R - half * half))
  s.closePath()
  const L = ARROW.nock - 0.0105
  const prong = new THREE.ExtrudeGeometry(s, { depth: L - 0.0006, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0004, bevelSegments: 4, curveSegments: 24 })
  // extrusion runs along +z: turn it to run down from the collar (-y)
  prong.rotateX(Math.PI / 2)
  prong.translate(0, -0.0105, 0)
  const other = prong.clone()
  other.rotateY(Math.PI)
  return { base, prong, other }
}

// a vane: straight base along the shaft, a curve rising to its tall rear
// and a rounded drop at the back; 7.5 cm long, 1.6 cm high, 0.4 mm thick
const VANE = { rear: 0.026, len: 0.075, h: 0.016 }
function vaneGeometry() {
  const x0 = VANE.rear
  const x1 = VANE.rear + VANE.len
  const H = VANE.h
  const s = new THREE.Shape()
  s.moveTo(x1, 0)
  s.bezierCurveTo(x1 - 0.022, 0.0025, x0 + 0.022, H * 0.92, x0 + 0.008, H)
  s.quadraticCurveTo(x0 - 0.0005, H * 1.02, x0, H * 0.62)
  s.quadraticCurveTo(x0 + 0.0004, H * 0.2, x0 + 0.002, 0)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0003, bevelEnabled: true, bevelThickness: 0.00005, bevelSize: 0.0001, bevelSegments: 2, curveSegments: 32 })
  g.translate(0, 0, -0.00015)
  // shape x is along the shaft (y), shape y is out from it (x)
  g.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1))
  g.translate(r - 0.0001, 0, 0)
  // the vane's base is glued down with a little flare
  return g
}

const POINTS = { steel: ['#c6c9cc', 0.26], brass: ['#c9a456', 0.3], black: ['#2a2b2e', 0.35] }

const Arrow = forwardRef(function Arrow({ vaneColor = '#f2641c', cockColor = '#f1f1ee', nockColor = '#ff7a1a', point = 'steel' }, ref) {
  const invalidate = useThree((s) => s.invalidate)
  const tex = useMemo(() => ({ weave: weaveTexture(), print: printTexture(), grain: vaneTexture() }), [])
  const geo = useMemo(
    () => ({
      shaft: new THREE.CylinderGeometry(r, r, len, 64, 1, true).translate(0, len / 2, 0),
      sleeve: new THREE.CylinderGeometry(r + 0.00002, r + 0.00002, 0.16, 64, 1, true).translate(0, 0.21, 0),
      point: pointGeometry(),
      nock: nockGeometries(),
      vane: vaneGeometry(),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      shaft: new THREE.MeshPhysicalMaterial({ map: tex.weave, bumpMap: tex.weave, bumpScale: 0.00004, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.18 }),
      print: new THREE.MeshStandardMaterial({ map: tex.print, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -1 }),
      point: new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.26 }),
      nock: new THREE.MeshPhysicalMaterial({ roughness: 0.22, transmission: 0.55, thickness: 0.003, ior: 1.49, clearcoat: 0.4 }),
      vane: new THREE.MeshPhysicalMaterial({ roughness: 0.5, bumpMap: tex.grain, bumpScale: 0.000015, sheen: 0.4, sheenRoughness: 0.5, side: THREE.DoubleSide }),
      cock: new THREE.MeshPhysicalMaterial({ roughness: 0.45, bumpMap: tex.grain, bumpScale: 0.000015, sheen: 0.5, sheenRoughness: 0.4, side: THREE.DoubleSide }),
    }),
    [tex],
  )
  useLayoutEffect(() => {
    mats.vane.color.set(vaneColor)
    mats.cock.color.set(cockColor)
    mats.nock.color.set(nockColor)
    mats.nock.attenuationColor = new THREE.Color(nockColor)
    mats.nock.attenuationDistance = 0.004
    const [col, rough] = POINTS[point] || POINTS.steel
    mats.point.color.set(col)
    mats.point.roughness = rough
    mats.point.metalness = point === 'black' ? 0.6 : 1
    invalidate()
  }, [mats, vaneColor, cockColor, nockColor, point, invalidate])
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose())
      Object.values(tex).forEach((t) => t.dispose())
      geo.shaft.dispose()
      geo.sleeve.dispose()
      geo.point.dispose()
      geo.vane.dispose()
      Object.values(geo.nock).forEach((g) => g.dispose())
    },
    [mats, tex, geo],
  )

  // spin about its own axis, as the vanes make it in flight
  const spin = useRef({ v: 0, a: 0 })
  const body = useRef()
  useImperativeHandle(ref, () => ({ spin: () => ((spin.current.v = 28), invalidate()) }), [invalidate])
  useFrame((_, delta) => {
    const s = spin.current
    if (Math.abs(s.v) < 0.01) return
    const dt = Math.min(delta, 1 / 30)
    s.v *= Math.exp(-1.1 * dt)
    s.a += s.v * dt
    if (Math.abs(s.v) < 0.05) {
      // settle with the cock vane back on top
      s.v = 0
      s.a = Math.round(s.a / (Math.PI * 2)) * Math.PI * 2
    }
    body.current.rotation.y = s.a
    invalidate()
  })

  // three vanes 120 degrees apart; the cock vane sits on the arrow's -x
  // side, which is "up" once the scene lays the arrow along +x
  const vanes = [0, 1, 2].map((k) => ({ angle: (k * Math.PI * 2) / 3, cock: k === 0 }))
  return (
    <group ref={body}>
      <mesh geometry={geo.shaft} material={mats.shaft} castShadow receiveShadow />
      <mesh geometry={geo.sleeve} material={mats.print} />
      <mesh geometry={geo.point} material={mats.point} castShadow receiveShadow />
      <mesh geometry={geo.nock.base} material={mats.nock} castShadow />
      <mesh geometry={geo.nock.prong} material={mats.nock} castShadow />
      <mesh geometry={geo.nock.other} material={mats.nock} castShadow />
      {vanes.map(({ angle, cock }) => (
        <group key={angle} rotation-y={angle + Math.PI}>
          {/* a slight helical offset: each vane turned a degree and a half */}
          <mesh geometry={geo.vane} material={cock ? mats.cock : mats.vane} rotation-x={0.026} castShadow receiveShadow />
        </group>
      ))}
    </group>
  )
})

export default Arrow
