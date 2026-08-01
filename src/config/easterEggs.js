import { groundHeightAt, pathXAt } from './world.js'

/**
 * Easter eggs — feedback visual + som, sem texto longo.
 * Posições fixas (lat = offset lateral da trilha).
 */
export const EASTER_EGGS = [
  {
    id: 'egg_bell',
    phase: 'meadow',
    lat: -18,
    z: 78,
    icon: 'bell',
    sfx: 'ding',
  },
  {
    id: 'egg_hay',
    phase: 'pasture',
    lat: 24,
    z: -120,
    icon: 'hay',
    sfx: 'hay',
  },
  {
    id: 'egg_firefly',
    phase: 'night',
    lat: -22,
    z: -420,
    icon: 'firefly',
    sfx: 'melody',
  },
  {
    id: 'egg_bridge',
    phase: 'water',
    lat: 6,
    z: -578,
    icon: 'splash',
    sfx: 'splash',
  },
  {
    id: 'egg_snowman',
    phase: 'snow',
    lat: -20,
    z: -710,
    icon: 'snow',
    sfx: 'pop',
  },
  {
    id: 'egg_ring',
    phase: 'flower',
    lat: 16,
    z: -860,
    icon: 'flower',
    sfx: 'chime',
  },
  {
    id: 'egg_flag',
    phase: 'summit',
    lat: 8,
    z: -1060,
    icon: 'flag',
    sfx: 'fanfare',
  },
]

export function resolveEggPosition(egg) {
  const x = pathXAt(egg.z) + egg.lat
  return [x, groundHeightAt(x, egg.z) + 0.6, egg.z]
}

export const EGG_ICONS = {
  bell: '🔔',
  hay: '🌾',
  firefly: '✨',
  splash: '💧',
  snow: '⛄',
  flower: '🌸',
  flag: '🚩',
}
