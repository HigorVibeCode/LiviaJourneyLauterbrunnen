import { useMemo, useRef } from 'react'
import ToonMat from '../../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { Sparkles, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { makeToonMaterial } from '../../materials/toonMaterial'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  RIVER,
  STAIRS,
  STREAMS,
  PONDS,
  SUMMIT_Y,
  SUMMIT_HALF_X,
  CORRIDOR_HALF,
  TREASURE_POS,
  CLIMB_STREAM,
  makeRng,
  pathXAt,
  resolveOnPath,
  GATES,
} from '../../config/world'
import { PAL } from '../../config/palette'
import { SIGN_TEXTS } from '../../config/story'
import StaticBatch from './StaticBatch'
import { heartGeometry, starGeometry } from './cuteShapes'
import { useProgressStore } from '../../store/progressStore'
import { playerPosition } from '../../store/playerStore'
import Instanced from './Instanced'

/**
 * Muro ao lado do portão, fechando a passagem — agora uma sebe fofa:
 * cerca-viva roliça com flores + cerquinha branca (madeira), muro de pedrinhas
 * arredondadas (pedra) ou muralha de neve fofa (gelo). Colliders iguais.
 */
export function BarrierWall({ z, gateWidth, halfWidth, height = 6, y = 0, color = '#6B4423' }) {
  const gapHalf = gateWidth / 2
  const segLen = halfWidth - gapHalf
  const style = Object.values(GATES).find((g) => g.color === color)?.style ?? 'wood'

  const deco = useMemo(() => {
    if (segLen <= 0) return null
    const rng = makeRng(Math.round(Math.abs(z) * 13 + gateWidth))
    const blobs = []
    const flowers = []
    const pickets = []
    const bodyH = height - 0.9
    for (const side of [-1, 1]) {
      const nTop = Math.max(4, Math.round(segLen / 2.1))
      for (let i = 0; i < nTop; i++) {
        const t = (i + 0.5) / nTop
        const x = side * (gapHalf + 0.4 + (segLen - 0.4) * t)
        blobs.push({ x, y: y + bodyH - 0.1 + rng() * 0.25, z: z + (rng() - 0.5) * 0.3, s: 1.15 + rng() * 0.35, k: i % 3 })
        // bolotas laterais (dão volume à sebe)
        if (i % 2 === 0) {
          for (const f of [-1, 1]) {
            blobs.push({ x: x + (rng() - 0.5), y: y + 1.2 + rng() * (bodyH - 2.4), z: z + f * 0.95, s: 0.75 + rng() * 0.3, k: (i + 1) % 3 })
          }
        }
        // florzinhas nas duas faces
        for (const f of [-1, 1]) {
          if (rng() < 0.75) {
            flowers.push({
              x: x + (rng() - 0.5) * 1.6,
              y: y + 1.0 + rng() * (bodyH - 1.2),
              z: z + f * 1.12,
              c: PAL.flowers[Math.floor(rng() * PAL.flowers.length)],
              f,
            })
          }
        }
      }
      // cerquinha branca na frente (só no estilo madeira)
      if (style === 'wood') {
        const n = Math.round(segLen / 1.15)
        for (let i = 0; i < n; i++) {
          const x = side * (gapHalf + 0.8 + (segLen - 1.2) * ((i + 0.5) / n))
          pickets.push({ x, front: 1.32 })
        }
      }
    }
    return { blobs, flowers, pickets, bodyH }
  }, [segLen, gapHalf, height, y, z, gateWidth, style])

  if (segLen <= 0) return null

  const pal =
    style === 'ice'
      ? { body: PAL.snowShade, blob: [PAL.snow, '#eef6ff', PAL.snowShade] }
      : style === 'stone'
        ? { body: '#cdd7e2', blob: ['#dfe6ee', '#cbd5e0', '#e8edf3'] }
        : { body: PAL.leafDark, blob: [PAL.leaf, PAL.leafLight, PAL.leafDark] }

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={1}>
        <CuboidCollider
          position={[-(gapHalf + segLen / 2), y + height / 2, z]}
          args={[segLen / 2, height / 2, 1.0]}
        />
        <CuboidCollider
          position={[gapHalf + segLen / 2, y + height / 2, z]}
          args={[segLen / 2, height / 2, 1.0]}
        />
      </RigidBody>

      <StaticBatch>
        {[-1, 1].map((side) => (
          <RoundedBox
            key={side}
            args={[segLen, deco.bodyH, 1.9]}
            radius={0.7}
            smoothness={2}
            bevelSegments={2}
            position={[side * (gapHalf + segLen / 2), y + deco.bodyH / 2, z]}
          >
            <ToonMat color={pal.body} />
          </RoundedBox>
        ))}
        {deco.blobs.map((b, i) => (
          <mesh key={`b${i}`} position={[b.x, b.y, b.z]} scale={[b.s, b.s * 0.8, b.s * 0.9]}>
            <sphereGeometry args={[1, 10, 8]} />
            <ToonMat color={pal.blob[b.k]} />
          </mesh>
        ))}
        {style !== 'ice' &&
          deco.flowers.map((f, i) => (
            <group key={`f${i}`} position={[f.x, f.y, f.z]}>
              <mesh scale={[1, 1, 0.6]}>
                <sphereGeometry args={[0.28, 8, 6]} />
                <ToonMat color={style === 'stone' ? PAL.leafLight : f.c} />
              </mesh>
              {style !== 'stone' && (
                <mesh position={[0, 0, f.f * 0.16]}>
                  <sphereGeometry args={[0.11, 6, 5]} />
                  <ToonMat color={PAL.flowerCenter} />
                </mesh>
              )}
            </group>
          ))}
        {/* cerquinha branca de estacas com ponta redonda */}
        {deco.pickets.map((p, i) => (
          <group key={`p${i}`} position={[p.x, y, z + p.front]}>
            <mesh position={[0, 0.65, 0]}>
              <boxGeometry args={[0.34, 1.3, 0.14]} />
              <ToonMat color="#ffffff" />
            </mesh>
            <mesh position={[0, 1.3, 0]} scale={[1, 1, 0.45]}>
              <sphereGeometry args={[0.17, 8, 5]} />
              <ToonMat color="#ffffff" />
            </mesh>
          </group>
        ))}
        {style === 'wood' &&
          [-1, 1].map((side) =>
            [0.45, 1.0].map((h) => (
              <mesh key={`r${side}${h}`} position={[side * (gapHalf + 0.6 + (segLen - 0.8) / 2), y + h, z + 1.24]}>
                <boxGeometry args={[segLen - 0.8, 0.16, 0.1]} />
                <ToonMat color="#ffffff" />
              </mesh>
            )),
          )}
      </StaticBatch>
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
  const nPosts = 13
  const postZ = (i) => zMid - halfZ + 1.5 + i * ((halfZ * 2 - 3) / (nPosts - 1))
  const capCols = ['#ff8fb8', '#ffffff', '#6ec8ff', '#ffffff']

  return (
    <group position={[px, 0, 0]}>
      <RigidBody type="fixed" colliders={false} friction={1.4}>
        {/* tabuleiro (topo em y = 0.02, sem degrau nas margens) */}
        <CuboidCollider position={[0, -0.28, zMid]} args={[halfX, 0.3, halfZ]} />
        {/* guarda-corpos */}
        <CuboidCollider position={[-halfX - 0.2, 0.7, zMid]} args={[0.25, 0.7, halfZ]} />
        <CuboidCollider position={[halfX + 0.2, 0.7, zMid]} args={[0.25, 0.7, halfZ]} />
      </RigidBody>

      <StaticBatch>
        {/* pranchas roliças, em dois tons de madeira clara */}
        {Array.from({ length: planks }, (_, i) => (
          <RoundedBox
            key={i}
            args={[halfX * 2 - 0.1, 0.28, 1.42]}
            radius={0.12}
            smoothness={2}
            bevelSegments={1}
            position={[0, -0.1, zMid - halfZ + 0.8 + i * 1.6]}
          >
            <ToonMat color={i % 2 ? '#e8b77f' : PAL.wood} />
          </RoundedBox>
        ))}

        {/* vigas longitudinais */}
        {[-halfX + 0.5, halfX - 0.5].map((x) => (
          <RoundedBox key={x} args={[0.7, 0.55, halfZ * 2]} radius={0.22} smoothness={2} bevelSegments={1} position={[x, -0.45, zMid]}>
            <ToonMat color={PAL.woodDark} />
          </RoundedBox>
        ))}

        {/* postes roliços com bolinhas coloridas */}
        {Array.from({ length: nPosts }, (_, i) =>
          [-1, 1].map((side) => (
            <group key={`${i}-${side}`} position={[side * (halfX + 0.2), 0, postZ(i)]}>
              <mesh position={[0, 0.72, 0]}>
                <cylinderGeometry args={[0.24, 0.28, 1.45, 10]} />
                <ToonMat color={PAL.wood} />
              </mesh>
              <mesh position={[0, 1.55, 0]}>
                <sphereGeometry args={[0.3, 10, 8]} />
                <ToonMat color={capCols[i % capCols.length]} />
              </mesh>
            </group>
          )),
        )}

        {/* corda grossa, caindo um pouquinho entre os postes */}
        {Array.from({ length: nPosts - 1 }, (_, i) =>
          [-1, 1].map((side) =>
            [-1, 1].map((half) => {
              const z0 = postZ(i)
              const z1 = postZ(i + 1)
              const seg = (z1 - z0) / 2
              const sag = 0.28
              const zc = z0 + seg * (half < 0 ? 0.5 : 1.5)
              const ang = Math.atan2(sag, seg) * half
              return (
                <mesh
                  key={`r${i}${side}${half}`}
                  position={[side * (halfX + 0.2), 1.3 - sag / 2, zc]}
                  rotation={[Math.PI / 2 + ang, 0, 0]}
                >
                  <cylinderGeometry args={[0.1, 0.1, Math.hypot(seg, sag) + 0.12, 6]} />
                  <ToonMat color="#f6dfb0" />
                </mesh>
              )
            }),
          ),
        )}

        {/* lanterninhas nas cabeceiras */}
        {[-1, 1].map((end) =>
          [-1, 1].map((side) => (
            <group key={`l${end}${side}`} position={[side * (halfX + 0.2), 0, zMid + end * (halfZ - 0.6)]}>
              <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.3, 0.36, 2.4, 10]} />
                <ToonMat color={PAL.woodDark} />
              </mesh>
              <mesh position={[0, 2.75, 0]}>
                <sphereGeometry args={[0.45, 12, 10]} />
                <ToonMat color="#fff0b0" emissive="#ffc040" emissiveIntensity={0.9} />
              </mesh>
              <mesh position={[0, 3.25, 0]}>
                <coneGeometry args={[0.55, 0.5, 12]} />
                <ToonMat color="#ff8fb8" />
              </mesh>
            </group>
          )),
        )}

        {/* pilares roliços de pedra clara no desfiladeiro */}
        {[-0.45, 0.45].map((f) => (
          <RoundedBox key={f} args={[halfX * 1.6, 3.2, 1.6]} radius={0.5} smoothness={2} bevelSegments={2} position={[0, -1.9, zMid + f * halfZ * 0.9]}>
            <ToonMat color="#dfe5ee" />
          </RoundedBox>
        ))}
      </StaticBatch>
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
      <mesh position={[0, RIVER.waterY, zMid]}>
        <boxGeometry args={[RIVER.gapHalfX * 2, 1.2, len]} />
        <ToonMat color={PAL.water} transparent opacity={0.92} />
      </mesh>
      {/* espuma correndo (bolotas brancas achatadas) */}
      <group ref={ref} position={[0, RIVER.waterY, zMid]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[(i % 3 - 1) * 3.5, 0.62, 0]} scale={[1.3, 0.12, 1.9]}>
            <sphereGeometry args={[1, 12, 6]} />
            <ToonMat color={PAL.foam} transparent opacity={0.8} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <StaticBatch>
        {/* espuma fixa nas margens */}
        {[-1, 1].map((side) => (
          <mesh key={`f${side}`} position={[side * (RIVER.gapHalfX - 0.4), RIVER.waterY + 0.6, zMid]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.35]}>
            <capsuleGeometry args={[0.7, len - 22, 4, 10]} />
            <ToonMat color={PAL.foam} />
          </mesh>
        ))}
        {/* paredes do desfiladeiro, roliças e claras */}
        {[-1, 1].map((side) => (
          <RoundedBox
            key={side}
            args={[1.8, 4.2, len - 20]}
            radius={0.6}
            smoothness={2}
            bevelSegments={2}
            position={[side * (RIVER.gapHalfX + 0.6), -1.6, zMid]}
          >
            <ToonMat color={PAL.cliffSide} />
          </RoundedBox>
        ))}
      </StaticBatch>
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
  const padBottom = 2
  const padTop = 0.6

  const az = zBottom + padBottom
  const ay = -slope * padBottom
  const bz = zTop - padTop
  const by = SUMMIT_Y + slope * padTop

  const len = Math.hypot(bz - az, by - ay)
  const angle = Math.asin((by - ay) / len)
  const halfY = 1

  return {
    angle,
    halfY,
    halfLen: len / 2,
    y: (ay + by) / 2 - halfY * Math.cos(angle),
    z: (az + bz) / 2 - halfY * Math.sin(angle),
    zTop,
  }
})()

