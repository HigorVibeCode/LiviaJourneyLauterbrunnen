import * as THREE from 'three'

/** Gradient map partilhada — 4 bandas cel (sombra → luz). */
let gradientMap = null

export function getToonGradientMap() {
  if (gradientMap) return gradientMap
  const steps = 4
  const data = new Uint8Array(steps * 4)
  const levels = [0.22, 0.52, 0.78, 1.0]
  for (let i = 0; i < steps; i++) {
    const v = Math.round(levels[i] * 255)
    data[i * 4] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  gradientMap = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat)
  gradientMap.minFilter = THREE.NearestFilter
  gradientMap.magFilter = THREE.NearestFilter
  gradientMap.generateMipmaps = false
  gradientMap.needsUpdate = true
  return gradientMap
}

/**
 * Material toon/cel partilhado — smooth normals, bandas via gradientMap.
 */
export function makeToonMaterial({
  color = '#ffffff',
  emissive = '#000000',
  emissiveIntensity = 0,
  transparent = false,
  opacity = 1,
  side = THREE.FrontSide,
} = {}) {
  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: getToonGradientMap(),
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
    transparent,
    opacity,
    side,
  })
  return mat
}

/** Clona um toon existente com overrides de cor/emissive. */
export function cloneToonMaterial(base, overrides = {}) {
  const mat = base.clone()
  if (overrides.color !== undefined) mat.color.set(overrides.color)
  if (overrides.emissive !== undefined) mat.emissive.set(overrides.emissive)
  if (overrides.emissiveIntensity !== undefined) mat.emissiveIntensity = overrides.emissiveIntensity
  if (overrides.transparent !== undefined) mat.transparent = overrides.transparent
  if (overrides.opacity !== undefined) mat.opacity = overrides.opacity
  return mat
}

/** Substitui MeshStandardMaterial inline por toon (compat helper). */
export function toonStandard(opts) {
  return makeToonMaterial(opts)
}
