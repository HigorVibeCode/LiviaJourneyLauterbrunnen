import { useLayoutEffect, useMemo, useRef } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import {
  SCATTER_ZONES,
  buildBlockedRects,
  isFreeSpot,
  groundHeightAt,
  makeRng,
  pathXAt,
} from '../config/world'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'
import { playerPosition } from '../store/playerStore'
import StaticBatch from './world/StaticBatch'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const ANIMAL_VIEW = 75

/**
 * Fauna alpina. Todos os bichos são atualizados por UM único useFrame
 * (em vez de um por animal), então dá para ter dezenas sem custo de CPU.
 */

const SPECIES = {
  rabbit: {
    body: '#f6dcbc', shade: '#e9c69c', belly: '#fff7ec', accent: '#ffb3c6',
    size: 0.42, speed: 2.6, hop: true, ears: 'long', tail: 'puff',
  },
  marmot: {
    body: '#eab676', shade: '#d99e5c', belly: '#fff0d8', accent: '#ff9db5',
    size: 0.5, speed: 1.6, hop: false, ears: 'round', tail: 'stub', teeth: true,
  },
  fox: {
    body: '#ff9a4a', shade: '#f0823a', belly: '#fffaf0', accent: '#ffd9c4',
    size: 0.62, speed: 3.4, ears: 'pointy', tail: 'fox', snout: 'long',
  },
  goat: {
    body: '#fffaf2', shade: '#efe4d6', belly: '#ffffff', accent: '#ffc2cf',
    size: 0.8, speed: 1.9, horns: 'goat', ears: 'side', tail: 'stub', beard: true,
  },
  sheep: {
    body: '#ffffff', shade: '#f1ecff', belly: '#ffe2d2', accent: '#ffb3c6',
    size: 0.85, speed: 1.5, fluffy: true, ears: 'side', tail: 'stub',
  },
  cow: {
    body: '#fffdf8', shade: '#f0e8de', belly: '#fffdf8', muzzle: '#ffc4d2', accent: '#ff9db5',
    spots: '#e6b07c', size: 1.25, speed: 1.2, horns: 'cow', ears: 'side', tail: 'rope', bell: true,
  },
  deer: {
    body: '#efae6e', shade: '#e09a58', belly: '#fff3e2', accent: '#ffc2cf',
    spots: '#fff3e2', size: 1.15, speed: 3, antlers: true, ears: 'side', tail: 'puff',
  },
  bear: {
    body: '#d99a62', shade: '#c9864e', belly: '#ffe9cc', accent: '#ffb3c6',
    size: 1.5, speed: 1.6, ears: 'round', tail: 'stub',
  },
  hare: {
    body: '#ffffff', shade: '#e6f0fb', belly: '#ffffff', accent: '#ffb3c6',
    size: 0.44, speed: 2.8, hop: true, ears: 'long', tail: 'puff',
  },
  ibex: {
    body: '#e2c29a', shade: '#d2ad82', belly: '#fff4e4', accent: '#ffc2cf',
    size: 0.9, speed: 2.1, horns: 'ibex', ears: 'side', tail: 'stub', beard: true,
  },
  reindeer: {
    body: '#d6a06c', shade: '#c48a56', belly: '#fff6e8', accent: '#ff5a6a',
    size: 1.2, speed: 2.6, antlers: true, ears: 'side', tail: 'puff', ruff: true, redNose: true,
  },
}

/** Fauna por bioma — cada fase tem a sua bicharada */
const ZONE_FAUNA = {
  meadow: [
    'cow', 'cow', 'cow', 'sheep', 'sheep', 'sheep', 'sheep',
    'rabbit', 'rabbit', 'rabbit', 'goat', 'goat', 'fox', 'marmot', 'deer',
  ],
  pasture: [
    'sheep', 'sheep', 'sheep', 'sheep', 'cow', 'cow',
    'goat', 'goat', 'rabbit', 'rabbit', 'marmot', 'deer',
  ],
  night: [
    'fox', 'fox', 'rabbit', 'rabbit', 'deer', 'marmot', 'bear',
  ],
  water: [
    'deer', 'deer', 'deer', 'fox', 'fox', 'rabbit', 'rabbit', 'rabbit',
    'goat', 'goat', 'marmot', 'marmot', 'sheep', 'sheep', 'bear', 'cow',
  ],
  snow: [
    'hare', 'hare', 'hare', 'ibex', 'ibex', 'reindeer', 'reindeer',
    'fox', 'marmot', 'deer', 'bear',
  ],
  flower: [
    'rabbit', 'rabbit', 'goat', 'goat', 'sheep', 'sheep', 'deer', 'fox',
  ],
  climb: ['ibex', 'ibex', 'goat', 'marmot', 'hare', 'reindeer'],
  summitTop: ['ibex', 'marmot', 'hare', 'cow'],
}