/** Escadaria monumental — visual instanciado; 1 rampa Rapier; poucas luzes. */
export function SummitStairs() {
  const stairsLen = (STAIRS.steps - 1) * STAIRS.stepDepth
  const midZ = STAIRS.zStart - stairsLen / 2

  const geos = useMemo(
    () => ({
      step: new RoundedBoxGeometry(STAIRS.halfWidth * 2, STAIRS.stepRise * 0.92, STAIRS.stepDepth * 0.92, 2, 0.2),
      landing: new RoundedBoxGeometry(STAIRS.halfWidth * 2.15, 0.28, STAIRS.stepDepth * 2.4, 2, 0.12),
      snow: new THREE.SphereGeometry(0.62, 12, 6),
      pillar: new THREE.CylinderGeometry(0.55, 0.65, 1, 12),
      cap: new THREE.SphereGeometry(0.75, 12, 8),
      lantern: new THREE.SphereGeometry(0.34, 12, 8),
      rock: new THREE.SphereGeometry(0.9, 9, 7),
      tuft: new THREE.SphereGeometry(0.42, 8, 6),
      flagPole: new THREE.CylinderGeometry(0.08, 0.09, 2.8, 8),
      flag: new RoundedBoxGeometry(1.1, 0.7, 0.1, 2, 0.04),
      bench: new RoundedBoxGeometry(2.4, 0.3, 0.75, 2, 0.12),
      crate: new RoundedBoxGeometry(0.9, 0.9, 0.9, 2, 0.16),
      cairn: new THREE.SphereGeometry(0.45, 9, 7),
      rope: new THREE.CylinderGeometry(0.09, 0.09, 1, 6),
      post: new THREE.CylinderGeometry(0.16, 0.18, 1.4, 10),
      shrine: new THREE.CylinderGeometry(0.75, 0.55, 1.1, 14),
      shrineCap: new THREE.SphereGeometry(0.85, 12, 8),
    }),
    [],
  )

  // materiais base brancos quando há instanceColor — evita tint errado / z-fight
  const mats = useMemo(
    () => ({
      step: makeToonMaterial({ color: '#ffffff',}),
      landing: makeToonMaterial({ color: '#ffffff',}),
      snow: (() => {
        const m = makeToonMaterial({ color: '#ffffff' })
        m.polygonOffset = true
        m.polygonOffsetFactor = -1
        m.polygonOffsetUnits = -1
        return m
      })(),
      pillar: makeToonMaterial({ color: '#ffffff',}),
      cap: makeToonMaterial({ color: '#ffffff',}),
      lantern: makeToonMaterial({
        color: '#fff0b0',
        emissive: '#ffc040',
        emissiveIntensity: 1.1,
      }),
      rock: makeToonMaterial({ color: '#ffffff',}),
      tuft: makeToonMaterial({ color: '#ffffff',}),
      flagPole: makeToonMaterial({ color: PAL.wood }),
      flag: makeToonMaterial({ color: '#ffffff',}),
      wood: makeToonMaterial({ color: '#ffffff',}),
      rope: makeToonMaterial({ color: '#f6dfb0' }),
      shrine: makeToonMaterial({ color: '#ffffff',}),
    }),
    [],
  )

  const batches = useMemo(() => {
    const rng = makeRng(9091)
    const steps = []
    const landings = []
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

    // pedras claras e quentinhas (pastel), nada de cinza-escuro
    const stoneA = ['#efe6da', '#e8eef5', '#f3ead0', '#e6e0f0', '#eef2e4']
    const stoneB = ['#d5dde6', '#cfd8e3', '#dde3ea', '#c9d3df']
    const snowC = [PAL.snow, '#eef6ff', PAL.snowShade, '#f8fbff']
    const flagC = ['#ff8fb8', '#6ec8ff', '#ffd45a', '#b48cff', '#7ad99a']

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
            color: PAL.wood,
            ry: side > 0 ? -0.12 : 0.12,
          })
          crates.push({
            x: side * (7 + rng() * 2),
            y: top + 0.55,
            z: z - 0.3 + rng() * 0.5,
            color: rng() > 0.5 ? '#e8b77f' : PAL.wood,
            ry: rng() * 0.8,
            s: 0.85 + rng() * 0.3,
          })
          // postes de lanterna DENTRO do corredor (visíveis de baixo)
          posts.push({ x: side * 6.5, y: top + 1.1, z: z + 0.8, color: PAL.woodDark, sy: 2.2 })
          lanterns.push({ x: side * 6.5, y: top + 2.4, z: z + 0.8 })
          flagPoles.push({ x: side * 8.5, y: top + 2.4, z: z + 1.2 })
          flags.push({
            x: side * 8.5 + side * 0.55,
            y: top + 3.3,
            z: z + 1.2,
            color: side < 0 ? '#ff8fb8' : '#6ec8ff',
          })
        }
        const shrineSide = i % 12 === 0 ? -1 : 1
        // vasão de flores (terracota pastel + moita florida)
        shrines.push({ x: shrineSide * 5.5, y: top + 0.55, z: z + 0.6, color: '#f6a98f' })
        shrineCaps.push({ x: shrineSide * 5.5, y: top + 1.35, z: z + 0.6, color: flagC[(i / 6) % flagC.length], sy: 0.8 })
      } else {
        // alguns degraus com tom nevado embutido (sem placa flutuante)
        const snowy = rng() > 0.72
        steps.push({
          x: (rng() - 0.5) * 0.12,
          y: top - STAIRS.stepRise / 2 + 0.02,
          z,
          color: snowy ? '#f4f8fd' : stoneA[(i + Math.floor(rng() * 3)) % stoneA.length],
          ry: (rng() - 0.5) * 0.02,
        })
      }

      // marcadores verticais no corredor (visíveis olhando para cima)
      if (i % 3 === 1) {
        const side = i % 6 < 3 ? -1 : 1
        posts.push({ x: side * 5.2, y: top + 1.0, z, color: PAL.wood, sy: 1.9 })
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
          color: rng() > 0.5 ? PAL.leaf : PAL.leafLight,
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
          caps.push({ x, y: top + 2.95, z, color: '#ffffff', sy: 0.6 })
          snow.push({
            x,
            y: top + 3.2,
            z,
            sx: 1.1,
            sz: 1.1,
            sy: 0.5,
            color: PAL.snow,
            ry: 0,
          })
          lanterns.push({ x, y: top + 3.4, z })
          if (i > 0 && i < STAIRS.steps - 3) {
            posts.push({ x: side * (STAIRS.halfWidth - 0.8), y: top + 0.7, z, color: PAL.wood })
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
            color: flagC[(i / 6 + (side > 0 ? 2 : 0)) % flagC.length],
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
          color: i % 4 === 0 ? PAL.leaf : i % 4 === 1 ? PAL.leafLight : PAL.flowers[i % PAL.flowers.length],
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
          sy: 0.45,
          color: snowC[i % snowC.length],
          ry: rng() * Math.PI,
        })
      }
    }

    return {
      steps,
      landings,
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
        {/* platô de chegada — evita queda no limbo entre rampa e chão do mirante */}
        <CuboidCollider
          position={[0, SUMMIT_Y - 1.2, RAMP.zTop - 5]}
          args={[STAIRS.halfWidth + 2, 1.2, 10]}
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

      <StaticBatch>
        {/* muretas laterais roliças, pedra clarinha */}
        {[-1, 1].map((side) => (
          <RoundedBox
            key={side}
            args={[1.4, SUMMIT_Y + 1.6, stairsLen + 4]}
            radius={0.6}
            smoothness={2}
            bevelSegments={2}
            position={[side * (STAIRS.halfWidth + 0.7), SUMMIT_Y / 2 + 0.8, midZ]}
          >
            <ToonMat color="#e9e2f2" />
          </RoundedBox>
        ))}

        {[-1, 1].map((side) => (
          <mesh
            key={`handrail-${side}`}
            position={[side * (STAIRS.halfWidth - 0.35), SUMMIT_Y / 2 + 1.1, midZ]}
            rotation={[RAMP.angle + Math.PI / 2, 0, 0]}
          >
            <capsuleGeometry args={[0.16, stairsLen + 2, 3, 8]} />
            <ToonMat color={PAL.wood} />
          </mesh>
        ))}

        {[0, STAIRS.steps - 1].map((i) => {
          const z = STAIRS.zStart - i * STAIRS.stepDepth
          const y = (i + 1) * STAIRS.stepRise
          const isTop = i === STAIRS.steps - 1
          const px = STAIRS.halfWidth - 1.2
          return (
            <group key={`arch-${i}`} position={[0, y, z]}>
              {[-1, 1].map((side) => (
                <group key={side}>
                  <RoundedBox args={[1.8, 8.4, 2.0]} radius={0.5} smoothness={2} bevelSegments={2} position={[side * px, 4.2, 0]}>
                    <ToonMat color="#f4ede4" />
                  </RoundedBox>
                  <mesh position={[side * px, 8.75, 0]}>
                    <sphereGeometry args={[1.25, 14, 10]} />
                    <ToonMat color={isTop ? '#ff8fb8' : '#6ec8ff'} />
                  </mesh>
                </group>
              ))}
              {/* viga roliça com guirlanda de flores */}
              <RoundedBox args={[STAIRS.halfWidth * 2 - 0.4, 1.3, 2.0]} radius={0.55} smoothness={2} bevelSegments={2} position={[0, 8.6, 0]}>
                <ToonMat color="#f4ede4" />
              </RoundedBox>
              {Array.from({ length: 14 }, (_, k) => {
                const x = (k / 13 - 0.5) * (STAIRS.halfWidth * 2 - 6)
                return (
                  <group key={`g${k}`} position={[x, 7.85 - Math.sin((k / 13) * Math.PI) * 0.6, 1.05]}>
                    <mesh>
                      <sphereGeometry args={[0.42, 10, 8]} />
                      <ToonMat color={PAL.flowers[k % PAL.flowers.length] === '#ffffff' ? '#fff3f8' : PAL.flowers[k % PAL.flowers.length]} />
                    </mesh>
                    <mesh position={[0, 0, 0.32]}>
                      <sphereGeometry args={[0.15, 8, 6]} />
                      <ToonMat color={PAL.flowerCenter} />
                    </mesh>
                    <mesh position={[0.45, 0.2, -0.1]} scale={[1.3, 0.7, 0.8]}>
                      <sphereGeometry args={[0.28, 8, 6]} />
                      <ToonMat color={PAL.leafLight} />
                    </mesh>
                  </group>
                )
              })}
              {isTop && (
                <mesh geometry={heartGeometry()} position={[0, 10.3, 0.2]} scale={2.2}>
                  <ToonMat color="#ff8fb8" emissive="#ff6fa0" emissiveIntensity={0.25} />
                </mesh>
              )}
              {[-1, 1].map((side) => (
                <group key={`flag-${side}`} position={[side * px, 10.6, 0.3]}>
                  <mesh>
                    <cylinderGeometry args={[0.09, 0.1, 3.2, 8]} />
                    <ToonMat color={PAL.wood} />
                  </mesh>
                  <mesh position={[0, 1.7, 0]}>
                    <sphereGeometry args={[0.2, 10, 8]} />
                    <ToonMat color="#ffd45a" />
                  </mesh>
                  <RoundedBox args={[1.4, 0.9, 0.12]} radius={0.05} smoothness={2} bevelSegments={1} position={[side * 0.75, 1.0, 0]}>
                    <ToonMat color={isTop ? '#ff8fb8' : '#6ec8ff'} />
                  </RoundedBox>
                </group>
              ))}
            </group>
          )
        })}
      </StaticBatch>

      <pooledLight
        position={[STAIRS.halfWidth + 1.6, midLightY, midLightZ]}
        color="#ffcc88"
        intensity={6}
        distance={32}
        decay={1.6}
      />
      <pooledLight
        position={[-STAIRS.halfWidth - 1.6, midLightY, midLightZ - 18]}
        color="#ffcc88"
        intensity={5}
        distance={28}
        decay={1.6}
      />
      <pooledLight
        position={[0, SUMMIT_Y * 0.25 + 2, STAIRS.zStart - stairsLen * 0.22]}
        color="#ffd898"
        intensity={5}
        distance={26}
        decay={1.6}
      />
      <pooledLight
        position={[0, SUMMIT_Y * 0.62 + 2, STAIRS.zStart - stairsLen * 0.68]}
        color="#ffd898"
        intensity={5}
        distance={26}
        decay={1.6}
      />
      <pooledLight
        position={[0, topArchY + 6.5, topArchZ + 1.5]}
        color="#ffcc88"
        intensity={7}
        distance={34}
        decay={1.5}
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
        color: i % 2 ? PAL.water : PAL.waterDeep,
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
        color: '#dfe5ee',
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
      water: makeToonMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
      bed: makeToonMaterial({ color: '#ffffff',}),
    }),
    [],
  )

  useFrame((state) => {
    if (!foamRef.current) return
    const t = state.clock.elapsedTime
    foamRef.current.children.forEach((c, i) => {
      c.position.y = segs[i]?.y + 0.1 + Math.sin(t * 3 + i) * 0.03
      c.material.opacity = 0.55 + Math.sin(t * 4 + i * 0.7) * 0.2
    })
  })

  return (
    <group>
      <Instanced geometry={geos.box} material={mats.bed} items={bed} castShadow={false} />
      <Instanced geometry={geos.box} material={mats.water} items={segs} castShadow={false} receiveShadow={false} />
      <group ref={foamRef}>
        {segs.map((s, i) =>
          i % 2 === 0 ? (
            <mesh key={i} position={[s.x, s.y + 0.1, s.z]} scale={[1, 0.2, 1.4]}>
              <sphereGeometry args={[CLIMB_STREAM.halfWidth * 0.6, 10, 5]} />
              <ToonMat color={PAL.foam} transparent opacity={0.6} depthWrite={false} />
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
    if (d < 5.5) startFinale()
  })

  const gold = '#ffd45a'
  const pink = '#ff9fc4'

  return (
    <group position={position}>
      {/* pedestal */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0, 0.3, 0]} args={[2, 0.3, 1.6]} />
      </RigidBody>
      {/* o baú cintila de longe — é o grande prêmio */}
      {!finished && (
        <Sparkles count={40} scale={[5, 4, 5]} position={[0, 2, 0]} size={7} speed={0.4} color="#ffe08a" />
      )}

      <StaticBatch>
        {/* pedestal fofo: base branca + almofada rosada */}
        <RoundedBox args={[4.4, 0.6, 3.6]} radius={0.25} smoothness={2} bevelSegments={2} position={[0, 0.3, 0]}>
          <ToonMat color="#fbf6ff" />
        </RoundedBox>
        <RoundedBox args={[3.6, 0.22, 2.8]} radius={0.1} smoothness={2} bevelSegments={1} position={[0, 0.66, 0]}>
          <ToonMat color="#ffc9dc" />
        </RoundedBox>
        {/* degrauzinhos dourados nos cantos */}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz]) => (
          <mesh key={`${sx}${sz}`} position={[sx * 2.05, 0.68, sz * 1.65]}>
            <sphereGeometry args={[0.26, 10, 8]} />
            <ToonMat color={gold} />
          </mesh>
        ))}

        {/* corpo do baú: rosa com faixas douradas */}
        <RoundedBox args={[2.3, 1.1, 1.55]} radius={0.18} smoothness={2} bevelSegments={2} position={[0, 1.3, 0]}>
          <ToonMat color={pink} />
        </RoundedBox>
        {[-0.75, 0.75].map((x) => (
          <RoundedBox key={x} args={[0.26, 1.16, 1.62]} radius={0.08} smoothness={2} bevelSegments={1} position={[x, 1.3, 0]}>
            <ToonMat color={gold} />
          </RoundedBox>
        ))}
        <RoundedBox args={[2.36, 0.2, 1.6]} radius={0.08} smoothness={2} bevelSegments={1} position={[0, 0.84, 0]}>
          <ToonMat color={gold} />
        </RoundedBox>
        {/* fecho em coração com joia */}
        <mesh geometry={heartGeometry()} position={[0, 1.42, 0.86]} scale={0.62}>
          <ToonMat color={gold} />
        </mesh>
        <mesh geometry={heartGeometry()} position={[0, 1.42, 0.98]} scale={0.36}>
          <ToonMat color="#ff5fa2" emissive="#ff3f8a" emissiveIntensity={0.45} />
        </mesh>

        {/* telescópio pastel */}
        <group position={[8, 0, 4]}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.16, 0.24, 1.4, 10]} />
            <ToonMat color={PAL.wood} />
          </mesh>
          <mesh position={[0, 1.55, 0.3]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.3, 1.2, 12]} />
            <ToonMat color="#6ec8ff" />
          </mesh>
          <mesh position={[0, 1.83, 0.82]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.2, 12]} />
            <ToonMat color="#ffffff" />
          </mesh>
          <mesh position={[0, 1.42, 0.06]}>
            <sphereGeometry args={[0.24, 10, 8]} />
            <ToonMat color={gold} />
          </mesh>
        </group>

        {/* bandeiras coloridas */}
        {[
          [-10, 3],
          [12, -2],
          [-14, -6],
        ].map(([fx, fz], i) => (
          <group key={`flag-${i}`} position={[fx, 0, fz]}>
            <mesh position={[0, 3.2, 0]}>
              <cylinderGeometry args={[0.13, 0.16, 6.4, 10]} />
              <ToonMat color="#ffffff" />
            </mesh>
            <mesh position={[0, 6.5, 0]}>
              <sphereGeometry args={[0.3, 10, 8]} />
              <ToonMat color={gold} />
            </mesh>
            <RoundedBox args={[2.2, 1.35, 0.14]} radius={0.06} smoothness={2} bevelSegments={1} position={[1.15, 5.5, 0]}>
              <ToonMat color={['#ff8fb8', '#6ec8ff', '#b48cff'][i]} />
            </RoundedBox>
            <mesh geometry={i === 1 ? starGeometry() : heartGeometry()} position={[1.15, 5.5, 0.12]} scale={0.7}>
              <ToonMat color="#ffffff" />
            </mesh>
          </group>
        ))}

        {/* pilares-lampião do platô (bola acesa no topo) */}
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
              <cylinderGeometry args={[0.5, 0.65, 4.8, 12]} />
              <ToonMat color="#f4ede4" />
            </mesh>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.9, 0.95, 0.5, 14]} />
              <ToonMat color={i % 2 ? '#ffc9dc' : '#cfe6ff'} />
            </mesh>
            <mesh position={[0, 4.95, 0]}>
              <cylinderGeometry args={[0.85, 0.7, 0.35, 14]} />
              <ToonMat color={i % 2 ? '#ffc9dc' : '#cfe6ff'} />
            </mesh>
            <mesh position={[0, 5.55, 0]}>
              <sphereGeometry args={[0.5, 14, 10]} />
              <ToonMat color="#fff0b0" emissive="#ffc040" emissiveIntensity={1.1} />
            </mesh>
          </group>
        ))}

        {/* portal do mirante: arco branco redondo com coração no topo */}
        <group position={[0, 0, -22]}>
          {[-1, 1].map((side) => (
            <group key={side}>
              <RoundedBox args={[1.9, 9, 1.9]} radius={0.55} smoothness={2} bevelSegments={2} position={[side * 5.5, 4.5, 0]}>
                <ToonMat color="#fbf6ff" />
              </RoundedBox>
              <mesh position={[side * 5.5, 9.4, 0]}>
                <sphereGeometry args={[1.25, 14, 10]} />
                <ToonMat color="#b48cff" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 8.6, 0]}>
            <torusGeometry args={[5.5, 0.75, 10, 28, Math.PI]} />
            <ToonMat color="#fbf6ff" />
          </mesh>
          {Array.from({ length: 11 }, (_, k) => {
            const ang = 0.18 + (k / 10) * (Math.PI - 0.36)
            return (
              <mesh key={k} position={[Math.cos(ang) * 5.5, 8.6 + Math.sin(ang) * 5.5, 0.75]}>
                <sphereGeometry args={[0.5, 10, 8]} />
                <ToonMat color={PAL.flowers[k % PAL.flowers.length] === '#ffffff' ? '#ffd6e6' : PAL.flowers[k % PAL.flowers.length]} />
              </mesh>
            )
          })}
          <mesh geometry={heartGeometry()} position={[0, 15.0, 0]} scale={2.4}>
            <ToonMat color="#ff8fb8" emissive="#ff6fa0" emissiveIntensity={0.3} />
          </mesh>
        </group>

        {/* pedrinhas roliças + tufos floridos no platô */}
        {[
          [-9, 8],
          [11, 10],
          [-16, 0],
          [15, -4],
          [6, 16],
          [-5, -12],
        ].map(([rx, rz], i) => (
          <group key={`orn-${i}`} position={[rx, 0, rz]}>
            <mesh position={[0, 0.35, 0]} scale={[1.1 + (i % 3) * 0.25, 0.6 + (i % 2) * 0.2, 0.9]}>
              <sphereGeometry args={[1.1, 10, 8]} />
              <ToonMat color={i % 2 ? PAL.rock : '#dbe2ec'} />
            </mesh>
            <mesh position={[1.2, 0.35, 0.4]} scale={[1, 0.8, 1]}>
              <sphereGeometry args={[0.6, 10, 8]} />
              <ToonMat color={PAL.leafLight} />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[1.0 + k * 0.25, 0.85, 0.2 + (k % 2) * 0.4]}>
                <sphereGeometry args={[0.18, 8, 6]} />
                <ToonMat color={PAL.flowers[(i + k) % PAL.flowers.length]} />
              </mesh>
            ))}
          </group>
        ))}
      </StaticBatch>

      {/* tampa (anima ao abrir) — dobradiça atrás */}
      <group ref={lidRef} position={[0, 1.8, -0.78]}>
        <mesh position={[0, 0.05, 0.78]} rotation={[0, 0, Math.PI / 2]} scale={[0.62, 1, 1]}>
          <cylinderGeometry args={[0.8, 0.8, 2.36, 16, 1, false, 0, Math.PI]} />
          <ToonMat color={pink} />
        </mesh>
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} position={[x, 0.05, 0.78]} rotation={[0, 0, Math.PI / 2]} scale={[0.66, 1, 1.05]}>
            <cylinderGeometry args={[0.8, 0.8, 0.28, 16, 1, false, 0, Math.PI]} />
            <ToonMat color={gold} />
          </mesh>
        ))}
      </group>

      {/* brilho do tesouro: coração-joia flutuante */}
      {/* (grupo eleva o coração para flutuar acima da tampa) */}
      <group position={[0, 0.95, 0]}>
        <mesh ref={glowRef} position={[0, 1.8, 0]} geometry={heartGeometry()} scale={1}>
          <ToonMat color="#ff9fc8" emissive="#ff5fa2" emissiveIntensity={0.9} />
        </mesh>
      </group>
      <pooledLight position={[0, 2.2, 0]} color="#ffcc66" intensity={7} distance={12} decay={2} />

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

      {/* fagulhas em espiral (estrelinhas e corações) */}
      <group ref={sparksRef} visible={false}>
        {sparks.map((s, i) => (
          <mesh key={i} geometry={i % 2 ? starGeometry() : heartGeometry()}>
            <meshBasicMaterial color={i % 3 === 0 ? '#ff9fc8' : i % 2 ? '#ffd76a' : '#fff3c4'} transparent depthWrite={false} />
          </mesh>
        ))}
      </group>

      <pooledLight position={[-18, 5.55, -10]} color="#ffcc88" intensity={5} distance={20} decay={2} />
      <pooledLight position={[18, 5.55, -10]} color="#ffcc88" intensity={5} distance={20} decay={2} />

      <SummitBalustrade />
    </group>
  )
}

