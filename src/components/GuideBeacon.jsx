import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getObjectiveTarget } from '../lib/objectiveTarget'
import { guideHand } from '../lib/guideInput'

const Y_UP = new THREE.Vector3(0, 1, 0)
const MAX_BEAM_LEN = 3.8
/** Perto (<20 m): fraco; longe: brilho cheio */
const FAINT_BELOW = 20
const tmpStart = new THREE.Vector3()
const tmpEnd = new THREE.Vector3()
const tmpDir = new THREE.Vector3()
const tmpMid = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()

function approach(current, target, step) {
  if (current < target) return Math.min(target, current + step)
  return Math.max(target, current - step)
}

function strengthForDistance(dist) {
  if (dist >= FAINT_BELOW) return 1
  const t = dist / FAINT_BELOW
  return 0.16 + t * 0.14
}

/**
 * Guia luminosa — feixe dourado estilo SotC, mais brilhante e ornamentado.
 */
export default function GuideBeacon() {
  const rootRef = useRef(null)
  const coreRef = useRef(null)
  const softRef = useRef(null)
  const auraRef = useRef(null)
  const glowRef = useRef(null)
  const tipRef = useRef(null)
  const lightRef = useRef(null)
  const tipLightRef = useRef(null)
  const motesRef = useRef(null)
  const fadeRef = useRef(0)

  const moteOffsets = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        t: (i / 12) * 0.88 + 0.06,
        phase: i * 1.37,
        lateral: ((i % 4) - 1.5) * 0.055,
        speed: 0.05 + (i % 3) * 0.02,
      })),
    [],
  )

  useFrame((state, delta) => {
    const root = rootRef.current
    if (!root) return

    const handBone = guideHand.bone
    const want = Boolean(guideHand.active && handBone)
    const dt = Math.min(delta, 0.05)
    fadeRef.current = approach(fadeRef.current, want ? 1 : 0, dt * (want ? 3.4 : 5))

    const fade = fadeRef.current
    if (fade < 0.01) {
      root.visible = false
      if (lightRef.current) lightRef.current.intensity = 0
      if (tipLightRef.current) tipLightRef.current.intensity = 0
      return
    }

    const objective = getObjectiveTarget()
    if (!objective) {
      root.visible = false
      if (lightRef.current) lightRef.current.intensity = 0
      if (tipLightRef.current) tipLightRef.current.intensity = 0
      return
    }

    handBone.updateWorldMatrix(true, false)
    handBone.getWorldPosition(tmpStart)
    tmpStart.y += 0.06

    tmpEnd.set(objective.position[0], objective.position[1], objective.position[2])
    tmpDir.subVectors(tmpEnd, tmpStart)
    const dist = tmpDir.length()
    if (dist < 0.2) {
      root.visible = false
      if (lightRef.current) lightRef.current.intensity = 0
      if (tipLightRef.current) tipLightRef.current.intensity = 0
      return
    }
    tmpDir.multiplyScalar(1 / dist)

    const beamLen = MAX_BEAM_LEN
    const strength = strengthForDistance(dist)
    tmpMid.copy(tmpStart).addScaledVector(tmpDir, beamLen * 0.5)
    tmpQuat.setFromUnitVectors(Y_UP, tmpDir)

    root.visible = true
    root.position.copy(tmpMid)
    root.quaternion.copy(tmpQuat)

    const pulse = 0.88 + Math.sin(state.clock.elapsedTime * 2.2) * 0.12
    const shimmer = 0.92 + Math.sin(state.clock.elapsedTime * 5.5) * 0.08
    const opacity = fade * pulse * strength

    if (coreRef.current) {
      coreRef.current.scale.set(1, beamLen, 1)
      coreRef.current.material.opacity = 0.55 * opacity * shimmer
    }
    if (softRef.current) {
      softRef.current.scale.set(1, beamLen, 1)
      softRef.current.material.opacity = 0.22 * opacity
    }
    if (auraRef.current) {
      auraRef.current.scale.set(1, beamLen * 1.02, 1)
      auraRef.current.material.opacity = 0.1 * opacity
    }
    if (glowRef.current) {
      // brilho na mão (base do feixe)
      glowRef.current.position.set(0, -beamLen * 0.5 + 0.08, 0)
      glowRef.current.material.opacity = 0.85 * opacity
      const s = 0.42 + Math.sin(state.clock.elapsedTime * 3.6) * 0.08
      glowRef.current.scale.setScalar(s)
    }
    if (tipRef.current) {
      tipRef.current.position.set(0, beamLen * 0.5 - 0.05, 0)
      tipRef.current.material.opacity = 0.7 * opacity * shimmer
      tipRef.current.scale.setScalar(0.22 + Math.sin(state.clock.elapsedTime * 4.2) * 0.05)
    }
    if (lightRef.current) {
      lightRef.current.position.set(0, -beamLen * 0.5 + 0.1, 0)
      lightRef.current.intensity = 5.5 * opacity
    }
    if (tipLightRef.current) {
      tipLightRef.current.position.set(0, beamLen * 0.5 - 0.05, 0)
      tipLightRef.current.intensity = 3.2 * opacity
    }

    if (motesRef.current) {
      const children = motesRef.current.children
      const clock = state.clock.elapsedTime
      for (let i = 0; i < children.length; i++) {
        const m = moteOffsets[i]
        const along = ((m.t + clock * m.speed) % 1) * beamLen
        const swirl = Math.sin(clock * 2.4 + m.phase) * m.lateral * 1.4
        children[i].position.set(
          swirl,
          -beamLen * 0.5 + along,
          Math.cos(clock * 1.8 + m.phase) * m.lateral,
        )
        children[i].material.opacity =
          0.55 * opacity * (0.45 + 0.55 * Math.sin(clock * 3 + m.phase))
        children[i].scale.setScalar(0.045 + (i % 4) * 0.018)
      }
    }
  })

  return (
    <group ref={rootRef} visible={false}>
      <pointLight ref={lightRef} color="#ffe8a0" intensity={0} distance={7} decay={2} />
      <pointLight ref={tipLightRef} color="#fff6d0" intensity={0} distance={4} decay={2} />

      {/* aura larga */}
      <mesh ref={auraRef} renderOrder={0}>
        <cylinderGeometry args={[0.32, 0.7, 1, 12, 1, true]} />
        <meshBasicMaterial
          color="#ffcc66"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* halo médio */}
      <mesh ref={softRef} renderOrder={1}>
        <cylinderGeometry args={[0.1, 0.28, 1, 12, 1, true]} />
        <meshBasicMaterial
          color="#ffd98a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* núcleo brilhante */}
      <mesh ref={coreRef} renderOrder={2}>
        <cylinderGeometry args={[0.03, 0.07, 1, 10, 1, true]} />
        <meshBasicMaterial
          color="#fff8e8"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* orbe na mão */}
      <mesh ref={glowRef} renderOrder={3}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial
          color="#fff6d0"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ponta do feixe */}
      <mesh ref={tipRef} renderOrder={3}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color="#ffe08a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <group ref={motesRef}>
        {moteOffsets.map((_, i) => (
          <mesh key={i} renderOrder={2}>
            <sphereGeometry args={[1, 6, 5]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#fff6d8' : '#ffd080'}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}
