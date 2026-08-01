import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { PROP_HEIGHTS, PROP_COLLIDERS } from '../../config/adventureDecor'
import { groundHeightAt } from '../../config/world'
import { ADVENTURE_GLB } from '../../lib/preloadAssets'

const _box = new THREE.Box3()
const _center = new THREE.Vector3()
const cache = new Map()

function colorForProp(name) {
  const n = name.toLowerCase()
  if (/house|gate|bridge/.test(n)) return '#8a6a48'
  if (/pond|duck/.test(n)) return '#6a8a98'
  if (/tree|pine|maple|willow/.test(n)) return '#3d6b3a'
  if (/fence|rail/.test(n)) return '#5a3a22'
  return '#7a6a58'
}

function extractProp(scene, name, targetHeight) {
  const key = `${name}:${targetHeight}`
  if (cache.has(key)) return cache.get(key).clone(true)

  const src = scene.getObjectByName(name)
  if (!src) return null

  src.updateWorldMatrix(true, true)
  const clone = src.clone(true)
  clone.matrix.copy(src.matrixWorld)
  clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)
  clone.matrixAutoUpdate = true

  const pivot = new THREE.Group()
  pivot.add(clone)
  pivot.updateMatrixWorld(true)
  _box.setFromObject(pivot)
  _box.getCenter(_center)
  clone.position.x -= _center.x
  clone.position.z -= _center.z
  clone.position.y -= _box.min.y

  pivot.updateMatrixWorld(true)
  _box.setFromObject(pivot)
  const height = Math.max(_box.max.y - _box.min.y, 0.001)
  const s = targetHeight / height
  clone.position.multiplyScalar(s)
  clone.scale.multiplyScalar(s)
  pivot.updateMatrixWorld(true)
  _box.setFromObject(pivot)
  clone.position.y -= _box.min.y

  pivot.traverse((obj) => {
    if (!obj.isMesh) return
    obj.castShadow = false
    obj.receiveShadow = true
    obj.material = new THREE.MeshStandardMaterial({
      color: colorForProp(name),
      flatShading: true,
      roughness: 0.92,
    })
  })

  cache.set(key, pivot)
  return pivot.clone(true)
}

/**
 * Prop único do adventure pack — casas, ponte, lago, pato, portão visual.
 */
export default function PackProp({
  name,
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
  collider = true,
}) {
  const { scene } = useGLTF(ADVENTURE_GLB)
  const groupRef = useRef(null)
  const height = PROP_HEIGHTS[name] ?? 3
  const col = PROP_COLLIDERS[name]

  const visual = useMemo(() => extractProp(scene, name, height), [scene, name, height])

  const y =
    position[1] !== undefined && position[1] !== 0
      ? position[1]
      : groundHeightAt(position[0], position[2])

  if (!visual) return null

  return (
    <group ref={groupRef} position={[position[0], y, position[2]]} rotation={[0, rotation, 0]} scale={scale}>
      {collider && col && (
        <RigidBody type="fixed" colliders={false} friction={1.1}>
          <CuboidCollider
            position={[0, col.h * scale, 0]}
            args={[(col.r ?? 0.5) * scale, col.h * scale, (col.depth ?? col.r ?? 0.5) * scale]}
          />
        </RigidBody>
      )}
      <primitive object={visual} />
    </group>
  )
}

useGLTF.preload(ADVENTURE_GLB)
