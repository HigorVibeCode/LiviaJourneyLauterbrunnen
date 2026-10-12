import { useRef, useMemo, useEffect, useId } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useWaterfallStore } from '../store/waterfallStore'
import { playerPosition } from '../store/playerStore'
import { makeToonMaterial } from '../materials/toonMaterial'
import StaticBatch from './world/StaticBatch'
import { RoundedBox } from '@react-three/drei'
import { PAL } from '../config/palette'

/**
 * Cachoeira de Lauterbrunnen.
 * `hero` = Staubbach Fall: fina, altíssima, com muita névoa na base.
 * `frozen` = congelada (fase da neve): colunas de gelo, sem correnteza.
 *
 * A água que cai são faixas verticais que descem e reciclam — dá a
 * sensação de fluxo sem textura nem partícula pesada.
 */
const tmpM = new THREE.Matrix4()
const tmpP = new THREE.Vector3()
const tmpS = new THREE.Vector3()
const ID_Q = new THREE.Quaternion()
// faixa roliça (cápsula achatada) — água de desenho animado
const STREAK_GEO = new THREE.CapsuleGeometry(0.5, 1, 3, 8).scale(1, 0.5, 0.32)
const MIST_GEO = new THREE.SphereGeometry(1, 12, 8)
const STREAK_COLORS = ['#ffffff', '#dcf7ff', '#b5ecfb'].map((c) => new THREE.Color(c))
const streakMat = makeToonMaterial({
  color: '#ffffff',
  emissive: '#e6fbff',
  emissiveIntensity: 0.45,
  transparent: true,
  opacity: 0.92,
})
streakMat.depthWrite = false
const mistMat = makeToonMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.25, transparent: true, opacity: 0.5 })
mistMat.depthWrite = false
const mistMatFrozen = makeToonMaterial({ color: '#ffffff', transparent: true, opacity: 0.3 })
mistMatFrozen.depthWrite = false

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
  const animInit = useRef(false)
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
    // longe da Livia não anima (depois de posicionar as instâncias uma vez)
    if (animInit.current && Math.abs(playerPosition.z - wz) > 160) return
    animInit.current = true

    // faixas e névoa: UM InstancedMesh cada (antes ~70 meshes por cachoeira)
    const sm = streaksRef.current
    if (sm) {
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i]
        const travel = (s.offset + t * s.speed) % (height + s.len)
        tmpP.set(s.x, height - travel, 0.55 + s.z)
        tmpS.set(s.w, s.len, 1)
        tmpM.compose(tmpP, ID_Q, tmpS)
        sm.setMatrixAt(i, tmpM)
      }
      sm.instanceMatrix.needsUpdate = true
    }

    const mm = mistRef.current
    if (mm) {
      for (let i = 0; i < mist.length; i++) {
        const p = mist[i]
        const cycle = (t * p.speed + p.phase) % p.rise
        const k = cycle / p.rise
        // some encolhendo no topo (opacidade por instância não existe)
        const sc = p.s * (1 + k * 1.1) * (1 - k * k)
        tmpP.set(p.x + Math.sin(t * 0.7 + p.phase) * 1.2, p.base + cycle, p.z)
        tmpS.setScalar(Math.max(0.001, sc))
        tmpM.compose(tmpP, ID_Q, tmpS)
        mm.setMatrixAt(i, tmpM)
      }
      mm.instanceMatrix.needsUpdate = true
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
      {/* saliência roliça de onde a água salta */}
      <RigidBody type="fixed" position={[0, height + 1.6, -1.8]} colliders={false}>
        <CuboidCollider args={[(width + 6) / 2, 2, 2.6]} />
        <RoundedBox args={[width + 6, 4.2, 5.2]} radius={1.2} smoothness={2} bevelSegments={2}>
          <ToonMat color={frozen ? '#e6f2fb' : PAL.cliffSide} />
        </RoundedBox>
      </RigidBody>
      {/* espuma na crista */}
      {!frozen && (
        <mesh position={[0, height + 0.1, 0.55]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.6]}>
          <capsuleGeometry args={[0.55, width - 0.6, 4, 10]} />
          <ToonMat color={PAL.foam} />
        </mesh>
      )}

      <StaticBatch>
        {/* fundo turquesa atrás da queda: o véu branco salta aos olhos */}
        <RoundedBox args={[width + 2.4, height, 1]} radius={0.45} smoothness={2} bevelSegments={1} position={[0, height * 0.5, -0.55]}>
          <ToonMat color={frozen ? PAL.ice : PAL.waterDeep} />
        </RoundedBox>
        {/* rocha clarinha dos lados */}
        {[-1, 1].map((s) => (
          <RoundedBox
            key={s}
            args={[1.6, height * 0.8, 1.1]}
            radius={0.5}
            smoothness={2}
            bevelSegments={1}
            position={[s * (width / 2 + 1.8), height * 0.4, -0.2]}
          >
            <ToonMat color={frozen ? '#dbe8f4' : PAL.cliffBand} />
          </RoundedBox>
        ))}
        {/* pedras roliças na base */}
        {Array.from({ length: 6 }, (_, i) => (
          <mesh
            key={i}
            position={[(i - 2.5) * (width * 0.5), 0.3, width * 1.5 + (i % 2) * 1.2]}
            rotation={[0, i, 0]}
            scale={[1, 0.7, 0.9]}
          >
            <sphereGeometry args={[0.75 + (i % 3) * 0.4, 10, 8]} />
            <ToonMat color={frozen ? '#e8f2fb' : i % 2 ? PAL.rock : '#dbe2ec'} />
          </mesh>
        ))}
        {/* anel de espuma em volta do lago */}
        {!frozen && (
          <mesh position={[0, -0.04, width * 0.9]} scale={[width * 1.3, 0.12, width * 0.9]}>
            <sphereGeometry args={[1, 24, 6]} />
            <ToonMat color={PAL.foam} />
          </mesh>
        )}
      </StaticBatch>

      {frozen ? (
        <group>
          <StaticBatch>
            {iceColumns.map((c, i) => (
              <mesh key={i} position={[c.x, c.h / 2, 0.3]}>
                <capsuleGeometry args={[c.w * 0.75, Math.max(0.1, c.h - c.w * 1.5), 4, 10]} />
                <ToonMat color={i % 2 ? PAL.ice : '#e3f7ff'} />
              </mesh>
            ))}
          </StaticBatch>
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
              <ToonMat
                color={i === 0 ? '#bdf1ff' : '#8fe3f7'}
                emissive={i === 0 ? '#bdf1ff' : '#8fe3f7'}
                emissiveIntensity={0.25}
                transparent
                opacity={0.7 - i * 0.2}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          ))}

          {/* faixas de água descendo (instanciadas) */}
          <instancedMesh
            ref={(el) => {
              streaksRef.current = el
              // esfera fixa cobrindo a queda: culling por distância/frustum funciona
              if (el) el.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height / 2, 0.6), height * 0.6 + width)
              if (el && streaks.length) {
                streaks.forEach((s, i) => el.setColorAt(i, STREAK_COLORS[s.shade]))
                if (el.instanceColor) el.instanceColor.needsUpdate = true
              }
            }}
            args={[STREAK_GEO, streakMat, streaks.length]}
          />
        </>
      )}

      {/* lago na base */}
      <RigidBody type="fixed" position={[0, -0.3, width * 0.9]} colliders={false}>
        <CuboidCollider args={[width * 1.3, 0.25, width * 0.9]} />
        <mesh>
          <boxGeometry args={[width * 2.6, 0.45, width * 1.8]} />
          <ToonMat color={frozen ? PAL.ice : PAL.water} />
        </mesh>
      </RigidBody>

      {/* anéis de respingo na superfície do lago */}
      {!frozen && (
        <group ref={splashRef} position={[0, -0.02, 0]}>
          {splashes.map((s, i) => (
            <mesh key={i} position={[s.x, 0, s.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.72, 1, 16]} />
              <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}

      {/* arco-íris na névoa — assinatura do Staubbach */}
      {hero && !frozen && (
        <group position={[width * 0.4, 1.2, width * 1.1]} rotation={[0, 0.5, 0]}>
          {[
            ['#ff6a6a', 4.9],
            ['#ffa23a', 4.6],
            ['#ffd94a', 4.3],
            ['#7ad96a', 4.0],
            ['#5fb8ff', 3.7],
            ['#b48cff', 3.4],
          ].map(([color, radius]) => (
            <mesh key={color}>
              <torusGeometry args={[radius, 0.16, 6, 32, Math.PI]} />
              <meshBasicMaterial color={color} transparent opacity={0.42} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}

      {/* névoa: nuvenzinhas brancas e fofas */}
      <group position={[0, 0.4, 1.4]}>
        <instancedMesh
          ref={(el) => {
            mistRef.current = el
            if (el) el.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, 0), width * 3 + 12)
          }}
          args={[MIST_GEO, frozen ? mistMatFrozen : mistMat, mist.length]}
        />
      </group>
    </group>
  )
}
