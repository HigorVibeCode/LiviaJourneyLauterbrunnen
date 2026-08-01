import { useMemo, useRef } from 'react'
import ToonMat from '../../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import Instanced, { useWindMaterial } from './Instanced'
import { generateZoneProps } from '../../config/scatter'
import { SCATTER_ZONES, pathXAt } from '../../config/world'
import { QUALITY_PRESETS, useGameStore } from '../../store/gameStore'
import { CAMERA_OCCLUDER_COLLISION, CAMERA_OCCLUDER_SOLVER } from '../../physics/groups'
import { playerPosition } from '../../store/playerStore'
import { bandForDistance, distanceToPlayer } from '../../utils/lodBands'
import { makeToonMaterial } from '../../materials/toonMaterial'

/** Geometrias compartilhadas por todas as zonas (criadas uma vez) */
function useSharedGeometries() {
  return useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.42, 0.78, 6, 8, 1)
    trunk.translate(0, 3, 0)

    const canopyA = new THREE.ConeGeometry(3.6, 6.5, 9, 1)
    canopyA.translate(0, 6.75, 0)
    const canopyB = new THREE.ConeGeometry(2.7, 5.5, 9, 1)
    canopyB.translate(0, 11.25, 0)
    const canopyC = new THREE.ConeGeometry(1.7, 4.5, 8, 1)
    canopyC.translate(0, 14.75, 0)

    // Capas de neve: cada cone repete o topo da copa correspondente
    // (um pouco mais largo), então a neve fica "sobre" os galhos.
    const snowA = new THREE.ConeGeometry(1.85, 3.1, 9, 1)
    snowA.translate(0, 8.55, 0)
    const snowB = new THREE.ConeGeometry(1.4, 2.6, 9, 1)
    snowB.translate(0, 12.8, 0)
    const snowC = new THREE.ConeGeometry(0.9, 2.15, 8, 1)
    snowC.translate(0, 16.05, 0)

    const bush = new THREE.SphereGeometry(1, 8, 6)
    // touca de neve nos arbustos: meia esfera achatada
    const bushCap = new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    const fruit = new THREE.SphereGeometry(0.11, 8, 6)

    // Tufo de grama: baixo e fino. Livia tem 1.7 — a moita precisa bater
    // no tornozelo, não na cintura.
    const blade = new THREE.ConeGeometry(0.13, 0.5, 6, 1)
    blade.translate(0, 0.25, 0)

    const stem = new THREE.CylinderGeometry(0.026, 0.034, 0.62, 6)
    stem.translate(0, 0.31, 0)
    // folhinhas na base: é o que faz a flor parecer flor e não pedra colorida
    const leaves = new THREE.ConeGeometry(0.22, 0.16, 8, 1)
    leaves.translate(0, 0.09, 0)
    const bloom = new THREE.SphereGeometry(0.06, 8, 6)
    bloom.translate(0, 0.66, 0)
    const petals = new THREE.CylinderGeometry(0.13, 0.04, 0.05, 8)
    petals.translate(0, 0.63, 0)

    // samambaia: leque baixo e largo
    const fern = new THREE.ConeGeometry(0.95, 0.55, 8, 1)
    fern.translate(0, 0.27, 0)

    // junco: haste fina e alta
    const reed = new THREE.ConeGeometry(0.075, 1.7, 6, 1)
    reed.translate(0, 0.85, 0)

    const rock = new THREE.DodecahedronGeometry(1, 0)

    const capMush = new THREE.SphereGeometry(0.3, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    capMush.translate(0, 0.3, 0)
    const stemMush = new THREE.CylinderGeometry(0.07, 0.09, 0.3, 8)
    stemMush.translate(0, 0.15, 0)

    const log = new THREE.CylinderGeometry(0.5, 0.5, 3.2, 8)
    const hay = new THREE.CylinderGeometry(0.95, 0.95, 2.6, 10)
    const crate = new THREE.BoxGeometry(1.3, 1.3, 1.3)
    const barrel = new THREE.CylinderGeometry(0.6, 0.7, 1.3, 10)

    const post = new THREE.BoxGeometry(0.24, 1.6, 0.24)
    post.translate(0, 0.8, 0)
    const rail = new THREE.BoxGeometry(2.7, 0.16, 0.1)

    const lampPost = new THREE.CylinderGeometry(0.1, 0.14, 3, 8)
    lampPost.translate(0, 1.5, 0)
    const lampGlass = new THREE.BoxGeometry(0.26, 0.32, 0.26)
    lampGlass.translate(0, 3.15, 0)

    // mancha de neve no chão
    const snowPatch = new THREE.CylinderGeometry(1, 1.15, 0.14, 9)
    snowPatch.translate(0, 0.07, 0)

    // estalactite de gelo apontando para baixo
    const icicle = new THREE.ConeGeometry(0.28, 1.5, 8)
    icicle.rotateX(Math.PI)
    icicle.translate(0, 0.75, 0)

    const geos = {
      trunk,
      canopyA,
      canopyB,
      canopyC,
      snowA,
      snowB,
      snowC,
      bush,
      bushCap,
      fruit,
      blade,
      stem,
      leaves,
      bloom,
      petals,
      fern,
      reed,
      rock,
      capMush,
      stemMush,
      log,
      hay,
      crate,
      barrel,
      post,
      rail,
      lampPost,
      lampGlass,
      snowPatch,
      icicle,
    }
    for (const g of Object.values(geos)) g.computeVertexNormals()
    return geos
  }, [])
}

