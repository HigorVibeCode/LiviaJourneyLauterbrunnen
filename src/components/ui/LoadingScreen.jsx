import { useLoadingStore, loadingPhaseLabel } from '../../store/loadingStore'

/**
 * Overlay de carregamento — esconde hitch do GLB, bake e shaders.
 */
export default function LoadingScreen({ hidden }) {
  const progress = useLoadingStore((s) => s.progress)
  const active = useLoadingStore((s) => s.active)
  const phase = useLoadingStore((s) => s.phase)
  const bootReady = useLoadingStore((s) => s.bootReady)
  const pct = Math.round(Math.min(100, Math.max(0, progress)))
  const phaseLabel = loadingPhaseLabel(phase)

  if (hidden) return null

  const fading = bootReady && !active

  return (
    <div
      className={`loading-screen ${fading ? 'loading-screen--done' : ''}`}
      aria-live="polite"
    >
      <div className="loading-card hud-magic">
        <p className="loading-kicker">A Jornada de Livia</p>
        <h1 className="loading-title">{phaseLabel}</h1>
        <p className="loading-sub">
          Coração do Vale — quem atravessa cada reino com respeito sobe aos céus.
        </p>
        <div className="loading-track" aria-hidden>
          <div className="loading-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="loading-pct">{pct}%</p>
      </div>
    </div>
  )
}
