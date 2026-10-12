import { Suspense } from 'react'
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
  WATERFALLS,
  groundHeightAt,
  pathXAt,
  pathYawAt,
  resolveOnPath,
  worldFromPath,
} from '../config/world'
import EasterEgg from './EasterEgg'
import StarTrail from './StarTrail'
import NPC from './NPC'
import LanternPickup from './LanternPickup'
import { EASTER_EGGS } from '../config/easterEggs'
import { NPCS } from '../config/npcs'
import AtmosphereZones from './AtmosphereZones'
import ErrorBoundary from './ErrorBoundary'

export default function WorldMap() {
  return (
    <group>
      <AlpsBackdrop />
      <Terrain />
      {/* trilha agora é a fita de terra do Terrain (terrainMesh.buildPath) */}
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
      <StarTrail />

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