function useSharedMaterials() {
  return useMemo(() => {
    const mk = (opts) => makeToonMaterial(opts)
    return {
      bark: mk({ color: '#5b3a22' }),
      canopy: mk({ color: '#ffffff' }),
      snow: mk({ color: '#f4f8fc' }),
      ice: mk({ color: '#cfe8f4', transparent: true, opacity: 0.85 }),
      fruit: mk({ color: '#ffffff' }),
      bloom: mk({ color: '#ffffff' }),
      bloomCenter: mk({ color: '#e8b830' }),
      stem: mk({ color: '#3f7a3f' }),
      leaf: mk({ color: '#347a3c' }),
      rock: mk({ color: '#ffffff' }),
      mushCap: mk({ color: '#ffffff' }),
      mushStem: mk({ color: '#efe6d2' }),
      wood: mk({ color: '#6b4a2c' }),
      woodDark: mk({ color: '#54381f' }),
      hay: mk({ color: '#d0a94e' }),
      metal: mk({ color: '#4a4a48' }),
      grass: mk({ color: '#ffffff' }),
      bush: mk({ color: '#ffffff' }),
      reed: mk({ color: '#ffffff' }),
      lamp: mk({ color: '#ffd79a', emissive: '#ffb24a', emissiveIntensity: 1.35 }),
    }
  }, [])
}