/** Parapeito do mirante — balaústres roliços instanciados (2 draw calls). */
function SummitBalustrade() {
  const geos = useMemo(
    () => ({
      post: new THREE.CylinderGeometry(0.2, 0.26, 1.9, 10),
      rail: new RoundedBoxGeometry(1, 0.35, 1, 2, 0.15),
      ball: new THREE.SphereGeometry(0.32, 10, 8),
    }),
    [],
  )
  const mats = useMemo(
    () => ({
      post: makeToonMaterial({ color: '#fbf6ff' }),
      rail: makeToonMaterial({ color: '#ffc9dc' }),
      ball: makeToonMaterial({ color: '#ffffff' }),
    }),
    [],
  )
  const { posts, rails, balls } = useMemo(() => {
    const posts = []
    const balls = []
    const ballC = ['#ff8fb8', '#6ec8ff', '#ffd45a', '#b48cff']
    for (let i = 0; i < 18; i++) {
      posts.push({ x: -25.5 + i * 3, y: 0.95, z: -16 })
      if (i % 3 === 0) balls.push({ x: -25.5 + i * 3, y: 2.45, z: -16, color: ballC[(i / 3) % 4] })
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        posts.push({ x: side * 26, y: 0.95, z: -12 + i * 3.5 })
        if (i % 2 === 0) balls.push({ x: side * 26, y: 2.45, z: -12 + i * 3.5, color: ballC[(i / 2 + (side > 0 ? 1 : 0)) % 4] })
      }
    }
    const rails = [
      { x: 0, y: 2.0, z: -16, sx: SUMMIT_HALF_X * 1.1, sz: 0.55 },
      { x: -26, y: 2.0, z: 0, sx: 0.55, sz: 28 },
      { x: 26, y: 2.0, z: 0, sx: 0.55, sz: 28 },
    ]
    return { posts, rails, balls }
  }, [])

  return (
    <group>
      <Instanced geometry={geos.post} material={mats.post} items={posts} castShadow={false} />
      <Instanced geometry={geos.rail} material={mats.rail} items={rails} castShadow={false} />
      <Instanced geometry={geos.ball} material={mats.ball} items={balls} castShadow={false} />
    </group>
  )
}

