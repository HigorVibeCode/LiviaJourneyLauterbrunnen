import { useEffect, useRef, useState } from 'react'
import { touchInput, detectMobile } from '../../lib/touchInput'
import { useGameStore } from '../../store/gameStore'

const JOY_RADIUS = 52

/**
 * Controles touch: joystick esquerdo + Jump / Run / E à direita.
 * O arrasto da câmera fica no Livia (qualquer área fora destes controlos).
 */
export default function TouchControls() {
  const paused = useGameStore((s) => s.paused)
  const [visible, setVisible] = useState(false)
  const joyRef = useRef(null)
  const baseRef = useRef(null)
  const joyOrigin = useRef({ x: 0, y: 0 })
  const joyActive = useRef(false)
  const joyPointer = useRef(null)

  const resetMove = () => {
    touchInput.forward = false
    touchInput.back = false
    touchInput.left = false
    touchInput.right = false
  }

  useEffect(() => {
    setVisible(detectMobile())
    const onResize = () => setVisible(detectMobile())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!visible || paused) {
      resetMove()
      joyActive.current = false
      joyPointer.current = null
      if (joyRef.current) joyRef.current.style.transform = 'translate(-50%, -50%)'
    }
  }, [paused, visible])

  if (!visible) return null

  const applyJoy = (clientX, clientY) => {
    const dx = clientX - joyOrigin.current.x
    const dy = clientY - joyOrigin.current.y
    const len = Math.hypot(dx, dy)
    const nx = len > 0 ? dx / len : 0
    const ny = len > 0 ? dy / len : 0
    const mag = Math.min(1, len / JOY_RADIUS)
    // limiar baixo — responde melhor a toques pequenos
    const dead = 0.18
    touchInput.forward = ny < -dead
    touchInput.back = ny > dead
    touchInput.left = nx < -dead
    touchInput.right = nx > dead
    // correr automático se empurrar o stick ao máximo
    touchInput.run = mag > 0.92
    if (joyRef.current) {
      const clamped = Math.min(JOY_RADIUS, len)
      const angle = Math.atan2(dy, dx)
      joyRef.current.style.transform = `translate(calc(-50% + ${Math.cos(angle) * clamped}px), calc(-50% + ${Math.sin(angle) * clamped}px))`
    }
  }

  const onJoyStart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const t = e.changedTouches?.[0]
    if (!t || !baseRef.current) return
    const rect = baseRef.current.getBoundingClientRect()
    joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    joyActive.current = true
    joyPointer.current = t.identifier
    applyJoy(t.clientX, t.clientY)
  }

  const onJoyMove = (e) => {
    if (!joyActive.current) return
    const t = [...e.touches].find((x) => x.identifier === joyPointer.current)
    if (!t) return
    e.preventDefault()
    e.stopPropagation()
    applyJoy(t.clientX, t.clientY)
  }

  const onJoyEnd = (e) => {
    const ended = [...e.changedTouches].some((t) => t.identifier === joyPointer.current)
    if (!ended && joyPointer.current != null) return
    e.preventDefault()
    joyActive.current = false
    joyPointer.current = null
    resetMove()
    touchInput.run = false
    if (joyRef.current) joyRef.current.style.transform = 'translate(-50%, -50%)'
  }

  const bindBtn = (key) => ({
    onTouchStart: (e) => {
      e.preventDefault()
      e.stopPropagation()
      touchInput[key] = true
    },
    onTouchEnd: (e) => {
      e.preventDefault()
      e.stopPropagation()
      touchInput[key] = false
    },
    onTouchCancel: (e) => {
      e.preventDefault()
      touchInput[key] = false
    },
  })

  return (
    <div className={`touch-controls ${paused ? 'is-paused' : ''}`} aria-hidden={paused}>
      <div
        ref={baseRef}
        className="touch-joy-base"
        onTouchStart={onJoyStart}
        onTouchMove={onJoyMove}
        onTouchEnd={onJoyEnd}
        onTouchCancel={onJoyEnd}
      >
        <div ref={joyRef} className="touch-joy-stick" />
        <span className="touch-joy-hint">Mover</span>
      </div>

      <div className="touch-actions">
        <button type="button" className="touch-btn touch-btn--jump" {...bindBtn('jump')}>
          Pular
        </button>
        <button type="button" className="touch-btn touch-btn--interact" {...bindBtn('interact')}>
          E
        </button>
      </div>

      <p className="touch-look-hint">Arraste o dedo para olhar</p>
    </div>
  )
}