export default function Vegetation() {
  const quality = useGameStore((s) => s.quality)
  const density = (QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium).density
  const geo = useSharedGeometries()
  const mat = useSharedMaterials()
  // vento: Alta = tudo; Médio = só arbustos/juncos/samambaias (grama estática)
  const windFull = quality === 'high'
  const windSelective = quality === 'medium' || quality === 'high'
  const grassWind = useWindMaterial({ color: '#ffffff', strength: 0.2, speed: 1.3 })
  const bushWind = useWindMaterial({ color: '#ffffff', strength: 0.045, speed: 0.9 })
  const reedWind = useWindMaterial({ color: '#ffffff', strength: 0.13, speed: 1 })
  const grassMaterial = windFull ? grassWind : mat.grass
  const bushMaterial = windSelective ? bushWind : mat.bush
  const reedMaterial = windSelective ? reedWind : mat.reed

  const zones = useMemo(() => {
    const rails = (fences, height) =>
      fences
        .filter((f) => !f.last)
        .map((f) => ({
          x: f.ry === 0 ? f.x + 1.35 : f.x,
          y: f.y + height,
          z: f.ry === 0 ? f.z : f.z + 1.35,
          ry: f.ry,
        }))

    return Object.keys(SCATTER_ZONES)
      .map((id) => generateZoneProps(id, density))
      .filter(Boolean)
      .map((z) => ({
        ...z,
        zFrom: SCATTER_ZONES[z.zoneId]?.zFrom ?? 0,
        zTo: SCATTER_ZONES[z.zoneId]?.zTo ?? 0,
        flowerBases: strip(z.flowers),
        pineBases: strip(z.pines),
        pineSnowBases: strip(z.pineSnow),
        mushroomBases: strip(z.mushrooms),
        crateBoxes: z.crates.filter((c) => !c.barrel),
        barrels: z.crates.filter((c) => c.barrel),
        railsHigh: rails(z.fences, 1.2),
        railsLow: rails(z.fences, 0.62),
      }))
  }, [density])

  const solids = useMemo(() => {
    const list = []
    zones.forEach((z) => {
      z.pines.forEach((p) => list.push({ x: p.x, y: p.y, z: p.z, r: 0.32 * p.s, h: 2.4 * p.s }))
      z.rocks.forEach((r) => {
        if (r.solid) list.push({ x: r.x, y: r.y, z: r.z, r: r.s * 0.45, h: r.s * 0.48 })
      })
      z.bushes.forEach((b) =>
        list.push({ x: b.x, y: b.y, z: b.z, r: 0.42 * (b.s ?? 1), h: 0.35 * (b.s ?? 1) }),
      )
      z.logs.forEach((l) =>
        list.push({ x: l.x, y: l.y + 0.2 * (l.s ?? 1), z: l.z, r: 0.48 * (l.s ?? 1), h: 0.32 * (l.s ?? 1) }),
      )
      z.hay.forEach((h) =>
        list.push({ x: h.x, y: h.y, z: h.z, r: 0.55 * (h.s ?? 1), h: 0.38 * (h.s ?? 1) }),
      )
      z.crateBoxes.forEach((c) =>
        list.push({ x: c.x, y: c.y, z: c.z, r: 0.42 * (c.s ?? 1), h: 0.45 * (c.s ?? 1) }),
      )
      z.barrels.forEach((c) =>
        list.push({ x: c.x, y: c.y, z: c.z, r: 0.38 * (c.s ?? 1), h: 0.45 * (c.s ?? 1) }),
      )
    })
    return list
  }, [zones])

  const bushColliders = useMemo(() => {
    const list = []
    zones.forEach((z) =>
      z.bushes.forEach((b) =>
        list.push({ x: b.x, y: b.y + 0.35 * (b.s ?? 1), z: b.z, r: 0.42 * (b.s ?? 1), h: 0.35 * (b.s ?? 1) }),
      ),
    )
    return list
  }, [zones])

  const propColliders = useMemo(() => {
    const list = []
    zones.forEach((z) => {
      z.logs.forEach((l) =>
        list.push({ x: l.x, y: l.y + 0.25 * (l.s ?? 1), z: l.z, r: 0.48 * (l.s ?? 1), h: 0.28 * (l.s ?? 1) }),
      )
      z.hay.forEach((h) =>
        list.push({ x: h.x, y: h.y, z: h.z, r: 0.52 * (h.s ?? 1), h: 0.32 * (h.s ?? 1) }),
      )
      z.crateBoxes.forEach((c) =>
        list.push({ x: c.x, y: c.y, z: c.z, r: 0.4 * (c.s ?? 1), h: 0.42 * (c.s ?? 1) }),
      )
      z.barrels.forEach((c) =>
        list.push({ x: c.x, y: c.y, z: c.z, r: 0.36 * (c.s ?? 1), h: 0.42 * (c.s ?? 1) }),
      )
    })
    return list
  }, [zones])

  const canopyOccluders = useMemo(() => {
    const list = []
    zones.forEach((z) => {
      z.pines.forEach((p) => {
        const s = p.s
        list.push({
          x: p.x,
          y: p.y + 9.2 * s,
          z: p.z,
          r: 3.05 * s,
          h: 6.8 * s,
        })
      })
    })
    return list
  }, [zones])

  const fenceColliders = useMemo(() => {
    const list = []
    zones.forEach((z) =>
      z.fences.forEach((f) => {
        const rx = f.ry === 0 ? f.x + 1.35 : f.x
        const rz = f.ry === 0 ? f.z : f.z + 1.35
        list.push({ x: rx, y: f.y + 0.85, z: rz, ry: f.ry })
      }),
    )
    return list
  }, [zones])

  const decorativeRefs = useRef({})
  const lodTick = useRef(0)

  useFrame((state) => {
    if (state.clock.elapsedTime - lodTick.current < 0.22) return
    lodTick.current = state.clock.elapsedTime
    const px = playerPosition.x
    const pz = playerPosition.z
    zones.forEach((z) => {
      const midZ = (z.zFrom + z.zTo) / 2
      const midX = pathXAt(midZ)
      const d = distanceToPlayer(midX, midZ, px, pz)
      const band = bandForDistance(d)
      const deco = decorativeRefs.current[z.zoneId]
      if (deco) deco.visible = band !== 'far'
    })
  })

  const snowmen = useMemo(
    () => zones.flatMap((z) => z.snowmen.map((s) => ({ ...s, zone: z.zoneId }))),
    [zones],
  )

  return (
    <group>
      {/* Colisão de troncos, pedras grandes e cercas: UM rigid body */}
      <RigidBody type="fixed" colliders={false} friction={0.35}>
        {solids.map((s, i) => (
          <CuboidCollider key={`s${i}`} position={[s.x, s.y + s.h, s.z]} args={[s.r, s.h, s.r]} />
        ))}
        {bushColliders.map((b, i) => (
          <CuboidCollider key={`b${i}`} position={[b.x, b.y, b.z]} args={[b.r, b.h, b.r]} />
        ))}
        {propColliders.map((p, i) => (
          <CuboidCollider key={`p${i}`} position={[p.x, p.y, p.z]} args={[p.r, p.h, p.r]} />
        ))}
        {fenceColliders.map((f, i) => (
          <CuboidCollider
            key={`f${i}`}
            position={[f.x, f.y, f.z]}
            rotation={[0, f.ry, 0]}
            args={[1.4, 0.85, 0.12]}
          />
        ))}
      </RigidBody>

      {/* Oclusão da câmera nas copas/arbustos (sem empurrar a Livia) */}
      <RigidBody
        type="fixed"
        colliders={false}
        collisionGroups={CAMERA_OCCLUDER_COLLISION}
        solverGroups={CAMERA_OCCLUDER_SOLVER}
      >
        {canopyOccluders.map((c, i) => (
          <CuboidCollider key={`oc${i}`} position={[c.x, c.y, c.z]} args={[c.r, c.h, c.r]} />
        ))}
      </RigidBody>

      {zones.map((z) => (
        <group key={z.zoneId}>
          <Instanced geometry={geo.trunk} material={mat.bark} items={z.pineBases} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.canopyA} material={mat.canopy} items={z.pines} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.canopyB} material={mat.canopy} items={z.pines} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.canopyC} material={mat.canopy} items={z.pines} castShadow={false} receiveShadow={false} />

          <Instanced geometry={geo.snowA} material={mat.snow} items={z.pineSnowBases} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.snowB} material={mat.snow} items={z.pineSnowBases} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.snowC} material={mat.snow} items={z.pineSnowBases} castShadow={false} receiveShadow={false} />

          <group ref={(el) => { decorativeRefs.current[z.zoneId] = el }}>
          <Instanced geometry={geo.bush} material={bushMaterial} items={z.bushes} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.bushCap} material={mat.snow} items={z.bushSnow} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.fruit} material={mat.fruit} items={z.fruits} castShadow={false} receiveShadow={false} />

          <Instanced
            geometry={geo.blade}
            material={grassMaterial}
            items={z.grass}
            castShadow={false}
            receiveShadow={false}
          />
          <Instanced geometry={geo.stem} material={mat.stem} items={z.flowerBases} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.leaves} material={mat.leaf} items={z.flowerBases} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.petals} material={mat.bloom} items={z.flowers} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.bloom} material={mat.bloomCenter} items={z.flowerBases} castShadow={false} receiveShadow={false} />

          <Instanced geometry={geo.fern} material={bushMaterial} items={z.ferns} castShadow={false} receiveShadow={false} />
          <Instanced
            geometry={geo.reed}
            material={reedMaterial}
            items={z.reeds}
            castShadow={false}
            receiveShadow={false}
          />

          <Instanced geometry={geo.rock} material={mat.rock} items={z.rocks} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.rock} material={mat.rock} items={z.pebbles} castShadow={false} receiveShadow={false} />

          <Instanced geometry={geo.stemMush} material={mat.mushStem} items={z.mushroomBases} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.capMush} material={mat.mushCap} items={z.mushrooms} castShadow={false} receiveShadow={false} />

          <Instanced geometry={geo.log} material={mat.wood} items={z.logs} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.hay} material={mat.hay} items={z.hay} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.crate} material={mat.wood} items={z.crateBoxes} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.barrel} material={mat.woodDark} items={z.barrels} castShadow={false} receiveShadow={false} />

          <Instanced geometry={geo.post} material={mat.woodDark} items={z.fences} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.rail} material={mat.wood} items={z.railsHigh} castShadow={false} receiveShadow={false} />
          <Instanced geometry={geo.rail} material={mat.wood} items={z.railsLow} castShadow={false} receiveShadow={false} />

          <Instanced geometry={geo.lampPost} material={mat.metal} items={z.lanterns} castShadow={false} receiveShadow={false} />
          <Instanced
            geometry={geo.lampGlass}
            material={mat.lamp}
            items={z.lanterns}
            castShadow={false}
            receiveShadow={false}
          />

          <Instanced
            geometry={geo.snowPatch}
            material={mat.snow}
            items={z.snowPatches}
            castShadow={false}
          />
          <Instanced geometry={geo.icicle} material={mat.ice} items={z.icicles} castShadow={false} receiveShadow={false} />
          </group>
        </group>
      ))}

      {snowmen.map((s, i) => (
        <Snowman key={i} position={[s.x, s.y, s.z]} rotation={s.ry} scale={s.s} />
      ))}
    </group>
  )
}

