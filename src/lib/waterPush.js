import {
  RIVER,
  STREAMS,
  PONDS,
  CLIMB_STREAM,
  STAIRS,
  SUMMIT_Y,
  CORRIDOR_HALF,
  BRIDGE_HALF_X,
  pathXAt,
  resolveOnPath,
} from '../config/world'

const PUSH = 1.85
const PLANK_HALF_X = 4.2
const COOLDOWN = 0.85

let lastComplaintAt = 0

/** Tabuleiro seco da ponte sobre o rio principal. */
function onBridgeDeck(x, z) {
  const riverCx = pathXAt((RIVER.zFrom + RIVER.zTo) / 2)
  const zPad = 4
  return (
    z >= RIVER.zFrom - zPad &&
    z <= RIVER.zTo + zPad &&
    Math.abs(x - riverCx) <= BRIDGE_HALF_X + 0.5
  )
}

/**
 * Testa se (x,z) está em água "profunda" / não atravessável.
 * Pranchas centrais dos riachos e gelo contam como seco.
 * Retorna `{ nx, nz }` normal da margem (empurrar para fora) ou null.
 */
export function waterHitAt(x, z) {
  if (onBridgeDeck(x, z)) return null

  // desfiladeiro do rio — vão centrado na trilha
  const riverCx = pathXAt((RIVER.zFrom + RIVER.zTo) / 2)
  if (z >= RIVER.zFrom && z <= RIVER.zTo && Math.abs(x - riverCx) < RIVER.gapHalfX + 0.4) {
    const nx = x >= riverCx ? 1 : -1
    return { nx, nz: 0, kind: 'river' }
  }

  for (let i = 0; i < STREAMS.length; i++) {
    const s = STREAMS[i]
    const cx = pathXAt(s.z)
    if (Math.abs(z - s.z) <= s.halfZ && Math.abs(x - cx) < CORRIDOR_HALF - 1) {
      // prancha no centro da trilha é atravessável
      if (Math.abs(x - cx) <= PLANK_HALF_X) continue
      const nz = z >= s.z ? 1 : -1
      return { nx: 0, nz, kind: 'stream' }
    }
  }

  for (let i = 0; i < PONDS.length; i++) {
    const p = PONDS[i]
    if (p.frozen) continue
    const world = resolveOnPath(p)
    const dx = x - world.x
    const dz = z - world.z
    const d = Math.hypot(dx, dz)
    if (d < p.r - 0.15) {
      const inv = d > 0.05 ? 1 / d : 1
      return { nx: dx * inv, nz: dz * inv, kind: 'pond' }
    }
  }

  // riacho da escadaria
  const stairsLen = (STAIRS.steps - 1) * STAIRS.stepDepth
  const zTop = STAIRS.zStart - stairsLen
  if (z <= STAIRS.zStart + 1 && z >= zTop - 1) {
    const t = Math.max(0, Math.min(1, (STAIRS.zStart - z) / stairsLen))
    const yWater = t * SUMMIT_Y
    const cx = CLIMB_STREAM.x
    if (Math.abs(x - cx) < CLIMB_STREAM.halfWidth) {
      // só empurra se o jogador está à altura da água (±1.2)
      void yWater
      const nx = x >= cx ? 1 : -1
      return { nx, nz: 0, kind: 'climb' }
    }
  }

  return null
}

/**
 * Se Livia pisou na água: empurra para fora e sinaliza reclamação.
 * `prev` = posição anterior (para empurrar de onde veio se a normal for fraca).
 * Retorna `{ x, z, complained }` ou null se seco.
 */
export function resolveWaterPush(x, z, prevX, prevZ, now = performance.now() / 1000) {
  const hit = waterHitAt(x, z)
  if (!hit) return null

  let nx = hit.nx
  let nz = hit.nz
  const fromDx = (prevX ?? x) - x
  const fromDz = (prevZ ?? z) - z
  const fromLen = Math.hypot(fromDx, fromDz)
  if (fromLen > 0.02 && nx * nx + nz * nz < 0.25) {
    nx = fromDx / fromLen
    nz = fromDz / fromLen
  } else if (fromLen > 0.02) {
    // mistura leve com direção de origem
    nx = nx * 0.7 + (fromDx / fromLen) * 0.3
    nz = nz * 0.7 + (fromDz / fromLen) * 0.3
    const nlen = Math.hypot(nx, nz) || 1
    nx /= nlen
    nz /= nlen
  }

  let complained = false
  if (now - lastComplaintAt >= COOLDOWN) {
    lastComplaintAt = now
    complained = true
  }

  return {
    x: x + nx * PUSH,
    z: z + nz * PUSH,
    complained,
    kind: hit.kind,
  }
}

export const WATER_COMPLAINTS = [
  'Ai, está frio!',
  'Ui! Molhou o pé!',
  'Essa água está gelada!',
]
