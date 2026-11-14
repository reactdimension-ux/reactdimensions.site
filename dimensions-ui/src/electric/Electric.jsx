import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { CHORDS, FRETS, GEAR_RATIO, SCALE, STRINGS, TREM, TREM_K, TUNINGS, fretFromNut, frequency, keyAngleFor, noteOf, springPerKeyRad, stepTremolo } from './strings.js'
import {
  ARM_ROOT,
  BRIDGE_PU_SLANT,
  FB,
  FB_END,
  HS_T,
  HS_TOP,
  JACK,
  KEY_X,
  KNOBS,
  NUT_Y,
  PICKUP_Y,
  PIVOT_Y,
  POSTS,
  SADDLE_Y,
  STRING_NUT_X,
  STRING_SADDLE_X,
  SWITCH,
  TOP,
  Z_NUT,
  Z_SADDLE,
  bodyOutline,
  fretY,
  neckWidth,
} from './shapes.js'
import { HEEL_Y, bodyGeometry, dotPositions, fbZ, fretGeometries, fretboardGeometry, guardGeometry, guardScrews, headGeometry, lathe, neckGeometry, pickupGeometry, plateGeometry } from './geometry.js'
import { knobSkirtTexture, knobTopTexture, mapleTexture, rosewoodTexture, sunburstTexture, windingTexture } from './textures.js'
import { bend, mute, pluck as pluckSound, setTone } from './audio.js'

// A classic solid-body electric guitar of our own design, playable.
// Units are metres; the guitar frame has x across (bass side negative), y up
// the neck from the bottom of the body and z out of the top.
//
// The mechanism, all of it live (the physics is in strings.js):
//  - six strings, saddle to nut over a 25.5" scale, each a sum of its modes,
//    so a pluck starts as a triangle and decays high modes first;
//  - 21 frets: press one and the string stops on its crown;
//  - sealed tuners, 16:1: winding a key stretches its string;
//  - a floating vibrato: the bridge rocks on six pivot screws against the
//    springs in the back; push the arm and every string goes flat, let go
//    and it swings back and settles;
//  - three single coils and a five-way switch: the sound is what the
//    selected pickups hear of each string's modes, through the volume and
//    tone knobs and a small amp (audio.js).

const MODES = 18
const SEG = 120
const RAD = 6
const FINISHES = {
  sunburst: ['#120703', '#2b1206', '#6a2a0a', '#b8580f', '#e3a640'],
  black: ['#0b0b0c', '#0f0f10', '#121214', '#141416', '#161618'],
  white: ['#d9d4c4', '#e6e1d2', '#ece8db', '#efebdf', '#f1ede2'],
  red: ['#4a0507', '#6e090c', '#8f0e12', '#a81318', '#b8181d'],
  blue: ['#0f2443', '#173361', '#1d4078', '#244c8c', '#2a5598'],
}

const stringX = (i, y) => STRING_SADDLE_X(i) + ((STRING_NUT_X(i) - STRING_SADDLE_X(i)) * (y - SADDLE_Y)) / SCALE
const stringZ = (y) => Z_SADDLE + ((Z_NUT - Z_SADDLE) * (y - SADDLE_Y)) / SCALE
const radiusOf = (i) => STRINGS[i].radius * 1.15

// a string's tube, rebuilt each frame from its centreline
function stringGeometry() {
  const g = new THREE.BufferGeometry()
  const pos = new Float32Array((SEG + 1) * RAD * 3)
  const nrm = new Float32Array((SEG + 1) * RAD * 3)
  const uv = new Float32Array((SEG + 1) * RAD * 2)
  const idx = []
  for (let j = 0; j <= SEG; j++)
    for (let k = 0; k < RAD; k++) {
      const a = (k / RAD) * Math.PI * 2
      const o = (j * RAD + k) * 3
      nrm[o] = Math.cos(a)
      nrm[o + 2] = Math.sin(a)
      uv[(j * RAD + k) * 2] = k / RAD
      uv[(j * RAD + k) * 2 + 1] = j / SEG
      if (j < SEG) {
        const a0 = j * RAD + k
        const a1 = j * RAD + ((k + 1) % RAD)
        idx.push(a0, a1, a0 + RAD, a1, a1 + RAD, a0 + RAD)
      }
    }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}
const tube = (pts, r, seg = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(4, pts.length * 6), r, seg, false)

function pluckModes(b, h) {
  const out = new Float32Array(MODES)
  const k = (2 * h) / (Math.PI * Math.PI * b * (1 - b))
  for (let n = 1; n <= MODES; n++) out[n - 1] = (k / (n * n)) * Math.sin(n * Math.PI * b)
  return out
}

