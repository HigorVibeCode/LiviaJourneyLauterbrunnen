import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import {
  RIVER,
  STAIRS,
  STREAMS,
  PONDS,
  SUMMIT_Y,
  SUMMIT_HALF_X,
  VALLEY_HALF_X,
  CORRIDOR_HALF,
  TREASURE_POS,
  CLIMB_STREAM,
  makeRng,
  pathXAt,
  resolveOnPath,
} from '../../config/world'
import { useProgressStore } from '../../store/progressStore'
import { playerPosition } from '../../store/playerStore'
import Instanced from './Instanced'

/** Muro de pedra/madeira ao lado do portão, fechando a passagem */
export function BarrierWall({ z, gateWidth, halfWidth, height = 6, y = 0, color = '#6B4423' }) {
  const gapHalf = gateWidth / 2
  const segLen = halfWidth - gapHalf

  if (segLen <= 0) return null

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider
          position={[-(gapHalf + segLen / 2), y + height / 2, z]}
          args={[segLen / 2, height / 2, 0.6]}
        />
        <CuboidCollider
          position={[gapHalf + segLen / 2, y + height / 2, z]}
          args={[segLen / 2, height / 2, 0.6]}
        />
      </RigidBody>

      {[-1, 1].map((side) => {
        const panels = Math.max(3, Math.round(segLen / 5))
        return Array.from({ length: panels }, (_, i) => {
          const t = (i + 0.5) / panels
          const x = side * (gapHalf + segLen * t)
          const h = height - (i % 2) * 0.4
          return (
            <group key={`${side}-${i}`}>
              <mesh position={[x, y + h / 2, z]} castShadow receiveShadow>
                <boxGeometry args={[segLen / panels + 0.1, h, 1]} />
                <meshStandardMaterial color={i % 2 ? shade(color, -16) : color} flatShading roughness={0.95} />
              </mesh>
              <mesh position={[x, y + h + 0.25, z]} castShadow>
                <boxGeometry args={[segLen / panels + 0.4, 0.4, 1.5]} />
                <meshStandardMaterial color={shade(color, -30)} flatShading />
              </mesh>
            </group>
          )
        })
      })}
    </group>
  )
}

/**
 * Ponte de madeira sobre o desfiladeiro.
 * O tabuleiro é rente ao solo e avança 4 unidades dentro de cada margem —
 * foi o que resolveu o bug de "cair ao entrar na ponte".
 */
