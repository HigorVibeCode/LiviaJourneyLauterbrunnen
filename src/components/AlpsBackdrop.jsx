import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeRng } from '../config/world'
import Instanced from './world/Instanced'

/**
 * Alpes distantes — só visual, sem física.
 * Camadas em profundidade + névoa criam parallax e escala real do vale.
 */
export default function AlpsBackdrop() {
  const rows = useMemo(() => {
    const rng = makeRng(555)
    // Cores já claras: as camadas usam material não iluminado + fog,
    // que é o que dá a perspectiva aérea dos Alpes (e é mais barato).
    // Panorama à frente do mirante (z −380 em diante): quatro cristas em
    // profundidade, para que do alto se veja "o resto dos Alpes".
    // Camadas próximas ao vale ficam só nas laterais (flank) — senão um
    // cone verde enorme tapa a vista da neve/escadaria no meio do caminho.
    const layers = [
      { z: -980, scale: 3.2, color: '#a8c4dc', snow: '#f8fcff', count: 11 },
      { z: -820, scale: 2.6, color: '#9eb8d0', snow: '#f4f9fd', count: 10 },
      { z: -740, scale: 2.1, color: '#94adc4', snow: '#f0f6fa', count: 9 },
      { z: -500, scale: 1.35, color: '#8eb0a0', snow: '#eaf4f8', count: 6, flank: true },
      { z: -360, scale: 1.1, color: '#88a898', snow: '#e6f0f6', count: 6, flank: true },
      { z: 320, scale: 1.8, color: '#9cb4cc', snow: '#f2f8fc', count: 7 },
      { z: 220, scale: 1.3, color: '#90a8a0', snow: '#eaf2f8', count: 6 },
    ]

    return layers.map((layer, li) => ({
      ...layer,
      key: li,
      peaks: Array.from({ length: layer.count }, (_, i) => {
        const h = 46 + rng() * 40
        let x
        if (layer.flank) {
          const side = i % 2 === 0 ? -1 : 1
          x = side * (95 + rng() * 55) + (rng() - 0.5) * 18
        } else {
          x = (i - (layer.count - 1) / 2) * (72 + rng() * 34)
        }
        return {
          x,
          h,
          z: (rng() - 0.5) * 70,
          ry: rng() * Math.PI,
        }
      }),
    }))
  }, [])

  return (
    <group>
      {rows.map((row) => (
        <group key={row.key} position={[0, -10, row.z]} scale={row.scale}>
          {row.peaks.map((p, i) => (
            <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.ry, 0]}>
              <mesh>
                <coneGeometry args={[p.h * 0.66, p.h, 6]} />
                <meshBasicMaterial color={row.color} fog />
              </mesh>
              <mesh position={[0, p.h * 0.42, 0]}>
                <coneGeometry args={[p.h * 0.27, p.h * 0.32, 6]} />
                <meshBasicMaterial color={row.snow} fog />
              </mesh>
              <mesh position={[-p.h * 0.32, -p.h * 0.14, p.h * 0.18]}>
                <coneGeometry args={[p.h * 0.42, p.h * 0.68, 5]} />
                <meshBasicMaterial color={shade(row.color, -14)} fog />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      <Clouds />
    </group>
  )
}

/** Nuvens volumétricas fake (instanciadas) que derivam lentamente */
function Clouds() {
  const ref = useRef(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 6, 5), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#f6f9fc',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        fog: true,
      }),
    [],
  )

  const items = useMemo(() => {
    const rng = makeRng(1212)
    const out = []
    for (let c = 0; c < 26; c++) {
      const cx = (rng() * 2 - 1) * 220
      const cy = 52 + rng() * 46
      const cz = 160 - rng() * 1000
      const blobs = 4 + Math.floor(rng() * 4)
      for (let b = 0; b < blobs; b++) {
        out.push({
          x: cx + (rng() - 0.5) * 34,
          y: cy + (rng() - 0.5) * 7,
          z: cz + (rng() - 0.5) * 26,
          s: 7 + rng() * 11,
          sy: 0.5 + rng() * 0.3,
        })
      }
    }
    return out
  }, [])

  useFrame((state) => {
    if (!ref.current) return
    ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.012) * 40
  })

  return (
    <group ref={ref}>
      <Instanced
        geometry={geometry}
        material={material}
        items={items}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  )
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount))
  const b = Math.max(0, Math.min(255, (n & 255) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
