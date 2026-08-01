import { useEffect, useRef, useState } from 'react'
import { touchInput, detectMobile } from '../../lib/touchInput'
import { useGameStore } from '../../store/gameStore'

const JOY_RADIUS = 52

/**
 * Controles touch: joystick esquerdo + Jump / Run / E à direita.
 * Só aparece em mobile / touch detectado.
 */
export default function TouchControls() {
  const paused = useGameStore((s) => s.paused)
  const [visible, setVisible] = useState(false)
  const joyRef = useRef(null)
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
    if (!visible || paused) resetMove()
  }, [paused, visible])

  if (!visible) return null

  const applyJoy = (dx, dy) => {
    const len = Math.hypot(dx, dy)
    const nx = len > 0 ? dx / len : 0
    const ny = len > 0 ? dy / len : 0
    const mag = Math.min(1, len / JOY_RADIUS)
    touchInput.forward = ny < -0.25 * mag
    touchInput.back = ny > 0.25 * mag
    touchInput.left = nx < -0.25 * mag
    touchInput.right = nx > 0.25 * mag
    if (joyRef.current) {
      const clamped = Math.min(JOY_RADIUS, len)
      const angle = Math.atan2(dy, dx)
      joyRef.current.style.transform = `translate(calc(-50% + ${Math.cos(angle) * clamped}px), calc(-50% + ${Math.sin(angle) * clamped}px))`
    }
  }

  const onJoyStart = (e) => {
    e.preventDefault()
    const t = e.changedTouches?.[0] ?? e
    const rect = e.currentTarget.getBoundingClientRect()
    joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    joyActive.current = true
    joyPointer.current = t.identifier ?? 'mouse'
    applyJoy(t.clientX - joyOrigin.current.x, t.clientY - joyOrigin.current.y)
  }

  const onJoyMove = (e) => {
    if (!joyActive.current) return
    const t =
      e.changedTouches?.length
        ? [...e.changedTouches].find((x) => x.identifier === joyPointer.current) ?? e.changedTouches[0]
        : e
    if (t.identifier !== undefined && joyPointer.current !== t.identifier && joyPointer.current !== 'mouse') return
    e.preventDefault()
    applyJoy(t.clientX - joyOrigin.current.x, t.clientY - joyOrigin.current.y)
  }

  const onJoyEnd = (e) => {
    e.preventDefault()
    joyActive.current = false
    joyPointer.current = null
    resetMove()
    if (joyRef.current) joyRef.current.style.transform = 'translate(-50%, -50%)'
  }

  const bindBtn = (key) => ({
    onTouchStart: (e) => {
      e.preventDefault()
      touchInput[key] = true
    },
    onTouchEnd: (e) => {
      e.preventDefault()
      touchInput[key] = false
    },
    onMouseDown: (e) => {
      e.preventDefault()
      touchInput[key] = true
    },
    onMouseUp: () => {
      touchInput[key] = false
    },
    onMouseLeave: () => {
      touchInput[key] = false
    },
  })

  return (
    <div className="touch-controls" aria-hidden={paused}>
      <div
        className="touch-joy-base"
        onTouchStart={onJoyStart}
        onTouchMove={onJoyMove}
        onTouchEnd={onJoyEnd}
        onTouchCancel={onJoyEnd}
        onMouseDown={onJoyStart}
        onMouseMove={onJoyMove}
        onMouseUp={onJoyEnd}
        onMouseLeave={onJoyEnd}
      >
        <div ref={joyRef} className="touch-joy-stick" />
      </div>

      <div className="touch-actions">
        <button type="button" className="touch-btn touch-btn--run" {...bindBtn('run')}>
          Correr
        </button>
        <button type="button" className="touch-btn touch-btn--jump" {...bindBtn('jump')}>
          Pular
        </button>
        <button type="button" className="touch-btn touch-btn--interact" {...bindBtn('interact')}>
          E
        </button>
      </div>
    </div>
  )
}