export function WoodenBridge() {
  const zMid = (RIVER.zFrom + RIVER.zTo) / 2
  const px = pathXAt(zMid)
  const halfZ = Math.abs(RIVER.zTo - RIVER.zFrom) / 2 + 4
  const halfX = 5.4
  const planks = Math.round(halfZ * 2 / 1.6)

  return (
    <group position={[px, 0, 0]}>
      <RigidBody type="fixed" colliders={false} friction={1.4}>
        {/* tabuleiro (topo em y = 0.02, sem degrau nas margens) */}
        <CuboidCollider position={[0, -0.28, zMid]} args={[halfX, 0.3, halfZ]} />
        {/* guarda-corpos */}
        <CuboidCollider position={[-halfX - 0.2, 0.7, zMid]} args={[0.25, 0.7, halfZ]} />
        <CuboidCollider position={[halfX + 0.2, 0.7, zMid]} args={[0.25, 0.7, halfZ]} />
      </RigidBody>

      {/* pranchas */}
      {Array.from({ length: planks }, (_, i) => (
        <mesh
          key={i}
          position={[0, 0.0, zMid - halfZ + 0.8 + i * 1.6]}
          receiveShadow
          castShadow
        >
          <boxGeometry args={[halfX * 2, 0.16, 1.45]} />
          <meshStandardMaterial color={i % 2 ? '#8a5a32' : '#6b4a2c'} flatShading roughness={0.95} />
        </mesh>
      ))}

      {/* vigas longitudinais */}
      {[-halfX + 0.6, halfX - 0.6].map((x) => (
        <mesh key={x} position={[x, -0.22, zMid]} castShadow>
          <boxGeometry args={[0.5, 0.4, halfZ * 2]} />
          <meshStandardMaterial color="#54381f" flatShading />
        </mesh>
      ))}

      {/* postes + corrimão */}
      {Array.from({ length: 15 }, (_, i) => {
        const z = zMid - halfZ + 1.5 + i * ((halfZ * 2 - 3) / 14)
        return [-1, 1].map((side) => (
          <mesh key={`${i}-${side}`} position={[side * (halfX + 0.2), 0.75, z]} castShadow>
            <boxGeometry args={[0.28, 1.5, 0.28]} />
            <meshStandardMaterial color="#54381f" flatShading />
          </mesh>
        ))
      })}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (halfX + 0.2), 1.45, zMid]} castShadow>
          <boxGeometry args={[0.34, 0.22, halfZ * 2 - 1]} />
          <meshStandardMaterial color="#6b4a2c" flatShading />
        </mesh>
      ))}

      {/* pilares no desfiladeiro */}
      {[-0.45, 0.45].map((f) => (
        <mesh key={f} position={[0, -1.8, zMid + f * halfZ * 0.9]} castShadow>
          <boxGeometry args={[halfX * 1.6, 3.2, 1.4]} />
          <meshStandardMaterial color="#5c4028" flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** Rio no fundo do desfiladeiro — só visual, cair nele leva ao respawn */
export function RiverWater() {
  const ref = useRef(null)
  const zMid = (RIVER.zFrom + RIVER.zTo) / 2
  const px = pathXAt(zMid)
  const len = Math.abs(RIVER.zTo - RIVER.zFrom) + 26

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.position.y = RIVER.waterY + Math.sin(t * 0.8) * 0.12
    ref.current.children.forEach((child, i) => {
      child.position.z = ((t * (2 + i) + i * 9) % len) - len / 2
    })
  })

  return (
    <group position={[px, 0, 0]}>
      <mesh position={[0, RIVER.waterY, zMid]} receiveShadow>
        <boxGeometry args={[RIVER.gapHalfX * 2, 1.2, len]} />
        <meshStandardMaterial
          color="#4a8ea8"
          flatShading
          transparent
          opacity={0.88}
          roughness={0.12}
          metalness={0.22}
        />
      </mesh>
      {/* espuma correndo */}
      <group ref={ref} position={[0, RIVER.waterY, zMid]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[(i % 3 - 1) * 3.5, 0.65, 0]}>
            <boxGeometry args={[2.4, 0.14, 3.5]} />
            <meshStandardMaterial color="#e8f6ff" flatShading transparent opacity={0.55} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {/* paredes do desfiladeiro */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (RIVER.gapHalfX + 0.6), -1.6, zMid]} receiveShadow>
          <boxGeometry args={[1.6, 4, len - 20]} />
          <meshStandardMaterial color="#6a7078" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Rampa invisível sobre os degraus.
 * Uma cápsula dinâmica trava em quinas verticais de 0.5 — era exatamente o
 * bug de "não consigo subir a escada do mirante". A colisão passa a ser um
 * plano inclinado; os degraus continuam existindo só visualmente.
 */
const RAMP = (() => {
  const zBottom = STAIRS.zStart + STAIRS.stepDepth * 0.72
  const zTop = STAIRS.zStart - (STAIRS.steps - 1) * STAIRS.stepDepth
  const slope = SUMMIT_Y / (zBottom - zTop)
  const pad = 2

  const az = zBottom + pad
  const ay = -slope * pad
  const bz = zTop
  const by = SUMMIT_Y

  const len = Math.hypot(bz - az, by - ay)
  const angle = Math.asin((by - ay) / len)
  const halfY = 1

  return {
    angle,
    halfY,
    halfLen: len / 2,
    y: (ay + by) / 2 - halfY * Math.cos(angle),
    z: (az + bz) / 2 - halfY * Math.sin(angle),
  }
})()

/** Escadaria monumental — visual instanciado; 1 rampa Rapier; poucas luzes. */
export function SummitStairs() {
  const stairsLen = (STAIRS.steps - 1) * STAIRS.stepDepth
  const midZ = STAIRS.zStart - stairsLen / 2

  const geos = useMemo(
    () => ({
      step: new THREE.BoxGeometry(STAIRS.halfWidth * 2, STAIRS.stepRise * 0.92, STAIRS.stepDepth * 0.92),
      landing: new THREE.BoxGeometry(STAIRS.halfWidth * 2.15, 0.28, STAIRS.stepDepth * 2.4),
      dirt: new THREE.BoxGeometry(4.2, 0.12, STAIRS.stepDepth * 1.1),
      snow: new THREE.BoxGeometry(1, 0.08, 1),
      pillar: new THREE.CylinderGeometry(0.5, 0.65, 1, 6),
      cap: new THREE.BoxGeometry(1.3, 0.35, 1.3),
      lantern: new THREE.SphereGeometry(0.28, 5, 4),
      rock: new THREE.DodecahedronGeometry(0.9, 0),
      tuft: new THREE.ConeGeometry(0.35, 0.9, 5),
      flagPole: new THREE.CylinderGeometry(0.07, 0.09, 2.8, 5),
      flag: new THREE.BoxGeometry(1.1, 0.7, 0.05),
      bench: new THREE.BoxGeometry(2.4, 0.28, 0.7),
      crate: new THREE.BoxGeometry(0.9, 0.9, 0.9),
      cairn: new THREE.DodecahedronGeometry(0.45, 0),
      rope: new THREE.CylinderGeometry(0.04, 0.04, 1, 4),
      post: new THREE.CylinderGeometry(0.12, 0.14, 1.4, 5),
      shrine: new THREE.BoxGeometry(1.4, 2.2, 1.1),
      shrineCap: new THREE.ConeGeometry(1.0, 1.1, 4),
    }),
    [],
  )

  // materiais base brancos quando há instanceColor — evita tint errado / z-fight
  const mats = useMemo(
    () => ({
      step: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }),
      landing: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }),
      dirt: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }),
      snow: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.72 }),
      pillar: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }),
      cap: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }),
      lantern: new THREE.MeshStandardMaterial({
        color: '#ffcc88',
        emissive: '#ffaa44',
        emissiveIntensity: 1.35,
        flatShading: true,
      }),
      rock: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }),
      tuft: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.95 }),
      flagPole: new THREE.MeshStandardMaterial({ color: '#6a5a3a', flatShading: true }),
      flag: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true }),
      wood: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 }),
      rope: new THREE.MeshStandardMaterial({ color: '#c4a574', flatShading: true, roughness: 0.85 }),
      shrine: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }),
    }),
    [],
  )

  const batches = useMemo(() => {
    const rng = makeRng(9091)
    const steps = []
    const landings = []
    const dirt = []
    const snow = []
    const pillars = []
    const caps = []
    const lanterns = []
    const rocks = []
    const tufts = []
    const flags = []
    const flagPoles = []
    const benches = []
    const crates = []
    const cairns = []
    const ropes = []
    const posts = []
    const shrines = []
    const shrineCaps = []

    const stoneA = ['#8a8e94', '#7e8288', '#92969c', '#767a80', '#848990']
    const stoneB = ['#6e7278', '#64686e', '#787c82', '#5e6268']
    // neve mais “suja”/azulada — evita placas brancas que parecem bug
    const snowC = ['#d4dee8', '#c8d6e2', '#dce6ee', '#b9c9d6']

    for (let i = 0; i < STAIRS.steps; i++) {
      const z = STAIRS.zStart - i * STAIRS.stepDepth
      const top = (i + 1) * STAIRS.stepRise
      const isLanding = i > 0 && i % 6 === 0

      if (isLanding) {
        landings.push({
          x: 0,
          y: top + 0.02,
          z: z + STAIRS.stepDepth * 0.35,
          color: stoneA[i % stoneA.length],
        })
        for (const side of [-1, 1]) {
          benches.push({
            x: side * 9.5,
            y: top + 0.28,
            z: z + STAIRS.stepDepth * 0.15,
            color: '#7a5a32',
            ry: side > 0 ? -0.12 : 0.12,
          })
          crates.push({
            x: side * (7 + rng() * 2),
            y: top + 0.55,
            z: z - 0.3 + rng() * 0.5,
            color: rng() > 0.5 ? '#8a6238' : '#6e4e2c',
            ry: rng() * 0.8,
            s: 0.85 + rng() * 0.3,
          })
          // postes de lanterna DENTRO do corredor (visíveis de baixo)
          posts.push({ x: side * 6.5, y: top + 1.1, z: z + 0.8, color: '#4a3a28', sy: 2.2 })
          lanterns.push({ x: side * 6.5, y: top + 2.4, z: z + 0.8 })
          flagPoles.push({ x: side * 8.5, y: top + 2.4, z: z + 1.2 })
          flags.push({
            x: side * 8.5 + side * 0.55,
            y: top + 3.3,
            z: z + 1.2,
            color: side < 0 ? '#c43a3a' : '#3a6a9a',
          })
        }
        const shrineSide = i % 12 === 0 ? -1 : 1
        shrines.push({ x: shrineSide * 5.5, y: top + 1.2, z: z + 0.6, color: '#5c6066' })
        shrineCaps.push({ x: shrineSide * 5.5, y: top + 2.7, z: z + 0.6, color: '#3e4248' })
        for (const side of [-1, 1]) {
          snow.push({
            x: side * (STAIRS.halfWidth - 4 - rng() * 2),
            y: top + 0.07,
            z: z + (rng() - 0.2) * STAIRS.stepDepth * 0.6,
            sx: 1.2 + rng() * 1.4,
            sz: 0.8 + rng(),
            sy: 0.65,
            color: snowC[i % snowC.length],
            ry: rng() * 0.8,
          })
        }
      } else {
        // alguns degraus com tom nevado embutido (sem placa flutuante)
        const snowy = rng() > 0.72
        steps.push({
          x: (rng() - 0.5) * 0.12,
          y: top - STAIRS.stepRise / 2 + 0.02,
          z,
          color: snowy ? '#aeb8c2' : stoneA[(i + Math.floor(rng() * 3)) % stoneA.length],
          ry: (rng() - 0.5) * 0.02,
        })
      }

      // neve só nas beiradas externas
      if (i % 2 === 0) {
        const side = i % 4 === 0 ? -1 : 1
        snow.push({
          x: side * (STAIRS.halfWidth - 2.5 - rng() * 2),
          y: top + 0.07,
          z: z + (rng() - 0.5) * 0.5,
          sx: 1.0 + rng() * 1.2,
          sz: 0.6 + rng() * 0.7,
          sy: 0.6,
          color: snowC[i % snowC.length],
          ry: rng() * 0.5,
        })
      }

      if (i % 2 === 0) {
        const side = i % 4 === 0 ? -1 : 1
        dirt.push({
          x: side * (STAIRS.halfWidth * 0.62),
          y: top + 0.04,
          z: z + 0.2,
          color: i % 4 === 0 ? '#7a6a48' : '#6e6240',
          ry: side * 0.08,
        })
      }

      // marcadores verticais no corredor (visíveis olhando para cima)
      if (i % 3 === 1) {
        const side = i % 6 < 3 ? -1 : 1
        posts.push({ x: side * 5.2, y: top + 1.0, z, color: '#5a4630', sy: 1.9 })
        lanterns.push({ x: side * 5.2, y: top + 2.15, z })
      }

      if (i % 2 === 1) {
        const side = i % 4 === 1 ? -1 : 1
        rocks.push({
          x: side * (6.5 + rng() * 4),
          y: top + 0.28,
          z: z + (rng() - 0.5) * 0.8,
          ry: rng() * Math.PI,
          sx: 0.6 + rng() * 0.5,
          sy: 0.4 + rng() * 0.35,
          sz: 0.55 + rng() * 0.4,
          color: stoneB[i % stoneB.length],
        })
        tufts.push({
          x: side * (8 + rng() * 5),
          y: top + 0.42,
          z: z + (rng() - 0.5),
          color: rng() > 0.5 ? '#6a8a58' : '#8a9a6a',
          s: 0.55 + rng() * 0.55,
        })
      }

      if (i % 4 === 2) {
        const side = i % 8 < 4 ? -1 : 1
        const cx = side * (5.5 + rng() * 3)
        cairns.push({ x: cx, y: top + 0.35, z, color: stoneB[(i + 1) % stoneB.length], s: 0.8 + rng() * 0.4 })
        cairns.push({ x: cx, y: top + 0.75, z, color: stoneA[i % stoneA.length], s: 0.55 + rng() * 0.25 })
        cairns.push({ x: cx, y: top + 1.05, z, color: stoneB[i % stoneB.length], s: 0.35 + rng() * 0.15 })
      }

      if (i % 3 === 0) {
        const pillarH = top + 2.8
        for (const side of [-1, 1]) {
          const x = side * (STAIRS.halfWidth + 1.6)
          pillars.push({
            x,
            y: pillarH / 2,
            z,
            sy: pillarH,
            color: stoneB[(i + (side > 0 ? 1 : 0)) % stoneB.length],
          })
          caps.push({ x, y: top + 2.9, z, color: '#5a5e64' })
          snow.push({
            x,
            y: top + 3.12,
            z,
            sx: 1.35,
            sz: 1.35,
            sy: 0.55,
            color: '#d4dee8',
            ry: 0,
          })
          lanterns.push({ x, y: top + 3.4, z })
          if (i > 0 && i < STAIRS.steps - 3) {
            posts.push({ x: side * (STAIRS.halfWidth - 0.8), y: top + 0.7, z, color: '#5a4630' })
            ropes.push({
              x: side * (STAIRS.halfWidth - 0.8),
              y: top + 1.15 - STAIRS.stepRise * 1.5,
              z: z - STAIRS.stepDepth * 1.5,
              sy: STAIRS.stepDepth * 3.05,
              rx: Math.PI / 2 - RAMP.angle,
            })
          }
        }
      }

      if (i % 6 === 0 && i > 0 && i < STAIRS.steps - 1) {
        for (const side of [-1, 1]) {
          const x = side * (STAIRS.halfWidth - 1.4)
          flagPoles.push({ x, y: top + 2.6, z })
          flags.push({
            x: x + side * 0.55,
            y: top + 3.5,
            z,
            color: i % 12 === 0 ? '#c43a3a' : i % 12 === 6 ? '#f0e6d0' : '#3a6a9a',
          })
        }
      }
    }

    // encostas laterais densas
    for (let i = 0; i < 56; i++) {
      const t = (i + 0.5) / 56
      const side = i % 2 === 0 ? -1 : 1
      const y = t * SUMMIT_Y + 0.35
      const z = STAIRS.zStart - t * stairsLen
      rocks.push({
        x: side * (STAIRS.halfWidth + 2.2 + (i % 5) * 0.9 + rng() * 1.5),
        y,
        z: z + (rng() - 0.5) * 1.6,
        ry: rng() * Math.PI,
        sx: 0.85 + (i % 4) * 0.4,
        sy: 0.5 + (i % 3) * 0.32,
        sz: 0.8 + (i % 2) * 0.35,
        color: stoneB[i % stoneB.length],
      })
      if (i % 2 === 0) {
        tufts.push({
          x: side * (STAIRS.halfWidth + 3.6 + (i % 3) * 0.8),
          y: y + 0.35,
          z: z + (rng() - 0.5) * 2,
          color: i % 4 === 0 ? '#5a8a4a' : i % 4 === 1 ? '#8a9a68' : '#6a9a58',
          s: 0.7 + rng() * 0.7,
        })
      }
      if (i % 3 === 0) {
        snow.push({
          x: side * (STAIRS.halfWidth + 2.8 + rng() * 2.2),
          y: y + 0.05,
          z: z + (rng() - 0.5) * 2,
          sx: 1.4 + rng() * 1.6,
          sz: 1.1 + rng() * 1.4,
          sy: 0.7,
          color: snowC[i % snowC.length],
          ry: rng() * Math.PI,
        })
      }
    }

    return {
      steps,
      landings,
      dirt,
      snow,
      pillars,
      caps,
      lanterns,
      rocks,
      tufts,
      flags,
      flagPoles,
      benches,
      crates,
      cairns,
      ropes,
      posts,
      shrines,
      shrineCaps,
    }
  }, [stairsLen])

  const midLightZ = STAIRS.zStart - stairsLen * 0.45
  const midLightY = SUMMIT_Y * 0.45 + 3.4
  const topArchZ = STAIRS.zStart - (STAIRS.steps - 1) * STAIRS.stepDepth
  const topArchY = STAIRS.steps * STAIRS.stepRise

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={1.5}>
        <CuboidCollider
          position={[0, RAMP.y, RAMP.z]}
          rotation={[RAMP.angle, 0, 0]}
          args={[STAIRS.halfWidth, RAMP.halfY, RAMP.halfLen]}
        />
        <CuboidCollider
          position={[-STAIRS.halfWidth - 0.7, SUMMIT_Y / 2 + 0.8, midZ]}
          args={[0.7, SUMMIT_Y / 2 + 0.8, stairsLen / 2 + 2]}
        />
        <CuboidCollider
          position={[STAIRS.halfWidth + 0.7, SUMMIT_Y / 2 + 0.8, midZ]}
          args={[0.7, SUMMIT_Y / 2 + 0.8, stairsLen / 2 + 2]}
        />
      </RigidBody>

      <Instanced geometry={geos.step} material={mats.step} items={batches.steps} castShadow={false} />
      <Instanced
        geometry={geos.landing}
        material={mats.landing}
        items={batches.landings}
        castShadow={false}
      />
      <Instanced geometry={geos.dirt} material={mats.dirt} items={batches.dirt} castShadow={false} />
      <Instanced geometry={geos.snow} material={mats.snow} items={batches.snow} castShadow={false} />
      <Instanced
        geometry={geos.pillar}
        material={mats.pillar}
        items={batches.pillars}
        castShadow={false}
      />
      <Instanced geometry={geos.cap} material={mats.cap} items={batches.caps} castShadow={false} />
      <Instanced
        geometry={geos.lantern}
        material={mats.lantern}
        items={batches.lanterns}
        castShadow={false}
        receiveShadow={false}
      />
      <Instanced geometry={geos.rock} material={mats.rock} items={batches.rocks} castShadow={false} />
      <Instanced geometry={geos.tuft} material={mats.tuft} items={batches.tufts} castShadow={false} />
      <Instanced
        geometry={geos.flagPole}
        material={mats.flagPole}
        items={batches.flagPoles}
        castShadow={false}
      />
      <Instanced geometry={geos.flag} material={mats.flag} items={batches.flags} castShadow={false} />
      <Instanced geometry={geos.bench} material={mats.wood} items={batches.benches} castShadow={false} />
      <Instanced geometry={geos.crate} material={mats.wood} items={batches.crates} castShadow={false} />
      <Instanced geometry={geos.cairn} material={mats.rock} items={batches.cairns} castShadow={false} />
      <Instanced geometry={geos.post} material={mats.wood} items={batches.posts} castShadow={false} />
      <Instanced geometry={geos.rope} material={mats.rope} items={batches.ropes} castShadow={false} />
      <Instanced geometry={geos.shrine} material={mats.shrine} items={batches.shrines} castShadow={false} />
      <Instanced
        geometry={geos.shrineCap}
        material={mats.shrine}
        items={batches.shrineCaps}
        castShadow={false}
      />

      <ClimbStream stairsLen={stairsLen} />

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (STAIRS.halfWidth + 0.7), SUMMIT_Y / 2 + 0.8, midZ]}
          receiveShadow
        >
          <boxGeometry args={[1.4, SUMMIT_Y + 1.6, stairsLen + 4]} />
          <meshStandardMaterial color="#75787d" flatShading roughness={1} />
        </mesh>
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={`handrail-${side}`}
          position={[side * (STAIRS.halfWidth - 0.35), SUMMIT_Y / 2 + 1.1, midZ]}
          rotation={[RAMP.angle, 0, 0]}
        >
          <boxGeometry args={[0.22, 0.2, stairsLen + 2]} />
          <meshStandardMaterial color="#8a6a3a" flatShading roughness={0.75} />
        </mesh>
      ))}

      {[0, STAIRS.steps - 1].map((i) => {
        const z = STAIRS.zStart - i * STAIRS.stepDepth
        const y = (i + 1) * STAIRS.stepRise
        const isTop = i === STAIRS.steps - 1
        return (
          <group key={`arch-${i}`} position={[0, y, z]}>
            {[-1, 1].map((side) => (
              <group key={side}>
                <mesh castShadow={isTop} position={[side * (STAIRS.halfWidth - 1.2), 4.2, 0]}>
                  <boxGeometry args={[1.6, 8.4, 2.0]} />
                  <meshStandardMaterial color="#5c6066" flatShading roughness={1} />
                </mesh>
                <mesh position={[side * (STAIRS.halfWidth - 1.2), 8.6, 0]}>
                  <boxGeometry args={[2.2, 0.7, 2.4]} />
                  <meshStandardMaterial color="#4a4e54" flatShading roughness={1} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 8.8, 0]}>
              <boxGeometry args={[STAIRS.halfWidth * 2 - 0.4, 1.4, 2.2]} />
              <meshStandardMaterial color="#4a4e54" flatShading roughness={1} />
            </mesh>
            {isTop && (
              <mesh position={[0, 10.4, 0]}>
                <coneGeometry args={[STAIRS.halfWidth * 0.55, 2.4, 3]} />
                <meshStandardMaterial color="#3e4248" flatShading roughness={1} />
              </mesh>
            )}
            {[-1, 1].map((side) => (
              <group key={`flag-${side}`} position={[side * (STAIRS.halfWidth - 1.2), 9.2, 0.3]}>
                <mesh>
                  <cylinderGeometry args={[0.08, 0.1, 3.2, 5]} />
                  <meshStandardMaterial color="#6a5a3a" flatShading />
                </mesh>
                <mesh position={[side * 0.7, 0.9, 0]}>
                  <boxGeometry args={[1.4, 0.9, 0.06]} />
                  <meshStandardMaterial color={isTop ? '#c43a3a' : '#3a6a9a'} flatShading />
                </mesh>
              </group>
            ))}
          </group>
        )
      })}

      <pointLight
        position={[STAIRS.halfWidth + 1.6, midLightY, midLightZ]}
        color="#ffcc88"
        intensity={4}
        distance={22}
        decay={2}
      />
      <pointLight
        position={[0, topArchY + 6.5, topArchZ + 1.5]}
        color="#ffcc88"
        intensity={5}
        distance={20}
        decay={2}
      />
    </group>
  )
}