/** Remove `color` dos itens para o InstancedMesh usar a cor do material */
function strip(items) {
  return items.map(({ color, ...rest }) => rest)
}

/** Boneco de neve com cenoura, cachecol e galhos */
function Snowman({ position, rotation = 0, scale = 1 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.66, 8, 7]} />
        <ToonMat color="#f6fafd"/>
      </mesh>
      <mesh position={[0, 1.42, 0]} castShadow>
        <sphereGeometry args={[0.46, 8, 7]} />
        <ToonMat color="#f2f7fb"/>
      </mesh>
      <mesh position={[0, 2.02, 0]} castShadow>
        <sphereGeometry args={[0.33, 8, 7]} />
        <ToonMat color="#f6fafd"/>
      </mesh>

      {/* cenoura */}
      <mesh position={[0, 2.04, 0.34]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.07, 0.34, 5]} />
        <ToonMat color="#e8802a"/>
      </mesh>
      {/* olhos e botões */}
      {[
        [0.11, 2.12, 0.29],
        [-0.11, 2.12, 0.29],
        [0, 1.5, 0.44],
        [0, 1.28, 0.44],
      ].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.045, 5, 4]} />
          <ToonMat color="#22201c"/>
        </mesh>
      ))}
      {/* cachecol */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.37, 0.37, 0.16, 9]} />
        <ToonMat color="#c8433c"/>
      </mesh>
      <mesh position={[0.16, 1.5, 0.3]} rotation={[0.3, 0, 0.2]}>
        <boxGeometry args={[0.16, 0.5, 0.06]} />
        <ToonMat color="#c8433c"/>
      </mesh>
      {/* braços de galho */}
      {[1, -1].map((side) => (
        <mesh key={side} position={[side * 0.6, 1.5, 0]} rotation={[0, 0, side * -0.7]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.9, 4]} />
          <ToonMat color="#4a3220"/>
        </mesh>
      ))}
      {/* cartola */}
      <mesh position={[0, 2.34, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 10]} />
        <ToonMat color="#2a2b30"/>
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.28, 0.34, 10]} />
        <ToonMat color="#2a2b30"/>
      </mesh>
    </group>
  )
}
