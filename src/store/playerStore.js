import { create } from 'zustand'

/** Ponto inicial — pradaria, de frente para o vale */
const INITIAL_SPAWN = { x: 0, y: 2.5, z: 96 }

/**
 * Posição da Livia em objeto mutável.
 * Ler daqui evita um `set()` do zustand a 60fps (era um custo escondido:
 * todo subscriber re-renderizava a cada frame).
 */
export const playerPosition = { ...INITIAL_SPAWN }

export function updatePlayerPosition(pos) {
  playerPosition.x = pos.x
  playerPosition.y = pos.y
  playerPosition.z = pos.z
}

/**
 * Estado persistente do jogador — checkpoint = último ponto seguro no chão
 * antes de cair no limbo / rio.
 */
export const usePlayerStore = create((set, get) => ({
  spawn: { ...INITIAL_SPAWN },
  lastSafe: { ...INITIAL_SPAWN },
  respawns: 0,

  setLastSafe: (pos) => {
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
    updatePlayerPosition(INITIAL_SPAWN)
    set({ spawn: { ...INITIAL_SPAWN }, lastSafe: { ...INITIAL_SPAWN } })
  },
}))

export { INITIAL_SPAWN }
