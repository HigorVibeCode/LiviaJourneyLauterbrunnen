import { GATES, TREASURE_POS, HORSE_WAIT, pathXAt } from '../config/world'
import { ITEMS, QUESTS, missingItems, useProgressStore } from '../store/progressStore'
import { playerPosition } from '../store/playerStore'
import { horseRide } from './horseRide'

const TREASURE = [TREASURE_POS.x, TREASURE_POS.y, TREASURE_POS.z]

function gatePos(gateId, label) {
  const g = GATES[gateId]
  return { position: [pathXAt(g.z), g.y + 2, g.z], label }
}

/**
 * Próximo objetivo em world-space (item, portão, cavalo ou tesouro).
 */
export function getObjectiveTarget() {
  const { unlockedGates, inventory, itemPositions, finished, finalePhase } =
    useProgressStore.getState()
  if (finished || finalePhase) return null

  // pasto: cavalo → vale noturno
  if (unlockedGates.includes('gate_pasture') && !unlockedGates.includes('gate_night')) {
    if (!horseRide.mounted) {
      return {
        position: [horseRide.x || HORSE_WAIT.x, 1.4, horseRide.z || HORSE_WAIT.z],
        label: 'Cavalo',
      }
    }
    return gatePos('gate_night', 'Vale Noturno')
  }

  const quest = QUESTS.find((q) => !unlockedGates.includes(q.gateId))
  const missing = quest ? missingItems(quest, inventory) : []

  if (!quest) {
    return { position: TREASURE, label: 'Tesouro' }
  }

  if (missing.length === 0) {
    return gatePos(quest.gateId, quest.gateId === 'gate_water' ? 'Vale das Águas' : 'Portão')
  }

  let best = null
  let bestDist = Infinity
  for (const id of missing) {
    const p = itemPositions[id]
    if (!p) continue
    const d = Math.hypot(p[0] - playerPosition.x, p[2] - playerPosition.z)
    if (d < bestDist) {
      bestDist = d
      best = { p, id }
    }
  }

  if (!best) return null
  return {
    position: [best.p[0], (best.p[1] ?? 0) + 1.2, best.p[2]],
    label: ITEMS[best.id]?.short ?? best.id,
  }
}
