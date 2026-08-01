/**
 * Vale de Lauterbrunnen — jornada em 7 trechos ao longo de −Z, com trilha em S.
 *
 *  1 Pradaria          — chave + capa
 *  2 Pasto / Rancho    — cavalgada
 *  3 Vale Noturno      — atmosfera escura (após o cavalo)
 *  4 Vale das Águas    — ferramenta + casaco
 *  5 Passo Nevado      — cristal + binóculo
 *  6 Prado Florido     — respiro antes da escada
 *  7 Mirante Alpino    — escadaria + tesouro
 */

export const PLAYER_HEIGHT = 1.7

/**
 * Corredor jogável medido a partir da centerline da trilha (não de X=0).
 * As paredes do vale seguem a S: face interna em pathX ± CLIFF_OFFSET.
 */
export const CORRIDOR_HALF = 44
export const VALLEY_HALF_X = CORRIDOR_HALF
export const CLIFF_OFFSET = 48
/** @deprecated use CLIFF_OFFSET — mantido p/ imports antigos */
export const CLIFF_X = CLIFF_OFFSET
export const CLIFF_HEIGHT = 88
/** Passo dos segmentos de penhasco (maior = mais barato; ainda segue a S) */
export const CLIFF_STEP = 56

/** Extensão Z do pasto (pradaria ≈ 100 → pasto ≥ 3×) */
export const PASTURE_LEN = 300
/** Comprimento do vale noturno (após cavalgada) */
export const NIGHT_LEN = 230
/** Comprimento do prado florido (após neve, antes da escada) */
export const FLOWER_LEN = 130

/**
 * Amostras da centerline da trilha (z decrescente).
 * x = desvio lateral da S — mantém |x| ≲ 36 para caber no vale.
 */
export const PATH_SAMPLES = [
  { z: 118, x: 0 },
  { z: 70, x: 10 },
  { z: 30, x: 18 },
  { z: 14, x: 22 },
  { z: -40, x: 32 },
  { z: -120, x: 36 },
  { z: -200, x: 18 },
  { z: -260, x: -8 },
  { z: -290, x: -18 },
  // vale noturno (mais longo)
  { z: -340, x: -34 },
  { z: -400, x: -38 },
  { z: -460, x: -32 },
  { z: -520, x: -18 },
  // vale das águas
  { z: -560, x: 4 },
  { z: -600, x: 28 },
  { z: -650, x: 34 },
  // neve
  { z: -700, x: 16 },
  { z: -760, x: -12 },
  { z: -780, x: -24 },
  // prado florido
  { z: -840, x: -34 },
  { z: -900, x: -16 },
  { z: -916, x: -4 },
  // escada / mirante — endireita
  { z: -980, x: 0 },
  { z: -1110, x: 0 },
]

function pathSampleIndex(z) {
  const s = PATH_SAMPLES
  if (z >= s[0].z) return { i: 0, t: 0 }
  if (z <= s[s.length - 1].z) return { i: s.length - 2, t: 1 }
  for (let i = 0; i < s.length - 1; i++) {
    if (z <= s[i].z && z >= s[i + 1].z) {
      const span = s[i].z - s[i + 1].z
      const t = span > 1e-6 ? (s[i].z - z) / span : 0
      return { i, t }
    }
  }
  return { i: 0, t: 0 }
}

/** Centro X da trilha em um Z */
export function pathXAt(z) {
  const { i, t } = pathSampleIndex(z)
  const a = PATH_SAMPLES[i]
  const b = PATH_SAMPLES[i + 1]
  return a.x + (b.x - a.x) * t
}

/** Yaw da trilha (radianos): 0 = +Z, PI = −Z; segue a tangente da S */
export function pathYawAt(z) {
  const { i, t } = pathSampleIndex(z)
  const a = PATH_SAMPLES[i]
  const b = PATH_SAMPLES[i + 1]
  const dx = b.x - a.x
  const dz = b.z - a.z
  // avanço em −Z → yaw ≈ PI; desvio lateral ajusta
  void t
  return Math.atan2(dx, dz)
}

