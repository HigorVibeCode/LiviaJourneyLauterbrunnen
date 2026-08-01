import { useEffect, useState } from 'react'
import { useProgressStore, ITEMS, QUESTS, missingItems } from '../store/progressStore'
import { QUALITY_PRESETS, useGameStore } from '../store/gameStore'
import { playerPosition, usePlayerStore } from '../store/playerStore'
import { PHASES, PHASE_ORDER, CHAPTER_LINES } from '../config/world'
import { EASTER_EGGS, EGG_ICONS } from '../config/easterEggs'
import { NPCS } from '../config/npcs'
import { npcInteractHint, npcDialogueLine } from './NPC'
import { GUIDE_MAX_CHARGE, guideInput } from '../lib/guideInput'
import { horseRide } from '../lib/horseRide'

function useObjectiveHint() {
  const inventory = useProgressStore((s) => s.inventory)
  const unlockedGates = useProgressStore((s) => s.unlockedGates)
  const nearGateId = useProgressStore((s) => s.nearGateId)
  const finished = useProgressStore((s) => s.finished)
  const [horseTick, setHorseTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setHorseTick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])

  if (finished) return 'O Coração do Vale pulsa no mirante. A promessa foi cumprida.'

  if (unlockedGates.includes('gate_pasture') && !unlockedGates.includes('gate_night')) {
    void horseTick
    if (horseRide.mounted) return 'Cavalgue pelo pasto até o Vale Noturno'
    if (horseRide.nearMount) return 'Pressione E para montar o cavalo'
    return 'Monte o cavalo ao lado do portão e atravesse o pasto'
  }

  const quest = QUESTS.find((q) => !unlockedGates.includes(q.gateId))
  if (!quest) {
    if (unlockedGates.includes('gate_summit')) {
      return 'Aproveite o Prado Florido e suba a escadaria até o tesouro alpino!'
    }
    return 'Suba a escadaria até o mirante e encontre o tesouro alpino!'
  }

  const missing = missingItems(quest, inventory)

  if (nearGateId === quest.gateId) {
    return missing.length
      ? `${quest.nearGateHint.split('.')[0]}. Falta: ${missing.map((id) => ITEMS[id].name).join(' e ')}`
      : quest.interactHint
  }

  if (missing.length === 0) return `Tudo em mãos! Vá ao portão e toque E`
  if (missing.length === 1) return `Falta encontrar: ${ITEMS[missing[0]].name}`
  return quest.hint
}

/** Nome do bioma + linha de capítulo */
function usePhaseInfo() {
  const [info, setInfo] = useState({ label: PHASES.meadow.label, chapter: CHAPTER_LINES.meadow })

  useEffect(() => {
    const tick = () => {
      const z = playerPosition.z
      let found = PHASES.meadow
      for (const id of PHASE_ORDER) {
        const p = PHASES[id]
        if (z >= p.zFrom && z <= p.zTo) {
          found = p
          break
        }
        if (z < p.zFrom) found = p
      }
      setInfo({ label: found.label, chapter: CHAPTER_LINES[found.id] ?? '' })
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [])

  return info
}

/** Tela de vitória: aparece após o voo da fênix */
function useVictory() {
  const finished = useProgressStore((s) => s.finished)
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!finished) return undefined
    const id = setTimeout(() => setShow(true), 900)
    return () => clearTimeout(id)
  }, [finished])

  return { show: show && !dismissed, dismiss: () => setDismissed(true) }
}

