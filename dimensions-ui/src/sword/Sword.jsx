import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { createSwordAudio } from './audio.js'
import { BLADE_L, BLADE_TOP, bladeGeometry, ferruleGeometry, gripGeometry, guardGeometries, pommelGeometry, tipY } from './geometry.js'
import { bladeMaps, bronzeMaps, medallionBump } from './textures.js'

// An ornate longsword, 1.15 m and 1.4 kg, balanced a hand's width below
// the guard: a forged blade with a fuller, bright ground edges and etched
// knotwork and runes; an aged-bronze guard with down-swept quillons, horns
// and barbs and a chased medallion on each face; a wire-ringed grip and a
// spiked finial pommel.
//
// It is a rigid body with a real mass and moment of inertia. Take hold of
// it and your hand is a spring at the point you grabbed, with a wrist that
// resists twisting: the sword lags your hand, swings through, and the tip
// (a long way from the hand) whistles when it moves fast. Let go and it is
// set back in its display pose. Tap the blade and it rings: the flat flexes
// and the steel's bending modes sound, longest near the middle of the
// blade, the high ones dying first.
// SI units: metres, kilograms, seconds. Sword frame: the guard at the
// origin, the blade down -y, the flats facing ±z.

const MASS = 1.4
const COM = new THREE.Vector3(0, -0.105, 0) // the point of balance
const I_BODY = new THREE.Vector3(0.13, 0.0009, 0.13) // about the balance point
const G = 9.81
const DISPLAY_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.42))
const MID = new THREE.Vector3(0, (tipY + 0.335) / 2, 0)

const FITTINGS = {
  bronze: { base: '#8a6c45', accent: '#d2ab62', rough: 0.38 },
  gold: { base: '#8a6a2c', accent: '#e2c06a', rough: 0.3 },
  blackened: { base: '#2a2826', accent: '#9a8f80', rough: 0.5 },
}
export const FITTING_NAMES = Object.keys(FITTINGS)

