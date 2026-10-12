import { useGLTF } from '@react-three/drei'

const ADVENTURE_GLB = '/models/adventure_pack.glb'

/** Pré-carrega assets pesados antes / durante o primeiro frame. (A fênix agora é procedural.) */
export function preloadGameAssets() {
  useGLTF.preload(ADVENTURE_GLB)
  // Não criar/resume AudioContext aqui — no mobile precisa de gesto do utilizador
}

export { ADVENTURE_GLB }
