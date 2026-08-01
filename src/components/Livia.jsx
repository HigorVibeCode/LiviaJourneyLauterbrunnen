import { useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { usePlayerStore, INITIAL_SPAWN, updatePlayerPosition } from '../store/playerStore'
import { useWaterfallStore } from '../store/waterfallStore'
import { useGameStore } from '../store/gameStore'
import { useProgressStore } from '../store/progressStore'
import { CAM_RAY_GROUPS, PLAYER_GROUPS } from '../physics/groups'
import { GUIDE_HOLD_SEC, GUIDE_MAX_CHARGE, GUIDE_RECHARGE_RATE, guideHand, guideInput } from '../lib/guideInput'
import { getObjectiveTarget } from '../lib/objectiveTarget'
import { phoenixRide } from '../lib/phoenixRide'
import { cowChase } from '../lib/cowChase'
import {
  horseRide,
  HORSE_RIDE_WALK,
  HORSE_RIDE_RUN,
  HORSE_CAM_DIST,
  HORSE_SEAT_Y,
  HORSE_SEAT_Z,
  HORSE_MODEL_SINK,
} from '../lib/horseRide'
import { resolveWaterPush, WATER_COMPLAINTS } from '../lib/waterPush'
import LiviaModel from './livia/LiviaModel'
import { sfxFootstep, sfxJump, sfxLand, sfxComplaintSplash, surfaceAt } from '../audio/sfx'
import { touchInput } from '../lib/touchInput'
import { groundHeightAt, pathXAt } from '../config/world'
import { LiviaLanternLight } from './LanternPickup'

const WALK_SPEED = 7.4
const RUN_SPEED = 12.4
const ACCEL = 28
const AIR_CONTROL = 0.38
const JUMP_FORCE = 7.8
const FALL_Y = -18
const SAFE_UPDATE_INTERVAL = 0.25
/** Se há input mas quase não anda, solta da vegetação */
const STUCK_SPEED = 0.55
const STUCK_TIME = 0.38
const UNSTUCK_NUDGE = 3.2
const CAM_DIST = 8.6
const CAM_MIN_DIST = 2.4
const LOOK_HEIGHT = 1.45
const CAM_SKIN = 0.55
const CAM_PITCH_MIN = 0.12
const CAM_PITCH_MAX = 1.15
const CAM_MOUSE_SENS = 0.0022
const TURN_SPEED = 14
const GUIDE_TURN_SPEED = 7
const complaintIdx = { i: 0 }
/**
 * Suavização da câmera por segundo (fração restante após 1s).
 * Valores altos = câmera "arrastada": era 0.0015, o que só percorria ~10% da
 * distância por frame e fazia o andar parecer travado. 1e-9 dá ~28%/frame.
 */
const CAM_SMOOTH = 1e-9
/** Com obstáculo no LOS: quase snap — evita ficar “presa” atrás da árvore no lerp */
const CAM_OCCLUDE_SMOOTH = 1e-20
const CAM_ZOOM_OUT_SMOOTH = 0.05

function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)
}

