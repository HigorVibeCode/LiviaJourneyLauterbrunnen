import { useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { usePlayerStore, startPosition, updatePlayerPosition } from '../store/playerStore'
import { useWaterfallStore } from '../store/waterfallStore'
import { useGameStore } from '../store/gameStore'
import { useProgressStore } from '../store/progressStore'
import { CAM_RAY_WORLD, PLAYER_GROUPS } from '../physics/groups'
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
import { touchInput, detectMobile } from '../lib/touchInput'
import {
  GATES,
  HORSE_DISMOUNT_Z,
  HOUSES,
  groundHeightAt,
  pathXAt,
  resolveOnPath,
  SUMMIT_Y,
  TREASURE_POS,
  RIVER,
  RIVER_CX,
} from '../config/world'
import { LiviaLanternLight } from './LanternPickup'
import { updatePlayerPose } from '../multiplayer/playerPose'
import { isTyping } from '../lib/keyboard'
import { cameraState, playerActions } from '../lib/cameraState'
import { excludeFromNearFade } from '../materials/nearFade'
import { useLoadingStore } from '../store/loadingStore'

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
const CAM_MIN_DIST = 2.6
const LOOK_HEIGHT = 1.45
/** Altura fixa do pivô acima do chão analítico — nunca segue bounce do capsule */
const CAM_STAND_CLEAR = 0.92
const CAM_SKIN = 0.65
const CAM_PITCH_MIN = 0.05
const CAM_PITCH_MAX = 1.15
const CAM_MOUSE_SENS = 0.0022
const CAM_TOUCH_SENS = 0.0042
/** Correção lenta ao corpo — filtra jitter; a velocidade carrega o follow (sem lag ao strafear) */
const CAM_FOLLOW_CORRECT = 5.5
const CAM_FOLLOW_CORRECT_AIR = 14
const CAM_DIST_PULL = 11
const CAM_DIST_RELEASE = 2.2
const CAM_ORBIT_SMOOTH = 22
const CAM_OCCLUDE_HOLD = 2
const CAM_OCCLUDE_CLEAR = 12
const HORSE_CAM_STAND_CLEAR = 1.35
const HORSE_CAM_ORBIT_SMOOTH = 16
const TURN_SPEED = 14
const GUIDE_TURN_SPEED = 7
const complaintIdx = { i: 0 }
const NO_KEYS = {}
const HORSE_MAX_LAT = 36
/** Casas do pasto como discos — o cavalo contorna em vez de atravessar */
const HOUSE_DISCS = HOUSES.filter((h) => h.z < GATES.gate_pasture.z && h.z > HORSE_DISMOUNT_Z - 10).map(
  (h) => {
    const { x, z } = resolveOnPath(h)
    return { x, z, r: 9 * h.scale }
  },
)

function expSmooth(current, target, speed, dt) {
  return lerp(current, target, 1 - Math.exp(-speed * dt))
}

/**
 * Distância do spring-arm com histerese.
 * Só entra em oclusão após N frames; só solta após M frames livres.
 * Hits de chão (normal.y alta) são ignorados — eram a principal fonte de flicker.
 */
function springArmWanted(world, rapier, body, camRay, idealDist, occlude) {
  let rawHit = idealDist
  const toiHit = world.castRay(
    camRay,
    idealDist,
    true,
    rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    CAM_RAY_WORLD,
    undefined,
    body,
  )
  if (toiHit) {
    rawHit = Math.max(CAM_MIN_DIST, toiHit.timeOfImpact - CAM_SKIN)
  }

  const occluded = rawHit < idealDist - 0.25
  if (occluded) {
    occlude.hitFrames += 1
    occlude.clearFrames = 0
    if (occlude.hitFrames >= CAM_OCCLUDE_HOLD) occlude.active = true
    if (occlude.active) occlude.locked = rawHit
  } else {
    occlude.clearFrames += 1
    occlude.hitFrames = 0
    if (occlude.clearFrames >= CAM_OCCLUDE_CLEAR) {
      occlude.active = false
      occlude.locked = idealDist
    }
  }

  return occlude.active ? occlude.locked : idealDist
}

function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)
}