/** Riacho que desce ao lado da escadaria — segmentos instanciados + espuma leve */
function ClimbStream({ stairsLen }) {
  const foamRef = useRef(null)
  const segs = useMemo(() => {
    const list = []
    const n = 18
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const z = STAIRS.zStart - t * stairsLen
      const y = t * SUMMIT_Y + 0.08
      list.push({
        x: CLIMB_STREAM.x,
        y,
        z,
        color: i % 2 ? CLIMB_STREAM.color : '#5a9ab0',
        sy: 0.16,
        sx: CLIMB_STREAM.halfWidth * 2,
        sz: stairsLen / n + 0.4,
      })
    }
    return list
  }, [stairsLen])

  const bed = useMemo(
    () =>
      segs.map((s) => ({
        ...s,
        y: s.y - 0.12,
        color: '#5a6058',
        sy: 0.22,
        sx: CLIMB_STREAM.halfWidth * 2 + 1.1,
      })),
    [segs],
  )

  const geos = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      water: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        flatShading: true,
        transparent: true,
        opacity: 0.82,
        roughness: 0.12,
        metalness: 0.35,
        depthWrite: false,
      }),
      bed: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }),
    }),
    [],
  )

  useFrame((state) => {
    if (!foamRef.current) return
    const t = state.clock.elapsedTime
    foamRef.current.children.forEach((c, i) => {
      c.position.y = segs[i]?.y + 0.1 + Math.sin(t * 3 + i) * 0.03
      c.material.opacity = 0.35 + Math.sin(t * 4 + i * 0.7) * 0.15
    })
  })

  return (
    <group>
      <Instanced geometry={geos.box} material={mats.bed} items={bed} castShadow={false} />
      <Instanced geometry={geos.box} material={mats.water} items={segs} castShadow={false} receiveShadow={false} />
      <group ref={foamRef}>
        {segs.map((s, i) =>
          i % 2 === 0 ? (
            <mesh key={i} position={[s.x, s.y + 0.1, s.z]}>
              <boxGeometry args={[CLIMB_STREAM.halfWidth * 1.2, 0.06, 1.2]} />
              <meshStandardMaterial
                color="#e4f6fc"
                flatShading
                transparent
                opacity={0.45}
                depthWrite={false}
              />
            </mesh>
          ) : null,
        )}
      </group>
    </group>
  )
}

