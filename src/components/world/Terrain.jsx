import { useMemo } from 'react'
import * as THREE from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import {
  GROUND_SEGMENTS,
  SUMMIT_Y,
  SUMMIT_HALF_X,
  TREASURE_POS,
  pathXAt,
  isSummitBuiltArea,
} from '../../config/world'
import { buildGroundChunks, buildPath, buildCliffs } from './terrainMesh'

const GROUND_THICKNESS = 2
const GROUND_SLICE = 24

/**
 * Terreno estilo fofo: chão de grama contínuo, trilha de terra e falésias em
 * degraus (terrainMesh.js). Colliders do chão continuam em fatias planas.
 */
export default function Terrain() {
  const groundColliders = useMemo(() => {
    const list = []
    GROUND_SEGMENTS.forEach((seg) => {
      const lat0 = seg.latCenter ?? 0
      for (let z0 = seg.zTo; z0 > seg.zFrom; z0 -= GROUND_SLICE) {
        const z1 = Math.max(seg.zFrom, z0 - GROUND_SLICE)
        const cz = (z0 + z1) / 2
        const sliceHalfZ = (z0 - z1) / 2 + 0.1
        const cx = seg.followPath === false ? seg.xCenter : pathXAt(cz) + lat0
        if (seg.y === SUMMIT_Y && isSummitBuiltArea(cx, cz)) continue
        list.push({
          id: `${seg.id}-${cz.toFixed(1)}`,
          x: cx,
          y: seg.y,
          z: cz,
          halfX: seg.halfX + 2,
          halfZ: sliceHalfZ + 0.2,
        })
      }
    })
    return list
  }, [])

  const ground = useMemo(() => buildGroundChunks(), [])
  const path = useMemo(() => buildPath(), [])
  const groundMat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true })
    return m
  }, [])
  const pathMat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true })
    // fica por cima do chão sem z-fighting
    m.polygonOffset = true
    m.polygonOffsetFactor = -2
    m.polygonOffsetUnits = -2
    return m
  }, [])

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={1.5}>
        {groundColliders.map((c) => (
          <CuboidCollider
            key={c.id}
            position={[c.x, c.y - GROUND_THICKNESS / 2, c.z]}
            args={[c.halfX, GROUND_THICKNESS / 2, c.halfZ]}
          />
        ))}
      </RigidBody>

      {ground.map((c) => (
        <mesh key={c.key} geometry={c.geometry} material={groundMat} />
      ))}
      {path.map((c) => (
        <mesh key={c.key} geometry={c.geometry} material={pathMat} renderOrder={1} />
      ))}

      <Cliffs />
    </group>
  )
}

function Cliffs() {
  const { chunks, colliders } = useMemo(() => buildCliffs(), [])
  const mat = useMemo(
    () => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    [],
  )

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((c, i) => (
          <CuboidCollider
            key={i}
            position={[c.x, c.y, c.z]}
            rotation={[0, c.ry, 0]}
            args={[c.halfX, c.halfY, c.halfZ]}
          />
        ))}
        <CuboidCollider position={[-SUMMIT_HALF_X - 4, SUMMIT_Y + 14, TREASURE_POS.z]} args={[4, 16, 50]} />
        <CuboidCollider position={[SUMMIT_HALF_X + 4, SUMMIT_Y + 14, TREASURE_POS.z]} args={[4, 16, 50]} />
        {/* pontas do mapa: atrás da casa e no fim do mirante não há mais chão */}
        <CuboidCollider position={[0, 10, 120.5]} args={[70, 20, 1]} />
        <CuboidCollider position={[0, SUMMIT_Y + 10, -1115]} args={[70, 20, 1]} />
      </RigidBody>
      {chunks.map((c) => (
        <mesh key={c.key} geometry={c.geometry} material={mat} />
      ))}
    </group>
  )
}
