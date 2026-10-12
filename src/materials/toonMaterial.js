import * as THREE from 'three'

/**
 * Material padrão do jogo — estilo "fofo" (Animal Crossing):
 * sombreamento Lambert macio (sem as faixas duras do toon antigo), cores
 * claras, sombra que nunca fica preta (a luz hemisférica levanta tudo).
 *
 * Os nomes "toon" ficaram por compatibilidade com o resto do código.
 */
let gradientMap = null

/** @deprecated mantido só para imports antigos */
export function getToonGradientMap() {
  if (gradientMap) return gradientMap
  const data = new Uint8Array([140, 140, 140, 255, 255, 255, 255, 255])
  gradientMap = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat)
  gradientMap.needsUpdate = true
  return gradientMap
}

export function makeToonMaterial({
  color = '#ffffff',
  emissive = '#000000',
  emissiveIntensity = 0,
  transparent = false,
  opacity = 1,
  side = THREE.FrontSide,
  nearFade = false,
  flatShading = false,
} = {}) {
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
    transparent,
    opacity,
    side,
    flatShading,
  })
  // some perto da câmera (árvores/props) — ver materials/nearFade.js
  if (nearFade) mat.defines = { ...(mat.defines ?? {}), NEAR_FADE: '' }
  return mat
}

/** Clona um material existente com overrides de cor/emissive. */
export function cloneToonMaterial(base, overrides = {}) {
  const mat = base.clone()
  if (overrides.color !== undefined) mat.color.set(overrides.color)
  if (overrides.emissive !== undefined) mat.emissive.set(overrides.emissive)
  if (overrides.emissiveIntensity !== undefined) mat.emissiveIntensity = overrides.emissiveIntensity
  if (overrides.transparent !== undefined) mat.transparent = overrides.transparent
  if (overrides.opacity !== undefined) mat.opacity = overrides.opacity
  return mat
}

export function toonStandard(opts) {
  return makeToonMaterial(opts)
}
