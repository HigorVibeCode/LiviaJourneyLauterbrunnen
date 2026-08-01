import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useProgressStore } from '../store/progressStore'
import { ITEMS } from '../store/progressStore'
import { resolveNpcPosition } from '../config/npcs'
import { NPC_DIALOGUES } from '../config/story'
import { guideInput } from '../lib/guideInput'
import { playerPosition } from '../store/playerStore'

/**
 * NPC alpino — diálogo curto + entrega de item ao pressionar E perto.
 */
export default function NPC({ def }) {
  const pos = resolveNpcPosition(def)
  const hasItem = useProgressStore((s) => s.inventory.includes(def.itemId) || s.collectedEver.includes(def.itemId))
  const collectItem = useProgressStore((s) => s.collectItem)
  const setNearNpc = useProgressStore((s) => s.setNearNpc)
  const markNpcSpoke = useProgressStore((s) => s.markNpcSpoke)
  const npcSpoke = useProgressStore((s) => s.npcSpoke[def.id])
  const [near, setNear] = useState(false)
  const groupRef = useRef(null)
  const bodyRef = useRef(null)
  const leftArmRef = useRef(null)
  const rightArmRef = useRef(null)
  const leftLegRef = useRef(null)
  const rightLegRef = useRef(null)
  const bobRef = useRef(0)

  const dialogue = NPC_DIALOGUES[def.id]

  useFrame((state, dt) => {
    if (hasItem || !groupRef.current) return
    const dx = playerPosition.x - pos.x
    const dz = playerPosition.z - pos.z
    const dist = Math.hypot(dx, dz)
    const isNear = dist < 3.2
    setNear(isNear)
    if (isNear) setNearNpc(def.id)
    else if (useProgressStore.getState().nearNpcId === def.id) setNearNpc(null)

    bobRef.current += dt
    const bob = Math.sin(bobRef.current * 2) * 0.06
    groupRef.current.position.y = pos.y + bob

    if (isNear && dist > 0.05) {
      groupRef.current.rotation.y = Math.atan2(dx, dz)
    }

    const sway = Math.sin(bobRef.current * 1.6) * 0.12
    const armSway = Math.sin(bobRef.current * 1.6 + 0.5) * 0.18
    if (bodyRef.current) bodyRef.current.rotation.z = sway * 0.15
    if (leftArmRef.current) leftArmRef.current.rotation.x = armSway
    if (rightArmRef.current) rightArmRef.current.rotation.x = -armSway * 0.7 + 0.35
    if (leftLegRef.current) leftLegRef.current.rotation.x = -armSway * 0.25
    if (rightLegRef.current) rightLegRef.current.rotation.x = armSway * 0.25

    if (isNear && guideInput.tapPending) {
      guideInput.tapPending = false
      guideInput.tapStale = true
      if (!npcSpoke) {
        markNpcSpoke(def.id)
      } else {
        collectItem(def.itemId)
        setNearNpc(null)
      }
    }
  })

  if (hasItem) return null

  return (
    <group ref={groupRef} position={[pos.x, pos.y, pos.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.35, 0.9, 0.35]} position={[0, 0.9, 0]} />
      </RigidBody>

      <group ref={bodyRef}>
        <mesh ref={leftLegRef} position={[-0.14, 0.28, 0]}>
          <capsuleGeometry args={[0.1, 0.32, 4, 6]} />
          <meshStandardMaterial color="#3a4550" flatShading />
        </mesh>
        <mesh ref={rightLegRef} position={[0.14, 0.28, 0]}>
          <capsuleGeometry args={[0.1, 0.32, 4, 6]} />
          <meshStandardMaterial color="#3a4550" flatShading />
        </mesh>

        <mesh position={[0, 0.72, 0]}>
          <capsuleGeometry args={[0.26, 0.42, 4, 8]} />
          <meshStandardMaterial color={def.color} flatShading />
        </mesh>

        <mesh ref={leftArmRef} position={[-0.34, 0.78, 0]} rotation={[0, 0, 0.25]}>
          <capsuleGeometry args={[0.08, 0.28, 4, 6]} />
          <meshStandardMaterial color={def.color} flatShading />
        </mesh>
        <group ref={rightArmRef} position={[0.34, 0.78, 0]} rotation={[0.35, 0, -0.25]}>
          <mesh>
            <capsuleGeometry args={[0.08, 0.28, 4, 6]} />
            <meshStandardMaterial color={def.color} flatShading />
          </mesh>
          <mesh position={[0.08, -0.22, 0.12]} rotation={[0.3, 0, -0.4]}>
            <boxGeometry args={[0.22, 0.22, 0.22]} />
            <meshStandardMaterial
              color="#e8c040"
              emissive="#c89820"
              emissiveIntensity={0.5}
              flatShading
            />
          </mesh>
        </group>

        <mesh position={[0, 1.18, 0]}>
          <sphereGeometry args={[0.22, 8, 7]} />
          <meshStandardMaterial color="#e8b896" flatShading />
        </mesh>
        <mesh position={[-0.08, 1.2, 0.18]}>
          <sphereGeometry args={[0.035, 5, 4]} />
          <meshStandardMaterial color="#2a2438" flatShading />
        </mesh>
        <mesh position={[0.08, 1.2, 0.18]}>
          <sphereGeometry args={[0.035, 5, 4]} />
          <meshStandardMaterial color="#2a2438" flatShading />
        </mesh>

        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.26, 0.28, 0.12, 8]} />
          <meshStandardMaterial color={def.hat} flatShading />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.18, 8]} />
          <meshStandardMaterial color={def.hat} flatShading />
        </mesh>
      </group>

      {near && dialogue && (
        <group position={[0, 2.35, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[2.4, 0.55, 0.05]} />
            <meshStandardMaterial color="#1a2438" transparent opacity={0.88} flatShading />
          </mesh>
        </group>
      )}

      {near && (
        <mesh position={[0, 2.1, 0]}>
          <coneGeometry args={[0.18, 0.42, 5]} />
          <meshStandardMaterial color="#f0d060" emissive="#d4a830" emissiveIntensity={1} flatShading />
        </mesh>
      )}
    </group>
  )
}

export function npcInteractHint(npc) {
  const dlg = NPC_DIALOGUES[npc.id]
  return dlg
    ? `Fale com ${npc.name} (E) — ${ITEMS[npc.itemId]?.short ?? 'presente'}`
    : `Fale com ${npc.name} (E)`
}

export function npcDialogueLine(npc, spoke) {
  const dlg = NPC_DIALOGUES[npc.id]
  if (!dlg) return null
  return spoke ? dlg.give : dlg.greet
}
