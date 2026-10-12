import * as THREE from 'three'

/**
 * O que fica colado na câmera some com um "pontilhado" suave
 * (árvores, casas, cercas, props) — a câmera nunca fica tampada por um
 * tronco. Só nos materiais marcados com NEAR_FADE (enableNearFade): um
 * `discard` em TODO shader (chão, penhascos) custaria early-Z em GPUs
 * de tablet.
 *
 * 1 / gl_FragCoord.w = profundidade na câmera (perspectiva).
 * Mapas de sombra (DEPTH_PACKING / DISTANCE) ficam de fora.
 */
const FADE_START = 2.2
const FADE_END = 4.6

let installed = false

export function installNearFade() {
  if (installed) return
  installed = true
  const inject = /* glsl */ `
#if defined( NEAR_FADE ) && !defined( DEPTH_PACKING ) && !defined( DISTANCE )
  {
    float camDepth = 1.0 / max( gl_FragCoord.w, 1e-5 );
    if ( camDepth < ${FADE_END.toFixed(2)} ) {
      float keep = smoothstep( ${FADE_START.toFixed(2)}, ${FADE_END.toFixed(2)}, camDepth );
      // dither ordenado 4x4: some aos pouquinhos, sem precisar de transparência
      vec2 p = mod( floor( gl_FragCoord.xy ), 4.0 );
      float bayer = mod( p.x * 4.0 + p.y * 11.0, 16.0 ) / 16.0;
      if ( keep < bayer + 0.03 ) discard;
    }
  }
#endif
`
  THREE.ShaderChunk.clipping_planes_fragment = inject + THREE.ShaderChunk.clipping_planes_fragment
}

/** Marca um material para sumir perto da câmera */
export function enableNearFade(material) {
  if (!material) return material
  material.defines = { ...(material.defines ?? {}), NEAR_FADE: '' }
  material.needsUpdate = true
  return material
}