export default function Animals() {
  const quality = useGameStore((s) => s.quality)
  const density = (QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium).density
  const insectDensity = quality === 'high' ? density : density * 0.85
  const paused = useGameStore((s) => s.paused)

  const herds = useMemo(() => {
    const blocked = buildBlockedRects()
    const rng = makeRng(4242)
    const list = []

    Object.entries(ZONE_FAUNA).forEach(([zoneId, species]) => {
      const zone = SCATTER_ZONES[zoneId]
      if (!zone) return
      const count = Math.max(1, Math.round(species.length * density))
      // no mirante o platô é estreito: manter os bichos sobre o piso
      const maxX = zoneId === 'summitTop' ? 14 : 48

      for (let i = 0; i < count; i++) {
        const type = species[i % species.length]
        let x = 0
        let z = 0
        let ok = false
        for (let a = 0; a < 60 && !ok; a++) {
          const lat = (rng() * 2 - 1) * maxX
          z = zone.zFrom + 8 + rng() * Math.max(4, zone.zTo - zone.zFrom - 16)
          x = pathXAt(z) + lat
          ok = isFreeSpot(x, z, blocked, 5) && Math.abs(lat) > 8
        }
        if (!ok) continue

        list.push({
          key: `${zoneId}-${i}`,
          type,
          home: [x, groundHeightAt(x, z), z],
          radius: 4 + rng() * 9,
          phase: rng() * Math.PI * 2,
          rate: 0.1 + rng() * 0.22,
          scale: 0.85 + rng() * 0.4,
        })
      }
    })

    return list
  }, [density])

  const flocks = useMemo(() => {
    const rng = makeRng(8181)
    return Array.from({ length: Math.max(2, Math.round(6 * density)) }, (_, i) => ({
      key: `flock-${i}`,
      center: [(rng() * 2 - 1) * 40, 16 + rng() * 16, 100 - i * 72 - rng() * 30],
      radius: 12 + rng() * 14,
      rate: 0.16 + rng() * 0.14,
      birds: 5,
    }))
  }, [density])

  const entries = useRef([])

  useFrame((state) => {
    if (paused) return
    const t = state.clock.elapsedTime

    for (let i = 0; i < entries.current.length; i++) {
      const e = entries.current[i]
      if (!e?.root) continue

      // bichos longe: escondidos e sem animar (eram ~700 draw calls)
      const far =
        Math.abs(e.home[2] - playerPosition.z) > ANIMAL_VIEW ||
        Math.abs(e.home[0] - playerPosition.x) > ANIMAL_VIEW
      e.root.visible = !far
      if (far) continue

      const angle = e.phase + t * e.rate
      // pausas naturais: o bicho para de vez em quando
      const activity = Math.max(0, Math.sin(angle * 3.1) * 0.5 + 0.6)
      const r = e.radius * (0.7 + Math.sin(angle * 1.7) * 0.3)
      const x = e.home[0] + Math.cos(angle) * r
      const z = e.home[2] + Math.sin(angle * 1.3) * r

      const dx = x - e.root.position.x
      const dz = z - e.root.position.z
      const moved = Math.hypot(dx, dz)

      e.root.position.x = x
      e.root.position.z = z
      if (moved > 0.0005) e.root.rotation.y = Math.atan2(dx, dz)

      const spec = SPECIES[e.type]
      const gait = t * (spec.speed * 2.6) * activity
      if (spec.hop) {
        const hop = Math.max(0, Math.sin(gait)) * 0.3 * activity
        e.root.position.y = e.home[1] + hop
        e.root.rotation.x = -hop * 0.5
      } else {
        e.root.position.y = e.home[1] + Math.abs(Math.sin(gait)) * 0.04
      }

      const swing = Math.sin(gait) * 0.7 * activity
      if (e.legs[0]) e.legs[0].rotation.x = swing
      if (e.legs[1]) e.legs[1].rotation.x = -swing
      if (e.legs[2]) e.legs[2].rotation.x = -swing
      if (e.legs[3]) e.legs[3].rotation.x = swing
      if (e.head) e.head.rotation.x = 0.12 + Math.sin(t * 0.9 + e.phase) * 0.28
      if (e.tail) e.tail.rotation.y = Math.sin(gait * 0.8) * 0.5
    }
  })

  return (
    <group>
      {herds.map((h) => (
        <Creature key={h.key} def={h} entries={entries} />
      ))}
      {flocks.map((f) => (
        <BirdFlock key={f.key} def={f} paused={paused} />
      ))}
      <Butterflies density={insectDensity} paused={paused} />
      <Bees density={insectDensity} paused={paused} />
      <Fireflies paused={paused} />
    </group>
  )
}

const EYE = '#4a3a5e'
const NOSE = '#8a5a78'
const CHEEK = '#ffb0c4'
const HORN = '#fff0c8'

