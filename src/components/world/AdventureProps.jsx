import { forwardRef, useMemo, useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import {
  PROP_HEIGHTS,
  PROP_COLLIDERS,
  buildAdventurePlacements,
} from '../../config/adventureDecor'
import { QUALITY_PRESETS, useGameStore } from '../../store/gameStore'
import { ChunkedInstanced } from './Instanced'
import { CAMERA_OCCLUDER_COLLISION, CAMERA_OCCLUDER_SOLVER } from '../../physics/groups'
import { playerPosition } from '../../store/playerStore'
import { filterAdventurePlacements } from '../../utils/lodBands'
import { makeToonMaterial } from '../../materials/toonMaterial'

const MODEL_URL = '/models/adventure_pack.glb'

const _box = new THREE.Box3()
const _center = new THREE.Vector3()

/** Paleta alpina flat — as texturas do pack destuam do resto do mapa */
const PACK_COLORS = {
  tree: '#3d6b3a',
  pine: '#2f5234',
  maple: '#5a7a3a',
  willow: '#4a6e3e',
  dead: '#6a5a48',
  bush: '#3f6a38',
  flower: '#e8a0b4',
  snowdrop: '#f0f4f8',
  rock: '#8a8e94',
  trunk: '#5c3a1e',
  wood: '#6b4a2c',
  barrel: '#7a5230',
  box: '#8a6a3a',
  fence: '#5a3a22',
  lantern: '#4a3420',
  flame: '#ffb040',
  tent: '#c45a3a',
  mushroom: '#c07050',
  reed: '#6a7a3a',
  default: '#7a6a58',
}

function colorForProp(name) {
  const n = name.toLowerCase()
  if (/pine/.test(n)) return PACK_COLORS.pine
  if (/maple/.test(n)) return PACK_COLORS.maple
  if (/willow/.test(n)) return PACK_COLORS.willow
  if (/dead|stump/.test(n)) return PACK_COLORS.dead
  if (/tree/.test(n)) return PACK_COLORS.tree
  if (/bush|shrub|fern/.test(n)) return PACK_COLORS.bush
  if (/snowdrop/.test(n)) return PACK_COLORS.snowdrop
  if (/flower|bloom|petal/.test(n)) return PACK_COLORS.flower
  if (/rock|stone|boulder/.test(n)) return PACK_COLORS.rock
  if (/trunk|log/.test(n)) return PACK_COLORS.trunk
  if (/barrel/.test(n)) return PACK_COLORS.barrel
  if (/box|crate|chest/.test(n)) return PACK_COLORS.box
  if (/fence|rail/.test(n)) return PACK_COLORS.fence
  if (/lantern|lamp|torch/.test(n)) return PACK_COLORS.lantern
  if (/fire|flame/.test(n)) return PACK_COLORS.flame
  if (/tent|camp/.test(n)) return PACK_COLORS.tent
  if (/mushroom/.test(n)) return PACK_COLORS.mushroom
  if (/reed|grass/.test(n)) return PACK_COLORS.reed
  if (/table|bench|well|axe|chair/.test(n)) return PACK_COLORS.wood
  return PACK_COLORS.default
}

function tintMeshMaterial(mesh, propName) {
  const base = colorForProp(propName)
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const tinted = mats.map((m, i) => {
    // multi-material: tronco/folhas — segunda malha tende a ser folhagem
    let color = base
    const n = (mesh.name || '').toLowerCase()
    if (/leaf|foliage|crown|needles/.test(n)) color = PACK_COLORS.tree
    else if (/trunk|bark|stem|wood/.test(n)) color = PACK_COLORS.trunk
    else if (/petal|flower/.test(n)) color = PACK_COLORS.flower
    else if (i > 0 && /tree|maple|pine|willow|bush/i.test(propName)) color = PACK_COLORS.pine

    const c = makeToonMaterial({
      color,
      emissive: /flame|fire/i.test(propName) ? '#ff8020' : '#000000',
      emissiveIntensity: /flame|fire/i.test(propName) ? 1.2 : 0,
    })
    return c
  })
  mesh.material = Array.isArray(mesh.material) ? tinted : tinted[0]
}

/**
 * Extrai um nó nomeado do pack, preserva a orientação world do kitbash
 * Sketchfab/FBX, e normaliza para origem com pés no chão e altura-alvo.
 */
function extractNormalized(scene, name, targetHeight) {
  const src = scene.getObjectByName(name)
  if (!src) return null

  src.updateWorldMatrix(true, true)
  const clone = src.clone(true)
  clone.matrix.copy(src.matrixWorld)
  clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)
  clone.matrixAutoUpdate = true

  const pivot = new THREE.Group()
  pivot.name = `pack:${name}`
  pivot.add(clone)

  // Centrar no XZ e assentar os pés em y=0 no filho — o pivot fica na
  // origem para o R3F poder setar position/scale sem perder o offset.
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
  pivot.position.set(0, 0, 0)
  pivot.scale.set(1, 1, 1)

  pivot.traverse((obj) => {
    if (!obj.isMesh) return
    // só árvores/heróis grandes projetam sombra — scatter não recebe sombra
    obj.castShadow = false
    obj.receiveShadow = false
    if (obj.geometry) obj.geometry.computeVertexNormals()
    if (obj.material) tintMeshMaterial(obj, name)
  })

  return pivot
}