/** Tesouro do mirante — objetivo final */
export function SummitTreasure() {
  const lidRef = useRef(null)
  const glowRef = useRef(null)
  const beamRef = useRef(null)
  const sparksRef = useRef(null)
  const finishedAtRef = useRef(0)
  const finished = useProgressStore((s) => s.finished)
  const finalePhase = useProgressStore((s) => s.finalePhase)
  const startFinale = useProgressStore((s) => s.startFinale)
  const celebrating = Boolean(finished || finalePhase)
  const position = [TREASURE_POS.x, TREASURE_POS.y, TREASURE_POS.z]

  const sparks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        angle: (i / 26) * Math.PI * 2,
        radius: 0.6 + (i % 5) * 0.35,
        speed: 1.6 + (i % 4) * 0.55,
        phase: i * 0.47,
        size: 0.08 + (i % 3) * 0.05,
      })),
    [],
  )

  // geometria com a base no zero: escalar em Y faz o feixe "crescer" do baú
  const beamGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.5, 1.3, 26, 8, 1, true)
    geo.translate(0, 13, 0)
    return geo
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (lidRef.current) {
      lidRef.current.rotation.x = THREE.MathUtils.lerp(
        lidRef.current.rotation.x,
        celebrating ? -1.1 : 0,
        0.05,
      )
    }

    // ── Celebração: feixe dourado + espiral de fagulhas ──
    if (celebrating && finishedAtRef.current === 0) finishedAtRef.current = t
    const since = finishedAtRef.current ? t - finishedAtRef.current : 0

    if (beamRef.current) {
      const grow = Math.min(1, since / 1.6)
      beamRef.current.visible = celebrating
      beamRef.current.scale.set(1, grow, 1)
      if (celebrating) {
        beamRef.current.material.opacity = 0.16 + Math.sin(t * 2.6) * 0.06
        beamRef.current.rotation.y = t * 0.5
      }
    }

    if (sparksRef.current) {
      sparksRef.current.visible = celebrating
      if (celebrating) {
        const children = sparksRef.current.children
        for (let i = 0; i < children.length; i++) {
          const s = sparks[i]
          const local = (t * s.speed + s.phase) % 6
          const rise = local * 1.5
          const r = s.radius + local * 0.35
          children[i].position.set(
            Math.cos(s.angle + t * 1.2) * r,
            1.4 + rise,
            Math.sin(s.angle + t * 1.2) * r,
          )
          const fade = Math.max(0, 1 - rise / 9)
          children[i].scale.setScalar(s.size * (0.6 + fade))
          children[i].material.opacity = fade
        }
      }
    }

    // cristal do baú: flutua; some quando a Livia pega
    if (glowRef.current) {
      const grabbed = finalePhase && finalePhase !== 'pickup'
      glowRef.current.visible = !grabbed && !finished
      glowRef.current.rotation.y = t * 1.2
      if (finalePhase === 'pickup') {
        const grab = Math.min(1, since / 1.8)
        glowRef.current.position.y = 1.8 + grab * 0.6
        glowRef.current.scale.setScalar(Math.max(0.05, 1 - grab * 0.95))
      } else {
        glowRef.current.position.y = 1.8 + Math.sin(t * 1.8) * 0.2
        glowRef.current.scale.setScalar(1)
      }
    }

    if (celebrating) return
    const d = Math.hypot(
      playerPosition.x - position[0],
      playerPosition.z - position[2],
    )
    if (d < 4) startFinale()
  })

  return (
    <group position={position}>
      {/* pedestal */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0, 0.3, 0]} args={[2, 0.3, 1.6]} />
      </RigidBody>
      <mesh position={[0, 0.3, 0]} receiveShadow castShadow>
        <boxGeometry args={[4, 0.6, 3.2]} />
        <meshStandardMaterial color="#8d9096" flatShading roughness={1} />
      </mesh>

      {/* baú */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[2.2, 1.1, 1.5]} />
        <meshStandardMaterial color="#6b4a2c" flatShading />
      </mesh>
      <group ref={lidRef} position={[0, 1.65, -0.75]}>
        <mesh position={[0, 0.12, 0.75]} castShadow>
          <boxGeometry args={[2.25, 0.3, 1.55]} />
          <meshStandardMaterial color="#54381f" flatShading />
        </mesh>
      </group>
      <mesh position={[0, 1.1, 0.78]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.12]} />
        <meshStandardMaterial color="#e8c84a" flatShading metalness={0.6} roughness={0.3} />
      </mesh>

      {/* brilho do tesouro */}
      <mesh ref={glowRef} position={[0, 1.8, 0]}>
        <octahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial
          color="#ffe08a"
          emissive="#ffc84a"
          emissiveIntensity={1.8}
          flatShading
        />
      </mesh>
      <pointLight position={[0, 2.2, 0]} color="#ffcc66" intensity={7} distance={12} decay={2} />

      {/* feixe dourado que sobe ao abrir o baú */}
      <mesh ref={beamRef} visible={false} position={[0, 1.4, 0]} geometry={beamGeo}>
        <meshBasicMaterial
          color="#ffd77a"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* fagulhas em espiral */}
      <group ref={sparksRef} visible={false}>
        {sparks.map((s, i) => (
          <mesh key={i}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={i % 2 ? '#ffd76a' : '#fff3c4'} transparent depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* mira/telescópio + bandeiras */}
      <group position={[8, 0, 4]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.2, 1.4, 6]} />
          <meshStandardMaterial color="#4a4a48" flatShading metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.5, 0.3]} rotation={[0.5, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.24, 1.1, 8]} />
          <meshStandardMaterial color="#2f2f2e" flatShading metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
      {[
        [-10, 3],
        [12, -2],
        [-14, -6],
      ].map(([fx, fz], i) => (
        <group key={`flag-${i}`} position={[fx, 0, fz]}>
          <mesh position={[0, 3.2, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.13, 6.4, 6]} />
            <meshStandardMaterial color="#8a8a86" flatShading metalness={0.4} />
          </mesh>
          <mesh position={[1.15, 5.5, 0]} castShadow>
            <boxGeometry args={[2.2, 1.35, 0.08]} />
            <meshStandardMaterial color={i === 1 ? '#3a6a9a' : '#d43a3a'} flatShading />
          </mesh>
          <mesh position={[1.15, 5.5, 0.06]}>
            <boxGeometry args={[0.85, 0.28, 0.05]} />
            <meshStandardMaterial color="#f4f4f0" flatShading />
          </mesh>
        </group>
      ))}

      {/* pilares do platô — emissive; 2 pointLights no máximo */}
      {[
        [-18, -10],
        [18, -10],
        [-22, 6],
        [22, 6],
        [-12, 14],
        [12, 14],
        [0, -18],
      ].map(([px, pz], i) => (
        <group key={`pillar-${i}`} position={[px, 0, pz]}>
          <mesh position={[0, 2.4, 0]}>
            <cylinderGeometry args={[0.55, 0.7, 4.8, 6]} />
            <meshStandardMaterial color="#6e7278" flatShading roughness={1} />
          </mesh>
          <mesh position={[0, 5.0, 0]}>
            <boxGeometry args={[1.5, 0.4, 1.5]} />
            <meshStandardMaterial color="#5a5e64" flatShading roughness={1} />
          </mesh>
          <mesh position={[0, 5.55, 0]}>
            <sphereGeometry args={[0.32, 5, 4]} />
            <meshStandardMaterial
              color="#ffcc88"
              emissive="#ffaa44"
              emissiveIntensity={1.5}
              flatShading
            />
          </mesh>
        </group>
      ))}
      <pointLight position={[-18, 5.55, -10]} color="#ffcc88" intensity={5} distance={20} decay={2} />
      <pointLight position={[18, 5.55, -10]} color="#ffcc88" intensity={5} distance={20} decay={2} />

      {/* portal do mirante (arco atrás do baú) */}
      <group position={[0, 0, -22]}>
        {[-1, 1].map((side) => (
          <mesh key={side} castShadow position={[side * 5.5, 4.5, 0]}>
            <boxGeometry args={[1.8, 9, 1.8]} />
            <meshStandardMaterial color="#5c6066" flatShading roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 9.4, 0]}>
          <boxGeometry args={[13, 1.5, 2.0]} />
          <meshStandardMaterial color="#4a4e54" flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 11.2, 0]}>
          <coneGeometry args={[4.5, 2.6, 3]} />
          <meshStandardMaterial color="#3e4248" flatShading roughness={1} />
        </mesh>
      </group>

      {/* pedras ornamentais no platô */}
      {[
        [-9, 8],
        [11, 10],
        [-16, 0],
        [15, -4],
        [6, 16],
        [-5, -12],
      ].map(([rx, rz], i) => (
        <mesh
          key={`orn-${i}`}
          position={[rx, 0.35, rz]}
          rotation={[0, i * 1.1, 0]}
          scale={[1.1 + (i % 3) * 0.25, 0.55 + (i % 2) * 0.2, 0.9]}
        >
          <dodecahedronGeometry args={[1.1, 0]} />
          <meshStandardMaterial color="#7a8086" flatShading roughness={1} />
        </mesh>
      ))}

      <SummitBalustrade />
    </group>
  )
}

