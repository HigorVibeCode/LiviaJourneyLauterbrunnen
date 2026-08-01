import { useRef, useMemo, useEffect, useId } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useWaterfallStore } from '../store/waterfallStore'

/**
 * Cachoeira de Lauterbrunnen.
 * `hero` = Staubbach Fall: fina, altíssima, com muita névoa na base.
 * `frozen` = congelada (fase da neve): colunas de gelo, sem correnteza.
 *
 * A água que cai são faixas verticais que descem e reciclam — dá a
 * sensação de fluxo sem textura nem partícula pesada.
 */
export default function Waterfall({
  position = [0, 0, 0],
  height = 60,
  width = 5,
  depth = 4,
  hero = false,
  frozen = false,
}) {
  const id = useId()
  const streaksRef = useRef(null)
  const mistRef = useRef(null)
  const splashRef = useRef(null)
  const veilRefs = useRef([])
  const registerField = useWaterfallStore((s) => s.registerField)
  const unregisterField = useWaterfallStore((s) => s.unregisterField)

  const [wx, , wz] = position
  const veilCenterY = height * 0.5

  useEffect(() => {
    if (frozen) return undefined
    registerField(id, {
      center: [wx, veilCenterY, wz + 0.6],
      halfExtents: [width * 0.6, height * 0.48, depth * 0.55],
      force: { x: wx >= 0 ? -2.4 : 2.4, y: -20, z: 3 },
    })
    return () => unregisterField(id)
  }, [id, wx, wz, width, height, depth, veilCenterY, frozen, registerField, unregisterField])

  const streaks = useMemo(() => {
    const count = frozen ? 0 : hero ? 44 : 18
    return Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * width * 0.85,
      z: (Math.random() - 0.5) * 0.5,
      len: height * (0.12 + Math.random() * 0.2),
      w: 0.16 + Math.random() * 0.3,
      speed: height * (0.28 + Math.random() * 0.24),
      offset: Math.random() * height,
      shade: i % 3,
    }))
  }, [width, height, hero, frozen])

  const mist = useMemo(() => {
    const count = frozen ? 6 : hero ? 30 : 12
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * width * (hero ? 4 : 2.6),
      base: Math.random() * 2,
      z: (Math.random() - 0.5) * depth * 2.4,
      s: (hero ? 0.9 : 0.5) + Math.random() * (hero ? 1.6 : 0.8),
      speed: 0.4 + Math.random() * 0.7,
      rise: hero ? 8 : 4,
      phase: Math.random() * Math.PI * 2,
    }))
  }, [width, depth, hero, frozen])

  const splashes = useMemo(() => {
    if (frozen) return []
    const count = hero ? 5 : 3
    return Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * width * 1.4,
      z: width * 0.7 + Math.random() * width * 0.5,
      period: 1.1 + Math.random() * 0.8,
      phase: i * 0.9,
      max: hero ? 2.6 : 1.6,
    }))
  }, [frozen, hero, width])

  const iceColumns = useMemo(() => {
    if (!frozen) return []
    return Array.from({ length: 7 }, (_, i) => ({
      x: (i - 3) * (width / 6),
      w: 0.5 + Math.random() * 0.7,
      h: height * (0.6 + Math.random() * 0.4),
    }))
  }, [frozen, width, height])

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (streaksRef.current) {
      const children = streaksRef.current.children
      for (let i = 0; i < children.length; i++) {
        const s = streaks[i]
        if (!s) continue
        const travel = (s.offset + t * s.speed) % (height + s.len)
        children[i].position.y = height - travel
      }
    }

    if (mistRef.current) {
      const children = mistRef.current.children
      for (let i = 0; i < children.length; i++) {
        const p = mist[i]
        if (!p) continue
        const cycle = (t * p.speed + p.phase) % p.rise
        children[i].position.y = p.base + cycle
        children[i].position.x = p.x + Math.sin(t * 0.7 + p.phase) * 1.2
        const k = cycle / p.rise
        children[i].scale.setScalar(p.s * (1 + k * 1.1))
        children[i].material.opacity = Math.max(0, (frozen ? 0.2 : 0.34) * (1 - k))
      }
    }

    for (let i = 0; i < veilRefs.current.length; i++) {
      const mesh = veilRefs.current[i]
      if (mesh) mesh.position.x = Math.sin(t * 1.2 + i) * 0.1
    }

    if (splashRef.current) {
      const children = splashRef.current.children
      for (let i = 0; i < children.length; i++) {
        const s = splashes[i]
        if (!s) continue
        const k = ((t + s.phase) % s.period) / s.period
        children[i].scale.setScalar(0.4 + k * s.max)
        children[i].material.opacity = 0.5 * (1 - k)
      }
    }
  })

  return (
    <group position={[wx, 0, wz]}>
      {/* saliência de onde a água salta */}
      <RigidBody type="fixed" position={[0, height + 1.6, -1.8]} colliders={false}>
        <CuboidCollider args={[(width + 6) / 2, 2, 2.6]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width + 6, 4.2, 5.2]} />
          <meshStandardMaterial color="#6a6d70" flatShading roughness={1} />
        </mesh>
      </RigidBody>

      {/* recorte escuro na rocha atrás da queda: contraste que faz o
          véu branco saltar aos olhos de longe */}
      <mesh position={[0, height * 0.5, -0.55]}>
        <boxGeometry args={[width + 2.4, height, 1]} />
        <meshStandardMaterial color="#39424a" flatShading roughness={1} />
      </mesh>
      {/* rocha molhada escorrendo dos lados */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 + 1.7), height * 0.4, -0.2]}>
          <boxGeometry args={[1.2, height * 0.8, 0.7]} />
          <meshStandardMaterial
            color="#4c585f"
            flatShading
            roughness={0.35}
            metalness={0.15}
          />
        </mesh>
      ))}

      {frozen ? (
        <group>
          {iceColumns.map((c, i) => (
            <mesh key={i} position={[c.x, c.h / 2, 0.3]} castShadow>
              <cylinderGeometry args={[c.w * 0.6, c.w, c.h, 6]} />
              <meshStandardMaterial
                color="#cfe8f4"
                flatShading
                roughness={0.12}
                metalness={0.15}
                transparent
                opacity={0.88}
              />
            </mesh>
          ))}
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider position={[0, height * 0.4, 0.3]} args={[width * 0.55, height * 0.4, 0.9]} />
          </RigidBody>
        </group>
      ) : (
        <>
          {/* véu translúcido de fundo */}
          {[0, 1].map((i) => (
            <mesh
              key={i}
              ref={(el) => {
                veilRefs.current[i] = el
              }}
              position={[0, veilCenterY, 0.3 + i * 0.14]}
            >
              <planeGeometry args={[width - i * 0.5, height]} />
              <meshStandardMaterial
                color={i === 0 ? '#cdeaf6' : '#a9d8ec'}
                transparent
                opacity={0.42 - i * 0.14}
                side={THREE.DoubleSide}
                depthWrite={false}
                flatShading
              />
            </mesh>
          ))}

          {/* faixas de água descendo */}
          <group ref={streaksRef}>
            {streaks.map((s, i) => (
              <mesh key={i} position={[s.x, height, 0.55 + s.z]}>
                <boxGeometry args={[s.w, s.len, 0.16]} />
                <meshStandardMaterial
                  color={['#f2fbff', '#d6f0fb', '#b9e3f4'][s.shade]}
                  emissive="#dff2fb"
                  emissiveIntensity={0.35}
                  transparent
                  opacity={0.82}
                  depthWrite={false}
                  flatShading
                />
              </mesh>
            ))}
          </group>
        </>
      )}

      {/* lago na base */}
      <RigidBody type="fixed" position={[0, -0.3, width * 0.9]} colliders={false}>
        <CuboidCollider args={[width * 1.3, 0.25, width * 0.9]} />
        <mesh receiveShadow>
          <boxGeometry args={[width * 2.6, 0.45, width * 1.8]} />
          <meshStandardMaterial
            color={frozen ? '#d8ecf5' : '#4a8ea8'}
            flatShading
            roughness={frozen ? 0.2 : 0.15}
            metalness={0.25}
          />
        </mesh>
      </RigidBody>

      {/* anéis de respingo na superfície do lago */}
      {!frozen && (
        <group ref={splashRef} position={[0, -0.05, 0]}>
          {splashes.map((s, i) => (
            <mesh key={i} position={[s.x, 0, s.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.82, 1, 12]} />
              <meshBasicMaterial color="#f4fbff" transparent depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}

      {/* arco-íris na névoa — assinatura do Staubbach */}
      {hero && !frozen && (
        <group position={[width * 0.4, 1.2, width * 1.1]} rotation={[0, 0.5, 0]}>
          {[
            ['#ff6a5e', 4.6],
            ['#ffd24a', 4.25],
            ['#6ecf7a', 3.9],
            ['#6aa8e8', 3.55],
          ].map(([color, radius]) => (
            <mesh key={color}>
              <torusGeometry args={[radius, 0.16, 5, 24, Math.PI]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.2}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* névoa */}
      <group ref={mistRef} position={[0, 0.4, 1.4]}>
        {mist.map((p, i) => (
          <mesh key={i} position={[p.x, p.base, p.z]}>
            <sphereGeometry args={[1, 5, 4]} />
            <meshStandardMaterial
              color="#eef8fc"
              transparent
              opacity={0.3}
              depthWrite={false}
              flatShading
            />
          </mesh>
        ))}
      </group>

      {/* pedras molhadas na base */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          position={[(i - 2.5) * (width * 0.5), 0.3, width * 1.5 + (i % 2) * 1.2]}
          rotation={[i * 0.4, i, 0]}
          castShadow
        >
          <dodecahedronGeometry args={[0.7 + (i % 3) * 0.4, 0]} />
          <meshStandardMaterial color={frozen ? '#b8ccd8' : '#5e6a66'} flatShading roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
