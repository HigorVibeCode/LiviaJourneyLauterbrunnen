import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'

/**
 * Culling por distância para o vale inteiro.
 *
 * O mundo tem ~1100 m e quase tudo fica montado o tempo todo; sem isto a
 * câmera desenhava milhares de objetos escondidos na névoa (≈4000 draw calls).
 *
 * Em vez de `visible` (que vários componentes já controlam por conta própria)
 * usamos a máscara de `layers`: o renderer pula o objeto mas continua a
 * percorrer os filhos, então não há conflito nenhum.
 *
 * Opt-out: `userData.noCull = true` num objeto vale para toda a sub-árvore.
 */
const HIDDEN_MASK = 1 << 30
const UPDATE_EVERY = 4
const sphere = new THREE.Sphere()
/** máscara original de cada objeto escondido (fora do userData, que o R3F troca a cada render) */
const savedMask = new WeakMap()

export default function DistanceCuller() {
  const frame = useRef(0)
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium

  useFrame((state) => {
    if (import.meta.env.DEV) window.__scene = state.scene
    frame.current += 1
    if (frame.current % UPDATE_EVERY !== 0) return
    const cam = state.camera.position
    // acompanha a neblina: na noite (neblina curta) desenha menos; no mirante, mais
    const maxDist = state.scene.fog?.far ? state.scene.fog.far + 12 : preset.drawDistance

    const visit = (obj) => {
      if (obj.userData.noCull) return
      if (obj.isMesh || obj.isPoints || obj.isLine) cull(obj, cam, maxDist)
      const ch = obj.children
      for (let i = 0; i < ch.length; i++) visit(ch[i])
    }
    visit(state.scene)
  })

  return null
}

function cull(obj, cam, maxDist) {
  if (obj.isSkinnedMesh || obj.frustumCulled === false) return
  let bs
  if (obj.isInstancedMesh) {
    if (!obj.boundingSphere) obj.computeBoundingSphere()
    bs = obj.boundingSphere
  } else {
    const geo = obj.geometry
    if (!geo) return
    if (!geo.boundingSphere) geo.computeBoundingSphere()
    bs = geo.boundingSphere
  }
  if (!bs || !Number.isFinite(bs.radius)) return

  sphere.copy(bs).applyMatrix4(obj.matrixWorld)
  const limit = obj.userData.cullDist ? Math.min(obj.userData.cullDist, maxDist) : maxDist
  const far = sphere.center.distanceTo(cam) - sphere.radius > limit

  if (far) {
    if (!savedMask.has(obj)) {
      savedMask.set(obj, obj.layers.mask === HIDDEN_MASK ? 1 : obj.layers.mask)
      obj.layers.mask = HIDDEN_MASK
    }
  } else if (savedMask.has(obj)) {
    obj.layers.mask = savedMask.get(obj)
    savedMask.delete(obj)
  } else if (obj.layers.mask === HIDDEN_MASK) {
    obj.layers.mask = 1
  }
}
