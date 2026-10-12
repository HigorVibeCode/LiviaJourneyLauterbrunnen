import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Ponto inicial — pradaria, de frente para o vale */
const INITIAL_SPAWN = { x: 0, y: 2.5, z: 96 }

/**
 * Posição da Livia em objeto mutável.
 * Ler daqui evita um `set()` do zustand a 60fps (era um custo escondido:
 * todo subscriber re-renderizava a cada frame).
 */
export const playerPosition = { ...INITIAL_SPAWN }

let savesFrozen = false

export function updatePlayerPosition(pos) {
  playerPosition.x = pos.x
  playerPosition.y = pos.y
  playerPosition.z = pos.z
}

/**
 * Estado persistente do jogador — checkpoint = último ponto seguro no chão
 * antes de cair no limbo / rio.
 */
export const usePlayerStore = create(
  persist(
  (set, get) => ({
  spawn: { ...INITIAL_SPAWN },
  lastSafe: { ...INITIAL_SPAWN },
  respawns: 0,

  setLastSafe: (pos) => {
    if (savesFrozen) return
    const { lastSafe } = get()
    if (
      Math.abs(lastSafe.x - pos.x) < 0.4 &&
      Math.abs(lastSafe.y - pos.y) < 0.4 &&
      Math.abs(lastSafe.z - pos.z) < 0.4
    ) {
      return
    }
    set({ lastSafe: { x: pos.x, y: pos.y, z: pos.z } })
  },

  /** Usa o último ponto seguro como destino de respawn */
  getRespawnPoint: () => {
    const { lastSafe } = get()
    return { x: lastSafe.x, y: lastSafe.y + 0.8, z: lastSafe.z }
  },

  countRespawn: () => set((s) => ({ respawns: s.respawns + 1 })),

  resetToStart: () => {
    // recomeçando: nada mais grava posição até a página recarregar
    savesFrozen = true
    updatePlayerPosition(INITIAL_SPAWN)
    set({ spawn: { ...INITIAL_SPAWN }, lastSafe: { ...INITIAL_SPAWN } })
  },
}),
  {
    name: 'livia-player-v1',
    version: 1,
    partialize: (s) => ({ lastSafe: s.lastSafe }),
    onRehydrateStorage: () => (state) => {
      if (state?.lastSafe) updatePlayerPosition(state.lastSafe)
    },
  },
  ),
)

/** Onde a Livia aparece ao abrir o jogo: último ponto seguro salvo */
export function startPosition() {
  const p = usePlayerStore.getState().lastSafe ?? INITIAL_SPAWN
  return { x: p.x, y: p.y + 0.6, z: p.z }
}


export { INITIAL_SPAWN }
