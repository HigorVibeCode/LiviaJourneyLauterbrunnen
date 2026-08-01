/**
 * Círculos 2D de props sólidos — bake estático para física / debug.
 */
import { SCATTER_ZONES } from '../config/world.js'
import { generateZoneProps } from '../config/scatter.js'
import {
  buildAdventurePlacements,
  PROP_COLLIDERS,
} from '../config/adventureDecor.js'

function pushCircle(list, x, z, r) {
  if (Number.isFinite(x) && Number.isFinite(z) && r > 0.05) {
    list.push({ x, z, r })
  }
}

export function buildWorldSolidCircles(density = 1) {
  const circles = []

  Object.keys(SCATTER_ZONES).forEach((zoneId) => {
    const z = generateZoneProps(zoneId, density)
    if (!z) return

    z.pines.forEach((p) => pushCircle(circles, p.x, p.z, 0.32 * (p.s ?? 1)))
    z.rocks.forEach((r) => {
      if (r.solid) pushCircle(circles, r.x, r.z, (r.s ?? 1) * 0.45)
    })
    z.logs.forEach((l) => pushCircle(circles, l.x, l.z, 0.48 * (l.s ?? 1)))
    z.hay.forEach((h) => pushCircle(circles, h.x, h.z, 0.7 * (h.s ?? 1)))
    z.crates.forEach((c) => pushCircle(circles, c.x, c.z, 0.55 * (c.s ?? 1)))
    z.fences.forEach((f) => {
      const rx = f.ry === 0 ? f.x + 1.35 : f.x
      const rz = f.ry === 0 ? f.z : f.z + 1.35
      pushCircle(circles, rx, rz, 1.2)
    })
  })

  const placements = buildAdventurePlacements(density)
  placements.forEach((p) => {
    const collider = PROP_COLLIDERS[p.prop]
    if (!collider) return
    const s = p.s ?? 1
    const r = (collider.r ?? 0.5) * s
    pushCircle(circles, p.x, p.z, Math.max(r, 0.35))
  })

  return circles
}

export const WORLD_SOLIDS = buildWorldSolidCircles(1)