/**
 * Mundo a partir de (z na trilha, lateral).
 * lateral > 0 = direita da trilha (X crescente quando a S está reta).
 * Curvas suaves: offset só em X — paredes segmentadas usam pathYawAt para orientar.
 */
export function worldFromPath(z, lateral = 0) {
  return {
    x: pathXAt(z) + lateral,
    z,
    yaw: pathYawAt(z),
  }
}

/** Offset lateral com sinal (direita positiva) — aprox. em X para curvas suaves */
export function pathLateralSigned(x, z) {
  return x - pathXAt(z)
}

/** Distância lateral do ponto (x,z) até o centro da trilha */
export function pathLateralDist(x, z) {
  return Math.abs(pathLateralSigned(x, z))
}

/** Resolve landmark { lat|x, z } → posição mundo ancorada na S */
export function resolveOnPath(item) {
  const lat = item.lat ?? item.x ?? 0
  const w = worldFromPath(item.z, lat)
  return { ...item, x: w.x, z: item.z, yaw: w.yaw, lat }
}

/** Fases de progressão (na ordem, avançando em −Z) */
export const PHASES = {
  meadow: {
    id: 'meadow',
    index: 1,
    label: 'Pradaria de Lauterbrunnen',
    biome: 'meadow',
    zFrom: 16,
    zTo: 116,
    gate: 'gate_pasture',
  },
  pasture: {
    id: 'pasture',
    index: 2,
    label: 'Pasto do Rancho',
    biome: 'pasture',
    zFrom: -288,
    zTo: 12,
    gate: 'gate_night',
  },
  night: {
    id: 'night',
    index: 3,
    label: 'Vale Noturno',
    biome: 'night',
    zFrom: -520,
    zTo: -292,
    gate: 'gate_water',
  },
  water: {
    id: 'water',
    index: 4,
    label: 'Vale das Águas',
    biome: 'water',
    zFrom: -652,
    zTo: -524,
    gate: 'gate_snow',
  },
  snow: {
    id: 'snow',
    index: 5,
    label: 'Passo Nevado',
    biome: 'snow',
    zFrom: -780,
    zTo: -656,
    gate: 'gate_summit',
  },
  flower: {
    id: 'flower',
    index: 6,
    label: 'Prado Florido',
    biome: 'flower',
    zFrom: -912,
    zTo: -784,
    gate: null,
  },
  summit: {
    id: 'summit',
    index: 7,
    label: 'Mirante Alpino',
    biome: 'alpine',
    zFrom: -1110,
    zTo: -916,
    gate: null,
  },
}

export const PHASE_ORDER = ['meadow', 'pasture', 'night', 'water', 'snow', 'flower', 'summit']

/** Frases curtas de capítulo (HUD) — uma por bioma */
export { CHAPTER_STORY as CHAPTER_LINES } from './story.js'

/**
 * Zonas de scatter. `mult` afina densidade (mirante ralo = vista livre).
 */
export const SCATTER_ZONES = {
  meadow: { id: 'meadow', biome: 'meadow', zFrom: 16, zTo: 116, halfX: 55, seed: 1001 },
  pasture: { id: 'pasture', biome: 'pasture', zFrom: -288, zTo: 12, halfX: 55, seed: 1505 },
  night: { id: 'night', biome: 'night', zFrom: -520, zTo: -292, halfX: 55, seed: 1808, mult: 1.15 },
  water: { id: 'water', biome: 'water', zFrom: -652, zTo: -524, halfX: 55, seed: 2002 },
  snow: { id: 'snow', biome: 'snow', zFrom: -780, zTo: -656, halfX: 55, seed: 3003 },
  flower: { id: 'flower', biome: 'flower', zFrom: -912, zTo: -784, halfX: 55, seed: 3606, mult: 1.25 },
  climb: { id: 'climb', biome: 'alpine', zFrom: -1028, zTo: -916, halfX: 55, seed: 4004, mult: 0.55 },
  summitTop: {
    id: 'summitTop',
    biome: 'alpine',
    zFrom: -1110,
    zTo: -1030,
    halfX: 48,
    seed: 5005,
    mult: 0.4,
  },
}

