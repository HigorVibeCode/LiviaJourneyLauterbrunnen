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
    pines: 14,
    bushes: 14,
    grass: 140,
    flowers: 70,
    rocks: 12,
    pebbles: 40,
    mushrooms: 4,
    ferns: 8,
    logs: 4,
    hay: 5,
    crates: 4,
    lanterns: 3,
    fenceRuns: 3,
    reeds: 0,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#6a8a5a',
    foliage: ['#3a5a38', '#456848', '#4a7050'],
    rockColors: ['#7a7e84', '#83878d', '#6e7276'],
  },
  pasture: {
    pines: 12,
    bushes: 16,
    grass: 180,
    flowers: 90,
    rocks: 10,
    pebbles: 36,
    mushrooms: 3,
    ferns: 6,
    logs: 5,
    hay: 16,
    crates: 5,
    lanterns: 4,
    fenceRuns: 8,
    reeds: 0,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#6e8e5e',
    foliage: ['#3c5c3a', '#4a6a48', '#527850'],
    rockColors: ['#7a7e84', '#8a8478', '#6e7276'],
  },
  water: {
    pines: 36,
    bushes: 18,
    grass: 120,
    flowers: 40,
    rocks: 24,
    pebbles: 55,
    mushrooms: 22,
    ferns: 40,
    logs: 10,
    hay: 1,
    crates: 5,
    lanterns: 5,
    fenceRuns: 2,
    reeds: 40,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#5a7a58',
    foliage: ['#2a4a32', '#345a3c', '#3a6442'],
    rockColors: ['#5f6b64', '#68746c', '#556158'],
  },
  snow: {
    pines: 28,
    bushes: 10,
    grass: 40,
    flowers: 0,
    rocks: 22,
    pebbles: 40,
    mushrooms: 0,
    ferns: 0,
    logs: 5,
    hay: 0,
    crates: 3,
    lanterns: 5,
    fenceRuns: 2,
    reeds: 0,
    snowPatches: 90,
    snowmen: 6,
    icicles: 16,
    grassColor: '#a8a890',
    foliage: ['#2a4034', '#304838', '#385040'],
    rockColors: ['#9aa7b0', '#a8b4bc', '#8b98a2'],
  },
  night: {
    pines: 40,
    bushes: 14,
    grass: 80,
    flowers: 16,
    rocks: 18,
    pebbles: 30,
    mushrooms: 12,
    ferns: 18,
    logs: 8,
    hay: 0,
    crates: 4,
    lanterns: 12,
    fenceRuns: 2,
    reeds: 0,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#2a3a30',
    foliage: ['#142418', '#1a2c20', '#203428'],
    rockColors: ['#3a3a48', '#2e2e3a', '#454558'],
  },
  flower: {
    pines: 10,
    bushes: 16,
    grass: 160,
    flowers: 180,
    rocks: 8,
    pebbles: 28,
    mushrooms: 6,
    ferns: 10,
    logs: 3,
    hay: 5,
    crates: 3,
    lanterns: 4,
    fenceRuns: 3,
    reeds: 0,
    snowPatches: 0,
    snowmen: 0,
    icicles: 0,
    grassColor: '#6a8a5e',
    foliage: ['#3a5a40', '#486848', '#527850'],
    rockColors: ['#8a8a78', '#9a9a86', '#7a7a6a'],
  },
  alpine: {
    pines: 8,
    bushes: 6,
    grass: 50,
    flowers: 30,
    rocks: 12,
    pebbles: 20,
    mushrooms: 0,
    ferns: 0,
    logs: 2,
    hay: 0,
    crates: 2,
    lanterns: 2,
    fenceRuns: 1,
    reeds: 0,
    snowPatches: 24,
    snowmen: 2,
    icicles: 4,
    grassColor: '#6a8070',
    foliage: ['#2a4034', '#344c3c', '#3c5444'],
    rockColors: ['#93a0a8', '#a2aeb6', '#85929a'],
  },
}

const PATH_HALF = 6.5
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

  const place = (count, { keepPath = true, margin = 2 } = {}) => {
    const out = []
    let guard = 0
    const latMax = Math.min(halfX, CORRIDOR_HALF - 3)
    while (out.length < count && guard < count * 30) {
      guard++
      const z = zMin + rng() * (zMax - zMin)
      const lat = (rng() * 2 - 1) * latMax
      const x = pathXAt(z) + lat
      if (keepPath && pathLateralDist(x, z) < PATH_HALF) continue
      if (!isFreeSpot(x, z, blocked, margin)) continue
      out.push({ x, z, y: groundHeightAt(x, z) })
    }
    return out
  }

  // ── Pinheiros ──
  const pines = place(n(profile.pines), { margin: 4 }).map((p) => ({
    ...p,
    s: 0.75 + rng() * 0.75,
    ry: rng() * Math.PI * 2,
    color: profile.foliage[Math.floor(rng() * profile.foliage.length)],
  }))
  // capas de neve nas copas (só nos biomas frios)
  const pineSnow = snowy ? pines.filter(() => rng() > 0.15) : []

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
  place(n(profile.grass), { keepPath: false, margin: 0.5 }).forEach((g) => {
    // 1 blade por ponto — o “campo” vem da quantidade de pontos, não de clumps
    grass.push({
      x: g.x + (rng() - 0.5) * 0.6,
      y: g.y + 0.01,
      z: g.z + (rng() - 0.5) * 0.6,
      s: 0.85 + rng() * 0.5,
      sy: 0.75 + rng() * 0.7,
      ry: rng() * Math.PI * 2,
      color: shade(profile.grassColor, (rng() - 0.5) * 22),
    })
  })

  // ── Flores (em canteiros, para parecer campo florido) ──
  const flowers = []
  place(n(profile.flowers) / 4, { keepPath: false, margin: 0.5 }).forEach((f) => {
    const cluster = 1 + Math.floor(rng() * 2)
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
      solid: s > 1.5,
    }
  })

  const pebbles = place(n(profile.pebbles), { keepPath: false, margin: 0.4 }).map((p) => ({
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

  const hay = place(n(profile.hay), { margin: 3 }).map((h) => {
    const s = 0.9 + rng() * 0.6
    return { ...h, y: h.y + 1.1 * s, s, ry: rng() * Math.PI }
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
    s: 1.4 + rng() * 3.4,
    sy: 0.5 + rng() * 0.6,
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
