import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playerPosition } from '../store/playerStore'
import { PHASES } from '../config/world'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'
import { useProgressStore } from '../store/progressStore'
import { skyState } from '../lib/skyState'

const SUN_DIR = { x: 42, y: 58, z: 26 }

/**
 * Clima de cada trecho do vale. Cada bioma tem céu, sol, luz ambiente e
 * neblina próprios; tudo é interpolado suavemente ao atravessar.
 *
 * fogFar é uma fração do alcance de visão do preset — a neblina sempre
 * "come" o mundo antes do DistanceCuller esconder os objetos (sem pop-in).
 */
const c = (hex) => new THREE.Color(hex)
const MOODS = {
  meadow: {
    top: c('#3a8ee6'),
    horizon: c('#c4e6ff'),
    sun: 2.35,
    sunColor: c('#fff1d0'),
    ambient: 0.42,
    hemiSky: c('#cfe8ff'),
    hemiGround: c('#6f9a52'),
    hemi: 0.75,
    fogFar: 1,
    fogNear: 0.32,
    stars: 0,
    farTint: c('#ffffff'),
  },
  pasture: {
    top: c('#4392e6'),
    horizon: c('#d2ecff'),
    sun: 2.4,
    sunColor: c('#fff0c8'),
    ambient: 0.42,
    hemiSky: c('#d6ecff'),
    hemiGround: c('#79a24e'),
    hemi: 0.75,
    fogFar: 1,
    fogNear: 0.35,
    stars: 0,
    farTint: c('#ffffff'),
  },
  night: {
    // noite de conto de fadas: azul profundo, lua forte — dá para ver o caminho
    top: c('#070c2a'),
    horizon: c('#2b3f78'),
    sun: 1.05,
    sunColor: c('#b9ccff'),
    ambient: 0.4,
    hemiSky: c('#6a86d8'),
    hemiGround: c('#1e2a3e'),
    hemi: 0.65,
    fogFar: 0.72,
    fogNear: 0.12,
    stars: 1,
    farTint: c('#4a5d92'),
  },
  water: {
    top: c('#4a8ed6'),
    horizon: c('#c6dfea'),
    sun: 1.9,
    sunColor: c('#ffeccc'),
    ambient: 0.42,
    hemiSky: c('#cfe6f2'),
    hemiGround: c('#4f7f58'),
    hemi: 0.72,
    fogFar: 0.85,
    fogNear: 0.22,
    stars: 0,
    farTint: c('#e4eef4'),
  },
  snow: {
    top: c('#5ea2ea'),
    horizon: c('#eaf4ff'),
    sun: 2.05,
    sunColor: c('#ffffff'),
    ambient: 0.48,
    hemiSky: c('#eaf4ff'),
    hemiGround: c('#a8bccc'),
    hemi: 0.8,
    fogFar: 0.85,
    fogNear: 0.2,
    stars: 0,
    farTint: c('#ffffff'),
  },
  flower: {
    top: c('#4f8fe6'),
    horizon: c('#ffe6ef'),
    sun: 2.4,
    sunColor: c('#ffe6b8'),
    ambient: 0.44,
    hemiSky: c('#ffe8f0'),
    hemiGround: c('#7aa64e'),
    hemi: 0.75,
    fogFar: 1,
    fogNear: 0.35,
    stars: 0,
    farTint: c('#fff2f6'),
  },
  summit: {
    // fim de tarde dourado no mirante
    top: c('#2e6fd0'),
    horizon: c('#ffe0b0'),
    sun: 2.5,
    sunColor: c('#ffd59a'),
    ambient: 0.44,
    hemiSky: c('#ffe8c8'),
    hemiGround: c('#8a9a80'),
    hemi: 0.75,
    fogFar: 1.25,
    fogNear: 0.4,
    stars: 0,
    farTint: c('#fff0dc'),
  },
}

function moodAt(z) {
  for (const id of ['night', 'water', 'snow', 'flower', 'pasture', 'summit', 'meadow']) {
    const p = PHASES[id]
    if (z <= p.zTo + 6 && z >= p.zFrom - 6) return MOODS[id]
  }
  return MOODS.meadow
}

export default function Lighting() {
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium
  const lightRef = useRef(null)
  const targetRef = useRef(null)
  const ambientRef = useRef(null)
  const hemiRef = useRef(null)
  const shadowTick = useRef(0)
  const fog = useMemo(() => new THREE.Fog('#c4e6ff', 60, 170), [])

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
      if (preset.id === 'high' || shadowTick.current % 2 === 0) light.shadow.needsUpdate = true
    }

    const mood = moodAt(p.z)
    const inNight = mood === MOODS.night
    const lantern = inNight && useProgressStore.getState().hasLantern ? 1 : 0
    // a primeira vez: pula direto para o clima certo (sem "amanhecer" no load)
    const k = state.scene.fog ? Math.min(1, delta * 1.4) : 1

    light.intensity += (mood.sun - light.intensity) * k
    light.color.lerp(mood.sunColor, k)
    if (ambientRef.current) {
      const target = mood.ambient + lantern * 0.18
      ambientRef.current.intensity += (target - ambientRef.current.intensity) * k
      ambientRef.current.color.lerp(mood.hemiSky, k)
    }
    if (hemiRef.current) {
      const target = mood.hemi + lantern * 0.12
      hemiRef.current.intensity += (target - hemiRef.current.intensity) * k
      hemiRef.current.color.lerp(mood.hemiSky, k)
      hemiRef.current.groundColor.lerp(mood.hemiGround, k)
    }

    skyState.top.lerp(mood.top, k)
    skyState.horizon.lerp(mood.horizon, k)
    skyState.sunColor.lerp(mood.sunColor, k)
    skyState.farTint.lerp(mood.farTint, k)
    skyState.stars += (mood.stars - skyState.stars) * k

    if (!state.scene.fog) state.scene.fog = fog
    // o DistanceCuller esconde tudo um pouco além de fog.far (sem pop-in visível)
    // voo da fênix: lá de cima a vista do vale inteiro precisa aparecer
    const flying = useProgressStore.getState().finalePhase === 'fly'
    const far = preset.drawDistance * mood.fogFar * (lantern ? 1.15 : 1) * (flying ? 2.4 : 1)
    const near = far * mood.fogNear
    fog.far += (far - fog.far) * k
    fog.near += (near - fog.near) * k
    fog.color.copy(skyState.horizon)
  })

  return (
    <>
      <hemisphereLight ref={hemiRef} args={['#cfe8ff', '#6f9a52', 0.75]} />
      <ambientLight ref={ambientRef} intensity={0.42} color="#cfe8ff" />

      <object3D ref={targetRef} />
      <directionalLight
        ref={lightRef}
        castShadow={preset.shadows}
        intensity={2.35}
        color="#fff1d0"
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
      {/* luz de preenchimento fria do lado oposto — volume nos personagens */}
      <directionalLight position={[-30, 26, -18]} intensity={0.35} color="#9fc0e0" />
    </>
  )
}
