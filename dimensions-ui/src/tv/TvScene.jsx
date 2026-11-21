import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Tv, { tvView } from './Tv.jsx'

const BG = '#e9e5dd'

function Studio() {
  return (
    <Environment resolution={512}>
      <color attach="background" args={['#a8a49c']} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 120, 20]} rotation-x={Math.PI / 2} scale={[260, 120, 1]} />
      <Lightformer form="rect" intensity={2} color="#fff2e0" position={[-150, 60, 40]} rotation-y={Math.PI / 2.3} scale={[160, 60, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#eaf1ff" position={[150, 60, 60]} rotation-y={-Math.PI / 2.3} scale={[160, 60, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 50, 200]} scale={[240, 80, 1]} />
    </Environment>
  )
}

// Frames the scene: either the whole room at a fixed real-world scale (so a
// bigger TV really looks bigger), or tight on the TV as it changes size.
function Rig({ fit }) {
  const { camera, size, controls } = useThree()
  const dist = useRef(0)
  const ty = useRef(40)
  const aspectRef = useRef(1)
  aspectRef.current = size.width / size.height
  const tan = Math.tan(THREE.MathUtils.degToRad(15))

  const wanted = () => {
    const a = aspectRef.current
    // on a narrow screen the whole room would be tiny, so it always frames the TV
    if (fit || a < 1.1) {
      const w = tvView.w * 1.32 + 8
      const h = tvView.h + 34
      return { d: Math.max(h / 2 / tan, w / 2 / (tan * a)) * 1.05, y: tvView.cy + 1 }
    }
    return { d: Math.max(100 / 2 / tan, 216 / 2 / (tan * a)), y: 42 }
  }

  useEffect(() => {
    const w = wanted()
    dist.current = w.d
    ty.current = w.y
    camera.position.set(Math.sin(0.28) * w.d, w.y + 6, Math.cos(0.28) * w.d)
    camera.lookAt(0, w.y, 0)
    if (controls) controls.target.set(0, w.y, 0)
  }, [camera, size.width, size.height, controls])

  useFrame((_, delta) => {
    if (!controls) return
    const e = 1 - Math.exp(-Math.min(delta, 0.05) * 2.6)
    const w = wanted()
    // dolly along the current viewing direction, so the user's orbit is kept
    const next = dist.current + (w.d - dist.current) * e
    const ratio = next / dist.current
    dist.current = next
    const dy = (w.y - ty.current) * e
    ty.current += dy
    const t = controls.target
    camera.position.sub(t).multiplyScalar(ratio).add(t)
    t.y += dy
    camera.position.y += dy
  })
  return null
}

// Big diagonal readout, in a corner of the stage.
function Readout({ show }) {
  const a = useRef()
  const b = useRef()
  useEffect(() => {
    if (!show) return
    let raf
    const tick = () => {
      const d = tvView.size
      if (a.current) a.current.textContent = `${Math.round(d)}″`
      if (b.current) b.current.textContent = `${tvView.w.toFixed(1)} × ${tvView.h.toFixed(1)} in  ·  ${(tvView.w * 2.54).toFixed(0)} × ${(tvView.h * 2.54).toFixed(0)} cm`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [show])
  if (!show) return null
  return (
    <div style={{ position: 'absolute', left: 16, top: 14, pointerEvents: 'none', userSelect: 'none' }}>
      <div ref={a} style={{ font: '400 56px/1 "Instrument Serif", Georgia, serif', color: '#15171a' }}>
        55″
      </div>
      <div style={{ font: '500 11px/1.5 ui-monospace, Menlo, monospace', letterSpacing: '0.08em', color: '#5a6068', textTransform: 'uppercase' }}>diagonal</div>
      <div ref={b} style={{ font: '500 11px/1.5 ui-monospace, Menlo, monospace', letterSpacing: '0.04em', color: '#5a6068' }} />
    </div>
  )
}

export default function TvScene({ autoRotate = false, fitCamera = false, ...props }) {
  // a lone floating TV is framed tight; the room view is for when a table or person is shown
  const room = props.table || props.reference || props.mount === 'wall'
  const floor = room || props.mount === 'feet' || props.mount === 'pedestal'
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [60, 50, 200], fov: 30, near: 1, far: 1200 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#cfc9bc', 0.55]} />
        <directionalLight
          position={[-60, 120, 90]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.4}
          shadow-camera-left={-130}
          shadow-camera-right={130}
          shadow-camera-top={110}
          shadow-camera-bottom={-20}
          shadow-camera-near={10}
          shadow-camera-far={400}
        />
        <Studio />
        <Tv {...props} />
        <Rig fit={fitCamera || !room} />
        <OrbitControls
          makeDefault
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          minDistance={40}
          maxDistance={420}
          minPolarAngle={0.3}
          maxPolarAngle={floor ? 1.62 : Math.PI - 0.3}
          minAzimuthAngle={props.mount === 'wall' ? -1.25 : -Infinity}
          maxAzimuthAngle={props.mount === 'wall' ? 1.25 : Infinity}
        />
      </Canvas>
      <Readout show={!!props.measure} />
    </div>
  )
}
