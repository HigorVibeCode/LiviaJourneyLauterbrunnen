import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
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
 * Fênix do mirante — low-poly procedural; órbita, pousa e leva a Livia.
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

  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({
        color: '#e85a28',
        flatShading: true,
        emissive: '#c43a12',
        emissiveIntensity: 0.35,
        roughness: 0.55,
      }),
      bodyDark: new THREE.MeshStandardMaterial({
        color: '#b83214',
        flatShading: true,
        emissive: '#8a2008',
        emissiveIntensity: 0.25,
        roughness: 0.6,
      }),
      wing: new THREE.MeshStandardMaterial({
        color: '#ff7a2a',
        flatShading: true,
        emissive: '#ff5510',
        emissiveIntensity: 0.45,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
      wingTip: new THREE.MeshStandardMaterial({
        color: '#ffc040',
        flatShading: true,
        emissive: '#ff9020',
        emissiveIntensity: 0.55,
        roughness: 0.45,
        side: THREE.DoubleSide,
      }),
      crest: new THREE.MeshStandardMaterial({
        color: '#ffb028',
        flatShading: true,
        emissive: '#ff8010',
        emissiveIntensity: 0.5,
        roughness: 0.4,
      }),
      beak: new THREE.MeshStandardMaterial({
        color: '#f0c040',
        flatShading: true,
        roughness: 0.35,
        metalness: 0.15,
      }),
      eye: new THREE.MeshStandardMaterial({
        color: '#1a1008',
        flatShading: true,
        emissive: '#402008',
        emissiveIntensity: 0.2,
      }),
      tail: new THREE.MeshStandardMaterial({
        color: '#ff6a20',
        flatShading: true,
        emissive: '#e04010',
        emissiveIntensity: 0.4,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
      tailTip: new THREE.MeshStandardMaterial({
        color: '#ffd060',
        flatShading: true,
        emissive: '#ff9020',
        emissiveIntensity: 0.6,
        roughness: 0.4,
      }),
      leg: new THREE.MeshStandardMaterial({
        color: '#d49030',
        flatShading: true,
        roughness: 0.5,
      }),
    }),
    [],
  )

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
          {/* torso */}
          <mesh castShadow position={[0, 0.15, 0]} material={mats.body}>
            <capsuleGeometry args={[0.38, 0.85, 3, 6]} />
          </mesh>
          <mesh position={[0, 0.22, 0.15]} scale={[0.9, 0.75, 1.1]} material={mats.bodyDark}>
            <sphereGeometry args={[0.32, 6, 5]} />
          </mesh>

          {/* pescoço + cabeça */}
          <group ref={neckRef} position={[0, 0.35, 0.55]}>
            <mesh castShadow position={[0, 0.15, 0.12]} rotation={[0.6, 0, 0]} material={mats.body}>
              <capsuleGeometry args={[0.14, 0.35, 2, 5]} />
            </mesh>
            <mesh castShadow position={[0, 0.42, 0.32]} material={mats.body}>
              <sphereGeometry args={[0.22, 6, 5]} />
            </mesh>
            {/* crista */}
            {[0, 0.08, -0.08].map((x, i) => (
              <mesh
                key={i}
                castShadow
                position={[x, 0.58 + (i === 0 ? 0.06 : 0), 0.28 - Math.abs(x)]}
                rotation={[0.3, 0, x * 2]}
                material={mats.crest}
              >
                <coneGeometry args={[0.06, 0.28 - Math.abs(x) * 0.4, 4]} />
              </mesh>
            ))}
            {/* bico */}
            <mesh castShadow position={[0, 0.38, 0.52]} rotation={[Math.PI / 2, 0, 0]} material={mats.beak}>
              <coneGeometry args={[0.07, 0.28, 4]} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.14, 0.48, 0.38]} material={mats.eye}>
                <sphereGeometry args={[0.04, 4, 3]} />
              </mesh>
            ))}
          </group>

          {/* asas */}
          <group ref={wingLRef} position={[-0.35, 0.3, 0.05]}>
            <mesh castShadow position={[-0.55, 0, 0]} rotation={[0.1, 0.15, -0.15]} material={mats.wing}>
              <boxGeometry args={[1.2, 0.06, 0.55]} />
            </mesh>
            <group ref={wingLOuterRef} position={[-1.1, 0, 0]}>
              <mesh castShadow position={[-0.45, 0, -0.05]} rotation={[0.05, 0.2, -0.1]} material={mats.wingTip}>
                <boxGeometry args={[0.9, 0.04, 0.4]} />
              </mesh>
              {/* penas tip */}
              {[-0.15, 0, 0.15].map((z, i) => (
                <mesh
                  key={i}
                  position={[-0.85, 0, z]}
                  rotation={[0, 0, -0.3]}
                  material={i === 1 ? mats.crest : mats.wingTip}
                >
                  <coneGeometry args={[0.08, 0.35, 3]} />
                </mesh>
              ))}
            </group>
          </group>

          <group ref={wingRRef} position={[0.35, 0.3, 0.05]}>
            <mesh castShadow position={[0.55, 0, 0]} rotation={[0.1, -0.15, 0.15]} material={mats.wing}>
              <boxGeometry args={[1.2, 0.06, 0.55]} />
            </mesh>
            <group ref={wingROuterRef} position={[1.1, 0, 0]}>
              <mesh castShadow position={[0.45, 0, -0.05]} rotation={[0.05, -0.2, 0.1]} material={mats.wingTip}>
                <boxGeometry args={[0.9, 0.04, 0.4]} />
              </mesh>
              {[0.15, 0, -0.15].map((z, i) => (
                <mesh
                  key={i}
                  position={[0.85, 0, z]}
                  rotation={[0, 0, 0.3]}
                  material={i === 1 ? mats.crest : mats.wingTip}
                >
                  <coneGeometry args={[0.08, 0.35, 3]} />
                </mesh>
              ))}
            </group>
          </group>

          {/* cauda em leque */}
          <group ref={tailRef} position={[0, 0.1, -0.55]}>
            {[-0.35, -0.18, 0, 0.18, 0.35].map((x, i) => (
              <mesh
                key={i}
                castShadow
                position={[x * 0.6, 0.05, -0.55 - Math.abs(x) * 0.15]}
                rotation={[0.5, x * 0.4, x * 0.5]}
                material={Math.abs(i - 2) <= 1 ? mats.tailTip : mats.tail}
              >
                <boxGeometry args={[0.18 - Math.abs(x) * 0.08, 0.04, 1.1 + (2 - Math.abs(i - 2)) * 0.15]} />
              </mesh>
            ))}
          </group>

          {/* patas */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.18, -0.25, 0.1]}>
              <mesh castShadow position={[0, -0.2, 0]} material={mats.leg}>
                <cylinderGeometry args={[0.04, 0.03, 0.4, 4]} />
              </mesh>
              <mesh position={[0, -0.4, 0.06]} material={mats.beak}>
                <boxGeometry args={[0.12, 0.04, 0.16]} />
              </mesh>
            </group>
          ))}

          {/* 1 light max */}
          <pointLight color="#ff9a3c" intensity={3.2} distance={20} decay={2} position={[0, 0.4, 0.2]} />
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

