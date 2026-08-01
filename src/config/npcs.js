import { groundHeightAt, pathXAt } from './world.js'

/**
 * 3 NPCs fixos — entregam um item de portão por fase (E para receber).
 * Paletas e detalhes alimentam o modelo toon em NPC.jsx.
 */
export const NPCS = [
  {
    id: 'npc_night_guard',
    name: 'Guarda do Vale',
    phase: 'night',
    lat: 20,
    z: -408,
    itemId: 'fungo_brilho',
    role: 'guard',
    // uniforme noturno — azul-ardósia + capa violeta
    tunic: '#4a5568',
    tunicDark: '#2e3644',
    cape: '#2a2038',
    capeTrim: '#6a5088',
    pants: '#2a3040',
    boots: '#1a1820',
    hat: '#1e1a28',
    hatBand: '#8a6ab0',
    belt: '#3a2a48',
    accent: '#a8b8d8',
    metal: '#8a9ab0',
    skin: '#d4a888',
    skinDark: '#b88868',
    cheek: '#c87870',
    hair: '#1a1420',
    eye: '#c8d8f0',
    lip: '#a86860',
  },
  {
    id: 'npc_bridge_keeper',
    name: 'Guardião da Ponte',
    phase: 'water',
    lat: -8,
    z: -552,
    itemId: 'ferramenta',
    role: 'carpenter',
    // carpinteiro alpino — verde musgo + avental de couro
    tunic: '#6a8a58',
    tunicDark: '#4a6a3a',
    cape: '#5a4030',
    capeTrim: '#8a6848',
    pants: '#4a3a28',
    boots: '#3a2818',
    hat: '#5a3e28',
    hatBand: '#c8a060',
    belt: '#4a3020',
    accent: '#c4a060',
    metal: '#8a7a5a',
    skin: '#e0b090',
    skinDark: '#c49070',
    cheek: '#d88878',
    hair: '#3a2818',
    eye: '#3a5028',
    lip: '#b07060',
  },
  {
    id: 'npc_snow_guide',
    name: 'Guia da Neve',
    phase: 'snow',
    lat: 16,
    z: -718,
    itemId: 'cristal',
    role: 'guide',
    // exploradora alpina — azul gelo + pele e cachecol
    tunic: '#8aa0b8',
    tunicDark: '#5a7088',
    cape: '#e8eef4',
    capeTrim: '#b8c8d8',
    pants: '#6a7a8a',
    boots: '#3a3a42',
    hat: '#f0f4f8',
    hatBand: '#d07060',
    belt: '#5a4a3a',
    accent: '#90d0e8',
    metal: '#c8dce8',
    skin: '#f0c8a8',
    skinDark: '#d4a888',
    cheek: '#e89890',
    hair: '#c8b090',
    eye: '#4a6888',
    lip: '#c86870',
  },
]

export function resolveNpcPosition(npc) {
  const x = pathXAt(npc.z) + npc.lat
  return { x, y: groundHeightAt(x, npc.z), z: npc.z }
}
