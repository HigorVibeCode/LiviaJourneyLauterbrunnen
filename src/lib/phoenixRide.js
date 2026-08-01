/**
 * Ponte entre a fênix, a Livia e o FinaleDirector.
 */
export const phoenixRide = {
  active: false,
  hidePlayer: false,
  /** pickup | mount | fly */
  phase: null,
  /** 0–1 progresso da fase atual */
  progress: 0,
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  /** ponto de pouso (mundo) — Livia caminha até aqui */
  landX: 0,
  landY: 0,
  landZ: 0,
}
