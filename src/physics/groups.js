import { interactionGroups } from '@react-three/rapier'

/** Chão, paredes, troncos, portões — colisão física normal */
export const GROUP_WORLD = 0
/**
 * Volumes só para oclusão da câmera (copas, telhados).
 * Sem resposta física com a Livia (solver vazio).
 */
export const GROUP_CAMERA_OCCLUDER = 1

export const PLAYER_GROUPS = interactionGroups(GROUP_WORLD, [GROUP_WORLD])
export const CAMERA_OCCLUDER_COLLISION = interactionGroups(GROUP_CAMERA_OCCLUDER, [GROUP_WORLD])
export const CAMERA_OCCLUDER_SOLVER = interactionGroups(GROUP_CAMERA_OCCLUDER, [])
/** Ray da câmera: sólidos do mundo + volumes de oclusão */
export const CAM_RAY_GROUPS = interactionGroups(GROUP_WORLD, [GROUP_WORLD, GROUP_CAMERA_OCCLUDER])
