import {
  GATES,
  PHASES,
  RIVER,
  RIVER_CX,
  STAIRS,
  buildBlockedRects,
  groundHeightAt,
  isFreeSpot,
  makeRng,
  pathXAt,
} from './world.js'
import { waterHitAt } from '../lib/waterPush.js'
import { isClearOfSolids } from '../data/worldSolids.js'

/**
 * Estrelinhas douradas espalhadas pelo vale — recompensa constante
 * entre um objetivo e outro. Posições fixas (seed), então o save guarda
 * só os índices coletados.
 *
 *  — trilhas de 3–5 estrelas em arco ao longo do caminho
 *  — de vez em quando um "desvio" mais longe, para explorar
 */
function buildStars() {
  const rng = makeRng(777001)
  const out = []
  // só casas/lagos/cachoeiras (não portões/escada: lá a trilha passa)
  const blocked = buildBlockedRects().filter((r) => r.halfX < 30)
  const gateZs = Object.values(GATES).map((g) => g.z)
  const zStart = PHASES.meadow.zTo - 14
  const zEnd = PHASES.summit.zFrom + 30

  for (let z0 = zStart; z0 > zEnd; z0 -= 24 + rng() * 10) {
    const detour = rng() < 0.28
    const n = detour ? 3 : 3 + Math.floor(rng() * 3)
    const lat0 = detour ? (rng() < 0.5 ? -1 : 1) * (14 + rng() * 14) : (rng() - 0.5) * 6
    const bend = (rng() - 0.5) * 1.6
    for (let i = 0; i < n; i++) {
      const z = z0 - i * 2.6
      if (gateZs.some((gz) => Math.abs(z - gz) < 7)) continue
      let x = pathXAt(z) + lat0 + bend * i * i * 0.6
      // ponte: estrelas em cima da ponte, nunca no desfiladeiro
      if (z <= RIVER.zTo + 3 && z >= RIVER.zFrom - 3) x = RIVER_CX + (rng() - 0.5) * 4
      if (waterHitAt(x, z)) continue
      const onTrail = Math.abs(x - pathXAt(z)) < 4
      if (!onTrail && (!isFreeSpot(x, z, blocked, 1) || !isClearOfSolids(x, z, 1.2))) continue
      // escadaria: só no meio dos degraus
      if (z <= STAIRS.zStart && z >= STAIRS.zStart - STAIRS.steps * STAIRS.stepDepth) {
        if (Math.abs(x) > STAIRS.halfWidth - 3) x = Math.sign(x) * (STAIRS.halfWidth - 3)
      }
      out.push({ x, y: groundHeightAt(x, z) + 1.05, z })
    }
  }
  return out
}

export const STARS = buildStars()
