import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { makeToonMaterial } from '../materials/toonMaterial'
import Waterfall from './Waterfall'
import Collectible from './Collectible'
import Gate from './Gate'
import AlpsBackdrop from './AlpsBackdrop'
import Animals from './Animals'
import Fish from './Fish'
import Phoenix from './Phoenix'
import AlpineCow from './AlpineCow'
import Horse from './Horse'
import Terrain from './world/Terrain'
import Vegetation from './world/Vegetation'
import AdventureProps from './world/AdventureProps'
import Chalet from './world/Chalet'
import Instanced from './world/Instanced'
import {
  BarrierWall,
  WoodenBridge,
  RiverWater,
  Streams,
  Ponds,
  SummitStairs,
  SummitTreasure,
  VillageWell,
  Signpost,
} from './world/Structures'
import {
  GATES,
  HOUSES,
  PHASES,
  RIVER,
  STAIRS,
  CORRIDOR_HALF,
  WATERFALLS,
  groundHeightAt,
  makeRng,
  pathXAt,
  pathYawAt,
  phaseAt,
  resolveOnPath,
  worldFromPath,
} from '../config/world'
import EasterEgg from './EasterEgg'
import NPC from './NPC'
import LanternPickup from './LanternPickup'
import { EASTER_EGGS } from '../config/easterEggs'
import { NPCS } from '../config/npcs'
import AtmosphereZones from './AtmosphereZones'
import VillageGlow from './world/VillageGlow'
import ErrorBoundary from './ErrorBoundary'

export default function WorldMap() {
  return (
    <group>
      <AlpsBackdrop />
      <Terrain />
      <PathStones />
      <Vegetation />
      {/* GLB do pack NÃO pode suspender Terrain/Livia — Suspense próprio */}
      <ErrorBoundary name="AdventureProps">
        <Suspense fallback={null}>
          <AdventureProps />
        </Suspense>
      </ErrorBoundary>
      <Animals />

      {/* ── Chalés, celeiros, igreja e cabanas ── */}
      {HOUSES.map((h, i) => {
        const { x, z } = resolveOnPath(h)
        const yaw = pathYawAt(z)
        return (
          <Chalet
            key={i}
            position={[x, groundHeightAt(x, z), z]}
            rotation={h.rot + (yaw - Math.PI)}
            scale={h.scale}
            kind={h.kind}
            body={h.body}
            roof={h.roof}
            home={h.home}
          />
        )
      })}

      {/* ── Portões + muros: vão do corredor curvo (até as paredes da S) ── */}
      {Object.entries(GATES).map(([gateId, g]) => {
        const px = pathXAt(g.z)
        const yaw = pathYawAt(g.z)
        return (
          <group key={gateId} position={[px, 0, g.z]} rotation={[0, yaw - Math.PI, 0]}>
            <Gate
              gateId={gateId}
              position={[0, g.y, 0]}
              interactAt={[px, g.y, g.z]}
              width={g.width}
              height={g.height}
              color={g.color}
              landmark
            />
            <BarrierWall
              z={0}
              y={g.y}
              gateWidth={g.width}
              halfWidth={g.halfWidth}
              height={g.height}
              color={g.color}
            />
          </group>
        )
      })}

      <AtmosphereZones />
      <VillageGlow />

      {/* ── Itens: 2 por fase, sorteados dentro da própria fase ── */}
      <Collectible itemId="chave_portao" />
      <Collectible itemId="capa_chuva" />
      <Collectible itemId="pena_coruja" />
      <Collectible itemId="casaco" />
      <Collectible itemId="binoculo" />

      {NPCS.map((npc) => (
        <NPC key={npc.id} def={npc} />
      ))}

      <LanternPickup />

      {EASTER_EGGS.map((egg) => (
        <EasterEgg key={egg.id} egg={egg} />
      ))}

      {/* ── Vilarejo / placas (ancorados perto da trilha) ── */}
      <VillageWell position={[worldFromPath(-400, 14).x, 0, -400]} />
      <Signpost
        position={[worldFromPath(40, 10).x, 0, 40]}
        rotation={pathYawAt(40) - Math.PI - 0.15}
        label={0}
      />
      <Signpost
        position={[worldFromPath(-40, 10).x, 0, -40]}
        rotation={pathYawAt(-40) - Math.PI - 0.1}
        label={1}
      />
      <Signpost
        position={[worldFromPath(-360, -10).x, 0, -360]}
        rotation={pathYawAt(-360) - Math.PI + 0.2}
        label={2}
      />
      <Signpost
        position={[worldFromPath(-500, -10).x, 0, -500]}
        rotation={pathYawAt(-500) - Math.PI + 0.2}
        label={3}
      />
      <Signpost
        position={[worldFromPath(-590, 10).x, 0, -590]}
        rotation={pathYawAt(-590) - Math.PI - 0.1}
        label={4}
      />
      <Signpost
        position={[worldFromPath(-720, -10).x, 0, -720]}
        rotation={pathYawAt(-720) - Math.PI + 0.15}
        label={5}
      />
      <Signpost
        position={[worldFromPath(-850, 10).x, 0, -850]}
        rotation={pathYawAt(-850) - Math.PI - 0.12}
        label={6}
      />

      {/* ── Água da fase molhada ── */}
      <RiverWater />
      <WoodenBridge />
      <Streams />
      <Ponds />
      <Fish />

      {/* ── Cachoeiras (Staubbach em destaque) ── */}
      {WATERFALLS.map((w) => {
        const { x, z } = resolveOnPath(w)
        return (
          <Waterfall
            key={w.id}
            position={[x, 0, z]}
            height={w.height}
            width={w.width}
            depth={w.depth}
            hero={w.hero}
            frozen={w.frozen}
          />
        )
      })}

      {/* ── Subida e mirante ── */}
      <SummitStairs />
      <SummitTreasure />
      <Horse />
      <Phoenix />
      <AlpineCow />
    </group>
  )
}

