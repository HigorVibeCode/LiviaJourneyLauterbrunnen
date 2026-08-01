/**
 * Círculos 2D para spawn de itens — só obstáculos que bloqueiam pickup visível.
 * (Fences/logs/hay têm física mas não impedem spawn lateral.)
 */
import { SCATTER_ZONES } from '../config/world.js'
import { generateZoneProps } from '../config/scatter.js'
import {
  buildAdventurePlacements,
  PROP_COLLIDERS,
} from '../config/adventureDecor.js'

export const SPAWN_MARGIN = 2.2

function pushCircle(list, x, z, r) {
  if (Number.isFinite(x) && Number.isFinite(z) && r > 0.05) {
    list.push({ x, z, r })
  }
}

/** Pinheiros, rochas grandes, árvores/crates/barrels do pack */
export function buildSpawnSolidCircles(density = 1) {
  const circles = []

  Object.keys(SCATTER_ZONES).forEach((zoneId) => {
    const z = generateZoneProps(zoneId, density)
    if (!z) return

    z.pines.forEach((p) => pushCircle(circles, p.x, p.z, 0.38 * (p.s ?? 1)))
    z.rocks.forEach((r) => {
      if (r.solid) pushCircle(circles, r.x, r.z, (r.s ?? 1) * 0.5)
    })
  })

  const placements = buildAdventurePlacements(density)
  placements.forEach((p) => {
    const collider = PROP_COLLIDERS[p.prop]
    if (!collider) return
    if (!/Tree|Pine|Maple|Willow|Barrel|Crate|Well|Rocks|rock|Trunk|DeadTree/i.test(p.prop)) return
    const s = p.s ?? 1
    const r = (collider.r ?? 0.5) * s
    pushCircle(circles, p.x, p.z, Math.max(r, 0.4))
  })

  return circles
}

export function distanceToNearestSolid(x, z, circles) {
  let best = Infinity
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i]
    const d = Math.hypot(x - c.x, z - c.z) - c.r
    if (d < best) best = d
  }
  return best
}

export function isClearOfSolids(x, z, margin = SPAWN_MARGIN, circles = SPAWN_SOLIDS) {
  return distanceToNearestSolid(x, z, circles) >= margin
}

/** Bake uma vez — usado por spawn e validate:world */
export const SPAWN_SOLIDS = buildSpawnSolidCircles(1)

/** Física completa (inclui fences, logs, hay) — debug / futuro */
export { buildWorldSolidCircles, WORLD_SOLIDS } from './worldSolidsPhysics.js'
