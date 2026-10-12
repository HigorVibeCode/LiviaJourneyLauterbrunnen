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
// Estilo fofo: muita luz do céu (hemisférica) para nada ficar escuro,
// sol quente, céu azul-piscina. Cada região muda o "clima" de leve.
const mood = (o) => ({
  sun: 1.9,
  sunColor: c('#fff4dc'),
  ambient: 0.55,
  hemi: 1.15,
  fogFar: 1,
  fogNear: 0.45,
  stars: 0,
  farTint: c('#ffffff'),
  ...o,
})
const MOODS = {
  meadow: mood({ top: c('#4fb2f2'), horizon: c('#d4f1ff'), hemiSky: c('#d9f1ff'), hemiGround: c('#9ad86e') }),
  pasture: mood({ top: c('#55b8f4'), horizon: c('#ddf4ff'), hemiSky: c('#e0f3ff'), hemiGround: c('#b4dc6c') }),
  night: mood({
    // noite de pijama: azul aconchegante, lua forte, nada assustador
    top: c('#1b2f6e'),
    horizon: c('#5a74c0'),
    sun: 1.25,
    sunColor: c('#c8d6ff'),
    ambient: 0.62,
    hemiSky: c('#8aa2ee'),
    hemiGround: c('#3d6a78'),
    hemi: 1.0,
    fogFar: 0.8,
    fogNear: 0.25,
    stars: 1,
    farTint: c('#7a90d4'),
  }),
  water: mood({ top: c('#45b0f0'), horizon: c('#d0f2ff'), hemiSky: c('#d4f2ff'), hemiGround: c('#7ccc8a') }),
  snow: mood({
    top: c('#6ab8f2'),
    horizon: c('#eef8ff'),
    sunColor: c('#ffffff'),
    hemiSky: c('#f0f8ff'),
    hemiGround: c('#c8dcf0'),
    ambient: 0.6,
  }),
  flower: mood({ top: c('#5fb6f4'), horizon: c('#ffe8f4'), hemiSky: c('#ffeef8'), hemiGround: c('#a8dc78') }),
  summit: mood({
    // fim de tarde de algodão-doce
    top: c('#6aa8f0'),
    horizon: c('#ffe2c4'),
    sunColor: c('#ffe2b8'),
    hemiSky: c('#fff0e0'),
    hemiGround: c('#c0d8a8'),
    fogFar: 1.25,
    farTint: c('#fff2e6'),
  }),
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
      <hemisphereLight ref={hemiRef} args={['#d9f1ff', '#9ad86e', 1.15]} />
      <ambientLight ref={ambientRef} intensity={0.55} color="#d9f1ff" />

      <object3D ref={targetRef} />
      <directionalLight
        ref={lightRef}
        castShadow={preset.shadows}
        intensity={1.9}
        color="#fff4dc"
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
      <directionalLight position={[-30, 26, -18]} intensity={0.3} color="#ffd8f0" />
    </>
  )
}
