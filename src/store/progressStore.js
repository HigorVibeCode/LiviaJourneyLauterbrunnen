import { create } from 'zustand'
import {
  EGG_LORE,
  FINALE_TOAST,
  FINISH_TOAST,
  ITEM_LORE,
  LANTERN_TOAST,
  UNLOCK_TOASTS,
} from '../config/story.js'

/**
 * `consumable: true` = o item é gasto ao abrir o portão (chave, ferramenta,
 * cristal). Roupas e equipamentos (capa, casaco, binóculo) ficam com a Livia
 * — e aparecem vestidos no modelo.
 */
export const ITEMS = {
  chave_portao: {
    id: 'chave_portao',
    name: 'Chave do Portão',
    short: 'Chave',
    consumable: true,
    pickupHint: 'Chave do portão encontrada! Livia guarda a chave na mão.',
  },
  capa_chuva: {
    id: 'capa_chuva',
    name: 'Capa de Chuva',
    short: 'Capa',
    pickupHint: 'Capa de chuva encontrada! Livia vestiu a capa amarela.',
  },
  ferramenta: {
    id: 'ferramenta',
    name: 'Ferramenta do Carpinteiro',
    short: 'Ferramenta',
    consumable: true,
    pickupHint: 'Ferramenta do carpinteiro encontrada! Livia leva o martelo na mão.',
  },
  casaco: {
    id: 'casaco',
    name: 'Casaco de Pele',
    short: 'Casaco',
    pickupHint: 'Casaco de pele encontrado! Livia vestiu o casaco quentinho.',
  },
  cristal: {
    id: 'cristal',
    name: 'Cristal da Cachoeira',
    short: 'Cristal',
    consumable: true,
    pickupHint: 'Cristal da cachoeira encontrado! Ele brilha na mão da Livia.',
  },
  binoculo: {
    id: 'binoculo',
    name: 'Binóculo',
    short: 'Binóculo',
    pickupHint: 'Binóculo encontrado! Ficou pendurado no pescoço da Livia.',
  },
  fungo_brilho: {
    id: 'fungo_brilho',
    name: 'Fungo Brilhante',
    short: 'Fungo',
    consumable: true,
    pickupHint: 'Fungo Brilhante! Ele ilumina o caminho na escuridão.',
  },
  pena_coruja: {
    id: 'pena_coruja',
    name: 'Pena de Coruja',
    short: 'Pena',
    pickupHint: 'Pena de Coruja encontrada! Um amuleto contra a noite.',
  },
}

/** Portões com itens. gate_night abre na cavalgada (sem itens). */
export const QUESTS = [
  {
    id: 'q1',
    phase: 'meadow',
    gateId: 'gate_pasture',
    itemIds: ['chave_portao', 'capa_chuva'],
    hint: 'Primeiro rito: encontre a Chave do Portão e a Capa de Chuva na pradaria.',
    nearGateHint: 'Portão trancado. Faltam a Chave do Portão e a Capa de Chuva',
    interactHint: 'Pressione E para cumprir o primeiro rito — abrir o pasto',
    unlockedHint: UNLOCK_TOASTS.gate_pasture,
  },
  {
    id: 'q_night',
    phase: 'night',
    gateId: 'gate_water',
    itemIds: ['fungo_brilho', 'pena_coruja'],
    hint: 'Vale Noturno: lampião, fale com o Guarda (fungo) e ache a Pena de Coruja.',
    nearGateHint: 'Portão trancado. Faltam o Fungo Brilhante e a Pena de Coruja',
    interactHint: 'Pressione E para abrir o caminho ao Vale das Águas',
    unlockedHint: UNLOCK_TOASTS.gate_water,
  },
  {
    id: 'q2',
    phase: 'water',
    gateId: 'gate_snow',
    itemIds: ['ferramenta', 'casaco'],
    hint: 'Vale das Águas: fale com o Guardião da Ponte e ache o Casaco de Pele.',
    nearGateHint: 'Passagem fechada. Faltam a Ferramenta do Carpinteiro e o Casaco de Pele',
    interactHint: 'Pressione E para abrir a passagem para a neve',
    unlockedHint: UNLOCK_TOASTS.gate_snow,
  },
  {
    id: 'q3',
    phase: 'snow',
    gateId: 'gate_summit',
    itemIds: ['cristal', 'binoculo'],
    hint: 'Passo Nevado: fale com o Guia da Neve e ache o Binóculo.',
    nearGateHint: 'Portão de gelo trancado. Faltam o Cristal da Cachoeira e o Binóculo',
    interactHint: 'Pressione E para abrir o Prado Florido',
    unlockedHint: UNLOCK_TOASTS.gate_summit,
  },
]

/** Itens que ainda faltam para uma quest */
export function missingItems(quest, inventory) {
  if (!quest) return []
  return quest.itemIds.filter((id) => !inventory.includes(id))
}

