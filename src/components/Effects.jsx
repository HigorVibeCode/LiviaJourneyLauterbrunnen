import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'

/**
 * Pós-processamento leve: bloom nos destaques (cristais, neve, água),
 * vinheta para foco e SMAA para bordas limpas no estilo low-poly.
 */
export default function Effects() {
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium

  if (!preset.postFx) return null

  const effects = [
    <Bloom
      key="bloom"
      intensity={0.42}
      luminanceThreshold={0.72}
      luminanceSmoothing={0.28}
      mipmapBlur
      radius={0.6}
    />,
    <Vignette key="vignette" offset={0.28} darkness={0.42} eskil={false} />,
  ]

  if (preset.id !== 'high') effects.push(<SMAA key="smaa" />)

  return (
    <EffectComposer multisampling={preset.id === 'high' ? 4 : 0} enableNormalPass={false}>
      {effects}
    </EffectComposer>
  )
}
