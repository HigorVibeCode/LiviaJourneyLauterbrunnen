import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  Outline,
} from '@react-three/postprocessing'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'

/**
 * Pós-processamento: bloom + vinheta; outline cel só em high.
 */
export default function Effects() {
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium

  if (!preset.postFx) return null

  const effects = [
    <Bloom
      key="bloom"
      intensity={0.38}
      luminanceThreshold={0.74}
      luminanceSmoothing={0.24}
      mipmapBlur
      radius={0.55}
    />,
    <Vignette key="vignette" offset={0.3} darkness={0.48} eskil={false} />,
  ]

  if (preset.id === 'high') {
    effects.push(
      <Outline
        key="outline"
        blur={false}
        edgeStrength={2.6}
        width={1024}
        height={1024}
        visibleEdgeColor={0x141820}
        hiddenEdgeColor={0x141820}
        xRay={false}
      />,
    )
  } else {
    effects.push(<SMAA key="smaa" />)
  }

  return (
    <EffectComposer multisampling={preset.id === 'high' ? 4 : 0} enableNormalPass={false}>
      {effects}
    </EffectComposer>
  )
}
