import { useMemo } from 'react'
import ToonMat from '../../materials/ToonMat'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { ChunkedInstanced, useWindMaterial } from './Instanced'
import { generateZoneProps } from '../../config/scatter'
import { SCATTER_ZONES } from '../../config/world'
import { QUALITY_PRESETS, useGameStore } from '../../store/gameStore'
import { CAMERA_OCCLUDER_COLLISION, CAMERA_OCCLUDER_SOLVER } from '../../physics/groups'
import { makeToonMaterial } from '../../materials/toonMaterial'
import { PAL } from '../../config/palette'

/** zonas com pinheiros (o resto ganha árvores redondas) */
const PINE_ZONES = new Set(['snow', 'night', 'climb', 'summitTop'])

function mergeReed() {
  const stem = new THREE.CylinderGeometry(0.04, 0.05, 1.2, 6)
  stem.translate(0, 0.6, 0)
  const head = new THREE.CapsuleGeometry(0.09, 0.26, 4, 8)
  head.translate(0, 1.3, 0)
  const g = mergeGeometries([stem.toNonIndexed(), head.toNonIndexed()])
  return g
}

/** Geometrias compartilhadas por todas as zonas (criadas uma vez) */
function useSharedGeometries() {
  return useMemo(() => {
    // ── árvore redonda (estilo Animal Crossing): tronco baixo + copa fofa ──
    const trunk = new THREE.CylinderGeometry(0.32, 0.5, 2.6, 10, 1)
    trunk.translate(0, 1.3, 0)
    const canopyA = new THREE.IcosahedronGeometry(2.3, 2)
    canopyA.scale(1, 0.92, 1)
    canopyA.translate(0, 4.3, 0)
    const canopyB = new THREE.IcosahedronGeometry(1.55, 2)
    canopyB.translate(1.05, 5.25, 0.35)
    const canopyC = new THREE.IcosahedronGeometry(1.45, 2)
    canopyC.translate(-0.95, 5.0, -0.45)

    // ── pinheiro fofo (neve/noite/mirante): três saias arredondadas ──
    const pineTrunk = new THREE.CylinderGeometry(0.28, 0.42, 2.2, 10, 1)
    pineTrunk.translate(0, 1.1, 0)
    const tier = (r, h, y) => {
      const g = new THREE.ConeGeometry(r, h, 14, 2)
      // barriga arredondada: empurra os vértices do meio para fora
      const pos = g.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const yy = pos.getY(i) / h + 0.5
        const bulge = 1 + Math.sin(yy * Math.PI) * 0.18
        pos.setX(i, pos.getX(i) * bulge)
        pos.setZ(i, pos.getZ(i) * bulge)
      }
      g.translate(0, y, 0)
      return g
    }
    const pineA = tier(2.2, 2.6, 2.9)
    const pineB = tier(1.7, 2.2, 4.3)
    const pineC = tier(1.15, 1.9, 5.6)

    // capas de neve sobre cada saia do pinheiro
    const snowA = tier(1.25, 1.1, 3.75)
    const snowB = tier(0.95, 0.95, 5.05)
    const snowC = tier(0.62, 0.8, 6.25)

    const bush = new THREE.IcosahedronGeometry(1, 2)
    // touca de neve nos arbustos: meia esfera achatada
    const bushCap = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)
    const fruit = new THREE.SphereGeometry(0.16, 10, 8)

    // Tufo de grama: baixo e fino. Livia tem 1.7 — a moita precisa bater
    // no tornozelo, não na cintura.
    // tufinho de trevo (meia bolinha achatada) — nada de espinhos
    const blade = new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)
    blade.scale(1, 0.6, 1)

    const stem = new THREE.CylinderGeometry(0.026, 0.034, 0.62, 6)
    stem.translate(0, 0.31, 0)
    // folhinhas na base: é o que faz a flor parecer flor e não pedra colorida
    const leaves = new THREE.ConeGeometry(0.22, 0.16, 8, 1)
    leaves.translate(0, 0.09, 0)
    const bloom = new THREE.SphereGeometry(0.075, 10, 8)
    bloom.translate(0, 0.67, 0)
    // flor de cinco pétalas: pentágono gordinho
    const petals = new THREE.CylinderGeometry(0.22, 0.1, 0.07, 5)
    petals.translate(0, 0.63, 0)

    // samambaia: leque baixo e largo
    // arbustinho baixo e redondo
    const fern = new THREE.IcosahedronGeometry(0.55, 1)
    fern.scale(1, 0.7, 1)
    fern.translate(0, 0.3, 0)

    // junco: haste fina e alta
    // taboa: hastezinha com "salsicha" na ponta
    const reed = mergeReed()

    const rock = new THREE.IcosahedronGeometry(1, 1)
    rock.scale(1, 0.72, 1)

    const capMush = new THREE.SphereGeometry(0.34, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2)
    capMush.translate(0, 0.3, 0)
    const stemMush = new THREE.CylinderGeometry(0.07, 0.09, 0.3, 8)
    stemMush.translate(0, 0.15, 0)

    const log = new THREE.CylinderGeometry(0.5, 0.5, 3.2, 14)
    const hay = new THREE.CylinderGeometry(0.95, 0.95, 2.6, 16)
    const crate = new THREE.BoxGeometry(1.3, 1.3, 1.3)
    const barrel = new THREE.CylinderGeometry(0.62, 0.62, 1.3, 14)

    const post = new THREE.BoxGeometry(0.24, 1.6, 0.24)
    post.translate(0, 0.8, 0)
    const rail = new THREE.BoxGeometry(2.7, 0.16, 0.1)

    const lampPost = new THREE.CylinderGeometry(0.1, 0.14, 3, 8)
    lampPost.translate(0, 1.5, 0)
    const lampGlass = new THREE.SphereGeometry(0.26, 12, 10)
    lampGlass.translate(0, 3.2, 0)

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
      pineTrunk,
      pineA,
      pineB,
      pineC,
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
    const mk = (opts) => makeToonMaterial({ ...opts, nearFade: true })
    return {
      bark: mk({ color: PAL.trunk }),
      canopy: mk({ color: '#ffffff' }),
      snow: mk({ color: PAL.snow }),
      ice: mk({ color: PAL.ice, transparent: true, opacity: 0.9 }),
      fruit: mk({ color: '#ffffff' }),
      bloom: mk({ color: '#ffffff' }),
      bloomCenter: mk({ color: PAL.flowerCenter }),
      stem: mk({ color: '#5cbf52' }),
      leaf: mk({ color: '#4fb04a' }),
      rock: mk({ color: '#ffffff' }),
      mushCap: mk({ color: '#ffffff' }),
      mushStem: mk({ color: '#fff4e0' }),
      wood: mk({ color: PAL.wood }),
      woodDark: mk({ color: PAL.woodDark }),
      hay: mk({ color: '#f4d06a' }),
      metal: mk({ color: '#7f93ad' }),
      grass: mk({ color: '#ffffff' }),
      bush: mk({ color: '#ffffff' }),
      reed: mk({ color: '#ffffff' }),
      lamp: mk({ color: '#ffd79a', emissive: '#ffb24a', emissiveIntensity: 1.35 }),
    }
  }, [])
}

