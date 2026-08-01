import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { SoftShadows } from '@react-three/drei'
import * as THREE from 'three'
import { playerPosition } from '../store/playerStore'
import { PHASES } from '../config/world'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'

const SUN_DIR = { x: 42, y: 58, z: 26 }

/**
 * Clima de cada trecho — paleta alpina suave (não “cartoon” saturado).
 */
const MOODS = {
  default: {
    fog: 0.00135,
    fogColor: new THREE.Color('#a8c0d4'),
    sun: 1.55,
    sunColor: new THREE.Color('#f0ebe0'),
    ambient: 0.28,
    hemi: 0.48,
  },
  night: {
    fog: 0.0085,
    fogColor: new THREE.Color('#0e1422'),
    sun: 0.28,
    sunColor: new THREE.Color('#6a7a9a'),
    ambient: 0.08,
    hemi: 0.14,
  },
  water: {
    fog: 0.0042,
    fogColor: new THREE.Color('#7a92a0'),
    sun: 1.15,
    sunColor: new THREE.Color('#d8e0e6'),
    ambient: 0.22,
    hemi: 0.38,
  },
  snow: {
    fog: 0.003,
    fogColor: new THREE.Color('#c0d0e0'),
    sun: 1.45,
    sunColor: new THREE.Color('#eef2f6'),
    ambient: 0.32,
    hemi: 0.52,
  },
  flower: {
    fog: 0.00125,
    fogColor: new THREE.Color('#b8c8b0'),
    sun: 1.65,
    sunColor: new THREE.Color('#f2e8d0'),
    ambient: 0.32,
    hemi: 0.55,
  },
}

function moodAt(z) {
  if (z <= PHASES.night.zTo + 4 && z >= PHASES.night.zFrom - 4) return MOODS.night
  if (z <= PHASES.water.zTo + 6 && z >= PHASES.water.zFrom - 6) return MOODS.water
  if (z <= PHASES.snow.zTo + 6 && z >= PHASES.snow.zFrom - 8) return MOODS.snow
  if (z <= PHASES.flower.zTo + 6 && z >= PHASES.flower.zFrom - 6) return MOODS.flower
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
    const k = Math.min(1, delta * 1.6)
    light.intensity += (mood.sun - light.intensity) * k
    light.color.lerp(mood.sunColor, k)
    if (ambientRef.current) {
      ambientRef.current.intensity += (mood.ambient - ambientRef.current.intensity) * k
    }
    if (hemiRef.current) {
      hemiRef.current.intensity += (mood.hemi - hemiRef.current.intensity) * k
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

      <hemisphereLight ref={hemiRef} args={['#b8cce0', '#5a6e52', 0.48]} />
      <ambientLight ref={ambientRef} intensity={0.28} color="#c8d8e4" />

      <object3D ref={targetRef} />
      <directionalLight
        ref={lightRef}
        castShadow={preset.shadows}
        intensity={1.55}
        color="#f0ebe0"
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

      <fogExp2 attach="fog" args={['#a8c0d4', 0.00135]} />
      <color attach="background" args={['#87a8c0']} />
    </>
  )
}