/** Parapeito do mirante — postes instanciados (1 draw call). */
function SummitBalustrade() {
  const geos = useMemo(
    () => ({
      post: new THREE.BoxGeometry(0.35, 1.9, 0.35),
      rail: new THREE.BoxGeometry(1, 0.35, 1),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      post: new THREE.MeshStandardMaterial({ color: '#8d9096', flatShading: true }),
      rail: new THREE.MeshStandardMaterial({ color: '#7f8288', flatShading: true }),
    }),
    [],
  )
  const { posts, rails } = useMemo(() => {
    const posts = []
    for (let i = 0; i < 18; i++) {
      posts.push({ x: -25.5 + i * 3, y: 0.95, z: -16 })
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        posts.push({ x: side * 26, y: 0.95, z: -12 + i * 3.5 })
      }
    }
    const rails = [
      { x: 0, y: 2.0, z: -16, sx: SUMMIT_HALF_X * 1.1, sz: 0.55 },
      { x: -26, y: 2.0, z: 0, sx: 0.55, sz: 28 },
      { x: 26, y: 2.0, z: 0, sx: 0.55, sz: 28 },
    ]
    return { posts, rails }
  }, [])

  return (
    <group>
      <Instanced geometry={geos.post} material={mats.post} items={posts} castShadow={false} />
      <Instanced geometry={geos.rail} material={mats.rail} items={rails} castShadow={false} />
    </group>
  )
}

