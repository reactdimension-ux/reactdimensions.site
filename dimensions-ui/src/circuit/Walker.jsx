import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { N, TRACK as T, WORLD, groundAt } from './track.js'

// A person (1.75 m) you walk round the venue with W A S D or the arrow keys
// (hold Shift to run). The camera orbits them: drag to look, scroll to zoom,
// and "forward" is always away from the camera.
export function walkerSpawn() {
  const p = {}
  T.sample(20, T.bL[20] + 6, p)
  return { x: p.x, z: p.z }
}

const skin = '#e0b48f'
const shirt = '#2f6fdb'
const trousers = '#2b3140'

function Limb({ refEl, x, y, len, w, color, ...rest }) {
  return (
    <group ref={refEl} position={[x, y, 0]} {...rest}>
      <mesh position={[0, -len / 2, 0]} castShadow>
        <capsuleGeometry args={[w, len - w * 2, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} flatShading />
      </mesh>
    </group>
  )
}

export default function Walker({ active }) {
  const controls = useThree((s) => s.controls)
  const camera = useThree((s) => s.camera)
  const root = useRef()
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const keys = useRef({})
  const s = useRef({ pos: new THREE.Vector3(), yaw: 0, phase: 0, speed: 0, prev: new THREE.Vector3() })
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const move = useMemo(() => new THREE.Vector3(), [])

  // put the person down beside the track and the camera behind them
  useEffect(() => {
    if (!active) return
    const sp = walkerSpawn()
    const st = s.current
    st.pos.set(sp.x, groundAt(sp.x, sp.z).y, sp.z)
    st.prev.copy(st.pos)
    camera.position.set(sp.x + 0, st.pos.y + 3.2, sp.z + 7)
    if (controls) {
      controls.target.set(sp.x, st.pos.y + 1.2, sp.z)
      controls.update()
    }
  }, [active, camera, controls])

  useEffect(() => {
    if (!active) return
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)
    const names = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' }
    const down = (e) => {
      const k = names[e.code]
      if (!k || typing(e)) return
      keys.current[k] = true
      if (k !== 'run') e.preventDefault()
    }
    const up = (e) => {
      const k = names[e.code]
      if (k) keys.current[k] = false
    }
    const blur = () => (keys.current = {})
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      keys.current = {}
    }
  }, [active])

  useFrame((_, delta) => {
    if (!active || !root.current) return
    const dt = Math.min(delta, 0.05)
    const st = s.current
    const k = keys.current
    // camera-relative directions on the ground
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    right.set(-fwd.z, 0, fwd.x)
    move.set(0, 0, 0)
    if (k.f) move.add(fwd)
    if (k.b) move.sub(fwd)
    if (k.r) move.add(right)
    if (k.l) move.sub(right)
    const moving = move.lengthSq() > 0
    const top = k.run ? 5.2 : 1.7
    st.speed += ((moving ? top : 0) - st.speed) * (1 - Math.exp(-dt * 10))
    if (moving) {
      move.normalize()
      const want = Math.atan2(move.x, move.z)
      let d = want - st.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      st.yaw += d * (1 - Math.exp(-dt * 12))
      st.pos.x += move.x * st.speed * dt
      st.pos.z += move.z * st.speed * dt
    } else if (st.speed > 0.01) {
      st.pos.x += Math.sin(st.yaw) * st.speed * dt
      st.pos.z += Math.cos(st.yaw) * st.speed * dt
    }
    const lx = WORLD.x * 0.45
    const lz = WORLD.z * 0.45
    st.pos.x = THREE.MathUtils.clamp(st.pos.x, -lx, lx)
    st.pos.z = THREE.MathUtils.clamp(st.pos.z, -lz, lz)
    const gy = groundAt(st.pos.x, st.pos.z).y
    st.pos.y += (gy - st.pos.y) * (1 - Math.exp(-dt * 20))

    st.phase += st.speed * dt * 2.6
    const swing = Math.min(st.speed / 1.7, 1.6) * 0.55
    const a = Math.sin(st.phase) * swing
    legL.current.rotation.x = a
    legR.current.rotation.x = -a
    armL.current.rotation.x = -a * 0.9
    armR.current.rotation.x = a * 0.9
    root.current.position.copy(st.pos)
    root.current.position.y += Math.abs(Math.cos(st.phase)) * 0.03 * Math.min(st.speed, 2)
    root.current.rotation.y = st.yaw

    // the camera follows: shift it by however far the person moved, keep the orbit target on them
    if (controls) {
      move.copy(st.pos).sub(st.prev)
      camera.position.add(move)
      controls.target.set(st.pos.x, st.pos.y + 1.2, st.pos.z)
      controls.update()
    }
    st.prev.copy(st.pos)
  })

  return (
    <group ref={root} visible={active}>
      <Limb refEl={legL} x={-0.1} y={0.92} len={0.92} w={0.075} color={trousers} />
      <Limb refEl={legR} x={0.1} y={0.92} len={0.92} w={0.075} color={trousers} />
      <mesh position={[0, 1.18, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.42, 4, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.8} flatShading />
      </mesh>
      <Limb refEl={armL} x={-0.25} y={1.42} len={0.62} w={0.05} color={shirt} />
      <Limb refEl={armR} x={0.25} y={1.42} len={0.62} w={0.05} color={shirt} />
      <mesh position={[0, 1.66, 0]} castShadow>
        <sphereGeometry args={[0.11, 14, 12]} />
        <meshStandardMaterial color={skin} roughness={0.8} flatShading />
      </mesh>
    </group>
  )
}
