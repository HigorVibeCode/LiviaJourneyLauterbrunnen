import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeToonMaterial } from '../materials/toonMaterial'
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

/**
 * Vaca alpina: spawna 1× (posição aleatória) ao abrir o portão do mirante.
 * Se a Livia sai da fase, a vaca continua pastando por ali — sem respawn.
 * Na zona do mirante, persegue e arrasta de volta ao portão.
 */
export default function AlpineCow() {
  const root = useRef(null)
  const legL = useRef(null)
  const legR = useRef(null)
  const head = useRef(null)
  const dragTimer = useRef(0)
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

    cowChase.hunting = playerInSummit && !paused

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
        cowChase.dragging = false
        cowChase.dragProgress = 0
        dragTimer.current = 0
        pickWanderTarget()
      }
    } else if (playerInSummit) {
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

  const s = 1.35
  const mats = useMemo(
    () => ({
      white: makeToonMaterial({ color: '#f0ebe2',}),
      black: makeToonMaterial({ color: '#2c2824',}),
      muzzle: makeToonMaterial({ color: '#3a342e',}),
      eye: makeToonMaterial({ color: '#1a1410',}),
      horn: makeToonMaterial({ color: '#e8dcc4',}),
      bell: makeToonMaterial({
        color: '#d4a020',}),
    }),
    [],
  )

  return (
    <group ref={root} visible={false}>
      <mesh castShadow position={[0, 1.15, 0]} material={mats.white}>
        <capsuleGeometry args={[0.55 * s, 0.95 * s, 3, 6]} />
      </mesh>
      <mesh position={[0.35, 1.25, 0.2]} material={mats.black}>
        <sphereGeometry args={[0.35 * s, 5, 4]} />
      </mesh>
      <mesh position={[-0.4, 1.1, -0.35]} material={mats.black}>
        <sphereGeometry args={[0.28 * s, 5, 4]} />
      </mesh>
      <group ref={head} position={[0, 1.45, 0.85]}>
        <mesh castShadow material={mats.white}>
          <boxGeometry args={[0.55 * s, 0.5 * s, 0.65 * s]} />
        </mesh>
        <mesh position={[0, -0.08, 0.38]} material={mats.muzzle}>
          <boxGeometry args={[0.32 * s, 0.22 * s, 0.2 * s]} />
        </mesh>
        {[-0.18, 0.18].map((x) => (
          <mesh key={x} position={[x * s, 0.12, 0.28]} material={mats.eye}>
            <sphereGeometry args={[0.06 * s, 4, 3]} />
          </mesh>
        ))}
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x * s, 0.32, 0]} rotation={[0, 0, x * 2.5]} material={mats.horn}>
            <coneGeometry args={[0.07 * s, 0.45 * s, 4]} />
          </mesh>
        ))}
        <mesh position={[0, -0.35, 0.15]} material={mats.bell}>
          <sphereGeometry args={[0.1 * s, 5, 4]} />
        </mesh>
      </group>
      <group ref={legL} position={[-0.28, 0.55, 0.35]}>
        <mesh position={[0, -0.35, 0]} material={mats.white}>
          <cylinderGeometry args={[0.1 * s, 0.08 * s, 0.7 * s, 4]} />
        </mesh>
      </group>
      <group ref={legR} position={[0.28, 0.55, 0.35]}>
        <mesh position={[0, -0.35, 0]} material={mats.white}>
          <cylinderGeometry args={[0.1 * s, 0.08 * s, 0.7 * s, 4]} />
        </mesh>
      </group>
      <mesh position={[-0.28, 0.2, -0.4]} material={mats.white}>
        <cylinderGeometry args={[0.1 * s, 0.08 * s, 0.7 * s, 4]} />
      </mesh>
      <mesh position={[0.28, 0.2, -0.4]} material={mats.black}>
        <cylinderGeometry args={[0.1 * s, 0.08 * s, 0.7 * s, 4]} />
      </mesh>
      <mesh position={[0, 1.3, -0.85]} rotation={[0.5, 0, 0]} material={mats.muzzle}>
        <cylinderGeometry args={[0.04 * s, 0.06 * s, 0.55 * s, 4]} />
      </mesh>
    </group>
  )
}
