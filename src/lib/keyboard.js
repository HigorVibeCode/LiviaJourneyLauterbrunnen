/** Digitando num campo (nome no multijogador): teclas não mexem a Livia */
export function isTyping() {
  const el = typeof document !== 'undefined' ? document.activeElement : null
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
}

/** Captura o mouse no canvas (câmera livre). Seguro chamar dentro de um clique. */
export function requestGameLock() {
  const canvas = document.querySelector('canvas')
  if (!canvas || document.pointerLockElement === canvas) return
  if (window.matchMedia?.('(pointer: coarse)').matches) return
  try {
    const p = canvas.requestPointerLock?.()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch {
    /* navegador recusou — o clique no jogo tenta de novo */
  }
}