export default function Livia() {
  // continua de onde parou (progresso salvo) — calculado uma vez por montagem
  const START = useMemo(() => startPosition(), [])
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
  const camPivot = useRef({
    x: START.x,
    y: groundHeightAt(START.x, START.z) + CAM_STAND_CLEAR + LOOK_HEIGHT,
    z: START.z,
  })
  /** Histerese do spring arm — evita flicker quando o ray oscila em emendas */
  const camOcclude = useRef({ hitFrames: 0, clearFrames: 0, locked: CAM_DIST, active: false })
  /** Frames seguidos sem chão — só então a câmera passa a seguir o corpo no ar */
  const camAirFrames = useRef(0)
  const camQuat = useRef(new THREE.Quaternion())
  const camQuatReady = useRef(false)
  const gravityStuckRef = useRef(false)
  /** Órbita da câmera: yaw 0 = atrás no +Z (visão inicial do mapa) */
  // pitch mais baixo: mostra mais céu e horizonte (antes olhava muito para o chão)
  const camOrbit = useRef({ yaw: 0, pitch: 0.3 })
  const camOrbitTarget = useRef({ yaw: 0, pitch: 0.3 })
  const camMobileRef = useRef(typeof window !== 'undefined' ? detectMobile() : false)
  const prevPosRef = useRef({ x: START.x, z: START.z })
  const stuckTimerRef = useRef(0)
  const horseSafeTimer = useRef(0)
  const finaleLandedRef = useRef(false)
  const blobRef = useRef(null)
  const fadeCheck = useRef(0)

  const animState = useRef({
    speed: 0,
    grounded: true,
    jumping: false,
    paused: false,
    guiding: false,
    riding: false,
  })
  const eWasDown = useRef(false)
  const pressTapRef = useRef(false)
  const pressConsumed = useRef(false)
  const horseGuideWarnRef = useRef(false)
  const finaleHopStarted = useRef(false)

  const { world, rapier } = useRapier()
  const camLook = useMemo(() => new THREE.Vector3(), [])
  const camDesired = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
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
      // move o cavalo montado (testes automáticos da cavalgada)
      horseTo: (x, z) => {
        horseRide.x = x
        horseRide.z = z
      },
      state: () => {
        const s = useProgressStore.getState()
        return {
          inventory: s.inventory,
          gates: s.unlockedGates,
          lantern: s.hasLantern,
          finale: s.finalePhase,
          finished: s.finished,
          toast: s.toast,
          nearGate: s.nearGateId,
          nearNpc: s.nearNpcId,
        }
      },
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
      if (document.pointerLockElement !== canvas) {
        // promessa rejeita se clicar logo depois de soltar — ignorar
        const p = canvas.requestPointerLock?.()
        if (p && typeof p.catch === 'function') p.catch(() => {})
      }
    }
    const onMove = (e) => {
      if (document.pointerLockElement == null) return
      if (useGameStore.getState().paused) return
      const o = camOrbitTarget.current
      o.yaw -= e.movementX * CAM_MOUSE_SENS
      o.pitch = THREE.MathUtils.clamp(
        o.pitch + e.movementY * CAM_MOUSE_SENS,
        CAM_PITCH_MIN,
        CAM_PITCH_MAX,
      )
      camOrbit.current.yaw = o.yaw
      camOrbit.current.pitch = o.pitch
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

  // Mobile: arrastar o dedo (fora do joystick/botões) gira a câmera
  useEffect(() => {
    camMobileRef.current = detectMobile()
    if (!camMobileRef.current) return undefined

    let lookId = null
    let lastX = 0
    let lastY = 0

    const isUiTouch = (x, y) => {
      const el = document.elementFromPoint(x, y)
      if (!el) return false
      return Boolean(
        el.closest(
          '.touch-joy-base, .touch-actions, .touch-btn, .pause-overlay, button, a, input, select',
        ),
      )
    }

    const applyLook = (dx, dy) => {
      const o = camOrbitTarget.current
      const orbit = camOrbit.current
      o.yaw -= dx * CAM_TOUCH_SENS
      o.pitch = THREE.MathUtils.clamp(
        o.pitch + dy * CAM_TOUCH_SENS,
        CAM_PITCH_MIN,
        CAM_PITCH_MAX,
      )
      // resposta imediata no touch (sem esperar o smooth do frame)
      orbit.yaw = o.yaw
      orbit.pitch = o.pitch
    }

    const onTouchStart = (e) => {
      if (useGameStore.getState().paused) return
      if (lookId != null) return
      for (const t of e.changedTouches) {
        // joystick / botões à parte — o resto da tela olha a câmera
        if (isUiTouch(t.clientX, t.clientY)) continue
        lookId = t.identifier
        lastX = t.clientX
        lastY = t.clientY
        break
      }
    }

    const onTouchMove = (e) => {
      if (lookId == null) return
      const t = [...e.touches].find((x) => x.identifier === lookId)
      if (!t) return
      e.preventDefault()
      const dx = t.clientX - lastX
      const dy = t.clientY - lastY
      lastX = t.clientX
      lastY = t.clientY
      applyLook(dx, dy)
    }

    const clearLook = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookId) lookId = null
      }
    }

    const optsMove = { passive: false }
    const optsStart = { passive: true }
    window.addEventListener('touchstart', onTouchStart, optsStart)
    window.addEventListener('touchmove', onTouchMove, optsMove)
    window.addEventListener('touchend', clearLook, optsStart)
    window.addEventListener('touchcancel', clearLook, optsStart)
    return () => {
      window.removeEventListener('touchstart', onTouchStart, optsStart)
      window.removeEventListener('touchmove', onTouchMove, optsMove)
      window.removeEventListener('touchend', clearLook, optsStart)
      window.removeEventListener('touchcancel', clearLook, optsStart)
    }
  }, [])

  useFrame((state, delta) => {
    const body = bodyRef.current
    if (!body) return
    // cavalo/fênix/vaca: a sombra redonda só volta no controle normal
    if (blobRef.current) blobRef.current.visible = false
    // roupas trocam ao pegar itens → remarca de tempos em tempos (barato)
    fadeCheck.current -= 1
    if (fadeCheck.current <= 0) {
      fadeCheck.current = 45
      excludeFromNearFade(modelRef.current)
    }

    // Mesmo teto do PhysicsTicker — input/câmera não aceleram em hitch
    const dt = Math.min(delta, 1 / 30)
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

    // fim do voo da fênix: a Livia "desce" de volta ao mirante (antes caía do céu no vazio)
    if (finalePhase === 'done' && !finaleLandedRef.current) {
      finaleLandedRef.current = true
      const land = { x: TREASURE_POS.x + 3, y: SUMMIT_Y + 1, z: TREASURE_POS.z + 7 }
      body.setTranslation(land, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setGravityScale(1, true)
      updatePlayerPosition(land)
      setLastSafe(land)
      camPivot.current.x = land.x
      camPivot.current.y = land.y + CAM_STAND_CLEAR + LOOK_HEIGHT
      camPivot.current.z = land.z
      if (modelRef.current) modelRef.current.rotation.y = Math.PI
      return
    }
    if (!finalePhase) finaleLandedRef.current = false

    // cavalgada no pasto: Livia sentada no dorso, câmera mais afastada
    if (horseRide.mounted && !inFinale) {
      guideInput.holding = false
      guideInput.guiding = false
      guideHand.active = false
      animState.current.guiding = false
      animState.current.riding = true

      const keys = isTyping() ? NO_KEYS : getKeys()
      const interact = keys.interact || touchInput.interact
      if (interact) {
        if (!horseGuideWarnRef.current) {
          horseGuideWarnRef.current = true
          const toast = 'A cavalo, é só seguir a trilha até o fim do pasto!'
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

      const frozen = paused
      const forward = !frozen && (keys.forward || touchInput.forward)
      const back = !frozen && (keys.back || touchInput.back)
      const left = !frozen && (keys.left || touchInput.left)
      const right = !frozen && (keys.right || touchInput.right)
      const run = keys.run || touchInput.run
      let inputX = 0
      let inputZ = 0
      if (forward) inputZ -= 1
      if (back) inputZ += 1
      if (left) inputX -= 1
      if (right) inputX += 1
      if (!frozen && touchInput.analog) {
        inputX = touchInput.moveX
        inputZ = touchInput.moveY
      }
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

      let hx = horseRide.x + worldX * speed * dt
      let hz = horseRide.z + worldZ * speed * dt
      // o cavalo não tem física: mantém dentro do pasto e fora das casas
      hz = THREE.MathUtils.clamp(hz, HORSE_DISMOUNT_Z - 2, GATES.gate_pasture.z - 3)
      const lat = hx - pathXAt(hz)
      if (Math.abs(lat) > HORSE_MAX_LAT) hx = pathXAt(hz) + Math.sign(lat) * HORSE_MAX_LAT
      for (const h of HOUSE_DISCS) {
        const dx = hx - h.x
        const dz = hz - h.z
        const d = Math.hypot(dx, dz)
        if (d < h.r && d > 1e-3) {
          hx = h.x + (dx / d) * h.r
          hz = h.z + (dz / d) * h.r
        }
      }
      const hy = groundHeightAt(hx, hz)
      horseSafeTimer.current += dt
      if (horseSafeTimer.current > 0.5) {
        horseSafeTimer.current = 0
        setLastSafe({ x: hx, y: hy, z: hz })
      }
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

      const orbitTarget = camOrbitTarget.current
      const orbit = camOrbit.current
      if (camMobileRef.current) {
        const orbitT = 1 - Math.exp(-HORSE_CAM_ORBIT_SMOOTH * dt)
        orbit.yaw = lerpAngle(orbit.yaw, orbitTarget.yaw, orbitT)
        orbit.pitch = expSmooth(orbit.pitch, orbitTarget.pitch, HORSE_CAM_ORBIT_SMOOTH, dt)
      } else {
        orbit.yaw = orbitTarget.yaw
        orbit.pitch = orbitTarget.pitch
      }

      const { yaw: camYaw, pitch } = orbit
      const cosP = Math.cos(pitch)
      // Cavalo já é cinemático — follow suave no assento, Y no chão (sem bob)
      camPivot.current.x = expSmooth(camPivot.current.x, seatX, 14, dt)
      camPivot.current.z = expSmooth(camPivot.current.z, seatZ, 14, dt)
      camPivot.current.y =
        groundHeightAt(camPivot.current.x, camPivot.current.z) + HORSE_CAM_STAND_CLEAR + LOOK_HEIGHT

      camLook.set(camPivot.current.x, camPivot.current.y, camPivot.current.z)
      camDistRef.current = expSmooth(camDistRef.current, HORSE_CAM_DIST, 4, dt)
      const dist = camDistRef.current

      state.camera.position.set(
        camLook.x + Math.sin(camYaw) * cosP * dist,
        camLook.y + Math.sin(pitch) * dist,
        camLook.z + Math.cos(camYaw) * cosP * dist,
      )
      state.camera.lookAt(camLook)
      camQuat.current.copy(state.camera.quaternion)
      camQuatReady.current = true
      cameraState.yaw = camYaw
      updatePlayerPose({
        x: seatX,
        y: seatY,
        z: seatZ,
        yaw: horseRide.yaw,
        speed,
        grounded: true,
      })
      return
    }

    if (animState.current.riding) {
      body.setGravityScale(1)
      // só limpa o sink da sela ao desmontar (não zerar offset anti-bounce do chão)
      if (modelRef.current) modelRef.current.position.y = 0
    }
    animState.current.riding = false

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

    // menu de pausa → "Voltar para a trilha": centro da trilha, um pouco à frente
    if (playerActions.unstuck) {
      playerActions.unstuck = false
      const cur = body.translation()
      const z = cur.z
      // no desfiladeiro, o "centro" seguro é a ponte
      const x = z <= RIVER.zTo + 2 && z >= RIVER.zFrom - 2 ? RIVER_CX : pathXAt(z)
      const safe = { x, y: groundHeightAt(x, z) + 1.2, z }
      body.setTranslation(safe, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      camPivot.current.x = safe.x
      camPivot.current.y = safe.y + CAM_STAND_CLEAR + LOOK_HEIGHT
      camPivot.current.z = safe.z
      updatePlayerPosition(safe)
      setLastSafe({ x: safe.x, y: safe.y - 1.2, z: safe.z })
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
    // folga entre a base da cápsula (origem + 0.06) e o chão (raio sai de +0.3). Antes contava
    // "no chão" até 0.5 m acima dele e zerava vy → pulos flutuavam ~1 s.
    const groundGap = groundHit ? groundHit.timeOfImpact - 0.24 : Infinity
    const snapRange = prevGroundedRef.current && jumpTimerRef.current === 0 ? 0.5 : 0.12
    groundedRef.current = groundGap <= snapRange && vel.y <= 2

    // sombra redonda sob os pés (sem shadow map ela parecia flutuar)
    if (blobRef.current) {
      const b = blobRef.current
      const gy = groundHit ? pos.y + 0.06 - groundGap : groundHeightAt(pos.x, pos.z)
      const h = Math.max(0, pos.y + 0.06 - gy)
      b.visible = h < 6
      b.position.set(pos.x, gy + 0.05, pos.z)
      const k = Math.max(0.35, 1 - h * 0.18)
      b.scale.set(k, k, k)
      b.material.opacity = 0.32 * k
    }

    // ── Limbo ──
    if (pos.y < FALL_Y && !respawningRef.current) {
      respawningRef.current = true
      const spawn = getRespawnPoint()
      body.setTranslation(spawn, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      groundedRef.current = true
      camPivot.current.x = spawn.x
      camPivot.current.y = spawn.y + CAM_STAND_CLEAR + LOOK_HEIGHT
      camPivot.current.z = spawn.z
      updatePlayerPosition(spawn)
      countRespawn()
      requestAnimationFrame(() => {
        respawningRef.current = false
      })
      return
    }

    if (paused) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      animState.current.paused = true
      animState.current.guiding = false
      guideInput.holding = false
      guideInput.guiding = false
      guideInput.holdTime = 0
      guideHand.active = false
      eWasDown.current = false
      // câmera congelada no follow atual (ainda responde ao mouse)
      {
        const o = camOrbitTarget.current
        const orbit = camOrbit.current
        if (camMobileRef.current) {
          orbit.yaw = lerpAngle(orbit.yaw, o.yaw, 1 - Math.exp(-CAM_ORBIT_SMOOTH * dt))
          orbit.pitch = expSmooth(orbit.pitch, o.pitch, CAM_ORBIT_SMOOTH, dt)
        } else {
          orbit.yaw = o.yaw
          orbit.pitch = o.pitch
        }
        const cosP = Math.cos(orbit.pitch)
        const dist = camDistRef.current
        camLook.set(camPivot.current.x, camPivot.current.y, camPivot.current.z)
        state.camera.position.set(
          camLook.x + Math.sin(orbit.yaw) * cosP * dist,
          camLook.y + Math.sin(orbit.pitch) * dist,
          camLook.z + Math.cos(orbit.yaw) * cosP * dist,
        )
        state.camera.lookAt(camLook)
      }
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

    // ── Input ── (nada de andar/pular atrás da introdução ou digitando um nome)
    const keys =
      isTyping() || !useLoadingStore.getState().introDone ? NO_KEYS : getKeys()
    const forward = keys.forward || touchInput.forward
    const back = keys.back || touchInput.back
    const left = keys.left || touchInput.left
    const right = keys.right || touchInput.right
    const jump = keys.jump || touchInput.jump
    const run = keys.run || touchInput.run
    const interact = keys.interact || touchInput.interact

    // E: interage NO APERTO (portão, NPC, cavalo). Se nada perto consumiu o
    // aperto e a tecla continua segura, vira a guia luminosa. G/Q (ou o botão
    // ✨ no touch) acendem a guia direto. Antes a interação só saía num
    // "toque curto" (<0.28 s) — criança segura o botão e nada acontecia.
    if (guideInput.tapStale) {
      if (pressTapRef.current && !guideInput.tapPending) pressConsumed.current = true
      pressTapRef.current = false
      guideInput.tapPending = false
      guideInput.tapStale = false
    }
    const tryMountHere = () => {
      if (!horseRide.nearMount || horseRide.mounted || horseRide.finished) return false
      horseRide.mounted = true
      guideInput.tapPending = false
      const toast = 'Livia montou o cavalo! Galope pela trilha até o fim do pasto.'
      useProgressStore.setState({ toast })
      setTimeout(() => {
        if (useProgressStore.getState().toast === toast) {
          useProgressStore.setState({ toast: null })
        }
      }, 3500)
      return true
    }
    const guideKey = keys.guide || touchInput.guide
    if (interact && !eWasDown.current) {
      guideInput.holdTime = 0
      pressConsumed.current = false
      if (tryMountHere()) {
        pressConsumed.current = true
      } else {
        guideInput.tapPending = true
        guideInput.tapStale = false
        pressTapRef.current = true
      }
    }
    eWasDown.current = interact
    const holdingAny = interact || guideKey
    if (holdingAny) {
      guideInput.holding = true
      guideInput.holdTime += dt
      const wantsGuide =
        guideKey || (!pressConsumed.current && guideInput.holdTime >= GUIDE_HOLD_SEC)
      if (wantsGuide && guideInput.charge > 0 && !guideInput.depleted) {
        guideInput.guiding = true
      } else if (guideInput.charge <= 0) {
        guideInput.guiding = false
        guideInput.depleted = true
      }
    } else {
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
    // joystick analógico: inclinar pouco = andar devagar
    let analogScale = 1
    if (touchInput.analog) {
      inputX = touchInput.moveX
      inputZ = touchInput.moveY
      analogScale = Math.min(1, Math.hypot(inputX, inputZ))
    }

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

    const maxSpeed = run ? RUN_SPEED : WALK_SPEED * Math.max(0.35, analogScale)
    const control = groundedRef.current ? 1 : AIR_CONTROL
    const blend = 1 - Math.exp(-ACCEL * control * dt)
    const touchMove = touchInput.analog
    const turnBoost = touchMove ? 1.18 : 1
    let nextX = lerp(vel.x, worldX * maxSpeed, blend)
    let nextZ = lerp(vel.z, worldZ * maxSpeed, blend)
    let nextY = vel.y
    // Impede overshoot se a vel residual veio de um hitch / nudge
    const horiz = Math.hypot(nextX, nextZ)
    if (horiz > maxSpeed) {
      nextX = (nextX / horiz) * maxSpeed
      nextZ = (nextZ / horiz) * maxSpeed
    }

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

    // No chão: só zera vy (sem toggle de gravityScale — oscilação causava hops)
    const sticking =
      groundedRef.current && jumpTimerRef.current === 0 && !field && nextY <= JUMP_FORCE * 0.5
    // gruda no chão descendo rampas/degraus em vez de flutuar e quicar
    if (sticking) nextY = groundGap > 0.03 ? -Math.min(12, groundGap / Math.max(dt, 1 / 120)) : 0
    if (gravityStuckRef.current) {
      gravityStuckRef.current = false
      body.setGravityScale(1)
    }

    body.setLinvel({ x: nextX, y: nextY, z: nextZ }, true)

    // ── Anti-stuck: input forte + quase parado → impulso horizontal (sem teleporte/Y) ──
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
        body.setLinvel({ x: nudgeX, y: nextY, z: nudgeZ }, true)
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
        if (pushed.complained) sfxComplaintSplash()
        // reclamação da água não atropela mensagens importantes (item, portão…)
        if (pushed.complained && !useProgressStore.getState().toast) {
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

    // ── Câmera: follow por velocidade (fluido ao strafear) + lookAt direto ──
    // Mouse já é fluido; o problema era pivô+pos+slerp a lutar com o jitter do capsule.
    {
      const orbitTarget = camOrbitTarget.current
      const orbit = camOrbit.current
      // tela de título: câmera balança devagar mostrando o vale
      if (!useLoadingStore.getState().introDone) {
        orbitTarget.yaw = Math.sin(state.clock.elapsedTime * 0.12) * 0.55
        orbitTarget.pitch = 0.3
      }
      if (camMobileRef.current) {
        const orbitT = 1 - Math.exp(-CAM_ORBIT_SMOOTH * dt)
        orbit.yaw = lerpAngle(orbit.yaw, orbitTarget.yaw, orbitT)
        orbit.pitch = expSmooth(orbit.pitch, orbitTarget.pitch, CAM_ORBIT_SMOOTH, dt)
      } else {
        orbit.yaw = orbitTarget.yaw
        orbit.pitch = orbitTarget.pitch
      }

      const { yaw, pitch } = orbit
      const cosP = Math.cos(pitch)
      const walkSpeed = Math.hypot(nextX, nextZ)

      const jumping = jumpTimerRef.current > 0
      if (jumping || (!groundedRef.current && nextY < -1.2)) {
        camAirFrames.current += 1
      } else if (groundedRef.current || walkSpeed > 0.15) {
        camAirFrames.current = 0
      }
      const airborne = jumping || camAirFrames.current > 10

      if (!airborne) {
        // Integra a velocidade desejada (suave) e corrige devagar ao corpo (rejeita bounce)
        camPivot.current.x += nextX * dt
        camPivot.current.z += nextZ * dt
        const corr = 1 - Math.exp(-CAM_FOLLOW_CORRECT * dt)
        camPivot.current.x += (pos.x - camPivot.current.x) * corr
        camPivot.current.z += (pos.z - camPivot.current.z) * corr
        // altura pelo chão real sob os pés (pedras, pontes, rampas) — não só o terreno analítico
        const footY = groundedRef.current ? pos.y + 0.06 : groundHeightAt(camPivot.current.x, camPivot.current.z)
        camPivot.current.y = expSmooth(
          camPivot.current.y,
          footY + CAM_STAND_CLEAR + LOOK_HEIGHT,
          12,
          dt,
        )
      } else {
        const corr = 1 - Math.exp(-CAM_FOLLOW_CORRECT_AIR * dt)
        camPivot.current.x += (pos.x - camPivot.current.x) * corr
        camPivot.current.z += (pos.z - camPivot.current.z) * corr
        // mesmo deslocamento do chão (antes faltava CAM_STAND_CLEAR → câmera "mergulhava" no pulo)
        camPivot.current.y = expSmooth(
          camPivot.current.y,
          pos.y + 0.06 + CAM_STAND_CLEAR + LOOK_HEIGHT,
          8,
          dt,
        )
      }

      camLook.set(camPivot.current.x, camPivot.current.y, camPivot.current.z)

      // Distância: ao mover no chão fica em CAM_DIST; parado pode aproximar de paredes
      // Spring-arm sempre ativo (antes era desligado ao andar → câmera entrava nas paredes)
      let dist = camDistRef.current
      {
        camDesired.set(
          camLook.x + Math.sin(yaw) * cosP * CAM_DIST,
          camLook.y + Math.sin(pitch) * CAM_DIST,
          camLook.z + Math.cos(yaw) * cosP * CAM_DIST,
        )
        camDir.copy(camDesired).sub(camLook)
        const idealDist = camDir.length()
        camDir.normalize()
        camRay.origin.x = camLook.x
        camRay.origin.y = camLook.y + 0.35
        camRay.origin.z = camLook.z
        camRay.dir.x = camDir.x
        camRay.dir.y = camDir.y
        camRay.dir.z = camDir.z
        const wanted = springArmWanted(world, rapier, body, camRay, idealDist, camOcclude.current)
        dist = expSmooth(camDistRef.current, wanted, wanted < dist ? CAM_DIST_PULL : CAM_DIST_RELEASE, dt)
        camDistRef.current = dist
      }

      camDebugRef.current.ideal = CAM_DIST
      camDebugRef.current.wanted = dist
      camDebugRef.current.occluded = camOcclude.current.active

      // Igual ao mouse: posição ideal exata + lookAt direto (sem slerp)
      state.camera.position.set(
        camLook.x + Math.sin(yaw) * cosP * dist,
        camLook.y + Math.sin(pitch) * dist,
        camLook.z + Math.cos(yaw) * cosP * dist,
      )
      state.camera.lookAt(camLook)
      camQuat.current.copy(state.camera.quaternion)
      camQuatReady.current = true
      cameraState.yaw = yaw
    }

    // ── Estado para o mixer de animação ──
    animState.current.speed = Math.hypot(nextX, nextZ)
    animState.current.grounded = groundedRef.current
    animState.current.jumping = jumpTimerRef.current > 0

    const pose = body.translation()
    updatePlayerPose({
      x: pose.x,
      y: pose.y,
      z: pose.z,
      yaw: modelRef.current?.rotation.y ?? 0,
      speed: animState.current.speed,
      grounded: groundedRef.current,
    })
  }, -1)

  return (
    <>
    <mesh ref={blobRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <circleGeometry args={[0.55, 20]} />
      <meshBasicMaterial color="#10141f" transparent opacity={0.32} depthWrite={false} />
    </mesh>
    <RigidBody
      ref={bodyRef}
      position={[START.x, START.y, START.z]}
      colliders={false}
      lockRotations
      enabledRotations={[false, false, false]}
      friction={0.18}
      restitution={0}
      linearDamping={0.08}
      angularDamping={1}
      ccd={false}
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
    </>
  )
}