/** Meio-largura do tabuleiro da ponte procedural (Structures.WoodenBridge). */
export const BRIDGE_HALF_X = 5.4

/** Desfiladeiro da fase água */
export const RIVER = {
  zFrom: -600,
  zTo: -570,
  gapHalfX: 8,
  waterY: -3.2,
}

/** Riachos rasos (fase água) */
export const STREAMS = [
  { z: -536, halfZ: 2.4, color: '#4a8ea8' },
  { z: -626, halfZ: 3, color: '#4a8ea8' },
  { z: -644, halfZ: 2.2, color: '#4a8ea8' },
]

/** Lagos/poças */
export const PONDS = [
  { lat: -28, z: -552, r: 9 },
  { lat: 30, z: -616, r: 11 },
  { lat: -30, z: -690, r: 8, frozen: true },
]

/**
 * Escadaria monumental — começa após o prado florido.
 */
export const STAIRS = {
  steps: 36,
  zStart: -916,
  stepDepth: 3.2,
  stepRise: 0.55,
  halfWidth: 22,
}

export const SUMMIT_Y = STAIRS.steps * STAIRS.stepRise // 19.8
export const SUMMIT_HALF_X = 52

/** Landmarks do mirante */
export const TREASURE_POS = { x: 0, y: SUMMIT_Y, z: -1045 }
export const PHOENIX_PIVOT = { x: 0, y: SUMMIT_Y + 10, z: -1051 }

export const CLIMB_STREAM = {
  side: -1,
  x: -(STAIRS.halfWidth + 7.5),
  halfWidth: 1.35,
  color: '#4a8ea8',
}

/** Desmonta no fim do pasto → entra no vale noturno */
export const HORSE_DISMOUNT_Z = -284

/**
 * Portões:
 *  gate_pasture — pradaria → pasto (itens)
 *  gate_night   — pasto → vale noturno (auto na cavalgada)
 *  gate_water   — noturno → águas (fungo + pena)
 *  gate_snow    — águas → neve (itens)
 *  gate_summit  — neve → prado florido (itens)
 */
export const GATES = {
  gate_pasture: {
    z: 14,
    y: 0,
    width: 11,
    height: 6,
    halfWidth: CORRIDOR_HALF,
    color: '#6B4423',
    style: 'wood',
  },
  gate_night: {
    z: -290,
    y: 0,
    width: 11,
    height: 6,
    halfWidth: CORRIDOR_HALF,
    color: '#2a2438',
    style: 'wood',
  },
  gate_water: {
    z: -522,
    y: 0,
    width: 11,
    height: 6,
    halfWidth: CORRIDOR_HALF,
    color: '#3a4a5a',
    style: 'wood',
  },
  gate_snow: {
    z: -654,
    y: 0,
    width: 11,
    height: 6,
    halfWidth: CORRIDOR_HALF,
    color: '#5c6a72',
    style: 'stone',
  },
  gate_summit: {
    z: -782,
    y: 0,
    width: 10,
    height: 6,
    halfWidth: CORRIDOR_HALF,
    color: '#4a5560',
    style: 'ice',
  },
}

/** Cavalo: centro da trilha logo após o 1º portão */
export const HORSE_WAIT = {
  get x() {
    return pathXAt(GATES.gate_pasture.z - 4.2)
  },
  z: GATES.gate_pasture.z - 4.2,
  y: 0,
}

export const STAIRS_Z_TOP = STAIRS.zStart - (STAIRS.steps - 1) * STAIRS.stepDepth

/** Zona já construída (escada + platô do mirante) — sem placas de terreno por cima */
export function isSummitBuiltArea(x, z) {
  const px = pathXAt(z)
  const lat = Math.abs(x - px)
  if (z <= STAIRS.zStart + 4 && z >= STAIRS_Z_TOP - 10 && lat < STAIRS.halfWidth + 4) return true
  if (z <= STAIRS_Z_TOP + 4 && z >= TREASURE_POS.z - 24 && lat < 34) return true
  return false
}

