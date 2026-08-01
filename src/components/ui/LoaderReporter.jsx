import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'
import { setBootPhase, setLoadingProgress } from '../../store/loadingStore'

/** Dentro do Canvas — reporta progresso do Suspense/useGLTF para o overlay HTML. */
export function LoaderReporter() {
  const { progress, active } = useProgress()

  useEffect(() => {
    setLoadingProgress(progress, active)
    setBootPhase('assets', progress / 100)
  }, [progress, active])

  return null
}
