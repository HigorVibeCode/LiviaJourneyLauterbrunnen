/**
 * Sanidade do mundo: rodar com `node scripts/validate-world.mjs`.
 * Verifica que o chão é contínuo, que os props não invadem áreas proibidas,
 * que cada item só pode nascer na sua própria fase e que a progressão
 * (dois itens por portão) está coerente.
 */
import {
  GROUND_SEGMENTS,
  SCATTER_ZONES,
  PHASES,
  PHASE_ORDER,
  GATES,
  RIVER,
  CORRIDOR_HALF,
  VALLEY_HALF_X,
  groundHeightAt,
  buildBlockedRects,
  isFreeSpot,
  pathXAt,
  pathLateralDist,
} from '../src/config/world.js'
import { generateZoneProps } from '../src/config/scatter.js'
import { pickSpawnForItem, isSpawnInsideItemZone, ITEM_ZONES } from '../src/data/itemSpawns.js'
import { QUESTS, ITEMS } from '../src/store/progressStore.js'

let failures = 0
const check = (ok, message) => {
  if (!ok) {
    failures++
    console.error(`✗ ${message}`)
  } else {
    console.log(`✓ ${message}`)
  }
}

// 1. Chão contínuo ao longo da centerline da S (exceto o vão do rio)
const holes = []
for (let z = 116; z > -344; z -= 1) {
  const inRiverGap = z <= RIVER.zTo && z >= RIVER.zFrom
  const cx = pathXAt(z)
  const supported = GROUND_SEGMENTS.some((s) => {
    if (z < s.zFrom || z > s.zTo) return false
    const segCx = s.followPath ? pathXAt(z) + (s.latCenter ?? 0) : (s.xCenter ?? 0)
    return Math.abs(cx - segCx) <= s.halfX
  })
  if (!supported && !inRiverGap) holes.push(z)
}
check(holes.length === 0, `sem buracos na trilha em S (${holes.slice(0, 8).join(', ')})`)

// 2. Fases e zonas de cenário cobertas por chão
PHASE_ORDER.forEach((id) => {
  const phase = PHASES[id]
  const mid = (phase.zFrom + phase.zTo) / 2
  const supported = GROUND_SEGMENTS.some((s) => mid >= s.zFrom && mid <= s.zTo)
  check(supported, `fase ${phase.index} (${phase.id}) tem chão em z=${mid}`)
})

Object.values(SCATTER_ZONES).forEach((zone) => {
  const mid = (zone.zFrom + zone.zTo) / 2
  const supported = GROUND_SEGMENTS.some((s) => mid >= s.zFrom && mid <= s.zTo)
  check(supported, `zona de cenário ${zone.id} tem chão em z=${mid}`)
})

// 3. Portões dentro do vale e alinhados com as fases
Object.entries(GATES).forEach(([id, g]) => {
  check(g.width < g.halfWidth * 2, `portão ${id} cabe no muro`)
  // halfWidth do config é o vão base; o muro em runtime cobre VALLEY+|pathX|+8
  check(g.halfWidth >= VALLEY_HALF_X * 0.9, `muro base de ${id} cobre o vale`)
})

PHASE_ORDER.filter((id) => PHASES[id].gate).forEach((id) => {
  const phase = PHASES[id]
  const gate = GATES[phase.gate]
  check(Boolean(gate), `fase ${phase.index} tem portão configurado`)
  if (gate) {
    const atEdge = Math.abs(gate.z - phase.zFrom) <= 4
    check(atEdge, `portão de ${phase.id} está na saída da fase (z=${gate.z})`)
  }
})

