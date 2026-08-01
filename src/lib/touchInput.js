/**
 * Entrada virtual para mobile — Livia faz merge com teclado.
 */
export const touchInput = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  run: false,
  interact: false,
}

export function resetTouchInput() {
  touchInput.forward = false
  touchInput.back = false
  touchInput.left = false
  touchInput.right = false
  touchInput.jump = false
  touchInput.run = false
  touchInput.interact = false
}

/** Detecta dispositivo touch / tela estreita. */
export function detectMobile() {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.innerWidth < 900
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  return (coarse && touch) || (narrow && touch)
}
