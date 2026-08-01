import { create } from 'zustand'

/** Presets de qualidade — controlam sombras, pós-processamento e densidade */
export const QUALITY_PRESETS = {
  low: {
    id: 'low',
    label: 'Baixa',
    shadows: false,
    softShadows: false,
    postFx: false,
    shadowMapSize: 512,
    dpr: [1, 1],
    density: 0.35,
  },
  medium: {
    id: 'medium',
    label: 'Média',
    // sombra desligada no medium: é o maior custo num mapa aberto
    shadows: false,
    softShadows: false,
    postFx: false,
    shadowMapSize: 1024,
    dpr: [1, 1],
    density: 0.42,
  },
  high: {
    id: 'high',
    label: 'Alta',
    shadows: true,
    softShadows: false,
    postFx: true,
    shadowMapSize: 1024,
    dpr: [1, 1.25],
    density: 0.75,
  },
}

/** Permite abrir o jogo já numa qualidade: ?q=low | medium | high */
function initialQuality() {
  if (typeof window === 'undefined') return 'medium'
  const q = new URLSearchParams(window.location.search).get('q')
  return QUALITY_PRESETS[q] ? q : 'medium'
}

export const useGameStore = create((set, get) => ({
  paused: false,
  quality: initialQuality(),
  audio: true,

  togglePause: () => set((s) => ({ paused: !s.paused })),
  setPaused: (paused) => set({ paused }),
  setQuality: (quality) => set({ quality }),
  toggleAudio: () => set((s) => ({ audio: !s.audio })),
  getQuality: () => QUALITY_PRESETS[get().quality] ?? QUALITY_PRESETS.medium,
}))