// 4. Progressão: 4 portões com itens, 2 itens cada, sem repetição
check(QUESTS.length === 4, `quatro portões de progressão (${QUESTS.length})`)
const seen = new Set()
QUESTS.forEach((q) => {
  check(q.itemIds.length === 2, `${q.gateId} pede exatamente 2 itens`)
  q.itemIds.forEach((itemId) => {
    check(Boolean(ITEMS[itemId]), `item ${itemId} existe no catálogo`)
    check(!seen.has(itemId), `item ${itemId} usado em uma única quest`)
    seen.add(itemId)
    check(
      ITEM_ZONES[itemId]?.phase === q.phase,
      `${itemId} nasce na fase da quest (${q.phase})`,
    )
  })
})
check(seen.size === Object.keys(ITEMS).length, 'todos os itens do catálogo são usados')

// 5. Props não invadem áreas proibidas
const blocked = buildBlockedRects()
Object.keys(SCATTER_ZONES).forEach((id) => {
  const props = generateZoneProps(id, 1)
  if (!props) return
  const bad = props.pines.filter((p) => !isFreeSpot(p.x, p.z, blocked, 0))
  check(bad.length === 0, `pinheiros de ${id} fora de casas/portões/água (${bad.length} problemas)`)
  const offMap = [...props.pines, ...props.rocks, ...props.snowmen].filter(
    (p) => pathLateralDist(p.x, p.z) > CORRIDOR_HALF + 2,
  )
  check(offMap.length === 0, `props de ${id} dentro do corredor da S (${offMap.length} fora)`)
  const floating = [...props.pines, ...props.snowmen].filter(
    (p) => Math.abs(p.y - groundHeightAt(p.x, p.z)) > 0.001,
  )
  check(floating.length === 0, `props de ${id} assentados no chão (${floating.length} flutuando)`)
})

// 6. Biomas distintos: cada fase tem cara própria
const meadow = generateZoneProps('meadow', 1)
const water = generateZoneProps('water', 1)
const snow = generateZoneProps('snow', 1)
check(water.pines.length > meadow.pines.length * 1.5, 'vale das águas é mais florestado que a pradaria')
check(water.reeds.length > 0, 'vale das águas tem juncos')
check(meadow.flowers.length > snow.flowers.length, 'pradaria tem mais flores que a neve')
check(snow.flowers.length === 0, 'não nascem flores na neve')
check(snow.snowmen.length > 0, 'passo nevado tem bonecos de neve')
check(snow.snowPatches.length > 0, 'passo nevado tem neve acumulada no chão')
check(snow.pineSnow.length > 0, 'pinheiros nevados no passo nevado')
check(meadow.snowPatches.length === 0, 'não há neve na pradaria')

// 7. Itens só nascem na própria fase (500 sorteios cada)
Object.keys(ITEM_ZONES).forEach((itemId) => {
  let wrong = 0
  let tooClose = 0
  for (let i = 0; i < 500; i++) {
    const p = pickSpawnForItem(itemId, i * 7919)
    if (!isSpawnInsideItemZone(itemId, p)) wrong++
    if (!isFreeSpot(p[0], p[2], blocked, 0)) tooClose++
    if (pathLateralDist(p[0], p[2]) > CORRIDOR_HALF + 2) wrong++
  }
  check(wrong === 0, `${itemId} sempre na sua fase (${wrong} falhas)`)
  check(tooClose === 0, `${itemId} nunca dentro de casa/portão/água (${tooClose} falhas)`)
})

// 8. Nenhum item nasce na fase de outro item
let crossPhase = 0
Object.entries(ITEM_ZONES).forEach(([itemId, mapping]) => {
  for (let i = 0; i < 200; i++) {
    const p = pickSpawnForItem(itemId, i * 104729)
    PHASE_ORDER.forEach((phaseId) => {
      if (phaseId === mapping.phase) return
      const other = PHASES[phaseId]
      if (p[2] >= other.zFrom && p[2] <= other.zTo) {
        crossPhase++
        if (crossPhase < 5) console.error(`✗ ${itemId} nasceu na fase ${phaseId} em z=${p[2]}`)
      }
    })
  }
})
check(crossPhase === 0, `itens não invadem a fase de outro item (${crossPhase} falhas)`)

console.log(failures === 0 ? '\nMundo validado.' : `\n${failures} problema(s).`)
process.exit(failures === 0 ? 0 : 1)
