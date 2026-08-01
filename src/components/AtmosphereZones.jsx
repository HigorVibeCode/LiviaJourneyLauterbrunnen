import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PHASES, pathXAt, groundHeightAt, makeRng } from '../config/world'
import { playerPosition } from '../store/playerStore'

/**
 * Efeitos de atmosfera dos biomas novos:
 *  — Vale Noturno: vaga-lumes + névoa baixa
 *  — Prado Florido: pétalas / poeira dourada
 */
export default function AtmosphereZones() {
  return (
    <group>
      <Fireflies />
      <PetalDust />
      <NightGroundMist />
    </group>
  )
}

function Fireflies() {
  const ref = useRef(null)
  const count = 90
  const { positions, seeds } = useMemo(() => {
    const rng = makeRng(9091)
    const positions = []
    const seeds = []
    const z0 = PHASES.night.zFrom + 8
    const z1 = PHASES.night.zTo - 8
    for (let i = 0; i < count; i++) {
      const z = z0 + rng() * (z1 - z0)
      const x = pathXAt(z) + (rng() - 0.5) * 28
      const y = groundHeightAt(x, z) + 0.8 + rng() * 3.5
      positions.push(x, y, z)
      seeds.push(rng() * Math.PI * 2, 0.6 + rng() * 1.4, rng())
    }
    return { positions: new Float32Array(positions), seeds }
  }, [])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    const arr = mesh.geometry.attributes.position.array
    for (let i = 0; i < count; i++) {
      const base = i * 3
      const s0 = seeds[i * 3]
      const s1 = seeds[i * 3 + 1]
      arr[base + 1] += Math.sin(t * s1 + s0) * 0.004
      arr[base] += Math.cos(t * s1 * 0.7 + s0) * 0.003
    }
    mesh.geometry.attributes.position.needsUpdate = true

    const z = playerPosition.z
    const inNight = z >= PHASES.night.zFrom - 10 && z <= PHASES.night.zTo + 10
    mesh.visible = inNight
    if (mesh.material) {
      mesh.material.opacity = inNight ? 0.85 : 0
    }
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#d4f06a"
        size={0.35}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function PetalDust() {
  const ref = useRef(null)
  const count = 140
  const { positions, seeds } = useMemo(() => {
    const rng = makeRng(6060)
    const positions = []
    const seeds = []
    const z0 = PHASES.flower.zFrom + 6
    const z1 = PHASES.flower.zTo - 6
    for (let i = 0; i < count; i++) {
      const z = z0 + rng() * (z1 - z0)
      const x = pathXAt(z) + (rng() - 0.5) * 32
      const y = groundHeightAt(x, z) + 0.4 + rng() * 4
      positions.push(x, y, z)
      seeds.push(rng() * 6, 0.4 + rng() * 0.9, rng())
    }
    return { positions: new Float32Array(positions), seeds }
  }, [])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    const arr = mesh.geometry.attributes.position.array
    for (let i = 0; i < count; i++) {
      const base = i * 3
      const speed = seeds[i * 3 + 1]
      arr[base + 1] -= speed * 0.012
      arr[base] += Math.sin(t * 0.8 + seeds[i * 3]) * 0.008
      const z = arr[base + 2]
      const floor = groundHeightAt(arr[base], z) + 0.3
      if (arr[base + 1] < floor) {
        arr[base + 1] = floor + 3.5 + seeds[i * 3 + 2] * 2
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true

    const pz = playerPosition.z
    const inFlower = pz >= PHASES.flower.zFrom - 8 && pz <= PHASES.flower.zTo + 8
    mesh.visible = inFlower
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#f2b8d0"
        size={0.28}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  )
}

function NightGroundMist() {
  const group = useRef(null)
  const mats = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const z = PHASES.night.zTo - 18 - i * 18
        const x = pathXAt(z)
        return { x, z, s: 14 + (i % 3) * 4 }
      }),
    [],
  )

  useFrame(() => {
    if (!group.current) return
    const z = playerPosition.z
    group.current.visible = z >= PHASES.night.zFrom - 12 && z <= PHASES.night.zTo + 12
  })

  return (
    <group ref={group} visible={false}>
      {mats.map((m, i) => (
        <mesh key={i} position={[m.x, 0.35, m.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[m.s, 12]} />
          <meshBasicMaterial color="#1a2030" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
