import { useEffect, useRef, useState } from 'react'
import {
  useProgressStore,
  ITEMS,
  QUESTS,
  missingItems,
  resetSavedGame,
} from '../store/progressStore'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'
import { playerPosition, usePlayerStore } from '../store/playerStore'
import { PHASES, PHASE_ORDER, CHAPTER_LINES, phaseAt } from '../config/world'
import { EASTER_EGGS, EGG_ICONS } from '../config/easterEggs'
import { NPCS } from '../config/npcs'
import { npcDialogueLine } from './NPC'
import { GUIDE_MAX_CHARGE, guideInput } from '../lib/guideInput'
import { horseRide } from '../lib/horseRide'
import { getObjectiveTarget } from '../lib/objectiveTarget'
import { cameraState, playerActions } from '../lib/cameraState'
import { requestGameLock } from '../lib/keyboard'
import MultiplayerPanel from './ui/MultiplayerPanel'
import { getPartyHost } from '../multiplayer/config'
import { ENDING_TEXT } from '../config/story'
import { STARS } from '../config/stars'

/** Re-render leve para o que vive fora do React (cavalo, posição) */
function useTicker(ms = 250) {
  const [, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

function useObjectiveHint() {
  const inventory = useProgressStore((s) => s.inventory)
  const unlockedGates = useProgressStore((s) => s.unlockedGates)
  const nearGateId = useProgressStore((s) => s.nearGateId)
  const finished = useProgressStore((s) => s.finished)
  const hasLantern = useProgressStore((s) => s.hasLantern)

  if (finished) return 'A promessa da avó foi cumprida!'

  if (unlockedGates.includes('gate_pasture') && !unlockedGates.includes('gate_night')) {
    if (horseRide.mounted) return 'Galope pela trilha até o Vale Noturno!'
    if (horseRide.nearMount) return 'Aperte E para montar no cavalo'
    if (nearGateId === 'gate_night') return 'Aperte E para abrir o portão'
    if (playerPosition.z < horseRide.z - 40) return 'Siga a trilha até o portão do Vale Noturno'
    return 'Monte no cavalo que espera depois do portão'
  }

  const quest = QUESTS.find((q) => !unlockedGates.includes(q.gateId))
  if (!quest) {
    if (playerPosition.z > PHASES.summit.zTo) return 'Atravesse o Prado Florido e suba a grande escadaria'
    return 'Abra o baú dourado no alto do mirante!'
  }

  if (quest.id === 'q_night' && !hasLantern) return 'Pegue o lampião brilhante na entrada do vale'

  const missing = missingItems(quest, inventory)
  if (nearGateId === quest.gateId) {
    return missing.length
      ? `Trancado! Falta: ${missing.map((id) => ITEMS[id].name).join(' e ')}`
      : quest.interactHint
  }
  if (missing.length === 0) return 'Tudo pronto! Volte ao portão e aperte E'
  if (missing.length === 1) return `Falta só: ${ITEMS[missing[0]].name}`
  return quest.hint
}

/** Fase pela posição da Livia (não pela contagem de portões) */
function usePhaseInfo() {
  const [phase, setPhase] = useState(PHASES.meadow)
  useEffect(() => {
    const tick = () => setPhase(phaseAt(playerPosition.z))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [])
  return phase
}

/**
 * Seta-bússola: aponta o próximo objetivo relativo à câmera.
 * Atualiza o DOM direto (sem re-render) a cada frame.
 */
function Compass() {
  const arrowRef = useRef(null)
  const labelRef = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const root = rootRef.current
      if (!root) return
      const target = getObjectiveTarget()
      if (!target) {
        root.style.opacity = '0'
        return
      }
      const dx = target.position[0] - playerPosition.x
      const dz = target.position[2] - playerPosition.z
      const dist = Math.hypot(dx, dz)
      // ângulo do alvo menos a frente da câmera (yaw + π)
      let rel = Math.atan2(dx, dz) - (cameraState.yaw + Math.PI)
      while (rel > Math.PI) rel -= Math.PI * 2
      while (rel < -Math.PI) rel += Math.PI * 2
      root.style.opacity = dist < 3 ? '0.35' : '1'
      if (arrowRef.current) arrowRef.current.style.transform = `rotate(${-rel}rad)`
      if (labelRef.current) {
        const text = `${target.label} · ${Math.round(dist)} m`
        if (labelRef.current.textContent !== text) labelRef.current.textContent = text
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="hud-compass" ref={rootRef} aria-hidden>
      <div className="hud-compass-dial">
        <svg ref={arrowRef} viewBox="0 0 40 40" className="hud-compass-arrow">
          <path d="M20 3 L31 30 L20 24 L9 30 Z" />
        </svg>
      </div>
      <span ref={labelRef} className="hud-compass-label" />
    </div>
  )
}

function GuideMeter({ isMobile }) {
  const [charge, setCharge] = useState(GUIDE_MAX_CHARGE)
  const [depleted, setDepleted] = useState(false)
  const [active, setActive] = useState(false)
  useEffect(() => {
    const id = setInterval(() => {
      setCharge(guideInput.charge)
      setDepleted(guideInput.depleted)
      setActive(guideInput.guiding)
    }, 100)
    return () => clearInterval(id)
  }, [])
  const pct = Math.max(0, Math.min(100, (charge / GUIDE_MAX_CHARGE) * 100))
  return (
    <div className={`hud-guide ${depleted ? 'is-depleted' : ''} ${active ? 'is-active' : ''}`}>
      <span className="hud-guide-icon" aria-hidden>
        ✨
      </span>
      <div className="hud-guide-track">
        <div className="hud-guide-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="hud-guide-hint">
        {depleted ? 'recarregando…' : isMobile ? 'guia: botão ✨' : 'guia: segure G'}
      </span>
    </div>
  )
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.()
  else document.documentElement.requestFullscreen?.()?.catch?.(() => {})
}

export default function Hud() {
  useTicker(250)
  const hint = useObjectiveHint()
  const phase = usePhaseInfo()
  const toast = useProgressStore((s) => s.toast)
  const inventory = useProgressStore((s) => s.inventory)
  const collectedEver = useProgressStore((s) => s.collectedEver)
  const foundEggs = useProgressStore((s) => s.foundEggs)
  const stars = useProgressStore((s) => s.stars.length)
  const nearGateId = useProgressStore((s) => s.nearGateId)
  const nearNpcId = useProgressStore((s) => s.nearNpcId)
  const unlockedGates = useProgressStore((s) => s.unlockedGates)
  const npcSpoke = useProgressStore((s) => s.npcSpoke)
  const finished = useProgressStore((s) => s.finished)
  const respawns = usePlayerStore((s) => s.respawns)
  const paused = useGameStore((s) => s.paused)
  const setPaused = useGameStore((s) => s.setPaused)
  const audio = useGameStore((s) => s.audio)
  const toggleAudio = useGameStore((s) => s.toggleAudio)
  const isMobile = useGameStore((s) => s.isMobile)

  const [victoryOpen, setVictoryOpen] = useState(false)
  useEffect(() => {
    if (!finished) return undefined
    const id = setTimeout(() => setVictoryOpen(true), 900)
    return () => clearTimeout(id)
  }, [finished])

  const currentQuest = QUESTS.find((q) => !unlockedGates.includes(q.gateId))
  const nearQuest = QUESTS.find((q) => q.gateId === nearGateId)
  const nearNpc = NPCS.find((n) => n.id === nearNpcId)
  const canOpenGate =
    (nearQuest &&
      !unlockedGates.includes(nearQuest.gateId) &&
      missingItems(nearQuest, inventory).length === 0) ||
    (nearGateId === 'gate_night' &&
      unlockedGates.includes('gate_pasture') &&
      !unlockedGates.includes('gate_night'))

  let prompt = null
  if (horseRide.nearMount) prompt = 'Montar no cavalo'
  else if (canOpenGate) prompt = 'Abrir o portão'
  else if (nearNpc) {
    prompt = npcDialogueLine(nearNpc, Boolean(npcSpoke[nearNpc.id])) ?? `Falar com ${nearNpc.name}`
  }

  const resume = () => {
    setPaused(false)
    requestGameLock()
  }

  return (
    <div className={`hud ${paused ? 'hud--paused' : ''} ${isMobile ? 'hud--touch' : ''}`}>
      {/* ── objetivo ── */}
      <section className="hud-card hud-objective">
        <span className="hud-kicker">
          Fase {phase.index}/{PHASE_ORDER.length} · {isMobile ? phase.short : phase.label}
        </span>
        <p className="hud-objective-main">{hint}</p>
        {currentQuest && (
          <ul className="hud-checklist">
            {currentQuest.itemIds.map((id) => {
              const done = inventory.includes(id) || collectedEver.includes(id)
              return (
                <li key={id} className={done ? 'is-done' : ''}>
                  <span className="hud-item-icon" aria-hidden>
                    {ITEMS[id].icon}
                  </span>
                  {ITEMS[id].short}
                  {done && <span className="hud-tick">✔</span>}
                </li>
              )
            })}
          </ul>
        )}
        {!isMobile && <p className="hud-chapter">{CHAPTER_LINES[phase.id]}</p>}
        <GuideMeter isMobile={isMobile} />
      </section>

      <Compass />

      {/* ── canto direito: botões + segredos + mochila ── */}
      <div className="hud-corner">
        <div className="hud-buttons">
          <button
            type="button"
            className="hud-icon-btn"
            onClick={() => setPaused(true)}
            aria-label="Pausar"
            title="Pausar (Esc)"
          >
            ⏸
          </button>
          <button
            type="button"
            className="hud-icon-btn"
            onClick={toggleAudio}
            aria-label={audio ? 'Desligar som' : 'Ligar som'}
            title="Som"
          >
            {audio ? '🔊' : '🔇'}
          </button>
          <button
            type="button"
            className="hud-icon-btn"
            onClick={toggleFullscreen}
            aria-label="Tela cheia"
            title="Tela cheia"
          >
            ⛶
          </button>
        </div>
        <div className="hud-card hud-stars" title="Estrelinhas coletadas" key={`s${stars}`}>
          <span className="hud-star-icon" aria-hidden>
            ⭐
          </span>
          <strong>{stars}</strong>
          <span className="hud-star-total">/{STARS.length}</span>
        </div>
        <div className="hud-card hud-eggs" title="Segredos escondidos pelo vale">
          <span className="hud-kicker">
            Segredos {foundEggs.length}/{EASTER_EGGS.length}
          </span>
          <div className="hud-egg-row">
            {EASTER_EGGS.map((egg) => (
              <span
                key={egg.id}
                className={`hud-egg-icon ${foundEggs.includes(egg.id) ? 'is-found' : ''}`}
              >
                {foundEggs.includes(egg.id) ? EGG_ICONS[egg.icon] : '?'}
              </span>
            ))}
          </div>
        </div>
        {inventory.length > 0 && (
          <div className="hud-card hud-bag" title="Mochila">
            <span className="hud-kicker">Mochila</span>
            <div className="hud-bag-row">
              {inventory.map((id) => (
                <span key={id} className="hud-bag-item" title={ITEMS[id]?.name}>
                  {ITEMS[id]?.icon ?? '•'}
                </span>
              ))}
            </div>
          </div>
        )}
        {getPartyHost() && (
          <div className="mp-hud-slot">
            <MultiplayerPanel compact={isMobile} />
          </div>
        )}
      </div>

      {prompt && !paused && (
        <div className="hud-prompt">
          {!isMobile && <kbd>E</kbd>}
          <span>{prompt}</span>
        </div>
      )}

      {toast && !paused && !victoryOpen && (
        <div className="hud-toast" key={toast}>
          {toast}
        </div>
      )}

      {victoryOpen && (
        <div className="overlay">
          <div className="dialog victory-card">
            <div className="victory-burst" aria-hidden>
              ✦
            </div>
            <p className="dialog-kicker">Fim da jornada</p>
            <h2>Coração do Vale</h2>
            <p className="dialog-copy">{ENDING_TEXT}</p>
            <div className="victory-stats">
              <div className="victory-stat">
                <strong>
                  {stars}/{STARS.length}
                </strong>
                <span>estrelas</span>
              </div>
              <div className="victory-stat">
                <strong>
                  {foundEggs.length}/{EASTER_EGGS.length}
                </strong>
                <span>segredos</span>
              </div>
              <div className="victory-stat">
                <strong>{respawns}</strong>
                <span>tombos</span>
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn--primary" onClick={resetSavedGame}>
                Jogar de novo
              </button>
              <button type="button" className="btn" onClick={() => setVictoryOpen(false)}>
                Passear pelo vale
              </button>
            </div>
          </div>
        </div>
      )}

      {paused && <PauseMenu isMobile={isMobile} onResume={resume} />}
    </div>
  )
}

function PauseMenu({ isMobile, onResume }) {
  const quality = useGameStore((s) => s.quality)
  const setQuality = useGameStore((s) => s.setQuality)
  const audio = useGameStore((s) => s.audio)
  const toggleAudio = useGameStore((s) => s.toggleAudio)
  const setPaused = useGameStore((s) => s.setPaused)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="overlay">
      <div className="dialog pause-card">
        <p className="dialog-kicker">Pausa</p>
        <h2>A Jornada de Livia</h2>

        <div className="dialog-actions dialog-actions--stack">
          <button type="button" className="btn btn--primary" onClick={onResume}>
            ▶ Continuar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              playerActions.unstuck = true
              setPaused(false)
            }}
          >
            🧭 Fiquei presa — voltar para a trilha
          </button>
        </div>

        <div className="pause-section">
          <span className="hud-kicker">Como jogar</span>
          {isMobile ? (
            <ul className="pause-tips">
              <li>
                <b>Joystick</b> anda (empurre até o fim para correr)
              </li>
              <li>
                <b>Arraste</b> o dedo na tela para olhar em volta
              </li>
              <li>
                <b>Ação</b> abre portões, fala e monta no cavalo
              </li>
              <li>
                <b>✨</b> mostra o caminho até o próximo objetivo
              </li>
            </ul>
          ) : (
            <ul className="pause-keys">
              <li>
                <span>
                  <kbd>W</kbd>
                  <kbd>A</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd>
                </span>
                andar
              </li>
              <li>
                <span>
                  <kbd>Shift</kbd>
                </span>
                correr
              </li>
              <li>
                <span>
                  <kbd>Espaço</kbd>
                </span>
                pular
              </li>
              <li>
                <span>
                  <kbd>E</kbd>
                </span>
                abrir, falar, montar
              </li>
              <li>
                <span>
                  <kbd>G</kbd>
                </span>
                guia luminosa (segure)
              </li>
              <li>
                <span>
                  <kbd>Mouse</kbd>
                </span>
                olhar (clique no jogo)
              </li>
            </ul>
          )}
        </div>

        <div className="pause-section">
          <span className="hud-kicker">Gráficos</span>
          <div className="chip-row">
            {Object.values(QUALITY_PRESETS).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${quality === p.id ? 'is-active' : ''}`}
                onClick={() => setQuality(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="hud-kicker">Som</span>
          <div className="chip-row">
            <button type="button" className={`chip ${audio ? 'is-active' : ''}`} onClick={toggleAudio}>
              {audio ? '🔊 Ligado' : '🔇 Desligado'}
            </button>
          </div>
        </div>

        <div className="pause-section pause-danger">
          {confirmReset ? (
            <>
              <span>Apagar todo o progresso e começar do zero?</span>
              <div className="chip-row">
                <button type="button" className="chip chip--danger" onClick={resetSavedGame}>
                  Sim, recomeçar
                </button>
                <button type="button" className="chip" onClick={() => setConfirmReset(false)}>
                  Não
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="chip" onClick={() => setConfirmReset(true)}>
              ↺ Recomeçar do início
            </button>
          )}
        </div>
        <p className="pause-save-note">O progresso é salvo automaticamente.</p>
      </div>
    </div>
  )
}
