import * as THREE from 'three'

/**
 * "Mundo que rola" do Animal Crossing: tudo desce suavemente conforme se
 * afasta da câmera, como se o vale fosse a superfície de um planetinha.
 * Dá a cara do estilo e ainda esconde o fim do alcance de visão.
 *
 * Só visual (física intacta). Injetado no chunk `project_vertex`, comum a
 * todos os materiais do three. Fora: mapas de sombra e quem define NO_CURVE
 * (céu, montanhas de fundo).
 */
export const CURVE_K = 0.0011

let installed = false

export function installWorldCurve() {
  if (installed) return
  installed = true
  const chunk = THREE.ShaderChunk.project_vertex
  const target = 'mvPosition = modelViewMatrix * mvPosition;'
  if (!chunk.includes(target)) return
  THREE.ShaderChunk.project_vertex = chunk.replace(
    target,
    /* glsl */ `
#if !defined( DEPTH_PACKING ) && !defined( DISTANCE ) && !defined( NO_CURVE )
  {
    vec4 curveWorld = modelMatrix * mvPosition;
    vec2 curveD = curveWorld.xz - cameraPosition.xz;
    curveWorld.y -= dot( curveD, curveD ) * ${CURVE_K.toFixed(5)};
    mvPosition = viewMatrix * curveWorld;
  }
#else
  mvPosition = modelViewMatrix * mvPosition;
#endif
`,
  )
}

/** Marca um material para NÃO curvar (céu, montanhas distantes) */
export function noCurve(material) {
  if (!material) return material
  material.defines = { ...(material.defines ?? {}), NO_CURVE: '' }
  material.needsUpdate = true
  return material
}
