import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { SoftShadows } from '@react-three/drei'
import * as THREE from 'three'
import { playerPosition } from '../store/playerStore'
import { PHASES } from '../config/world'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'
import { useProgressStore } from '../store/progressStore'

const SUN_DIR = { x: 42, y: 58, z: 26 }

/**
 * Clima de cada trecho — paleta alpina suave (não “cartoon” saturado).
 */
const MOODS = {
  default: {
    fog: 0.00095,
    fogColor: new THREE.Color('#7eb0d8'),
    sun: 1.85,
    sunColor: new THREE.Color('#ffe8c8'),
    ambient: 0.22,
    hemi: 0.38,
  },
  night: {
    fog: 0.0032,
    fogColor: new THREE.Color('#243048'),
    sun: 0.72,
    sunColor: new THREE.Color('#8a9ab8'),
    ambient: 0.20,
    hemi: 0.32,
  },
  water: {
    fog: 0.0032,
    fogColor: new THREE.Color('#6a98b0'),
    sun: 1.35,
    sunColor: new THREE.Color('#ffe0b8'),
    ambient: 0.18,
    hemi: 0.32,
  },
  snow: {
    fog: 0.0024,
    fogColor: new THREE.Color('#b0c8e0'),
    sun: 1.65,
    sunColor: new THREE.Color('#f8f4ec'),
    ambient: 0.26,
    hemi: 0.42,
  },
  flower: {
    fog: 0.00088,
    fogColor: new THREE.Color('#98c898'),
    sun: 1.9,
    sunColor: new THREE.Color('#ffe8b0'),
    ambient: 0.24,
    hemi: 0.42,
  },
  pasture: {
    fog: 0.00092,
    fogColor: new THREE.Color('#88b898'),
    sun: 1.82,
    sunColor: new THREE.Color('#ffe8c0'),
    ambient: 0.24,
    hemi: 0.42,
  },
}

function moodAt(z) {
  if (z <= PHASES.night.zTo + 4 && z >= PHASES.night.zFrom - 4) return MOODS.night
  if (z <= PHASES.water.zTo + 6 && z >= PHASES.water.zFrom - 6) return MOODS.water
  if (z <= PHASES.snow.zTo + 6 && z >= PHASES.snow.zFrom - 8) return MOODS.snow
  if (z <= PHASES.flower.zTo + 6 && z >= PHASES.flower.zFrom - 6) return MOODS.flower
  if (z <= PHASES.pasture.zTo + 6 && z >= PHASES.pasture.zFrom - 6) return MOODS.pasture
  return MOODS.default
}

/**
 * Iluminação alpina.
 * Sem Sky do drei (em vários contextos GL ele “lava” / impede o draw).
 * Céu = clearColor + fog.
 */
export default function Lighting() {
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium
  const lightRef = useRef(null)
  const targetRef = useRef(null)
  const ambientRef = useRef(null)
  const hemiRef = useRef(null)
  const shadowTick = useRef(0)

  useFrame((state, delta) => {
    const light = lightRef.current
    const target = targetRef.current
    if (!light || !target) return

    const p = playerPosition
    const gx = Math.round(p.x)
    const gz = Math.round(p.z)
    target.position.set(gx, p.y, gz)
    target.updateMatrixWorld()
    light.target = target
    light.position.set(gx + SUN_DIR.x, p.y + SUN_DIR.y, gz + SUN_DIR.z)

    if (light.shadow && preset.shadows) {
      light.shadow.autoUpdate = false
      shadowTick.current += 1
      if (preset.id === 'high' || shadowTick.current % 2 === 0) {
        light.shadow.needsUpdate = true
      }
    }

    const mood = moodAt(p.z)
    const inNight =
      p.z <= PHASES.night.zTo + 4 && p.z >= PHASES.night.zFrom - 4
    const lanternBoost =
      inNight && useProgressStore.getState().hasLantern ? 0.10 : 0
    const targetAmbient = mood.ambient + lanternBoost
    const targetHemi = mood.hemi + lanternBoost * 0.5
    const k = Math.min(1, delta * 1.6)
    light.intensity += (mood.sun - light.intensity) * k
    light.color.lerp(mood.sunColor, k)
    if (ambientRef.current) {
      ambientRef.current.intensity += (targetAmbient - ambientRef.current.intensity) * k
    }
    if (hemiRef.current) {
      hemiRef.current.intensity += (targetHemi - hemiRef.current.intensity) * k
    }
    if (state.scene.fog) {
      const nextDensity = mood.fog
      if (Number.isFinite(nextDensity)) {
        state.scene.fog.density += (nextDensity - state.scene.fog.density) * k
        if (!Number.isFinite(state.scene.fog.density)) state.scene.fog.density = nextDensity
      }
      state.scene.fog.color.lerp(mood.fogColor, k)
      if (state.scene.background?.isColor) state.scene.background.lerp(mood.fogColor, k * 0.55)
    }
  })

  return (
    <>
      {preset.softShadows && <SoftShadows size={22} samples={8} focus={0.6} />}

      <hemisphereLight ref={hemiRef} args={['#88b8e8', '#4a7a42', 0.38]} />
      <ambientLight ref={ambientRef} intensity={0.22} color="#b8d0e8" />

      <object3D ref={targetRef} />
      <directionalLight
        ref={lightRef}
        castShadow={preset.shadows}
        intensity={1.85}
        color="#ffe8c8"
        shadow-mapSize-width={preset.shadowMapSize}
        shadow-mapSize-height={preset.shadowMapSize}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />

      <directionalLight position={[-30, 26, -18]} intensity={0.32} color="#9ab0c4" />

      <fogExp2 attach="fog" args={['#7eb0d8', 0.00095]} />
      <color attach="background" args={['#5a9ec8']} />
    </>
  )
}