/** Segmentos de chão. followPath: xCenter = pathXAt(mid) + latCenter */
export const GROUND_SEGMENTS = [
  { id: 'meadow', zFrom: 16, zTo: 118, halfX: CORRIDOR_HALF, y: 0, biome: 'meadow', color: '#6a8a62', followPath: true },
  { id: 'pasture', zFrom: -288, zTo: 16, halfX: CORRIDOR_HALF, y: 0, biome: 'pasture', color: '#6e8e66', followPath: true },
  { id: 'night', zFrom: -520, zTo: -288, halfX: CORRIDOR_HALF, y: 0, biome: 'night', color: '#2a3a32', followPath: true },
  { id: 'water-n', zFrom: -570, zTo: -520, halfX: CORRIDOR_HALF, y: 0, biome: 'water', color: '#5a7a58', followPath: true },
  { id: 'river-w', zFrom: -600, zTo: -570, halfX: 17, latCenter: -(RIVER.gapHalfX + 17), y: 0, biome: 'water', color: '#4a6a4e', followPath: true },
  { id: 'river-e', zFrom: -600, zTo: -570, halfX: 17, latCenter: RIVER.gapHalfX + 17, y: 0, biome: 'water', color: '#4a6a4e', followPath: true },
  { id: 'water-s', zFrom: -656, zTo: -600, halfX: CORRIDOR_HALF, y: 0, biome: 'water', color: '#5e7e5c', followPath: true },
  { id: 'snow', zFrom: -780, zTo: -656, halfX: CORRIDOR_HALF, y: 0, biome: 'snow', color: '#d8e2ea', followPath: true },
  { id: 'flower', zFrom: -912, zTo: -780, halfX: CORRIDOR_HALF, y: 0, biome: 'flower', color: '#6a8a60', followPath: true },
  {
    id: 'climb-w',
    zFrom: STAIRS_Z_TOP - 0.5,
    zTo: STAIRS.zStart,
    halfX: (CORRIDOR_HALF - STAIRS.halfWidth - 4) / 2,
    latCenter: -(STAIRS.halfWidth + 4 + (CORRIDOR_HALF - STAIRS.halfWidth - 4) / 2),
    y: 0,
    biome: 'alpine',
    color: '#c8d6cc',
    followPath: true,
  },
  {
    id: 'climb-e',
    zFrom: STAIRS_Z_TOP - 0.5,
    zTo: STAIRS.zStart,
    halfX: (CORRIDOR_HALF - STAIRS.halfWidth - 4) / 2,
    latCenter: STAIRS.halfWidth + 4 + (CORRIDOR_HALF - STAIRS.halfWidth - 4) / 2,
    y: 0,
    biome: 'alpine',
    color: '#c8d6cc',
    followPath: true,
  },
  {
    id: 'summit',
    zFrom: -1110,
    zTo: STAIRS_Z_TOP + 4,
    halfX: SUMMIT_HALF_X,
    y: SUMMIT_Y,
    biome: 'alpine',
    color: '#d4dfd6',
    followPath: true,
  },
]

/**
 * Chalés. Coordenadas seguem as novas faixas Z (água/neve/mirante deslocados).
 */
