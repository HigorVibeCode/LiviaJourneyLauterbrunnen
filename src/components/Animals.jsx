import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  SCATTER_ZONES,
  buildBlockedRects,
  isFreeSpot,
  groundHeightAt,
  makeRng,
} from '../config/world'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'

/**
 * Fauna alpina. Todos os bichos são atualizados por UM único useFrame
 * (em vez de um por animal), então dá para ter dezenas sem custo de CPU.
 */

const SPECIES = {
  rabbit: { body: '#c9bfae', dark: '#a89c88', size: 0.42, speed: 2.6, hop: true, ears: 'long' },
  marmot: { body: '#8a6a44', dark: '#6b5232', size: 0.5, speed: 1.6, hop: false },
  fox: { body: '#d4713a', dark: '#a8542a', size: 0.62, speed: 3.4, tail: true },
  goat: { body: '#e8e4da', dark: '#c4bfb2', size: 0.8, speed: 1.9, horns: true },
  sheep: { body: '#f2efe6', dark: '#d8d2c4', size: 0.85, speed: 1.5, fluffy: true },
  cow: { body: '#f4f0e8', dark: '#3a3630', size: 1.25, speed: 1.2, horns: true, bell: true },
  deer: { body: '#a87848', dark: '#7a5432', size: 1.15, speed: 3, antlers: true },
  bear: { body: '#5c4028', dark: '#3f2b1a', size: 1.5, speed: 1.6 },
  hare: { body: '#f2f4f6', dark: '#d4dce2', size: 0.44, speed: 2.8, hop: true, ears: 'long' },
  ibex: { body: '#9a8a72', dark: '#6b5f4c', size: 0.9, speed: 2.1, horns: true },
  reindeer: { body: '#8a7a68', dark: '#5c503f', size: 1.2, speed: 2.6, antlers: true },
}

/** Fauna por bioma — cada fase tem a sua bicharada */
const ZONE_FAUNA = {
  meadow: [
    'cow', 'cow', 'cow', 'sheep', 'sheep', 'sheep', 'sheep',
    'rabbit', 'rabbit', 'rabbit', 'goat', 'goat', 'fox', 'marmot', 'deer',
  ],
  water: [
    'deer', 'deer', 'deer', 'fox', 'fox', 'rabbit', 'rabbit', 'rabbit',
    'goat', 'goat', 'marmot', 'marmot', 'sheep', 'sheep', 'bear', 'cow',
  ],
  snow: [
    'hare', 'hare', 'hare', 'ibex', 'ibex', 'reindeer', 'reindeer',
    'fox', 'marmot', 'deer', 'bear',
  ],
  climb: ['ibex', 'ibex', 'goat', 'marmot', 'hare', 'reindeer'],
  summitTop: ['ibex', 'marmot', 'hare'],
}

