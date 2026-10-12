/**
 * Estado compartilhado (mutável, sem React) entre a Livia e o HUD.
 *  — yaw da câmera: a bússola do HUD aponta o objetivo relativo à tela
 *  — pedidos do menu: "voltar para a trilha" é executado pela Livia no frame
 */
export const cameraState = { yaw: 0 }

export const playerActions = {
  /** pedido do menu de pausa: tirar a Livia de onde ficou presa */
  unstuck: false,
}
