import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { readInput, vehicle } from './controls.js'

// The drivable rig shared by the Pickup and the Low Poly Race Car:
// drag-to-orbit camera, double-tap bounce, a bicycle-model drive on the
// shared `vehicle` state, damped suspension, rolling/steering wheels and a
// chase camera. Each vehicle passes its own dimensions and tuning in `cfg`:
// { wheelbase, wheelR, maxSpeed, maxReverse, accel, reverseAccel, steerLock,
//   arena, camHeight, camDist(aspect) }.

const spring = (x, v, target, k, c, dt) => v + (-k * (x - target) - c * v) * dt

// refs: yawRef (group moved over the floor), bodyRef (sprung body),
// wheelSpins [FR, RR, FL, RL], frontSteer [R, L].
// onFrame(state, dt, ctl) runs every frame after the physics (lights etc).
export function useDriveRig({ cfg, drivable, autoRotate, bounce, lightsOn, yawRef, bodyRef, wheelSpins, frontSteer, onFrame }) {
  const { gl, camera, size } = useThree()
  const phys = useRef({
    camYaw: 0, // camera orbit angle around the vehicle
    camYawVel: 0,
    pitch: 0.18, // camera elevation
    pitchVel: 0,
    pitchTarget: 0.18,
    camTarget: new THREE.Vector3(vehicle.x, cfg.camHeight, vehicle.z),
    // suspension (body relative to wheels)
    sy: 0,
    syVel: 0,
    roll: 0,
    rollVel: 0,
    tilt: 0,
    tiltVel: 0,
    wheelAngle: 0,
    light: lightsOn ? 1 : 0,
    prevSpeed: 0,
    dragging: false,
    lastInput: 0,
    last: { x: 0, y: 0, t: 0 },
  })

  useEffect(() => {
    const el = gl.domElement
    const p = phys.current
    let lastTap = 0
    const down = (e) => {
      // Two taps/clicks in quick succession bounce the suspension
      // (works for touch, where dblclick is unreliable).
      const now = performance.now()
      if (now - lastTap < 300) dbl()
      lastTap = now
      p.dragging = true
      p.last = { x: e.clientX, y: e.clientY, t: performance.now() }
      p.camYawVel = 0
      el.style.cursor = 'grabbing'
    }
    const move = (e) => {
      if (!p.dragging) return
      const now = performance.now()
      const dt = Math.max((now - p.last.t) / 1000, 1 / 240)
      const dx = (e.clientX - p.last.x) * 0.006
      const dy = (e.clientY - p.last.y) * 0.004
      p.camYaw -= dx
      p.camYawVel = THREE.MathUtils.lerp(p.camYawVel, -dx / dt, 0.5)
      p.pitchTarget = THREE.MathUtils.clamp(p.pitchTarget + dy, 0.02, 0.85)
      p.last = { x: e.clientX, y: e.clientY, t: now }
      p.lastInput = now
    }
    const up = () => {
      p.dragging = false
      p.lastInput = performance.now()
      el.style.cursor = 'grab'
    }
    const dbl = () => {
      // Kick the suspension: the body drops then rebounds. The kick is sized
      // so the arches never come down onto the tyres (about 0.11 m of travel).
      p.syVel -= 1.2
      p.tiltVel += 0.08
      p.lastInput = performance.now()
    }
    el.style.cursor = 'grab'
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  // External "bounce" button: same kick as a double-tap.
  useEffect(() => {
    if (!bounce) return
    const p = phys.current
    p.syVel -= 1.2
    p.tiltVel += 0.1
    p.lastInput = performance.now()
  }, [bounce])

  useFrame((state, delta) => {
    const p = phys.current
    const v = vehicle
    const dt = Math.min(delta, 1 / 30)
    const ctl = drivable ? readInput() : { throttle: 0, steer: 0, brake: false }
    const { throttle, steer, brake } = ctl
    if (throttle || steer || brake) p.lastInput = performance.now()
    const idle = performance.now() - p.lastInput > 2500

    // ---- Driving physics (bicycle model) ----
    const speed = v.speed
    let accel = 0
    if (throttle > 0) {
      // Forward: strong pull that fades near top speed; brakes if rolling back.
      accel = speed < -0.3 ? 12 : cfg.accel * (1 - Math.max(speed, 0) / cfg.maxSpeed)
    } else if (throttle < 0) {
      // Back: brake first, then reverse gently.
      accel = speed > 0.3 ? -12 : -cfg.reverseAccel * (1 - Math.max(-speed, 0) / cfg.maxReverse)
    }
    // Rolling resistance + aerodynamic drag
    accel -= Math.sign(speed) * (0.35 + 0.012 * speed * speed)
    if (brake) accel -= Math.sign(speed) * 16
    let next = speed + accel * dt
    // Friction and brakes stop the vehicle; they never push it backwards.
    if (!throttle && Math.sign(next) !== Math.sign(speed)) next = 0
    v.speed = next

    // Steering: less lock at speed, eased like a real steering rack.
    const maxLock = cfg.steerLock / (1 + Math.abs(v.speed) * 0.07)
    v.steer += (steer * maxLock - v.steer) * (1 - Math.exp(-7 * dt))
    const yawRate = (v.speed / cfg.wheelbase) * Math.tan(v.steer)
    v.heading += yawRate * dt
    v.x += Math.cos(v.heading) * v.speed * dt
    v.z -= Math.sin(v.heading) * v.speed * dt
    // Keep the vehicle within the studio
    const r = Math.hypot(v.x, v.z)
    if (r > cfg.arena) {
      v.x *= cfg.arena / r
      v.z *= cfg.arena / r
      v.speed *= 0.5
    }

    // ---- Suspension ----
    // Body rolls away from the corner (lateral g) and pitches under
    // acceleration / braking (longitudinal g), each on a damped spring.
    const latG = v.speed * yawRate
    const longG = (v.speed - p.prevSpeed) / Math.max(dt, 1e-3)
    p.prevSpeed = v.speed
    const rollTarget = THREE.MathUtils.clamp(latG * 0.012, -0.08, 0.08)
    const pitchTarget = THREE.MathUtils.clamp(longG * 0.0045, -0.05, 0.05)
    p.rollVel = spring(p.roll, p.rollVel, rollTarget, 70, 7, dt)
    p.roll += p.rollVel * dt
    p.syVel = spring(p.sy, p.syVel, 0, 110, 5.5, dt)
    p.sy += p.syVel * dt
    p.tiltVel = spring(p.tilt, p.tiltVel, pitchTarget, 80, 8, dt)
    p.tilt += p.tiltVel * dt

    const g = yawRef.current
    g.position.set(v.x, 0, v.z)
    g.rotation.y = v.heading
    const b = bodyRef.current
    b.position.y = p.sy
    b.rotation.x = p.roll
    b.rotation.z = p.tilt

    // Wheels roll by distance travelled; front wheels steer.
    p.wheelAngle += (v.speed / cfg.wheelR) * dt
    wheelSpins.forEach((w, i) => {
      if (w.current) w.current.rotation.z = i < 2 ? -p.wheelAngle : p.wheelAngle
    })
    frontSteer.forEach((w) => w.current && (w.current.rotation.y = v.steer))

    // Lights fade on/off like real LEDs warming up.
    p.light += ((lightsOn ? 1 : 0) - p.light) * (1 - Math.exp(-6 * dt))
    const braking = brake || (throttle < 0 && v.speed > 0.3) || (throttle > 0 && v.speed < -0.3)
    onFrame?.(state, dt, { ...ctl, braking, light: p.light })

    // ---- Camera ----
    const driving = Math.abs(v.speed) > 0.8
    if (!p.dragging) {
      if (driving) {
        // Chase cam: swing round behind the vehicle (reversing: stay put).
        if (v.speed > 0) {
          const behind = v.heading - Math.PI / 2 + 0.3
          const diff = Math.atan2(Math.sin(behind - p.camYaw), Math.cos(behind - p.camYaw))
          p.camYaw += diff * (1 - Math.exp(-2 * dt))
        }
        p.camYawVel = 0
      } else {
        // Coasting orbit, easing into a slow turntable when idle.
        const cruise = idle && autoRotate ? 0.18 : 0
        p.camYawVel += (cruise - p.camYawVel) * (1 - Math.exp(-1.1 * dt))
        p.camYaw += p.camYawVel * dt
      }
    }
    p.pitchVel = spring(p.pitch, p.pitchVel, p.pitchTarget, 40, 11, dt)
    p.pitch += p.pitchVel * dt

    // Distance fits the vehicle to the screen width, pulls back a bit with speed.
    const aspect = size.width / size.height
    const dist = cfg.camDist(aspect) + Math.abs(v.speed) * 0.08
    p.camTarget.lerp(new THREE.Vector3(v.x, cfg.camHeight, v.z), 1 - Math.exp(-6 * dt))
    const t = p.camTarget
    const h = Math.cos(p.pitch) * dist
    camera.position.set(t.x + Math.sin(p.camYaw) * h, t.y + Math.sin(p.pitch) * dist, t.z + Math.cos(p.camYaw) * h)
    camera.lookAt(t)
    // Keep the fog behind the vehicle however far back the camera sits.
    if (state.scene.fog) {
      state.scene.fog.near = dist + 5
      state.scene.fog.far = dist + 24
    }
  })
}
