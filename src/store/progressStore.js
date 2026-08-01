import { create } from 'zustand'

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
    hint: 'Explore a pradaria: encontre a Chave do Portão e a Capa de Chuva',
    nearGateHint: 'Portão trancado. Faltam a Chave do Portão e a Capa de Chuva',
    interactHint: 'Pressione E para abrir o portão do pasto',
    unlockedHint: 'Portão aberto! Monte o cavalo e atravesse o pasto',
  },
  {
    id: 'q_night',
    phase: 'night',
    gateId: 'gate_water',
    itemIds: ['fungo_brilho', 'pena_coruja'],
    hint: 'No Vale Noturno: encontre o Fungo Brilhante e a Pena de Coruja',
    nearGateHint: 'Portão trancado. Faltam o Fungo Brilhante e a Pena de Coruja',
    interactHint: 'Pressione E para abrir o caminho ao Vale das Águas',
    unlockedHint: 'A noite cede! O Vale das Águas te espera',
  },
  {
    id: 'q2',
    phase: 'water',
    gateId: 'gate_snow',
    itemIds: ['ferramenta', 'casaco'],
    hint: 'No Vale das Águas: encontre a Ferramenta do Carpinteiro e o Casaco de Pele',
    nearGateHint: 'Passagem fechada. Faltam a Ferramenta do Carpinteiro e o Casaco de Pele',
    interactHint: 'Pressione E para abrir a passagem para a neve',
    unlockedHint: 'Passagem aberta! Cuidado com o Passo Nevado',
  },
  {
    id: 'q3',
    phase: 'snow',
    gateId: 'gate_summit',
    itemIds: ['cristal', 'binoculo'],
    hint: 'No Passo Nevado: encontre o Cristal da Cachoeira e o Binóculo',
    nearGateHint: 'Portão de gelo trancado. Faltam o Cristal da Cachoeira e o Binóculo',
    interactHint: 'Pressione E para abrir o Prado Florido',
    unlockedHint: 'Prado Florido aberto! Respira fundo — a escadaria vem depois',
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
  /** Onde cada item nasceu nesta sessão — usado pela guia (segurar E) */
  itemPositions: {},
  finished: false,
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

  collectItem: (itemId) => {
    const { inventory } = get()
    if (inventory.includes(itemId)) return

    const item = ITEMS[itemId]
    const next = [...inventory, itemId]
    const quest = QUESTS.find((q) => q.itemIds.includes(itemId))
    const missing = missingItems(quest, next)

    let toast = item?.pickupHint ?? 'Item coletado!'
    if (quest) {
      toast = missing.length
        ? `${toast} Falta ainda: ${missing.map((id) => ITEMS[id].name).join(' e ')}.`
        : `${toast} Agora vá ao portão e toque E.`
    }

    set({
      inventory: next,
      collectedEver: [...get().collectedEver, itemId],
      toast,
      // dispara a comemoração (pulinho da Livia + explosão de brilho)
      lastPickupAt: Date.now(),
    })
    setTimeout(() => {
      if (get().toast === toast) set({ toast: null })
    }, 4500)
  },

  /**
   * Abre o portão só quando os DOIS itens estão no inventário.
   * Itens consumíveis (chave, ferramenta, cristal) são gastos na hora;
   * roupas e binóculo continuam com a Livia.
   */
  tryUnlockGate: (gateId) => {
    const { inventory, unlockedGates } = get()
    if (unlockedGates.includes(gateId)) return false

    const quest = QUESTS.find((q) => q.gateId === gateId)
    if (!quest || missingItems(quest, inventory).length > 0) return false

    const remaining = inventory.filter(
      (id) => !(quest.itemIds.includes(id) && ITEMS[id]?.consumable),
    )

    set({
      inventory: remaining,
      unlockedGates: [...unlockedGates, gateId],
      toast: quest.unlockedHint,
      nearGateId: null,
    })

    setTimeout(() => {
      if (get().toast === quest.unlockedHint) set({ toast: null })
    }, 4000)

    return true
  },

  setNearGate: (gateId) => set({ nearGateId: gateId }),

  /** Dispara a cutscene do mirante (baú → fênix → céu) */
  startFinale: () => {
    if (get().finalePhase || get().finished) return
    set({
      finalePhase: 'pickup',
      finaleStartedAt: performance.now(),
      toast: 'Livia encontrou o tesouro alpino!',
    })
    setTimeout(() => {
      if (get().toast === 'Livia encontrou o tesouro alpino!') set({ toast: null })
    }, 3500)
  },

  setFinalePhase: (finalePhase) => set({ finalePhase }),

  finish: () => {
    if (get().finished) return
    const message = 'Fim da jornada de Livia.'
    set({ finished: true, finalePhase: 'done', toast: message })
    setTimeout(() => {
      if (get().toast === message) set({ toast: null })
    }, 8000)
  },
}))
