import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createPistolAudio } from './audio.js'
import {
  SLIDE,
  PORT,
  TRAVEL,
  GRIP_DIR,
  GRIP_TOP,
  GRIP_ANGLE,
  buildSlide,
  buildHood,
  buildBarrel,
  buildUpperFrame,
  buildGuard,
  buildGrip,
  buildMagazine,
  buildTrigger,
  buildRearSight,
  buildFrontSight,
  buildSightU,
  textDecal,
  withDetail,
  SLIDE_DETAIL,
  GRIP_DETAIL,
  POLY_DETAIL,
  METAL_DETAIL,
} from './parts.js'

// A compact striker-fired pistol, built to real proportions (1 unit = 1 cm).
// The muzzle points along +x and the ejection port is on the right (+z).
//
// It works like the real thing, unloaded:
//   - drag the slide back (or click it) to rack it: the barrel rides back a
//     few millimetres locked to the slide, then its breech tips down out of
//     the port, and the slide slams home when you let go
//   - click the trigger to dry-fire: the striker clicks and the trigger stays
//     to the rear until the slide is racked again to reset it
//   - click the magazine release (or the baseplate) to drop the magazine part
//     way out; click again to seat it

// a little forward of centre in the guard, tip well clear of its floor
const PIVOT_TRIGGER = new THREE.Vector3(1.35, -2.35, 0)
const BARREL_PIVOT_X = 7.6 // the barrel tips about its muzzle end in the slide
const BARREL_UNLOCK = 0.32 // slide travel before the barrel unlocks
const MAG_DROP = 3.6