// steel: dark | polished | damascus. fittings: bronze | gold | blackened.
// etched: the knotwork and runes. sound: the ring and the swish.
export default function Sword({ steel = 'dark', fittings = 'bronze', etched = true, sound = true, onReport }) {
  const [hover, setHover] = useState(null)
  const [held, setHeld] = useState(false)
  useCursor(!!hover || held, held ? 'grabbing' : 'grab')
  const { camera, gl, controls } = useThree()

  // ---- geometry ----
  const geo = useMemo(() => {
    const guard = guardGeometries()
    const pommel = pommelGeometry()
    return { blade: bladeGeometry(), ...guard, grip: gripGeometry(), ferrule: ferruleGeometry(), pommel: pommel.body, spike: pommel.spike }
  }, [])
  useEffect(
    () => () => {
      for (const v of Object.values(geo)) Array.isArray(v) ? v.forEach((g) => g.dispose()) : v.dispose?.()
    },
    [geo],
  )

  // ---- materials ----
  const blade = useMemo(() => bladeMaps(steel, etched), [steel, etched])
  useEffect(() => () => Object.values(blade).forEach((t) => t.dispose()), [blade])
  const F = FITTINGS[fittings] || FITTINGS.bronze
  const bronze = useMemo(() => bronzeMaps(F.base), [F.base])
  useEffect(() => () => Object.values(bronze).forEach((t) => t.dispose()), [bronze])
  const medal = useMemo(() => medallionBump(), [])
  useEffect(() => () => medal.dispose(), [medal])

  const vib = useMemo(() => ({ uAmp: { value: 0 }, uTime: { value: 0 } }), [])
  const mats = useMemo(() => {
    // the blade: steel brushed along its length (anisotropic highlights),
    // and it can flex: a cantilever's first bending mode from the guard
    const bladeMat = new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 1, anisotropy: 0.55, anisotropyRotation: Math.PI / 2, envMapIntensity: 1.25, side: THREE.DoubleSide })
    bladeMat.onBeforeCompile = (sh) => {
      sh.uniforms.uAmp = vib.uAmp
      sh.uniforms.uTime = vib.uTime
      sh.vertexShader = 'uniform float uAmp;\nuniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float sv = clamp((${BLADE_TOP.toFixed(4)} - position.y) / ${BLADE_L.toFixed(4)}, 0.0, 1.0);
        transformed.z += uAmp * sv * sv * (3.0 - sv) * 0.5 * sin(uTime * 88.0);`,
      )
    }
    bladeMat.customProgramCacheKey = () => 'sword-blade'
    return {
      blade: bladeMat,
      bronze: new THREE.MeshPhysicalMaterial({ metalness: 1, bumpScale: 1.2, envMapIntensity: 1.1 }),
      accent: new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.24, bumpScale: 2.2, envMapIntensity: 1.2 }),
      grip: new THREE.MeshPhysicalMaterial({ color: '#2f2d2b', metalness: 0.85, roughness: 0.4, envMapIntensity: 1 }),
    }
  }, [vib])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => {
    Object.assign(mats.blade, blade)
    mats.blade.needsUpdate = true
    mats.bronze.map = bronze.map
    mats.bronze.bumpMap = bronze.bumpMap
    mats.bronze.roughness = F.rough
    mats.bronze.needsUpdate = true
    mats.accent.color.set(F.accent)
    mats.accent.bumpMap = medal
    mats.accent.needsUpdate = true
    mats.grip.color.set(fittings === 'gold' ? '#3a2f22' : '#2f2d2b')
  }, [mats, blade, bronze, medal, F, fittings])

  // ---- sound ----
  const audio = useRef(null)
  const live = useRef({})
  live.current = { sound }
  useEffect(() => {
    if (!sound) {
      audio.current?.dispose()
      audio.current = null
    }
  }, [sound])
  useEffect(() => () => audio.current?.dispose(), [])
  const snd = () => {
    if (!live.current.sound) return null
    if (!audio.current) audio.current = createSwordAudio()
    return audio.current
  }

  // ---- the body ----
  const displayPos = useMemo(() => COM.clone().sub(MID).applyQuaternion(DISPLAY_Q), [])
  const st = useRef({
    p: displayPos.clone(), // the balance point, in the world
    q: DISPLAY_Q.clone(),
    v: new THREE.Vector3(),
    w: new THREE.Vector3(),
    mode: 'display', // display | held | return
    t: 0,
    ring: 0,
    ringT: 0,
    grab: null, // { local, target, qHold }
  })

  const invIWorld = (q) => {
    const m = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q))
    const e = m.elements
    const d = I_BODY
    const o = new THREE.Matrix3()
    const oe = o.elements
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) oe[j * 3 + i] = e[i] * e[j] / d.x + e[3 + i] * e[3 + j] / d.y + e[6 + i] * e[6 + j] / d.z
    return o
  }

  // ---- pointer ----
  const press = useRef(null)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const onDown = (part) => (e) => {
    e.stopPropagation()
    if (controls) controls.enabled = false
    const s = st.current
    // the touched point, in the sword frame (relative to the guard)
    const origin = s.p.clone().sub(COM.clone().applyQuaternion(s.q))
    const local = e.point.clone().sub(origin).applyQuaternion(s.q.clone().invert())
    const n = camera.getWorldDirection(new THREE.Vector3()).negate()
    press.current = { part, local, sx: e.clientX, sy: e.clientY, moved: false, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, e.point), target: e.point.clone() }
    snd()?.start()
  }
  useEffect(() => {
    const move = (e) => {
      const pr = press.current
      if (!pr) return
      if (!pr.moved && Math.hypot(e.clientX - pr.sx, e.clientY - pr.sy) > 5) {
        pr.moved = true
        const s = st.current
        s.mode = 'held'
        s.grab = { local: pr.local.clone().sub(COM), target: pr.target, qHold: s.q.clone() }
        setHeld(true)
      }
      if (!pr.moved) return
      const r = gl.domElement.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      ray.ray.intersectPlane(pr.plane, pr.target)
    }
    const up = () => {
      const pr = press.current
      if (!pr) return
      press.current = null
      if (controls) controls.enabled = true
      const s = st.current
      if (pr.moved) {
        s.mode = 'return'
        s.t = 0
        s.grab = null
        setHeld(false)
      } else if (pr.part === 'blade') {
        // a tap on the flat: it flexes and rings
        const at = THREE.MathUtils.clamp((BLADE_TOP - pr.local.y) / BLADE_L, 0, 1)
        s.ring = 0.0035 * (0.4 + at)
        s.ringT = 0
        snd()?.ring(at, 1)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  })

  // ---- simulation ----
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), q: new THREE.Quaternion() }), [])
  const step = (h) => {
    const s = st.current
    if (s.mode !== 'held' || !s.grab) return
    const invI = invIWorld(s.q)
    // the hand: a stiff spring from the grab point to the pointer
    const r = tmp.a.copy(s.grab.local).applyQuaternion(s.q) // grab point from the balance point
    const vp = tmp.b.crossVectors(s.w, r).add(s.v)
    const K = 260
    const C = 2 * Math.sqrt(K * MASS) * 0.7
    const F = tmp.c.subVectors(s.grab.target, tmp.a.clone().add(s.p)).multiplyScalar(K).addScaledVector(vp, -C)
    F.y -= MASS * G
    s.v.addScaledVector(F, h / MASS)
    const torque = new THREE.Vector3().crossVectors(r, tmp.c.copy(F).setY(F.y + MASS * G))
    // the wrist: resists turning away from how it was taken, softly
    tmp.q.copy(s.grab.qHold).multiply(s.q.clone().invert())
    if (tmp.q.w < 0) tmp.q.set(-tmp.q.x, -tmp.q.y, -tmp.q.z, -tmp.q.w)
    const ang = 2 * Math.acos(Math.min(1, tmp.q.w))
    if (ang > 1e-5) {
      const ax = new THREE.Vector3(tmp.q.x, tmp.q.y, tmp.q.z).normalize()
      torque.addScaledVector(ax, 9 * ang)
    }
    torque.addScaledVector(s.w, -0.9)
    s.w.add(torque.applyMatrix3(invI).multiplyScalar(h))
    s.v.multiplyScalar(Math.exp(-0.2 * h))
    s.p.addScaledVector(s.v, h)
    const wl = s.w.length()
    if (wl > 1e-8) s.q.premultiply(tmp.q.setFromAxisAngle(tmp.a.copy(s.w).divideScalar(wl), wl * h)).normalize()
  }

  const groupRef = useRef()
  const idle = useRef(0)
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20)
    if (!(dt > 0)) return
    const s = st.current
    const n = Math.ceil(dt / (1 / 800))
    for (let i = 0; i < n; i++) step(dt / n)
    if (s.mode === 'return') {
      // set back on display: eased home
      s.t += dt
      const k = 1 - Math.exp(-dt * 4)
      s.p.lerp(displayPos, k)
      s.q.slerp(DISPLAY_Q, k)
      s.v.multiplyScalar(1 - k)
      s.w.multiplyScalar(1 - k)
      if (s.t > 1.6) s.mode = 'display'
    }
    // on display it turns slowly, so the light runs down the blade
    idle.current += s.mode === 'display' ? dt : 0
    const sway = s.mode === 'display' ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(idle.current * 0.35) * 0.55) : null
    const q = sway ? sway.clone().multiply(s.q) : s.q
    const p = sway ? s.p.clone().applyQuaternion(sway) : s.p
    // the guard origin is the balance point less COM
    groupRef.current.quaternion.copy(q)
    groupRef.current.position.copy(p).sub(COM.clone().applyQuaternion(q))
    // the ring decays; the swish follows the tip
    s.ringT += dt
    vib.uTime.value = s.ringT
    vib.uAmp.value = s.ring * Math.exp(-s.ringT * 2.4)
    if (audio.current) {
      const tip = new THREE.Vector3(0, tipY, 0).sub(COM).applyQuaternion(s.q)
      const tv = new THREE.Vector3().crossVectors(s.w, tip).add(s.v).length()
      audio.current.swish(s.mode === 'held' ? tv : 0)
      if (onReport && s.mode === 'held') onReport(tv)
    }
  })

  const hov = (part) => ({
    onPointerDown: onDown(part),
    onPointerOver: (e) => {
      e.stopPropagation()
      setHover(part)
    },
    onPointerOut: () => setHover(null),
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geo.blade} material={mats.blade} castShadow receiveShadow {...hov('blade')} />
      <group {...hov('hilt')}>
        {/* the guard */}
        <mesh geometry={geo.block} material={mats.bronze} castShadow receiveShadow />
        {[1, -1].map((s) => (
          <group key={s}>
            <mesh geometry={geo.rim} material={mats.accent} position={[0, 0, s * 0.0125]} />
            <mesh geometry={geo.boss} material={mats.accent} position={[0, 0.002, s * 0.0122]} rotation-y={s > 0 ? 0 : Math.PI} castShadow />
          </group>
        ))}
        {geo.horns.map((g, i) => (
          <mesh key={i} geometry={g} material={i < 2 ? mats.bronze : mats.accent} castShadow receiveShadow />
        ))}
        {/* the hilt */}
        <mesh geometry={geo.ferrule} material={mats.accent} position={[0, 0.05, 0]} castShadow />
        <mesh geometry={geo.grip} material={mats.grip} castShadow receiveShadow />
        <mesh geometry={geo.ferrule} material={mats.accent} position={[0, 0.232, 0]} castShadow />
        <mesh geometry={geo.pommel} material={mats.bronze} castShadow receiveShadow />
        <mesh geometry={geo.spike} material={mats.accent} castShadow />
      </group>
    </group>
  )
}
