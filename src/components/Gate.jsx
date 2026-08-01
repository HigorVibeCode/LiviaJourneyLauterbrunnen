import { useMemo, useRef, useState } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useProgressStore, QUESTS, ITEMS, missingItems } from '../store/progressStore'
import { playerPosition } from '../store/playerStore'
import { guideInput } from '../lib/guideInput'
import { horseRide } from '../lib/horseRide'

const INTERACT_DIST = 8
const OPEN_ANGLE = 1.85
const OPEN_SECONDS = 2.6

/**
 * Portão de duas folhas com cerimônia de abertura:
 * treme, a fechadura cai, um clarão dourado sobe com poeira e as folhas
 * abrem devagar para dentro da próxima fase. O colisor só libera a
 * passagem quando as folhas já abriram o suficiente.
 */
export default function Gate({
  gateId,
  position = [0, 0, 0],
  /** posição mundo para interação (se o mesh estiver num group transformado) */
  interactAt = null,
  width = 6.5,
  height = 4.2,
  color = '#5c3a1e',
  /** arco + luzes para o portão se destacar de longe */
  landmark = false,
}) {
  const open = useProgressStore((s) => s.unlockedGates.includes(gateId))
  const setNearGate = useProgressStore((s) => s.setNearGate)
  const tryUnlockGate = useProgressStore((s) => s.tryUnlockGate)
  const wasNear = useRef(false)

  // progresso da animação de abertura (0 fechado → 1 escancarado)
  const openT = useRef(0)
  const [passable, setPassable] = useState(false)
  const shakeRef = useRef(null)
  const leftRef = useRef(null)
  const rightRef = useRef(null)
  const lockRef = useRef(null)
  const flashRef = useRef(null)
  const dustRef = useRef(null)

  const dust = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2
        return {
          dx: Math.cos(a) * (0.5 + (i % 4) * 0.3),
          dz: Math.sin(a) * 0.5,
          up: 1.2 + (i % 5) * 0.7,
          s: 0.1 + (i % 3) * 0.08,
          spin: (i % 2 ? 1 : -1) * (1 + (i % 3)),
        }
      }),
    [],
  )

  // Depois da Livia (priority -1): consome tapPending no mesmo frame do release.
  // NÃO usar priority > 0 — isso desliga o auto-render do R3F.
  useFrame((state, delta) => {
    // ── animação de abertura ──
    if (open && openT.current < 1) {
      openT.current = Math.min(1, openT.current + delta / OPEN_SECONDS)
    }
    const t = openT.current
    if (t > 0.42 && !passable) setPassable(true)

    // fase 1 (0–0.2): o portão estremece, a fechadura se solta
    if (shakeRef.current) {
      const shake = t > 0 && t < 0.2 ? (1 - t / 0.2) * 0.022 : 0
      shakeRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 55) * shake
      shakeRef.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 40)) * shake * 2
    }
    if (lockRef.current) {
      if (t <= 0) {
        lockRef.current.position.y = height * 0.45
        lockRef.current.scale.setScalar(1)
      } else {
        // a fechadura despenca e some no chão
        const fall = Math.min(1, t / 0.25)
        lockRef.current.position.y = height * 0.45 - fall * fall * height * 0.45
        lockRef.current.rotation.x = fall * 2.2
        lockRef.current.scale.setScalar(Math.max(0, 1 - Math.max(0, fall - 0.7) / 0.3))
      }
    }

    // fase 2 (0.15–1): as folhas abrem devagar, com desaceleração no fim
    const swing = easeInOutCubic(Math.max(0, (t - 0.15) / 0.85))
    if (leftRef.current) leftRef.current.rotation.y = swing * OPEN_ANGLE
    if (rightRef.current) rightRef.current.rotation.y = -swing * OPEN_ANGLE

    // clarão dourado que acende no destranque e apaga aos poucos
    if (flashRef.current) {
      flashRef.current.intensity = t > 0 && t < 1 ? 46 * Math.exp(-3.2 * t) : 0
    }

    // poeira subindo dos batentes
    if (dustRef.current) {
      const active = t > 0.05 && t < 0.75
      dustRef.current.visible = active
      if (active) {
        const k = (t - 0.05) / 0.7
        const children = dustRef.current.children
        for (let i = 0; i < children.length; i++) {
          const d = dust[i]
          children[i].position.set(d.dx * (1 + k * 2), 0.3 + d.up * k, 0.3 + d.dz * k)
          children[i].rotation.y = k * d.spin * 3
          children[i].scale.setScalar(d.s * (1 + k))
          children[i].material.opacity = 0.5 * (1 - k)
        }
      }
    }

    // ── interação (só enquanto fechado) ──
    if (open) {
      if (wasNear.current) {
        wasNear.current = false
        if (useProgressStore.getState().nearGateId === gateId) setNearGate(null)
      }
      return
    }

    const ix = interactAt?.[0] ?? position[0]
    const iz = interactAt?.[2] ?? position[2]
    const dist = Math.hypot(playerPosition.x - ix, playerPosition.z - iz)
    const near = dist < INTERACT_DIST

    if (near && !wasNear.current) {
      wasNear.current = true
      setNearGate(gateId)
    } else if (!near && wasNear.current) {
      wasNear.current = false
      if (useProgressStore.getState().nearGateId === gateId) setNearGate(null)
    }

    // tap curto de E (Livia); perto do cavalo o tap monta (não reabre o portão)
    if (near && guideInput.tapPending && !horseRide.nearMount) {
      guideInput.tapPending = false
      const quest = QUESTS.find((q) => q.gateId === gateId)
      const state = useProgressStore.getState()
      const missing = missingItems(quest, state.inventory)
      if (quest && missing.length === 0) {
        tryUnlockGate(gateId)
      } else if (
        !quest &&
        gateId === 'gate_night' &&
        state.unlockedGates.includes('gate_pasture') &&
        !state.unlockedGates.includes('gate_night')
      ) {
        // só o portão do vale noturno abre sem itens (após a cavalgada / a pé)
        useProgressStore.setState({
          unlockedGates: [...state.unlockedGates, 'gate_night'],
          toast: 'Portão aberto! O Vale Noturno te engole na escuridão',
          nearGateId: null,
        })
        setTimeout(() => {
          if (useProgressStore.getState().toast === 'Portão aberto! O Vale Noturno te engole na escuridão') {
            useProgressStore.setState({ toast: null })
          }
        }, 3500)
      } else {
        const message = missing.length
          ? `Trancado. Falta: ${missing.map((id) => ITEMS[id].name).join(' e ')}.`
          : 'Portão trancado.'
        useProgressStore.setState({ toast: message })
        setTimeout(() => {
          if (useProgressStore.getState().toast === message) {
            useProgressStore.setState({ toast: null })
          }
        }, 3000)
      }
    }
  })

  const leafW = width / 2

  return (
    <group position={position}>
      <Post x={-width / 2 - 0.1} height={height} />
      <Post x={width / 2 + 0.1} height={height} />

      {/* travessa superior fixa */}
      <mesh position={[0, height + 0.1, 0]} castShadow>
        <boxGeometry args={[width + 0.6, 0.25, 0.5]} />
        <ToonMat color="#3d2914"/>
      </mesh>

      {landmark && <GateLandmark width={width} height={height} color={color} />}

      {/* bloqueio físico: sai de cena quando as folhas abrem o bastante */}
      {!passable && (
        <RigidBody type="fixed" position={[0, height / 2, 0]} colliders={false}>
          <CuboidCollider args={[width / 2, height / 2, 0.28]} />
        </RigidBody>
      )}

      <group ref={shakeRef}>
        {/* folha esquerda (dobradiça no poste esquerdo) */}
        <group ref={leftRef} position={[-width / 2, 0, 0]}>
          <DoorLeaf width={leafW} height={height} color={color} hingeSide={1} />
        </group>
        {/* folha direita */}
        <group ref={rightRef} position={[width / 2, 0, 0]}>
          <DoorLeaf width={leafW} height={height} color={color} hingeSide={-1} />
        </group>
      </group>

      {/* fechadura dourada — despenca quando o portão destranca */}
      <group ref={lockRef} position={[0, height * 0.45, 0.28]}>
        <mesh castShadow>
          <boxGeometry args={[0.35, 0.35, 0.14]} />
          <ToonMat
            color="#e8c84a"emissive="#a08020"
            emissiveIntensity={0.4}
          />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <torusGeometry args={[0.12, 0.035, 5, 8]} />
          <ToonMat color="#c8a83a"/>
        </mesh>
      </group>

      {/* clarão do destranque */}
      <pointLight
        ref={flashRef}
        position={[0, height * 0.6, 1.2]}
        color="#ffd98a"
        intensity={0}
        distance={18}
        decay={2}
      />

      {/* poeira dos batentes */}
      <group ref={dustRef} visible={false}>
        {dust.map((_, i) => (
          <mesh key={i}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#d8c8a8" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Uma folha do portão, com pranchas, reforço em Z e dobradiças */
function DoorLeaf({ width, height, color, hingeSide }) {
  const cx = hingeSide * width * 0.5
  return (
    <group>
      <mesh position={[cx, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width - 0.06, height * 0.94, 0.32]} />
        <ToonMat color={color}/>
      </mesh>

      {/* tala central na folha direita: cobre a fresta entre as folhas
          (sem ela, a luz do outro lado vaza como uma linha brilhante) */}
      {hingeSide < 0 && (
        <mesh position={[hingeSide * (width - 0.04), height / 2, 0]} castShadow>
          <boxGeometry args={[0.26, height * 0.94, 0.42]} />
          <ToonMat color="#4a2c14"/>
        </mesh>
      )}

      {/* pranchas verticais */}
      {Array.from({ length: 3 }, (_, i) => (
        <mesh
          key={i}
          position={[hingeSide * (0.5 + i * (width / 3.2)), height * 0.49, 0.19]}
          castShadow
        >
          <boxGeometry args={[0.14, height * 0.88, 0.08]} />
          <ToonMat color="#3a2210"/>
        </mesh>
      ))}

      {/* reforço diagonal */}
      <mesh position={[cx, height / 2, 0.2]} rotation={[0, 0, hingeSide * 0.62]} castShadow>
        <boxGeometry args={[0.16, height * 0.9, 0.06]} />
        <ToonMat color="#4a2c14"/>
      </mesh>

      {/* dobradiças de ferro */}
      {[height * 0.22, height * 0.78].map((y) => (
        <mesh key={y} position={[hingeSide * 0.22, y, 0.2]} castShadow>
          <boxGeometry args={[0.44, 0.16, 0.08]} />
          <ToonMat color="#4a4a48"/>
        </mesh>
      ))}
    </group>
  )
}

/** Arco, bandeiras e luzes — o portão precisa “gritar” na paisagem */
function GateLandmark({ width, height, color }) {
  const t = useRef(0)
  const glowRef = useRef(null)
  useFrame((_, dt) => {
    t.current += dt
    if (glowRef.current) {
      glowRef.current.intensity = 1.8 + Math.sin(t.current * 2.4) * 0.7
    }
  })

  return (
    <group>
      {/* arco alto acima do vão */}
      <mesh position={[0, height + 1.55, 0]} castShadow>
        <boxGeometry args={[width + 2.2, 0.35, 0.55]} />
        <ToonMat color="#2a1a0c"/>
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 + 0.55), height + 0.85, 0]} castShadow>
          <boxGeometry args={[0.35, 1.5, 0.35]} />
          <ToonMat color="#3a2210"/>
        </mesh>
      ))}
      {/* bandeiras laterais */}
      {[-1, 1].map((s) => (
        <group key={`f${s}`} position={[s * (width / 2 + 1.1), height + 0.2, 0.15]}>
          <mesh castShadow position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 2.4, 5]} />
            <ToonMat color="#2a1a0c"/>
          </mesh>
          <mesh position={[s * 0.35, 1.7, 0.05]} castShadow>
            <boxGeometry args={[0.7, 0.45, 0.04]} />
            <ToonMat
              color="#e8c04a"emissive="#c09020"
              emissiveIntensity={0.55}
            />
          </mesh>
        </group>
      ))}
      {/* brasão dourado no centro */}
      <mesh position={[0, height + 1.55, 0.35]} castShadow>
        <octahedronGeometry args={[0.38, 0]} />
        <ToonMat
          color="#f0d060"emissive="#e8b030"
          emissiveIntensity={0.85}/>
      </mesh>
      <pointLight
        ref={glowRef}
        position={[0, height + 1.4, 1.6]}
        color="#ffd060"
        intensity={2.2}
        distance={28}
        decay={2}
      />
      {/* tochas altas nos postes */}
      {[-1, 1].map((s) => (
        <group key={`torch${s}`} position={[s * (width / 2 + 0.15), height + 0.55, 0.4]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.5, 5]} />
            <ToonMat color="#3a2210"/>
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.16, 6, 5]} />
            <ToonMat
              color="#ffb040"emissive="#ff9020"
              emissiveIntensity={1.4}
            />
          </mesh>
          <pointLight position={[0, 0.4, 0.2]} color="#ffb060" intensity={1.1} distance={14} decay={2} />
        </group>
      ))}
      {/* anel no chão — marca o vão */}
      <mesh position={[0, 0.05, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[width * 0.35, width * 0.55, 16]} />
        <meshBasicMaterial color="#e8c04a" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, -0.2]} visible={false}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

function Post({ x, height }) {
  return (
    <RigidBody type="fixed" position={[x, height / 2, 0]} colliders={false}>
      <CuboidCollider args={[0.2, height / 2 + 0.15, 0.2]} />
      <mesh castShadow>
        <boxGeometry args={[0.35, height + 0.3, 0.35]} />
        <ToonMat color="#3a2210"/>
      </mesh>
      {/* lampião no topo do poste: marca o portão de longe */}
      <mesh position={[0, height / 2 + 0.35, 0]} castShadow>
        <boxGeometry args={[0.28, 0.34, 0.28]} />
        <ToonMat
          color="#ffd98a"emissive="#ffb84a"
          emissiveIntensity={0.9}
        />
      </mesh>
      <mesh position={[0, height / 2 + 0.56, 0]} castShadow>
        <coneGeometry args={[0.26, 0.22, 4]} />
        <ToonMat color="#3a2210"/>
      </mesh>
    </RigidBody>
  )
}

function easeInOutCubic(x) {
  const k = Math.min(1, Math.max(0, x))
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}