/** ponto na superfície de um elipsoide (semi-eixos a,b,c) na direção d */
function onEllipsoid([dx, dy, dz], [a, b, c], inset = 0) {
  const len = Math.hypot(dx, dy, dz) || 1
  const nx = dx / len
  const ny = dy / len
  const nz = dz / len
  const k = 1 / Math.sqrt((nx / a) ** 2 + (ny / b) ** 2 + (nz / c) ** 2)
  return [nx * (k - inset), ny * (k - inset), nz * (k - inset)]
}

const WOOL = [
  [0, 1, 0.1], [0, 0.9, 0.7], [0, 0.8, -0.7], [1, 0.5, 0.4], [-1, 0.5, 0.4],
  [1, 0.4, -0.5], [-1, 0.4, -0.5], [0, 0.2, 1], [0, 0.3, -1], [1, -0.3, 0], [-1, -0.3, 0],
]
const COW_SPOTS = [
  [1, 0.35, 0.3, 0.17], [-1, 0.2, -0.35, 0.19], [0.25, 1, -0.2, 0.15], [0.9, 0.1, -0.7, 0.12],
  [-0.8, 0.5, 0.55, 0.12],
]
const DEER_SPOTS = [
  [0.3, 1, 0.1], [-0.3, 1, -0.15], [0.45, 0.9, -0.45], [-0.45, 0.9, 0.35], [0.1, 1, -0.6],
]