/** Poço central do vilarejo */
export function VillageWell({ position = [0, 0, -30] }) {
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0, 1, 0]} args={[1.8, 1, 1.8]} />
      </RigidBody>
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.8, 2, 2, 10]} />
        <meshStandardMaterial color="#8a8a7a" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.2, 10]} />
        <meshStandardMaterial color="#2f4d5a" flatShading metalness={0.3} roughness={0.2} />
      </mesh>
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 3.2, 0]} castShadow>
          <boxGeometry args={[0.3, 3.2, 0.3]} />
          <meshStandardMaterial color="#5c3a1e" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 5, 0]} castShadow>
        <coneGeometry args={[2.6, 1.6, 4]} />
        <meshStandardMaterial color="#4a2814" flatShading />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#6b4a2c" flatShading />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.6, 8]} />
        <meshStandardMaterial color="#54381f" flatShading />
      </mesh>
    </group>
  )
}

/**
 * Riachos rasos da fase 2. Atravessáveis a pé (sem collider), com
 * pranchas no caminho central e seixos nas margens.
 */
export function Streams() {
  const ref = useRef(null)
  const width = CORRIDOR_HALF * 2 - 4

  const decor = useMemo(() => {
    const rng = makeRng(6161)
    return STREAMS.flatMap((s, si) => {
      const cx = pathXAt(s.z)
      return Array.from({ length: 26 }, (_, i) => ({
        key: `${si}-${i}`,
        x: cx + (rng() * 2 - 1) * (CORRIDOR_HALF - 6),
        y: 0.12,
        z: s.z + (rng() - 0.5) * (s.halfZ * 2.4),
        r: 0.25 + rng() * 0.55,
        rot: rng() * Math.PI,
      }))
    })
  }, [])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.children.forEach((child, i) => {
      const s = STREAMS[i]
      if (!s) return
      const cx = pathXAt(s.z)
      child.position.x = cx + (((t * (5 + (i % 4) * 2) + i * 13) % width) - width / 2)
    })
  })

  return (
    <group>
      {STREAMS.map((s, i) => {
        const cx = pathXAt(s.z)
        return (
          <group key={i}>
            <mesh position={[cx, -0.06, s.z]} receiveShadow>
              <boxGeometry args={[width, 0.2, s.halfZ * 2 + 1.6]} />
              <meshStandardMaterial color="#6a6f66" flatShading roughness={1} />
            </mesh>
            <mesh position={[cx, 0.04, s.z]}>
              <boxGeometry args={[width, 0.14, s.halfZ * 2]} />
              <meshStandardMaterial
                color="#2aa0e0"
                flatShading
                transparent
                opacity={0.82}
                roughness={0.1}
                metalness={0.28}
              />
            </mesh>
            <mesh position={[cx, 0.16, s.z]} castShadow receiveShadow>
              <boxGeometry args={[5.2, 0.18, s.halfZ * 2 + 2.4]} />
              <meshStandardMaterial color="#7a5230" flatShading roughness={0.95} />
            </mesh>
            {[-2.4, 2.4].map((x) => (
              <mesh key={x} position={[cx + x, 0.5, s.z]} castShadow>
                <boxGeometry args={[0.2, 0.8, s.halfZ * 2 + 2.4]} />
                <meshStandardMaterial color="#54381f" flatShading />
              </mesh>
            ))}
          </group>
        )
      })}

      <group ref={ref}>
        {STREAMS.map((s, i) => (
          <mesh key={i} position={[pathXAt(s.z), 0.1, s.z]}>
            <boxGeometry args={[3.2, 0.06, s.halfZ * 1.1]} />
            <meshStandardMaterial
              color="#e8f6ff"
              flatShading
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {decor.map((d) => (
        <mesh key={d.key} position={[d.x, d.y, d.z]} rotation={[d.rot, d.rot, 0]} castShadow={false}>
          <dodecahedronGeometry args={[d.r, 0]} />
          <meshStandardMaterial color="#77807a" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** Lagos e poças (um deles congelado, na fase da neve) */
export function Ponds() {
  return (
    <group>
      {PONDS.map((p, i) => {
        const { x, z } = resolveOnPath(p)
        return (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, -0.08, 0]} receiveShadow>
            <cylinderGeometry args={[p.r + 1.2, p.r + 1.6, 0.3, 14]} />
            <meshStandardMaterial color={p.frozen ? '#c4d6de' : '#6a6f66'} flatShading roughness={1} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[p.r, p.r, 0.16, 14]} />
            <meshStandardMaterial
              color={p.frozen ? '#d6ecf4' : '#2a9ad4'}
              flatShading
              transparent
              opacity={p.frozen ? 0.95 : 0.84}
              roughness={p.frozen ? 0.18 : 0.1}
              metalness={0.28}
            />
          </mesh>
          {/* pedras na margem */}
          {Array.from({ length: 9 }, (_, k) => {
            const a = (k / 9) * Math.PI * 2
            return (
              <mesh
                key={k}
                position={[Math.cos(a) * (p.r + 1), 0.25, Math.sin(a) * (p.r + 1)]}
                rotation={[k, k * 0.7, 0]}
                castShadow
              >
                <dodecahedronGeometry args={[0.5 + (k % 3) * 0.35, 0]} />
                <meshStandardMaterial
                  color={p.frozen ? '#a9bcc6' : '#68746c'}
                  flatShading
                  roughness={1}
                />
              </mesh>
            )
          })}
        </group>
        )
      })}
    </group>
  )
}

import { SIGN_TEXTS } from '../../config/story'

/** Placa de madeira indicando a direção */
export function Signpost({ position = [0, 0, 0], rotation = 0, label = 0 }) {
  const text = SIGN_TEXTS[label] ?? ''
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 2.8, 6]} />
        <meshStandardMaterial color="#5c3a1e" flatShading />
      </mesh>
      {Array.from({ length: 2 }, (_, i) => (
        <mesh
          key={i}
          position={[0.9 * (i ? -1 : 1), 2.3 - i * 0.55, 0]}
          rotation={[0, 0, i ? 0.05 : -0.05]}
          castShadow
        >
          <boxGeometry args={[1.9, 0.42, 0.12]} />
          <meshStandardMaterial color={i ? '#7a5230' : '#8a6238'} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 2.75, 0]} castShadow>
        <coneGeometry args={[0.26, 0.4, 5]} />
        <meshStandardMaterial color={label % 2 ? '#4a2814' : '#3d2914'} flatShading />
      </mesh>
      {text && (
        <mesh position={[0, 2.05, 0.08]}>
          <planeGeometry args={[1.6, 0.28]} />
          <meshBasicMaterial color="#f4efe4" transparent opacity={0.92} />
        </mesh>
      )}
    </group>
  )
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount))
  const b = Math.max(0, Math.min(255, (n & 255) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
