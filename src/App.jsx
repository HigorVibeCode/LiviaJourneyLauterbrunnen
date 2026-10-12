import { Suspense, lazy, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls, PerformanceMonitor } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
import AudioDirector from './components/AudioDirector'
import Livia from './components/Livia'
import WorldMap from './components/WorldMap'
import Lighting from './components/Lighting'
import SkyDome from './components/SkyDome'
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
import PhysicsTicker from './components/PhysicsTicker'
import DistanceCuller from './components/DistanceCuller'
import LightPool from './components/LightPool'
import RemotePlayers from './components/RemotePlayers'
import MultiplayerBridge from './multiplayer/MultiplayerBridge'
import { QUALITY_PRESETS, useGameStore } from './store/gameStore'
import { useLoadingStore, markIntroDone } from './store/loadingStore'
import { useProgressStore } from './store/progressStore'
import { isTyping } from './lib/keyboard'
import { preloadGameAssets } from './lib/preloadAssets'
import './App.css'

// pós-processamento só existe na qualidade Alta: baixa sob demanda
const Effects = lazy(() => import('./components/Effects'))

const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'back', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'interact', keys: ['KeyE'] },
  { name: 'guide', keys: ['KeyG', 'KeyQ'] },
]

function PauseListener() {
  const togglePause = useGameStore((s) => s.togglePause)

  useEffect(() => {
    const ready = () => useLoadingStore.getState().introDone && !useProgressStore.getState().finished
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (isTyping()) return
        e.preventDefault()
        if (ready()) togglePause()
      }
    }
    // Com o mouse capturado o navegador "come" o Esc só para soltar o mouse —
    // então perder a captura no meio do jogo = abrir o menu de pausa.
    const onLockChange = () => {
      if (!document.pointerLockElement && ready() && !useGameStore.getState().paused) {
        useGameStore.getState().setPaused(true)
      }
    }
    // tecla presa ao trocar de janela (alt-tab segurando W = andava sozinha)
    const releaseKeys = () => {
      for (const { keys } of keyboardMap) {
        for (const code of keys) window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code }))
      }
    }
    const onVisibility = () => {
      if (document.hidden) {
        releaseKeys()
        if (ready()) useGameStore.getState().setPaused(true)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', releaseKeys)
    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', releaseKeys)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [togglePause])

  return null
}

function GameCanvas() {
  const paused = useGameStore((s) => s.paused)
  const quality = useGameStore((s) => s.quality)
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium
  // só mede FPS com o jogo rodando (o loading/compilação travam de propósito)
  const playing = useLoadingStore((s) => s.bootReady && s.introDone)

  return (
    <Canvas
      shadows={preset.shadows}
      dpr={preset.dpr}
      camera={{ position: [0, 6, 108], fov: 52, near: 0.4, far: 1000 }}
      gl={{
        alpha: false,
        antialias: !preset.postFx,
        powerPreference: 'high-performance',
        toneMapping: THREE.NeutralToneMapping,
        toneMappingExposure: 1.0,
        stencil: false,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor('#bfe3ff', 1)
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      {/* FPS baixo por alguns segundos → baixa a qualidade sozinho */}
      {playing && (
        <PerformanceMonitor
          flipflops={2}
          onDecline={() => useGameStore.getState().autoLowerQuality()}
        />
      )}
      {preset.postFx && (
        <Suspense fallback={null}>
          <Effects />
        </Suspense>
      )}
      <SkyDome />
      <Lighting />
      <LoaderReporter />
      <DistanceCuller />
      <LightPool />

      <ErrorBoundary name="GameScene">
        <Suspense fallback={null}>
          {/* paused=true desliga o stepper interno; PhysicsTicker limita o dt */}
          <Physics gravity={[0, -24, 0]} paused timeStep="vary">
            <PhysicsTicker paused={paused} />
            <WorldMap />
            <Livia />
          </Physics>
          <RemotePlayers />
          <GuideBeacon />
          <FinaleDirector />
          <Weather />
          <BootWarmup />
        </Suspense>
      </ErrorBoundary>
    </Canvas>
  )
}

/** Se o HUD quebrar, o jogo continua — e há um jeito de recarregar */
function HudCrashed() {
  return (
    <div className="hud-crashed">
      <button type="button" className="btn" onClick={() => window.location.reload()}>
        Algo deu errado na tela — toque para recarregar (o progresso está salvo)
      </button>
    </div>
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
        <MultiplayerBridge />
        <GameCanvas />
        {gameUnlocked && (
          <ErrorBoundary name="Hud" fallback={<HudCrashed />}>
            <Hud />
          </ErrorBoundary>
        )}
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