function Creature({ def, entries }) {
  const spec = SPECIES[def.type]
  const s = spec.size * def.scale
  const entry = useRef({ ...def, legs: [], root: null, head: null, tail: null })

  useLayoutEffect(() => {
    const list = entries.current
    const self = entry.current
    list.push(self)
    return () => {
      const i = list.indexOf(self)
      if (i >= 0) list.splice(i, 1)
    }
  }, [entries])

  // proporções de brinquedo (tudo em múltiplos de s)
  const hipY = s * 0.36
  const bodyY = hipY + s * 0.26
  const axes = [s * 0.39, s * 0.345, s * 0.5]
  const headR = s * 0.34
  const hc = [0, s * 0.14, s * 0.16] // centro da cabeça, local ao pescoço
  const faceZ = (x, y) => hc[2] + Math.sqrt(Math.max(0, headR * headR - x * x - y * y))
  const pinkNose = ['rabbit', 'hare', 'cow', 'sheep', 'goat', 'marmot', 'ibex'].includes(def.type)
  const noseColor = spec.redNose ? spec.accent : pinkNose ? spec.accent : NOSE
  const legColor = spec.fluffy ? spec.belly : spec.shade
  const ear = (x, y, z) => [hc[0] + x * s, hc[1] + y * s, hc[2] + z * s]

  return (
    <group
      ref={(el) => {
        entry.current.root = el
        if (el) el.position.set(def.home[0], def.home[1], def.home[2])
      }}
      scale={def.scale}
    >
      {/* corpo gordinho + sombra macia */}
      <StaticBatch>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[0.95, 1.35, 1]}>
          <circleGeometry args={[s * 0.5, 14]} />
          <meshBasicMaterial color="#3b5a3a" transparent opacity={0.18} depthWrite={false} />
        </mesh>
        <group position={[0, bodyY, 0]}>
          <mesh scale={[axes[0], axes[1], axes[2]]}>
            <sphereGeometry args={[1, 14, 10]} />
            <ToonMat color={spec.fluffy ? spec.shade : spec.body} />
          </mesh>
          {/* peito / barriguinha clara */}
          {!spec.fluffy && spec.belly !== spec.body && (
            <mesh position={[0, -s * 0.03, s * 0.34]} scale={[s * 0.25, s * 0.25, s * 0.2]}>
              <sphereGeometry args={[1, 14, 10]} />
              <ToonMat color={spec.belly} />
            </mesh>
          )}
          {spec.ruff &&
            [-1, 0, 1].map((i) => (
              <mesh key={`r${i}`} position={[i * s * 0.12, s * 0.06 - Math.abs(i) * s * 0.06, s * 0.4]}>
                <sphereGeometry args={[s * 0.15, 10, 8]} />
                <ToonMat color={spec.belly} />
              </mesh>
            ))}
          {spec.fluffy &&
            WOOL.map((d, i) => (
              <mesh key={`w${i}`} position={onEllipsoid(d, axes, s * 0.08)}>
                <sphereGeometry args={[s * (i % 3 === 0 ? 0.27 : 0.24), 12, 10]} />
                <ToonMat color={i % 4 === 1 ? spec.shade : spec.body} />
              </mesh>
            ))}
          {def.type === 'cow' &&
            COW_SPOTS.map(([x, y, z, r], i) => (
              <mesh key={`c${i}`} position={onEllipsoid([x, y, z], axes, s * r * 0.8)}>
                <sphereGeometry args={[s * r, 14, 10]} />
                <ToonMat color={spec.spots} />
              </mesh>
            ))}
          {def.type === 'deer' &&
            DEER_SPOTS.map((d, i) => (
              <mesh key={`d${i}`} position={onEllipsoid(d, axes, s * 0.03)}>
                <sphereGeometry args={[s * 0.05, 8, 6]} />
                <ToonMat color={spec.spots} />
              </mesh>
            ))}
        </group>
      </StaticBatch>

      {/* cabeção */}
      <group
        ref={(el) => {
          entry.current.head = el
        }}
        position={[0, hipY + s * 0.55, s * 0.4]}
      >
        <StaticBatch>
          <mesh position={hc}>
            <sphereGeometry args={[headR, 14, 12]} />
            <ToonMat color={spec.fluffy ? spec.belly : spec.body} />
          </mesh>
          {/* focinho */}
          {spec.snout === 'long' ? (
            <mesh position={[0, hc[1] - s * 0.07, hc[2] + s * 0.3]} scale={[0.85, 0.72, 1.3]}>
              <sphereGeometry args={[s * 0.15, 12, 8]} />
              <ToonMat color={spec.belly} />
            </mesh>
          ) : (
            <mesh position={[0, hc[1] - s * 0.09, hc[2] + s * 0.26]} scale={[1.2, 0.85, 0.85]}>
              <sphereGeometry args={[s * 0.15, 12, 8]} />
              <ToonMat color={spec.muzzle ?? spec.belly} />
            </mesh>
          )}
          <mesh
            position={
              spec.snout === 'long'
                ? [0, hc[1] - s * 0.05, hc[2] + s * 0.5]
                : [0, hc[1] - s * 0.04, hc[2] + s * 0.39]
            }
            scale={[1.3, 0.9, 0.9]}
          >
            <sphereGeometry args={[s * (spec.redNose ? 0.07 : 0.05), 10, 8]} />
            <ToonMat color={noseColor} />
          </mesh>
          {/* olhinhos com brilho */}
          {[-1, 1].map((side) => {
            const x = side * s * 0.14
            const y = s * 0.06
            return (
              <group key={`e${side}`} position={[x, hc[1] + y, faceZ(x, y) - s * 0.01]}>
                <mesh scale={[0.85, 1.15, 0.5]}>
                  <sphereGeometry args={[s * 0.055, 10, 8]} />
                  <ToonMat color={EYE} />
                </mesh>
                <mesh position={[s * 0.016, s * 0.024, s * 0.022]}>
                  <sphereGeometry args={[s * 0.021, 6, 5]} />
                  <ToonMat color="#ffffff" />
                </mesh>
              </group>
            )
          })}
          {[-1, 1].map((side) => {
            const x = side * s * 0.22
            const y = -s * 0.07
            return (
              <mesh key={`k${side}`} position={[x, hc[1] + y, faceZ(x, y) - s * 0.03]} scale={[1, 0.65, 0.4]}>
                <sphereGeometry args={[s * 0.06, 8, 6]} />
                <ToonMat color={CHEEK} />
              </mesh>
            )
          })}

          {/* orelhas */}
          {spec.ears === 'long' &&
            [-1, 1].map((side) => (
              <group key={`l${side}`} position={ear(side * 0.12, 0.36, -0.06)} rotation={[-0.2, 0, side * -0.18]}>
                <mesh scale={[1, 1, 0.65]}>
                  <capsuleGeometry args={[s * 0.075, s * 0.34, 4, 10]} />
                  <ToonMat color={spec.body} />
                </mesh>
                <mesh position={[0, 0, s * 0.03]} scale={[0.55, 0.85, 0.4]}>
                  <capsuleGeometry args={[s * 0.075, s * 0.34, 4, 8]} />
                  <ToonMat color={spec.accent} />
                </mesh>
              </group>
            ))}
          {spec.ears === 'round' &&
            [-1, 1].map((side) => (
              <group key={`r${side}`} position={ear(side * 0.24, 0.25, -0.03)}>
                <mesh scale={[1, 1, 0.6]}>
                  <sphereGeometry args={[s * 0.1, 10, 8]} />
                  <ToonMat color={spec.shade} />
                </mesh>
                <mesh position={[0, 0, s * 0.035]} scale={[0.6, 0.6, 0.35]}>
                  <sphereGeometry args={[s * 0.1, 8, 6]} />
                  <ToonMat color={spec.accent} />
                </mesh>
              </group>
            ))}
          {spec.ears === 'pointy' &&
            [-1, 1].map((side) => (
              <group key={`p${side}`} position={ear(side * 0.19, 0.3, -0.02)} rotation={[0, 0, side * -0.38]}>
                <mesh scale={[1, 1, 0.6]}>
                  <coneGeometry args={[s * 0.14, s * 0.26, 12]} />
                  <ToonMat color={spec.body} />
                </mesh>
                <mesh position={[0, -s * 0.02, s * 0.045]} scale={[0.6, 0.7, 0.3]}>
                  <coneGeometry args={[s * 0.14, s * 0.26, 10]} />
                  <ToonMat color={spec.accent} />
                </mesh>
              </group>
            ))}
          {spec.ears === 'side' &&
            [-1, 1].map((side) => (
              <group key={`s${side}`} position={ear(side * 0.33, 0.1, -0.02)} rotation={[0, 0, side * -0.4]}>
                <mesh scale={[1.6, 0.7, 0.5]}>
                  <sphereGeometry args={[s * 0.1, 10, 8]} />
                  <ToonMat color={spec.fluffy ? spec.belly : spec.shade} />
                </mesh>
                <mesh position={[side * s * 0.01, 0, s * 0.03]} scale={[1.1, 0.45, 0.3]}>
                  <sphereGeometry args={[s * 0.1, 8, 6]} />
                  <ToonMat color={spec.accent} />
                </mesh>
              </group>
            ))}

          {/* topete de lã */}
          {spec.fluffy &&
            [-1, 0, 1].map((i) => (
              <mesh key={`t${i}`} position={ear(i * 0.1, 0.3 - Math.abs(i) * 0.04, 0.02)}>
                <sphereGeometry args={[s * 0.12, 10, 8]} />
                <ToonMat color={spec.body} />
              </mesh>
            ))}

          {/* chifres */}
          {spec.horns === 'cow' &&
            [-1, 1].map((side) => (
              <mesh key={`h${side}`} position={ear(side * 0.22, 0.27, -0.02)} rotation={[0, 0, side * -0.75]}>
                <capsuleGeometry args={[s * 0.045, s * 0.1, 4, 8]} />
                <ToonMat color={HORN} />
              </mesh>
            ))}
          {spec.horns === 'goat' &&
            [-1, 1].map((side) => (
              <mesh key={`g${side}`} position={ear(side * 0.12, 0.33, -0.08)} rotation={[-0.65, 0, side * -0.15]}>
                <capsuleGeometry args={[s * 0.05, s * 0.16, 4, 8]} />
                <ToonMat color="#f2dfb4" />
              </mesh>
            ))}
          {spec.horns === 'ibex' &&
            [-1, 1].map((side) => (
              <mesh
                key={`i${side}`}
                position={ear(side * 0.13, 0.15, -0.12)}
                rotation={[0, Math.PI / 2, side * 0.18]}
              >
                <torusGeometry args={[s * 0.25, s * 0.06, 8, 14, 2.4]} />
                <ToonMat color={spec.shade} />
              </mesh>
            ))}
          {spec.antlers &&
            [-1, 1].map((side) => (
              <group
                key={`a${side}`}
                position={ear(side * 0.15, 0.28, -0.06)}
                rotation={[-0.15, 0, side * -0.4]}
                scale={def.type === 'reindeer' ? 1.3 : 1}
              >
                <mesh position={[0, s * 0.12, 0]}>
                  <capsuleGeometry args={[s * 0.04, s * 0.2, 4, 8]} />
                  <ToonMat color="#f5d9a8" />
                </mesh>
                <mesh position={[side * -s * 0.06, s * 0.16, s * 0.03]} rotation={[0.3, 0, side * 0.9]}>
                  <capsuleGeometry args={[s * 0.035, s * 0.1, 4, 8]} />
                  <ToonMat color="#f5d9a8" />
                </mesh>
                <mesh position={[0, s * 0.27, 0]}>
                  <sphereGeometry args={[s * 0.05, 8, 6]} />
                  <ToonMat color="#f5d9a8" />
                </mesh>
              </group>
            ))}
          {spec.beard && (
            <mesh position={[0, hc[1] - s * 0.3, hc[2] + s * 0.18]} rotation={[Math.PI - 0.3, 0, 0]}>
              <coneGeometry args={[s * 0.06, s * 0.16, 10]} />
              <ToonMat color={spec.shade} />
            </mesh>
          )}
          {spec.teeth &&
            [-1, 1].map((side) => (
              <mesh key={`d${side}`} position={[side * s * 0.022, hc[1] - s * 0.19, hc[2] + s * 0.32]}>
                <boxGeometry args={[s * 0.04, s * 0.06, s * 0.02]} />
                <ToonMat color="#ffffff" />
              </mesh>
            ))}
          {spec.bell && (
            <>
              <mesh position={[0, hc[1] - s * 0.25, hc[2] - s * 0.06]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
                <torusGeometry args={[s * 0.2, s * 0.035, 6, 18]} />
                <ToonMat color="#ff6b6b" />
              </mesh>
              <mesh position={[0, hc[1] - s * 0.36, hc[2] + s * 0.12]}>
                <sphereGeometry args={[s * 0.075, 10, 8]} />
                <ToonMat color="#ffd23f" />
              </mesh>
            </>
          )}
        </StaticBatch>
      </group>

      {/* perninhas curtas */}
      {[
        [s * 0.21, s * 0.27],
        [-s * 0.21, s * 0.27],
        [s * 0.21, -s * 0.27],
        [-s * 0.21, -s * 0.27],
      ].map(([lx, lz], i) => (
        <group
          key={i}
          ref={(el) => {
            entry.current.legs[i] = el
          }}
          position={[lx, hipY, lz]}
        >
          <mesh position={[0, -hipY / 2, 0]}>
            <capsuleGeometry args={[s * 0.12, Math.max(0.01, hipY - s * 0.24), 4, 10]} />
            <ToonMat color={legColor} />
          </mesh>
        </group>
      ))}

      {/* rabinho */}
      <group
        ref={(el) => {
          entry.current.tail = el
        }}
        position={[0, bodyY + s * 0.08, -axes[2] + s * 0.04]}
      >
        <StaticBatch>
          {spec.tail === 'puff' && (
            <mesh position={[0, 0, -s * 0.03]}>
              <sphereGeometry args={[s * 0.11, 10, 8]} />
              <ToonMat color={def.type === 'reindeer' || def.type === 'deer' ? spec.belly : '#ffffff'} />
            </mesh>
          )}
          {spec.tail === 'stub' && (
            <mesh position={[0, 0, -s * 0.03]}>
              <sphereGeometry args={[s * 0.09, 10, 8]} />
              <ToonMat color={spec.fluffy ? spec.body : spec.shade} />
            </mesh>
          )}
          {spec.tail === 'fox' && (
            <>
              <mesh position={[0, s * 0.1, -s * 0.2]} rotation={[-0.9, 0, 0]} scale={[1, 1, 1]}>
                <capsuleGeometry args={[s * 0.14, s * 0.26, 4, 10]} />
                <ToonMat color={spec.body} />
              </mesh>
              <mesh position={[0, s * 0.25, -s * 0.38]}>
                <sphereGeometry args={[s * 0.14, 10, 8]} />
                <ToonMat color={spec.belly} />
              </mesh>
            </>
          )}
          {spec.tail === 'rope' && (
            <>
              <mesh position={[0, -s * 0.16, -s * 0.05]} rotation={[0.25, 0, 0]}>
                <capsuleGeometry args={[s * 0.03, s * 0.28, 3, 6]} />
                <ToonMat color={spec.shade} />
              </mesh>
              <mesh position={[0, -s * 0.34, -s * 0.1]}>
                <sphereGeometry args={[s * 0.06, 8, 6]} />
                <ToonMat color={spec.spots} />
              </mesh>
            </>
          )}
        </StaticBatch>
      </group>
    </group>
  )
}

