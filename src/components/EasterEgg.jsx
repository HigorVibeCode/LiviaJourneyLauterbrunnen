import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useProgressStore } from '../store/progressStore'
import { resolveEggPosition } from '../config/easterEggs'
import SecretModel from './secrets/SecretModels'
import {
  sfxEggBell,
  sfxEggHay,
  sfxEggFirefly,
  sfxEggSplash,
  sfxEggPop,
  sfxEggChime,
  sfxEggFanfare,
} from '../audio/sfx'

const SFX = {
  ding: sfxEggBell,
  hay: sfxEggHay,
  melody: sfxEggFirefly,
  splash: sfxEggSplash,
  pop: sfxEggPop,
  chime: sfxEggChime,
  fanfare: sfxEggFanfare,
}

/**
 * Segredo escondido — mini-cena temática (não esfera dourada).
 */
export default function EasterEgg({ egg }) {
  const found = useProgressStore((s) => s.foundEggs.includes(egg.id))
  const findEgg = useProgressStore((s) => s.findEgg)
  const groupRef = useRef(null)
  const [burst, setBurst] = useState(false)
  const [hidden, setHidden] = useState(found)
  const position = resolveEggPosition(egg)
  const glow = egg.icon === 'firefly'

  useFrame((state) => {
    if (hidden || burst) return
    const t = state.clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.8 + position[0]) * 0.04
      if (egg.icon === 'bell') {
        groupRef.current.rotation.z = Math.sin(t * 2.2) * 0.08
      } else if (egg.icon === 'splash') {
        groupRef.current.position.y = Math.abs(Math.sin(t * 3.5)) * 0.06
      }
    }
  })

  if (hidden) return null

  const onFound = () => {
    if (burst) return
    setBurst(true)
    findEgg(egg.id)
    SFX[egg.sfx]?.()
    setTimeout(() => setHidden(true), 400)
  }

  return (
    <group position={[position[0], position[1], position[2]]}>
      {!burst && (
        <RigidBody type="fixed" colliders={false} sensor>
          <CuboidCollider args={[1.1, 1.2, 1.1]} position={[0, 0.6, 0]} sensor onIntersectionEnter={onFound} />
        </RigidBody>
      )}

      {/* halo fraco no chão — pista sutil, não marcador dourado no céu */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.5, 0.85, 14]} />
        <meshBasicMaterial
          color={glow ? '#90ff60' : '#c8a848'}
          transparent
          opacity={glow ? 0.22 : 0.14}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <group ref={groupRef}>
        <SecretModel kind={egg.icon} />
      </group>

      {burst && <BurstParticles color={glow ? '#c0ff90' : '#ffe8a0'} />}
    </group>
  )
}

function BurstParticles({ color }) {
  const ref = useRef(null)
  const parts = useRef(
    Array.from({ length: 10 }, (_, i) => ({
      a: (i / 10) * Math.PI * 2,
      s: 0.08 + (i % 3) * 0.04,
    })),
  )

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime % 1
    ref.current.children.forEach((m, i) => {
      const p = parts.current[i]
      m.position.set(Math.cos(p.a) * t * 2, t * 2.5 - t * t * 2, Math.sin(p.a) * t * 2)
      m.scale.setScalar(p.s * (1 - t))
      m.material.opacity = 1 - t
    })
  })

  return (
    <group ref={ref}>
      {parts.current.map((_, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={color} transparent opacity={1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
