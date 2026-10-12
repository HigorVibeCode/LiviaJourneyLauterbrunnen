import { useMemo, useRef, useState } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useProgressStore, QUESTS, ITEMS, missingItems } from '../store/progressStore'
import { playerPosition } from '../store/playerStore'
import { guideInput } from '../lib/guideInput'
import { horseRide } from '../lib/horseRide'
import StaticBatch from './world/StaticBatch'
import { RoundedBox } from '@react-three/drei'
import { GATES } from '../config/world'
import { PAL } from '../config/palette'
import { heartGeometry, starGeometry, tint, pastelOf } from './world/cuteShapes'

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
  // já aberto no save: começa escancarado, sem refazer a cerimônia
  const openT = useRef(useProgressStore.getState().unlockedGates.includes(gateId) ? 1 : 0)
  const [passable, setPassable] = useState(() => openT.current >= 1)
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
  const look = gateLook(gateId, color)

  return (
    <group position={position}>
      <Post x={-width / 2 - 0.1} height={height} look={look} />
      <Post x={width / 2 + 0.1} height={height} look={look} />

      {/* travessa superior fixa (viga roliça) */}
      <StaticBatch>
        <RoundedBox args={[width + 0.9, 0.45, 0.6]} radius={0.2} smoothness={2} bevelSegments={2} position={[0, height + 0.15, 0]}>
          <ToonMat color={look.post} />
        </RoundedBox>
      </StaticBatch>

      {landmark && <GateLandmark width={width} height={height} color={color} look={look} />}

      {/* bloqueio físico: sai de cena quando as folhas abrem o bastante */}
      {!passable && (
        <RigidBody type="fixed" position={[0, height / 2, 0]} colliders={false}>
          <CuboidCollider args={[width / 2, height / 2, 0.28]} />
        </RigidBody>
      )}

      <group ref={shakeRef}>
        {/* folha esquerda (dobradiça no poste esquerdo) */}
        <group ref={leftRef} position={[-width / 2, 0, 0]}>
          <DoorLeaf width={leafW} height={height} look={look} hingeSide={1} />
        </group>
        {/* folha direita */}
        <group ref={rightRef} position={[width / 2, 0, 0]}>
          <DoorLeaf width={leafW} height={height} look={look} hingeSide={-1} />
        </group>
      </group>

      {/* fechadura: coração dourado gordinho — despenca quando destranca */}
      <group ref={lockRef} position={[0, height * 0.45, 0.28]}>
        <mesh geometry={heartGeometry()} scale={1.25} position={[0, 0, 0.12]}>
          <ToonMat color="#ffd45a" emissive="#ffb030" emissiveIntensity={0.35} />
        </mesh>
        {/* argola */}
        <mesh position={[0, 0.72, 0]}>
          <torusGeometry args={[0.3, 0.1, 8, 14, Math.PI]} />
          <ToonMat color="#f2c23e" />
        </mesh>
        {/* buraco da fechadura */}
        <mesh position={[0, 0.06, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.06, 10]} />
          <ToonMat color="#c98a2a" />
        </mesh>
        <mesh position={[0, -0.1, 0.36]}>
          <boxGeometry args={[0.08, 0.2, 0.06]} />
          <ToonMat color="#c98a2a" />
        </mesh>
        {/* brilhinho */}
        <mesh position={[-0.28, 0.25, 0.36]} scale={[1, 1.6, 0.4]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshBasicMaterial color="#fff8dc" />
        </mesh>
      </group>

      {/* clarão do destranque */}
      <pooledLight
        ref={flashRef}
        position={[0, height * 0.6, 1.2]}
        color="#ffd98a"
        intensity={0}
        distance={18}
        decay={2}
      />

      {/* poeira dos batentes (nuvenzinhas fofas) */}
      <group ref={dustRef} visible={false}>
        {dust.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.8, 8, 6]} />
            <meshBasicMaterial color={i % 3 ? '#fff6e6' : '#ffe0ec'} transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/**
 * Cores de cada portão: o `color` da config vira só uma dica de matiz —
 * a tinta sempre sai pastel e alegre, e o estilo muda postes/detalhes.
 */
function gateLook(gateId, color) {
  const style = GATES[gateId]?.style ?? 'wood'
  const paint = pastelOf(color, 0.85, 0.79)
  if (style === 'stone') {
    return { style, post: '#dfe5ee', postDark: '#c4cfdc', door: paint, trim: '#ffffff', cap: '#ffd45a' }
  }
  if (style === 'ice') {
    return { style, post: '#d4f1ff', postDark: '#aee0fb', door: '#e6f7ff', trim: '#9fd8f8', cap: '#bfeaff' }
  }
  return { style, post: PAL.wood, postDark: PAL.woodDark, door: paint, trim: '#ffffff', cap: '#ffd45a' }
}

/** Uma folha do portão: tábua pastel, frisos, moldura branca e coraçãozinho */
function DoorLeaf({ width, height, look, hingeSide }) {
  const cx = hingeSide * width * 0.5
  const plank = tint(look.door, 0.9)
  const h = height * 0.94
  return (
    <StaticBatch>
      <RoundedBox args={[width - 0.06, h, 0.32]} radius={0.14} smoothness={2} bevelSegments={2} position={[cx, height / 2, 0]}>
        <ToonMat color={look.door} />
      </RoundedBox>

      {/* tala central na folha direita: cobre a fresta entre as folhas
          (sem ela, a luz do outro lado vaza como uma linha brilhante) */}
      {hingeSide < 0 && (
        <RoundedBox args={[0.3, h, 0.44]} radius={0.12} smoothness={2} bevelSegments={2} position={[hingeSide * (width - 0.04), height / 2, 0]}>
          <ToonMat color={look.trim} />
        </RoundedBox>
      )}

      {/* frisos verticais das tábuas (dos dois lados) */}
      {Array.from({ length: 3 }, (_, i) =>
        [-1, 1].map((f) => (
          <RoundedBox
            key={`${i}${f}`}
            args={[0.16, h * 0.62, 0.08]}
            radius={0.03}
            smoothness={2}
            bevelSegments={1}
            position={[hingeSide * (0.62 + i * ((width - 1.2) / 2.6)), height * 0.4, f * 0.17]}
          >
            <ToonMat color={plank} />
          </RoundedBox>
        )),
      )}

      {/* moldura branca (topo + base) */}
      {[height * 0.9, height * 0.1].map((y) => (
        <RoundedBox key={y} args={[width - 0.3, 0.32, 0.42]} radius={0.12} smoothness={2} bevelSegments={2} position={[cx, y, 0]}>
          <ToonMat color={look.trim} />
        </RoundedBox>
      ))}

      {/* coraçãozinho / floco no alto da folha (dos dois lados) */}
      {[-1, 1].map((f) => (
        <mesh
          key={`h${f}`}
          geometry={look.style === 'ice' ? starGeometry() : heartGeometry()}
          position={[cx, height * 0.74, f * 0.2]}
          rotation={[0, f < 0 ? Math.PI : 0, 0]}
          scale={0.7}
        >
          <ToonMat color={look.style === 'ice' ? '#9fd8f8' : '#ff8fb8'} />
        </mesh>
      ))}

      {/* dobradiças douradas roliças */}
      {[height * 0.22, height * 0.62].map((y) => (
        <RoundedBox key={y} args={[0.7, 0.22, 0.44]} radius={0.1} smoothness={2} bevelSegments={1} position={[hingeSide * 0.38, y, 0]}>
          <ToonMat color="#ffd45a" />
        </RoundedBox>
      ))}
    </StaticBatch>
  )
}

/** Arco com guirlanda de flores, estrela no topo e lanterninhas */
function GateLandmark({ width, height, color, look }) {
  const t = useRef(0)
  const glowRef = useRef(null)
  useFrame((_, dt) => {
    t.current += dt
    if (glowRef.current) {
      glowRef.current.intensity = 1.8 + Math.sin(t.current * 2.4) * 0.7
    }
  })

  const archR = width / 2 + 0.25
  const archSY = 0.5
  // flores da guirlanda ao longo do arco
  const garland = useMemo(() => {
    const list = []
    const n = 15
    for (let i = 0; i < n; i++) {
      const a = 0.12 + (i / (n - 1)) * (Math.PI - 0.24)
      list.push({
        x: Math.cos(a) * archR,
        y: Math.sin(a) * archR * archSY,
        c: PAL.flowers[i % PAL.flowers.length],
        leaf: i % 2 === 0,
      })
    }
    return list
  }, [archR])

  return (
    <StaticBatch>
      {/* arco oval acima do vão */}
      <group position={[0, height + 0.35, 0]}>
        <mesh scale={[1, archSY, 1]}>
          <torusGeometry args={[archR, 0.32, 10, 28, Math.PI]} />
          <ToonMat color={look.post} />
        </mesh>
        {garland.map((g, i) => (
          <group key={i} position={[g.x, g.y, 0.32]}>
            <mesh>
              <sphereGeometry args={[0.36, 10, 8]} />
              <ToonMat color={g.c === '#ffffff' ? '#fff3f8' : g.c} />
            </mesh>
            <mesh position={[0, 0, 0.28]}>
              <sphereGeometry args={[0.13, 8, 6]} />
              <ToonMat color={PAL.flowerCenter} />
            </mesh>
            {g.leaf && (
              <mesh position={[0.35, -0.25, -0.05]} scale={[1.3, 0.7, 0.8]}>
                <sphereGeometry args={[0.24, 8, 6]} />
                <ToonMat color={PAL.leafLight} />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* placa redonda com a estrela dourada no topo */}
      <group position={[0, height + 0.35 + archR * archSY + 0.15, 0.1]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.95, 0.95, 0.35, 20]} />
          <ToonMat color="#ff8fb8" />
        </mesh>
        <mesh position={[0, 0, 0.12]}>
          <torusGeometry args={[0.95, 0.14, 8, 22]} />
          <ToonMat color="#ffffff" />
        </mesh>
        <mesh geometry={starGeometry()} position={[0, 0, 0.3]} scale={1.35}>
          <ToonMat color="#ffd45a" emissive="#ffb830" emissiveIntensity={0.55} />
        </mesh>
      </group>
      <pooledLight
        ref={glowRef}
        position={[0, height + 1.4, 1.6]}
        color="#ffd060"
        intensity={2.2}
        distance={28}
        decay={2}
      />

      {/* bandeirolas (varal de bandeirinhas) sob o arco */}
      {Array.from({ length: 9 }, (_, i) => {
        const k = (i + 0.5) / 9
        const x = (k - 0.5) * (width - 0.6)
        return (
          <mesh key={`b${i}`} position={[x, height - 0.4, 0.4]} rotation={[Math.PI, 0, 0]} scale={[1, 1, 0.3]}>
            <coneGeometry args={[0.36, 0.7, 3]} />
            <ToonMat color={PAL.flowers[(i * 2 + 1) % PAL.flowers.length] === '#ffffff' ? '#ff9fbf' : PAL.flowers[(i * 2 + 1) % PAL.flowers.length]} />
          </mesh>
        )
      })}

      {/* lanterninhas no alto dos postes */}
      {[-1, 1].map((s) => (
        <group key={`torch${s}`} position={[s * (width / 2 + 0.15), height + 0.55, 0.55]}>
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.24, 12, 10]} />
            <ToonMat color="#fff0b0" emissive="#ffc040" emissiveIntensity={1.2} />
          </mesh>
          <pooledLight position={[0, 0.4, 0.2]} color="#ffb060" intensity={1.1} distance={14} decay={2} />
        </group>
      ))}

      {/* anel no chão — marca o vão */}
      <mesh position={[0, 0.05, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[width * 0.35, width * 0.55, 24]} />
        <meshBasicMaterial color="#ffe07a" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, -0.2]} visible={false}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </StaticBatch>
  )
}

function Post({ x, height, look }) {
  return (
    <RigidBody type="fixed" position={[x, height / 2, 0]} colliders={false}>
      <CuboidCollider args={[0.2, height / 2 + 0.15, 0.2]} />
      <StaticBatch>
        {/* poste roliço */}
        <mesh>
          <cylinderGeometry args={[0.42, 0.48, height + 0.3, 14]} />
          <ToonMat color={look.post} />
        </mesh>
        {/* anéis decorativos */}
        {[-height / 2 + 0.3, height / 2 - 0.2].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[0.56, 0.56, 0.3, 14]} />
            <ToonMat color={look.postDark} />
          </mesh>
        ))}
        {/* bolinha no topo */}
        <mesh position={[0, height / 2 + 0.55, 0]}>
          <sphereGeometry args={[0.5, 14, 10]} />
          <ToonMat color={look.cap} emissive={look.cap} emissiveIntensity={0.25} />
        </mesh>
      </StaticBatch>
    </RigidBody>
  )
}

function easeInOutCubic(x) {
  const k = Math.min(1, Math.max(0, x))
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}
