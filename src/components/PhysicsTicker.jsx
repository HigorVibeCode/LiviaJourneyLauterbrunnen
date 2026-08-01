import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'

/**
 * Um step de física por frame, com dt limitado.
 * Evita o teleporte do timeStep="vary" (dt de hitch) e o catch-up
 * do timeStep fixo (vários substeps num frame só).
 */
const MAX_PHYSICS_DT = 1 / 30

export default function PhysicsTicker({ paused = false }) {
  const { step } = useRapier()

  useFrame((_, delta) => {
    if (paused) return
    step(Math.min(delta, MAX_PHYSICS_DT))
  }, 0)

  return null
}