export default function Animals() {
  const quality = useGameStore((s) => s.quality)
  const density = (QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium).density
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
          x = (rng() * 2 - 1) * maxX
          z = zone.zFrom + 8 + rng() * Math.max(4, zone.zTo - zone.zFrom - 16)
          ok = isFreeSpot(x, z, blocked, 5) && Math.abs(x) > 8
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
      {/* insetos só em Alta — no medium eram partículas extras sem valor de gameplay */}
      {density >= 0.7 && (
        <>
          <Butterflies density={density} paused={paused} />
          <Bees density={density} paused={paused} />
        </>
      )}
    </group>
  )
}

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

  const legY = s * 0.62
  const legLen = s * 0.62

  return (
    <group
      ref={(el) => {
        entry.current.root = el
        if (el) el.position.set(def.home[0], def.home[1], def.home[2])
      }}
      scale={def.scale}
    >
      {/* corpo */}
      <mesh castShadow position={[0, legY + s * 0.42, 0]}>
        <capsuleGeometry args={[s * 0.4, s * 0.72, 4, 7]} />
        <meshStandardMaterial color={spec.body} flatShading />
      </mesh>
      {spec.fluffy && (
        <>
          <mesh castShadow position={[0, legY + s * 0.6, s * 0.1]}>
            <sphereGeometry args={[s * 0.55, 6, 5]} />
            <meshStandardMaterial color={spec.body} flatShading />
          </mesh>
          <mesh castShadow position={[0, legY + s * 0.55, -s * 0.4]}>
            <sphereGeometry args={[s * 0.45, 6, 5]} />
            <meshStandardMaterial color={spec.body} flatShading />
          </mesh>
        </>
      )}
      {def.type === 'cow' && (
        <>
          <mesh position={[s * 0.28, legY + s * 0.62, s * 0.15]}>
            <sphereGeometry args={[s * 0.26, 5, 4]} />
            <meshStandardMaterial color={spec.dark} flatShading />
          </mesh>
          <mesh position={[-s * 0.3, legY + s * 0.55, -s * 0.3]}>
            <sphereGeometry args={[s * 0.22, 5, 4]} />
            <meshStandardMaterial color={spec.dark} flatShading />
          </mesh>
        </>
      )}

      {/* cabeça */}
      <group
        ref={(el) => {
          entry.current.head = el
        }}
        position={[0, legY + s * 0.78, s * 0.62]}
      >
        <mesh castShadow>
          <boxGeometry args={[s * 0.44, s * 0.44, s * 0.55]} />
          <meshStandardMaterial color={spec.body} flatShading />
        </mesh>
        <mesh position={[0, -s * 0.05, s * 0.34]}>
          <boxGeometry args={[s * 0.26, s * 0.2, s * 0.16]} />
          <meshStandardMaterial color={spec.dark} flatShading />
        </mesh>
        {[0.14, -0.14].map((o) => (
          <mesh key={o} position={[o * s * 1.2, s * 0.1, s * 0.26]}>
            <sphereGeometry args={[s * 0.055, 5, 4]} />
            <meshStandardMaterial color="#20180f" flatShading />
          </mesh>
        ))}
        {spec.ears === 'long' &&
          [0.13, -0.13].map((o) => (
            <mesh key={o} castShadow position={[o * s, s * 0.42, -s * 0.05]} rotation={[-0.2, 0, o * 2]}>
              <capsuleGeometry args={[s * 0.07, s * 0.44, 3, 5]} />
              <meshStandardMaterial color={spec.dark} flatShading />
            </mesh>
          ))}
        {!spec.ears &&
          [0.2, -0.2].map((o) => (
            <mesh key={o} position={[o * s, s * 0.26, -s * 0.05]}>
              <coneGeometry args={[s * 0.1, s * 0.2, 4]} />
              <meshStandardMaterial color={spec.dark} flatShading />
            </mesh>
          ))}
        {spec.horns &&
          [0.18, -0.18].map((o) => (
            <mesh key={o} castShadow position={[o * s, s * 0.3, 0]} rotation={[0, 0, o * 3]}>
              <coneGeometry args={[s * 0.07, s * 0.42, 5]} />
              <meshStandardMaterial color="#d8cdb4" flatShading />
            </mesh>
          ))}
        {spec.antlers &&
          [0.16, -0.16].map((o) => (
            <group key={o} position={[o * s, s * 0.3, 0]}>
              <mesh castShadow rotation={[0, 0, o * 2.2]}>
                <cylinderGeometry args={[s * 0.035, s * 0.05, s * 0.6, 4]} />
                <meshStandardMaterial color="#8a6a44" flatShading />
              </mesh>
              <mesh castShadow position={[o * s * 0.25, s * 0.36, 0]} rotation={[0, 0, o * 3.6]}>
                <cylinderGeometry args={[s * 0.025, s * 0.035, s * 0.34, 4]} />
                <meshStandardMaterial color="#8a6a44" flatShading />
              </mesh>
            </group>
          ))}
        {spec.bell && (
          <mesh position={[0, -s * 0.22, s * 0.1]}>
            <sphereGeometry args={[s * 0.09, 5, 4]} />
            <meshStandardMaterial color="#c9a227" flatShading metalness={0.6} roughness={0.4} />
          </mesh>
        )}
      </group>

      {/* patas */}
      {[
        [s * 0.24, s * 0.34],
        [-s * 0.24, s * 0.34],
        [s * 0.24, -s * 0.34],
        [-s * 0.24, -s * 0.34],
      ].map(([lx, lz], i) => (
        <group
          key={i}
          ref={(el) => {
            entry.current.legs[i] = el
          }}
          position={[lx, legY, lz]}
        >
          <mesh castShadow position={[0, -legLen / 2, 0]}>
            <cylinderGeometry args={[s * 0.075, s * 0.06, legLen, 5]} />
            <meshStandardMaterial color={spec.dark} flatShading />
          </mesh>
        </group>
      ))}

      {/* cauda */}
      <group
        ref={(el) => {
          entry.current.tail = el
        }}
        position={[0, legY + s * 0.5, -s * 0.7]}
      >
        <mesh castShadow rotation={[spec.tail ? -0.4 : 0.6, 0, 0]}>
          <capsuleGeometry args={[s * (spec.tail ? 0.14 : 0.06), s * (spec.tail ? 0.6 : 0.3), 3, 5]} />
          <meshStandardMaterial color={spec.tail ? spec.dark : spec.body} flatShading />
        </mesh>
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

  return (
    <group ref={ref} position={def.center}>
      {Array.from({ length: def.birds }, (_, i) => (
        <group key={i} position={[(i % 3 - 1) * 2.2, (i % 2) * 1.1, Math.floor(i / 3) * 2]}>
          <mesh>
            <capsuleGeometry args={[0.13, 0.34, 3, 5]} />
            <meshStandardMaterial color="#3a3a42" flatShading />
          </mesh>
          {[0, 1].map((w) => (
            <group
              key={w}
              ref={(el) => {
                wings.current[i * 2 + w] = el
              }}
            >
              <mesh position={[(w ? 1 : -1) * 0.42, 0.06, 0]}>
                <boxGeometry args={[0.8, 0.05, 0.28]} />
                <meshStandardMaterial color="#4a4a54" flatShading />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

function Butterflies({ density, paused }) {
  const groups = useMemo(() => {
    const rng = makeRng(9090)
    // só nos biomas com flores: pradaria, vale das águas e mirante
    const bands = [
      [26, 110],
      [26, 110],
      [26, 110],
      [-116, 6],
      [-116, 6],
      [-116, 6],
      [-116, 6],
      [-340, -302],
    ]
    return Array.from({ length: Math.max(4, Math.round(bands.length * density)) }, (_, i) => {
      const [zA, zB] = bands[i % bands.length]
      return {
        key: i,
        center: [(rng() * 2 - 1) * 44, 1.6 + (zA < -300 ? 8 : 0), zA + rng() * (zB - zA)],
        count: 7,
        colors: ['#f0d24a', '#e8845a', '#9a7ae0', '#f4f0e0', '#7ec8f0'],
      }
    })
  }, [density])

  const refs = useRef([])

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
            >
              <boxGeometry args={[0.3, 0.02, 0.18]} />
              <meshStandardMaterial
                color={g.colors[i % g.colors.length]}
                flatShading
                emissive={g.colors[i % g.colors.length]}
                emissiveIntensity={0.25}
              />
            </mesh>
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
      [30, 108],
      [30, 108],
      [30, 108],
      [-112, 4],
      [-112, 4],
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
        x = (rng() * 2 - 1) * 44
        z = band[0] + rng() * (band[1] - band[0])
        ok = isFreeSpot(x, z, blocked, 2) && Math.abs(x) > 9
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
            >
              <capsuleGeometry args={[0.055, 0.09, 2, 5]} />
              <meshStandardMaterial
                color="#e8b830"
                flatShading
                emissive="#c89020"
                emissiveIntensity={0.4}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
