import { useCallback, useEffect, useState } from 'react'
import { INTRO_LINES, STORY_TITLE } from '../../config/story'
import { resumeAudio } from '../../audio/engine'
import { hasSavedGame, resetSavedGame } from '../../store/progressStore'
import { requestGameLock } from '../../lib/keyboard'

/**
 * Tela de título + três painéis da história (só em jogo novo).
 * Com progresso salvo, "Continuar" volta direto para onde a Livia parou.
 */
export default function IntroOverlay({ onDone }) {
  const saved = hasSavedGame()
  const [step, setStep] = useState(-1) // -1 = título
  const [confirmNew, setConfirmNew] = useState(false)
  const panel = step >= 0 ? INTRO_LINES[step] : null
  const last = step >= INTRO_LINES.length - 1

  const finish = useCallback(() => {
    requestGameLock()
    onDone()
  }, [onDone])

  const advance = useCallback(() => {
    // gesto do usuário: libera o AudioContext (iOS/Chrome)
    void resumeAudio()
    if (step < 0) {
      if (saved) finish()
      else setStep(0)
    } else if (last) finish()
    else setStep((s) => s + 1)
  }, [step, last, saved, finish])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        // botão focado (Sim/Não/Novo jogo) usa o próprio Enter/Espaço
        if (e.target?.closest?.('button')) return
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  if (!panel) {
    return (
      <div className="title-screen" role="dialog" aria-label={STORY_TITLE}>
        <div className="title-glow" aria-hidden />
        <div className="title-deco" aria-hidden>
          <span>🌿</span>
          <span>🌸</span>
          <span>🌼</span>
          <span>🍀</span>
          <span>🌷</span>
          <span>🌿</span>
        </div>
        <p className="title-kicker">Uma aventura nos Alpes suíços</p>
        <h1 className="title-name">
          A Jornada
          <span>de Livia</span>
        </h1>
        <p className="title-sub">Lauterbrunnen · o Coração do Vale</p>

        <div className="title-actions">
          <button type="button" className="btn btn--primary btn--big" onClick={advance}>
            {saved ? '▶ Continuar a jornada' : '▶ Começar'}
          </button>
          {saved &&
            (confirmNew ? (
              <div className="title-confirm">
                <span>Apagar o progresso e começar de novo?</span>
                <button type="button" className="chip chip--danger" onClick={resetSavedGame}>
                  Sim
                </button>
                <button type="button" className="chip" onClick={() => setConfirmNew(false)}>
                  Não
                </button>
              </div>
            ) : (
              <button type="button" className="chip" onClick={() => setConfirmNew(true)}>
                Novo jogo
              </button>
            ))}
        </div>
        <p className="title-hint">Enter ou toque para jogar</p>
      </div>
    )
  }

  return (
    <div className="overlay overlay--story" role="dialog" aria-label="Introdução">
      <div className="dialog story-card" key={step}>
        <p className="dialog-kicker">{panel.kicker}</p>
        <h2>{panel.title}</h2>
        <p className="dialog-copy">{panel.body}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn--primary" onClick={advance}>
            {last ? 'Começar a jornada' : 'Continuar'}
          </button>
          {!last && (
            <button type="button" className="btn btn--ghost" onClick={finish}>
              Pular
            </button>
          )}
        </div>
        <div className="story-dots" aria-hidden>
          {INTRO_LINES.map((_, i) => (
            <span key={i} className={i === step ? 'is-on' : ''} />
          ))}
        </div>
      </div>
    </div>
  )
}
