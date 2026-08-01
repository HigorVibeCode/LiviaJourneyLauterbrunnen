import { useCallback, useEffect, useState } from 'react'
import { INTRO_LINES, STORY_TITLE } from '../../config/story'
import { resumeAudio } from '../../audio/engine'

/**
 * Três painéis narrativos após o loading — antes do controle da Livia.
 */
export default function IntroOverlay({ onDone }) {
  const [step, setStep] = useState(0)
  const panel = INTRO_LINES[step]
  const last = step >= INTRO_LINES.length - 1

  const advance = useCallback(() => {
    // Toque em "Continuar" / "Começar" = gesto válido para o AudioContext (iOS)
    void resumeAudio()
    if (last) onDone()
    else setStep((s) => s + 1)
  }, [last, onDone])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  return (
    <div className="intro-overlay" role="dialog" aria-label="Introdução">
      <div className="intro-card hud-magic">
        <p className="intro-kicker">{STORY_TITLE}</p>
        <p className="intro-phase">{panel.kicker}</p>
        <h2 className="intro-title">{panel.title}</h2>
        <p className="intro-body">{panel.body}</p>
        <button type="button" className="pause-btn pause-btn--primary intro-btn" onClick={advance}>
          {last ? 'Começar jornada' : 'Continuar'}
        </button>
        <p className="intro-hint">Enter ou toque para continuar · {step + 1}/{INTRO_LINES.length}</p>
      </div>
    </div>
  )
}
