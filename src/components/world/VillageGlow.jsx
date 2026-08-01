import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { HOUSES, resolveOnPath, groundHeightAt, PHASES } from '../../config/world'
import { playerPosition } from '../../store/playerStore'

/**
 * Luzes quentes nas janelas do vilarejo (vale das águas) — legível à distância, estilo thumb.
 */
export default function VillageGlow() {
  const group = useRef(null)
  const windows = useMemo(() => {
    const zMin = PHASES.water.zFrom - 20
    const zMax = PHASES.water.zTo + 20
    return HOUSES.filter((h) => h.z >= zMin && h.z <= zMax).flatMap((h, hi) => {
      const { x, z } = resolveOnPath(h)
      const y = groundHeightAt(x, z) + 4.2 * (h.scale ?? 1)
      const s = h.scale ?? 1
      return [
        { x: x - 2.2 * s, y, z: z + 3.5 * s, s: 0.35 * s },
        { x: x + 2.2 * s, y, z: z + 3.5 * s, s: 0.35 * s },
        { x, y: y - 1.2 * s, z: z + 3.8 * s, s: 0.28 * s },
      ].map((w, wi) => ({ ...w, key: `${hi}-${wi}` }))
    })
  }, [])

  useFrame((state) => {
    if (!group.current) return
    const z = playerPosition.z
    const visible = z <= PHASES.water.zTo + 140 && z >= PHASES.water.zFrom - 180
    group.current.visible = visible
    if (!visible) return
    const pulse = 0.85 + Math.sin(state.clock.elapsedTime * 1.8) * 0.12
    group.current.children.forEach((m) => {
      if (m.material) m.material.emissiveIntensity = 0.72 * pulse
    })
  })

  return (
    <group ref={group}>
      {windows.map((w) => (
        <mesh key={w.key} position={[w.x, w.y, w.z]} scale={w.s}>
          <boxGeometry args={[1, 1, 0.12]} />
          <meshStandardMaterial
            color="#ffd898"
            emissive="#ffb040"
            emissiveIntensity={0.72}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}
