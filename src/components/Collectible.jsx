import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useProgressStore, QUESTS } from '../store/progressStore'
import { pickSpawnForItem, isSpawnInsideItemZone } from '../data/itemSpawns'

const COLORS = {
  chave_portao: '#f0cf4c',
  capa_chuva: '#e8d24a',
  fungo_brilho: '#7dff9a',
  pena_coruja: '#e8d8a8',
  ferramenta: '#9fb0c2',
  casaco: '#a06a3c',
  cristal: '#6ec8e8',
  binoculo: '#4a5560',
}

/**
 * Item coletável. O ponto é sorteado dentro da fase certa (a ferramenta
 * nunca aparece na pradaria) e ganha um feixe de luz — indispensável
 * agora que o vale é bem maior.
 */
export default function Collectible({ itemId }) {
  const collected = useProgressStore((s) => s.collectedEver.includes(itemId))
  const collectItem = useProgressStore((s) => s.collectItem)
  const setItemPosition = useProgressStore((s) => s.setItemPosition)
  /** só os itens da etapa atual mostram feixe, para não revelar as próximas */
  const isCurrent = useProgressStore((s) => {
    const quest = QUESTS.find((q) => !s.unlockedGates.includes(q.gateId))
    return Boolean(quest?.itemIds.includes(itemId))
  })
  const groupRef = useRef(null)
  const beamRef = useRef(null)
  const lightRef = useRef(null)
  const burstRef = useRef(null)
  const ringRef = useRef(null)
  const burstStartRef = useRef(-1)
  const burstingRef = useRef(false)
  const [bursting, setBursting] = useState(false)
  const [gone, setGone] = useState(false)

  // direções das fagulhas da comemoração (pré-montadas: coletar não cria
  // nada na hora, então não há "travadinha" no frame do pickup)
  const sparks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        const up = 2 + (i % 4) * 1.1
        return {
          dx: Math.cos(a) * (1 + (i % 3) * 0.6),
          dz: Math.sin(a) * (1 + (i % 2) * 0.8),
          up,
          s: 0.09 + (i % 3) * 0.05,
        }
      }),
    [],
  )

  const position = useMemo(() => {
    const p = pickSpawnForItem(itemId, Math.floor(Math.random() * 1e9))
    if (import.meta.env.DEV && !isSpawnInsideItemZone(itemId, p)) {
      console.warn(`[spawn] ${itemId} caiu fora da fase esperada`, p)
    }
    return p
  }, [itemId])

  useEffect(() => {
    setItemPosition(itemId, position)
  }, [itemId, position, setItemPosition])

  useFrame((state) => {
    if (gone || (collected && !burstingRef.current)) return
    const t = state.clock.elapsedTime

    // ── comemoração da coleta: fagulhas + anel + flash ──
    if (burstingRef.current) {
      if (burstStartRef.current < 0) burstStartRef.current = t
      const k = (t - burstStartRef.current) / 0.95

      if (k >= 1) {
        // não desmonta: sumir com uma pointLight muda o "hash de luzes" da
        // cena e o three recompila shaders — era a travada pós-coleta
        if (lightRef.current) lightRef.current.intensity = 0
        if (burstRef.current) burstRef.current.visible = false
        if (ringRef.current) ringRef.current.visible = false
        setGone(true)
        return
      }

      if (burstRef.current) {
        burstRef.current.visible = true
        const children = burstRef.current.children
        for (let i = 0; i < children.length; i++) {
          const sp = sparks[i]
          children[i].position.set(sp.dx * k * 2.2, 0.4 + sp.up * k - 2.4 * k * k, sp.dz * k * 2.2)
          children[i].rotation.y = k * 7
          children[i].scale.setScalar(sp.s * (1 + k * 0.6))
          children[i].material.opacity = 1 - k
        }
      }
      if (ringRef.current) {
        ringRef.current.visible = true
        ringRef.current.scale.setScalar(0.4 + k * 4.2)
        ringRef.current.material.opacity = 0.6 * (1 - k)
      }
      if (lightRef.current) {
        lightRef.current.intensity = 34 * Math.exp(-3.4 * k)
      }
      return
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 1.4
      groupRef.current.position.y = 0.15 + Math.sin(t * 2.2) * 0.16
    }
    if (beamRef.current && beamRef.current.visible) {
      beamRef.current.material.opacity = 0.14 + Math.sin(t * 2.4) * 0.05
      beamRef.current.rotation.y = -t * 0.4
    }
  })

  // "morto" = já coletado (inclusive via debug) ou comemoração encerrada.
  // O grupo continua montado (invisível) para o número de luzes da cena
  // nunca mudar — desmontar aqui recompilava shaders e travava o frame.
  const dead = gone || (collected && !bursting)
  const color = COLORS[itemId] ?? '#ffffff'
  /** Halo do objetivo — tom âmbar suave (não neon) */
  const beacon = isCurrent ? '#d4b060' : color

  return (
    <group position={position}>
      {/* Feixe visível a distância */}
      <mesh ref={beamRef} position={[0, 11, 0]} visible={isCurrent && !bursting && !dead}>
        <cylinderGeometry args={[0.5, 1.4, 24, 6, 1, true]} />
        <meshBasicMaterial
          color={beacon}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* fica sempre montada e visível (intensidade 0 depois da coleta):
          o hash de luzes da cena não muda e nada recompila */}
      <pointLight
        ref={lightRef}
        position={[0, 1.2, 0]}
        color={beacon}
        intensity={dead ? 0 : isCurrent ? 4.5 : 2.2}
        distance={bursting ? 12 : 7}
        decay={2}
      />

      {!bursting && !dead && (
        <RigidBody type="fixed" colliders={false} sensor>
          <CuboidCollider
            args={[1, 1.2, 1]}
            position={[0, 0.4, 0]}
            sensor
            onIntersectionEnter={() => {
              if (burstingRef.current) return
              burstingRef.current = true
              collectItem(itemId)
              setBursting(true)
            }}
          />
        </RigidBody>
      )}

      <group ref={groupRef} visible={!bursting && !dead}>
        <ItemModel itemId={itemId} color={color} />
      </group>

      {/* Halo no chão */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} visible={!bursting && !dead}>
        <ringGeometry args={[0.7, 1.15, 16]} />
        <meshBasicMaterial
          color={beacon}
          transparent
          opacity={isCurrent ? 0.48 : 0.32}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Anel dourado flutuante — marca o objetivo atual */}
      {isCurrent && !bursting && !dead && (
        <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.06, 6, 16]} />
          <meshStandardMaterial
            color="#d4b060"
            emissive="#b89440"
            emissiveIntensity={0.45}
            flatShading
            metalness={0.35}
            roughness={0.5}
          />
        </mesh>
      )}

      {/* Comemoração: fagulhas + anel expandindo (pré-montados, invisíveis) */}
      <group ref={burstRef} visible={false}>
        {sparks.map((_, i) => (
          <mesh key={i}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? '#fff6d8' : color}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <mesh ref={ringRef} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
        <ringGeometry args={[0.85, 1, 20]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ItemModel({ itemId, color }) {
  switch (itemId) {
    case 'chave_portao':
      return (
        <>
          <mesh castShadow>
            <torusGeometry args={[0.22, 0.06, 6, 12]} />
            <meshStandardMaterial
              color={color}
              flatShading
              emissive={color}
              emissiveIntensity={0.8}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
          <mesh castShadow position={[0.3, 0, 0]}>
            <boxGeometry args={[0.36, 0.08, 0.08]} />
            <meshStandardMaterial color={color} flatShading emissive={color} emissiveIntensity={0.5} metalness={0.5} />
          </mesh>
          <mesh castShadow position={[0.44, -0.1, 0]}>
            <boxGeometry args={[0.09, 0.14, 0.08]} />
            <meshStandardMaterial color={color} flatShading metalness={0.5} />
          </mesh>
        </>
      )

    case 'capa_chuva':
      // capa pendurada, com capuz
      return (
        <>
          <mesh castShadow position={[0, -0.05, 0]}>
            <coneGeometry args={[0.34, 0.72, 8]} />
            <meshStandardMaterial color={color} flatShading roughness={0.5} emissive={color} emissiveIntensity={0.25} />
          </mesh>
          <mesh castShadow position={[0, 0.36, -0.06]}>
            <sphereGeometry args={[0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
            <meshStandardMaterial color={shade(color, -22)} flatShading roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <torusGeometry args={[0.2, 0.03, 5, 10]} />
            <meshStandardMaterial color="#4a4438" flatShading />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} castShadow position={[s * 0.3, 0.02, 0]} rotation={[0, 0, s * 0.5]}>
              <capsuleGeometry args={[0.07, 0.3, 3, 6]} />
              <meshStandardMaterial color={color} flatShading roughness={0.5} />
            </mesh>
          ))}
        </>
      )

    case 'ferramenta':
      return (
        <>
          <mesh castShadow rotation={[0, 0, 0.35]}>
            <boxGeometry args={[0.11, 0.7, 0.11]} />
            <meshStandardMaterial color="#5c3a1e" flatShading />
          </mesh>
          <mesh castShadow position={[0.14, 0.34, 0]} rotation={[0, 0, 0.35]}>
            <boxGeometry args={[0.42, 0.16, 0.12]} />
            <meshStandardMaterial
              color={color}
              flatShading
              emissive={color}
              emissiveIntensity={0.5}
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>
        </>
      )

    case 'casaco':
      // casaco de pele dobrado, com gola clara
      return (
        <>
          <mesh castShadow>
            <boxGeometry args={[0.62, 0.34, 0.4]} />
            <meshStandardMaterial color={color} flatShading roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 0.25, 0]}>
            <boxGeometry args={[0.56, 0.2, 0.36]} />
            <meshStandardMaterial color={shade(color, 22)} flatShading roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 0.4, 0.02]}>
            <sphereGeometry args={[0.22, 7, 5]} />
            <meshStandardMaterial color="#efe6d8" flatShading roughness={1} />
          </mesh>
          {[-0.18, 0.06].map((y) => (
            <mesh key={y} position={[0, y, 0.21]}>
              <sphereGeometry args={[0.045, 5, 4]} />
              <meshStandardMaterial color="#3a2c1e" flatShading />
            </mesh>
          ))}
        </>
      )

    case 'cristal':
      return (
        <>
          <mesh castShadow>
            <octahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial
              color={color}
              flatShading
              emissive={color}
              emissiveIntensity={1.2}
              transparent
              opacity={0.92}
            />
          </mesh>
          <mesh castShadow scale={0.55} rotation={[0.6, 0.4, 0]}>
            <octahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial color="#dff4ff" flatShading emissive="#bfe8ff" emissiveIntensity={0.9} />
          </mesh>
        </>
      )

    case 'binoculo':
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} castShadow position={[s * 0.14, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.14, 0.5, 10]} />
              <meshStandardMaterial color={color} flatShading roughness={0.5} metalness={0.35} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.16, 0.14, 0.24]} />
            <meshStandardMaterial color={shade(color, -14)} flatShading />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.14, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.04, 10]} />
              <meshStandardMaterial
                color="#9fe8f4"
                flatShading
                emissive="#7fd8ee"
                emissiveIntensity={0.7}
                roughness={0.15}
              />
            </mesh>
          ))}
          <mesh position={[0, -0.1, 0]} rotation={[0.4, 0, 0]}>
            <torusGeometry args={[0.22, 0.02, 4, 10]} />
            <meshStandardMaterial color="#3a3228" flatShading />
          </mesh>
        </>
      )

    case 'fungo_brilho':
      return (
        <>
          <mesh castShadow position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 0.28, 6]} />
            <meshStandardMaterial color="#d8c8a0" flatShading />
          </mesh>
          <mesh castShadow position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
            <meshStandardMaterial
              color={color}
              flatShading
              emissive={color}
              emissiveIntensity={1.1}
            />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={i}
              position={[Math.cos(i) * 0.12, 0.18, Math.sin(i) * 0.12]}
            >
              <sphereGeometry args={[0.04, 5, 4]} />
              <meshStandardMaterial color="#e8ffe8" emissive="#a0ffb0" emissiveIntensity={1.2} />
            </mesh>
          ))}
        </>
      )

    case 'pena_coruja':
      return (
        <>
          <mesh castShadow rotation={[0.4, 0.2, 0.5]}>
            <boxGeometry args={[0.18, 0.7, 0.06]} />
            <meshStandardMaterial color={color} flatShading emissive="#c8b070" emissiveIntensity={0.35} />
          </mesh>
          <mesh castShadow position={[0.05, 0.1, 0]} rotation={[0.5, -0.3, 0.2]}>
            <boxGeometry args={[0.12, 0.55, 0.04]} />
            <meshStandardMaterial color="#f0e6c8" flatShading />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.06, 5, 4]} />
            <meshStandardMaterial color="#5a4030" flatShading />
          </mesh>
        </>
      )

    default:
      return (
        <mesh castShadow>
          <octahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color={color} flatShading emissive={color} emissiveIntensity={1} />
        </mesh>
      )
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount))
  const b = Math.max(0, Math.min(255, (n & 255) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
