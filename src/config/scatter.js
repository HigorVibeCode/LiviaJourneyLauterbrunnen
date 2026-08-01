import {
  SCATTER_ZONES,
  CORRIDOR_HALF,
  buildBlockedRects,
  isFreeSpot,
  groundHeightAt,
  makeRng,
  pathLateralDist,
  pathXAt,
} from './world.js'

/**
 * Perfil visual de cada bioma. É aqui que as fases ficam com cara própria:
 * a pradaria é florida, o vale das águas é floresta densa e úmida, o passo
 * nevado troca grama por neve, e o alpino mistura os dois.
 */
export const BIOMES = {
  meadow: {
    pines: 26,
    bushes: 28,
    grass: 520,
    flowers: 380,
    rocks: 18,
    pebbles: 160,
    mushrooms: 6,
    ferns: 16,
    logs: 6,
    hay: 3,
    crates: 0,
    lanterns: 4,
    fenceRuns: 5,
    reeds: 0,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#5a9a48',
    foliage: ['#2e6a32', '#3a7838', '#428040'],
    rockColors: ['#7a7e84', '#83878d', '#6e7276'],
  },
  pasture: {
    pines: 18,
    bushes: 32,
    grass: 640,
    flowers: 420,
    rocks: 14,
    pebbles: 140,
    mushrooms: 4,
    ferns: 12,
    logs: 8,
    hay: 10,
    crates: 0,
    lanterns: 6,
    fenceRuns: 14,
    reeds: 0,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#5ea048',
    foliage: ['#307030', '#3a8038', '#428840'],
    rockColors: ['#7a7e84', '#8a8478', '#6e7276'],
  },
  water: {
    pines: 70,
    bushes: 36,
    grass: 480,
    flowers: 180,
    rocks: 40,
    pebbles: 220,
    mushrooms: 55,
    ferns: 120,
    logs: 18,
    hay: 2,
    crates: 0,
    lanterns: 8,
    fenceRuns: 4,
    reeds: 120,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#4a8a48',
    foliage: ['#1e5a28', '#286832', '#307038'],
    rockColors: ['#5f6b64', '#68746c', '#556158'],
  },
  snow: {
    pines: 48,
    bushes: 16,
    grass: 70,
    flowers: 0,
    rocks: 36,
    pebbles: 140,
    mushrooms: 0,
    ferns: 0,
    logs: 10,
    hay: 0,
    crates: 0,
    lanterns: 8,
    fenceRuns: 3,
    reeds: 0,
    snowPatches: 55,
    snowmen: 10,
    icicles: 36,
    grassColor: '#a8a890',
    foliage: ['#2a4034', '#304838', '#385040'],
    rockColors: ['#9aa7b0', '#a8b4bc', '#8b98a2'],
  },
  night: {
    pines: 80,
    bushes: 28,
    grass: 280,
    flowers: 50,
    rocks: 32,
    pebbles: 100,
    mushrooms: 28,
    ferns: 50,
    logs: 16,
    hay: 0,
    crates: 0,
    lanterns: 20,
    fenceRuns: 2,
    reeds: 0,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#2a3a30',
    foliage: ['#1e3428', '#243c30', '#2a4438'],
    rockColors: ['#3a3a48', '#2e2e3a', '#454558'],
  },
  flower: {
    pines: 14,
    bushes: 36,
    grass: 580,
    flowers: 720,
    rocks: 10,
    pebbles: 80,
    mushrooms: 12,
    ferns: 24,
    logs: 5,
    hay: 10,
    crates: 0,
    lanterns: 6,
    fenceRuns: 5,
    reeds: 0,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#6a8a5e',
    foliage: ['#3a5a40', '#486848', '#527850'],
    rockColors: ['#8a8a78', '#9a9a86', '#7a7a6a'],
  },
  alpine: {
    pines: 12,
    bushes: 8,
    grass: 140,
    flowers: 90,
    rocks: 18,
    pebbles: 50,
    mushrooms: 0,
    ferns: 0,
    logs: 3,
    hay: 0,
    crates: 0,
    lanterns: 2,
    fenceRuns: 2,
    reeds: 0,
    snowPatches: 60,
    snowmen: 2,
    icicles: 8,
    grassColor: '#6a8070',
    foliage: ['#2a4034', '#344c3c', '#3c5444'],
    rockColors: ['#93a0a8', '#a2aeb6', '#85929a'],
  },
}

