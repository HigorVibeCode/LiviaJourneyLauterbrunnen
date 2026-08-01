import { pathLateralDist } from '../config/world.js'

/** Limiares LOD (metros). Hysteresis evita flicker no limiar. */
export const LOD_NEAR = 40
export const LOD_MID = 77
export const LOD_NEAR_HIDE = 42
export const LOD_MID_SHOW = 72
export const LOD_MID_HIDE = 82

/**
 * Banda LOD com hysteresis opcional (prevBand = banda anterior do prop).
 */
export function bandForDistance(d, prevBand = null) {
  if (prevBand === 'near') {
    if (d > LOD_NEAR_HIDE) return d <= LOD_MID_HIDE ? 'mid' : 'far'
    return 'near'
  }
  if (prevBand === 'mid') {
    if (d > LOD_MID_HIDE) return 'far'
    if (d < LOD_NEAR - 2) return 'near'
    return 'mid'
  }
  if (prevBand === 'far') {
    if (d < LOD_MID_SHOW) return d < LOD_NEAR - 2 ? 'near' : 'mid'
    return 'far'
  }
  if (d <= LOD_NEAR) return 'near'
  if (d <= LOD_MID) return 'mid'
  return 'far'
}

export function distanceToPlayer(x, z, px, pz) {
  return Math.hypot(x - px, z - pz)
}

/** Parte items em fatias de ~40 m ao longo de Z para frustum culling eficaz. */
export const CHUNK_SIZE = 40

export function chunkItemsByZ(items, chunkSize = CHUNK_SIZE) {
  if (!items?.length) return []
  const map = new Map()
  for (const it of items) {
    const key = Math.floor(it.z / chunkSize)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(it)
  }
  return [...map.entries()].map(([key, chunkItems]) => ({ key, items: chunkItems }))
}

/**
 * Categorias que permanecem no anel médio (35–70 u).
 * Longe: só pinheiros / silhueta.
 */
const MID_KEEP = new Set([
  'pines',
  'pineSnow',
  'pineBases',
  'hay',
  'fences',
  'railsHigh',
  'railsLow',
  'rocks',
  'logs',
  'crates',
  'barrels',
  'crateBoxes',
  'lanterns',
])

const FAR_KEEP = new Set(['pines', 'pineSnow', 'pineBases'])

/**
 * Filtra props de vegetação por banda LOD relativa ao jogador.
 */
export function filterVegetationZone(zone, px, pz, prevBands = null) {
  const keep = (items, category) => {
    if (!items?.length) return items
    return items.filter((it) => {
      const d = distanceToPlayer(it.x, it.z, px, pz)
      const prev = prevBands?.get(it) ?? null
      const band = bandForDistance(d, prev)
      if (band === 'near') return true
      if (band === 'mid') return MID_KEEP.has(category)
      if (band === 'far') return FAR_KEEP.has(category)
      return false
    })
  }

  return {
    ...zone,
    pines: keep(zone.pines, 'pines'),
    pineSnow: keep(zone.pineSnow, 'pineSnow'),
    pineBases: keep(zone.pineBases, 'pineBases'),
    bushes: keep(zone.bushes, 'bushes'),
    bushSnow: keep(zone.bushSnow, 'bushSnow'),
    fruits: keep(zone.fruits, 'fruits'),
    grass: keep(zone.grass, 'grass'),
    flowers: keep(zone.flowers, 'flowers'),
    flowerBases: keep(zone.flowerBases, 'flowerBases'),
    ferns: keep(zone.ferns, 'ferns'),
    reeds: keep(zone.reeds, 'reeds'),
    rocks: keep(zone.rocks, 'rocks'),
    pebbles: keep(zone.pebbles, 'pebbles'),
    mushrooms: keep(zone.mushrooms, 'mushrooms'),
    mushroomBases: keep(zone.mushroomBases, 'mushroomBases'),
    logs: keep(zone.logs, 'logs'),
    hay: keep(zone.hay, 'hay'),
    crates: keep(zone.crates, 'crates'),
    crateBoxes: keep(zone.crateBoxes, 'crateBoxes'),
    barrels: keep(zone.barrels, 'barrels'),
    lanterns: keep(zone.lanterns, 'lanterns'),
    snowPatches: keep(zone.snowPatches, 'snowPatches'),
    snowmen: keep(zone.snowmen, 'snowmen'),
    icicles: keep(zone.icicles, 'icicles'),
    fences: keep(zone.fences, 'fences'),
    railsHigh: keep(zone.railsHigh, 'railsHigh'),
    railsLow: keep(zone.railsLow, 'railsLow'),
  }
}

/** Props hero (colocados à mão) ignoram LOD — sempre visíveis. */
export function isHeroPlacement(p) {
  return Boolean(p.hero)
}

/**
 * Filtra scatter do adventure pack. Heroes sempre ficam.
 */
export function filterAdventurePlacements(placements, px, pz) {
  return placements.filter((p) => {
    if (isHeroPlacement(p)) return true
    const d = distanceToPlayer(p.x, p.z, px, pz)
    const band = bandForDistance(d)
    if (band === 'near') return true
    if (band === 'mid') {
      return /Tree|Pine|Maple|Willow|Fence|Hay|Barrel|Crate|Lamp|Fire|Tent|Well|Sign/i.test(
        p.prop,
      )
    }
    return /Tree|Pine|Maple|Willow|DeadTree/i.test(p.prop)
  })
}

/** Prioriza densidade perto da trilha (anel 0–12 m lateral). */
export function trailProximityBoost(x, z) {
  const lat = pathLateralDist(x, z)
  if (lat <= 12) return 1
  if (lat <= 22) return 0.72
  if (lat <= 32) return 0.48
  return 0.28
}
