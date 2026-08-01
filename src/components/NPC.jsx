import { useMemo, useRef } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useProgressStore } from '../store/progressStore'
import { ITEMS } from '../store/progressStore'
import { resolveNpcPosition } from '../config/npcs'
import { NPC_DIALOGUES } from '../config/story'
import { guideInput } from '../lib/guideInput'
import { playerPosition } from '../store/playerStore'
import * as THREE from 'three'

const HANDOFF_DUR = 0.7

/** Presente na mão — visual por item */
function GiftProp({ itemId }) {
  if (itemId === 'fungo_brilho') {
    return (
      <group position={[0.06, -0.28, 0.1]} rotation={[0.35, 0.2, -0.3]}>
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <ToonMat color="#3a6a48" />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.14, 8, 6]} />
          <ToonMat color="#7ef0a8" emissive="#3ad878" emissiveIntensity={1.1} />
        </mesh>
        <mesh position={[0.08, 0.2, 0.04]}>
          <sphereGeometry args={[0.04, 5, 4]} />
          <ToonMat color="#c8ffe0" emissive="#80ffb0" emissiveIntensity={0.8} />
        </mesh>
        <pointLight color="#6ef0a0" intensity={2.2} distance={2.4} decay={2} />
      </group>
    )
  }
  if (itemId === 'ferramenta') {
    return (
      <group position={[0.04, -0.3, 0.08]} rotation={[0.5, 0.4, -0.55]}>
        <mesh>
          <cylinderGeometry args={[0.035, 0.04, 0.38, 6]} />
          <ToonMat color="#6a4a28" />
        </mesh>
        <mesh position={[0.1, 0.14, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.1, 0.22, 0.06]} />
          <ToonMat color="#8a9098" />
        </mesh>
        <mesh position={[0.1, 0.14, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.06, 0.16, 0.07]} />
          <ToonMat color="#b0b8c0" />
        </mesh>
      </group>
    )
  }
  // cristal
  return (
    <group position={[0.05, -0.26, 0.1]} rotation={[0.2, 0.5, -0.2]}>
      <mesh rotation={[0.3, 0.4, 0.15]}>
        <octahedronGeometry args={[0.14, 0]} />
        <ToonMat color="#a8e8ff" emissive="#48c0e8" emissiveIntensity={1.35} />
      </mesh>
      <mesh position={[0, 0.02, 0]} scale={[0.55, 0.7, 0.55]} rotation={[0.1, 0.8, 0]}>
        <octahedronGeometry args={[0.1, 0]} />
        <ToonMat color="#e8f8ff" emissive="#90e0ff" emissiveIntensity={0.7} />
      </mesh>
      <pointLight color="#70d8f0" intensity={2.6} distance={2.8} decay={2} />
    </group>
  )
}

/** Rosto com olhos, bochechas, nariz e boca — estilo Livia */
function NpcFace({ p }) {
  return (
    <group position={[0, 1.22, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <ToonMat color={p.skin} />
      </mesh>
      <mesh position={[0, -0.02, 0.02]} scale={[0.92, 0.95, 0.9]}>
        <sphereGeometry args={[0.185, 10, 8]} />
        <ToonMat color={p.skinDark} />
      </mesh>

      {/* orelhas */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.18, 0.01, 0]} scale={[0.45, 0.7, 0.5]}>
          <sphereGeometry args={[0.07, 6, 5]} />
          <ToonMat color={p.skin} />
        </mesh>
      ))}

      {/* olhos */}
      {[-1, 1].map((s) => (
        <group key={`eye-${s}`} position={[s * 0.07, 0.03, 0.155]}>
          <mesh scale={[1.15, 0.95, 0.5]}>
            <sphereGeometry args={[0.038, 7, 5]} />
            <ToonMat color="#f7f4ee" />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <sphereGeometry args={[0.022, 6, 5]} />
            <ToonMat color={p.eye} />
          </mesh>
          <mesh position={[0.006, 0.006, 0.035]}>
            <sphereGeometry args={[0.008, 4, 3]} />
            <ToonMat color="#1a1420" />
          </mesh>
          {/* sobrancelha */}
          <mesh position={[0, 0.042, 0.01]} rotation={[0.15, 0, s * -0.15]} scale={[1.1, 0.35, 0.4]}>
            <boxGeometry args={[0.055, 0.02, 0.02]} />
            <ToonMat color={p.hair} />
          </mesh>
        </group>
      ))}

      {/* nariz */}
      <mesh position={[0, -0.01, 0.175]} scale={[0.7, 0.9, 0.8]}>
        <sphereGeometry args={[0.028, 5, 4]} />
        <ToonMat color={p.skinDark} />
      </mesh>

      {/* bochechas */}
      {[-1, 1].map((s) => (
        <mesh key={`cheek-${s}`} position={[s * 0.11, -0.04, 0.14]} scale={[1, 0.7, 0.5]}>
          <sphereGeometry args={[0.035, 5, 4]} />
          <ToonMat color={p.cheek} />
        </mesh>
      ))}

      {/* boca */}
      <mesh position={[0, -0.075, 0.16]} scale={[1.2, 0.45, 0.5]}>
        <sphereGeometry args={[0.028, 5, 4]} />
        <ToonMat color={p.lip} />
      </mesh>
    </group>
  )
}

