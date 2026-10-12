import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'

/**
 * Pós-processamento (só na qualidade Alta): brilho suave nas luzes,
 * lanternas e estrelinhas + vinheta leve + antisserrilhado.
 * (O contorno "Outline" antigo usava <Select>, que entrava em loop
 * infinito de atualização do React — removido.)
 */
export default function Effects() {
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium

  if (!preset.postFx) return null

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom intensity={0.55} luminanceThreshold={0.78} luminanceSmoothing={0.22} mipmapBlur radius={0.6} />
      <Vignette offset={0.32} darkness={0.42} eskil={false} />
      <SMAA />
    </EffectComposer>
  )
}
