import { groundHeightAt, pathXAt } from './world.js'

/**
 * 3 NPCs fixos — entregam um item de portão por fase (E para receber).
 */
export const NPCS = [
  {
    id: 'npc_night_guard',
    name: 'Guarda do Vale',
    phase: 'night',
    lat: 20,
    z: -408,
    itemId: 'fungo_brilho',
    color: '#5a6578',
    hat: '#2a2438',
    accent: '#8a9ab8',
    cape: '#3a4458',
    role: 'guard',
  },
  {
    id: 'npc_bridge_keeper',
    name: 'Guardião da Ponte',
    phase: 'water',
    lat: -8,
    z: -552,
    itemId: 'ferramenta',
    color: '#6a7a62',
    hat: '#4a3a28',
    accent: '#a08050',
    cape: '#5a4a38',
    role: 'carpenter',
  },
  {
    id: 'npc_snow_guide',
    name: 'Guia da Neve',
    phase: 'snow',
    lat: 16,
    z: -718,
    itemId: 'cristal',
    color: '#9aa8b8',
    hat: '#e8eef4',
    accent: '#c8dce8',
    cape: '#7a8a98',
    role: 'guide',
  },
]

export function resolveNpcPosition(npc) {
  const x = pathXAt(npc.z) + npc.lat
  return { x, y: groundHeightAt(x, npc.z), z: npc.z }
}
