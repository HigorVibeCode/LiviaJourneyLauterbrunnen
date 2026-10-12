import { useRef } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useProgressStore } from '../store/progressStore'
import { LANTERN_POS, PHASES, pathXAt, groundHeightAt } from '../config/world'
import { playerPosition } from '../store/playerStore'
import { sfxPickup } from '../audio/sfx'
import { starGeometry } from './world/cuteShapes'


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
      {/* estrelinha dourada girando acima — dá para achar de longe */}
      <group ref={beaconRef} position={[0, 2.8, 0]}>
        <mesh geometry={starGeometry()} scale={0.75}>
          <ToonMat color="#ffd45a" emissive="#ffb830" emissiveIntensity={1.1} />
        </mesh>
      </group>

      {/* lampião fofo: base rosa, vidro aceso, chapeuzinho e alça */}
      <group ref={groupRef}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.24, 0.28, 0.14, 14]} />
          <ToonMat color="#ff8fb8" />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.19, 0.19, 0.42, 14]} />
          <ToonMat color="#fff0b0" emissive="#ffc040" emissiveIntensity={1.5} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.cos((i * Math.PI) / 2 + 0.78) * 0.2, 0.3, Math.sin((i * Math.PI) / 2 + 0.78) * 0.2]}>
            <capsuleGeometry args={[0.03, 0.36, 3, 6]} />
            <ToonMat color="#ff8fb8" />
          </mesh>
        ))}
        <mesh position={[0, 0.58, 0]}>
          <coneGeometry args={[0.3, 0.22, 14]} />
          <ToonMat color="#ff8fb8" />
        </mesh>
        <mesh position={[0, 0.73, 0]}>
          <torusGeometry args={[0.12, 0.035, 6, 14]} />
          <ToonMat color="#ffd45a" />
        </mesh>
      </group>
      <mesh position={[0, 2.2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.22, 0.4, 12]} />
        <ToonMat color="#ffd45a" emissive="#ffb830" emissiveIntensity={0.9} />
      </mesh>
      <pooledLight position={[0, 1.2, 0]} color="#ffd898" intensity={4.5} distance={14} decay={1.6} />
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
    <pooledLight
      ref={lightRef}
      position={[0, 1.1, 0.3]}
      color="#ffd898"
      intensity={0}
      distance={78}
      decay={1.15}
    />
  )
}
