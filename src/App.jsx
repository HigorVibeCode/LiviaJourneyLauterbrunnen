import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Selection, Select } from '@react-three/postprocessing'
import * as THREE from 'three'
import AudioDirector from './components/AudioDirector'
import Livia from './components/Livia'
import WorldMap from './components/WorldMap'
import Lighting from './components/Lighting'
import Weather from './components/Weather'
import Hud from './components/Hud'
import GuideBeacon from './components/GuideBeacon'
import FinaleDirector from './components/FinaleDirector'
import TouchControls from './components/ui/TouchControls'
import LoadingScreen from './components/ui/LoadingScreen'
import IntroOverlay from './components/ui/IntroOverlay'
import BootWarmup from './components/ui/BootWarmup'
import { LoaderReporter } from './components/ui/LoaderReporter'
import ErrorBoundary from './components/ErrorBoundary'
import Effects from './components/Effects'
import { QUALITY_PRESETS, useGameStore } from './store/gameStore'
import { useLoadingStore, markIntroDone } from './store/loadingStore'
import { preloadGameAssets } from './lib/preloadAssets'
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
      dpr={preset.dpr}
      camera={{ position: [0, 6, 108], fov: 52, near: 0.4, far: 1600 }}
      gl={{
        alpha: false,
        antialias: !preset.postFx,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        stencil: false,
      }}
      performance={{ min: 0.6 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#87a8c0', 1)
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      <Selection>
        <Effects />
        <Lighting />
        <LoaderReporter />
        <BootWarmup />

        <Select enabled={preset.id === 'high'}>
          <ErrorBoundary name="GameScene">
            <Suspense fallback={null}>
              <Physics gravity={[0, -24, 0]} paused={paused} timeStep="vary">
                <WorldMap />
                <Livia />
              </Physics>
              <GuideBeacon />
              <FinaleDirector />
              <Weather />
            </Suspense>
          </ErrorBoundary>
        </Select>
      </Selection>
    </Canvas>
  )
}

export default function App() {
  const bootReady = useLoadingStore((s) => s.bootReady)
  const introDone = useLoadingStore((s) => s.introDone)
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    preloadGameAssets()
  }, [])

  useEffect(() => {
    if (bootReady && !introDone) setShowIntro(true)
  }, [bootReady, introDone])

  const gameUnlocked = bootReady && introDone

  return (
    <KeyboardControls map={keyboardMap}>
      <div className="game-root">
        <PauseListener />
        <AudioDirector />
        <GameCanvas />
        {gameUnlocked && <Hud />}
        {gameUnlocked && <TouchControls />}
        {!gameUnlocked && <LoadingScreen hidden={false} />}
        {showIntro && !introDone && (
          <IntroOverlay
            onDone={() => {
              markIntroDone()
              setShowIntro(false)
            }}
          />
        )}
      </div>
    </KeyboardControls>
  )
}
