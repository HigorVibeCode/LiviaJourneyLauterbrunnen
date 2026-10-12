import { create } from 'zustand'
import { detectMobile } from '../lib/touchInput'

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
    density: 0.55,
    drawDistance: 130,
    lights: 2,
  },
  medium: {
    id: 'medium',
    label: 'Média',
    shadows: false,
    softShadows: false,
    postFx: false,
    shadowMapSize: 1024,
    dpr: [1, 1],
    density: 0.75,
    drawDistance: 170,
    lights: 4,
  },
  high: {
    id: 'high',
    label: 'Alta',
    shadows: true,
    softShadows: false,
    postFx: true,
    shadowMapSize: 1536,
    dpr: [1, 1.5],
    density: 1.2,
    drawDistance: 230,
    lights: 6,
  },
}

const QUALITY_KEY = 'livia-quality'

/**
 * Qualidade inicial: ?q=low|medium|high > escolha salva > automático
 * (toque = baixa; computador = média). O PerformanceMonitor ainda pode
 * baixar sozinho se o FPS cair, enquanto a pessoa não escolher na mão.
 */
function initialQuality() {
  if (typeof window === 'undefined') return { quality: 'medium', manual: false }
  const q = new URLSearchParams(window.location.search).get('q')
  if (QUALITY_PRESETS[q]) return { quality: q, manual: true }
  try {
    const saved = localStorage.getItem(QUALITY_KEY)
    if (QUALITY_PRESETS[saved]) return { quality: saved, manual: true }
  } catch {
    /* sem storage */
  }
  return { quality: detectMobile() ? 'low' : 'medium', manual: false }
}

const START_QUALITY = initialQuality()

export const useGameStore = create((set, get) => ({
  paused: false,
  quality: START_QUALITY.quality,
  qualityManual: START_QUALITY.manual,
  audio: (() => {
    try {
      return localStorage.getItem('livia-audio') !== 'off'
    } catch {
      return true
    }
  })(),
  isMobile: typeof window !== 'undefined' ? detectMobile() : false,

  togglePause: () => set((s) => ({ paused: !s.paused })),
  setPaused: (paused) => set({ paused }),
  setQuality: (quality) => {
    try {
      localStorage.setItem(QUALITY_KEY, quality)
    } catch {
      /* sem storage */
    }
    set({ quality, qualityManual: true })
  },
  /** queda automática de qualidade (FPS baixo) — não grava como escolha */
  autoLowerQuality: () => {
    const { quality, qualityManual } = get()
    if (qualityManual) return
    const next = quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : null
    if (next) set({ quality: next })
  },
  toggleAudio: () =>
    set((s) => {
      try {
        localStorage.setItem('livia-audio', s.audio ? 'off' : 'on')
      } catch {
        /* sem storage */
      }
      return { audio: !s.audio }
    }),
  getQuality: () => QUALITY_PRESETS[get().quality] ?? QUALITY_PRESETS.medium,
}))