export const HOUSES = [
  // lat = offset da trilha (não X absoluto). Alterna lados, longe do caminho.
  // ── Pradaria ──
  { lat: -28, z: 64, rot: 0.18, scale: 1.15, kind: 'chalet', body: '#5c3a24', roof: '#8a4028', home: true },
  { lat: 26, z: 86, rot: -0.3, scale: 0.95, kind: 'barn', body: '#4a3220', roof: '#7a3820' },
  { lat: 30, z: 52, rot: -0.5, scale: 0.9, kind: 'chalet', body: '#5a3822', roof: '#8a4028' },
  { lat: -32, z: 34, rot: 0.4, scale: 1, kind: 'chalet', body: '#4a3220', roof: '#7a3820' },
  { lat: 22, z: 30, rot: 0.1, scale: 0.85, kind: 'chalet', body: '#5c3a24', roof: '#8a4028' },

  // ── Pasto ──
  { lat: -30, z: -20, rot: 0.25, scale: 1.05, kind: 'barn', body: '#4a3220', roof: '#7a3820' },
  { lat: 28, z: -80, rot: -0.35, scale: 0.95, kind: 'chalet', body: '#5a3822', roof: '#8a4028' },
  { lat: -32, z: -150, rot: 0.4, scale: 0.9, kind: 'barn', body: '#4a3220', roof: '#7a3820' },
  { lat: 26, z: -220, rot: -0.2, scale: 0.85, kind: 'chalet', body: '#5c3a24', roof: '#8a4028' },

  // ── Vale noturno ──
  { lat: -28, z: -330, rot: 0.3, scale: 0.9, kind: 'cabin', body: '#3a3228', roof: '#1a1820' },
  { lat: 30, z: -380, rot: -0.4, scale: 0.85, kind: 'cabin', body: '#2e2830', roof: '#141218' },
  { lat: -26, z: -450, rot: 0.2, scale: 0.8, kind: 'barn', body: '#3a342c', roof: '#1c1822' },
  { lat: 28, z: -490, rot: -0.25, scale: 0.85, kind: 'cabin', body: '#2a2430', roof: '#121018' },

  // ── Vale das águas (igreja um pouco à esquerda da trilha) ──
  { lat: -14, z: -550, rot: 0.05, scale: 1.1, kind: 'church', body: '#e8e2d4', roof: '#4a5560' },
  { lat: 18, z: -540, rot: -0.25, scale: 1, kind: 'chalet', body: '#5a3822', roof: '#8a4028' },
  { lat: -18, z: -538, rot: 0.3, scale: 1.05, kind: 'chalet', body: '#4a3220', roof: '#7a3820' },
  { lat: 20, z: -580, rot: -0.4, scale: 0.95, kind: 'barn', body: '#4a3220', roof: '#7a3820' },
  { lat: -16, z: -610, rot: 0.35, scale: 0.9, kind: 'chalet', body: '#5c3a24', roof: '#8a4028' },
  { lat: 16, z: -630, rot: -0.2, scale: 1, kind: 'chalet', body: '#5a3822', roof: '#8a4028' },

  // ── Passo nevado ──
  { lat: -30, z: -676, rot: 0.25, scale: 0.95, kind: 'cabin', body: '#6b4a32', roof: '#e8eef4' },
  { lat: 28, z: -708, rot: -0.3, scale: 0.9, kind: 'cabin', body: '#5c4028', roof: '#f0f4f8' },
  { lat: -28, z: -746, rot: 0.4, scale: 0.85, kind: 'cabin', body: '#6b4a32', roof: '#e8eef4' },

  // ── Prado florido ──
  { lat: -28, z: -820, rot: 0.2, scale: 0.95, kind: 'chalet', body: '#6a4428', roof: '#9a4830' },
  { lat: 28, z: -860, rot: -0.3, scale: 0.9, kind: 'chalet', body: '#6a4428', roof: '#9a4830' },
  { lat: -24, z: -890, rot: 0.15, scale: 0.85, kind: 'barn', body: '#5c3a24', roof: '#8a4028' },

  // ── Mirante ──
  { lat: -24, z: -1038, rot: 0.2, scale: 1.15, kind: 'cabin', body: '#5c4028', roof: '#eef4f8' },
  { lat: 24, z: -1048, rot: -0.35, scale: 1.05, kind: 'cabin', body: '#6b4a32', roof: '#f0f4f8' },
  { lat: -28, z: -1062, rot: 0.4, scale: 0.95, kind: 'cabin', body: '#5c4028', roof: '#eef4f8' },
]

export const WATERFALLS = [
  {
    id: 'staubbach',
    lat: -(CLIFF_OFFSET - 2),
    z: -624,
    height: CLIFF_HEIGHT - 4,
    width: 5.5,
    depth: 3,
    name: 'Staubbach Fall',
    hero: true,
  },
  { id: 'trummelbach', lat: CLIFF_OFFSET - 2, z: -586, height: 64, width: 5.5, depth: 4 },
  { id: 'gorge', lat: CLIFF_OFFSET - 2, z: -642, height: 48, width: 4, depth: 3.4 },
  { id: 'frozen', lat: CLIFF_OFFSET - 2, z: -726, height: 56, width: 5, depth: 4, frozen: true },
]

