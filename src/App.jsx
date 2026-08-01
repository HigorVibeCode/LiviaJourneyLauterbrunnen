import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls, AdaptiveDpr } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
import AudioDirector from './components/AudioDirector'
import Livia from './components/Livia'
import WorldMap from './components/WorldMap'
import Lighting from './components/Lighting'
import Weather from './components/Weather'
import Effects from './components/Effects'
import Hud from './components/Hud'
import GuideBeacon from './components/GuideBeacon'
import FinaleDirector from './components/FinaleDirector'
import ErrorBoundary from './components/ErrorBoundary'
import { QUALITY_PRESETS, useGameStore } from './store/gameStore'
import './App.css'

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'back', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'interact', keys: ['KeyE'] },
]

function PauseListener() {
  const togglePause = useGameStore((s) => s.togglePause)

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        togglePause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePause])

  return null
}

function GameCanvas() {
  const paused = useGameStore((s) => s.paused)
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium

  return (
    <Canvas
      shadows={preset.shadows}
      dpr={1}
      camera={{ position: [0, 6, 108], fov: 52, near: 0.5, far: 900 }}
      gl={{
        alpha: false,
        antialias: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        stencil: false,
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor('#87a8c0', 1)
        scene.background = new THREE.Color('#87a8c0')
      }}
    >
      <Lighting />

      {/* Cubo de sanidade: se isto não aparece, o WebGL não está pintando */}
      <mesh position={[0, 2.2, 96]} castShadow={false}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshBasicMaterial color="#ff2244" />
      </mesh>

      <ErrorBoundary name="GameScene">
        <Suspense fallback={null}>
          {/* timeStep="vary": 1 passo de física por frame de render */}
          <Physics gravity={[0, -24, 0]} paused={paused} timeStep="vary">
            <WorldMap />
            <Livia />
          </Physics>
          <GuideBeacon />
          <FinaleDirector />
          <Weather />
        </Suspense>
      </ErrorBoundary>

      <Effects />
    </Canvas>
  )
}

export default function App() {
  return (
    <KeyboardControls map={keyboardMap}>
      <div className="game-root">
        <PauseListener />
        <AudioDirector />
        <GameCanvas />
        <Hud />
      </div>
    </KeyboardControls>
  )
}
