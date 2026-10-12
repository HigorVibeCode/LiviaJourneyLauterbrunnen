import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { setBootPhase, markBootReady } from '../../store/loadingStore'

/**
 * Compila shaders e força alguns frames enquanto o overlay cobre a tela.
 * Fica DENTRO do Suspense do mundo e espera os GLBs terminarem — antes
 * marcava "pronto" com a cena quase vazia e o pack de cenário aparecia
 * depois, travando o começo do jogo.
 */
export default function BootWarmup() {
  const { gl, scene, camera } = useThree()
  const { active, progress } = useProgress()
  const started = useRef(false)
  const unmounted = useRef(false)
  useEffect(() => () => {
    unmounted.current = true
  }, [])
  // rede lenta/sem loaders rastreados: não fica preso no loading para sempre
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    setBootPhase('world', 0.5)
    const id = setTimeout(() => setTimedOut(true), 20000)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (started.current) return undefined
    if (!timedOut && (active || progress < 100)) return undefined
    started.current = true
    let frames = 0
    const run = async () => {
      setBootPhase('shaders', 0.3)
      // compileAsync pode nunca terminar (contexto perdido, material descartado):
      // no máximo 8 s esperando, depois segue de qualquer jeito
      const wait = (ms) => new Promise((r) => setTimeout(r, ms))
      try {
        if (gl.compileAsync) await Promise.race([gl.compileAsync(scene, camera).catch(() => {}), wait(8000)])
        else gl.compile(scene, camera)
      } catch {
        /* sem pré-compilação: os shaders compilam no primeiro frame */
      }
      const tick = () => {
        if (unmounted.current) return
        frames += 1
        setBootPhase('shaders', 0.5 + (frames / 4) * 0.45)
        if (frames < 4) requestAnimationFrame(tick)
        else {
          setBootPhase('ready', 1)
          markBootReady()
        }
      }
      requestAnimationFrame(tick)
    }
    run()
    return undefined
  }, [active, progress, timedOut, gl, scene, camera])

  return null
}
