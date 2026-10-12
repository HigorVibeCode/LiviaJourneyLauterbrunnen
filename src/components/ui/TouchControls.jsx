import { useEffect, useRef, useState } from 'react'
import { touchInput, detectMobile } from '../../lib/touchInput'
import { useGameStore } from '../../store/gameStore'
import { useProgressStore } from '../../store/progressStore'
import { horseRide } from '../../lib/horseRide'
import { resumeAudio } from '../../audio/engine'

const JOY_RADIUS = 56

/**
 * Controles touch pensados para mãos pequenas:
 *  — joystick analógico (inclinar pouco = andar devagar, até o fim = correr)
 *  — botão de ação que diz o que faz ("Abrir", "Falar", "Montar")
 *  — botão ✨ separado para a guia luminosa
 * Pointer events + setPointerCapture: multitoque confiável e sem
 * lupa/menu do iOS ao segurar.
 */
export default function TouchControls() {
  const paused = useGameStore((s) => s.paused)
  const finished = useProgressStore((s) => s.finished)
  const nearGateId = useProgressStore((s) => s.nearGateId)
  const nearNpcId = useProgressStore((s) => s.nearNpcId)
  const [visible, setVisible] = useState(false)
  const [nearHorse, setNearHorse] = useState(false)
  const joyRef = useRef(null)
  const baseRef = useRef(null)
  const joyOrigin = useRef({ x: 0, y: 0 })
  const joyPointer = useRef(null)

  const resetMove = () => {
    touchInput.moveX = 0
    touchInput.moveY = 0
    touchInput.analog = false
    touchInput.run = false
    if (joyRef.current) joyRef.current.style.transform = 'translate(-50%, -50%)'
  }

  useEffect(() => {
    setVisible(detectMobile())
    const onResize = () => setVisible(detectMobile())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNearHorse(horseRide.nearMount), 200)
    return () => clearInterval(id)
  }, [])

  const hidden = !visible || paused || finished
  useEffect(() => {
    if (hidden) {
      resetMove()
      joyPointer.current = null
      touchInput.jump = false
      touchInput.interact = false
      touchInput.guide = false
    }
  }, [hidden])

  if (hidden) return null

  const applyJoy = (clientX, clientY) => {
    const dx = clientX - joyOrigin.current.x
    const dy = clientY - joyOrigin.current.y
    const len = Math.hypot(dx, dy)
    const clamped = Math.min(JOY_RADIUS, len)
    const mag = clamped / JOY_RADIUS
    // zona morta pela distância (não por eixo) → direção livre, sem zigue-zague
    const live = mag < 0.12 ? 0 : (mag - 0.12) / 0.88
    const nx = len > 0 ? dx / len : 0
    const ny = len > 0 ? dy / len : 0
    touchInput.moveX = nx * live
    touchInput.moveY = ny * live
    touchInput.analog = live > 0
    touchInput.run = live > 0.92
    if (joyRef.current) {
      joyRef.current.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`
    }
  }

  const onJoyDown = (e) => {
    if (joyPointer.current != null) return
    e.preventDefault()
    void resumeAudio()
    const rect = baseRef.current?.getBoundingClientRect()
    if (!rect) return
    joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    joyPointer.current = e.pointerId
    e.currentTarget.setPointerCapture?.(e.pointerId)
    applyJoy(e.clientX, e.clientY)
  }

  const onJoyMove = (e) => {
    if (e.pointerId !== joyPointer.current) return
    e.preventDefault()
    applyJoy(e.clientX, e.clientY)
  }

  const onJoyUp = (e) => {
    if (e.pointerId !== joyPointer.current) return
    joyPointer.current = null
    resetMove()
  }

  const bindBtn = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault()
      e.stopPropagation()
      void resumeAudio()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      touchInput[key] = true
    },
    onPointerUp: () => {
      touchInput[key] = false
    },
    onPointerCancel: () => {
      touchInput[key] = false
    },
    onContextMenu: (e) => e.preventDefault(),
  })

  let actionLabel = 'Ação'
  if (nearHorse) actionLabel = 'Montar'
  else if (nearNpcId) actionLabel = 'Falar'
  else if (nearGateId) actionLabel = 'Abrir'

  return (
    <div className="touch-controls">
      <div
        ref={baseRef}
        className="touch-joy-base"
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div ref={joyRef} className="touch-joy-stick" />
      </div>

      <div className="touch-actions">
        <button type="button" className="touch-btn touch-btn--guide" {...bindBtn('guide')}>
          <span aria-hidden>✨</span>
          <small>Guia</small>
        </button>
        <button
          type="button"
          className={`touch-btn touch-btn--interact ${actionLabel !== 'Ação' ? 'is-hot' : ''}`}
          {...bindBtn('interact')}
        >
          {actionLabel}
        </button>
        <button type="button" className="touch-btn touch-btn--jump" {...bindBtn('jump')}>
          Pular
        </button>
      </div>
    </div>
  )
}
