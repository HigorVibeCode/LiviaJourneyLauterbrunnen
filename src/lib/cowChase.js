import { STAIRS } from '../config/world'

/**
 * Estado da vaca alpina (escadaria / mirante).
 * Spawna 1× após abrir gate_summit; fora da escada, continua pastando.
 */
export const cowChase = {
  spawned: false,
  hunting: false,
  dragging: false,
  dragProgress: 0,
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  wanderX: 0,
  wanderZ: 0,
  victimX: 0,
  victimY: 0,
  victimZ: 0,
  victimYaw: 0,
  victimBob: 0,
  victimRoll: 0,
  victimPitch: 0,
}

/** Destino do arrasto: base da escadaria */
export const COW_GATE = {
  x: 0,
  z: STAIRS.zStart + 2,
  y: 0,
}

/** Área da vaca: corredor da escadaria (não o prado florido) */
export const COW_BOUNDS = {
  halfX: STAIRS.halfWidth - 2.5,
  zNear: STAIRS.zStart - 4,
  zFar: STAIRS.zStart - (STAIRS.steps - 1) * STAIRS.stepDepth + 24,
}

export function randomCowPoint() {
  const x = (Math.random() * 2 - 1) * COW_BOUNDS.halfX
  const z = COW_BOUNDS.zFar + Math.random() * (COW_BOUNDS.zNear - COW_BOUNDS.zFar)
  return { x, z }
}

export const COW_DRAG_DURATION = 7.5
export const COW_DRAG_SPEED = 5.8