export default function Hud() {
  const hint = useObjectiveHint()
  const phaseInfo = usePhaseInfo()
  const victory = useVictory()
  const toast = useProgressStore((s) => s.toast)
  const inventory = useProgressStore((s) => s.inventory)
  const collectedEver = useProgressStore((s) => s.collectedEver)
  const foundEggs = useProgressStore((s) => s.foundEggs)
  const nearGateId = useProgressStore((s) => s.nearGateId)
  const nearNpcId = useProgressStore((s) => s.nearNpcId)
  const unlockedGates = useProgressStore((s) => s.unlockedGates)
  const respawns = usePlayerStore((s) => s.respawns)
  const paused = useGameStore((s) => s.paused)
  const setPaused = useGameStore((s) => s.setPaused)
  const quality = useGameStore((s) => s.quality)
  const setQuality = useGameStore((s) => s.setQuality)
  const audio = useGameStore((s) => s.audio)
  const toggleAudio = useGameStore((s) => s.toggleAudio)
  const isMobile = useGameStore((s) => s.isMobile)

  const currentQuest = QUESTS.find((q) => !unlockedGates.includes(q.gateId))
  const nearQuest = QUESTS.find((q) => q.gateId === nearGateId)
  const nearNpc = NPCS.find((n) => n.id === nearNpcId)
  const npcSpoke = useProgressStore((s) => s.npcSpoke)
  const canInteract =
    nearQuest &&
    !unlockedGates.includes(nearQuest.gateId) &&
    missingItems(nearQuest, inventory).length === 0

  const phaseNumber = Math.min(unlockedGates.length + 1, PHASE_ORDER.length)
  const [guideCharge, setGuideCharge] = useState(GUIDE_MAX_CHARGE)
  const [guideDepleted, setGuideDepleted] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setGuideCharge(guideInput.charge)
      setGuideDepleted(guideInput.depleted)
    }, 80)
    return () => clearInterval(id)
  }, [])

  const chargePct = Math.max(0, Math.min(100, (guideCharge / GUIDE_MAX_CHARGE) * 100))

  return (
    <div className={`hud ${paused ? 'hud--paused' : ''}`}>
      <div className="hud-panel hud-objective hud-magic">
        <span className="hud-ornament hud-ornament--tl" aria-hidden>
          ◆
        </span>
        <span className="hud-ornament hud-ornament--br" aria-hidden>
          ◆
        </span>
        <span className="hud-panel-label">
          Fase {phaseNumber} de {PHASE_ORDER.length} · {phaseInfo.label}
        </span>
        <p className="hud-chapter">{phaseInfo.chapter}</p>
        <p>{hint}</p>

        {currentQuest && (
          <ul className="hud-checklist">
            {currentQuest.itemIds.map((id) => (
              <li key={id} className={inventory.includes(id) ? 'is-done' : ''}>
                <span className="hud-check">{inventory.includes(id) ? '✔' : '○'}</span>
                {ITEMS[id].name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={`hud-panel hud-guide-charge hud-magic ${guideDepleted ? 'is-depleted' : ''}`}
      >
        <span className="hud-panel-label">Guia luminosa</span>
        <div className="hud-charge-track" aria-hidden>
          <div className="hud-charge-fill" style={{ width: `${chargePct}%` }} />
        </div>
        <p className="hud-charge-hint">
          {guideDepleted
            ? 'Recarregando… aguarde um momento'
            : isMobile
              ? `${guideCharge.toFixed(1)}s · segure o botão E`
              : `${guideCharge.toFixed(1)}s restantes · segure E`}
        </p>
      </div>

      {canInteract && (
        <div className="hud-interact hud-magic">
          <kbd>E</kbd>
          <span>Abrir portão</span>
        </div>
      )}

      {nearNpc && (
        <div className="hud-interact hud-magic">
          <kbd>E</kbd>
          <span>{npcDialogueLine(nearNpc, Boolean(npcSpoke[nearNpc.id])) ?? npcInteractHint(nearNpc)}</span>
        </div>
      )}

      <div className="hud-panel hud-eggs hud-magic">
        <span className="hud-panel-label">Segredos {foundEggs.length}/{EASTER_EGGS.length}</span>
        <div className="hud-egg-row">
          {EASTER_EGGS.map((egg) => (
            <span
              key={egg.id}
              className={`hud-egg-icon ${foundEggs.includes(egg.id) ? 'is-found' : ''}`}
              title={egg.id}
            >
              {foundEggs.includes(egg.id) ? EGG_ICONS[egg.icon] : '○'}
            </span>
          ))}
        </div>
      </div>

      {inventory.length > 0 && (
        <div className="hud-panel hud-inventory hud-magic">
          <span className="hud-ornament hud-ornament--tr" aria-hidden>
            ✦
          </span>
          <span className="hud-panel-label">Mochila</span>
          <ul>
            {inventory.map((id) => (
              <li key={id}>{ITEMS[id]?.name ?? id}</li>
            ))}
          </ul>
        </div>
      )}

      {toast && !paused && !victory.show && <div className="hud-toast hud-magic">{toast}</div>}

      {victory.show && (
        <div className="pause-overlay">
          <div className="pause-card victory-card hud-magic">
            <p className="pause-kicker">Fim da jornada</p>
            <h2>Coração do Vale</h2>
            <p className="pause-copy">{ENDING_TEXT}</p>

            <div className="victory-stats">
              <div className="victory-stat">
                <strong>{collectedEver.length}</strong>
                <span>itens encontrados</span>
              </div>
              <div className="victory-stat">
                <strong>{unlockedGates.length}</strong>
                <span>portões abertos</span>
              </div>
              <div className="victory-stat">
                <strong>{respawns}</strong>
                <span>tombos no caminho</span>
              </div>
            </div>

            <div className="pause-actions">
              <button
                type="button"
                className="pause-btn pause-btn--primary"
                onClick={() => window.location.reload()}
              >
                Jogar novamente
              </button>
              <button type="button" className="pause-btn" onClick={victory.dismiss}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {paused && (
        <div className="pause-overlay">
          <div className="pause-card pause-card--menu hud-magic">
            <p className="pause-kicker">Menu · ESC</p>
            <h2>A Jornada de Livia</h2>
            <p className="pause-copy">
              Explore o vale alpino, colete dois itens por fase e abra os portões até o mirante.
              O objetivo atual fica no canto da tela enquanto você joga.
            </p>

            {!isMobile ? (
            <div className="pause-help">
              <span className="hud-panel-label">Controles</span>
              <ul className="pause-help-list">
                <li>
                  <kbd>W</kbd>
                  <kbd>A</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd>
                  <span>Andar</span>
                </li>
                <li>
                  <kbd>Mouse</kbd>
                  <span>Olhar / girar a câmera (clique no jogo para capturar)</span>
                </li>
                <li>
                  <kbd>Shift</kbd>
                  <span>Correr</span>
                </li>
                <li>
                  <kbd>Espaço</kbd>
                  <span>Pular</span>
                </li>
                <li>
                  <kbd>E</kbd>
                  <span>Abrir portão, montar o cavalo ou pegar interação próxima</span>
                </li>
                <li>
                  <kbd>Segurar E</kbd>
                  <span>Ativar a guia luminosa (aponta o próximo objetivo)</span>
                </li>
                <li>
                  <kbd>ESC</kbd>
                  <span>Pausar / abrir este menu</span>
                </li>
              </ul>
            </div>
            ) : (
            <div className="pause-help">
              <span className="hud-panel-label">Controles (toque)</span>
              <ul className="pause-help-tips">
                <li>Joystick esquerdo — andar</li>
                <li>Correr / Pular / E — botões à direita</li>
                <li>Segure E — guia luminosa</li>
              </ul>
            </div>
            )}

            <div className="pause-help">
              <span className="hud-panel-label">Como jogar</span>
              <ul className="pause-help-tips">
                <li>Cada fase tem dois itens escondidos — encontre-os antes de abrir o portão.</li>
                <li>Chegue perto do portão e pressione E quando a mochila estiver completa.</li>
                <li>No pasto, monte o cavalo com E e cavalque até o Vale Noturno.</li>
                <li>A guia luminosa gasta carga, mas recarrega lentamente quando não está em uso.</li>
                <li>Evite cair na água gelada e na cachoeira — a Livia volta ao último lugar seguro.</li>
              </ul>
            </div>

            <div className="pause-quality">
              <span className="hud-panel-label">Qualidade gráfica</span>
              <div className="pause-quality-row">
                {Object.values(QUALITY_PRESETS).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pause-btn pause-btn--chip ${quality === p.id ? 'is-active' : ''}`}
                    onClick={() => setQuality(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pause-quality">
              <span className="hud-panel-label">Som</span>
              <div className="pause-quality-row">
                <button
                  type="button"
                  className={`pause-btn pause-btn--chip ${audio ? 'is-active' : ''}`}
                  onClick={toggleAudio}
                >
                  {audio ? 'Ligado' : 'Desligado'}
                </button>
              </div>
            </div>

            <div className="pause-actions">
              <button
                type="button"
                className="pause-btn pause-btn--primary"
                onClick={() => setPaused(false)}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