/** Retângulos proibidos para spawn de itens */
export function buildBlockedRects() {
  const rects = []

  HOUSES.forEach((h) => {
    const { x, z } = resolveOnPath(h)
    rects.push({ x, z, halfX: 10 * h.scale, halfZ: 9 * h.scale })
  })

  Object.values(GATES).forEach((g) => {
    rects.push({ x: pathXAt(g.z), z: g.z, halfX: g.halfWidth, halfZ: 9 })
  })

  rects.push({
    x: pathXAt((RIVER.zFrom + RIVER.zTo) / 2),
    z: (RIVER.zFrom + RIVER.zTo) / 2,
    halfX: RIVER.gapHalfX + 6,
    halfZ: Math.abs(RIVER.zTo - RIVER.zFrom) / 2 + 5,
  })

  STREAMS.forEach((s) => {
    rects.push({ x: pathXAt(s.z), z: s.z, halfX: CORRIDOR_HALF, halfZ: s.halfZ + 1.5 })
  })

  PONDS.forEach((p) => {
    const { x, z } = resolveOnPath(p)
    rects.push({ x, z, halfX: p.r + 2, halfZ: p.r + 2 })
  })

  const stairsLen = STAIRS.steps * STAIRS.stepDepth
  rects.push({
    x: pathXAt(STAIRS.zStart - stairsLen / 2),
    z: STAIRS.zStart - stairsLen / 2,
    halfX: STAIRS.halfWidth + 5,
    halfZ: stairsLen / 2 + 4,
  })

  rects.push({ x: 0, z: TREASURE_POS.z - 15, halfX: SUMMIT_HALF_X + 2, halfZ: 14 })
  rects.push({ x: TREASURE_POS.x, z: TREASURE_POS.z, halfX: 12, halfZ: 10 })

  rects.push({ x: pathXAt(HORSE_WAIT.z), z: HORSE_WAIT.z, halfX: 4, halfZ: 4 })

  WATERFALLS.forEach((w) => {
    const { x, z } = resolveOnPath(w)
    rects.push({ x, z, halfX: w.width + 7, halfZ: w.width + 7 })
  })

  return rects
}

export function makeRng(seed) {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function isFreeSpot(x, z, blocked, margin = 0) {
  for (let i = 0; i < blocked.length; i++) {
    const r = blocked[i]
    if (Math.abs(x - r.x) <= r.halfX + margin && Math.abs(z - r.z) <= r.halfZ + margin) {
      return false
    }
  }
  return true
}

export function stairsLength() {
  return (STAIRS.steps - 1) * STAIRS.stepDepth
}

export function stairsPitch() {
  return Math.atan2(SUMMIT_Y, stairsLength())
}

export function groundHeightAt(x, z) {
  const stairsLen = stairsLength()
  const zTop = STAIRS.zStart - stairsLen
  if (z <= STAIRS.zStart + STAIRS.stepDepth + 4 && z >= zTop - 2 && Math.abs(x) <= STAIRS.halfWidth + 2) {
    const t = Math.max(0, Math.min(1, (STAIRS.zStart - z) / stairsLen))
    return t * SUMMIT_Y
  }
  for (let i = 0; i < GROUND_SEGMENTS.length; i++) {
    const s = GROUND_SEGMENTS[i]
    if (z < s.zFrom || z > s.zTo) continue
    const cx = s.followPath
      ? pathXAt(z) + (s.latCenter ?? s.xCenter ?? 0)
      : (s.xCenter ?? 0)
    if (Math.abs(x - cx) <= s.halfX) return s.y
  }
  return 0
}

export function phaseAt(z) {
  for (const id of PHASE_ORDER) {
    const p = PHASES[id]
    if (z >= p.zFrom && z <= p.zTo) return p
  }
  return PHASES.meadow
}
