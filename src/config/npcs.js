import { groundHeightAt, pathXAt } from './world.js'

/**
 * 3 NPCs fixos — entregam um item de portão por fase (E para receber).
 */
export const NPCS = [
  {
    id: 'npc_night_guard',
    name: 'Guarda do Vale',
    phase: 'night',
    lat: 14,
    z: -400,
    itemId: 'fungo_brilho',
    color: '#4a5568',
    hat: '#2a2438',
  },
  {
    id: 'npc_bridge_keeper',
    name: 'Guardião da Ponte',
    phase: 'water',
    lat: -12,
    z: -578,
    itemId: 'ferramenta',
    color: '#5a6a58',
    hat: '#3a4a40',
  },
  {
    id: 'npc_snow_guide',
    name: 'Guia da Neve',
    phase: 'snow',
    lat: 16,
    z: -718,
    itemId: 'cristal',
    color: '#8a9aa8',
    hat: '#d8e4ec',
  },
]

export function resolveNpcPosition(npc) {
  const x = pathXAt(npc.z) + npc.lat
  return { x, y: groundHeightAt(x, npc.z), z: npc.z }
}
