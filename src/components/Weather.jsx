import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playerPosition } from '../store/playerStore'
import { PHASES } from '../config/world'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'

/**
 * Caixa de partículas apertada em volta da Livia: uma caixa grande
 * espalha as partículas e a precipitação praticamente desaparece na tela.
 */
const BOX = 22
const HEIGHT = 24

/**
 * Clima por fase, tudo na GPU:
 *  fase 2 (vale das águas) → chuva fina e constante
 *  fase 3 (passo nevado)   → nevasca
 *  fase 4 (mirante)        → neve leve
 */
export default function Weather() {
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium
  // um tipo por vez — chuva+neve juntas alocavam ~4k pontos sempre
  const count = Math.round((preset.id === 'high' ? 1200 : 700) * preset.density)

  return (
    <group>
      <Precipitation kind="snow" count={count} />
      <Precipitation kind="rain" count={count} />
    </group>
  )
}

function Precipitation({ kind, count }) {
  const pointsRef = useRef(null)
  const materialRef = useRef(null)
  const snow = kind === 'snow'

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    const size = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * BOX * 2
      pos[i * 3 + 1] = Math.random() * HEIGHT
      pos[i * 3 + 2] = (Math.random() - 0.5) * BOX * 2
      seed[i] = Math.random() * 100
      size[i] = snow ? 0.12 + Math.random() * 0.24 : 0.14 + Math.random() * 0.14
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    return geo
  }, [count, snow])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uHeight: { value: HEIGHT },
        },
        vertexShader: /* glsl */ `
          attribute float aSeed;
          attribute float aSize;
          uniform float uTime;
          uniform float uHeight;
          varying float vFade;

          void main() {
            vec3 p = position;
            ${
              snow
                ? /* glsl */ `
            float fall = mod(uTime * (1.6 + aSeed * 0.03) + aSeed * 7.0, uHeight);
            p.y = uHeight - fall;
            p.x += sin(uTime * 0.6 + aSeed) * 2.4;
            p.z += cos(uTime * 0.45 + aSeed * 1.3) * 1.8;`
                : /* glsl */ `
            float fall = mod(uTime * (16.0 + aSeed * 0.12) + aSeed * 9.0, uHeight);
            p.y = uHeight - fall;
            p.x += fall * 0.08; // chuva levemente inclinada pelo vento
            `
            }

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * ${snow ? '460.0' : '520.0'} / max(1.0, -mv.z);
            // some perto do chão, colado na câmera e na borda da caixa
            vFade = smoothstep(0.0, 1.0, p.y)
                  * smoothstep(1.6, 4.5, -mv.z)
                  * (1.0 - smoothstep(24.0, 34.0, -mv.z));
          }
        `,
        fragmentShader: snow
          ? /* glsl */ `
          uniform float uOpacity;
          varying float vFade;

          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = 1.0 - smoothstep(0.2, 0.5, length(c));
            float a = d * vFade * uOpacity;
            if (a < 0.01) discard;
            gl_FragColor = vec4(1.0, 1.0, 1.0, a);
          }
        `
          : /* glsl */ `
          uniform float uOpacity;
          varying float vFade;

          void main() {
            vec2 c = gl_PointCoord - 0.5;
            // risco vertical fino = gota caindo
            float line = (1.0 - smoothstep(0.03, 0.09, abs(c.x)))
                       * (1.0 - smoothstep(0.38, 0.5, abs(c.y)));
            float a = line * vFade * uOpacity * 0.55;
            if (a < 0.01) discard;
            gl_FragColor = vec4(0.78, 0.86, 0.95, a);
          }
        `,
      }),
    [snow],
  )

  useFrame((state, delta) => {
    const points = pointsRef.current
    const mat = materialRef.current
    if (!points || !mat) return

    mat.uniforms.uTime.value = state.clock.elapsedTime
    points.position.set(playerPosition.x, 0, playerPosition.z)

    const z = playerPosition.z
    let target = 0
    if (snow) {
      // nevasca no passo nevado; neve leve só no mirante (não no prado florido)
      if (z <= PHASES.snow.zTo + 12 && z >= PHASES.snow.zFrom - 4) target = 1
      else if (z <= PHASES.summit.zTo && z >= PHASES.summit.zFrom) target = 0.4
    } else if (z <= PHASES.water.zTo + 4 && z >= PHASES.water.zFrom - 4) {
      target = 1
    }

    const current = mat.uniforms.uOpacity.value
    mat.uniforms.uOpacity.value = current + (target - current) * Math.min(1, delta * 1.4)
    points.visible = mat.uniforms.uOpacity.value > 0.02
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled>
      <primitive ref={materialRef} object={material} attach="material" />
    </points>
  )
}
