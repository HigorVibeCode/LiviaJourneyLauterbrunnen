import { useMemo } from 'react'
import * as THREE from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import {
  GROUND_SEGMENTS,
  CLIFF_OFFSET,
  CLIFF_HEIGHT,
  CLIFF_STEP,
  SUMMIT_Y,
  SUMMIT_HALF_X,
  TREASURE_POS,
  PHASES,
  makeRng,
  pathXAt,
  pathYawAt,
} from '../../config/world'
import Instanced from './Instanced'

const GROUND_THICKNESS = 2
const GROUND_SLICE = 24
const PLATE_W = 20

/** Cada trecho do penhasco tem a cor do bioma que ele margeia */
const CLIFF_BANDS = [
  { zFrom: 16, zTo: 120, color: '#767a80', top: '#7f8f78' },
  { zFrom: -288, zTo: 16, color: '#6a7a58', top: '#5a8a4a' },
  { zFrom: -520, zTo: -288, color: '#2a3040', top: '#1a2030' },
  { zFrom: -656, zTo: -520, color: '#6a7870', top: '#5a7a58' },
  { zFrom: -780, zTo: -656, color: '#96a3ac', top: '#e0e8ee' },
  { zFrom: -916, zTo: -780, color: '#6a7a62', top: '#6a8a5e' },
  { zFrom: -1110, zTo: -916, color: '#8d9aa3', top: '#e8eef2' },
]

function bandAt(z) {
  return CLIFF_BANDS.find((b) => z >= b.zFrom && z <= b.zTo) ?? CLIFF_BANDS[0]
}

/**
 * Terreno: chão e penhascos seguem a S, com poucos colliders (performance).
 */
export default function Terrain() {
  const { plateItems, groundColliders } = useMemo(() => {
    const rng = makeRng(20260731)
    const plateItems = []
    const groundColliders = []

    GROUND_SEGMENTS.forEach((seg) => {
      const lat0 = seg.latCenter ?? 0
      const midZ = (seg.zFrom + seg.zTo) / 2
      const halfZ = (seg.zTo - seg.zFrom) / 2
      groundColliders.push({
        id: seg.id,
        x: pathXAt(midZ) + lat0,
        y: seg.y,
        z: midZ,
        halfX: seg.halfX + 8,
        halfZ: halfZ + 0.25,
      })

      for (let z0 = seg.zTo; z0 > seg.zFrom; z0 -= GROUND_SLICE) {
        const z1 = Math.max(seg.zFrom, z0 - GROUND_SLICE)
        const cz = (z0 + z1) / 2
        const sliceHalfZ = (z0 - z1) / 2 + 0.1
        const cx = pathXAt(cz) + lat0
        const cols = Math.max(1, Math.round((seg.halfX * 2) / PLATE_W))
        const pw = (seg.halfX * 2) / cols
        for (let c = 0; c < cols; c++) {
          const x = cx - seg.halfX + pw / 2 + c * pw
          let base = seg.color
          if (seg.biome === 'alpine') {
            base = rng() > 0.45 ? '#d8e3dc' : rng() > 0.4 ? '#8fae86' : '#a8c39c'
          } else if (seg.biome === 'meadow') {
            const r = rng()
            base = r > 0.66 ? '#6a8a62' : r > 0.33 ? '#5e7e58' : '#748e6a'
          } else if (seg.biome === 'water') {
            base = rng() > 0.5 ? '#5a7a58' : '#4e6e50'
          } else if (seg.biome === 'night') {
            base = rng() > 0.5 ? '#243028' : '#1e2a24'
          } else if (seg.biome === 'flower') {
            const r = rng()
            base = r > 0.6 ? '#6a8a5e' : r > 0.3 ? '#748e66' : '#5e7e56'
          } else if (seg.biome === 'pasture') {
            base = rng() > 0.5 ? '#6e8e66' : '#64865c'
          } else if (seg.biome === 'snow') {
            base = rng() > 0.5 ? '#e2ebf2' : '#d8e4ec'
          }
          plateItems.push({
            x,
            y: seg.y - 0.1,
            z: cz,
            sx: pw + 0.12,
            sy: 1,
            sz: sliceHalfZ * 2 + 0.18,
            color: shade(base, (rng() - 0.5) * (seg.biome === 'snow' ? 10 : 18)),
          })
        }
      }
    })

    return { plateItems, groundColliders }
  }, [])

  const plateGeo = useMemo(() => new THREE.BoxGeometry(1, 0.2, 1), [])
  const plateMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.95 }),
    [],
  )

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

      <Instanced geometry={plateGeo} material={plateMat} items={plateItems} castShadow={false} />

      <mesh position={[0, SUMMIT_Y - 8, TREASURE_POS.z]} receiveShadow>
        <boxGeometry args={[SUMMIT_HALF_X * 2.2, 16, 90]} />
        <meshStandardMaterial color="#8a9690" flatShading roughness={1} />
      </mesh>

      <Cliffs />
    </group>
  )
}