const FINISH = {
  nitride: { color: '#3b3d41', metalness: 0.9, roughness: 0.34 },
  stainless: { color: '#c3c6ca', metalness: 1, roughness: 0.26 },
  gold: { color: '#c9a24f', metalness: 1, roughness: 0.3 },
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const Pistol = forwardRef(function Pistol(
  { slideColor = '#56595e', frameColor = '#1b1c1e', barrelFinish = 'nitride', sights = 'white', sound = true },
  ref,
) {
  const { camera, controls } = useThree()
  const root = useRef()
  const slideRef = useRef()
  const barrelRef = useRef()
  const triggerRef = useRef()
  const bladeRef = useRef()
  const magRef = useRef()
  const [hover, setHover] = useState(null)
  const [dragging, setDragging] = useState(false)
  useCursor(!!hover || dragging, dragging ? 'grabbing' : hover === 'slide' ? 'grab' : 'pointer')

  // ---- geometry ----
  const geo = useMemo(() => {
    const barrel = buildBarrel()
    const mag = buildMagazine()
    const trig = buildTrigger()
    return {
      slide: buildSlide(),
      hood: buildHood(),
      ...barrel,
      upper: buildUpperFrame(),
      guard: buildGuard(),
      grip: buildGrip(),
      magBase: mag.base,
      magBody: mag.body,
      shoe: trig.shoe,
      blade: trig.blade,
      rear: buildRearSight(),
      front: buildFrontSight(),
      sightU: buildSightU(),
      dot: new THREE.CircleGeometry(0.075, 24),
      ring: new THREE.RingGeometry(0.075, 0.11, 32),
      pin: new THREE.CylinderGeometry(0.12, 0.12, 2.42, 24).rotateX(Math.PI / 2),
      pinSmall: new THREE.CylinderGeometry(0.09, 0.09, 2.4, 20).rotateX(Math.PI / 2),
      rod: new THREE.CylinderGeometry(0.16, 0.16, 9.4, 24).rotateZ(Math.PI / 2),
      rodEnd: new THREE.CylinderGeometry(0.175, 0.175, 0.08, 24).rotateZ(Math.PI / 2),
      noseGap: new THREE.RingGeometry(0.55, 0.72, 64),
      rodGap: new THREE.RingGeometry(0.1, 0.2, 32),
      plate: new THREE.BoxGeometry(0.02, 1.7, 1.15),
      striker: new THREE.CircleGeometry(0.09, 20),
      extractor: new THREE.BoxGeometry(1.75, 0.34, 0.06),
      lever: new THREE.BoxGeometry(2.6, 0.2, 0.12),
      tab: new THREE.BoxGeometry(0.42, 0.36, 0.14),
      takedown: new THREE.BoxGeometry(0.55, 0.16, 0.06),
      release: new THREE.BoxGeometry(0.7, 0.5, 0.22),
      slot: new THREE.BoxGeometry(0.36, 0.06, 1.9),
      rail: new THREE.BoxGeometry(3.5, 0.13, 0.08),
      decalSlide: new THREE.PlaneGeometry(2.8, 0.7),
      decalHood: new THREE.PlaneGeometry(1.6, 0.4),
      decalFrame: new THREE.PlaneGeometry(1.4, 0.35),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose?.()), [geo])

  // ---- materials ----
  const mats = useMemo(() => {
    const gripU = { uGripTop: { value: GRIP_TOP.clone() }, uGripDir: { value: GRIP_DIR.clone() } }
    return {
      slide: withDetail(new THREE.MeshPhysicalMaterial({ metalness: 0.82, roughness: 0.4, clearcoat: 0.18, clearcoatRoughness: 0.45, envMapIntensity: 1.15 }), SLIDE_DETAIL),
      frame: withDetail(new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.58, specularIntensity: 0.55, sheen: 0.25, sheenRoughness: 0.8, envMapIntensity: 0.9 }), POLY_DETAIL),
      grip: withDetail(new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.62, specularIntensity: 0.5, envMapIntensity: 0.9 }), GRIP_DETAIL, gripU),
      barrel: withDetail(new THREE.MeshPhysicalMaterial({ envMapIntensity: 1.25 }), METAL_DETAIL),
      bore: new THREE.MeshStandardMaterial({ color: '#0d0d0e', metalness: 0.9, roughness: 0.5, side: THREE.BackSide }),
      plug: new THREE.MeshBasicMaterial({ color: '#000000' }),
      steel: withDetail(new THREE.MeshPhysicalMaterial({ color: '#2c2e31', metalness: 0.9, roughness: 0.38, envMapIntensity: 1.1 }), METAL_DETAIL),
      pin: new THREE.MeshPhysicalMaterial({ color: '#9a9ea4', metalness: 1, roughness: 0.3 }),
      sight: new THREE.MeshPhysicalMaterial({ color: '#141516', metalness: 0.4, roughness: 0.55 }),
      white: new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.6 }),
      tritium: new THREE.MeshStandardMaterial({ color: '#7dff6a', emissive: '#4dff3a', emissiveIntensity: 1.6, roughness: 0.3 }),
      hole: new THREE.MeshBasicMaterial({ color: '#050505' }),
      magBody: withDetail(new THREE.MeshPhysicalMaterial({ color: '#202124', metalness: 0.2, roughness: 0.45, clearcoat: 0.3 }), POLY_DETAIL),
    }
  }, [])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    mats.slide.color.set(slideColor)
    mats.frame.color.set(frameColor)
    mats.grip.color.set(frameColor)
    const f = FINISH[barrelFinish] || FINISH.nitride
    mats.barrel.color.set(f.color)
    mats.barrel.metalness = f.metalness
    mats.barrel.roughness = f.roughness
  }, [mats, slideColor, frameColor, barrelFinish])

  // engraving: model and calibre, on the left of the slide and on the hood
  const decals = useMemo(() => {
    const mk = (t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    return {
      slide: mk(textDecal(['RD 19'], { w: 512, h: 128, font: '700 92px "Helvetica Neue", Arial, sans-serif' })),
      hood: mk(textDecal(['9×19'], { w: 256, h: 64, font: '600 46px "Helvetica Neue", Arial, sans-serif', color: 'rgba(15,15,16,0.8)' })),
      frame: mk(textDecal(['MADE BY RD'], { w: 512, h: 128, font: '600 70px "Helvetica Neue", Arial, sans-serif', color: 'rgba(60,62,66,0.9)', glow: 'rgba(0,0,0,0.5)' })),
    }
  }, [])
  useEffect(() => () => Object.values(decals).forEach((m) => (m.map.dispose(), m.dispose())), [decals])

  // ---- sound ----
  const audio = useRef(null)
  useEffect(() => {
    if (!sound) return
    audio.current = createPistolAudio()
    return () => {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])

  // ---- mechanism state ----
  const st = useRef({
    slide: 0, // 0 in battery .. TRAVEL fully back
    v: 0,
    mode: 'idle', // idle | drag | back | hold | return
    hold: 0,
    scraped: false,
    trig: 0,
    pull: false,
    latched: false, // the trigger stays back after firing until the slide resets it
    mag: 0,
    magOut: false,
  })
  const grab = useRef({ on: false, start: 0, x0: 0, moved: false, plane: new THREE.Plane() })
  const tmp = useMemo(() => ({ hit: new THREE.Vector3(), inv: new THREE.Matrix4(), ray: new THREE.Ray(), n: new THREE.Vector3() }), [])

  const rack = () => {
    const s = st.current
    if (s.mode !== 'idle') return
    s.mode = 'back'
    s.scraped = false
  }
  const fire = () => {
    const s = st.current
    if (s.latched || s.slide > 0.05) return
    s.pull = true
  }
  const toggleMag = () => {
    const s = st.current
    s.magOut = !s.magOut
    audio.current?.mag(!s.magOut)
  }
  useImperativeHandle(ref, () => ({ rack, fire, toggleMag }), [])

  // local x of where the pointer ray meets the drag plane
  const pointerX = (ray) => {
    tmp.inv.copy(root.current.matrixWorld).invert()
    tmp.ray.copy(ray).applyMatrix4(tmp.inv)
    return tmp.ray.intersectPlane(grab.current.plane, tmp.hit) ? tmp.hit.x : null
  }

  const onSlideDown = (e) => {
    e.stopPropagation()
    const s = st.current
    if (s.mode !== 'idle' && s.mode !== 'return') return
    root.current.updateMatrixWorld()
    tmp.inv.copy(root.current.matrixWorld).invert()
    const p = root.current.worldToLocal(e.point.clone())
    // a plane along the bore that faces the camera as squarely as it can
    const cam = camera.position.clone().applyMatrix4(tmp.inv)
    tmp.n.set(0, cam.y - p.y, cam.z - p.z)
    if (tmp.n.lengthSq() < 1e-6) tmp.n.set(0, 0, 1)
    tmp.n.normalize()
    grab.current.plane.setFromNormalAndCoplanarPoint(tmp.n, p)
    grab.current = { ...grab.current, on: true, start: s.slide, x0: p.x, moved: false }
    s.mode = 'drag'
    s.scraped = false
    setDragging(true)
    if (controls) controls.enabled = false
  }

  useEffect(() => {
    const up = () => {
      const g = grab.current
      if (!g.on) return
      g.on = false
      const s = st.current
      // a click racks it fully; a drag lets the slide go from wherever it is
      if (!g.moved) s.mode = 'back'
      else {
        s.mode = 'return'
        s.v = 0
      }
      setDragging(false)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const s = st.current
    const g = grab.current

    // ---- slide ----
    if (s.mode === 'drag' && g.on) {
      state.raycaster.setFromCamera(state.pointer, camera)
      const x = pointerX(state.raycaster.ray)
      if (x !== null) {
        const want = Math.min(TRAVEL, Math.max(0, g.start + (g.x0 - x)))
        if (Math.abs(want - g.start) > 0.08) g.moved = true
        // the recoil spring pushes back harder the further it goes
        s.slide += (want - s.slide) * Math.min(1, dt * 30)
      }
    } else if (s.mode === 'back') {
      s.slide = Math.min(TRAVEL, s.slide + dt * 32)
      if (s.slide >= TRAVEL) {
        s.mode = 'hold'
        s.hold = 0.07
      }
    } else if (s.mode === 'hold') {
      s.hold -= dt
      if (s.hold <= 0) {
        s.mode = 'return'
        s.v = 0
      }
    } else if (s.mode === 'return') {
      // released: the recoil spring snaps it forward, faster from further back
      s.v += (260 + s.slide * 380) * dt
      s.slide -= s.v * dt
      if (s.slide <= 0) {
        s.slide = 0
        s.v = 0
        s.mode = 'idle'
        audio.current?.slam()
        g.moved = false
      }
    }
    if (s.slide > 0.4 && !s.scraped) {
      s.scraped = true
      audio.current?.scrape(s.mode === 'drag' ? 0.6 : 1)
    }
    // pulling the slide back far enough resets the striker and the trigger
    if (s.slide > TRAVEL * 0.55 && s.latched) {
      s.latched = false
      audio.current?.reset()
    }
    if (s.mode === 'idle' && s.slide === 0) s.scraped = false

    slideRef.current.position.x = -s.slide
    // barrel: locked to the slide for the first few millimetres, then its
    // breech tips down out of the port while the muzzle stays in the slide
    const b = barrelRef.current
    const bx = Math.min(s.slide, BARREL_UNLOCK)
    const tilt = smooth(BARREL_UNLOCK * 0.6, BARREL_UNLOCK + 0.35, s.slide) * 0.03
    b.position.set(BARREL_PIVOT_X - bx, 0, 0)
    b.rotation.z = tilt

    // ---- trigger ----
    const want = s.pull || s.latched ? 1 : 0
    s.trig += (want - s.trig) * Math.min(1, dt * (want ? 22 : 14))
    if (s.pull && s.trig > 0.9) {
      s.pull = false
      s.latched = true
      audio.current?.click()
    }
    triggerRef.current.rotation.z = -0.3 * s.trig
    triggerRef.current.position.x = PIVOT_TRIGGER.x - 0.12 * s.trig
    // the finger presses the safety lever flush before the trigger moves
    bladeRef.current.position.x = -0.1 * Math.min(1, s.trig * 4)

    // ---- magazine ----
    const mt = s.magOut ? 1 : 0
    s.mag += (mt - s.mag) * Math.min(1, dt * (s.magOut ? 9 : 7))
    const k = MAG_DROP * s.mag
    magRef.current.position.set(GRIP_DIR.x * k, GRIP_DIR.y * k, 0)
  })

  const over = (name) => (e) => {
    e.stopPropagation()
    setHover(name)
  }
  const out = () => setHover(null)

  const showDots = sights !== 'black'
  const dotMat = sights === 'tritium' ? mats.tritium : mats.white
  const H = SLIDE.half
  const rearY = SLIDE.top - 0.02 + 0.3
  // magazine release sits where the trigger guard meets the front strap
  const rel = new THREE.Vector2(GRIP_TOP.x - 0.25, GRIP_TOP.y + 0.15)

  return (
    <group ref={root}>
      {/* ---------------- slide ---------------- */}
      <group ref={slideRef}>
        <mesh geometry={geo.slide} material={mats.slide} castShadow receiveShadow onPointerDown={onSlideDown} onPointerOver={over('slide')} onPointerOut={out} />
        {/* dark backing just inside the nose, so the clearance round the
            barrel and the guide rod reads as a shadowed bore, not a hollow slide */}
        <mesh geometry={geo.noseGap} material={mats.hole} position={[SLIDE.front - 0.2, 0, 0]} rotation-y={Math.PI / 2} />
        <mesh geometry={geo.rodGap} material={mats.hole} position={[SLIDE.front - 0.2, -0.97, 0]} rotation-y={Math.PI / 2} />
        {/* back plate and the striker channel */}
        <mesh geometry={geo.plate} material={mats.sight} position={[SLIDE.rear - 0.008, 0.05, 0]} />
        <mesh geometry={geo.striker} material={mats.hole} position={[SLIDE.rear - 0.02, 0.0, 0]} rotation-y={-Math.PI / 2} />
        {/* extractor, on the right behind the port */}
        <mesh geometry={geo.extractor} material={mats.steel} position={[PORT.rear - 0.8, 0.52, H + 0.012]} castShadow />
        {/* sights */}
        <mesh geometry={geo.rear} material={mats.sight} castShadow />
        <mesh geometry={geo.front} material={mats.sight} castShadow />
        {sights === 'white' && <mesh geometry={geo.sightU} material={mats.white} />}
        {sights === 'tritium' &&
          [-0.42, 0.42].map((z) => (
            <group key={z} position={[-8.73, rearY - 0.02, z]} rotation-y={-Math.PI / 2}>
              <mesh geometry={geo.ring} material={mats.white} />
              <mesh geometry={geo.dot} material={dotMat} />
            </group>
          ))}
        {showDots && (
          <group position={[8.245, SLIDE.top + 0.22, 0]} rotation-y={-Math.PI / 2}>
            <mesh geometry={geo.dot} material={dotMat} scale={0.85} />
            {sights === 'tritium' && <mesh geometry={geo.ring} material={mats.white} scale={0.85} />}
          </group>
        )}
        {/* engraving on the left flat */}
        <mesh geometry={geo.decalSlide} material={decals.slide} position={[-3.9, 0.2, -H - 0.002]} rotation-y={Math.PI} />
      </group>

      {/* ---------------- barrel ---------------- */}
      <group ref={barrelRef} position={[BARREL_PIVOT_X, 0, 0]}>
        <group position={[-BARREL_PIVOT_X, 0, 0]}>
          <mesh geometry={geo.hood} material={mats.barrel} castShadow />
          <mesh geometry={geo.tube} material={mats.barrel} />
          <mesh geometry={geo.bore} material={mats.bore} />
          <mesh geometry={geo.plug} material={mats.plug} />
          <mesh geometry={geo.decalHood} material={decals.hood} position={[0.9, 0.95, H - 0.028]} />
        </group>
      </group>

      {/* recoil spring guide rod, fixed to the frame */}
      <mesh geometry={geo.rod} material={mats.steel} position={[4.6, -0.97, 0]} />
      <mesh geometry={geo.rodEnd} material={mats.pin} position={[SLIDE.front - 0.04, -0.97, 0]} />

      {/* ---------------- frame ---------------- */}
      <mesh geometry={geo.upper} material={mats.frame} castShadow receiveShadow />
      <mesh geometry={geo.guard} material={mats.frame} castShadow receiveShadow />
      <mesh geometry={geo.grip} material={mats.grip} castShadow receiveShadow />
      {/* accessory rail: a groove each side and a cross slot underneath */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} geometry={geo.rail} material={mats.hole} position={[5.6, -2.15, sd * 1.14]} />
      ))}
      <mesh geometry={geo.slot} material={mats.hole} position={[5.0, -2.53, 0]} />
      <mesh geometry={geo.decalFrame} material={decals.frame} position={[4.9, -1.82, 1.177]} />

      {/* pins through the frame */}
      <mesh geometry={geo.pin} material={mats.pin} position={[1.95, -1.72, 0]} />
      <mesh geometry={geo.pinSmall} material={mats.pin} position={[-0.3, -1.95, 0]} />
      <mesh geometry={geo.pinSmall} material={mats.pin} position={[-7.75, -1.7, 0]} />

      {/* takedown lever, both sides */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} geometry={geo.takedown} material={mats.steel} position={[3.05, -1.5, sd * 1.19]} rotation-z={0.12} />
      ))}
      {/* slide stop lever, left side, with its thumb tab */}
      <group position={[0.1, -1.42, -1.22]}>
        <mesh geometry={geo.lever} material={mats.steel} castShadow />
        <mesh geometry={geo.tab} material={mats.steel} position={[-1.15, 0.0, -0.03]} castShadow />
      </group>
      {/* magazine release, ambidextrous */}
      {[-1, 1].map((sd) => (
        <mesh
          key={sd}
          geometry={geo.release}
          material={mats.frame}
          position={[rel.x, rel.y, sd * 1.36]}
          rotation-z={GRIP_ANGLE}
          castShadow
          onClick={(e) => {
            e.stopPropagation()
            toggleMag()
          }}
          onPointerOver={over('release')}
          onPointerOut={out}
        />
      ))}

      {/* ---------------- trigger ---------------- */}
      <group
        ref={triggerRef}
        position={PIVOT_TRIGGER}
        onClick={(e) => {
          e.stopPropagation()
          fire()
        }}
        onPointerOver={over('trigger')}
        onPointerOut={out}
      >
        <mesh geometry={geo.shoe} material={mats.frame} castShadow />
        <mesh ref={bladeRef} geometry={geo.blade} material={mats.frame} castShadow />
      </group>

      {/* ---------------- magazine ---------------- */}
      <group ref={magRef}>
        <mesh geometry={geo.magBody} material={mats.magBody} castShadow />
        <mesh
          geometry={geo.magBase}
          material={mats.grip}
          castShadow
          receiveShadow
          onClick={(e) => {
            e.stopPropagation()
            toggleMag()
          }}
          onPointerOver={over('mag')}
          onPointerOut={out}
        />
      </group>
    </group>
  )
})

export default Pistol
export const pistolView = { minX: -9.7, maxX: 9.4, minY: -10.3, maxY: 2.0 }
