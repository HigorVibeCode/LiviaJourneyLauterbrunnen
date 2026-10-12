/**
 * Material JSX padrão — Lambert macio (estilo fofo). Nome mantido por
 * compatibilidade. Aceita as mesmas props de antes.
 */
export default function ToonMat({
  color = '#ffffff',
  emissive = '#000000',
  emissiveIntensity = 0,
  transparent,
  opacity,
  side,
  depthWrite,
  // eslint-disable-next-line no-unused-vars
  gradientMap,
  ...rest
}) {
  return (
    <meshLambertMaterial
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
