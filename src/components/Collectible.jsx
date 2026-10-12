import { useRef, useState, useMemo, useEffect } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { Sparkles, RoundedBox } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useProgressStore, QUESTS } from '../store/progressStore'
import { pickSpawnForItem, isSpawnInsideItemZone } from '../data/itemSpawns'
import { PAL } from '../config/palette'
import { heartGeometry, tint } from './world/cuteShapes'

const COLORS = {
  chave_portao: '#f0cf4c',
  capa_chuva: '#ffd84a',
  fungo_brilho: '#7dff9a',
  pena_coruja: '#e8d8a8',
  ferramenta: '#9fd0ff',
  casaco: '#ff9a6a',
  cristal: '#6ec8e8',
  binoculo: '#6ec8ff',
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
  /** Halo do objetivo — tom âmbar/dourado estilo thumb */
  const beacon = isCurrent ? '#f0c848' : color

  return (
    <group position={position}>
      {/* Feixe visível a distância */}
      <mesh ref={beamRef} position={[0, 13, 0]} visible={isCurrent && !bursting && !dead}>
        <cylinderGeometry args={[0.55, 1.6, 28, 6, 1, true]} />
        <meshBasicMaterial
          color={beacon}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* fica sempre montada e visível (intensidade 0 depois da coleta):
          o hash de luzes da cena não muda e nada recompila */}
      <pooledLight
        ref={lightRef}
        position={[0, 1.2, 0]}
        color={beacon}
        intensity={dead ? 0 : isCurrent ? 7.5 : 2.8}
        distance={bursting ? 14 : 9}
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
          opacity={isCurrent ? 0.58 : 0.36}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* brilhinhos em volta do item da etapa atual */}
      {isCurrent && !bursting && !dead && (
        <Sparkles count={18} scale={[2.4, 2.6, 2.4]} position={[0, 0.6, 0]} size={5} speed={0.5} color={color} opacity={0.9} />
      )}
      {/* Anel dourado flutuante — marca o objetivo atual */}
      {isCurrent && !bursting && !dead && (
        <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.08, 8, 20]} />
          <ToonMat color="#ffd45a" emissive="#ffb830" emissiveIntensity={0.6} />
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
      // chave dourada gordinha com cabeça de coração
      return (
        <group rotation={[0, 0, Math.PI / 2]} position={[0, 0.05, 0]} scale={1.25}>
          <mesh geometry={heartGeometry()} position={[0, 0.3, 0]} rotation={[0, 0, Math.PI]} scale={0.55}>
            <ToonMat color="#ffd45a" emissive="#ffb830" emissiveIntensity={0.45} />
          </mesh>
          <mesh position={[0, 0.3, 0.12]}>
            <sphereGeometry args={[0.08, 10, 8]} />
            <ToonMat color="#ff6fa8" emissive="#ff4f90" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <capsuleGeometry args={[0.06, 0.5, 4, 10]} />
            <ToonMat color="#ffd45a" emissive="#ffb830" emissiveIntensity={0.35} />
          </mesh>
          {[-0.3, -0.16].map((y) => (
            <RoundedBox key={y} args={[0.18, 0.09, 0.1]} radius={0.04} smoothness={2} bevelSegments={1} position={[0.1, y, 0]}>
              <ToonMat color="#ffd45a" emissive="#ffb830" emissiveIntensity={0.35} />
            </RoundedBox>
          ))}
        </group>
      )

    case 'capa_chuva':
      // capinha de chuva amarela com capuz e botões rosa
      return (
        <group scale={1.15}>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.2, 0.38, 0.62, 16]} />
            <ToonMat color="#ffd84a" emissive="#ffc020" emissiveIntensity={0.15} />
          </mesh>
          <mesh position={[0, 0.36, -0.03]}>
            <sphereGeometry args={[0.23, 14, 10]} />
            <ToonMat color="#ffcf3a" />
          </mesh>
          <mesh position={[0, 0.33, 0.12]} scale={[1, 0.85, 0.5]}>
            <sphereGeometry args={[0.15, 12, 8]} />
            <ToonMat color="#fff6dc" />
          </mesh>
          {[0.12, -0.08].map((y) => (
            <mesh key={y} position={[0, y, 0.27 - y * 0.25]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <ToonMat color="#ff8fb8" />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.27, 0.04, 0]} rotation={[0, 0, s * 0.45]}>
              <capsuleGeometry args={[0.08, 0.28, 4, 10]} />
              <ToonMat color="#ffd84a" />
            </mesh>
          ))}
        </group>
      )

    case 'ferramenta':
      // martelinho fofo: cabo de madeira com punho rosa e cabeça azul-clara
      return (
        <group rotation={[0, 0, 0.35]} scale={1.2}>
          <mesh position={[0, -0.05, 0]}>
            <capsuleGeometry args={[0.07, 0.55, 4, 10]} />
            <ToonMat color={PAL.wood} />
          </mesh>
          <mesh position={[0, -0.27, 0]}>
            <capsuleGeometry args={[0.09, 0.16, 4, 10]} />
            <ToonMat color="#ff8fb8" />
          </mesh>
          <RoundedBox args={[0.5, 0.22, 0.22]} radius={0.08} smoothness={2} bevelSegments={2} position={[0, 0.32, 0]}>
            <ToonMat color="#bfe0ff" emissive="#9fd0ff" emissiveIntensity={0.3} />
          </RoundedBox>
          <mesh position={[0.27, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 12]} />
            <ToonMat color="#ffffff" />
          </mesh>
        </group>
      )

    case 'casaco':
      // casaquinho dobrado, cor quente, gola fofinha e botões
      return (
        <group scale={1.15}>
          <RoundedBox args={[0.66, 0.34, 0.44]} radius={0.12} smoothness={2} bevelSegments={2}>
            <ToonMat color={color} />
          </RoundedBox>
          <RoundedBox args={[0.58, 0.2, 0.4]} radius={0.08} smoothness={2} bevelSegments={2} position={[0, 0.25, 0]}>
            <ToonMat color={tint(color, 0.9)} />
          </RoundedBox>
          <mesh position={[0, 0.38, 0.02]} scale={[1.3, 0.6, 1]}>
            <sphereGeometry args={[0.2, 12, 8]} />
            <ToonMat color="#fff6ec" />
          </mesh>
          {[-0.08, 0.1].map((y) => (
            <mesh key={y} position={[0, y, 0.23]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <ToonMat color="#ffd45a" />
            </mesh>
          ))}
        </group>
      )

    case 'cristal':
      // cristal gordinho, azul com irmãozinho rosa
      return (
        <group scale={1.1}>
          <mesh scale={[1, 1.35, 1]}>
            <octahedronGeometry args={[0.3, 0]} />
            <ToonMat color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.95} />
          </mesh>
          <mesh position={[0.24, -0.16, 0.05]} rotation={[0, 0, -0.4]} scale={[0.55, 0.8, 0.55]}>
            <octahedronGeometry args={[0.3, 0]} />
            <ToonMat color="#ffb7d6" emissive="#ff8fc0" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[-0.22, -0.2, -0.04]} rotation={[0, 0, 0.45]} scale={[0.45, 0.65, 0.45]}>
            <octahedronGeometry args={[0.3, 0]} />
            <ToonMat color="#dff4ff" emissive="#bfe8ff" emissiveIntensity={0.8} />
          </mesh>
        </group>
      )

    case 'binoculo':
      return (
        <group scale={1.15}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.15, 0, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.13, 0.15, 0.46, 14]} />
                <ToonMat color={color} />
              </mesh>
              <mesh position={[0, 0, 0.24]}>
                <torusGeometry args={[0.13, 0.04, 8, 14]} />
                <ToonMat color="#ffffff" />
              </mesh>
              <mesh position={[0, 0, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.03, 14]} />
                <ToonMat color="#bff4ff" emissive="#8fe8ff" emissiveIntensity={0.7} />
              </mesh>
            </group>
          ))}
          <RoundedBox args={[0.18, 0.16, 0.26]} radius={0.06} smoothness={2} bevelSegments={1}>
            <ToonMat color={tint(color, 0.85)} />
          </RoundedBox>
          <mesh position={[0, -0.08, -0.02]} rotation={[0.4, 0, 0]}>
            <torusGeometry args={[0.24, 0.03, 6, 16]} />
            <ToonMat color="#ff8fb8" />
          </mesh>
        </group>
      )

    case 'fungo_brilho':
      // cogumelo fofo que brilha, com pintinhas brancas
      return (
        <group scale={1.15}>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.1, 0.14, 0.3, 12]} />
            <ToonMat color="#fff3dc" />
          </mesh>
          <mesh position={[0, 0.06, 0]} scale={[1, 0.8, 1]}>
            <sphereGeometry args={[0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
            <ToonMat color={color} emissive={color} emissiveIntensity={0.85} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.19, 0.24, Math.sin(a) * 0.19]} scale={[1, 0.6, 1]}>
                <sphereGeometry args={[0.065, 8, 6]} />
                <ToonMat color="#ffffff" emissive="#e8fff0" emissiveIntensity={0.6} />
              </mesh>
            )
          })}
          <mesh position={[0, 0.31, 0]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <ToonMat color="#ffffff" emissive="#e8fff0" emissiveIntensity={0.6} />
          </mesh>
        </group>
      )

    case 'pena_coruja':
      // pena macia, creme com pontinha lilás
      return (
        <group rotation={[0.3, 0.2, 0.45]} scale={1.2}>
          <mesh position={[0, 0.06, 0]} scale={[0.32, 1, 0.1]}>
            <sphereGeometry args={[0.36, 14, 10]} />
            <ToonMat color={color} emissive="#f0d890" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0.3, 0.005]} scale={[0.26, 0.42, 0.11]}>
            <sphereGeometry args={[0.36, 12, 8]} />
            <ToonMat color="#c9b4ff" />
          </mesh>
          <mesh position={[0, -0.18, 0]}>
            <capsuleGeometry args={[0.025, 0.4, 3, 6]} />
            <ToonMat color="#fff6e6" />
          </mesh>
        </group>
      )

    default:
      return (
        <mesh>
          <octahedronGeometry args={[0.3, 0]} />
          <ToonMat color={color} emissive={color} emissiveIntensity={1} />
        </mesh>
      )
  }
}
