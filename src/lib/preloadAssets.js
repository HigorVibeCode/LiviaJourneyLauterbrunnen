import { useGLTF } from '@react-three/drei'

const ADVENTURE_GLB = '/models/adventure_pack.glb'
const PHOENIX_GLB = '/models/phoenix.glb'

/** Pré-carrega assets pesados antes / durante o primeiro frame. */
export function preloadGameAssets() {
  useGLTF.preload(ADVENTURE_GLB)
  useGLTF.preload(PHOENIX_GLB)
  // Não criar/resume AudioContext aqui — no mobile precisa de gesto do utilizador
}

export { ADVENTURE_GLB, PHOENIX_GLB }
