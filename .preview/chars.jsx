import { createRoot } from 'react-dom/client'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { installNearFade } from '/src/materials/nearFade'
import { installWorldCurve } from '/src/materials/worldCurve'
import '/src/components/LightPool'
import NPC from '/src/components/NPC'
import Horse from '/src/components/Horse'
import Phoenix from '/src/components/Phoenix'
import AlpineCow from '/src/components/AlpineCow'
import { Creature, SPECIES } from '/src/components/Animals'
import { NPCS, resolveNpcPosition } from '/src/config/npcs'
import { playerPosition } from '/src/store/playerStore'
import { useProgressStore } from '/src/store/progressStore'
import { horseRide } from '/src/lib/horseRide'
import { phoenixRide } from '/src/lib/phoenixRide'
import { cowChase } from '/src/lib/cowChase'

installNearFade()
installWorldCurve()
const q = new URLSearchParams(location.search)
const S = q.get('s') ?? 'npcs'
const vec = (k, d) => (q.get(k) ? q.get(k).split(',').map(Number) : d)
const night = q.get('night') === '1'

function Cam() {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(...vec('cam', [0, 1.6, 6]))
    camera.lookAt(...vec('look', [0, 1, 0]))
  }, [camera])
  return null
}

function Follow({ get, children }) {
  const g = useRef(null)
  useFrame(() => {
    const p = get()
    if (g.current && p) g.current.position.set(-p[0], -p[1], -p[2])
  })
  return <group ref={g}>{children}</group>
}

function Scene() {
  if (S === 'npcs') {
    const near = Number(q.get('near') ?? 0)
    const p0 = resolveNpcPosition(NPCS[near])
    playerPosition.x = p0.x + 0.3
    playerPosition.z = p0.z + 2.5
    return NPCS.map((d, i) => {
      const p = resolveNpcPosition(d)
      return (
        <group key={d.id} position={[(i - 1) * 2.2 - p.x, -p.y, -p.z]}>
          <NPC def={d} />
        </group>
      )
    })
  }
  if (S === 'animals') {
    const types = q.get('only') ? q.get('only').split(',') : Object.keys(SPECIES)
    return types.map((t, i) => {
      const cols = Number(q.get('cols') ?? 4)
      const col = i % cols
      const row = Math.floor(i / cols)
      return (
        <group key={t} rotation={[0, 0.9, 0]} position={[(col - (cols - 1) / 2) * Number(q.get('gap') ?? 3.2), 0, -row * 3.2]}>
          <Creature def={{ type: t, home: [0, 0, 0], scale: 1, phase: 0, rate: 0, radius: 0 }} entries={{ current: [] }} />
        </group>
      )
    })
  }
  if (S === 'horse') {
    useProgressStore.setState({ unlockedGates: ['gate_pasture'] })
    horseRide.greetDone = q.get('greet') !== '1'
    return (
      <Follow get={() => [horseRide.x, horseRide.y, horseRide.z]}>
        <Horse />
      </Follow>
    )
  }
  if (S === 'cow') {
    useProgressStore.setState({ unlockedGates: ['gate_summit'] })
    return (
      <Follow get={() => (cowChase.spawned ? [cowChase.x, cowChase.y, cowChase.z] : [0, 0, 0])}>
        <AlpineCow />
      </Follow>
    )
  }
  if (S === 'phoenix') {
    useProgressStore.setState({ finalePhase: 'fly' })
    phoenixRide.phase = 'fly'
    phoenixRide.progress = 0
    phoenixRide.hidePlayer = q.get('rider') === '1'
    phoenixRide.x = 0
    phoenixRide.y = 0
    phoenixRide.z = 0
    phoenixRide.yaw = Number(q.get('yaw') ?? 0.6)
    return <Phoenix />
  }
  return null
}

createRoot(document.getElementById('root')).render(
  <Canvas camera={{ fov: 40, near: 0.1, far: 500 }} gl={{ antialias: true }}>
    <color attach="background" args={[night ? '#3a52a0' : '#bfe6ff']} />
    <hemisphereLight args={[night ? '#8aa2ee' : '#d9f1ff', night ? '#3d6a78' : '#9ad86e', night ? 1.0 : 1.15]} />
    <ambientLight intensity={night ? 0.62 : 0.55} />
    <directionalLight position={[42, 58, 26]} intensity={night ? 1.25 : 1.9} color={night ? '#c8d6ff' : '#fff4dc'} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <circleGeometry args={[30, 32]} />
      <meshLambertMaterial color={night ? '#4f7a6a' : '#8fd46a'} />
    </mesh>
    <Cam />
    <Physics paused>
      <Scene />
    </Physics>
  </Canvas>,
)
