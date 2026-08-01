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

/** Sorteia um ponto acessível dentro da fase do item, assentado no chão */
export function pickSpawnForItem(itemId, seed = Date.now()) {
  const mapping = ITEM_ZONES[itemId]
  if (!mapping) return [0, 1, 0]

  const phase = PHASES[mapping.phase]
  const gate = phase.gate ? GATES[phase.gate] : null
  const blocked = buildBlockedRects()
  const rng = makeRng(seed ^ hash(itemId))

  const zMin = phase.zFrom + EDGE_MARGIN
  const zMax = phase.zTo - EDGE_MARGIN
  const latMax = CORRIDOR_HALF - EDGE_MARGIN

  for (let attempt = 0; attempt < 500; attempt++) {
    const z = zMin + rng() * (zMax - zMin)
    const lat = (rng() * 2 - 1) * latMax
    const x = pathXAt(z) + lat

    if (gate && Math.abs(z - gate.z) < MIN_GATE_DISTANCE) continue
    if (pathLateralDist(x, z) < 7) continue
    if (!isFreeSpot(x, z, blocked, 3)) continue

    return [round(x), groundHeightAt(x, z) + 1.1, round(z)]
  }

  const zMid = (zMin + zMax) / 2
  const fx = pathXAt(zMid) + 14
  return [round(fx), groundHeightAt(fx, zMid) + 1.1, round(zMid)]
}

/** Verificação de sanidade: o ponto está mesmo na fase do item? */
export function isSpawnInsideItemZone(itemId, position) {
  const mapping = ITEM_ZONES[itemId]
  if (!mapping) return false
  const phase = PHASES[mapping.phase]
  const z = position[2]
  return z >= phase.zFrom && z <= phase.zTo
}

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
