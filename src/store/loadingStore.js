import { create } from 'zustand'
import { LOADING_PHASES } from '../config/story'

export const useLoadingStore = create(() => ({
  progress: 0,
  active: true,
  phase: 'assets',
  bootReady: false,
  introDone: false,
}))

export function setLoadingProgress(progress, active) {
  useLoadingStore.setState({ progress, active })
  if (!active && progress >= 100) {
    setBootPhase('world', 0.48)
  }
}

export function setBootPhase(phaseId, fraction) {
  let acc = 0
  let found = false
  for (const p of LOADING_PHASES) {
    if (p.id === phaseId) {
      found = true
      acc += p.weight * Math.min(1, Math.max(0, fraction))
      break
    }
    acc += p.weight
  }
  if (!found) acc = fraction
  useLoadingStore.setState({
    phase: phaseId,
    progress: Math.min(100, acc * 100),
  })
}

export function markBootReady() {
  useLoadingStore.setState({ bootReady: true, progress: 100, active: false })
}

export function markIntroDone() {
  useLoadingStore.setState({ introDone: true })
}

/** Label da fase atual para o overlay */
export function loadingPhaseLabel(phaseId) {
  return LOADING_PHASES.find((p) => p.id === phaseId)?.label ?? 'A preparar…'
}
