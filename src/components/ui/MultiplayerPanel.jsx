import { useEffect, useState } from 'react'
import { useMultiplayerStore } from '../../multiplayer/multiplayerStore'
import { getPartyHost, randomRoomId, MAX_NAME_LEN } from '../../multiplayer/config'

export default function MultiplayerPanel({ compact = false }) {
  const status = useMultiplayerStore((s) => s.status)
  const roomId = useMultiplayerStore((s) => s.roomId)
  const peerCount = useMultiplayerStore((s) => s.peerCount)
  const displayName = useMultiplayerStore((s) => s.displayName)
  const setDisplayName = useMultiplayerStore((s) => s.setDisplayName)
  const error = useMultiplayerStore((s) => s.error)
  const [open, setOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState(displayName)
  const [copied, setCopied] = useState(false)
  const hostOk = Boolean(getPartyHost())

  useEffect(() => {
    setNameDraft(displayName)
  }, [displayName])

  const join = (id) => {
    const name = nameDraft.trim().slice(0, MAX_NAME_LEN) || 'Viajante'
    setDisplayName(name)
    window.__liviaMp?.connect(id, name)
    setOpen(false)
  }

  const leave = () => {
    window.__liviaMp?.leave()
  }

  const share = async () => {
    if (!roomId) return
    const url = new URL(window.location.href)
    url.searchParams.set('sala', roomId)
    try {
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copia o link da sala:', url.toString())
    }
  }

  if (compact && status === 'connected') {
    return (
      <button
        type="button"
        className="mp-chip"
        onClick={() => setOpen(true)}
        title="Multijogador"
      >
        Online · {peerCount + 1}
      </button>
    )
  }

  return (
    <div className="mp-wrap">
      {status === 'connected' ? (
        <div className="mp-bar">
          <span className="mp-bar-label">
            Sala <strong>{roomId}</strong> · {peerCount + 1} jogador{peerCount + 1 === 1 ? '' : 'es'}
          </span>
          <button type="button" className="pause-btn pause-btn--chip" onClick={share}>
            {copied ? 'Link copiado' : 'Partilhar'}
          </button>
          <button type="button" className="pause-btn pause-btn--chip" onClick={leave}>
            Sair
          </button>
        </div>
      ) : (
        <button type="button" className="mp-chip" onClick={() => setOpen(true)}>
          Jogar com amigos
        </button>
      )}

      {open && (
        <div className="mp-modal" role="dialog" aria-label="Multijogador">
          <div className="mp-card hud-magic">
            <button type="button" className="mp-close" onClick={() => setOpen(false)} aria-label="Fechar">
              ×
            </button>
            <span className="hud-panel-label">Multijogador</span>
            <p className="mp-blurb">
              Criem uma sala, partilhem o link e vejam-se no vale. Cada um avança a própria história.
            </p>

            {!hostOk && (
              <p className="mp-warn">
                Servidor PartyKit não configurado. Em local: <code>npx partykit dev</code>. Em
                produção: faz deploy e define <code>VITE_PARTYKIT_HOST</code>.
              </p>
            )}

            {(status === 'error' || status === 'full') && error && (
              <p className="mp-warn">{error}</p>
            )}

            {status === 'connected' && roomId ? (
              <>
                <p className="mp-blurb">
                  Sala <strong>{roomId}</strong> · {peerCount + 1} jogador
                  {peerCount + 1 === 1 ? '' : 'es'}
                </p>
                <div className="mp-actions">
                  <button type="button" className="pause-btn pause-btn--primary" onClick={share}>
                    {copied ? 'Link copiado' : 'Partilhar link'}
                  </button>
                  <button
                    type="button"
                    className="pause-btn"
                    onClick={() => {
                      leave()
                      setOpen(false)
                    }}
                  >
                    Sair da sala
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="mp-field">
                  O teu nome
                  <input
                    value={nameDraft}
                    maxLength={MAX_NAME_LEN}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Viajante"
                  />
                </label>

                <div className="mp-actions">
                  <button
                    type="button"
                    className="pause-btn pause-btn--primary"
                    disabled={!hostOk || status === 'connecting'}
                    onClick={() => join(randomRoomId())}
                  >
                    {status === 'connecting' ? 'A ligar…' : 'Criar sala'}
                  </button>
                  <button
                    type="button"
                    className="pause-btn"
                    disabled={!hostOk || status === 'connecting'}
                    onClick={() => {
                      const id = window.prompt('Código da sala (ex.: a3k9m2)')
                      if (id && id.trim()) join(id.trim().toLowerCase())
                    }}
                  >
                    Entrar com código
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
