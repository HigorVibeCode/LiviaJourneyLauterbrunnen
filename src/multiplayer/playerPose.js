/**
 * Pose local para o multijogador — mutável, atualizada pela Livia a cada frame.
 */
export const playerPose = {
  x: 0,
  y: 2.5,
  z: 96,
  yaw: 0,
  speed: 0,
  grounded: true,
}

export function updatePlayerPose(partial) {
  if (partial.x != null) playerPose.x = partial.x
  if (partial.y != null) playerPose.y = partial.y
  if (partial.z != null) playerPose.z = partial.z
  if (partial.yaw != null) playerPose.yaw = partial.yaw
  if (partial.speed != null) playerPose.speed = partial.speed
  if (partial.grounded != null) playerPose.grounded = partial.grounded
}