/** Achata o template num único geometry+material (props de 1 mesh). */
function bakeForInstancing(pivot) {
  const meshes = []
  pivot.updateMatrixWorld(true)
  pivot.traverse((obj) => {
    if (obj.isMesh) meshes.push(obj)
  })
  if (meshes.length !== 1) return null

  const mesh = meshes[0]
  const geometry = mesh.geometry.clone()
  geometry.applyMatrix4(mesh.matrixWorld)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return {
    geometry,
    material: Array.isArray(mesh.material) ? mesh.material[0] : mesh.material,
  }
}

function buildPropBatch(library, placements) {
  const byProp = new Map()
  for (const p of placements) {
    if (!library[p.prop]) continue
    if (!byProp.has(p.prop)) byProp.set(p.prop, [])
    byProp.get(p.prop).push(p)
  }

  const instanced = []
  const clones = []
  const colliders = []
  const canopyOccluders = []

  for (const [prop, items] of byProp) {
    const entry = library[prop]
    const collider = PROP_COLLIDERS[prop]

    if (entry.baked) {
      instanced.push({
        prop,
        geometry: entry.baked.geometry,
        material: entry.baked.material,
        items: items.map((it) => ({
          x: it.x,
          y: it.y,
          z: it.z,
          ry: it.ry,
          s: it.s,
        })),
      })
    } else {
      for (const it of items) {
        clones.push({ prop, ...it })
      }
    }

    if (collider) {
      for (const it of items) {
        const s = it.s ?? 1
        colliders.push({
          x: it.x,
          y: it.y,
          z: it.z,
          ry: it.ry ?? 0,
          r: (collider.r ?? 0.5) * s,
          h: (collider.h ?? 0.5) * s,
          depth: (collider.depth ?? collider.r ?? 0.5) * s,
        })
        if (/Tree|Maple|Willow|Pine/i.test(prop) && !/Dead|Trunk/.test(prop)) {
          const th = (PROP_HEIGHTS[prop] ?? 10) * s
          canopyOccluders.push({
            x: it.x,
            y: it.y + th * 0.55,
            z: it.z,
            r: th * 0.28,
            h: th * 0.4,
          })
        }
      }
    }
  }

  return { instanced, clones, colliders, canopyOccluders }
}

function buildLibrary(scene) {
  const library = {}
  for (const [name, height] of Object.entries(PROP_HEIGHTS)) {
    const pivot = extractNormalized(scene, name, height)
    if (!pivot) continue
    const baked = bakeForInstancing(pivot)
    library[name] = { pivot, baked, multi: !baked }
  }
  return library
}

/**
 * Decoração do Low Poly Adventure Asset Pack.
 * Carrega o GLB uma vez, clona nós nomeados e instancia o que for mesh única.
 */
export default function AdventureProps() {
  const { scene } = useGLTF(MODEL_URL)
  const quality = useGameStore((s) => s.quality)
  const density = (QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium).density

  const library = useMemo(() => buildLibrary(scene), [scene])
  const placements = useMemo(() => buildAdventurePlacements(density), [density])

  const { colliders, canopyOccluders } = useMemo(
    () => buildPropBatch(library, placements),
    [library, placements],
  )

  const [lodPlacements, setLodPlacements] = useState(placements)
  const lodTick = useRef(0)

  useEffect(() => {
    setLodPlacements(placements)
  }, [placements])

  useFrame((state) => {
    if (state.clock.elapsedTime - lodTick.current < 0.35) return
    lodTick.current = state.clock.elapsedTime
    setLodPlacements(filterAdventurePlacements(placements, playerPosition.x, playerPosition.z))
  })

  const { instanced, clones } = useMemo(
    () => buildPropBatch(library, lodPlacements),
    [library, lodPlacements],
  )

  return (
    <group name="adventure-props">
      <RigidBody type="fixed" colliders={false} friction={0.35}>
        {colliders.map((c, i) => (
          <CuboidCollider
            key={`apc${i}`}
            position={[c.x, c.y + c.h, c.z]}
            rotation={[0, c.ry, 0]}
            args={[c.r, c.h, c.depth]}
          />
        ))}
      </RigidBody>

      <RigidBody
        type="fixed"
        colliders={false}
        collisionGroups={CAMERA_OCCLUDER_COLLISION}
        solverGroups={CAMERA_OCCLUDER_SOLVER}
      >
        {canopyOccluders.map((c, i) => (
          <CuboidCollider key={`apo${i}`} position={[c.x, c.y, c.z]} args={[c.r, c.h, c.r]} />
        ))}
      </RigidBody>

      {instanced.map((group) => (
        <ChunkedInstanced
          key={group.prop}
          geometry={group.geometry}
          material={group.material}
          items={group.items}
          castShadow={false}
          receiveShadow={false}
        />
      ))}

      {clones.map((it, i) => (
        <PackClone
          key={`ap-${it.prop}-${i}`}
          template={library[it.prop].pivot}
          placement={it}
        />
      ))}
    </group>
  )
}


const PackClone = forwardRef(function PackClone({ template, placement }, ref) {
  const obj = useMemo(() => {
    const clone = template.clone(true)
    return clone
  }, [template])

  return (
    <group ref={ref} position={[placement.x, placement.y, placement.z]} rotation={[0, placement.ry ?? 0, 0]} scale={placement.s ?? 1}>
      <primitive object={obj} />
    </group>
  )
})

useGLTF.preload(MODEL_URL)