/** Poço central do vilarejo — pedrinhas claras e telhadinho */
export function VillageWell({ position = [0, 0, -30] }) {
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0, 1, 0]} args={[1.8, 1, 1.8]} />
      </RigidBody>
      <StaticBatch>
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[1.8, 1.95, 2, 16]} />
          <ToonMat color="#e6ebf2" />
        </mesh>
        {/* pedrinhas arredondadas em volta */}
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 1.85, 0.55 + (i % 2) * 0.75, Math.sin(a) * 1.85]} scale={[1, 0.7, 1]}>
              <sphereGeometry args={[0.42, 8, 6]} />
              <ToonMat color={i % 3 ? '#cfd8e3' : '#dbe2ec'} />
            </mesh>
          )
        })}
        <mesh position={[0, 2.02, 0]}>
          <torusGeometry args={[1.62, 0.26, 8, 20]} />
          <ToonMat color="#f4f6fa" />
        </mesh>
        <mesh position={[0, 1.95, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 0.14, 16]} />
          <ToonMat color={PAL.water} />
        </mesh>
        {[-1.5, 1.5].map((x) => (
          <mesh key={x} position={[x, 3.3, 0]}>
            <cylinderGeometry args={[0.2, 0.24, 3.0, 10]} />
            <ToonMat color={PAL.wood} />
          </mesh>
        ))}
        {/* telhadinho redondo */}
        <mesh position={[0, 5.15, 0]}>
          <coneGeometry args={[2.6, 1.7, 14]} />
          <ToonMat color={PAL.roofs[0]} />
        </mesh>
        <mesh position={[0, 6.1, 0]}>
          <sphereGeometry args={[0.3, 10, 8]} />
          <ToonMat color="#ffd45a" />
        </mesh>
        {/* sarilho e baldinho */}
        <mesh position={[0, 3.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 3.0, 10]} />
          <ToonMat color={PAL.woodDark} />
        </mesh>
        <mesh position={[0, 2.75, 0]}>
          <cylinderGeometry args={[0.42, 0.34, 0.6, 12]} />
          <ToonMat color="#ff8fb8" />
        </mesh>
        <mesh position={[0, 3.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.6, 4]} />
          <ToonMat color="#f6dfb0" />
        </mesh>
      </StaticBatch>
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
        y: 0.2,
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
      <StaticBatch noNearFade>
        {STREAMS.map((s, i) => {
          const cx = pathXAt(s.z)
          return (
            <group key={i}>
              {/* leito de areia clarinha */}
              <mesh position={[cx, -0.06, s.z]}>
                <boxGeometry args={[width, 0.2, s.halfZ * 2 + 1.6]} />
                <ToonMat color={PAL.sand} />
              </mesh>
              {/* espuma nas margens */}
              {[-1, 1].map((f) => (
                <mesh key={f} position={[cx, 0.24, s.z + f * s.halfZ]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.5]}>
                  <capsuleGeometry args={[0.35, width - 1, 4, 8]} />
                  <ToonMat color={PAL.foam} />
                </mesh>
              ))}
              {/* pontezinha de pranchas */}
              {Array.from({ length: Math.round((s.halfZ * 2 + 2.4) / 0.9) }, (_, k) => (
                <RoundedBox
                  key={`pk${k}`}
                  args={[5.2, 0.24, 0.8]}
                  radius={0.1}
                  smoothness={2}
                  bevelSegments={1}
                  position={[cx, 0.32, s.z - (Math.round((s.halfZ * 2 + 2.4) / 0.9) - 1) * 0.45 + k * 0.9]}
                >
                  <ToonMat color={k % 2 ? '#e8b77f' : PAL.wood} />
                </RoundedBox>
              ))}
              {[-2.4, 2.4].map((x) => (
                <group key={x}>
                  <mesh position={[cx + x, 0.75, s.z]} rotation={[Math.PI / 2, 0, 0]}>
                    <capsuleGeometry args={[0.12, s.halfZ * 2 + 2.2, 3, 8]} />
                    <ToonMat color="#f6dfb0" />
                  </mesh>
                  {[-1, 1].map((f) => (
                    <group key={f} position={[cx + x, 0, s.z + f * (s.halfZ + 1.1)]}>
                      <mesh position={[0, 0.45, 0]}>
                        <cylinderGeometry args={[0.16, 0.2, 0.9, 10]} />
                        <ToonMat color={PAL.wood} />
                      </mesh>
                      <mesh position={[0, 0.95, 0]}>
                        <sphereGeometry args={[0.22, 10, 8]} />
                        <ToonMat color={f > 0 ? '#ff8fb8' : '#6ec8ff'} />
                      </mesh>
                    </group>
                  ))}
                </group>
              ))}
            </group>
          )
        })}
        {/* seixos roliços */}
        {decor.map((d, i) => (
          <mesh key={d.key} position={[d.x, d.y, d.z]} rotation={[0, d.rot, 0]} scale={[1, 0.6, 0.85]}>
            <sphereGeometry args={[d.r, 8, 6]} />
            <ToonMat color={i % 3 === 0 ? '#dbe2ec' : PAL.rock} />
          </mesh>
        ))}
      </StaticBatch>

      {/* lâmina d'água (transparente, fora do batch) */}
      {STREAMS.map((s, i) => (
        <mesh key={`w${i}`} position={[pathXAt(s.z), 0.16, s.z]}>
          <boxGeometry args={[width, 0.14, s.halfZ * 2]} />
          <ToonMat color={PAL.water} transparent opacity={0.88} />
        </mesh>
      ))}

      <group ref={ref}>
        {STREAMS.map((s, i) => (
          <mesh key={i} position={[pathXAt(s.z), 0.25, s.z]} scale={[1.8, 0.05, s.halfZ * 0.6]}>
            <sphereGeometry args={[1, 12, 6]} />
            <ToonMat color={PAL.foam} transparent opacity={0.8} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Lagos e poças (um deles congelado, na fase da neve) */
export function Ponds() {
  return (
    <StaticBatch noNearFade>
      {PONDS.map((p, i) => {
        const { x, z } = resolveOnPath(p)
        const fr = p.frozen
        return (
          <group key={i} position={[x, 0, z]}>
            {/* margem de areia */}
            <mesh position={[0, -0.08, 0]}>
              <cylinderGeometry args={[p.r + 1.3, p.r + 1.7, 0.3, 28]} />
              <ToonMat color={fr ? PAL.snowShade : PAL.sand} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[p.r, p.r, 0.16, 28]} />
              <ToonMat color={fr ? PAL.ice : PAL.water} />
            </mesh>
            {/* anel de espuma */}
            <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.4]}>
              <torusGeometry args={[p.r - 0.05, 0.32, 6, 32]} />
              <ToonMat color={fr ? '#ffffff' : PAL.foam} />
            </mesh>
            {/* pedras roliças na margem */}
            {Array.from({ length: 9 }, (_, k) => {
              const a = (k / 9) * Math.PI * 2 + 0.3
              const r = 0.5 + (k % 3) * 0.3
              return (
                <mesh key={k} position={[Math.cos(a) * (p.r + 1.1), 0.2, Math.sin(a) * (p.r + 1.1)]} scale={[1, 0.65, 0.9]}>
                  <sphereGeometry args={[r, 9, 7]} />
                  <ToonMat color={fr ? '#e8f2fb' : k % 2 ? PAL.rock : '#dbe2ec'} />
                </mesh>
              )
            })}
            {/* vitórias-régias com florzinha (só no lago que não congela) */}
            {!fr &&
              [0.9, 2.6, 4.4].map((a, k) => {
                const rr = p.r * (0.45 + (k % 2) * 0.2)
                return (
                  <group key={`lp${k}`} position={[Math.cos(a) * rr, 0.16, Math.sin(a) * rr]}>
                    <mesh>
                      <cylinderGeometry args={[0.9, 0.9, 0.06, 14, 1, false, 0.4, Math.PI * 2 - 0.8]} />
                      <ToonMat color={PAL.leafLight} />
                    </mesh>
                    {k !== 1 && (
                      <mesh position={[0.2, 0.18, 0]}>
                        <sphereGeometry args={[0.26, 10, 8]} />
                        <ToonMat color={PAL.flowers[0]} />
                      </mesh>
                    )}
                  </group>
                )
              })}
          </group>
        )
      })}
    </StaticBatch>
  )
}