/** Cabelo base sob o chapéu */
function NpcHair({ p, role }) {
  if (role === 'guide') {
    return (
      <group position={[0, 1.28, 0]}>
        <mesh position={[0, 0.02, -0.02]} scale={[1.05, 0.7, 1.05]}>
          <sphereGeometry args={[0.2, 10, 8]} />
          <ToonMat color={p.hair} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.16, -0.08, -0.02]} rotation={[0.2, 0, s * 0.35]}>
            <capsuleGeometry args={[0.045, 0.22, 4, 6]} />
            <ToonMat color={p.hair} />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <group position={[0, 1.28, 0]}>
      <mesh position={[0, 0.01, -0.03]} scale={[1.02, 0.65, 1.0]}>
        <sphereGeometry args={[0.195, 10, 8]} />
        <ToonMat color={p.hair} />
      </mesh>
      <mesh position={[0, -0.06, -0.12]} scale={[0.9, 0.7, 0.7]}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <ToonMat color={p.hair} />
      </mesh>
    </group>
  )
}

/** Chapéu / touca por papel */
function NpcHat({ p, role }) {
  if (role === 'guard') {
    return (
      <group position={[0, 1.42, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.24, 0.26, 0.1, 10]} />
          <ToonMat color={p.hat} />
        </mesh>
        <mesh position={[0, 0.14, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.18, 0.22, 8]} />
          <ToonMat color={p.hat} />
        </mesh>
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.025, 5, 12]} />
          <ToonMat color={p.hatBand} />
        </mesh>
        {/* pluma */}
        <mesh position={[0.16, 0.22, -0.02]} rotation={[0.3, 0, 0.6]}>
          <capsuleGeometry args={[0.02, 0.28, 3, 5]} />
          <ToonMat color="#c8a0e0" />
        </mesh>
      </group>
    )
  }
  if (role === 'carpenter') {
    return (
      <group position={[0, 1.4, 0]}>
        <mesh castShadow rotation={[-0.08, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.3, 0.08, 10]} />
          <ToonMat color={p.hat} />
        </mesh>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 0.18, 8]} />
          <ToonMat color={p.hat} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.022, 4, 12]} />
          <ToonMat color={p.hatBand} />
        </mesh>
      </group>
    )
  }
  // guide — touca de pele + pompóm
  return (
    <group position={[0, 1.4, 0]}>
      <mesh castShadow scale={[1.05, 0.85, 1.05]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <ToonMat color={p.hat} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.04, 5, 12]} />
        <ToonMat color={p.capeTrim} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.07, 6, 5]} />
        <ToonMat color={p.hatBand} />
      </mesh>
      {/* abas de orelha */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.18, -0.04, 0]} rotation={[0.2, 0, s * 0.4]}>
          <capsuleGeometry args={[0.05, 0.12, 4, 5]} />
          <ToonMat color={p.hat} />
        </mesh>
      ))}
    </group>
  )
}

