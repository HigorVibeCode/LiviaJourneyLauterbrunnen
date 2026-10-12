import * as THREE from 'three'

/**
 * Tudo que fica colado na câmera some com um "pontilhado" suave
 * (árvores, telhados, cercas) — a câmera nunca mais fica tampada por
 * um tronco. Injeta no chunk comum a todos os materiais do three, então
 * vale para toon, standard, basic, instanced e batches.
 *
 * 1 / gl_FragCoord.w = profundidade na câmera (perspectiva).
 * Mapas de sombra (DEPTH_PACKING / DISTANCE) ficam de fora.
 */
const FADE_START = 0.9
const FADE_END = 2.2

let installed = false

export function installNearFade() {
  if (installed) return
  installed = true
  const inject = /* glsl */ `
#if !defined( DEPTH_PACKING ) && !defined( DISTANCE )
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
