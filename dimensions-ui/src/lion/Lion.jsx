import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EYE, EYE_R, SPINE, boneList, buildPrims } from './anatomy.js'
import { sculpt } from './sculpt.js'
import { buildHair, strandTexture } from './hair.js'
import { furMaterial, furUniforms, hairMaterial, irisGeometry, irisTexture } from './materials.js'
import { LionRig } from './rig.js'

// Colour pickers fire on every drag step; the iris texture is redrawn only
// once the value settles.
function useSettled(value, ms = 160) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

// Sculpting takes about a second, so the body and hair are kept per mane
// setting and shared by every lion on the page.
const SCULPTED = {}
function sculpted(mane, names) {
  if (!SCULPTED[mane]) {
    const body = sculpt(buildPrims({ mane }), names)
    const hair = buildHair(body, { mane, headBone: names.indexOf('head') })
    SCULPTED[mane] = { body, hair }
  }
  return SCULPTED[mane]
}

// Builds a fresh skeleton around the shared body.
function buildLion(mane) {
  const list = boneList()
  const bones = {}
  const arr = list.map(({ name, j, tip }) => {
    const b = new THREE.Bone()
    b.name = name
    b.position.fromArray(j)
    b.userData.j = new THREE.Vector3(...j)
    b.userData.tip = new THREE.Vector3(...tip)
    bones[name] = b
    return b
  })
  const inverses = list.map(({ j }) => new THREE.Matrix4().makeTranslation(-j[0], -j[1], -j[2]))
  const { body, hair } = sculpted(mane, list.map((b) => b.name))
  return { bones, arr, inverses, body, hair }
}

export default function Lion({
  input,
  track,
  mane = true,
  coat = '#c08a4a',
  belly = '#ead7b4',
  maneColor = '#7a4a22',
  maneTip = '#2a1710',
  dark = '#1a110c',
  eye = '#c98a1e',
  furShells = 14,
  furLength = 1,
  walkSpeed = 1.2,
  runSpeed = 3.4,
  autoWalk = false,
}) {
  const U = useMemo(furUniforms, [])
  const built = useMemo(() => buildLion(mane), [mane])
  const alpha = useMemo(strandTexture, [])
  const eyeKey = useSettled(eye)
  const iris = useMemo(() => irisTexture(eyeKey), [eyeKey])
  const irisGeo = useMemo(() => irisGeometry(EYE_R), [])
  const lids = useRef([])

  const scene = useMemo(() => {
    const root = new THREE.Group()
    for (const b of built.arr) root.add(b)
    const skeleton = new THREE.Skeleton(built.arr, built.inverses)
    const ident = new THREE.Matrix4()
    const meshes = []
    const skinned = (geo, mat) => {
      const m = new THREE.SkinnedMesh(geo, mat)
      m.bind(skeleton, ident)
      m.frustumCulled = false
      root.add(m)
      meshes.push(m)
      return m
    }
    const skin = skinned(built.body.geometry, furMaterial(U, 0))
    skin.castShadow = true
    skin.receiveShadow = true
    const n = Math.round(furShells)
    for (let i = 1; i <= n; i++) skinned(built.body.geometry, furMaterial(U, i / n)).receiveShadow = true
    skinned(built.hair, hairMaterial(U, alpha)).receiveShadow = true
    return { root, skeleton, meshes }
  }, [built, furShells, U, alpha])

  useEffect(
    () => () => {
      for (const m of scene.meshes) m.material.dispose()
      scene.skeleton.dispose()
    },
    [scene],
  )
  useEffect(() => () => iris.dispose(), [iris])

  // Eyes ride on the head bone.
  const eyes = useMemo(() => {
    const head = built.bones.head
    const g = new THREE.Group()
    head.add(g)
    const sclera = new THREE.MeshPhysicalMaterial({ color: '#2a1a0e', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 })
    const irisMat = new THREE.MeshPhysicalMaterial({ map: iris, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 })
    const lidMat = new THREE.MeshStandardMaterial({ color: '#1a110c', roughness: 0.7 })
    const ball = new THREE.SphereGeometry(EYE_R, 28, 18)
    const lidGeo = new THREE.SphereGeometry(EYE_R * 1.1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    lids.current = []
    for (const s of [1, -1]) {
      const e = new THREE.Group()
      e.position.set(EYE[0] * s - SPINE.head[0], EYE[1] - SPINE.head[1], EYE[2] - SPINE.head[2])
      e.rotation.set(0.05, 0.42 * s, 0)
      e.add(new THREE.Mesh(ball, sclera))
      e.add(new THREE.Mesh(irisGeo, irisMat))
      const lid = new THREE.Mesh(lidGeo, lidMat)
      e.add(lid)
      lids.current.push(lid)
      g.add(e)
    }
    return { g, dispose: () => [sclera, irisMat, lidMat, ball, lidGeo].forEach((x) => x.dispose()) }
  }, [built, iris, irisGeo])
  useEffect(
    () => () => {
      eyes.g.removeFromParent()
      eyes.dispose()
    },
    [eyes],
  )

  // Carry position and heading over when the body is rebuilt.
  const carry = useRef({ pos: new THREE.Vector3(), yaw: 0 })
  const rig = useMemo(() => new LionRig(built.bones, carry.current), [built])

  useEffect(() => {
    U.uCoat.value.set(coat)
    U.uLight.value.set(belly)
    U.uMane.value.set(maneColor)
    U.uManeTip.value.set(maneTip)
    U.uDark.value.set(dark)
    U.uFurLen.value = 0.014 * furLength
  }, [U, coat, belly, maneColor, maneTip, dark, furLength])

  useFrame((state, delta) => {
    const k = input?.current ?? {}
    let forward = (k.f ? 1 : 0) - (k.b ? 1 : 0)
    let turn = (k.l ? 1 : 0) - (k.r ? 1 : 0)
    if (autoWalk && !forward && !turn) {
      forward = 1
      turn = 0.35 * Math.sin(state.clock.elapsedTime * 0.25)
    }
    rig.update(delta, { forward, turn, run: !!k.run }, { walkSpeed, runSpeed })
    scene.root.position.set(rig.pos.x, 0, rig.pos.z)
    scene.root.rotation.y = rig.yaw
    carry.current.pos.copy(rig.pos)
    carry.current.yaw = rig.yaw
    if (track) track.current.set(rig.pos.x, 0, rig.pos.z)
    U.uTime.value = state.clock.elapsedTime
    U.uMove.value = rig.A * (1 + rig.run)
    for (const lid of lids.current) lid.rotation.x = -0.55 + (Math.PI / 2 + 0.55) * rig.lid
  })

  return <primitive object={scene.root} />
}