/** Acessórios e roupa específica do papel */
function RoleExtras({ p, role }) {
  if (role === 'guard') {
    return (
      <group>
        {/* peitoral / faixa */}
        <mesh position={[0, 0.78, 0.18]} castShadow>
          <boxGeometry args={[0.42, 0.14, 0.08]} />
          <ToonMat color={p.metal} />
        </mesh>
        <mesh position={[0, 0.78, 0.22]}>
          <boxGeometry args={[0.18, 0.08, 0.04]} />
          <ToonMat color={p.accent} />
        </mesh>
        {/* ombreiras */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.3, 0.95, 0]} castShadow>
            <sphereGeometry args={[0.1, 7, 5]} />
            <ToonMat color={p.tunicDark} />
          </mesh>
        ))}
        {/* capa longa */}
        <mesh position={[0, 0.72, -0.16]} rotation={[0.18, 0, 0]} castShadow>
          <boxGeometry args={[0.58, 0.85, 0.08]} />
          <ToonMat color={p.cape} />
        </mesh>
        <mesh position={[0, 1.05, -0.14]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.5, 0.08, 0.06]} />
          <ToonMat color={p.capeTrim} />
        </mesh>
        {/* lanterninha no cinto */}
        <group position={[-0.28, 0.55, 0.12]}>
          <mesh>
            <cylinderGeometry args={[0.04, 0.05, 0.08, 6]} />
            <ToonMat color="#3a2a18" />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.055, 6, 5]} />
            <ToonMat color="#ffcc66" emissive="#ffaa33" emissiveIntensity={1.2} />
          </mesh>
          <pointLight color="#ffaa55" intensity={1.4} distance={2.2} decay={2} />
        </group>
      </group>
    )
  }

  if (role === 'carpenter') {
    return (
      <group>
        {/* avental */}
        <mesh position={[0, 0.62, 0.14]} castShadow>
          <boxGeometry args={[0.4, 0.55, 0.06]} />
          <ToonMat color={p.cape} />
        </mesh>
        <mesh position={[0, 0.88, 0.15]}>
          <boxGeometry args={[0.42, 0.08, 0.05]} />
          <ToonMat color={p.capeTrim} />
        </mesh>
        {/* bolsos do avental */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.1, 0.5, 0.18]}>
            <boxGeometry args={[0.12, 0.12, 0.04]} />
            <ToonMat color={p.tunicDark} />
          </mesh>
        ))}
        {/* cinto com ferramentas */}
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.29, 0.3, 0.07, 10]} />
          <ToonMat color={p.belt} />
        </mesh>
        <mesh position={[0.22, 0.58, 0.18]} rotation={[0.4, 0.3, -0.5]}>
          <boxGeometry args={[0.06, 0.22, 0.06]} />
          <ToonMat color={p.accent} />
        </mesh>
        {/* ombro com pedaço de madeira */}
        <mesh position={[-0.22, 0.95, -0.05]} rotation={[0.1, 0.4, 0.5]}>
          <boxGeometry args={[0.08, 0.08, 0.35]} />
          <ToonMat color="#8a6238" />
        </mesh>
      </group>
    )
  }

  // guide — gola de pele, cachecol e ombreiras felpudas
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.28, 0.98, 0]} castShadow>
          <sphereGeometry args={[0.11, 7, 5]} />
          <ToonMat color={p.cape} />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.05, 5, 12]} />
        <ToonMat color={p.cape} />
      </mesh>
      {[
        [0, 1.08, 0.12],
        [0.1, 1.06, 0.08],
        [-0.1, 1.06, 0.08],
        [0.12, 1.04, -0.02],
        [-0.12, 1.04, -0.02],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.04, 5, 4]} />
          <ToonMat color={i % 2 ? p.capeTrim : p.cape} />
        </mesh>
      ))}
      <mesh position={[0.08, 0.95, 0.16]} rotation={[0.3, 0.2, 0.4]}>
        <boxGeometry args={[0.12, 0.28, 0.05]} />
        <ToonMat color={p.hatBand} />
      </mesh>
      <mesh position={[-0.05, 0.9, 0.18]} rotation={[0.2, -0.1, -0.2]}>
        <boxGeometry args={[0.1, 0.18, 0.04]} />
        <ToonMat color="#e87868" />
      </mesh>
      {[0.85, 0.72, 0.6].map((y) => (
        <mesh key={y} position={[0, y, 0.24]}>
          <sphereGeometry args={[0.02, 5, 4]} />
          <ToonMat color="#3a2a1c" />
        </mesh>
      ))}
    </group>
  )
}