export default function Livia() {
  const bodyRef = useRef(null)
  const modelRef = useRef(null)
  const hopRef = useRef(null)
  const hopTimerRef = useRef(1)
  const lastPickupSeen = useRef(0)
  const stepAccumRef = useRef(0)
  const prevGroundedRef = useRef(true)
  const groundedRef = useRef(false)
  const jumpCooldownRef = useRef(0)
  const jumpTimerRef = useRef(0)
  const safeTimerRef = useRef(0)
  const respawningRef = useRef(false)
  const camDistRef = useRef(CAM_DIST)
  const camDebugRef = useRef({ ideal: CAM_DIST, wanted: CAM_DIST, occluded: false })
  /** Órbita da câmera: yaw 0 = atrás no +Z (visão inicial do mapa) */
  const camOrbit = useRef({ yaw: 0, pitch: 0.42 })
  const prevPosRef = useRef({ x: INITIAL_SPAWN.x, z: INITIAL_SPAWN.z })
  const stuckTimerRef = useRef(0)

  const animState = useRef({
    speed: 0,
    grounded: true,
    jumping: false,
    paused: false,
    guiding: false,
    riding: false,
  })
  const eWasDown = useRef(false)
  const horseGuideWarnRef = useRef(false)
  const finaleHopStarted = useRef(false)

  const { world, rapier } = useRapier()
  const camLook = useMemo(() => new THREE.Vector3(), [])
  const camDesired = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const camTarget = useMemo(() => new THREE.Vector3(), [])
  // raios reutilizados: criar 2 objetos novos por frame alimentava o GC
  const groundRay = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), [rapier])
  const camRay = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), [rapier])

  const setLastSafe = usePlayerStore((s) => s.setLastSafe)
  const getRespawnPoint = usePlayerStore((s) => s.getRespawnPoint)
  const countRespawn = usePlayerStore((s) => s.countRespawn)
  const paused = useGameStore((s) => s.paused)
  const [, getKeys] = useKeyboardControls()

  // atalho de debug para inspecionar fases distantes sem abrir os portões
  // (no build, só com ?debug=1 na URL)
  useEffect(() => {
    const enabled =
      import.meta.env.DEV ||
      (typeof window !== 'undefined' && window.location.search.includes('debug'))
    if (!enabled) return undefined
    window.livia = {
      teleport: (x, y, z) => {
        const body = bodyRef.current
        if (!body) return
        // Rapier não aceita setTranslation no meio do step — agenda no idle
        requestAnimationFrame(() => {
          const b = bodyRef.current
          if (!b) return
          b.setTranslation({ x, y, z }, true)
          b.setLinvel({ x: 0, y: 0, z: 0 }, true)
          updatePlayerPosition({ x, y, z })
          setLastSafe({ x, y, z })
        })
      },
      pos: () => {
        const b = bodyRef.current
        if (!b) return null
        const t = b.translation()
        const v = b.linvel()
        return { x: t.x, y: t.y, z: t.z, vx: v.x, vy: v.y, vz: v.z }
      },
      // empurra a Livia um pouco em −Z (testa física sem teclado)
      nudge: (vz = -8) => {
        requestAnimationFrame(() => {
          const b = bodyRef.current
          if (!b) return
          const v = b.linvel()
          b.setLinvel({ x: v.x, y: v.y, z: vz }, true)
        })
      },
      // dá um item direto no inventário (para testar roupas/portões)
      grant: (itemId) => useProgressStore.getState().collectItem(itemId),
      unlock: (gateId) => useProgressStore.getState().tryUnlockGate(gateId),
      itemPos: (itemId) => useProgressStore.getState().itemPositions[itemId],
      camDebug: () => ({ ...camDebugRef.current }),
      horse: () => ({ ...horseRide }),
      mountHorse: () => {
        if (!horseRide.ready || horseRide.finished) return false
        horseRide.greetDone = true
        horseRide.greeting = false
        horseRide.mounted = true
        return true
      },
    }
    return () => {
      delete window.livia
    }
  }, [setLastSafe])

  // Câmera com o mouse (pointer lock ao clicar no canvas)
  useEffect(() => {
    const onClick = (e) => {
      if (useGameStore.getState().paused) return
      const canvas = e.target?.closest?.('canvas') || document.querySelector('canvas')
      if (!canvas || e.target !== canvas) return
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.()
    }
    const onMove = (e) => {
      if (document.pointerLockElement == null) return
      if (useGameStore.getState().paused) return
      const o = camOrbit.current
      o.yaw -= e.movementX * CAM_MOUSE_SENS
      o.pitch = THREE.MathUtils.clamp(
        o.pitch + e.movementY * CAM_MOUSE_SENS,
        CAM_PITCH_MIN,
        CAM_PITCH_MAX,
      )
    }
    const onPause = () => {
      if (useGameStore.getState().paused && document.pointerLockElement) {
        document.exitPointerLock?.()
      }
    }
    window.addEventListener('click', onClick)
    window.addEventListener('mousemove', onMove)
    const unsub = useGameStore.subscribe(onPause)
    return () => {
      window.removeEventListener('click', onClick)
      window.removeEventListener('mousemove', onMove)
      unsub()
    }
  }, [])

  useFrame((state, delta) => {
    const body = bodyRef.current
    if (!body) return

    const dt = Math.min(delta, 0.05)
    const finalePhase = useProgressStore.getState().finalePhase
    const inFinale = Boolean(finalePhase && finalePhase !== 'done')

    // cutscene: trava controle e segue a fênix / baú
    if (inFinale) {
      guideInput.holding = false
      guideInput.guiding = false
      guideInput.holdTime = 0
      guideHand.active = false
      animState.current.guiding = false
      animState.current.speed = 0
      animState.current.paused = false
      animState.current.grounded = true

      if (phoenixRide.hidePlayer) {
        body.setTranslation(
          { x: phoenixRide.x, y: phoenixRide.y + 1.35, z: phoenixRide.z },
          true,
        )
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        if (modelRef.current) modelRef.current.visible = false
        updatePlayerPosition({ x: phoenixRide.x, y: phoenixRide.y, z: phoenixRide.z })
        // câmera cinematográfica: 3/4 atrás, um pouco acima e ao lado
        const yaw = phoenixRide.yaw
        const side = 0.55 // offset lateral (perfil)
        const back = 14
        const up = 4.8
        const sin = Math.sin(yaw)
        const cos = Math.cos(yaw)
        camLook.set(phoenixRide.x + sin * 1.2, phoenixRide.y + 1.6, phoenixRide.z + cos * 1.2)
        camDesired.set(
          phoenixRide.x - sin * back + cos * side * 9,
          phoenixRide.y + up,
          phoenixRide.z - cos * back - sin * side * 9,
        )
        state.camera.position.lerp(camDesired, 1 - Math.pow(1e-6, dt))
        state.camera.lookAt(camLook)
      } else {
        if (modelRef.current) modelRef.current.visible = true
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        const p = body.translation()
        // pickup: junto ao baú; mount: caminha até a fênix pousada
        const mounting = finalePhase === 'mount'
        const target = mounting
          ? {
              x: phoenixRide.x - Math.sin(phoenixRide.yaw) * 1.6,
              y: p.y,
              z: phoenixRide.z - Math.cos(phoenixRide.yaw) * 1.6,
            }
          : { x: 0, y: p.y, z: phoenixRide.z + 2.2 }
        const speed = mounting ? 3.6 : 2.4
        const ny = groundHeightAt(
          THREE.MathUtils.lerp(p.x, target.x, Math.min(1, dt * speed)),
          THREE.MathUtils.lerp(p.z, target.z, Math.min(1, dt * speed)),
        )
        body.setTranslation(
          {
            x: THREE.MathUtils.lerp(p.x, target.x, Math.min(1, dt * speed)),
            y: ny > 0.1 ? ny : p.y,
            z: THREE.MathUtils.lerp(p.z, target.z, Math.min(1, dt * speed)),
          },
          true,
        )
        const np = body.translation()
        updatePlayerPosition(np)

        let faceYaw = Math.PI
        if (mounting) {
          const dx = phoenixRide.x - np.x
          const dz = phoenixRide.z - np.z
          if (dx * dx + dz * dz > 0.05) faceYaw = Math.atan2(dx, dz)
        }
        if (modelRef.current) {
          const cur = modelRef.current.rotation.y
          let diff = faceYaw - cur
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          modelRef.current.rotation.y = cur + diff * Math.min(1, dt * 5)
        }

        if (hopRef.current) {
          if (finalePhase === 'pickup') {
            if (!finaleHopStarted.current) {
              finaleHopStarted.current = true
              hopTimerRef.current = 0
            }
            hopTimerRef.current = Math.min(1, hopTimerRef.current + dt / 1.6)
            hopRef.current.position.y = Math.sin(hopTimerRef.current * Math.PI) * 0.35
          } else if (mounting && phoenixRide.progress > 0.62) {
            const climb = Math.min(1, (phoenixRide.progress - 0.62) / 0.22)
            hopRef.current.position.y = Math.sin(climb * Math.PI) * 1.15
            animState.current.speed = 1.2
          } else {
            hopRef.current.position.y = 0
            animState.current.speed = mounting ? 4 : 0
          }
        }

        // câmera cinematográfica: perfil da fênix + Livia
        if (mounting) {
          const midX = (np.x + phoenixRide.x) * 0.5
          const midY = Math.max(np.y, phoenixRide.y) + 2.2
          const midZ = (np.z + phoenixRide.z) * 0.5
          camLook.set(midX, midY, midZ)
          camDesired.set(midX + 11, midY + 4.5, midZ + 7)
        } else {
          camLook.set(np.x, np.y + LOOK_HEIGHT, np.z)
          camDesired.set(np.x + 3, np.y + LOOK_HEIGHT + 3.5, np.z + CAM_DIST * 0.6)
        }
        state.camera.position.lerp(camDesired, 1 - Math.pow(1e-8, dt))
        state.camera.lookAt(camLook)
      }
      return
    }

    if (modelRef.current) modelRef.current.visible = true
    finaleHopStarted.current = false

    // cavalgada no pasto: Livia sentada no dorso, câmera mais afastada
    if (horseRide.mounted && !inFinale) {
      guideInput.holding = false
      guideInput.guiding = false
      guideHand.active = false
      animState.current.guiding = false
      animState.current.riding = true

      const keys = getKeys()
      const interact = keys.interact || touchInput.interact
      if (interact) {
        if (!horseGuideWarnRef.current) {
          horseGuideWarnRef.current = true
          const toast = 'Desça do cavalo para usar a guia luminosa.'
          useProgressStore.setState({ toast })
          setTimeout(() => {
            if (useProgressStore.getState().toast === toast) {
              useProgressStore.setState({ toast: null })
            }
          }, 2800)
        }
      } else {
        horseGuideWarnRef.current = false
      }

      const { forward, back, left, right, run, jump } = keys
      let inputX = 0
      let inputZ = 0
      if (forward) inputZ -= 1
      if (back) inputZ += 1
      if (left) inputX -= 1
      if (right) inputX += 1
      const length = Math.hypot(inputX, inputZ)
      if (length > 0) {
        inputX /= length
        inputZ /= length
      }
      const lookYaw = camOrbit.current.yaw
      const fx = -Math.sin(lookYaw)
      const fz = -Math.cos(lookYaw)
      const rx = Math.cos(lookYaw)
      const rz = -Math.sin(lookYaw)
      const moveForward = -inputZ
      const worldX = moveForward * fx + inputX * rx
      const worldZ = moveForward * fz + inputX * rz
      const maxSpeed = run ? HORSE_RIDE_RUN : HORSE_RIDE_WALK
      const blend = 1 - Math.exp(-18 * dt)
      const velH = horseRide.speed
      const targetSpeed = length > 0.05 ? maxSpeed : 0
      const speed = lerp(velH, targetSpeed, blend)
      horseRide.speed = speed

      const hx = horseRide.x + worldX * speed * dt
      const hz = horseRide.z + worldZ * speed * dt
      const hy = groundHeightAt(hx, hz)
      horseRide.x = hx
      horseRide.z = hz
      horseRide.y = hy
      if (length > 0.05) horseRide.yaw = Math.atan2(worldX, worldZ)

      // assento: root nos pés → quadril na sela; acompanha bob do galope
      const yaw = horseRide.yaw
      const seatX = hx + Math.sin(yaw) * HORSE_SEAT_Z
      const seatZ = hz + Math.cos(yaw) * HORSE_SEAT_Z
      const seatY = hy + HORSE_SEAT_Y + horseRide.bobY
      body.setGravityScale(0)
      body.setTranslation({ x: seatX, y: seatY, z: seatZ }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      updatePlayerPosition({ x: seatX, y: seatY, z: seatZ })
      prevPosRef.current = { x: seatX, z: seatZ }

      if (modelRef.current) {
        // model já nasce com +PI; yaw do cavalo é absoluto no mundo
        modelRef.current.rotation.y = yaw
        // afunda o mesh na sela (encaixe visual no dorso)
        modelRef.current.position.set(0, HORSE_MODEL_SINK, 0.05)
      }
      if (hopRef.current) hopRef.current.position.set(0, 0, 0)
      animState.current.speed = speed * 0.45
      animState.current.grounded = true
      animState.current.jumping = false

      const { yaw: camYaw, pitch } = camOrbit.current
      const cosP = Math.cos(pitch)
      camLook.set(seatX, hy + LOOK_HEIGHT + 0.35 + horseRide.bobY, seatZ)
      camDesired.set(
        seatX + Math.sin(camYaw) * cosP * HORSE_CAM_DIST,
        hy + LOOK_HEIGHT + 0.35 + Math.sin(pitch) * HORSE_CAM_DIST,
        seatZ + Math.cos(camYaw) * cosP * HORSE_CAM_DIST,
      )
      state.camera.position.lerp(camDesired, 1 - Math.pow(CAM_SMOOTH, dt))
      state.camera.lookAt(camLook)
      void jump
      return
    }

    if (animState.current.riding) {
      body.setGravityScale(1)
    }
    animState.current.riding = false
    if (modelRef.current) modelRef.current.position.y = 0

    // vaca alpina: arrasta a Livia no chão, aos trancos (cômico)
    if (cowChase.dragging && !inFinale) {
      const nx = cowChase.victimX
      const ny = cowChase.victimY
      const nz = cowChase.victimZ
      body.setTranslation({ x: nx, y: ny + 0.35, z: nz }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      updatePlayerPosition({ x: nx, y: ny, z: nz })

      if (modelRef.current) {
        modelRef.current.rotation.y = cowChase.victimYaw
        modelRef.current.rotation.z = cowChase.victimRoll
        modelRef.current.rotation.x = cowChase.victimPitch
        modelRef.current.position.y = cowChase.victimBob * 0.15
      }
      if (hopRef.current) {
        hopRef.current.position.y = cowChase.victimBob * 0.35
      }

      // câmera acompanha o “comboio” vaca + Livia
      const midX = (cowChase.x + nx) * 0.5
      const midZ = (cowChase.z + nz) * 0.5
      camLook.set(midX, ny + LOOK_HEIGHT * 0.7, midZ)
      camDesired.set(midX + 5.5, ny + 4.8, midZ + 8.5)
      state.camera.position.lerp(camDesired, 1 - Math.pow(1e-7, dt))
      state.camera.lookAt(camLook)
      animState.current.speed = 2.5
      animState.current.grounded = false
      animState.current.jumping = true
      return
    }

    // limpa pose cômica ao soltar
    if (modelRef.current) {
      modelRef.current.rotation.z = 0
      modelRef.current.rotation.x = 0
    }

    const pos = body.translation()
    const vel = body.linvel()
    updatePlayerPosition(pos)

    // ── Chão: raycast curto para baixo (confiável após pulos) ──
    groundRay.origin.x = pos.x
    groundRay.origin.y = pos.y + 0.3
    groundRay.origin.z = pos.z
    const groundHit = world.castRay(
      groundRay,
      0.75,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      body,
    )
    groundedRef.current = groundHit !== null && vel.y <= 2

    // ── Limbo ──
    if (pos.y < FALL_Y && !respawningRef.current) {
      respawningRef.current = true
      const spawn = getRespawnPoint()
      body.setTranslation(spawn, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      groundedRef.current = true
      countRespawn()
      requestAnimationFrame(() => {
        respawningRef.current = false
      })
      return
    }

    // ── Câmera orbital (mouse) + occlusion ──
    const { yaw, pitch } = camOrbit.current
    const cosP = Math.cos(pitch)
    camLook.set(pos.x, pos.y + LOOK_HEIGHT, pos.z)
    camDesired.set(
      pos.x + Math.sin(yaw) * cosP * CAM_DIST,
      pos.y + LOOK_HEIGHT + Math.sin(pitch) * CAM_DIST,
      pos.z + Math.cos(yaw) * cosP * CAM_DIST,
    )
    camDir.copy(camDesired).sub(camLook)
    const idealDist = camDir.length()
    camDir.normalize()

    camRay.origin.x = camLook.x
    camRay.origin.y = camLook.y
    camRay.origin.z = camLook.z
    camRay.dir.x = camDir.x
    camRay.dir.y = camDir.y
    camRay.dir.z = camDir.z
    const camHit = world.castRay(
      camRay,
      idealDist,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      CAM_RAY_GROUPS,
      undefined,
      body,
    )
    let wanted = camHit
      ? Math.max(CAM_MIN_DIST, camHit.timeOfImpact - CAM_SKIN)
      : idealDist

    // LOS atual: se o lerp deixou a câmera atrás de um obstáculo, puxa na hora
    let stranded = false
    const curDist = state.camera.position.distanceTo(camLook)
    if (curDist > CAM_MIN_DIST + 0.05) {
      const dx = (state.camera.position.x - camLook.x) / curDist
      const dy = (state.camera.position.y - camLook.y) / curDist
      const dz = (state.camera.position.z - camLook.z) / curDist
      camRay.dir.x = dx
      camRay.dir.y = dy
      camRay.dir.z = dz
      const losHit = world.castRay(
        camRay,
        curDist,
        true,
        rapier.QueryFilterFlags.EXCLUDE_SENSORS,
        CAM_RAY_GROUPS,
        undefined,
        body,
      )
      if (losHit && losHit.timeOfImpact < curDist - 0.2) {
        const pull = Math.max(CAM_MIN_DIST, losHit.timeOfImpact - CAM_SKIN)
        state.camera.position.set(
          camLook.x + dx * pull,
          camLook.y + dy * pull,
          camLook.z + dz * pull,
        )
        wanted = Math.min(wanted, pull)
        stranded = true
      }
      // restaura direção do braço ideal da câmera
      camRay.dir.x = camDir.x
      camRay.dir.y = camDir.y
      camRay.dir.z = camDir.z
    }

    const occluded = stranded || wanted < idealDist - 0.12
    // aproxima rápido (evita clipping), afasta devagar (evita "pulo" de câmera)
    camDistRef.current =
      wanted < camDistRef.current
        ? wanted
        : lerp(camDistRef.current, wanted, 1 - Math.pow(CAM_ZOOM_OUT_SMOOTH, dt))

    camDebugRef.current.ideal = idealDist
    camDebugRef.current.wanted = camDistRef.current
    camDebugRef.current.occluded = occluded

    camTarget.copy(camLook).addScaledVector(camDir, camDistRef.current)
    const camFollow = occluded ? CAM_OCCLUDE_SMOOTH : CAM_SMOOTH
    state.camera.position.lerp(camTarget, 1 - Math.pow(camFollow, dt))
    state.camera.lookAt(camLook)

    if (paused) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      animState.current.paused = true
      animState.current.guiding = false
      guideInput.holding = false
      guideInput.guiding = false
      guideInput.holdTime = 0
      guideHand.active = false
      eWasDown.current = false
      return
    }
    animState.current.paused = false

    // ── Checkpoint ──
    const field = useWaterfallStore.getState().getActiveFieldAt(pos)
    if (groundedRef.current && !field) {
      safeTimerRef.current += dt
      if (safeTimerRef.current >= SAFE_UPDATE_INTERVAL) {
        safeTimerRef.current = 0
        setLastSafe({ x: pos.x, y: pos.y, z: pos.z })
      }
    }

    // ── Input ──
    const keys = getKeys()
    const forward = keys.forward || touchInput.forward
    const back = keys.back || touchInput.back
    const left = keys.left || touchInput.left
    const right = keys.right || touchInput.right
    const jump = keys.jump || touchInput.jump
    const run = keys.run || touchInput.run
    const interact = keys.interact || touchInput.interact

    // E: tap curto → portão / montar; segurar → guia (consome carga, recarrega fora de uso)
    if (guideInput.tapStale) {
      guideInput.tapPending = false
      guideInput.tapStale = false
    }
    const tryMountHere = () => {
      if (!horseRide.nearMount || horseRide.mounted || horseRide.finished) return false
      horseRide.mounted = true
      guideInput.tapPending = false
      guideInput.holding = false
      guideInput.holdTime = 0
      const toast = 'Livia montou o cavalo! Atravessa o pasto cavalgando.'
      useProgressStore.setState({ toast })
      setTimeout(() => {
        if (useProgressStore.getState().toast === toast) {
          useProgressStore.setState({ toast: null })
        }
      }, 3500)
      return true
    }
    if (interact) {
      if (!eWasDown.current) {
        guideInput.holdTime = 0
        guideInput.tapPending = false
        guideInput.tapStale = false
      }
      eWasDown.current = true
      guideInput.holding = true
      guideInput.holdTime += dt
      // montar no hold curto (Horse roda antes da Livia — o tap sozinho podia perder o frame)
      if (guideInput.holdTime > 0.1 && tryMountHere()) {
        /* montou */
      } else if (
        guideInput.holdTime >= GUIDE_HOLD_SEC &&
        guideInput.charge > 0 &&
        !guideInput.depleted
      ) {
        guideInput.guiding = true
      } else if (guideInput.charge <= 0) {
        guideInput.guiding = false
        guideInput.depleted = true
      }
    } else {
      if (eWasDown.current) {
        if (!guideInput.guiding && guideInput.holdTime > 0 && guideInput.holdTime < GUIDE_HOLD_SEC) {
          if (!tryMountHere()) {
            guideInput.tapPending = true
            guideInput.tapStale = false
          }
        }
      }
      eWasDown.current = false
      guideInput.holding = false
      guideInput.guiding = false
      guideInput.holdTime = 0
    }
    if (guideInput.guiding) {
      guideInput.charge = Math.max(0, guideInput.charge - dt)
      if (guideInput.charge <= 0) {
        guideInput.guiding = false
        guideInput.depleted = true
      }
    } else if (!guideInput.holding && guideInput.charge < GUIDE_MAX_CHARGE) {
      guideInput.charge = Math.min(GUIDE_MAX_CHARGE, guideInput.charge + dt * GUIDE_RECHARGE_RATE)
      if (guideInput.charge > 0.05) guideInput.depleted = false
    }
    if (guideInput.tapPending) guideInput.tapStale = true
    guideHand.active = guideInput.guiding
    animState.current.guiding = guideInput.guiding

    let inputX = 0
    let inputZ = 0
    if (forward) inputZ -= 1
    if (back) inputZ += 1
    if (left) inputX -= 1
    if (right) inputX += 1

    const length = Math.hypot(inputX, inputZ)
    if (length > 0) {
      inputX /= length
      inputZ /= length
    }

    // WASD relativo à direção da câmera
    const lookYaw = camOrbit.current.yaw
    const fx = -Math.sin(lookYaw)
    const fz = -Math.cos(lookYaw)
    const rx = Math.cos(lookYaw)
    const rz = -Math.sin(lookYaw)
    const moveForward = -inputZ
    const worldX = moveForward * fx + inputX * rx
    const worldZ = moveForward * fz + inputX * rz

    const maxSpeed = run ? RUN_SPEED : WALK_SPEED
    const control = groundedRef.current ? 1 : AIR_CONTROL
    const blend = 1 - Math.exp(-ACCEL * control * dt)
    const touchMove = touchInput.forward || touchInput.back || touchInput.left || touchInput.right
    const turnBoost = touchMove ? 1.18 : 1
    let nextX = lerp(vel.x, worldX * maxSpeed, blend)
    let nextZ = lerp(vel.z, worldZ * maxSpeed, blend)
    let nextY = vel.y

    if (field) {
      const f = field.force
      nextX = lerp(vel.x, worldX * maxSpeed * 0.25 + f.x, 0.4)
      nextZ = lerp(vel.z, worldZ * maxSpeed * 0.25 + f.z, 0.4)
      nextY = Math.min(vel.y, -1.5) + f.y * dt * 1.8
      groundedRef.current = false
    }

    jumpCooldownRef.current = Math.max(0, jumpCooldownRef.current - dt)
    jumpTimerRef.current = Math.max(0, jumpTimerRef.current - dt)
    if (jump && groundedRef.current && jumpCooldownRef.current === 0) {
      nextY = JUMP_FORCE
      groundedRef.current = false
      jumpCooldownRef.current = 0.32
      jumpTimerRef.current = 0.42
      sfxJump()
    }

    body.setLinvel({ x: nextX, y: nextY, z: nextZ }, true)

    // ── Anti-stuck: input forte + quase parado no chão → empurra pra trilha ──
    const wantMove = length > 0.2
    const horizSpeed = Math.hypot(vel.x, vel.z)
    if (groundedRef.current && wantMove && !field && horizSpeed < STUCK_SPEED) {
      stuckTimerRef.current += dt
      if (stuckTimerRef.current >= STUCK_TIME) {
        stuckTimerRef.current = 0
        const pathX = pathXAt(pos.z)
        const toPathX = pathX - pos.x
        const alongZ = worldZ !== 0 ? Math.sign(worldZ) : -1
        const nudgeX =
          Math.abs(toPathX) > 0.8
            ? Math.sign(toPathX) * UNSTUCK_NUDGE
            : worldX * UNSTUCK_NUDGE
        const nudgeZ = alongZ * UNSTUCK_NUDGE * 0.85
        const nx = pos.x + nudgeX * 0.08
        const nz = pos.z + nudgeZ * 0.08
        const ny = Math.max(pos.y, groundHeightAt(nx, nz))
        body.setTranslation({ x: nx, y: ny, z: nz }, true)
        body.setLinvel({ x: nudgeX, y: Math.max(nextY, 1.2), z: nudgeZ }, true)
        updatePlayerPosition({ x: nx, y: ny, z: nz })
      }
    } else {
      stuckTimerRef.current = 0
    }

    // ── Água: não atravessar — empurra para a margem e reclama ──
    if (groundedRef.current || nextY <= 0.5) {
      const pushed = resolveWaterPush(
        pos.x,
        pos.z,
        prevPosRef.current.x,
        prevPosRef.current.z,
        state.clock.elapsedTime,
      )
      if (pushed) {
        const ny = groundHeightAt(pushed.x, pushed.z)
        body.setTranslation({ x: pushed.x, y: Math.max(pos.y, ny), z: pushed.z }, true)
        body.setLinvel({ x: 0, y: Math.min(nextY, 0), z: 0 }, true)
        updatePlayerPosition({ x: pushed.x, y: pos.y, z: pushed.z })
        if (pushed.complained) {
          sfxComplaintSplash()
          const msg = WATER_COMPLAINTS[complaintIdx.i % WATER_COMPLAINTS.length]
          complaintIdx.i += 1
          useProgressStore.setState({ toast: msg })
          setTimeout(() => {
            if (useProgressStore.getState().toast === msg) {
              useProgressStore.setState({ toast: null })
            }
          }, 2200)
        }
      }
    }
    prevPosRef.current = { x: body.translation().x, z: body.translation().z }

    // ── Sons de passos e aterrissagem ──
    // O acumulador de distância dispara um passo a cada "passada" real,
    // então o ritmo acompanha a velocidade (andar/correr) sem patinar.
    const speedH = Math.hypot(nextX, nextZ)
    if (groundedRef.current && speedH > 1.2) {
      stepAccumRef.current += speedH * dt
      const stride = speedH > 8.5 ? 2.5 : 1.8
      if (stepAccumRef.current >= stride) {
        stepAccumRef.current = 0
        sfxFootstep(surfaceAt(pos.z), speedH > 8.5)
      }
    } else {
      // meio passo carregado: o primeiro som sai logo ao retomar o andar
      stepAccumRef.current = 0.9
    }
    if (groundedRef.current && !prevGroundedRef.current && vel.y < -6) {
      sfxLand()
    }
    prevGroundedRef.current = groundedRef.current

    // ── Pulinho de conquista ao coletar um item ──
    // (só o visual pula: a física não é tocada, então não atrapalha o controle)
    const pickupAt = useProgressStore.getState().lastPickupAt
    if (pickupAt !== lastPickupSeen.current) {
      lastPickupSeen.current = pickupAt
      hopTimerRef.current = 0
    }
    if (hopRef.current) {
      if (hopTimerRef.current < 1) {
        hopTimerRef.current = Math.min(1, hopTimerRef.current + dt / 0.72)
        const k = hopTimerRef.current
        const arc = Math.sin(Math.min(1, k * 1.25) * Math.PI)
        hopRef.current.position.y = arc * 0.5
        // giro completo de alegria + squash na aterrissagem
        hopRef.current.rotation.y = easeOutCubic(k) * Math.PI * 2
        const squash = k > 0.86 ? 1 - Math.sin(((k - 0.86) / 0.14) * Math.PI) * 0.12 : 1
        hopRef.current.scale.set(1 / squash ** 0.5, squash, 1 / squash ** 0.5)
      } else {
        hopRef.current.position.y = 0
        hopRef.current.rotation.y = 0
        hopRef.current.scale.set(1, 1, 1)
      }
    }

    // ── Rotação: ao andar, segue a direção do movimento no mundo.
    // Parada + guia: vira suavemente para o objetivo.
    if (modelRef.current) {
      let targetRot = null
      if (length > 0.05) {
        targetRot = Math.atan2(worldX, worldZ)
      } else if (guideInput.guiding) {
        const objective = getObjectiveTarget()
        if (objective) {
          const dx = objective.position[0] - pos.x
          const dz = objective.position[2] - pos.z
          if (dx * dx + dz * dz > 0.25) targetRot = Math.atan2(dx, dz)
        }
      }
      if (targetRot !== null) {
        const current = modelRef.current.rotation.y
        let diff = targetRot - current
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        const turn =
          length > 0.05 ? TURN_SPEED * turnBoost : guideInput.guiding ? GUIDE_TURN_SPEED : TURN_SPEED * turnBoost
        modelRef.current.rotation.y = current + diff * Math.min(1, dt * turn)
      }
    }

    // ── Estado para o mixer de animação ──
    animState.current.speed = Math.hypot(nextX, nextZ)
    animState.current.grounded = groundedRef.current
    animState.current.jumping = jumpTimerRef.current > 0
  }, -1)

  return (
    <RigidBody
      ref={bodyRef}
      position={[INITIAL_SPAWN.x, INITIAL_SPAWN.y, INITIAL_SPAWN.z]}
      colliders={false}
      lockRotations
      enabledRotations={[false, false, false]}
      friction={0.18}
      restitution={0}
      linearDamping={0.08}
      angularDamping={1}
      ccd
      canSleep={false}
    >
      <CapsuleCollider
        args={[0.48, 0.24]}
        position={[0, 0.78, 0]}
        collisionGroups={PLAYER_GROUPS}
        friction={0.12}
      />
      {/* Rosto (+Z local) alinhado à frente do movimento (−Z mundo no idle) */}
      <group ref={modelRef} rotation={[0, Math.PI, 0]}>
        <group ref={hopRef}>
          <LiviaModel stateRef={animState} />
          <LiviaLanternLight />
        </group>
      </group>
    </RigidBody>
  )
}