export const useProgressStore = create((set, get) => ({
  inventory: [],
  /** Tudo que já foi coletado (não encolhe quando um item é consumido) */
  collectedEver: [],
  /** timestamp da última coleta — dispara a animação de conquista */
  lastPickupAt: 0,
  unlockedGates: [],
  toast: null,
  nearGateId: null,
  nearNpcId: null,
  /** NPC já falou (primeiro E = diálogo, segundo = item) */
  npcSpoke: {},
  /** Onde cada item nasceu nesta sessão — usado pela guia (segurar E) */
  itemPositions: {},
  finished: false,
  hasLantern: false,
  foundEggs: [],
  /**
   * Sequência final: pickup (pegar tesouro) → mount (fênix chega) →
   * fly (voo ao céu) → done (tela de vitória).
   */
  finalePhase: null,
  finaleStartedAt: 0,

  hasItem: (itemId) => get().inventory.includes(itemId),
  isGateOpen: (gateId) => get().unlockedGates.includes(gateId),

  setItemPosition: (itemId, position) =>
    set((s) => ({ itemPositions: { ...s.itemPositions, [itemId]: position } })),

  /** Primeira quest ainda não concluída */
  getCurrentQuest: () => {
    const { unlockedGates } = get()
    return QUESTS.find((q) => !unlockedGates.includes(q.gateId)) ?? null
  },

  collectLantern: () => {
    if (get().hasLantern) return
    set({
      hasLantern: true,
      toast: LANTERN_TOAST,
    })
    setTimeout(() => {
      if (get().toast === LANTERN_TOAST) set({ toast: null })
    }, 3500)
  },

  findEgg: (eggId) => {
    const { foundEggs } = get()
    if (foundEggs.includes(eggId)) return
    const lore = EGG_LORE[eggId] ?? '✨ Segredo encontrado!'
    set({
      foundEggs: [...foundEggs, eggId],
      toast: lore,
    })
    setTimeout(() => {
      if (get().toast === lore) set({ toast: null })
    }, 3200)
  },

  collectItem: (itemId) => {
    const { inventory } = get()
    if (inventory.includes(itemId)) return

    const item = ITEMS[itemId]
    const next = [...inventory, itemId]
    const quest = QUESTS.find((q) => q.itemIds.includes(itemId))
    const missing = missingItems(quest, next)

    let toast = item?.pickupHint ?? 'Item coletado!'
    const lore = ITEM_LORE[itemId]
    if (lore) toast = `${toast} ${lore}`

    if (quest) {
      toast = missing.length
        ? `${toast} Falta ainda: ${missing.map((id) => ITEMS[id].name).join(' e ')}.`
        : `${toast} Agora vá ao portão e toque E.`
    }

    set({
      inventory: next,
      collectedEver: [...get().collectedEver, itemId],
      toast,
      lastPickupAt: Date.now(),
    })
    setTimeout(() => {
      if (get().toast === toast) set({ toast: null })
    }, 4500)
  },

  tryUnlockGate: (gateId) => {
    const { inventory, unlockedGates } = get()
    if (unlockedGates.includes(gateId)) return false

    const quest = QUESTS.find((q) => q.gateId === gateId)
    if (!quest || missingItems(quest, inventory).length > 0) return false

    const remaining = inventory.filter(
      (id) => !(quest.itemIds.includes(id) && ITEMS[id]?.consumable),
    )

    const toast = quest.unlockedHint

    set({
      inventory: remaining,
      unlockedGates: [...unlockedGates, gateId],
      toast,
      nearGateId: null,
    })

    setTimeout(() => {
      if (get().toast === toast) set({ toast: null })
    }, 4000)

    return true
  },

  setNearGate: (gateId) =>
    set((s) => (s.nearGateId === gateId ? s : { nearGateId: gateId })),

  setNearNpc: (npcId) =>
    set((s) => (s.nearNpcId === npcId ? s : { nearNpcId: npcId })),

  markNpcSpoke: (npcId) =>
    set((s) => ({ npcSpoke: { ...s.npcSpoke, [npcId]: true } })),

  startFinale: () => {
    if (get().finalePhase || get().finished) return
    set({
      finalePhase: 'pickup',
      finaleStartedAt: performance.now(),
      toast: FINALE_TOAST,
    })
    setTimeout(() => {
      if (get().toast === FINALE_TOAST) set({ toast: null })
    }, 3500)
  },

  setFinalePhase: (finalePhase) => set({ finalePhase }),

  finish: () => {
    if (get().finished) return
    set({ finished: true, finalePhase: 'done', toast: FINISH_TOAST })
    setTimeout(() => {
      if (get().toast === FINISH_TOAST) set({ toast: null })
    }, 8000)
  },
}))
