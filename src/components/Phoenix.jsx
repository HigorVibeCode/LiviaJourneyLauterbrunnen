import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeToonMaterial } from '../materials/toonMaterial'
import StaticBatch from './world/StaticBatch'
import { PHOENIX_PIVOT, SUMMIT_Y } from '../config/world'
import { phoenixRide } from '../lib/phoenixRide'
import { playerPosition } from '../store/playerStore'
import { useProgressStore } from '../store/progressStore'

const ORBIT_RX = 14
const ORBIT_RZ = 12
const ORBIT_SPEED = 0.26
const FLAP_SPEED = 3.1
const PIVOT = [PHOENIX_PIVOT.x, PHOENIX_PIVOT.y, PHOENIX_PIVOT.z]
const BIRD_SCALE = 2.35

const tmpWorld = new THREE.Vector3()
const tmpLand = new THREE.Vector3()
const tmpFrom = new THREE.Vector3()

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/**
 * Fênix do mirante — passarinho mágico fofo (procedural): corpo redondo,
 * olhões, crista de chamas e cauda longa. Órbita, pousa e leva a Livia.
 */
export default function Phoenix() {
  const rootRef = useRef(null)
  const birdRef = useRef(null)
  const riderRef = useRef(null)
  const dustRef = useRef(null)
  const wingLRef = useRef(null)
  const wingRRef = useRef(null)
  const wingLOuterRef = useRef(null)
  const wingROuterRef = useRef(null)
  const tailRef = useRef(null)
  const neckRef = useRef(null)
  const approachFrom = useRef(null)
  const lastOrbitWorld = useRef(new THREE.Vector3(PIVOT[0] + ORBIT_RX, PIVOT[1], PIVOT[2]))
  const prevPhase = useRef(null)

  const mats = useMemo(() => {
    const glow = (color, emissive, emissiveIntensity) =>
      makeToonMaterial({ color, emissive, emissiveIntensity })
    return {
      body: glow('#ff9a4a', '#ff7a2a', 0.3),
      head: glow('#ffa860', '#ff8040', 0.28),
      belly: glow('#ffe07a', '#ffc040', 0.3),
      wing: glow('#ff7a5a', '#ff5a3a', 0.3),
      wingTip: glow('#ffc94a', '#ffa020', 0.4),
      pink: glow('#ff8fc0', '#ff5a9a', 0.4),
      gold: glow('#ffe58a', '#ffc840', 0.55),
      beak: makeToonMaterial({ color: '#ffd23f' }),
      eye: makeToonMaterial({ color: '#4a2a5e' }),
      white: makeToonMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3 }),
      cheek: makeToonMaterial({ color: '#ff8fb0', emissive: '#ff6a9a', emissiveIntensity: 0.25 }),
    }
  }, [])

  useFrame((state) => {
    const root = rootRef.current
    const bird = birdRef.current
    if (!root || !bird) return

    const finalePhase = useProgressStore.getState().finalePhase
    const inFinale = Boolean(finalePhase && finalePhase !== 'done')
    const active = inFinale || playerPosition.z < -180
    root.visible = active
    if (!active) {
      prevPhase.current = null
      approachFrom.current = null
      return
    }

    const t = state.clock.elapsedTime
    const ridePhase = phoenixRide.phase
    const u = phoenixRide.progress

    if (!inFinale || ridePhase === 'pickup' || !ridePhase) {
      root.position.set(PIVOT[0], PIVOT[1], PIVOT[2])
      const angle = t * ORBIT_SPEED
      const x = Math.cos(angle) * ORBIT_RX
      const z = Math.sin(angle) * ORBIT_RZ
      bird.position.set(x, Math.sin(t * 0.7) * 1.35, z)
      bird.updateWorldMatrix(true, false)
      bird.getWorldPosition(lastOrbitWorld.current)

      const vx = -Math.sin(angle) * ORBIT_RX
      const vz = Math.cos(angle) * ORBIT_RZ
      let yaw = Math.atan2(vx, vz) + Math.PI
      if (ridePhase === 'pickup' && u > 0.55) {
        const toLand = Math.atan2(
          phoenixRide.landX - lastOrbitWorld.current.x,
          phoenixRide.landZ - lastOrbitWorld.current.z,
        )
        yaw = THREE.MathUtils.lerp(yaw, toLand, (u - 0.55) / 0.45)
      }
      bird.rotation.y = yaw
      bird.rotation.z = 0.14 + Math.sin(t * 0.7) * 0.04
      bird.rotation.x = 0.1

      if (dustRef.current) dustRef.current.visible = false
    } else if (ridePhase === 'mount') {
      if (prevPhase.current !== 'mount' || !approachFrom.current) {
        approachFrom.current = lastOrbitWorld.current.clone()
      }
      root.position.set(0, 0, 0)

      tmpFrom.copy(approachFrom.current)
      tmpLand.set(phoenixRide.landX, phoenixRide.landY, phoenixRide.landZ)

      const approachU = easeInOut(Math.min(1, u / 0.7))
      const settle = u < 0.7 ? 0 : easeInOut((u - 0.7) / 0.3)

      tmpWorld.lerpVectors(tmpFrom, tmpLand, approachU)
      const arc = Math.sin(approachU * Math.PI) * 6.5 * (1 - approachU * 0.35)
      tmpWorld.y = THREE.MathUtils.lerp(tmpFrom.y, tmpLand.y, approachU) + arc * (1 - settle)

      bird.position.copy(tmpWorld)

      const dx = tmpLand.x - tmpWorld.x
      const dz = tmpLand.z - tmpWorld.z
      const targetYaw = Math.hypot(dx, dz) > 0.3 ? Math.atan2(dx, dz) : phoenixRide.yaw
      bird.rotation.y = THREE.MathUtils.lerp(bird.rotation.y, targetYaw, 0.08)
      const pitch = THREE.MathUtils.lerp(0.15, -0.08, approachU) + settle * 0.12
      bird.rotation.x = pitch
      bird.rotation.z = THREE.MathUtils.lerp(0.12, 0.02, approachU)

      phoenixRide.x = tmpWorld.x
      phoenixRide.y = tmpWorld.y
      phoenixRide.z = tmpWorld.z
      phoenixRide.yaw = bird.rotation.y

      if (dustRef.current) {
        const showDust = u > 0.65
        dustRef.current.visible = showDust
        if (showDust) {
          const s = 0.6 + settle * 1.8
          dustRef.current.scale.set(s, 0.35 + settle * 0.4, s)
          dustRef.current.material.opacity = (1 - settle * 0.7) * 0.45
          dustRef.current.position.set(tmpLand.x, SUMMIT_Y + 0.15, tmpLand.z)
        }
      }
    } else if (ridePhase === 'fly') {
      root.position.set(0, 0, 0)
      bird.position.set(phoenixRide.x, phoenixRide.y, phoenixRide.z)
      bird.rotation.set(-0.28 - u * 0.1, phoenixRide.yaw, 0.06)
      if (dustRef.current) dustRef.current.visible = false
      approachFrom.current = null
    }

    prevPhase.current = ridePhase

    if (riderRef.current) {
      const showRider = Boolean(phoenixRide.hidePlayer && inFinale)
      riderRef.current.visible = showRider
      if (showRider) {
        riderRef.current.position.set(0, 0.55, 0.15)
        riderRef.current.rotation.x = ridePhase === 'fly' ? 0.22 : 0.42
      }
    }

    let flapBoost = 1
    let ampScale = 1
    if (ridePhase === 'mount') {
      flapBoost = u < 0.7 ? 1.15 : 0.45
      ampScale = u < 0.7 ? 1 : THREE.MathUtils.lerp(1, 0.25, (u - 0.7) / 0.3)
    } else if (ridePhase === 'fly') {
      flapBoost = 1.4
      ampScale = 1.1
    }

    const flap = Math.sin(t * FLAP_SPEED * flapBoost) * ampScale
    const flapOuter = Math.sin(t * FLAP_SPEED * flapBoost - 0.55) * ampScale

    if (wingLRef.current) wingLRef.current.rotation.z = 0.25 + flap * 0.55
    if (wingRRef.current) wingRRef.current.rotation.z = -0.25 - flap * 0.55
    if (wingLOuterRef.current) wingLOuterRef.current.rotation.z = flapOuter * 0.35
    if (wingROuterRef.current) wingROuterRef.current.rotation.z = -flapOuter * 0.35
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(t * 1.6) * 0.12 * ampScale
      tailRef.current.rotation.x = 0.35 + Math.sin(t * 1.2) * 0.06 * ampScale
    }
    if (neckRef.current) {
      neckRef.current.rotation.x = -0.15 + Math.sin(t * 0.9) * 0.08
    }
  })

  return (
    <group ref={rootRef} position={PIVOT}>
      <group ref={birdRef}>
        <group scale={BIRD_SCALE}>
          {/* corpo redondo + barriguinha dourada */}
          <StaticBatch noNearFade>
            <mesh scale={[0.95, 0.85, 1.15]} material={mats.body}>
              <sphereGeometry args={[0.34, 20, 14]} />
            </mesh>
            <mesh position={[0, -0.07, 0.1]} scale={[0.82, 0.72, 1.0]} material={mats.belly}>
              <sphereGeometry args={[0.3, 16, 12]} />
            </mesh>
            {/* pezinhos recolhidos */}
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.1, -0.27, -0.02]} rotation={[0.9, 0, 0]} material={mats.beak}>
                <capsuleGeometry args={[0.04, 0.08, 4, 8]} />
              </mesh>
            ))}
          </StaticBatch>

          {/* cabeça */}
          <group ref={neckRef} position={[0, 0.16, 0.3]}>
            <StaticBatch noNearFade>
              <mesh position={[0, 0.14, 0.1]} material={mats.head}>
                <sphereGeometry args={[0.25, 18, 14]} />
              </mesh>
              {/* olhões com brilho */}
              {[-1, 1].map((side) => (
                <group key={`e${side}`} position={[side * 0.11, 0.18, 0.31]} rotation={[0, side * 0.3, 0]}>
                  <mesh scale={[0.85, 1.15, 0.5]} material={mats.eye}>
                    <sphereGeometry args={[0.06, 12, 10]} />
                  </mesh>
                  <mesh position={[0.018, 0.03, 0.025]} material={mats.white}>
                    <sphereGeometry args={[0.022, 8, 6]} />
                  </mesh>
                </group>
              ))}
              {[-1, 1].map((side) => (
                <mesh
                  key={`c${side}`}
                  position={[side * 0.17, 0.09, 0.27]}
                  rotation={[0, side * 0.6, 0]}
                  scale={[1, 0.65, 0.4]}
                  material={mats.cheek}
                >
                  <sphereGeometry args={[0.05, 8, 6]} />
                </mesh>
              ))}
              {/* biquinho */}
              <mesh position={[0, 0.1, 0.36]} rotation={[Math.PI / 2 + 0.25, 0, 0]} scale={[1.2, 1, 0.8]} material={mats.beak}>
                <coneGeometry args={[0.05, 0.11, 10]} />
              </mesh>
              {/* crista de chamas */}
              {[
                [0, 0.38, 0.06, -0.35, 0.07, 0.16, mats.gold],
                [-0.07, 0.34, 0.0, -0.6, 0.055, 0.13, mats.pink],
                [0.07, 0.34, 0.0, -0.6, 0.055, 0.13, mats.pink],
                [0, 0.3, -0.08, -1.0, 0.05, 0.12, mats.wingTip],
              ].map(([x, y, z, rx, r, l, m], i) => (
                <mesh key={`f${i}`} position={[x, y, z]} rotation={[rx, 0, x * 3]} material={m}>
                  <capsuleGeometry args={[r, l, 4, 10]} />
                </mesh>
              ))}
            </StaticBatch>
          </group>

          {/* asas */}
          {[
            [wingLRef, wingLOuterRef, -1],
            [wingRRef, wingROuterRef, 1],
          ].map(([inner, outer, side]) => (
            <group key={side} ref={inner} position={[side * 0.26, 0.08, 0.02]}>
              <StaticBatch noNearFade>
                <mesh position={[side * 0.36, 0, 0]} scale={[1, 0.13, 0.55]} material={mats.wing}>
                  <sphereGeometry args={[0.42, 16, 10]} />
                </mesh>
              </StaticBatch>
              <group ref={outer} position={[side * 0.72, 0, -0.02]}>
                <StaticBatch noNearFade>
                  <mesh position={[side * 0.3, 0, -0.04]} scale={[1, 0.12, 0.5]} material={mats.wingTip}>
                    <sphereGeometry args={[0.38, 16, 10]} />
                  </mesh>
                  {/* penas da ponta, arredondadas */}
                  {[-0.14, 0, 0.14].map((z, i) => (
                    <mesh
                      key={i}
                      position={[side * 0.62, 0, z - 0.06]}
                      rotation={[0, side * (0.3 - i * 0.3), Math.PI / 2]}
                      scale={[1, 1, 0.45]}
                      material={i === 1 ? mats.pink : mats.gold}
                    >
                      <capsuleGeometry args={[0.07, 0.18, 4, 10]} />
                    </mesh>
                  ))}
                </StaticBatch>
              </group>
            </group>
          ))}

          {/* cauda longa e esvoaçante */}
          <group ref={tailRef} position={[0, 0.02, -0.34]}>
            <StaticBatch noNearFade>
              {[-1, 0, 1].map((k) => {
                const len = k === 0 ? 0.95 : 0.75
                return (
                  <group key={k} rotation={[0.25, k * 0.38, 0]}>
                    <mesh position={[0, 0, -len / 2]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.45]} material={mats.wing}>
                      <capsuleGeometry args={[0.07, len, 4, 10]} />
                    </mesh>
                    <mesh position={[0, 0, -len - 0.05]} scale={[1, 0.45, 1.5]} material={k === 0 ? mats.pink : mats.wingTip}>
                      <sphereGeometry args={[0.13, 14, 10]} />
                    </mesh>
                    <mesh position={[0, 0.01, -len - 0.08]} scale={[1, 0.45, 1.3]} material={mats.gold}>
                      <sphereGeometry args={[0.06, 10, 8]} />
                    </mesh>
                  </group>
                )
              })}
            </StaticBatch>
          </group>

          {/* 1 luz no máximo */}
          <pooledLight color="#ffb05a" intensity={3.2} distance={20} decay={2} position={[0, 0.4, 0.2]} />
        </group>

        <group ref={riderRef} visible={false} scale={0.78}>
          <PhoenixRider />
        </group>
      </group>

      <mesh ref={dustRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 2.8, 24]} />
        <meshBasicMaterial
          color="#ffe0a0"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

