import { useEffect } from 'react'
import { resumeAudio, setMuted, audioRunning } from '../audio/engine'
import { setAmbientTargets } from '../audio/ambient'
import {
  sfxPickup,
  sfxGate,
  sfxTreasure,
  sfxChirp,
  sfxThunder,
  sfxRespawn,
  sfxOwl,
  sfxWolfHowl,
  sfxDistantBell,
} from '../audio/sfx'
import { useProgressStore } from '../store/progressStore'
import { usePlayerStore, playerPosition } from '../store/playerStore'
import { useGameStore } from '../store/gameStore'
import { PHASES } from '../config/world'

const TICK_MS = 500

/**
 * Rege todo o som do jogo:
 *  - destrava o AudioContext no primeiro gesto (exigência dos navegadores)
 *  - toca os jingles de conquista (item, portão, tesouro, respawn)
 *  - ajusta o ambiente (vento/chuva/água) conforme a fase, com pássaros
 *    na pradaria e trovões ocasionais no Vale das Águas
 */
export default function AudioDirector() {
  const audio = useGameStore((s) => s.audio)

  // Mobile/iOS: só destrava com gesto; mantém listeners até running
  useEffect(() => {
    let done = false
    const unlock = () => {
      if (done) return
      void resumeAudio().then((ok) => {
        if (!ok) return
        done = true
        window.removeEventListener('pointerdown', unlock, true)
        window.removeEventListener('touchstart', unlock, true)
        window.removeEventListener('keydown', unlock, true)
      })
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('touchstart', unlock, true)
    window.addEventListener('keydown', unlock, true)

    // iOS suspende o contexto ao mandar o separador para segundo plano
    const onVis = () => {
      if (document.visibilityState === 'visible') void resumeAudio()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('touchstart', unlock, true)
      window.removeEventListener('keydown', unlock, true)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    setMuted(!audio)
  }, [audio])

  // conquistas
  useEffect(
    () =>
      useProgressStore.subscribe((state, prev) => {
        if (state.lastPickupAt !== prev.lastPickupAt) sfxPickup()
        if (state.unlockedGates.length > prev.unlockedGates.length) sfxGate()
        if (state.finalePhase === 'pickup' && prev.finalePhase !== 'pickup') sfxTreasure()
      }),
    [],
  )

  useEffect(
    () =>
      usePlayerStore.subscribe((state, prev) => {
        if (state.respawns > prev.respawns) sfxRespawn()
      }),
    [],
  )

  // ambiente por fase
  useEffect(() => {
    const id = setInterval(() => {
      if (!audioRunning()) return

      const { paused, audio: enabled } = useGameStore.getState()
      if (paused || !enabled) {
        setAmbientTargets({ wind: 0, rain: 0, water: 0, tension: 0 })
        return
      }

      const z = playerPosition.z
      const inNight = z <= PHASES.night.zTo + 4 && z >= PHASES.night.zFrom - 4
      const inWater = z <= PHASES.water.zTo + 6 && z >= PHASES.water.zFrom - 6
      const inSnow = z <= PHASES.snow.zTo + 6 && z >= PHASES.snow.zFrom - 8
      const inFlower = z <= PHASES.flower.zTo + 6 && z >= PHASES.flower.zFrom - 6
      const inPasture = z <= PHASES.pasture.zTo + 6 && z >= PHASES.pasture.zFrom - 6
      const inMeadow = z <= PHASES.meadow.zTo + 6 && z >= PHASES.meadow.zFrom - 6
      const inSummit = z <= PHASES.summit.zTo && z >= PHASES.summit.zFrom
      const gateOpen = useProgressStore.getState().unlockedGates.includes('gate_summit')
      const tensionOn =
        (inSummit && gateOpen && !useProgressStore.getState().finished) || inNight

      setAmbientTargets({
        wind: inSummit ? 0.12 : inSnow ? 0.075 : inNight ? 0.055 : inPasture ? 0.04 : 0.032,
        rain: inWater ? 0.085 : 0,
        water: inWater ? 0.08 : inNight ? 0.012 : 0,
        tension: tensionOn ? (inNight ? 0.06 : 0.085) : 0,
      })

      if (inMeadow && Math.random() < 0.025) sfxDistantBell()
      if (!inSnow && !inSummit && !inNight && Math.random() < (inFlower ? 0.2 : inPasture ? 0.12 : inMeadow ? 0.15 : inWater ? 0.045 : 0.13)) {
        sfxChirp()
      }
      if (inWater && Math.random() < 0.013) sfxThunder()
      // vale noturno: corujas e uivos ocasionais
      if (inNight) {
        if (Math.random() < 0.07) sfxOwl()
        if (Math.random() < 0.028) sfxWolfHowl()
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  return null
}