function BirdFlock({ def, paused }) {
  const ref = useRef(null)
  const wings = useRef([])

  useFrame((state) => {
    if (paused || !ref.current) return
    const t = state.clock.elapsedTime
    const a = t * def.rate
    ref.current.position.x = def.center[0] + Math.cos(a) * def.radius
    ref.current.position.z = def.center[2] + Math.sin(a * 1.2) * def.radius
    ref.current.position.y = def.center[1] + Math.sin(a * 2) * 2.5
    ref.current.rotation.y = -a * 1.1

    const flap = Math.sin(t * 9) * 0.85
    for (let i = 0; i < wings.current.length; i++) {
      const w = wings.current[i]
      if (w) w.rotation.z = (i % 2 ? flap : -flap)
    }
  })

  const [main, belly] = BIRD_COLORS[(parseInt(def.key.split('-')[1], 10) || 0) % BIRD_COLORS.length]
  const spots = Array.from({ length: def.birds }, (_, i) => [
    (i % 3 - 1) * 2.2,
    (i % 2) * 1.1,
    Math.floor(i / 3) * 2,
  ])

  return (
    <group ref={ref} position={def.center}>
      {/* corpinhos redondos (estáticos dentro do bando) */}
      <StaticBatch noNearFade>
        {spots.map((p, i) => (
          <group key={i} position={p}>
            <mesh scale={[1, 0.9, 1.25]}>
              <sphereGeometry args={[0.22, 10, 8]} />
              <ToonMat color={main} />
            </mesh>
            <mesh position={[0, -0.05, 0.08]} scale={[0.8, 0.7, 0.9]}>
              <sphereGeometry args={[0.2, 8, 6]} />
              <ToonMat color={belly} />
            </mesh>
            <mesh position={[0, 0.14, 0.24]}>
              <sphereGeometry args={[0.15, 10, 8]} />
              <ToonMat color={main} />
            </mesh>
            <mesh position={[0, 0.12, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.05, 0.12, 8]} />
              <ToonMat color="#ffa63d" />
            </mesh>
            <mesh position={[0, 0.06, -0.3]} rotation={[-1.2, 0, 0]} scale={[1.3, 1, 0.4]}>
              <coneGeometry args={[0.1, 0.22, 8]} />
              <ToonMat color={main} />
            </mesh>
          </group>
        ))}
      </StaticBatch>
      {spots.map((p, i) => (
        <group key={i} position={p}>
          {[0, 1].map((w) => (
            <group
              key={w}
              ref={(el) => {
                wings.current[i * 2 + w] = el
              }}
            >
              <mesh position={[(w ? 1 : -1) * 0.34, 0.06, 0]} scale={[1.5, 0.18, 0.75]}>
                <sphereGeometry args={[0.22, 10, 6]} />
                <ToonMat color={main} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

/** cores dos bandos (corpo, barriga) */
const BIRD_COLORS = [
  ['#5fb3ff', '#ffffff'],
  ['#ff8fb8', '#fff0f6'],
  ['#ffd45a', '#fff8de'],
  ['#7be0a0', '#f2fff6'],
  ['#b48cff', '#f6f0ff'],
  ['#ff8a5c', '#fff3ea'],
]

function Butterflies({ density, paused }) {
  const groups = useMemo(() => {
    const rng = makeRng(9090)
    // só nos biomas com flores: pradaria, vale das águas e mirante
    const bands = [
      [26, 110],
      [-280, 12],
      [-908, -784],
      [-116, 6],
      [-340, -302],
    ]
    return Array.from({ length: Math.max(4, Math.round(bands.length * density)) }, (_, i) => {
      const [zA, zB] = bands[i % bands.length]
      return {
        key: i,
        center: [(rng() * 2 - 1) * 44, 1.6 + (zA < -300 ? 8 : 0), zA + rng() * (zB - zA)],
        count: 7,
        colors: ['#ffd45a', '#ff8fb8', '#b48cff', '#ffffff', '#6ec8ff'],
      }
    })
  }, [density])

  const refs = useRef([])
  // asinhas em V (4 lóbulos) — uma geometria para todas
  const wingGeo = useMemo(() => makeButterflyGeometry(), [])
  const wingMats = useMemo(() => {
    const map = new Map()
    groups.forEach((g) =>
      g.colors.forEach((c) => {
        if (!map.has(c)) {
          map.set(
            c,
            new THREE.MeshLambertMaterial({
              color: c,
              emissive: c,
              emissiveIntensity: 0.25,
              side: THREE.DoubleSide,
            }),
          )
        }
      }),
    )
    return map
  }, [groups])

  useFrame((state) => {
    if (paused) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < refs.current.length; i++) {
      const m = refs.current[i]
      if (!m) continue
      m.position.x = Math.sin(t * 1.3 + i) * 3.4
      m.position.z = Math.cos(t * 1.1 + i * 1.7) * 3.4
      m.position.y = Math.sin(t * 2.2 + i) * 0.7
      m.rotation.z = Math.sin(t * 12 + i) * 0.9
      m.rotation.y = t * 0.8 + i
    }
  })

  return (
    <group>
      {groups.map((g) => (
        <group key={g.key} position={g.center}>
          {Array.from({ length: g.count }, (_, i) => (
            <mesh
              key={i}
              ref={(el) => {
                refs.current[g.key * g.count + i] = el
              }}
              geometry={wingGeo}
              material={wingMats.get(g.colors[i % g.colors.length])}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

/**
 * Enxames de abelhas rondando os canteiros de flores.
 * São corpos minúsculos com voo errático — de perto dá vida ao chão,
 * de longe nem aparece.
 */
function Bees({ density, paused }) {
  const swarms = useMemo(() => {
    const rng = makeRng(1717)
    const blocked = buildBlockedRects()
    const bands = [
      [30, 108],
      [-280, 12],
      [-908, -784],
      [-112, 4],
      [-336, -304],
    ]
    const list = []
    bands.forEach((band, i) => {
      if (i > Math.max(4, bands.length * density)) return
      let x = 0
      let z = 0
      let ok = false
      for (let a = 0; a < 40 && !ok; a++) {
        const lat = (rng() * 2 - 1) * 44
        z = band[0] + rng() * (band[1] - band[0])
        x = pathXAt(z) + lat
        ok = isFreeSpot(x, z, blocked, 2) && Math.abs(lat) > 9
      }
      if (!ok) return
      list.push({
        key: `bee-${i}`,
        center: [x, groundHeightAt(x, z) + 1.1, z],
        count: 6,
        phase: rng() * 6,
      })
    })
    return list
  }, [density])

  const refs = useRef([])
  const beeGeo = useMemo(() => makeBeeGeometry(), [])
  const beeMat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), [])

  useFrame((state) => {
    if (paused) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < refs.current.length; i++) {
      const m = refs.current[i]
      if (!m) continue
      const p = i * 1.7
      m.position.x = Math.sin(t * 2.6 + p) * 1.5 + Math.sin(t * 0.7 + p) * 0.8
      m.position.z = Math.cos(t * 2.2 + p * 1.3) * 1.5
      m.position.y = Math.abs(Math.sin(t * 3.1 + p)) * 0.7 - 0.3
      m.rotation.y = t * 3 + p
    }
  })

  return (
    <group>
      {swarms.map((s, si) => (
        <group key={s.key} position={s.center}>
          {Array.from({ length: s.count }, (_, i) => (
            <mesh
              key={i}
              ref={(el) => {
                refs.current[si * s.count + i] = el
              }}
              geometry={beeGeo}
              material={beeMat}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Vaga-lumes no vale noturno — enxame pequeno, custo mínimo. */
function Fireflies({ paused }) {
  const swarms = useMemo(() => {
    const rng = makeRng(1313)
    const zA = -520
    const zB = -292
    return Array.from({ length: 2 }, (_, i) => {
      let x = 0
      let z = 0
      let ok = false
      for (let a = 0; a < 30 && !ok; a++) {
        const lat = (rng() * 2 - 1) * 36
        z = zA + rng() * (zB - zA)
        x = pathXAt(z) + lat
        ok = Math.abs(lat) > 6
      }
      return {
        key: `ff-${i}`,
        center: [x, groundHeightAt(x, z) + 1.4, z],
        count: 12,
      }
    })
  }, [])

  const refs = useRef([])

  useFrame((state) => {
    if (paused) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < refs.current.length; i++) {
      const m = refs.current[i]
      if (!m) continue
      const p = i * 1.9
      m.position.x = Math.sin(t * 1.8 + p) * 1.8 + Math.sin(t * 0.5 + p) * 0.6
      m.position.z = Math.cos(t * 1.5 + p * 1.2) * 1.6
      m.position.y = Math.sin(t * 2.8 + p) * 0.9 + 0.2
      const pulse = 0.55 + Math.sin(t * 4 + p) * 0.45
      if (m.material) m.material.emissiveIntensity = pulse
    }
  })

  return (
    <group>
      {swarms.map((s, si) => (
        <group key={s.key} position={s.center}>
          {Array.from({ length: s.count }, (_, i) => (
            <mesh
              key={i}
              ref={(el) => {
                refs.current[si * s.count + i] = el
              }}
            >
              <sphereGeometry args={[0.055, 8, 6]} />
              <ToonMat color="#fff6a0" emissive="#ffe14a" emissiveIntensity={0.8} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** pinta uma geometria inteira com uma cor (vertex colors) */
function tint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo
  const c = new THREE.Color(hex)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  g.deleteAttribute('uv')
  return g
}

/** borboleta: 4 asinhas arredondadas levemente em V */
function makeButterflyGeometry() {
  const parts = []
  for (const side of [-1, 1]) {
    for (const [x, z, sx, sz] of [
      [0.1, 0.04, 1.05, 1.2],
      [0.075, -0.07, 0.75, 0.8],
    ]) {
      const g = new THREE.CircleGeometry(0.1, 12)
      g.rotateX(-Math.PI / 2)
      g.scale(sx, 1, sz)
      g.translate(side * x, 0, z)
      g.rotateZ(side * 0.3)
      parts.push(g)
    }
  }
  const body = new THREE.CapsuleGeometry(0.018, 0.14, 2, 6)
  body.rotateX(Math.PI / 2)
  parts.push(body)
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    g.deleteAttribute('uv')
    return g
  }))
  parts.forEach((g) => g.dispose())
  return merged
}

/** abelhinha gordinha: listras e asinhas brancas */
function makeBeeGeometry() {
  const body = new THREE.SphereGeometry(0.075, 10, 8)
  body.scale(1, 0.9, 1.25)
  const stripes = [0.025, -0.035].map((z) => {
    const g = new THREE.TorusGeometry(0.07, 0.012, 6, 14)
    g.scale(1, 0.92, 1)
    g.translate(0, 0, z)
    return tint(g, '#b9824e')
  })
  const wings = [-1, 1].map((side) => {
    const g = new THREE.SphereGeometry(0.05, 8, 6)
    g.scale(1, 0.25, 0.7)
    g.translate(side * 0.05, 0.07, -0.01)
    return tint(g, '#ffffff')
  })
  const merged = mergeGeometries([tint(body, '#ffd23f'), ...stripes, ...wings])
  return merged
}