/**
 * Livia em miniatura montada na fênix (mesma paleta do modelo dela):
 * estático, sem mixer, materiais compartilhados.
 */
function PhoenixRider() {
  const mats = useMemo(
    () => ({
      skin: makeToonMaterial({ color: '#ffd9bf' }),
      cheek: makeToonMaterial({ color: '#ff9eb0' }),
      hair: makeToonMaterial({ color: '#8a5236' }),
      dress: makeToonMaterial({ color: '#5fb0ff' }),
      dressLight: makeToonMaterial({ color: '#8ccaff' }),
      collar: makeToonMaterial({ color: '#ffffff' }),
      boot: makeToonMaterial({ color: '#ff6f7d' }),
      ribbon: makeToonMaterial({ color: '#ff6f9a' }),
      eye: makeToonMaterial({ color: '#4a3040' }),
    }),
    [],
  )

  return (
    <StaticBatch noNearFade position={[0, 0.15, 0]} rotation={[0.35, 0, 0]}>
      {/* vestidinho */}
      <mesh position={[0, 0.36, 0.02]} material={mats.dress}>
        <capsuleGeometry args={[0.15, 0.16, 6, 12]} />
      </mesh>
      <mesh position={[0, 0.2, 0.02]} material={mats.dressLight}>
        <cylinderGeometry args={[0.15, 0.24, 0.16, 14]} />
      </mesh>
      <mesh position={[0, 0.5, 0.02]} rotation={[Math.PI / 2, 0, 0]} material={mats.collar}>
        <torusGeometry args={[0.1, 0.035, 6, 14]} />
      </mesh>

      {/* perninhas abertas sobre o dorso */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.13, 0.14, 0.05]} rotation={[1.15, 0, side * 0.35]}>
          <mesh position={[0, -0.12, 0]} material={mats.collar}>
            <capsuleGeometry args={[0.06, 0.16, 4, 8]} />
          </mesh>
          <mesh position={[0, -0.28, 0.03]} scale={[1, 0.9, 1.3]} material={mats.boot}>
            <sphereGeometry args={[0.08, 10, 8]} />
          </mesh>
        </group>
      ))}

      {/* bracinhos para frente, segurando o pescoço */}
      {[-1, 1].map((side) => (
        <group key={`arm-${side}`} position={[side * 0.17, 0.46, 0.05]} rotation={[0.95, 0, side * 0.45]}>
          <mesh position={[0, -0.1, 0]} material={mats.dress}>
            <capsuleGeometry args={[0.05, 0.12, 4, 8]} />
          </mesh>
          <mesh position={[0, -0.22, 0]} material={mats.skin}>
            <sphereGeometry args={[0.055, 8, 6]} />
          </mesh>
        </group>
      ))}

      {/* cabeção chibi */}
      <group position={[0, 0.74, 0.02]}>
        <mesh material={mats.skin}>
          <sphereGeometry args={[0.2, 16, 12]} />
        </mesh>
        <mesh position={[0, 0.06, -0.04]} scale={[1.07, 0.95, 1.05]} material={mats.hair}>
          <sphereGeometry args={[0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        </mesh>
        <mesh position={[0, -0.04, -0.12]} scale={[1.05, 1.1, 0.8]} material={mats.hair}>
          <sphereGeometry args={[0.18, 12, 10]} />
        </mesh>
        {/* rabo de cavalo + laço */}
        <mesh position={[0, 0.02, -0.26]} rotation={[0.5, 0, 0]} material={mats.hair}>
          <capsuleGeometry args={[0.07, 0.18, 4, 8]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={`r${side}`} position={[side * 0.06, 0.12, -0.2]} scale={[1, 0.7, 0.6]} material={mats.ribbon}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={`e${side}`} position={[side * 0.07, 0.0, 0.18]} scale={[0.8, 1.1, 0.5]} material={mats.eye}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={`k${side}`} position={[side * 0.12, -0.06, 0.15]} scale={[1, 0.6, 0.4]} material={mats.cheek}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </mesh>
        ))}
      </group>
    </StaticBatch>
  )
}