/**
 * Trilha de pedras irregulares guiando o jogador pelo vale.
 * A cor acompanha o bioma: terrosa na pradaria, escura na floresta,
 * clara e nevada no passo.
 */
function PathStones() {
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.6, 0.52, 0.14, 6), [])
  const material = useMemo(
    () => makeToonMaterial({ color: '#ffffff',}),
    [],
  )

  const items = useMemo(() => {
    const rng = makeRng(31337)
    const out = []
    const palettes = {
      meadow: ['#8a7050', '#7a6048', '#9a8060', '#6a5840', '#a08868'],
      pasture: ['#847058', '#746048', '#948060', '#685038', '#988868'],
      night: ['#3a3a48', '#2e2e3a', '#4a4a58', '#353544'],
      water: ['#7a6848', '#6a5838', '#8a7858', '#5a4830'],
      snow: ['#d0dae4', '#c0ccd6', '#dae2ea', '#b4c0ca'],
      flower: ['#8a7050', '#9a8060', '#7a6048', '#a08868'],
      alpine: ['#b4c0b8', '#a8b4ac', '#c0cac2', '#9aa69e'],
    }

    for (let z = 112; z > PHASES.summit.zFrom + 20; z -= 2.4) {
      if (z < RIVER.zTo + 6 && z > RIVER.zFrom - 6) continue
      if (z < STAIRS.zStart + 4) continue

      const biome = phaseAt(z).biome
      const palette = palettes[biome] ?? palettes.alpine
      const cx = pathXAt(z)
      const lanes = [-2.1, 0, 2.1]

      lanes.forEach((lx, i) => {
        const edge = Math.abs(lx) > 1.5
        if (rng() < (edge ? 0.35 : 0.55)) return
        const x = cx + lx + (rng() - 0.5) * 0.7
        out.push({
          x,
          y: groundHeightAt(x, z) + 0.05,
          z: z + (rng() - 0.5) * 0.8 + i * 0.15,
          s: (edge ? 0.65 : 0.95) + rng() * 0.45,
          sy: 0.55 + rng() * 0.45,
          ry: rng() * Math.PI,
          color: palette[Math.floor(rng() * palette.length)],
        })
      })
    }
    return out
  }, [])

  return <Instanced geometry={geometry} material={material} items={items} castShadow={false} />
}
