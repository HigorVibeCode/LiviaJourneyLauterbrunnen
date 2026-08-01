import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { setBootPhase, markBootReady } from '../../store/loadingStore'

/**
 * Compila shaders e força frames iniciais enquanto o overlay cobre a tela.
 */
export default function BootWarmup() {
  const { gl, scene, camera } = useThree()
  const frames = useRef(0)
  const done = useRef(false)

  useEffect(() => {
    setBootPhase('world', 0.5)
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(function tick() {
      if (done.current) return
      gl.compile(scene, camera)
      frames.current += 1
      const t = frames.current / 3
      setBootPhase('shaders', 0.5 + t * 0.45)
      if (frames.current < 3) requestAnimationFrame(tick)
      else {
        done.current = true
        setBootPhase('ready', 1)
        markBootReady()
      }
    })
    return () => cancelAnimationFrame(id)
  }, [gl, scene, camera])

  return null
}
