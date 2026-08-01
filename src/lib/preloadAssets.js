import { useGLTF } from '@react-three/drei'
import { resumeAudio } from '../audio/engine'

const ADVENTURE_GLB = '/models/adventure_pack.glb'
const PHOENIX_GLB = '/models/phoenix.glb'

/** Pré-carrega assets pesados antes / durante o primeiro frame. */
export function preloadGameAssets() {
  useGLTF.preload(ADVENTURE_GLB)
  useGLTF.preload(PHOENIX_GLB)
  resumeAudio()
}

export { ADVENTURE_GLB, PHOENIX_GLB }
