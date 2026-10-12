import { useLoadingStore, loadingPhaseLabel } from '../../store/loadingStore'

/**
 * Overlay de carregamento — esconde o download dos modelos e a compilação
 * de shaders. Some com fade quando o mundo está pronto.
 */
export default function LoadingScreen() {
  const progress = useLoadingStore((s) => s.progress)
  const phase = useLoadingStore((s) => s.phase)
  const bootReady = useLoadingStore((s) => s.bootReady)
  const pct = Math.round(Math.min(100, Math.max(0, progress)))

  return (
    <div className={`loading-screen ${bootReady ? 'loading-screen--done' : ''}`} aria-live="polite">
      <div className="loading-clouds" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="loading-mountains" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="loading-card">
        <span className="loading-leaf" aria-hidden>
          🌱
        </span>
        <p className="loading-kicker">A Jornada de Livia</p>
        <h1 className="loading-title">{loadingPhaseLabel(phase)}</h1>
        <div className="loading-track" aria-hidden>
          <div className="loading-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="loading-pct">{pct}%</p>
      </div>
    </div>
  )
}
