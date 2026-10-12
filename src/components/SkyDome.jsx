import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { skyState } from '../lib/skyState'

/**
 * Céu em degradê (zênite → horizonte) com disco de sol, brilho em volta
 * e estrelas que aparecem à noite. Uma esfera presa à câmera, sem fog —
 * a cor do horizonte é a mesma da neblina, então o mundo "derrete" no céu.
 */
export default function SkyDome() {
  const ref = useRef(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          uTop: { value: skyState.top },
          uHorizon: { value: skyState.horizon },
          uSunColor: { value: skyState.sunColor },
          uSunDir: { value: skyState.sunDir },
          uStars: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww; // sempre no fundo
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uHorizon;
          uniform vec3 uSunColor;
          uniform vec3 uSunDir;
          uniform float uStars;
          uniform float uTime;
          varying vec3 vDir;

          float hash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }

          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            // degradê suave, horizonte um pouco "inchado" (luz difusa)
            float t = smoothstep(-0.05, 0.55, h);
            vec3 col = mix(uHorizon, uTop, pow(t, 0.8));
            // abaixo do horizonte: mesma cor da neblina
            col = mix(uHorizon, col, smoothstep(-0.12, 0.02, h));

            // sol: disco + halo largo
            float s = max(dot(d, normalize(uSunDir)), 0.0);
            col += uSunColor * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.08);

            // estrelas (noite)
            if (uStars > 0.01 && h > 0.0) {
              vec3 cell = floor(d * 220.0);
              float r = hash(cell);
              float star = step(0.9965, r);
              float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 4.0) + r * 40.0);
              col += vec3(star * tw * uStars * smoothstep(0.0, 0.25, h));
            }
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )

  useFrame((state) => {
    const m = ref.current
    if (!m) return
    m.position.copy(state.camera.position)
    material.uniforms.uStars.value = skyState.stars
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh ref={ref} renderOrder={-1000} frustumCulled={false} userData={{ noCull: true }}>
      <sphereGeometry args={[500, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
