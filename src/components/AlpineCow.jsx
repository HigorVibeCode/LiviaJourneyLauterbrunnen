import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeToonMaterial } from '../materials/toonMaterial'
import StaticBatch from './world/StaticBatch'
import { STAIRS, groundHeightAt, stairsPitch } from '../config/world'
import {
  cowChase,
  COW_GATE,
  COW_BOUNDS,
  COW_DRAG_DURATION,
  COW_DRAG_SPEED,
  randomCowPoint,
} from '../lib/cowChase'
import { playerPosition } from '../store/playerStore'
import { useProgressStore } from '../store/progressStore'
import { useGameStore } from '../store/gameStore'
import { sfxMooChase, sfxMooCatch } from '../audio/sfx'

const HUNT_SPEED = 2.15
const WANDER_SPEED = 1.35
const CATCH_DIST = 2.35
const CALM_SECONDS = 8
const MAX_CATCHES = 2
const STAIRS_PITCH = stairsPitch()
const STAIRS_Z_TOP = STAIRS.zStart - (STAIRS.steps - 1) * STAIRS.stepDepth

function settleCowY(x, z) {
  const stairsLen = (STAIRS.steps - 1) * STAIRS.stepDepth
  const t = Math.max(0, Math.min(1, (STAIRS.zStart - z) / stairsLen))
  const stepIndex = Math.min(STAIRS.steps - 1, Math.floor(t * (STAIRS.steps - 1) + 0.001))
  const onStairs = z <= STAIRS.zStart && z >= STAIRS_Z_TOP && Math.abs(x) <= STAIRS.halfWidth + 1
  return onStairs ? (stepIndex + 1) * STAIRS.stepRise : groundHeightAt(x, z)
}

function clampCowXZ(x, z) {
  return {
    x: THREE.MathUtils.clamp(x, -COW_BOUNDS.halfX, COW_BOUNDS.halfX),
    z: THREE.MathUtils.clamp(z, COW_BOUNDS.zFar, COW_BOUNDS.zNear),
  }
}

function pickWanderTarget() {
  const p = randomCowPoint()
  cowChase.wanderX = p.x
  cowChase.wanderZ = p.z
}

const BODY_C = [0, 1.02, 0]
const BODY_AX = [0.62, 0.55, 0.85]
const COW_SPOTS = [
  [1, 0.35, 0.3, 0.26],
  [-1, 0.2, -0.35, 0.28],
  [0.25, 1, -0.2, 0.22],
  [0.9, 0.1, -0.7, 0.18],
  [-0.8, 0.5, 0.55, 0.18],
]

/** manchinha rente à pele: centro afundado no corpo (só a "tampa" aparece) */
function spotPos(dx, dy, dz, r) {
  const len = Math.hypot(dx, dy, dz)
  const n = [dx / len, dy / len, dz / len]
  const k = 1 / Math.sqrt((n[0] / BODY_AX[0]) ** 2 + (n[1] / BODY_AX[1]) ** 2 + (n[2] / BODY_AX[2]) ** 2)
  const d = k - r * 0.8
  return [BODY_C[0] + n[0] * d, BODY_C[1] + n[1] * d, BODY_C[2] + n[2] * d]
}

/**
 * Vaca alpina (fofinha, com coroa de flores): spawna 1× (posição aleatória) ao abrir o portão do mirante.
 * Se a Livia sai da fase, a vaca continua pastando por ali — sem respawn.
 * Na zona do mirante, persegue e arrasta de volta ao portão.
 */