/** Detalhe pequeno (grama, flores…) some antes — ninguém nota a 60 m */
const SMALL_CULL = 60

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

  const canopyOccluders = useMemo(() => {
    const list = []
    zones.forEach((z) => {
      z.pines.forEach((p) => {
        const s = p.s
        list.push({
          x: p.x,
          y: p.y + 4.4 * s,
          z: p.z,
          r: 2.1 * s,
          h: 1.9 * s,
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

  // LOD por distância agora é feito pelo DistanceCuller (sem setState a cada 0.35 s)
  const lodZones = zones

  const snowmen = useMemo(
    () => lodZones.flatMap((z) => z.snowmen.map((s) => ({ ...s, zone: z.zoneId }))),
    [lodZones],
  )

  return (
    <group>
      {/* Colisão de troncos, pedras grandes e cercas: UM rigid body */}
      <RigidBody type="fixed" colliders={false} friction={0.35}>
        {solids.map((s, i) => (
          <CuboidCollider key={`s${i}`} position={[s.x, s.y + s.h, s.z]} args={[s.r, s.h, s.r]} />
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

      {lodZones.map((z) => (
        <group key={z.zoneId}>
          <ChunkedInstanced geometry={PINE_ZONES.has(z.zoneId) ? geo.pineTrunk : geo.trunk} material={mat.bark} items={z.pineBases} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={PINE_ZONES.has(z.zoneId) ? geo.pineA : geo.canopyA} material={mat.canopy} items={z.pines} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={PINE_ZONES.has(z.zoneId) ? geo.pineB : geo.canopyB} material={mat.canopy} items={z.pines} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={PINE_ZONES.has(z.zoneId) ? geo.pineC : geo.canopyC} material={mat.canopy} items={z.pines} castShadow={false} receiveShadow={false} />

          <ChunkedInstanced geometry={geo.snowA} material={mat.snow} items={z.pineSnowBases} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.snowB} material={mat.snow} items={z.pineSnowBases} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.snowC} material={mat.snow} items={z.pineSnowBases} castShadow={false} receiveShadow={false} />

          <ChunkedInstanced geometry={geo.bush} material={bushMaterial} items={z.bushes} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.bushCap} material={mat.snow} items={z.bushSnow} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.fruit} material={mat.fruit} items={z.fruits} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />

          <ChunkedInstanced
            geometry={geo.blade}
            material={grassMaterial}
            items={z.grass} cullDist={SMALL_CULL}
            castShadow={false}
            receiveShadow={false}
          />
          <ChunkedInstanced geometry={geo.stem} material={mat.stem} items={z.flowerBases} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.leaves} material={mat.leaf} items={z.flowerBases} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.petals} material={mat.bloom} items={z.flowers} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.bloom} material={mat.bloomCenter} items={z.flowerBases} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />

          <ChunkedInstanced geometry={geo.fern} material={bushMaterial} items={z.ferns} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced
            geometry={geo.reed}
            material={reedMaterial}
            items={z.reeds} cullDist={SMALL_CULL}
            castShadow={false}
            receiveShadow={false}
          />

          <ChunkedInstanced geometry={geo.rock} material={mat.rock} items={z.rocks} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.rock} material={mat.rock} items={z.pebbles} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />

          <ChunkedInstanced geometry={geo.stemMush} material={mat.mushStem} items={z.mushroomBases} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.capMush} material={mat.mushCap} items={z.mushrooms} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />

          <ChunkedInstanced geometry={geo.log} material={mat.wood} items={z.logs} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.hay} material={mat.hay} items={z.hay} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.crate} material={mat.wood} items={z.crateBoxes} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.barrel} material={mat.woodDark} items={z.barrels} castShadow={false} receiveShadow={false} />

          <ChunkedInstanced geometry={geo.post} material={mat.woodDark} items={z.fences} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.rail} material={mat.wood} items={z.railsHigh} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced geometry={geo.rail} material={mat.wood} items={z.railsLow} castShadow={false} receiveShadow={false} />

          <ChunkedInstanced geometry={geo.lampPost} material={mat.metal} items={z.lanterns} castShadow={false} receiveShadow={false} />
          <ChunkedInstanced
            geometry={geo.lampGlass}
            material={mat.lamp}
            items={z.lanterns}
            castShadow={false}
            receiveShadow={false}
          />

          <ChunkedInstanced
            geometry={geo.snowPatch}
            material={mat.snow}
            items={z.snowPatches}
            castShadow={false}
          />
          <ChunkedInstanced geometry={geo.icicle} material={mat.ice} items={z.icicles} cullDist={SMALL_CULL} castShadow={false} receiveShadow={false} />
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