const Electric = forwardRef(function Electric({ finish = 'sunburst', guard = '#f1eee4', sound = true, drive = 0.2, vibration = 'slow-motion', onInfo }, ref) {
  const { camera, gl, controls, invalidate } = useThree()

  // ---- geometry ----
  const geo = useMemo(() => {
    const g = {
      body: bodyGeometry(),
      guard: guardGeometry(),
      neck: neckGeometry(),
      board: fretboardGeometry(),
      frets: fretGeometries(),
      head: headGeometry(),
      pickup: pickupGeometry(),
      pole: new THREE.CylinderGeometry(0.00245, 0.00245, 0.003, 16).rotateX(Math.PI / 2),
      dot: new THREE.CircleGeometry(0.0031, 24),
      screw: lathe([[0, 0.0012], [0.0018, 0.0011], [0.0021, 0.0004], [0.0021, 0], [0, 0]], 16).rotateX(Math.PI / 2),
      strap: lathe([[0, 0], [0.0045, 0], [0.0045, 0.003], [0.0028, 0.0045], [0.0028, 0.0075], [0.0062, 0.009], [0.0062, 0.0105], [0, 0.0115]], 24),
      post: lathe([[0, 0.0115], [0.003, 0.0115], [0.003, 0.0012], [0.0046, 0.0012], [0.0046, 0], [0, 0]], 24).rotateX(Math.PI / 2),
      neckPlate: plateGeometry(0.05, 0.064, 0.006, 0.0012),
      backCover: plateGeometry(0.072, 0.118, 0.008, 0.0015),
    }
    return g
  }, [])
  const stringGeos = useMemo(() => STRINGS.map(() => stringGeometry()), [])
  // the strings behind the nut, to the tuner posts (B and e pass under a tree)
  const headStrings = useMemo(
    () =>
      STRINGS.map((_, i) => {
        const nut = new THREE.Vector3(STRING_NUT_X(i), NUT_Y, Z_NUT)
        const post = new THREE.Vector3(POSTS[i].x + 0.0028, POSTS[i].y, HS_TOP + 0.0055 - i * 0.0005)
        const pts = [nut]
        if (i >= 4) pts.push(new THREE.Vector3((nut.x + post.x) / 2 + 0.002, NUT_Y + 0.068, HS_TOP + 0.0035))
        else pts.push(nut.clone().lerp(post, 0.5).setZ((Z_NUT + post.z) / 2 + 0.001))
        pts.push(post)
        return tube(pts, radiusOf(i))
      }),
    [],
  )
  useEffect(
    () => () => {
      Object.values(geo).flat().forEach((g) => g.dispose?.())
      stringGeos.forEach((g) => g.dispose())
      headStrings.forEach((g) => g.dispose())
    },
    [geo, stringGeos, headStrings],
  )

  // ---- materials ----
  const tex = useMemo(() => {
    const outline = bodyOutline()
    const box = new THREE.Box2().setFromPoints(outline)
    const maple = mapleTexture()
    maple.repeat.set(1 / 0.06, 1)
    const headMaple = mapleTexture()
    headMaple.repeat.set(1 / 0.08, 1 / 0.3)
    const rose = rosewoodTexture()
    rose.repeat.set(1, 1)
    const winding = windingTexture()
    winding.repeat.set(1, SCALE / 0.00042)
    return { outline, box, maple, headMaple, rose, winding, skirt: knobSkirtTexture(), knobV: knobTopTexture('VOLUME'), knobT: knobTopTexture('TONE') }
  }, [])
  const burst = useMemo(() => sunburstTexture(tex.outline, tex.box, FINISHES[finish] || FINISHES.sunburst), [tex, finish])
  const mats = useMemo(() => {
    const plastic = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.34, clearcoat: 0.4, clearcoatRoughness: 0.3 })
    return {
      top: new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.035 }),
      edge: new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.035 }),
      guard: plastic(guard),
      guardEdge: new THREE.MeshPhysicalMaterial({ color: '#1a1a1a', roughness: 0.4 }),
      cover: plastic('#efebdf'),
      maple: new THREE.MeshPhysicalMaterial({ map: tex.maple, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
      headMaple: new THREE.MeshPhysicalMaterial({ map: tex.headMaple, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
      rose: new THREE.MeshStandardMaterial({ map: tex.rose, roughness: 0.62 }),
      fret: new THREE.MeshPhysicalMaterial({ color: '#d6d8da', metalness: 1, roughness: 0.16 }),
      chrome: new THREE.MeshPhysicalMaterial({ color: '#dfe2e5', metalness: 1, roughness: 0.08 }),
      steel: new THREE.MeshPhysicalMaterial({ color: '#c3c7cb', metalness: 1, roughness: 0.24 }),
      pole: new THREE.MeshPhysicalMaterial({ color: '#b9bdc1', metalness: 1, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.6 }),
      pearl: new THREE.MeshPhysicalMaterial({ color: '#f1ede4', roughness: 0.25, sheen: 0.6, sheenColor: new THREE.Color('#d8e6ff'), clearcoat: 0.6 }),
      nut: new THREE.MeshPhysicalMaterial({ color: '#efe7d2', roughness: 0.4 }),
      plain: new THREE.MeshPhysicalMaterial({ color: '#d2d5d8', metalness: 1, roughness: 0.22 }),
      wound: new THREE.MeshPhysicalMaterial({ color: '#c9c3b6', metalness: 1, roughness: 0.32, bumpMap: tex.winding, bumpScale: 0.00008 }),
      skirt: plastic('#ffffff'),
      knobTopV: plastic('#ffffff'),
      knobTopT: plastic('#ffffff'),
      finger: new THREE.MeshStandardMaterial({ color: '#ff6a2b', transparent: true, opacity: 0.85, roughness: 0.5 }),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      decal: new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.4 }),
    }
  }, [tex, guard])
  useLayoutEffect(() => {
    mats.top.map = burst
    mats.top.needsUpdate = true
    mats.edge.color.set((FINISHES[finish] || FINISHES.sunburst)[0])
    mats.skirt.map = tex.skirt
    mats.knobTopV.map = tex.knobV
    mats.knobTopT.map = tex.knobT
    ;[mats.skirt, mats.knobTopV, mats.knobTopT].forEach((m) => (m.needsUpdate = true))
    invalidate()
    return () => burst.dispose()
  }, [mats, burst, finish, tex, invalidate])
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  useEffect(() => () => Object.values(tex).forEach((t) => t?.isTexture && t.dispose()), [tex])
  // the headstock's wordmark
  const decal = useMemo(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 256 })
    const g = c.getContext('2d')
    g.clearRect(0, 0, 1024, 256)
    g.fillStyle = '#1b1712'
    g.font = 'italic 700 120px Georgia, "Times New Roman", serif'
    g.textBaseline = 'middle'
    g.fillText('React', 40, 110)
    g.font = '600 52px "Helvetica Neue", Arial, sans-serif'
    g.fillText('DIMENSIONS', 380, 120)
    g.font = '600 26px "Helvetica Neue", Arial, sans-serif'
    g.fillStyle = '#6b5a3a'
    g.fillText('SOLID BODY · MODEL RD-1', 382, 172)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  useLayoutEffect(() => {
    mats.decal.map = decal
    mats.decal.needsUpdate = true
    return () => decal.dispose()
  }, [mats, decal])

  // ---- state ----
  const s = useRef(null)
  if (!s.current)
    s.current = {
      key: STRINGS.map(() => 0),
      fret: [0, 0, 0, 0, 0, 0],
      chord: 'open',
      str: STRINGS.map(() => ({ A: new Float32Array(MODES), t: 0, active: false, dirty: true, dx: 1, dz: 0.2, damped: false, muted: false })),
      trem: { a: 0, v: 0 },
      hand: null,
      knobs: [8, 7, 7],
      selector: 2,
      drag: null,
      sel: 0,
      anim: null,
      infoDirty: true,
      infoT: 0,
    }
  const live = useRef({})
  live.current = { sound, vibration, onInfo, drive }

  const freq = (i) => frequency(i, s.current.key[i], s.current.trem.a, Math.max(0, s.current.fret[i]))
  const applyTone = () => {
    const st = s.current
    const usesBridge = st.selector <= 1
    setTone({ volume: st.knobs[0], tone: usesBridge ? st.knobs[2] : st.knobs[1], drive: live.current.drive })
  }
  useEffect(() => {
    if (sound) applyTone()
  }, [drive, sound]) // eslint-disable-line react-hooks/exhaustive-deps

  // the saddle's top, which rides on the rocking bridge
  const saddleAt = (a) => {
    const y = SADDLE_Y - PIVOT_Y
    const z = Z_SADDLE - TOP
    return [PIVOT_Y + y * Math.cos(a) - z * Math.sin(a), TOP + y * Math.sin(a) + z * Math.cos(a)]
  }

  const pluckString = (i, y, loud = 0.7, dir = 1) => {
    const st = s.current
    const str = st.str[i]
    const k = st.fret[i]
    const muted = k < 0
    const stop = k > 0 ? fretY(k) : NUT_Y
    const b = THREE.MathUtils.clamp((y - SADDLE_Y) / (stop - SADDLE_Y), 0.04, 0.96)
    const h = (0.0011 + 0.0022 * loud) * (muted ? 0.4 : 1)
    str.A = pluckModes(b, h)
    str.t = 0
    str.active = true
    str.damped = false
    str.muted = muted
    str.dx = dir
    str.dz = (Math.random() - 0.5) * 0.4
    st.sel = i
    st.infoDirty = true
    if (live.current.sound) {
      applyTone()
      pluckSound(i, { b, strength: loud * (muted ? 0.3 : 1), f: freq(i), fret: Math.max(0, k), selector: st.selector })
    }
    invalidate()
  }
  const strum = (down = true, loud = 0.75) => {
    const order = down ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0]
    order.forEach((i, n) => setTimeout(() => s.current && pluckString(i, PICKUP_Y.middle + 0.02 + n * 0.002, loud * (0.85 + Math.random() * 0.2), down ? 1 : -1), n * 14))
  }
  const setFret = (i, k) => {
    const st = s.current
    if (st.fret[i] === k) return
    st.fret[i] = k
    st.str[i].dirty = true
    st.chord = 'custom'
    st.infoDirty = true
    if (st.str[i].active && k >= 0 && live.current.sound) bend(i, freq(i))
    if (k < 0) {
      st.str[i].damped = true
      if (live.current.sound) mute(i)
    }
    invalidate()
  }
  const setChord = (name) => {
    const shape = CHORDS[name]
    if (!shape) return
    const st = s.current
    shape.forEach((k, i) => {
      if (st.fret[i] !== k) {
        st.fret[i] = k
        st.str[i].dirty = true
        if (st.str[i].active) {
          st.str[i].damped = true
          if (live.current.sound) mute(i)
        }
      }
    })
    st.chord = name
    st.infoDirty = true
    invalidate()
  }
  const retuneTo = (cents, then) => {
    const st = s.current
    st.anim = { from: [...st.key], to: cents.map((c, i) => keyAngleFor(i, c)), t: 0, dur: 1.6, then }
    invalidate()
  }
  useImperativeHandle(ref, () => ({
    strum,
    setChord,
    tune: (name = 'standard') => retuneTo(TUNINGS[name] || TUNINGS.standard, 'strum'),
    pluck: (i) => pluckString(i, PICKUP_Y.middle + 0.02, 0.7, 1),
    dive: () => {
      s.current.trem.v -= 2.4
      invalidate()
    },
  }))

  // ---- pointer handling ----
  const guitarRef = useRef()
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const inv = useMemo(() => new THREE.Matrix4(), [])
  const toLocal = (r, z) => {
    const g = guitarRef.current
    g.updateWorldMatrix(true, false)
    inv.copy(g.matrixWorld).invert()
    const o = r.origin.clone().applyMatrix4(inv)
    const d = r.direction.clone().transformDirection(inv)
    if (Math.abs(d.z) < 1e-5) return null
    return o.addScaledVector(d, (z - o.z) / d.z)
  }
  const rayFromClient = (cx, cy) => {
    const rect = gl.domElement.getBoundingClientRect()
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.ray
  }
  const grab = () => controls && (controls.enabled = false)
  const nearestString = (p, within = 0.004) => {
    let best = -1
    let bd = within
    for (let i = 0; i < 6; i++) {
      const d = Math.abs(p.x - stringX(i, p.y))
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return best
  }
  const down = (kind, extra = {}) => (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    grab()
    s.current.drag = { kind, x0: e.nativeEvent.clientX, y0: e.nativeEvent.clientY, t: performance.now(), ...extra }
  }
  const onStrumDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const p = toLocal(e.ray, Z_SADDLE)
    if (!p) return
    grab()
    s.current.drag = { kind: 'strum', last: p, start: p, t: performance.now(), crossed: false }
  }
  const onFretDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.stopPropagation()
    const p = toLocal(e.ray, FB + 0.003)
    if (!p) return
    const i = nearestString(p, 0.005)
    if (i < 0) return
    const fromNut = NUT_Y - p.y
    if (fromNut <= 0) return
    const k = Math.ceil(-12 * Math.log2(1 - fromNut / SCALE) - 1e-6)
    if (k < 1 || k > FRETS) return
    const st = s.current
    setFret(i, st.fret[i] === k ? 0 : k)
    st.sel = i
  }

  useEffect(() => {
    const move = (ev) => {
      const st = s.current
      const d = st.drag
      if (!d) return
      if (d.kind === 'strum') {
        const p = toLocal(rayFromClient(ev.clientX, ev.clientY), Z_SADDLE)
        if (!p) return
        const now = performance.now()
        const dt = Math.max(4, now - d.t) / 1000
        const loud = THREE.MathUtils.clamp(Math.hypot(p.x - d.last.x, p.y - d.last.y) / dt / 1.4, 0.25, 1)
        for (let i = 0; i < 6; i++) {
          const xa = d.last.x - stringX(i, d.last.y)
          const xb = p.x - stringX(i, p.y)
          if (xa * xb < 0) {
            const f = xa / (xa - xb)
            const y = THREE.MathUtils.lerp(d.last.y, p.y, f)
            if (y > SADDLE_Y + 0.006 && y < NUT_Y - 0.005) {
              pluckString(i, y, loud, Math.sign(p.x - d.last.x))
              d.crossed = true
            }
          }
        }
        d.last = p
        d.t = now
      } else if (d.kind === 'key') {
        const i = d.i
        const delta = (d.y0 - ev.clientY + (ev.clientX - d.x0) * 0.3) * 0.05 * (ev.shiftKey ? 0.2 : 1)
        const max = keyAngleFor(i, 500)
        const min = (-0.9 * STRINGS[i].T0) / springPerKeyRad(i)
        st.key[i] = THREE.MathUtils.clamp(d.key0 + delta, min, max)
        st.str[i].dirty = true
        st.infoDirty = true
        if (st.str[i].active && live.current.sound) bend(i, freq(i))
        invalidate()
      } else if (d.kind === 'knob') {
        st.knobs[d.i] = THREE.MathUtils.clamp(d.v0 + (d.y0 - ev.clientY) * 0.06, 0, 10)
        if (live.current.sound) applyTone()
        invalidate()
      } else if (d.kind === 'arm') {
        // pressing the arm down (pointer moving down) dives the bridge
        const target = THREE.MathUtils.clamp(-(ev.clientY - d.y0) * 0.0016, TREM.min, TREM.max)
        st.hand = target
        invalidate()
      }
    }
    const up = () => {
      const st = s.current
      const d = st.drag
      if (!d) return
      st.drag = null
      if (controls) controls.enabled = true
      if (d.kind === 'strum' && !d.crossed) {
        const i = nearestString(d.start, 0.006)
        if (i >= 0) pluckString(i, d.start.y, 0.65, Math.sign(d.start.x - stringX(i, d.start.y)) || 1)
      }
      if (d.kind === 'switch') {
        st.selector = (st.selector + 1) % 5
        st.infoDirty = true
        if (live.current.sound) applyTone()
        invalidate()
      }
      if (d.kind === 'arm') st.hand = null
      invalidate()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [controls, camera, gl]) // eslint-disable-line react-hooks/exhaustive-deps
  const cursor = (c) => () => (gl.domElement.style.cursor = c)

  // ---- per frame ----
  const bridgeRef = useRef()
  const postRefs = useRef([])
  const keyRefs = useRef([])
  const knobRefs = useRef([])
  const leverRef = useRef()
  const fingerRefs = useRef([])
  const coef = useMemo(() => new Float32Array(MODES), [])
  useFrame((state, delta) => {
    const st = s.current
    const dt = Math.min(delta, 1 / 30)
    let busy = !!st.drag

    // tuning animation
    if (st.anim) {
      const a = st.anim
      a.t += dt
      const k = Math.min(1, a.t / a.dur)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      for (let i = 0; i < 6; i++) {
        st.key[i] = a.from[i] + (a.to[i] - a.from[i]) * e
        st.str[i].dirty = true
        if (st.str[i].active && live.current.sound) bend(i, freq(i))
      }
      st.infoDirty = true
      busy = true
      if (k >= 1) {
        st.anim = null
        if (a.then === 'strum') strum(true, 0.7)
      }
    }

    // the vibrato: a hand on the arm holds it toward a target angle
    const tr = st.trem
    const before = tr.a
    const n = 10
    for (let i = 0; i < n; i++) {
      const hand = st.hand === null ? 0 : TREM_K * 1.4 * (st.hand - tr.a) - 0.02 * tr.v
      stepTremolo(tr, hand, dt / n)
    }
    if (Math.abs(tr.a) < 1e-5 && Math.abs(tr.v) < 1e-4 && st.hand === null) {
      tr.a = 0
      tr.v = 0
    } else busy = true
    if (tr.a !== before) {
      for (let i = 0; i < 6; i++) {
        st.str[i].dirty = true
        if (st.str[i].active && live.current.sound) bend(i, freq(i))
      }
      st.infoDirty = true
    }
    if (bridgeRef.current) bridgeRef.current.rotation.x = tr.a

    // tuners, knobs, switch, fingers
    for (let i = 0; i < 6; i++) {
      if (keyRefs.current[i]) keyRefs.current[i].rotation.x = st.key[i]
      if (postRefs.current[i]) postRefs.current[i].rotation.z = -st.key[i] / GEAR_RATIO
      const f = fingerRefs.current[i]
      const k = st.fret[i]
      if (f) {
        f.visible = k > 0
        if (k > 0) {
          const y = fretY(k) + 0.35 * (fretY(k - 1) - fretY(k))
          f.position.set(stringX(i, y), y, fbZ(stringX(i, y)) + 0.0028)
        }
      }
    }
    knobRefs.current.forEach((m, i) => m && (m.rotation.z = -THREE.MathUtils.degToRad(-150 + st.knobs[i] * 30)))
    if (leverRef.current) leverRef.current.rotation.x = -0.32 + st.selector * 0.16

    // strings
    const slow = live.current.vibration !== 'real-time'
    const now = state.clock.elapsedTime
    const [ys, zs] = saddleAt(tr.a)
    for (let i = 0; i < 6; i++) {
      const str = st.str[i]
      if (!str.active && !str.dirty) continue
      const f0 = freq(i)
      let peak = 0
      if (str.active) {
        str.t += dt
        const fv = slow ? 1.4 * Math.pow(f0 / 82.4, 0.4) : f0
        const tt = slow ? str.t : now
        for (let m = 1; m <= MODES; m++) {
          const rate = (str.muted ? 22 : 0.22 + m * f0 * 0.0005) + (str.damped ? 30 : 0)
          const amp = str.A[m - 1] * Math.exp(-rate * str.t)
          coef[m - 1] = amp * Math.cos(2 * Math.PI * m * fv * tt)
          peak = Math.max(peak, Math.abs(amp))
        }
        if (peak < 0.00001) {
          str.active = false
          coef.fill(0)
        } else busy = true
      } else coef.fill(0)
      str.dirty = false

      const k = st.fret[i]
      const yStop = k > 0 ? fretY(k) : NUT_Y
      const r = radiusOf(i)
      const zFret = (y) => fbZ(stringX(i, y)) + 0.00115 + r
      const pos = stringGeos[i].attributes.position.array
      const dl = Math.hypot(str.dx, str.dz) || 1
      const ux = str.dx / dl
      const uz = str.dz / dl
      for (let j = 0; j <= SEG; j++) {
        const y = ys + (j / SEG) * (NUT_Y - ys)
        const x = stringX(i, y)
        const zOpen = zs + ((Z_NUT - zs) * (y - ys)) / (NUT_Y - ys)
        let z = zOpen
        if (k > 0) {
          const zf = zFret(yStop)
          z = y <= yStop ? zs + ((zf - zs) * (y - ys)) / (yStop - ys) : zf + ((Z_NUT - zf) * (y - yStop)) / (NUT_Y - yStop)
        }
        let disp = 0
        if (str.active && y < yStop) {
          const u = (y - ys) / (yStop - ys)
          for (let m = 1; m <= MODES; m++) disp += coef[m - 1] * Math.sin(m * Math.PI * u)
        }
        const cx = x + disp * ux
        const cz = z + disp * uz
        for (let q = 0; q < RAD; q++) {
          const a = (q / RAD) * Math.PI * 2
          const o = (j * RAD + q) * 3
          pos[o] = cx + Math.cos(a) * r
          pos[o + 1] = y
          pos[o + 2] = cz + Math.sin(a) * r
        }
      }
      stringGeos[i].attributes.position.needsUpdate = true
      stringGeos[i].computeBoundingSphere()
    }

    st.infoT += dt
    if (st.infoDirty && st.infoT > 0.06) {
      st.infoDirty = false
      st.infoT = 0
      const f = freq(st.sel)
      live.current.onInfo?.({ chord: st.chord, selector: st.selector, knobs: [...st.knobs], sel: { index: st.sel, hz: f, fret: st.fret[st.sel], ...noteOf(f) }, bridge: tr.a })
    }
    if (busy) invalidate()
  })

  // ---- layout helpers ----
  const frets = geo.frets
  const dots = useMemo(() => dotPositions(), [])
  const screws = useMemo(() => guardScrews(), [])
  const pickups = [
    ['neck', PICKUP_Y.neck, 0],
    ['middle', PICKUP_Y.middle, 0],
    ['bridge', PICKUP_Y.bridge, BRIDGE_PU_SLANT],
  ]
  const intonation = [-0.0034, -0.0026, -0.0016, -0.003, -0.002, -0.0012]
  const arm = useMemo(() => {
    const r = [ARM_ROOT.x - 0, ARM_ROOT.y - PIVOT_Y, 0]
    const pts = [
      [r[0], r[1], 0.002],
      [r[0], r[1], 0.026],
      [r[0] + 0.008, r[1] + 0.018, 0.036],
      [r[0] + 0.04, r[1] + 0.085, 0.04],
      [r[0] + 0.062, r[1] + 0.135, 0.04],
    ].map((p) => new THREE.Vector3(...p))
    return { geo: tube(pts, 0.0026, 10), tip: pts[pts.length - 1], dir: pts[pts.length - 1].clone().sub(pts[pts.length - 2]).normalize() }
  }, [])
  useEffect(() => () => arm.geo.dispose(), [arm])
  const tipQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), arm.dir), [arm])
  // each string's short run from the saddle back down through the plate
  const tails = useMemo(
    () =>
      STRINGS.map((_, i) => {
        const x = STRING_SADDLE_X(i)
        return tube([new THREE.Vector3(x, SADDLE_Y - PIVOT_Y, Z_SADDLE - TOP), new THREE.Vector3(x, SADDLE_Y - PIVOT_Y - 0.008, 0.0045), new THREE.Vector3(x, SADDLE_Y - PIVOT_Y - 0.026, 0.0022)], radiusOf(i))
      }),
    [],
  )
  useEffect(() => () => tails.forEach((g) => g.dispose()), [tails])

  return (
    <group ref={guitarRef}>
      {/* body: sunburst top and back, dark rolled edge */}
      <mesh geometry={geo.body} material={[mats.top, mats.edge]} castShadow receiveShadow onPointerDown={onStrumDown} />
      <mesh geometry={geo.guard} material={[mats.guard, mats.guardEdge]} castShadow receiveShadow />
      {screws.map(([x, y], i) => (
        <mesh key={i} geometry={geo.screw} material={mats.chrome} position={[x, y, TOP + 0.0024]} />
      ))}
      {/* pickups */}
      {pickups.map(([name, y, slant]) => (
        <group key={name} position={[0, y, TOP + 0.0046]} rotation-z={slant}>
          <mesh geometry={geo.pickup} material={mats.cover} castShadow receiveShadow />
          {STRINGS.map((_, i) => (
            <mesh key={i} geometry={geo.pole} material={mats.pole} position={[stringX(i, y), 0, 0.0088]} />
          ))}
          {[-1, 1].map((sd) => (
            <mesh key={sd} geometry={geo.screw} material={mats.chrome} position={[sd * 0.0465, 0, -0.0022]} />
          ))}
        </group>
      ))}
      {/* controls: volume, two tones, the five-way switch */}
      {KNOBS.map((k, i) => (
        <group key={i} position={[k.x, k.y, TOP + 0.0024]}>
          <group ref={(m) => (knobRefs.current[i] = m)}>
            <mesh
              rotation-x={Math.PI / 2}
              position-z={0.0085}
              material={[mats.skirt, i === 0 ? mats.knobTopV : mats.knobTopT, mats.skirt]}
              castShadow
              onPointerDown={down('knob', { i, v0: s.current.knobs[i] })}
              onPointerOver={cursor('ns-resize')}
              onPointerOut={cursor('')}
            >
              <cylinderGeometry args={[0.0088, 0.0098, 0.017, 48]} />
            </mesh>
          </group>
        </group>
      ))}
      <group position={[SWITCH.x, SWITCH.y, TOP + 0.0024]} rotation-z={SWITCH.angle}>
        <mesh material={mats.dark} position-z={0.0001}>
          <planeGeometry args={[0.004, 0.026]} />
        </mesh>
        <group ref={leverRef}>
          <mesh material={mats.steel} position-z={0.005}>
            <boxGeometry args={[0.0016, 0.002, 0.01]} />
          </mesh>
          <mesh material={mats.cover} position-z={0.0115} rotation-x={Math.PI / 2} castShadow onPointerDown={down('switch')} onPointerOver={cursor('pointer')} onPointerOut={cursor('')}>
            <capsuleGeometry args={[0.0034, 0.006, 6, 16]} />
          </mesh>
        </group>
      </group>
      {/* the output jack in its dished plate */}
      <group position={[JACK.x, JACK.y, TOP - 0.0002]} rotation-z={JACK.angle}>
        <mesh material={mats.chrome} scale={[0.0185, 1, 0.0098]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[1, 1, 0.0018, 48]} />
        </mesh>
        <mesh material={mats.chrome} position-z={0.0012} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.0062, 0.0062, 0.002, 24]} />
        </mesh>
        <mesh material={mats.dark} position-z={0.0023}>
          <circleGeometry args={[0.0034, 24]} />
        </mesh>
      </group>
      {/* the vibrato bridge, rocking on its pivot line */}
      <group ref={bridgeRef} position={[0, PIVOT_Y, TOP]}>
        <mesh material={mats.chrome} position={[0, -0.017, 0.0011]} castShadow receiveShadow>
          <boxGeometry args={[0.058, 0.034, 0.0022]} />
        </mesh>
        <mesh material={mats.chrome} position={[0, -0.0335, 0.004]} castShadow>
          <boxGeometry args={[0.058, 0.0016, 0.008]} />
        </mesh>
        {STRINGS.map((_, i) => {
          const x = STRING_SADDLE_X(i)
          const h = Z_SADDLE - TOP - 0.0022 - radiusOf(i)
          const front = SADDLE_Y - PIVOT_Y + 0.0015 + intonation[i]
          return (
            <group key={i}>
              <RoundedBox args={[0.0096, 0.02, h]} radius={0.0014} smoothness={3} material={mats.steel} position={[x, front - 0.01, 0.0022 + h / 2]} castShadow receiveShadow />
              {[-1, 1].map((sd) => (
                <mesh key={sd} material={mats.dark} position={[x + sd * 0.0028, front - 0.012, 0.0022 + h + 0.0002]}>
                  <circleGeometry args={[0.0009, 6]} />
                </mesh>
              ))}
              <mesh material={mats.steel} position={[x, (front - 0.02 - 0.0335) / 2, 0.0045]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.0011, 0.0011, Math.abs(front - 0.02 + 0.0335), 8]} />
              </mesh>
              {/* the string, from the saddle back down through the plate */}
              <mesh geometry={tails[i]} material={STRINGS[i].wound ? mats.wound : mats.plain} />
            </group>
          )
        })}
        {Array.from({ length: 6 }, (_, k) => (
          <mesh key={k} geometry={geo.screw} material={mats.chrome} position={[(k - 2.5) * 0.0105, -0.0025, 0.0022]} />
        ))}
        {/* the arm, screwed into the block, white tip */}
        <mesh geometry={arm.geo} material={mats.chrome} castShadow onPointerDown={down('arm')} onPointerOver={cursor('grab')} onPointerOut={cursor('')} />
        <mesh material={mats.cover} position={arm.tip} quaternion={tipQuat} castShadow onPointerDown={down('arm')} onPointerOver={cursor('grab')} onPointerOut={cursor('')}>
          <capsuleGeometry args={[0.0042, 0.018, 6, 16]} />
        </mesh>
      </group>
      {/* neck, fretboard, frets, dots, nut */}
      <mesh geometry={geo.neck} material={mats.maple} castShadow receiveShadow />
      <mesh geometry={geo.board} material={mats.rose} castShadow receiveShadow onPointerDown={onFretDown} />
      {frets.map((g, n) => (
        <mesh key={n} geometry={g} material={mats.fret} castShadow />
      ))}
      {dots.map(([x, y], i) => (
        <mesh key={i} geometry={geo.dot} material={mats.pearl} position={[x, y, fbZ(x) + 0.00005]} />
      ))}
      <mesh material={mats.nut} position={[0, NUT_Y + 0.0025, FB - 0.002]} castShadow>
        <boxGeometry args={[neckWidth(NUT_Y), 0.005, 0.0076]} />
      </mesh>
      {/* headstock, wordmark, tuners and string tree */}
      <mesh geometry={geo.head} material={mats.headMaple} castShadow receiveShadow />
      <mesh material={mats.decal} position={[0.004, NUT_Y + 0.135, HS_TOP + 0.0002]} rotation-z={Math.PI / 2 + 0.06}>
        <planeGeometry args={[0.064, 0.016]} />
      </mesh>
      {POSTS.map((p, i) => (
        <group key={i}>
          <group position={[p.x, p.y, HS_TOP]} ref={(m) => (postRefs.current[i] = m)}>
            <mesh geometry={geo.post} material={mats.chrome} castShadow />
            <mesh material={mats.dark} position-z={0.0116}>
              <planeGeometry args={[0.006, 0.0007]} />
            </mesh>
          </group>
          {/* sealed tuner on the back, its key out to the side */}
          <RoundedBox args={[0.0125, 0.013, 0.009]} radius={0.002} smoothness={3} material={mats.chrome} position={[p.x - 0.002, p.y, HS_TOP - HS_T - 0.0045]} castShadow />
          <mesh material={mats.chrome} position={[(p.x - 0.008 + KEY_X) / 2, p.y, HS_TOP - HS_T - 0.0045]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.0013, 0.0013, Math.abs(p.x - 0.008 - KEY_X), 10]} />
          </mesh>
          <group position={[KEY_X, p.y, HS_TOP - HS_T - 0.0045]} ref={(m) => (keyRefs.current[i] = m)}>
            <mesh material={mats.chrome} scale={[0.0035, 0.0078, 0.0068]} castShadow onPointerDown={down('key', { i, key0: s.current.key[i] })} onPointerOver={cursor('grab')} onPointerOut={cursor('')}>
              <sphereGeometry args={[1, 24, 16]} />
            </mesh>
          </group>
        </group>
      ))}
      <mesh material={mats.chrome} position={[-0.003, NUT_Y + 0.068, HS_TOP + 0.002]} rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[0.0018, 0.008, 4, 12]} />
      </mesh>
      {/* strings */}
      {stringGeos.map((g, i) => (
        <mesh key={i} geometry={g} material={STRINGS[i].wound ? mats.wound : mats.plain} />
      ))}
      {headStrings.map((g, i) => (
        <mesh key={i} geometry={g} material={STRINGS[i].wound ? mats.wound : mats.plain} />
      ))}
      {/* fingertips on fretted strings */}
      {STRINGS.map((_, i) => (
        <mesh key={i} ref={(m) => (fingerRefs.current[i] = m)} material={mats.finger} visible={false}>
          <sphereGeometry args={[0.0032, 16, 12]} />
        </mesh>
      ))}
      {/* strap buttons */}
      <mesh geometry={geo.strap} material={mats.chrome} position={[0.01, 0.0045, 0]} rotation-z={Math.PI} castShadow />
      <mesh geometry={geo.strap} material={mats.chrome} position={[-0.098, 0.4685, 0]} castShadow />
      {/* the back: the neck plate and the vibrato's spring cover */}
      <group position={[0, HEEL_Y + 0.034, -TOP]} rotation-y={Math.PI}>
        <mesh geometry={geo.neckPlate} material={mats.chrome} castShadow />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => (
          <mesh key={i} geometry={geo.screw} material={mats.chrome} position={[a * 0.018, b * 0.025, 0.0018]} />
        ))}
      </group>
      <group position={[0, SADDLE_Y + 0.035, -TOP]} rotation-y={Math.PI}>
        <mesh geometry={geo.backCover} material={mats.guard} castShadow />
        {STRINGS.map((_, i) => (
          <mesh key={i} material={mats.dark} position={[(i - 2.5) * 0.0105, -0.035, 0.0024]}>
            <circleGeometry args={[0.0028, 16]} />
          </mesh>
        ))}
      </group>
      {/* hit areas: strum over the body, fret over the board */}
      <mesh material={mats.hit} position={[0, (SADDLE_Y + FB_END) / 2, Z_SADDLE + 0.003]} onPointerDown={onStrumDown} onPointerOver={cursor('pointer')} onPointerOut={cursor('')}>
        <planeGeometry args={[0.1, FB_END - SADDLE_Y]} />
      </mesh>
      <mesh material={mats.hit} position={[0, (FB_END + NUT_Y) / 2, FB + 0.006]} onPointerDown={onFretDown} onPointerOver={cursor('pointer')} onPointerOut={cursor('')}>
        <planeGeometry args={[0.065, NUT_Y - FB_END]} />
      </mesh>
    </group>
  )
})

export const GUITAR = { height: NUT_Y + 0.2, bottom: 0.004 }
export default Electric