export default function AlpineCow() {
  const root = useRef(null)
  const legL = useRef(null)
  const legR = useRef(null)
  const head = useRef(null)
  const dragTimer = useRef(0)
  const calmUntil = useRef(0)
  const catches = useRef(0)
  const mooCooldown = useRef(0)
  const zigPhase = useRef(0)
  const wanderWait = useRef(0)
  /** true depois de posicionar o mesh nesta montagem do componente */
  const placed = useRef(false)

  useFrame((state, delta) => {
    const rootG = root.current
    if (!rootG) return

    const dt = Math.min(delta, 0.05)
    const paused = useGameStore.getState().paused
    const { unlockedGates, finalePhase, finished } = useProgressStore.getState()
    const gateOpen = unlockedGates.includes('gate_summit')

    if (!gateOpen) {
      rootG.visible = false
      cowChase.hunting = false
      cowChase.dragging = false
      return
    }

    // spawn único na sessão — posição aleatória além do portão
    if (!cowChase.spawned) {
      const p = randomCowPoint()
      const { x, z } = clampCowXZ(p.x, p.z)
      rootG.position.set(x, settleCowY(x, z), z)
      rootG.rotation.y = Math.random() * Math.PI * 2
      cowChase.spawned = true
      cowChase.x = x
      cowChase.y = rootG.position.y
      cowChase.z = z
      cowChase.yaw = rootG.rotation.y
      pickWanderTarget()
      mooCooldown.current = 0.8 + Math.random() * 1.2
      wanderWait.current = 0
      placed.current = true
    } else if (!placed.current) {
      // remount React / HMR: mantém onde ela estava (não respawna)
      rootG.position.set(cowChase.x, settleCowY(cowChase.x, cowChase.z), cowChase.z)
      rootG.rotation.y = cowChase.yaw
      placed.current = true
    }

    rootG.visible = true

    // só caça na escadaria — o prado florido fica seguro/reconfortante
    const playerInSummit =
      !finished &&
      !finalePhase &&
      playerPosition.z < STAIRS.zStart - 2 &&
      playerPosition.z > COW_BOUNDS.zFar - 40

    // depois de um arrasto a vaca fica um tempo distraída; após 2 arrastos
    // desiste de vez (antes podia arrastar a Livia a escada inteira, sem fim)
    const calm = state.clock.elapsedTime < calmUntil.current || catches.current >= MAX_CATCHES
    cowChase.hunting = playerInSummit && !paused && !calm

    // saiu da fase no meio do arrasto: solta a Livia, vaca volta a pastar
    if (!playerInSummit && cowChase.dragging) {
      cowChase.dragging = false
      cowChase.dragProgress = 0
      dragTimer.current = 0
      pickWanderTarget()
    }

    if (paused || finished || finalePhase) {
      // congela no lugar, mas permanece no mundo
      cowChase.x = rootG.position.x
      cowChase.y = rootG.position.y
      cowChase.z = rootG.position.z
      cowChase.yaw = rootG.rotation.y
      return
    }

    mooCooldown.current = Math.max(0, mooCooldown.current - dt)
    const tClock = state.clock.elapsedTime

    if (cowChase.dragging) {
      dragTimer.current += dt
      cowChase.dragProgress = Math.min(1, dragTimer.current / COW_DRAG_DURATION)

      const tx = COW_GATE.x + 2.2
      const tz = COW_GATE.z + 1.5
      const dx = tx - rootG.position.x
      const dz = tz - rootG.position.z
      const distGate = Math.hypot(dx, dz)

      zigPhase.current += dt * 4.2
      const zig = Math.sin(zigPhase.current) * 1.8
      const len = Math.max(0.001, distGate)
      const px = -dz / len
      const pz = dx / len

      if (distGate > 1.2) {
        const nx = dx / len
        const nz = dz / len
        const pace =
          cowChase.dragProgress < 0.15 ? 0.55 : cowChase.dragProgress > 0.85 ? 0.65 : 1
        rootG.position.x += (nx * COW_DRAG_SPEED * pace + px * zig * 2.2) * dt
        rootG.position.z += (nz * COW_DRAG_SPEED * pace + pz * zig * 2.2) * dt
        const clamped = clampCowXZ(rootG.position.x, rootG.position.z)
        // no arrasto pode ir um pouco além do zNear (até o portão)
        rootG.position.x = clamped.x
        rootG.position.z = Math.min(STAIRS.zStart + 2, rootG.position.z)
        rootG.rotation.y = Math.atan2(nx + px * zig * 0.15, nz + pz * zig * 0.15)
      }

      const behind = 1.85 + Math.sin(tClock * 9) * 0.15
      const sideWobble = Math.sin(tClock * 7.5) * 0.55
      const yaw = rootG.rotation.y
      const backX = rootG.position.x - Math.sin(yaw) * behind + Math.cos(yaw) * sideWobble
      const backZ = rootG.position.z - Math.cos(yaw) * behind - Math.sin(yaw) * sideWobble
      const bob = Math.abs(Math.sin(tClock * 11)) * 0.55 + Math.sin(tClock * 17) * 0.08

      cowChase.victimX = backX
      cowChase.victimZ = backZ
      cowChase.victimY = settleCowY(backX, backZ) + bob
      cowChase.victimYaw = yaw + Math.PI + Math.sin(tClock * 6) * 0.7
      cowChase.victimBob = bob
      cowChase.victimRoll = Math.sin(tClock * 8.5) * 0.55
      cowChase.victimPitch = 0.35 + Math.sin(tClock * 10) * 0.25

      if (mooCooldown.current <= 0) {
        sfxMooChase()
        mooCooldown.current = 1.1 + Math.random() * 0.7
      }

      if (dragTimer.current >= COW_DRAG_DURATION || distGate < 1.4) {
        calmUntil.current = state.clock.elapsedTime + CALM_SECONDS
        catches.current += 1
        cowChase.dragging = false
        cowChase.dragProgress = 0
        dragTimer.current = 0
        pickWanderTarget()
      }
    } else if (playerInSummit && cowChase.hunting) {
      // persegue a Livia
      const dx = playerPosition.x - rootG.position.x
      const dz = playerPosition.z - rootG.position.z
      const dist = Math.hypot(dx, dz)

      if (dist > 0.4) {
        const nx = dx / dist
        const nz = dz / dist
        rootG.position.x += nx * HUNT_SPEED * dt
        rootG.position.z += nz * HUNT_SPEED * dt
        const c = clampCowXZ(rootG.position.x, rootG.position.z)
        rootG.position.x = c.x
        rootG.position.z = c.z
        rootG.rotation.y = Math.atan2(nx, nz)
      }

      if (mooCooldown.current <= 0) {
        sfxMooChase()
        mooCooldown.current = 2.5 + Math.random() * 1.5
      }

      if (dist < CATCH_DIST) {
        cowChase.dragging = true
        cowChase.dragProgress = 0
        dragTimer.current = 0
        zigPhase.current = 0
        sfxMooCatch()
        mooCooldown.current = 1.4
        const yaw = rootG.rotation.y
        cowChase.victimX = rootG.position.x - Math.sin(yaw) * 1.7
        cowChase.victimZ = rootG.position.z - Math.cos(yaw) * 1.7
        cowChase.victimY = settleCowY(cowChase.victimX, cowChase.victimZ)
        cowChase.victimYaw = yaw + Math.PI
        cowChase.victimBob = 0
        cowChase.victimRoll = 0
        cowChase.victimPitch = 0.4
      }
    } else {
      // fora da fase: passeia aleatoriamente na área do mirante
      wanderWait.current -= dt
      let dx = cowChase.wanderX - rootG.position.x
      let dz = cowChase.wanderZ - rootG.position.z
      let dist = Math.hypot(dx, dz)

      if (dist < 1.2 || wanderWait.current <= 0) {
        pickWanderTarget()
        wanderWait.current = 4 + Math.random() * 6
        dx = cowChase.wanderX - rootG.position.x
        dz = cowChase.wanderZ - rootG.position.z
        dist = Math.hypot(dx, dz)
      }

      if (dist > 0.35) {
        const nx = dx / dist
        const nz = dz / dist
        rootG.position.x += nx * WANDER_SPEED * dt
        rootG.position.z += nz * WANDER_SPEED * dt
        const c = clampCowXZ(rootG.position.x, rootG.position.z)
        rootG.position.x = c.x
        rootG.position.z = c.z
        rootG.rotation.y = Math.atan2(nx, nz)
      }

      if (mooCooldown.current <= 0) {
        sfxMooChase()
        mooCooldown.current = 5 + Math.random() * 4
      }
    }

    const px = rootG.position.x
    const pz = rootG.position.z
    rootG.position.y = settleCowY(px, pz)
    const onStairs = pz <= STAIRS.zStart && pz >= STAIRS_Z_TOP && Math.abs(px) <= STAIRS.halfWidth + 1
    if (onStairs) {
      const facingUp = Math.cos(rootG.rotation.y) < 0
      const targetPitch = (facingUp ? -STAIRS_PITCH : STAIRS_PITCH) * 1.35
      rootG.rotation.x = THREE.MathUtils.lerp(rootG.rotation.x, targetPitch, Math.min(1, dt * 6))
    } else {
      rootG.rotation.x = THREE.MathUtils.lerp(rootG.rotation.x, 0, Math.min(1, dt * 6))
    }

    cowChase.x = rootG.position.x
    cowChase.y = rootG.position.y
    cowChase.z = rootG.position.z
    cowChase.yaw = rootG.rotation.y

    const moving = cowChase.dragging || cowChase.hunting || wanderWait.current > 0
    const gait = tClock * (cowChase.dragging ? 7.2 : cowChase.hunting ? 3.2 : 2.4)
    const amp = cowChase.dragging ? 0.85 : cowChase.hunting ? 0.55 : 0.35
    if (legL.current) legL.current.rotation.x = moving ? Math.sin(gait) * amp : Math.sin(tClock * 1.2) * 0.06
    if (legR.current) legR.current.rotation.x = moving ? -Math.sin(gait) * amp : -Math.sin(tClock * 1.2) * 0.06
    if (head.current) {
      head.current.rotation.x = cowChase.dragging
        ? 0.45 + Math.sin(tClock * 5) * 0.12
        : 0.1 + Math.sin(gait * 0.5) * 0.08
    }
  })

  const mats = useMemo(
    () => ({
      white: makeToonMaterial({ color: '#fffdf8' }),
      spot: makeToonMaterial({ color: '#e6b07c' }),
      muzzle: makeToonMaterial({ color: '#ffc4d2' }),
      nostril: makeToonMaterial({ color: '#f08aa4' }),
      inner: makeToonMaterial({ color: '#ffb3c6' }),
      eye: makeToonMaterial({ color: '#4a3a5e' }),
      shine: makeToonMaterial({ color: '#ffffff' }),
      cheek: makeToonMaterial({ color: '#ffb0c4' }),
      horn: makeToonMaterial({ color: '#fff0c8' }),
      hoof: makeToonMaterial({ color: '#e6b07c' }),
      collar: makeToonMaterial({ color: '#ff6b6b' }),
      bell: makeToonMaterial({ color: '#ffd23f' }),
      flowerA: makeToonMaterial({ color: '#ff8fb8' }),
      flowerB: makeToonMaterial({ color: '#ffffff' }),
      flowerC: makeToonMaterial({ color: '#b48cff' }),
      leaf: makeToonMaterial({ color: '#6cc85a' }),
    }),
    [],
  )
  const shadowGeo = useMemo(() => new THREE.CircleGeometry(1, 20), [])
  const flowers = [mats.flowerA, mats.flowerB, mats.flowerC]

  return (
    <group ref={root} visible={false}>
      {/* sombra macia */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[0.8, 1.15, 1]} geometry={shadowGeo}>
        <meshBasicMaterial color="#3b5a3a" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* corpão redondo com manchinhas caramelo */}
      <StaticBatch>
        <mesh position={BODY_C} scale={BODY_AX} material={mats.white}>
          <sphereGeometry args={[1, 20, 14]} />
        </mesh>
        {COW_SPOTS.map(([dx, dy, dz, r], i) => (
          <mesh key={i} position={spotPos(dx, dy, dz, r)} material={mats.spot}>
            <sphereGeometry args={[r, 14, 10]} />
          </mesh>
        ))}
        {/* patas traseiras (paradas) */}
        {[-1, 1].map((sd) => (
          <group key={`b${sd}`} position={[sd * 0.3, 0.55, -0.42]}>
            <mesh position={[0, -0.26, 0]} material={mats.white}>
              <capsuleGeometry args={[0.17, 0.2, 6, 12]} />
            </mesh>
            <mesh position={[0, -0.47, 0.01]} material={mats.hoof}>
              <cylinderGeometry args={[0.16, 0.17, 0.1, 14]} />
            </mesh>
          </group>
        ))}
        {/* rabinho com pompom */}
        <mesh position={[0, 1.0, -0.88]} rotation={[0.3, 0, 0]} material={mats.white}>
          <capsuleGeometry args={[0.04, 0.4, 4, 8]} />
        </mesh>
        <mesh position={[0, 0.74, -0.95]} material={mats.spot}>
          <sphereGeometry args={[0.08, 10, 8]} />
        </mesh>
      </StaticBatch>

      <group ref={head} position={[0, 1.45, 0.85]}>
        <StaticBatch>
          <mesh position={[0, 0.1, 0.15]} material={mats.white}>
            <sphereGeometry args={[0.5, 20, 16]} />
          </mesh>
          {/* focinho rosado */}
          <mesh position={[0, -0.1, 0.58]} scale={[1.3, 0.85, 0.85]} material={mats.muzzle}>
            <sphereGeometry args={[0.24, 16, 12]} />
          </mesh>
          {[-1, 1].map((sd) => (
            <mesh key={`n${sd}`} position={[sd * 0.1, -0.06, 0.78]} scale={[1, 1.2, 0.5]} material={mats.nostril}>
              <sphereGeometry args={[0.04, 8, 6]} />
            </mesh>
          ))}
          {/* olhinhos com brilho */}
          {[-1, 1].map((sd) => (
            <group key={`e${sd}`} position={[sd * 0.2, 0.2, 0.6]} rotation={[0, sd * 0.3, 0]}>
              <mesh scale={[0.85, 1.15, 0.5]} material={mats.eye}>
                <sphereGeometry args={[0.075, 12, 10]} />
              </mesh>
              <mesh position={[0.022, 0.035, 0.03]} material={mats.shine}>
                <sphereGeometry args={[0.028, 8, 6]} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((sd) => (
            <mesh key={`k${sd}`} position={[sd * 0.33, 0.0, 0.5]} rotation={[0, sd * 0.6, 0]} scale={[1, 0.65, 0.4]} material={mats.cheek}>
              <sphereGeometry args={[0.08, 10, 8]} />
            </mesh>
          ))}
          {/* orelhas caídas + chifrinhos */}
          {[-1, 1].map((sd) => (
            <group key={`o${sd}`} position={[sd * 0.5, 0.18, 0.1]} rotation={[0, 0, sd * -0.45]}>
              <mesh scale={[1.6, 0.7, 0.55]} material={mats.white}>
                <sphereGeometry args={[0.14, 12, 10]} />
              </mesh>
              <mesh position={[sd * 0.01, 0, 0.05]} scale={[1.1, 0.45, 0.3]} material={mats.inner}>
                <sphereGeometry args={[0.14, 10, 8]} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((sd) => (
            <mesh key={`h${sd}`} position={[sd * 0.3, 0.52, 0.08]} rotation={[0, 0, sd * -0.6]} material={mats.horn}>
              <capsuleGeometry args={[0.06, 0.12, 4, 10]} />
            </mesh>
          ))}
          {/* coroa de florzinhas */}
          {[-0.27, -0.09, 0.09, 0.27].map((x, i) => {
            const z = 0.3 - Math.abs(x) * 0.5
            const y = 0.1 + Math.sqrt(Math.max(0, 0.25 - x * x - (z - 0.15) ** 2))
            return (
              <group key={`f${i}`} position={[x, y, z]} rotation={[-0.5, 0, -x * 1.5]}>
                <mesh scale={[1, 0.6, 1]} material={flowers[i % 3]}>
                  <sphereGeometry args={[0.09, 12, 8]} />
                </mesh>
                <mesh position={[0, 0.045, 0]} material={mats.bell}>
                  <sphereGeometry args={[0.035, 8, 6]} />
                </mesh>
              </group>
            )
          })}
          {/* coleira com sininho */}
          <mesh position={[0, -0.32, 0.05]} rotation={[Math.PI / 2 - 0.35, 0, 0]} material={mats.collar}>
            <torusGeometry args={[0.3, 0.05, 8, 22]} />
          </mesh>
          <mesh position={[0, -0.5, 0.28]} material={mats.bell}>
            <sphereGeometry args={[0.11, 12, 10]} />
          </mesh>
        </StaticBatch>
      </group>

      {/* patas dianteiras (animadas) */}
      {[
        [legL, -1],
        [legR, 1],
      ].map(([ref, sd]) => (
        <group key={sd} ref={ref} position={[sd * 0.3, 0.55, 0.4]}>
          <mesh position={[0, -0.26, 0]} material={mats.white}>
            <capsuleGeometry args={[0.17, 0.2, 6, 12]} />
          </mesh>
          <mesh position={[0, -0.47, 0.01]} material={mats.hoof}>
            <cylinderGeometry args={[0.16, 0.17, 0.1, 14]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