/** Placa de madeira fofinha indicando a direção */
export function Signpost({ position = [0, 0, 0], rotation = 0, label = 0 }) {
  const text = SIGN_TEXTS[label] ?? ''
  const plate = ['#ffe3e8', '#e3f3ff', '#fff6c8', '#e8ffe0'][label % 4]
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <StaticBatch>
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 2.8, 10]} />
          <ToonMat color={PAL.wood} />
        </mesh>
        {Array.from({ length: 2 }, (_, i) => (
          <group key={i} position={[0.85 * (i ? -1 : 1), 2.3 - i * 0.62, 0]} rotation={[0, 0, i ? 0.05 : -0.05]}>
            <RoundedBox args={[1.95, 0.52, 0.2]} radius={0.09} smoothness={2} bevelSegments={1}>
              <ToonMat color={i ? PAL.woodDark : PAL.wood} />
            </RoundedBox>
            {/* ponta de seta arredondada */}
            <mesh position={[(i ? -1 : 1) * 0.98, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.26, 0.26, 0.2, 12]} />
              <ToonMat color={i ? PAL.woodDark : PAL.wood} />
            </mesh>
            {/* plaquinha pastel */}
            <RoundedBox args={[1.5, 0.32, 0.24]} radius={0.08} smoothness={2} bevelSegments={1}>
              <ToonMat color={plate} />
            </RoundedBox>
          </group>
        ))}
        <mesh position={[0, 2.88, 0]}>
          <sphereGeometry args={[0.3, 12, 10]} />
          <ToonMat color={label % 2 ? '#ff8fb8' : '#ffd45a'} />
        </mesh>
      </StaticBatch>
      {text && (
        <mesh position={[0.85, 2.3, 0.13]} rotation={[0, 0, -0.05]}>
          <planeGeometry args={[1.4, 0.24]} />
          <meshBasicMaterial color="#fffaf0" transparent opacity={0.95} />
        </mesh>
      )}
    </group>
  )
}
