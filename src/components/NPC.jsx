import { useRef, useState } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useProgressStore } from '../store/progressStore'
import { ITEMS } from '../store/progressStore'
import { resolveNpcPosition } from '../config/npcs'
import { NPC_DIALOGUES } from '../config/story'
import { guideInput } from '../lib/guideInput'
import { playerPosition } from '../store/playerStore'

const HANDOFF_DUR = 0.65

/**
 * NPC alpino — diálogo curto + entrega de item ao pressionar E perto.
 * Permanece visível após entregar o item.
 */
export default function NPC({ def }) {
  const pos = resolveNpcPosition(def)
  const hasItem = useProgressStore(
    (s) => s.inventory.includes(def.itemId) || s.collectedEver.includes(def.itemId),
  )
  const collectItem = useProgressStore((s) => s.collectItem)
  const setNearNpc = useProgressStore((s) => s.setNearNpc)
  const markNpcSpoke = useProgressStore((s) => s.markNpcSpoke)
  const npcSpoke = useProgressStore((s) => s.npcSpoke[def.id])
  const [near, setNear] = useState(false)
  const [handoff, setHandoff] = useState(false)
  const groupRef = useRef(null)
  const bodyRef = useRef(null)
  const leftArmRef = useRef(null)
  const rightArmRef = useRef(null)
  const leftLegRef = useRef(null)
  const rightLegRef = useRef(null)
  const bobRef = useRef(0)
  const handoffT = useRef(0)

  const dialogue = NPC_DIALOGUES[def.id]
  const dialogueLine = near && dialogue
    ? npcDialogueLine(def, Boolean(npcSpoke[def.id]) || hasItem)
    : null

  useFrame((state, dt) => {
    if (!groupRef.current) return

    const dx = playerPosition.x - pos.x
    const dz = playerPosition.z - pos.z
    const dist = Math.hypot(dx, dz)
    const isNear = dist < 3.2
    setNear(isNear)

    if (isNear && !hasItem) setNearNpc(def.id)
    else if (useProgressStore.getState().nearNpcId === def.id) setNearNpc(null)

    bobRef.current += dt
    const bob = Math.sin(bobRef.current * 2) * 0.06
    groupRef.current.position.y = pos.y + bob

    if (isNear && dist > 0.05) {
      groupRef.current.rotation.y = Math.atan2(dx, dz)
    }

    const sway = Math.sin(bobRef.current * 1.6) * 0.12
    const armSway = Math.sin(bobRef.current * 1.6 + 0.5) * 0.18

    if (handoff) {
      handoffT.current += dt
      const t = Math.min(1, handoffT.current / HANDOFF_DUR)
      if (bodyRef.current) bodyRef.current.rotation.z = sway * 0.08
      if (leftArmRef.current) leftArmRef.current.rotation.x = armSway * 0.4
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.35 + t * 1.4
      if (t >= 1) {
        collectItem(def.itemId)
        setHandoff(false)
        handoffT.current = 0
        setNearNpc(null)
      }
      return
    }

    if (bodyRef.current) bodyRef.current.rotation.z = sway * 0.15
    if (leftArmRef.current) leftArmRef.current.rotation.x = armSway
    if (rightArmRef.current) rightArmRef.current.rotation.x = -armSway * 0.7 + (hasItem ? 0.15 : 0.35)
    if (leftLegRef.current) leftLegRef.current.rotation.x = -armSway * 0.25
    if (rightLegRef.current) rightLegRef.current.rotation.x = armSway * 0.25

    if (hasItem || !isNear) return

    if (guideInput.tapPending) {
      guideInput.tapPending = false
      guideInput.tapStale = true
      if (!npcSpoke) {
        markNpcSpoke(def.id)
      } else {
        setHandoff(true)
        handoffT.current = 0
      }
    }
  })

  return (
    <group ref={groupRef} position={[pos.x, pos.y, pos.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.35, 0.9, 0.35]} position={[0, 0.9, 0]} />
      </RigidBody>

      <group ref={bodyRef}>
        <mesh ref={leftLegRef} position={[-0.14, 0.28, 0]}>
          <capsuleGeometry args={[0.1, 0.32, 6, 8]} />
          <ToonMat color="#3a4550" />
        </mesh>
        <mesh ref={rightLegRef} position={[0.14, 0.28, 0]}>
          <capsuleGeometry args={[0.1, 0.32, 6, 8]} />
          <ToonMat color="#3a4550" />
        </mesh>

        <mesh position={[0, 0.72, 0]}>
          <capsuleGeometry args={[0.26, 0.42, 6, 10]} />
          <ToonMat color={def.color} />
        </mesh>

        {/* capa / colete */}
        <mesh position={[0, 0.78, -0.08]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.52, 0.38, 0.12]} />
          <ToonMat color={def.cape ?? def.color} />
        </mesh>

        <mesh ref={leftArmRef} position={[-0.34, 0.78, 0]} rotation={[0, 0, 0.25]}>
          <capsuleGeometry args={[0.08, 0.28, 6, 8]} />
          <ToonMat color={def.color} />
        </mesh>
        <group ref={rightArmRef} position={[0.34, 0.78, 0]} rotation={[0.35, 0, -0.25]}>
          <mesh>
            <capsuleGeometry args={[0.08, 0.28, 6, 8]} />
            <ToonMat color={def.color} />
          </mesh>
          {!hasItem && (
            <mesh position={[0.08, -0.22, 0.12]} rotation={[0.3, 0, -0.4]}>
              <boxGeometry args={[0.22, 0.22, 0.22]} />
              <ToonMat color="#e8c040" emissive="#c89820" emissiveIntensity={0.5} />
            </mesh>
          )}
        </group>

        <mesh position={[0, 1.18, 0]}>
          <sphereGeometry args={[0.22, 10, 8]} />
          <ToonMat color="#e8b896" />
        </mesh>
        <mesh position={[-0.08, 1.2, 0.18]}>
          <sphereGeometry args={[0.035, 5, 4]} />
          <ToonMat color="#2a2438" />
        </mesh>
        <mesh position={[0.08, 1.2, 0.18]}>
          <sphereGeometry args={[0.035, 5, 4]} />
          <ToonMat color="#2a2438" />
        </mesh>

        {/* chapéu */}
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.26, 0.28, 0.12, 8]} />
          <ToonMat color={def.hat} />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.18, 8]} />
          <ToonMat color={def.hat} />
        </mesh>

        {/* cinto / ferramenta do carpinteiro */}
        {def.role === 'carpenter' && (
          <mesh position={[0.18, 0.62, 0.14]} rotation={[0.4, 0.2, -0.5]}>
            <boxGeometry args={[0.08, 0.32, 0.08]} />
            <ToonMat color={def.accent ?? '#a08050'} />
          </mesh>
        )}
        {def.role === 'guard' && (
          <mesh position={[0, 0.62, 0.22]}>
            <boxGeometry args={[0.38, 0.08, 0.06]} />
            <ToonMat color={def.accent ?? '#8a9ab8'} />
          </mesh>
        )}
      </group>

      {dialogueLine && (
        <Billboard position={[0, 2.35, 0]}>
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[2.6, 0.72]} />
            <meshBasicMaterial color="#1a2438" transparent opacity={0.82} depthWrite={false} />
          </mesh>
          <Text
            fontSize={0.13}
            maxWidth={2.4}
            color="#f4f0e6"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.008}
            outlineColor="#1a2438"
            textAlign="center"
          >
            {dialogueLine}
          </Text>
        </Billboard>
      )}

      {near && !hasItem && (
        <mesh position={[0, 2.1, 0]}>
          <coneGeometry args={[0.18, 0.42, 5]} />
          <ToonMat color="#f0d060" emissive="#d4a830" emissiveIntensity={1} />
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
