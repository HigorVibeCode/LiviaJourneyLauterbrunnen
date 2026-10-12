import { groundHeightAt, pathXAt } from './world.js'

/**
 * 3 NPCs fixos — entregam um item de portão por fase (E para receber).
 * Bichinhos estilo Animal Crossing — cores alimentam o modelo em NPC.jsx.
 */
export const NPCS = [
  {
    id: 'npc_night_guard',
    name: 'Coruja Guardiã',
    phase: 'night',
    lat: 20,
    z: -408,
    itemId: 'fungo_brilho',
    role: 'guard',
    // corujinha de touca de dormir + lanterninha
    fur: '#f2b77e',
    furShade: '#e09a5e',
    face: '#fff3dc',
    coat: '#a58cf5',
    coatShade: '#8f74ea',
    trim: '#ffe36e',
    hat: '#5f8dff',
    hatTrim: '#ffffff',
    nose: '#ffa63d',
    feet: '#ffa63d',
    cheek: '#ff9db5',
    eye: '#4a3a6a',
  },
  {
    id: 'npc_bridge_keeper',
    name: 'Castor Carpinteiro',
    phase: 'water',
    lat: -6,
    z: -566,
    itemId: 'ferramenta',
    role: 'carpenter',
    // castor de capacete amarelo, macacão jeans e cinto de ferramentas
    fur: '#d99a5e',
    furShade: '#c4834a',
    face: '#fff0dc',
    coat: '#5aaeff',
    coatShade: '#4596ea',
    trim: '#ffd23f',
    hat: '#ffd23f',
    hatTrim: '#ffb02e',
    nose: '#e0786a',
    feet: '#c4834a',
    cheek: '#ff9db5',
    eye: '#4a3020',
  },
  {
    id: 'npc_snow_guide',
    name: 'Pinguim Guia',
    phase: 'snow',
    lat: 16,
    z: -718,
    itemId: 'cristal',
    role: 'guide',
    // pinguim explorador — cachecol listrado e protetor de orelha
    fur: '#5f8ee8',
    furShade: '#4f7ad6',
    face: '#ffffff',
    coat: '#ffffff',
    coatShade: '#eaf3ff',
    trim: '#ff6170',
    hat: '#ff8fb8',
    hatTrim: '#ffffff',
    nose: '#ffa63d',
    feet: '#ffa63d',
    cheek: '#ff9db5',
    eye: '#2e3f6e',
  },
]

export function resolveNpcPosition(npc) {
  const x = pathXAt(npc.z) + npc.lat
  return { x, y: groundHeightAt(x, npc.z), z: npc.z }
}
