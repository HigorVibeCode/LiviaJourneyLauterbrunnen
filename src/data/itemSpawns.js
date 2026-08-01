import {
  PHASES,
  GATES,
  CORRIDOR_HALF,
  buildBlockedRects,
  isFreeSpot,
  groundHeightAt,
  makeRng,
  pathXAt,
  pathLateralDist,
} from '../config/world.js'
import { isClearOfSolids, SPAWN_SOLIDS, SPAWN_MARGIN } from './worldSolids.js'

/**
 * Cada item pertence a UMA fase, então na pradaria só nascem a chave e a
 * capa de chuva, no vale das águas só a ferramenta e o casaco, e assim
 * por diante. O sorteio nunca sai dos limites da fase.
 */
export const ITEM_ZONES = {
  chave_portao: { phase: 'meadow' },
  capa_chuva: { phase: 'meadow' },
  fungo_brilho: { phase: 'night' },
  pena_coruja: { phase: 'night' },
  ferramenta: { phase: 'water' },
  casaco: { phase: 'water' },
  cristal: { phase: 'snow' },
  binoculo: { phase: 'snow' },
}

const MIN_GATE_DISTANCE = 24
const EDGE_MARGIN = 9
const SOLID_MARGIN = SPAWN_MARGIN

function round(v) {
  return Math.round(v * 100) / 100
}

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function spawnPoint(x, z, solids) {
  const rx = round(x)
  const rz = round(z)
  if (!isClearOfSolids(rx, rz, SOLID_MARGIN, solids)) return null
  return [rx, groundHeightAt(rx, rz) + 1.1, rz]
}

/** Sorteia um ponto acessível dentro da fase do item, assentado no chão */
export function pickSpawnForItem(itemId, seed = Date.now(), solids = SPAWN_SOLIDS) {
  const mapping = ITEM_ZONES[itemId]
  if (!mapping) return [0, 1, 0]

  const phase = PHASES[mapping.phase]
  const gate = phase.gate ? GATES[phase.gate] : null
  const blocked = buildBlockedRects()
  const rng = makeRng(seed ^ hash(itemId))

  const zMin = phase.zFrom + EDGE_MARGIN
  const zMax = phase.zTo - EDGE_MARGIN
  const latMax = CORRIDOR_HALF - EDGE_MARGIN

  for (let attempt = 0; attempt < 800; attempt++) {
    const z = zMin + rng() * (zMax - zMin)
    const lat = (rng() * 2 - 1) * latMax
    const x = pathXAt(z) + lat

    if (gate && Math.abs(z - gate.z) < MIN_GATE_DISTANCE) continue
    if (!isFreeSpot(x, z, blocked, 3)) continue
    if (pathLateralDist(x, z) < 7) continue

    const pt = spawnPoint(x, z, solids)
    if (pt) return pt
  }

  const zMid = (zMin + zMax) / 2
  for (let lat = 10; lat <= latMax; lat += 1.5) {
    for (const sign of [-1, 1]) {
      for (let zOff = -20; zOff <= 20; zOff += 4) {
        const z = Math.min(zMax, Math.max(zMin, zMid + zOff))
        const fx = pathXAt(z) + sign * lat
        if (
          isFreeSpot(fx, z, blocked, 3) &&
          pathLateralDist(fx, z) >= 7 &&
          (!gate || Math.abs(z - gate.z) >= MIN_GATE_DISTANCE)
        ) {
          const pt = spawnPoint(fx, z, solids)
          if (pt) return pt
        }
      }
    }
  }

  for (let z = zMin; z <= zMax; z += 2.5) {
    for (let lat = 8; lat <= latMax; lat += 2) {
      for (const sign of [-1, 1]) {
        const x = pathXAt(z) + sign * lat
        if (isFreeSpot(x, z, blocked, 3) && pathLateralDist(x, z) >= 7) {
          const pt = spawnPoint(x, z, solids)
          if (pt) return pt
        }
      }
    }
  }

  throw new Error(`pickSpawnForItem: nenhum ponto livre para ${itemId}`)
}

/** Verificação de sanidade: o ponto está mesmo na fase do item? */
export function isSpawnInsideItemZone(itemId, position) {
  const mapping = ITEM_ZONES[itemId]
  if (!mapping) return false
  const phase = PHASES[mapping.phase]
  const z = position[2]
  return z >= phase.zFrom && z <= phase.zTo
}