const PATH_HALF = 6.5
/** Anéis laterais à trilha — riqueza na geração, sem LOD em runtime */
const TRAIL_NEAR = 24
const TRAIL_MID = 34
const TRAIL_FAR = 42
const FRUIT_COLORS = ['#d8452f', '#e07090', '#e8a838', '#8a3fa8']
/**
 * Paleta de flor alpina: branco e amarelo dominam (margaridas, botão-de-ouro),
 * com toques de rosa e azul. Muito magenta fazia as flores parecerem
 * pedrinhas coloridas espalhadas na grama.
 */
const FLOWER_COLORS = [
  '#f6f4ea',
  '#f6f4ea',
  '#faf7ee',
  '#efd85a',
  '#efd85a',
  '#f0c040',
  '#e8829a',
  '#c98ad8',
  '#8fd0f0',
]

/**
 * Gera todos os props de uma zona. Determinístico (mesma seed = mesmo mundo),
 * respeitando casas, portões, rio, riachos, escadaria e o caminho central.
 */
export function generateZoneProps(zoneId, density = 1) {
  const zone = SCATTER_ZONES[zoneId]
  if (!zone) return null

  const profile = BIOMES[zone.biome]
  const blocked = buildBlockedRects()
  const rng = makeRng(zone.seed)
  const halfX = zone.halfX
  const zMin = zone.zFrom + 3
  const zMax = zone.zTo - 3
  const snowy = zone.biome === 'snow' || zone.biome === 'alpine'
  const zoneMult = zone.mult ?? 1

  const n = (base) => Math.max(0, Math.round(base * density * zoneMult))

  const place = (count, { keepPath = true, margin = 2, nearTrail = false, skipFar = false } = {}) => {
    const out = []
    let guard = 0
    let latMax = Math.min(halfX, CORRIDOR_HALF - 3)
    if (nearTrail) latMax = Math.min(latMax, TRAIL_NEAR)
    while (out.length < count && guard < count * 30) {
      guard++
      const z = zMin + rng() * (zMax - zMin)
      const lat = nearTrail
        ? (rng() ** 0.55) * (rng() < 0.5 ? -1 : 1) * latMax
        : (rng() * 2 - 1) * latMax
      const x = pathXAt(z) + lat
      const latDist = pathLateralDist(x, z)
      if (keepPath && latDist < PATH_HALF) continue
      if (skipFar && latDist > TRAIL_FAR && rng() > 0.35) continue
      if (!nearTrail && skipFar && latDist > TRAIL_MID && rng() > 0.55) continue
      if (!isFreeSpot(x, z, blocked, margin)) continue
      out.push({ x, z, y: groundHeightAt(x, z) })
    }
    return out
  }

  // ── Pinheiros ──
  const pines = place(n(profile.pines), { margin: 4, skipFar: true }).map((p) => ({
    ...p,
    s: 0.75 + rng() * 0.75,
    ry: rng() * Math.PI * 2,
    color: profile.foliage[Math.floor(rng() * profile.foliage.length)],
  }))
  // capas de neve nas copas (só nos biomas frios)
  const pineSnow = snowy ? pines.filter(() => rng() > 0.4) : []

  // ── Arbustos com frutas ──
  const bushes = []
  const bushSnow = []
  const fruits = []
  place(n(profile.bushes), { margin: 2.5 }).forEach((b) => {
    const s = 0.85 + rng() * 0.5
    const fruitColor = FRUIT_COLORS[Math.floor(rng() * FRUIT_COLORS.length)]
    for (let i = 0; i < 3; i++) {
      const lobe = {
        x: b.x + (rng() - 0.5) * 2 * s,
        y: b.y + 0.62 * s + rng() * 0.26,
        z: b.z + (rng() - 0.5) * 2 * s,
        s: (0.7 + rng() * 0.42) * s,
        ry: rng() * Math.PI,
        color: profile.foliage[Math.floor(rng() * profile.foliage.length)],
      }
      bushes.push(lobe)
      // touca de neve: sem isso os arbustos ficam verdes-berrantes na neve
      if (snowy) {
        bushSnow.push({
          x: lobe.x,
          y: lobe.y + lobe.s * 0.34,
          z: lobe.z,
          s: lobe.s * 0.86,
          sy: lobe.s * 0.5,
          ry: lobe.ry,
        })
      }
    }
    if (profile.flowers > 0 || !snowy) {
      // as frutas ficam encostadas na folhagem: soltas no ar pareciam
      // pedras coloridas flutuando ao lado do arbusto
      const fruitCount = 3 + Math.floor(rng() * 3)
      for (let i = 0; i < fruitCount; i++) {
        const a = rng() * Math.PI * 2
        const r = (0.55 + rng() * 0.5) * s
        fruits.push({
          x: b.x + Math.cos(a) * r,
          y: b.y + (0.5 + rng() * 0.85) * s,
          z: b.z + Math.sin(a) * r,
          s: 0.85 + rng() * 0.45,
          color: fruitColor,
        })
      }
    }
  })

  // ── Grama em moitas ──
  const grass = []
  place(n(profile.grass), { keepPath: false, margin: 0.5, nearTrail: true }).forEach((g) => {
    const clump = 2 + Math.floor(rng() * 2)
    for (let i = 0; i < clump; i++) {
      grass.push({
        x: g.x + (rng() - 0.5) * 1.4,
        y: g.y + 0.01,
        z: g.z + (rng() - 0.5) * 1.4,
        s: 0.75 + rng() * 0.55,
        sy: 0.7 + rng() * 0.75,
        ry: rng() * Math.PI * 2,
        color: shade(profile.grassColor, (rng() - 0.5) * 24),
      })
    }
  })

  // ── Flores (em canteiros, para parecer campo florido) ──
  const flowers = []
  place(n(profile.flowers) / 4, { keepPath: false, margin: 0.5, nearTrail: true }).forEach((f) => {
    const cluster = 2 + Math.floor(rng() * 3)
    const color = FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)]
    for (let i = 0; i < cluster; i++) {
      flowers.push({
        x: f.x + (rng() - 0.5) * 2.4,
        y: f.y,
        z: f.z + (rng() - 0.5) * 2.4,
        s: 0.75 + rng() * 0.4,
        ry: rng() * Math.PI * 2,
        color: rng() > 0.75 ? FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)] : color,
      })
    }
  })

  // ── Samambaias (floresta úmida) ──
  const ferns = place(n(profile.ferns), { keepPath: false, margin: 1 }).map((f) => ({
    ...f,
    s: 0.8 + rng() * 0.8,
    ry: rng() * Math.PI * 2,
    color: shade('#2f7040', (rng() - 0.5) * 24),
  }))

  // ── Juncos (beira de água) ──
  const reeds = place(n(profile.reeds), { keepPath: false, margin: 0.5 }).map((r) => ({
    ...r,
    s: 0.7 + rng() * 0.8,
    sy: 1 + rng() * 1.2,
    ry: rng() * Math.PI * 2,
    color: shade('#7a9a48', (rng() - 0.5) * 28),
  }))

  // ── Pedras ──
  const rocks = place(n(profile.rocks), { margin: 2 }).map((r) => {
    const s = 0.6 + rng() * 1.7
    return {
      ...r,
      y: r.y + s * 0.35,
      s,
      rx: rng() * 0.5,
      ry: rng() * Math.PI * 2,
      rz: rng() * 0.5,
      color: profile.rockColors[Math.floor(rng() * profile.rockColors.length)],
      solid: s > 1.0,
    }
  })

  const pebbles = place(n(profile.pebbles), { keepPath: false, margin: 0.4, skipFar: true }).map((p) => ({
    ...p,
    y: p.y + 0.1,
    s: 0.18 + rng() * 0.4,
    rx: rng() * Math.PI,
    ry: rng() * Math.PI,
    color: profile.rockColors[Math.floor(rng() * profile.rockColors.length)],
  }))

  const mushrooms = place(n(profile.mushrooms), { margin: 1 }).map((m) => ({
    ...m,
    s: 0.6 + rng() * 0.9,
    ry: rng() * Math.PI,
    color: ['#d4483c', '#e8dcc0', '#c98a3c'][Math.floor(rng() * 3)],
  }))

  const logs = place(n(profile.logs), { margin: 2.5 }).map((l) => {
    const s = 0.8 + rng() * 0.9
    return { ...l, y: l.y + 0.5 * s, s, ry: rng() * Math.PI, rz: Math.PI / 2 }
  })

  const hay = place(n(profile.hay), { margin: 3, nearTrail: true }).map((h) => {
    const s = 0.65 + rng() * 0.35
    return { ...h, y: h.y + 0.35 * s, s, ry: rng() * Math.PI, rz: Math.PI / 2 }
  })

  const crates = place(n(profile.crates), { margin: 1.5 }).map((c) => {
    const s = 0.8 + rng() * 0.6
    return { ...c, y: c.y + 0.65 * s, s, ry: rng() * Math.PI, barrel: rng() > 0.5 }
  })

  const lanterns = place(n(profile.lanterns), { keepPath: false, margin: 1.5 }).map((l) => ({
    ...l,
    ry: rng() * Math.PI,
  }))

  // ── Neve: manchas no chão, bonecos e estalactites de gelo ──
  const snowPatches = place(n(profile.snowPatches), { keepPath: false, margin: 0.3 }).map((p) => ({
    ...p,
    y: p.y + 0.03,
    s: 0.7 + rng() * 1.1,
    sy: 0.35 + rng() * 0.35,
    ry: rng() * Math.PI,
  }))

  const snowmen = place(n(profile.snowmen), { margin: 3 }).map((s) => ({
    ...s,
    ry: rng() * Math.PI * 2,
    s: 0.85 + rng() * 0.4,
  }))

  const icicles = place(n(profile.icicles), { margin: 1.5 }).map((i) => ({
    ...i,
    y: i.y + 0.6,
    s: 0.6 + rng() * 0.9,
    ry: rng() * Math.PI,
  }))

  // ── Cercas ──
  const fences = []
  for (let i = 0; i < n(profile.fenceRuns); i++) {
    const horizontal = rng() > 0.45
    const len = 6 + Math.floor(rng() * 10)
    const step = 2.6
    let x0 = (rng() * 2 - 1) * (halfX - len * step * 0.5)
    const z0 = zMin + rng() * (zMax - zMin)
    if (pathLateralDist(x0, z0) < PATH_HALF + 3) {
      x0 += Math.sign(x0 || 1) * (PATH_HALF + 4)
    }

    for (let s = 0; s < len; s++) {
      const x = horizontal ? x0 + s * step : x0
      const z = horizontal ? z0 : z0 + s * step
      if (!isFreeSpot(x, z, blocked, 1)) continue
      if (pathLateralDist(x, z) < PATH_HALF - 1) continue
      fences.push({
        x,
        y: groundHeightAt(x, z),
        z,
        ry: horizontal ? 0 : Math.PI / 2,
        last: s === len - 1,
      })
    }
  }

  return {
    zoneId,
    biome: zone.biome,
    pines,
    pineSnow,
    bushes,
    bushSnow,
    fruits,
    grass,
    flowers,
    ferns,
    reeds,
    rocks,
    pebbles,
    mushrooms,
    logs,
    hay,
    crates,
    lanterns,
    snowPatches,
    snowmen,
    icicles,
    fences,
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount))
  const b = Math.max(0, Math.min(255, (n & 255) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
