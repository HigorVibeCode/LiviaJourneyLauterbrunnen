import { HORSE_WAIT, HORSE_DISMOUNT_Z, GATES } from '../config/world'

/**
 * Estado global da cavalgada (pasto entre pradaria e vale das águas).
 * Livia e Horse leem/escrevem aqui no useFrame.
 *
 * Spawn inicial: logo após GATES.gate_pasture (ver HORSE_WAIT em world.js).
 */
export const horseRide = {
  /** jogadora está montada */
  mounted: false,
  /** cavalo “disponível” (portão do pasto aberto) */
  ready: false,
  /** perto o bastante para montar (HUD) */
  nearMount: false,
  /** cumprimento (empinar) em andamento / concluído */
  greeting: false,
  greetDone: false,
  x: HORSE_WAIT.x,
  y: HORSE_WAIT.y,
  z: HORSE_WAIT.z,
  yaw: Math.PI,
  /** velocidade horizontal atual (para animação / sfx) */
  speed: 0,
  /** bob vertical do corpo no galope (metros) — Livia acompanha */
  bobY: 0,
  /** posição de espera no portão da pradaria (não muda até desmontar no fim) */
  waitX: HORSE_WAIT.x,
  waitZ: HORSE_WAIT.z,
  /** true depois de desmontar — fica perto de gate_night */
  finished: false,
}

export const HORSE_MOUNT_DIST = 4.8
/** bem mais rápido que a pé (WALK 7.4 / RUN 12.4) */
export const HORSE_RIDE_WALK = 17.5
export const HORSE_RIDE_RUN = 28
/** aceleração suave (menor = mais gradual) */
export const HORSE_ACCEL = 7.2
export const HORSE_CAM_DIST = 14.8
export const HORSE_CAM_LOOK_Y = 1.05
/**
 * Altura do corpo físico ao montar (antes do offset visual do mesh).
 * O mesh afunda com modelRef.position.y negativo em Livia.jsx.
 */
export const HORSE_SEAT_Y = 1.12
/** offset local −Z (assento um pouco atrás da cernelha) */
export const HORSE_SEAT_Z = -0.06
/** afunda o mesh da Livia na sela (somado ao root) */
export const HORSE_MODEL_SINK = -0.72
/** cumprimento: empina + relincha ao abrir o portão */
export const HORSE_GREET_DUR = 2.6

/** Z em que a cavalgada termina (perto do vale noturno) */
export function horseShouldDismount(z) {
  return z <= HORSE_DISMOUNT_Z || z <= GATES.gate_night.z + 8
}
