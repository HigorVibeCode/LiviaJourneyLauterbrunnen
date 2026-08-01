import { useRef } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useProgressStore } from '../store/progressStore'
import { PHASES, pathXAt, groundHeightAt } from '../config/world'
import { playerPosition } from '../store/playerStore'
import { sfxPickup } from '../audio/sfx'

const LANTERN_POS = { lat: -10, z: PHASES.night.zTo - 12 }

/**
 * Lampião coletável no início do Vale Noturno.
 */
export default function LanternPickup() {
  const has = useProgressStore((s) => s.hasLantern)
  const collectLantern = useProgressStore((s) => s.collectLantern)
  const groupRef = useRef(null)
  const beaconRef = useRef(null)
  const x = pathXAt(LANTERN_POS.z) + LANTERN_POS.lat
  const y = groundHeightAt(x, LANTERN_POS.z)
  const collected = has

  useFrame((state) => {
    if (collected) return
    const t = state.clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 1.5
      groupRef.current.position.y = y + 1.1 + Math.sin(t * 2.5) * 0.1
    }
    if (beaconRef.current) {
      beaconRef.current.position.y = y + 2.8 + Math.sin(t * 2.2) * 0.14
      beaconRef.current.rotation.y = -t * 0.9
    }
  })

  if (collected) return null

  return (
    <group position={[x, y, LANTERN_POS.z]}>
      <group ref={beaconRef} position={[0, 2.8, 0]}>
        <mesh>
          <coneGeometry args={[0.28, 0.62, 5]} />
          <ToonMat color="#f0d060" emissive="#d4a830" emissiveIntensity={1.35}/>
        </mesh>
      </group>

      <group ref={groupRef}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.14, 0.5, 6]} />
          <ToonMat color="#5a4030"/>
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[0.22, 0.28, 0.22]} />
          <ToonMat
            color="#ffd080"
            emissive="#ffb040"
            emissiveIntensity={1.6}/>
        </mesh>
      </group>
      <mesh position={[0, 2.2, 0]}>
        <coneGeometry args={[0.2, 0.45, 5]} />
        <ToonMat color="#e8c040" emissive="#c89820" emissiveIntensity={1.1}/>
      </mesh>
      <pointLight position={[0, 1.2, 0]} color="#ffd898" intensity={4.5} distance={14} decay={1.6} />
      <RigidBody type="fixed" colliders={false} sensor>
        <CuboidCollider
          args={[0.8, 1.2, 0.8]}
          position={[0, 1, 0]}
          sensor
          onIntersectionEnter={() => {
            sfxPickup()
            collectLantern()
          }}
        />
      </RigidBody>
    </group>
  )
}

/** Luz suave na Livia quando tem lampião e está no vale noturno. */
export function LiviaLanternLight() {
  const lightRef = useRef(null)
  const has = useProgressStore((s) => s.hasLantern)

  useFrame(() => {
    if (!lightRef.current) return
    const z = playerPosition.z
    const inNight = z <= PHASES.night.zTo + 6 && z >= PHASES.night.zFrom - 6
    const on = has && inNight
    lightRef.current.intensity += ((on ? 12.0 : 0) - lightRef.current.intensity) * 0.12
  })

  return (
    <pointLight
      ref={lightRef}
      position={[0, 1.1, 0.3]}
      color="#ffd898"
      intensity={0}
      distance={78}
      decay={1.15}
    />
  )
}