/**
 * NPC alpino polido — diálogo no HUD + entrega de item ao pressionar E perto.
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
  const wasNear = useRef(false)
  const groupRef = useRef(null)
  const markerRef = useRef(null)
  const ringRef = useRef(null)
  const bodyRef = useRef(null)
  const headRef = useRef(null)
  const leftArmRef = useRef(null)
  const rightArmRef = useRef(null)
  const leftLegRef = useRef(null)
  const rightLegRef = useRef(null)
  const capeRef = useRef(null)
  const bobRef = useRef(Math.random() * 10)
  const handoffT = useRef(0)
  const handoffActive = useRef(false)
  const blinkT = useRef(2 + Math.random() * 3)
  const lidsRef = useRef(null)

  const shadowGeo = useMemo(() => new THREE.CircleGeometry(0.55, 16), [])

  useFrame((state, dt) => {
    if (!groupRef.current) return

    const dx = playerPosition.x - pos.x
    const dz = playerPosition.z - pos.z
    const dist = Math.hypot(dx, dz)
    const isNear = dist < 3.4
    const t = bobRef.current

    if (isNear && !wasNear.current) {
      wasNear.current = true
      if (!hasItem) setNearNpc(def.id)
    } else if (!isNear && wasNear.current) {
      wasNear.current = false
      if (useProgressStore.getState().nearNpcId === def.id) setNearNpc(null)
    } else if (isNear && hasItem && useProgressStore.getState().nearNpcId === def.id) {
      setNearNpc(null)
    }

    bobRef.current += dt
    const breath = Math.sin(t * 1.8) * 0.035
    const sway = Math.sin(t * 1.35) * 0.1
    const armSway = Math.sin(t * 1.5 + 0.4) * 0.16
    groupRef.current.position.y = pos.y + breath

    if (isNear && dist > 0.05) {
      const want = Math.atan2(dx, dz)
      const cur = groupRef.current.rotation.y
      let dYaw = want - cur
      while (dYaw > Math.PI) dYaw -= Math.PI * 2
      while (dYaw < -Math.PI) dYaw += Math.PI * 2
      groupRef.current.rotation.y = cur + dYaw * Math.min(1, dt * 4)
    }

    // marcador flutuante
    if (markerRef.current) {
      const show = isNear && !hasItem
      markerRef.current.visible = show
      if (show) {
        markerRef.current.position.y = 2.35 + Math.sin(t * 3.2) * 0.1
        markerRef.current.rotation.y = t * 1.8
      }
    }
    if (ringRef.current) {
      ringRef.current.visible = isNear && !hasItem
      if (ringRef.current.visible) {
        ringRef.current.rotation.z = t * 1.2
        const s = 0.9 + Math.sin(t * 2.5) * 0.08
        ringRef.current.scale.set(s, s, s)
      }
    }

    // piscar — pálpebras só descem no instante do blink
    blinkT.current -= dt
    if (lidsRef.current) {
      if (blinkT.current < 0.1 && blinkT.current > 0) {
        lidsRef.current.scale.y = 1
        lidsRef.current.position.y = 1.25
      } else {
        lidsRef.current.scale.y = 0.05
        lidsRef.current.position.y = 1.285
        if (blinkT.current <= 0) blinkT.current = 2.2 + Math.random() * 3.5
      }
    }

    if (headRef.current) {
      headRef.current.rotation.z = sway * 0.2
      headRef.current.rotation.x = Math.sin(t * 0.9) * 0.04 + (isNear ? -0.06 : 0)
    }
    if (capeRef.current) {
      capeRef.current.rotation.x = 0.12 + Math.sin(t * 1.7) * 0.04
    }

    if (handoffActive.current) {
      handoffT.current += dt
      const ht = Math.min(1, handoffT.current / HANDOFF_DUR)
      const ease = 1 - (1 - ht) ** 2
      if (bodyRef.current) bodyRef.current.rotation.z = sway * 0.06
      if (leftArmRef.current) leftArmRef.current.rotation.x = armSway * 0.3
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -0.2 + ease * 1.55
        rightArmRef.current.rotation.z = -0.2 + ease * 0.15
      }
      if (ht >= 1) {
        collectItem(def.itemId)
        handoffActive.current = false
        handoffT.current = 0
        setNearNpc(null)
      }
      return
    }

    if (bodyRef.current) {
      bodyRef.current.rotation.z = sway * 0.12
      bodyRef.current.scale.y = 1 + Math.sin(t * 1.8) * 0.012
    }
    if (leftArmRef.current) leftArmRef.current.rotation.x = armSway
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = -armSway * 0.65 + (hasItem ? 0.12 : 0.4)
      rightArmRef.current.rotation.z = -0.28
    }
    if (leftLegRef.current) leftLegRef.current.rotation.x = -armSway * 0.22
    if (rightLegRef.current) rightLegRef.current.rotation.x = armSway * 0.22

    if (hasItem || !isNear) return

    if (guideInput.tapPending) {
      guideInput.tapPending = false
      guideInput.tapStale = true
      if (!npcSpoke) {
        markNpcSpoke(def.id)
      } else {
        handoffActive.current = true
        handoffT.current = 0
      }
    }
  })

  const p = def

  return (
    <group ref={groupRef} position={[pos.x, pos.y, pos.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.38, 0.95, 0.38]} position={[0, 0.95, 0]} />
      </RigidBody>

      {/* sombra no chão */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} geometry={shadowGeo}>
        <meshBasicMaterial color="#1a1820" transparent opacity={0.28} depthWrite={false} />
      </mesh>

      <group ref={bodyRef}>
        {/* pernas + botas */}
        <group ref={leftLegRef} position={[-0.13, 0.42, 0]}>
          <mesh castShadow position={[0, 0.05, 0]}>
            <capsuleGeometry args={[0.09, 0.28, 5, 8]} />
            <ToonMat color={p.pants} />
          </mesh>
          <mesh position={[0, -0.22, 0.02]} castShadow>
            <boxGeometry args={[0.16, 0.14, 0.22]} />
            <ToonMat color={p.boots} />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.13, 0.42, 0]}>
          <mesh castShadow position={[0, 0.05, 0]}>
            <capsuleGeometry args={[0.09, 0.28, 5, 8]} />
            <ToonMat color={p.pants} />
          </mesh>
          <mesh position={[0, -0.22, 0.02]} castShadow>
            <boxGeometry args={[0.16, 0.14, 0.22]} />
            <ToonMat color={p.boots} />
          </mesh>
        </group>

        {/* torso */}
        <mesh castShadow position={[0, 0.78, 0]}>
          <capsuleGeometry args={[0.24, 0.4, 5, 10]} />
          <ToonMat color={p.tunic} />
        </mesh>
        <mesh position={[0, 0.8, -0.02]} scale={[0.95, 0.9, 0.95]}>
          <capsuleGeometry args={[0.22, 0.32, 4, 9]} />
          <ToonMat color={p.tunicDark} />
        </mesh>

        {/* cinto */}
        <mesh position={[0, 0.56, 0]}>
          <cylinderGeometry args={[0.255, 0.265, 0.06, 10]} />
          <ToonMat color={p.belt} />
        </mesh>
        <mesh position={[0.02, 0.56, 0.24]}>
          <boxGeometry args={[0.08, 0.07, 0.04]} />
          <ToonMat color={p.accent} />
        </mesh>

        <RoleExtras p={p} role={p.role} />

        {/* capa genérica (guard tem a dela em RoleExtras; carpenter/guide usam leve) */}
        {p.role !== 'guard' && (
          <mesh ref={capeRef} position={[0, 0.75, -0.14]} rotation={[0.15, 0, 0]} castShadow>
            <boxGeometry args={[0.48, 0.55, 0.06]} />
            <ToonMat color={p.cape} />
          </mesh>
        )}
        {p.role === 'guard' && <group ref={capeRef} />}

        {/* braços */}
        <group ref={leftArmRef} position={[-0.32, 0.92, 0]} rotation={[0, 0, 0.28]}>
          <mesh castShadow position={[0, -0.14, 0]}>
            <capsuleGeometry args={[0.075, 0.26, 5, 7]} />
            <ToonMat color={p.tunic} />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.07, 6, 5]} />
            <ToonMat color={p.skin} />
          </mesh>
        </group>

        <group ref={rightArmRef} position={[0.32, 0.92, 0]} rotation={[0.35, 0, -0.28]}>
          <mesh castShadow position={[0, -0.14, 0]}>
            <capsuleGeometry args={[0.075, 0.26, 5, 7]} />
            <ToonMat color={p.tunic} />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.07, 6, 5]} />
            <ToonMat color={p.skin} />
          </mesh>
          {!hasItem && <GiftProp itemId={def.itemId} />}
        </group>

        {/* cabeça */}
        <group ref={headRef}>
          <NpcHair p={p} role={p.role} />
          <NpcFace p={p} />
          {/* pálpebras (piscar) */}
          <group ref={lidsRef} position={[0, 1.25, 0.16]}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.07, 0.02, 0.02]} scale={[1.1, 1, 0.4]}>
                <sphereGeometry args={[0.032, 5, 4]} />
                <ToonMat color={p.skin} />
              </mesh>
            ))}
          </group>
          <NpcHat p={p} role={p.role} />
        </group>
      </group>

      {/* marcador de interação */}
      <group ref={markerRef} visible={false} position={[0, 2.35, 0]}>
        <mesh>
          <octahedronGeometry args={[0.14, 0]} />
          <ToonMat color="#f0d060" emissive="#d4a830" emissiveIntensity={1.2} />
        </mesh>
        <mesh position={[0, -0.22, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.1, 0.18, 5]} />
          <ToonMat color="#f0d060" emissive="#d4a830" emissiveIntensity={0.9} />
        </mesh>
      </group>
      <mesh ref={ringRef} visible={false} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.035, 6, 24]} />
        <ToonMat color="#f0d060" emissive="#d4a830" emissiveIntensity={0.7} />
      </mesh>
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