function Cliffs() {
  const { walls, tops, snow, colliders, ledges, strata } = useMemo(() => {
    const rng = makeRng(777)
    const walls = []
    const tops = []
    const snow = []
    const colliders = []
    const ledges = []
    const strata = []

    const zStart = PHASES.meadow.zTo + 8
    const zEnd = PHASES.summit.zFrom - 8
    for (let z = zStart; z > zEnd; z -= CLIFF_STEP) {
      const cz = z - CLIFF_STEP / 2
      const px = pathXAt(cz)
      const yaw = pathYawAt(cz) - Math.PI
      const band = bandAt(cz)
      const len = CLIFF_STEP + 2
      for (const side of [-1, 1]) {
        walls.push({
          x: px + side * CLIFF_OFFSET,
          y: CLIFF_HEIGHT / 2,
          z: cz,
          ry: yaw,
          sx: 8,
          sy: CLIFF_HEIGHT,
          sz: len,
          color: side < 0 ? band.color : shade(band.color, 8),
        })
        tops.push({
          x: px + side * (CLIFF_OFFSET + 1),
          y: CLIFF_HEIGHT + 0.8,
          z: cz,
          ry: yaw,
          sx: 11,
          sy: 1.6,
          sz: len,
          color: band.top,
        })
        if (band.top.startsWith('#e') || band.top.startsWith('#f')) {
          snow.push({
            x: px + side * (CLIFF_OFFSET + 1),
            y: CLIFF_HEIGHT + 1.9,
            z: cz,
            ry: yaw,
            sx: 10,
            sy: 0.7,
            sz: len * 0.98,
            color: '#eef4f9',
          })
        }
        colliders.push({
          x: px + side * CLIFF_OFFSET,
          y: CLIFF_HEIGHT / 2,
          z: cz,
          halfX: 4.5,
          halfY: CLIFF_HEIGHT / 2,
          halfZ: len / 2,
        })
      }
    }

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 20; i++) {
        const z = 112 - i * 40 - rng() * 10
        const band = bandAt(z)
        const px = pathXAt(z)
        ledges.push({
          x: px + side * (CLIFF_OFFSET - 5 - rng() * 1.2),
          y: 10 + rng() * 48,
          z,
          sx: 3 + rng() * 3.5,
          sy: 2 + rng() * 5,
          sz: 6 + rng() * 9,
          color: shade(band.color, (rng() - 0.5) * 22),
        })
      }
      for (let i = 0; i < 28; i++) {
        const z = 112 - rng() * (112 - PHASES.summit.zFrom)
        const band = bandAt(z)
        const px = pathXAt(z)
        const sx = 0.8 + rng() * 1
        strata.push({
          x: px + side * (CLIFF_OFFSET - 4 + sx / 2 - 0.45),
          y: 3 + rng() * (CLIFF_HEIGHT - 8),
          z,
          sx,
          sy: 0.9 + rng() * 2.2,
          sz: 8 + rng() * 14,
          color: shade(band.color, rng() > 0.5 ? 12 : -12),
        })
      }
    }

    return { walls, tops, snow, colliders, ledges, strata }
  }, [])

  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }),
    [],
  )

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((c, i) => (
          <CuboidCollider
            key={i}
            position={[c.x, c.y, c.z]}
            args={[c.halfX, c.halfY, c.halfZ]}
          />
        ))}
        <CuboidCollider position={[-SUMMIT_HALF_X - 4, SUMMIT_Y + 14, TREASURE_POS.z]} args={[4, 16, 50]} />
        <CuboidCollider position={[SUMMIT_HALF_X + 4, SUMMIT_Y + 14, TREASURE_POS.z]} args={[4, 16, 50]} />
      </RigidBody>

      <Instanced geometry={box} material={mat} items={walls} castShadow={false} receiveShadow />
      <Instanced geometry={box} material={mat} items={tops} castShadow={false} />
      <Instanced geometry={box} material={mat} items={snow} castShadow={false} receiveShadow={false} />
      <Instanced geometry={box} material={mat} items={ledges} castShadow={false} />
      <Instanced geometry={box} material={mat} items={strata} castShadow={false} />

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (SUMMIT_HALF_X + 4), SUMMIT_Y + 14, TREASURE_POS.z]}
          receiveShadow
        >
          <boxGeometry args={[8, 32, 100]} />
          <meshStandardMaterial color="#8d9aa3" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount))
  const b = Math.max(0, Math.min(255, (n & 255) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
