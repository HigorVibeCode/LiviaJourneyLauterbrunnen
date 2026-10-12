import { useMemo, useRef } from 'react'
import { extend, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playerPosition } from '../store/playerStore'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'

/**
 * Luzes pontuais "virtuais".
 *
 * Cada `<pooledLight>` é só um marcador (Object3D) com cor/intensidade/alcance.
 * O <LightPool> mantém um punhado fixo de PointLights reais e, a cada frame,
 * coloca-as nos marcadores mais importantes perto da Livia.
 *
 * Antes eram ~40 PointLights reais: todo pixel de todo material calculava as
 * 40 — o maior custo de GPU do jogo em tablets/notebooks. Como o número de
 * luzes reais nunca muda, nenhum shader recompila quando algo acende/apaga.
 */
const registry = new Set()

export class VirtualPointLight extends THREE.Object3D {
  constructor() {
    super()
    this.isVirtualPointLight = true
    this.color = new THREE.Color('#ffffff')
    this.intensity = 1
    this.distance = 10
    this.decay = 2
    registry.add(this)
    this.addEventListener('removed', () => registry.delete(this))
    this.addEventListener('added', () => registry.add(this))
  }
}

extend({ PooledLight: VirtualPointLight })

const MAX_LIGHTS = 8
const byScore = (a, b) => b.score - a.score
const tmp = new THREE.Vector3()

function effectivelyVisible(obj) {
  let o = obj
  while (o) {
    if (!o.visible) return false
    o = o.parent
  }
  return true
}

export default function LightPool() {
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium
  const active = preset.lights
  const refs = useRef([])
  const slots = useMemo(() => Array.from({ length: MAX_LIGHTS }, (_, i) => i), [])
  const picked = useMemo(() => [], [])
  // candidatos pré-alocados: nada de objeto novo por luz por frame
  const pool = useMemo(() => Array.from({ length: 96 }, () => ({ v: null, x: 0, y: 0, z: 0, score: 0 })), [])

  useFrame(() => {
    picked.length = 0
    let n = 0
    for (const v of registry) {
      if (v.intensity <= 0.02 || !v.parent) continue
      if (!effectivelyVisible(v)) continue
      v.getWorldPosition(tmp)
      const dx = tmp.x - playerPosition.x
      const dy = tmp.y - playerPosition.y
      const dz = tmp.z - playerPosition.z
      const d2 = dx * dx + dy * dy + dz * dz
      const reach = v.distance + 30
      if (d2 > reach * reach) continue
      if (n >= pool.length) break
      const c = pool[n++]
      c.v = v
      c.x = tmp.x
      c.y = tmp.y
      c.z = tmp.z
      c.score = v.intensity / (1 + d2 * 0.01)
      picked.push(c)
    }
    picked.sort(byScore)

    for (let i = 0; i < slots.length; i++) {
      const light = refs.current[i]
      if (!light) continue
      const p = i < active ? picked[i] : null
      if (!p) {
        light.intensity = 0
        continue
      }
      light.position.set(p.x, p.y, p.z)
      light.color.copy(p.v.color)
      light.intensity = p.v.intensity
      light.distance = p.v.distance
      light.decay = p.v.decay
    }
  })

  // sempre as mesmas N luzes montadas → hash de luzes estável, zero recompilação
  return slots.slice(0, Math.max(1, active)).map((i) => (
    <pointLight
      key={i}
      ref={(el) => {
        refs.current[i] = el
      }}
      intensity={0}
    />
  ))
}
