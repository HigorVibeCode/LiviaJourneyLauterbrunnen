import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { SUMMIT_Y, TREASURE_POS } from '../config/world'
import { phoenixRide } from '../lib/phoenixRide'
import { useProgressStore } from '../store/progressStore'

const TREASURE = { x: TREASURE_POS.x, y: TREASURE_POS.y, z: TREASURE_POS.z }
const LAND = { x: 3.2, y: SUMMIT_Y + 2.1, z: TREASURE_POS.z + 4 }

const PICKUP_END = 3.0
const MOUNT_END = 8.2
const FLY_END = 17

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

export default function FinaleDirector() {
  const startedRef = useRef(0)

  useFrame((state) => {
    const { finalePhase, setFinalePhase, finish } = useProgressStore.getState()
    if (!finalePhase) {
      phoenixRide.active = false
      phoenixRide.hidePlayer = false
      phoenixRide.phase = null
      phoenixRide.progress = 0
      startedRef.current = 0
      return
    }
    if (finalePhase === 'done') return

    if (!startedRef.current) startedRef.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - startedRef.current

    let phase = 'pickup'
    if (t >= FLY_END) phase = 'done'
    else if (t >= MOUNT_END) phase = 'fly'
    else if (t >= PICKUP_END) phase = 'mount'

    if (phase !== finalePhase && phase !== 'done') setFinalePhase(phase)
    if (phase === 'done') {
      phoenixRide.active = false
      finish()
      return
    }

    phoenixRide.active = true
    phoenixRide.phase = phase
    phoenixRide.landX = LAND.x
    phoenixRide.landY = LAND.y
    phoenixRide.landZ = LAND.z

    if (phase === 'pickup') {
      phoenixRide.hidePlayer = false
      phoenixRide.progress = Math.min(1, t / PICKUP_END)
      phoenixRide.x = TREASURE.x
      phoenixRide.y = TREASURE.y
      phoenixRide.z = TREASURE.z - 2.6
      phoenixRide.yaw = 0
    } else if (phase === 'mount') {
      const u = easeInOut(Math.min(1, (t - PICKUP_END) / (MOUNT_END - PICKUP_END)))
      phoenixRide.progress = u
      phoenixRide.hidePlayer = u > 0.82
      phoenixRide.x = LAND.x
      phoenixRide.y = LAND.y
      phoenixRide.z = LAND.z
      phoenixRide.yaw = Math.PI + 0.4
    } else if (phase === 'fly') {
      const u = Math.min(1, (t - MOUNT_END) / (FLY_END - MOUNT_END))
      const ease = easeOutCubic(u)
      phoenixRide.progress = u
      phoenixRide.hidePlayer = true
      const lift = ease * ease
      phoenixRide.x = LAND.x + Math.sin(ease * 2.2) * 28
      phoenixRide.y = LAND.y + 2 + lift * 130
      phoenixRide.z = LAND.z - ease * 110
      phoenixRide.yaw = Math.PI + 0.4 + ease * 1.2
    }
  })

  return null
}
