import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { canvasTexture } from '../airliner/textures.js'
import { HINGE_Z, LID_Y, RIVET, beadGeometry, bodyGeometry, endGeometry, panelGeometry, panelShape, rivetGeometry, scoreGeometry, tabEdgeGeometry, tabGeometry } from './geometry.js'

// A 330 ml aluminium can: the domed base and chime, the straight wall, the
// neck and double seam, the countersunk end with its scored opening panel,
// and a stay-on pull tab on its rivet. Click the tab (or set `open`) and it
// levers up while the panel folds down into the can. The body can be bare
// brushed aluminium or painted; the end is always bare.

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

// Brushed metal: fine streaks of roughness along v (down the wall and, on
// the spun end, out from the centre), used as the roughness map.
function brushTexture(seed = 3) {
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const t = canvasTexture(1024, 64, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * w
      const v = 90 + rnd() * 90
      ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.5})`
      ctx.fillRect(x, 0, 0.6 + rnd() * 1.4, h)
    }
  })
  t.colorSpace = THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// The opening, as a mask over the lid in its own plane (x and z from -MASK
// to MASK), so the end's shader can cut the panel out once it is pushed in.
const MASK = 0.03
function panelMask() {
  const S = 512
  const t = canvasTexture(S, S, (ctx) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, S, S)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    panelShape(-0.0001).getPoints(48).forEach((q, i) => {
      const x = ((q.x + MASK) / (2 * MASK)) * S
      const y = ((MASK - (q.y + HINGE_Z)) / (2 * MASK)) * S
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    })
    ctx.closePath()
    ctx.fill()
  })
  t.colorSpace = THREE.NoColorSpace
  return t
}

// the end's aluminium, with the opening cut out of it while `uOpen` is set
function endMaterial(base, uni) {
  base.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position.xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uMask;\nuniform float uOpen;\nvarying vec2 vP;')
      .replace('#include <map_fragment>', `if (uOpen > 0.5 && texture2D(uMask, (vP + ${MASK}) / ${2 * MASK}).r > 0.5) discard;\n#include <map_fragment>`)
  }
  base.customProgramCacheKey = () => 'can-end'
  return base
}

const FINISH = {
  brushed: { roughness: 0.42, brush: 1, aniso: 0.75 },
  polished: { roughness: 0.16, brush: 0.25, aniso: 0.2 },
  matte: { roughness: 0.62, brush: 0.4, aniso: 0 },
}

export default function Can({ bodyColor = '#d6d9dc', painted = false, finish = 'brushed', open: openProp = false, onChange }) {
  const [open, setOpen] = useTwoWay(openProp, 'open', onChange)
  const geo = useMemo(
    () => ({ body: bodyGeometry(), end: endGeometry(), panel: panelGeometry(), score: scoreGeometry(), bead: beadGeometry(), tab: tabGeometry(), tabEdge: tabEdgeGeometry(), rivet: rivetGeometry() }),
    [],
  )
  const brush = useMemo(() => brushTexture(), [])
  const uni = useMemo(() => ({ uMask: { value: panelMask() }, uOpen: { value: 0 } }), [])
  const f = FINISH[finish] || FINISH.brushed
  const mats = useMemo(() => {
    const alu = (extra = {}) =>
      new THREE.MeshPhysicalMaterial({ color: '#dcdfe2', metalness: 1, roughness: f.roughness, roughnessMap: brush, anisotropy: f.aniso, anisotropyRotation: Math.PI / 2, envMapIntensity: 1.1, ...extra })
    return {
      body: painted
        ? new THREE.MeshPhysicalMaterial({ color: bodyColor, metalness: 0.75, roughness: 0.32, roughnessMap: brush, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 1 })
        : alu(),
      end: endMaterial(alu({ roughness: f.roughness + 0.1, envMapIntensity: 0.55 }), uni),
      lid: alu({ roughness: f.roughness + 0.1, envMapIntensity: 0.55 }),
      tab: alu({ roughness: f.roughness - 0.04, anisotropyRotation: 0 }),
      score: new THREE.MeshStandardMaterial({ color: '#5a5d61', metalness: 1, roughness: 0.6 }),
      inside: new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.7, metalness: 0.5, side: THREE.BackSide }),
    }
  }, [f, brush, painted, bodyColor, uni])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  // the opening: the tab levers up about the rivet while the panel folds in
  const tab = useRef()
  const panel = useRef()
  const k = useRef(openProp ? 1 : 0)
  useFrame((_, dt) => {
    k.current = THREE.MathUtils.damp(k.current, open ? 1 : 0, 6, Math.min(dt, 1 / 30))
    const e = k.current
    const ease = e * e * (3 - 2 * e)
    // the tab levers up as the nose pushes the panel in, and is left standing
    const lift = ease * 0.55 + Math.sin(ease * Math.PI) * 0.25
    uni.uOpen.value = e > 0.03 ? 1 : 0
    tab.current.rotation.x = lift
    tab.current.position.y = LID_Y + 0.0013 + 0.0003 * lift
    panel.current.rotation.x = ease * 1.85
  })

  const [hot, setHot] = useState(false)
  useEffect(() => {
    document.body.style.cursor = hot ? 'pointer' : ''
    return () => void (document.body.style.cursor = '')
  }, [hot])

  return (
    <group>
      <mesh geometry={geo.body} material={mats.body} castShadow receiveShadow />
      <mesh geometry={geo.body} material={mats.inside} />
      <mesh geometry={geo.end} material={mats.end} castShadow receiveShadow />
      <mesh geometry={geo.end} material={mats.inside} />
      <mesh geometry={geo.bead} material={mats.lid} position-y={LID_Y + 0.0002} />
      {/* the score line and the panel, hinged at the rivet end */}
      <mesh geometry={geo.score} material={mats.score} position={[0, LID_Y + 0.00035, HINGE_Z]} />
      <group ref={panel} position={[0, LID_Y + 0.0004, HINGE_Z]}>
        <mesh geometry={geo.panel} material={mats.lid} />
      </group>
      {/* the rivet and the tab, which pivots about the rivet */}
      <mesh geometry={geo.rivet} material={mats.tab} position={[0, LID_Y + 0.0012, RIVET.z]} />
      <group
        ref={tab}
        position={[0, LID_Y + 0.0013, RIVET.z]}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHot(true)
        }}
        onPointerOut={() => setHot(false)}
      >
        <mesh geometry={geo.tab} material={mats.tab} castShadow />
        <mesh geometry={geo.tabEdge} material={mats.tab} position-y={0.00016} />
      </group>
    </group>
  )
}