/** Rider low-poly estático — sem mixer, sem sombra, materiais compartilhados. */
function PhoenixRider() {
  const mats = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: '#e8b896', flatShading: true }),
      skinDark: new THREE.MeshStandardMaterial({ color: '#d09474', flatShading: true }),
      hair: new THREE.MeshStandardMaterial({ color: '#3a281c', flatShading: true, side: THREE.DoubleSide }),
      hairDark: new THREE.MeshStandardMaterial({ color: '#241610', flatShading: true }),
      tunic: new THREE.MeshStandardMaterial({ color: '#c44a3a', flatShading: true }),
      tunicDark: new THREE.MeshStandardMaterial({ color: '#8a3028', flatShading: true }),
      skirt: new THREE.MeshStandardMaterial({ color: '#5a2a48', flatShading: true, side: THREE.DoubleSide }),
      pants: new THREE.MeshStandardMaterial({ color: '#3a3048', flatShading: true }),
      boot: new THREE.MeshStandardMaterial({ color: '#4a2c1e', flatShading: true }),
    }),
    [],
  )

  return (
    <group position={[0, 0.15, 0]} rotation={[0.35, 0, 0]}>
      <mesh position={[0, 0.42, 0.02]} material={mats.tunic}>
        <capsuleGeometry args={[0.14, 0.22, 2, 6]} />
      </mesh>
      <mesh position={[0, 0.28, -0.02]} scale={[1.05, 0.7, 1.05]} material={mats.tunicDark}>
        <capsuleGeometry args={[0.13, 0.12, 2, 5]} />
      </mesh>
      <mesh position={[0, 0.18, 0.02]} material={mats.skirt}>
        <coneGeometry args={[0.22, 0.22, 6, 1, true]} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.12, 0.12, 0.05]} rotation={[1.15, 0, side * 0.15]}>
          <mesh position={[0, -0.12, 0]} material={mats.pants}>
            <cylinderGeometry args={[0.07, 0.06, 0.28, 5]} />
          </mesh>
          <mesh position={[0, -0.32, 0.04]} rotation={[-0.9, 0, 0]} material={mats.pants}>
            <cylinderGeometry args={[0.055, 0.048, 0.26, 4]} />
          </mesh>
          <mesh position={[0, -0.42, 0.12]} material={mats.boot}>
            <boxGeometry args={[0.1, 0.08, 0.16]} />
          </mesh>
        </group>
      ))}

      {[-1, 1].map((side) => (
        <group key={`arm-${side}`} position={[side * 0.18, 0.48, 0.05]} rotation={[0.85, 0, side * 0.55]}>
          <mesh position={[0, -0.1, 0]} material={mats.tunic}>
            <cylinderGeometry args={[0.045, 0.04, 0.2, 4]} />
          </mesh>
          <mesh position={[0, -0.24, 0.02]} material={mats.skin}>
            <cylinderGeometry args={[0.038, 0.032, 0.16, 4]} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 0.62, 0.02]} material={mats.skinDark}>
        <cylinderGeometry args={[0.04, 0.05, 0.08, 4]} />
      </mesh>
      <group position={[0, 0.72, 0.02]}>
        <mesh position={[0, 0.1, 0.01]} scale={[0.92, 1.02, 0.95]} material={mats.skin}>
          <sphereGeometry args={[0.12, 7, 6]} />
        </mesh>
        <mesh position={[0, 0.16, -0.04]} scale={[1.05, 0.8, 1.1]} material={mats.hair}>
          <sphereGeometry args={[0.115, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        </mesh>
        <mesh position={[0, 0.05, -0.1]} rotation={[0.3, 0, 0]} material={mats.hairDark}>
          <capsuleGeometry args={[0.08, 0.28, 2, 4]} />
        </mesh>
      </group>
    </group>
  )
}
