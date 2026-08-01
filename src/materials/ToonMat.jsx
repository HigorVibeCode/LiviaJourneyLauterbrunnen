import { getToonGradientMap } from './toonMaterial'

/** Material toon para JSX — gradient map partilhada. */
export default function ToonMat({
  color = '#ffffff',
  emissive = '#000000',
  emissiveIntensity = 0,
  transparent,
  opacity,
  side,
  depthWrite,
  ...rest
}) {
  return (
    <meshToonMaterial
      gradientMap={getToonGradientMap()}
      color={color}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      transparent={transparent}
      opacity={opacity}
      side={side}
      depthWrite={depthWrite}
      {...rest}
    />
  )
}
