import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STARS } from '../config/stars'
import { playerPosition } from '../store/playerStore'
import { useProgressStore } from '../store/progressStore'
import { useGameStore } from '../store/gameStore'
import { horseRide } from '../lib/horseRide'
import { sfxStar } from '../audio/sfx'

const PICK_R = 1.5
const PICK_R_HORSE = 2.6
const COMBO_WINDOW = 1.4
const POP_TIME = 0.35

const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const p = new THREE.Vector3()
const sc = new THREE.Vector3()

function starGeometry() {
  const shape = new THREE.Shape()
  const spikes = 5
  const outer = 0.42
  const inner = 0.19
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 1,
  })
  geo.center()
  return geo
}

/**
 * Estrelinhas douradas: UM InstancedMesh para todas (1 draw call).
 * Giram e flutuam; ao passar perto, "pulam" e somem com um plim.
 */
export default function StarTrail() {
  const ref = useRef(null)
  const geometry = useMemo(() => starGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffd23f',
        emissive: '#ffb000',
        emissiveIntensity: 0.55,
        metalness: 0.3,
        roughness: 0.35,
      }),
    [],
  )
  /** quando cada estrela foi pega (para a animação de "pop") */
  const poppedAt = useRef(new Map())
  const combo = useRef({ n: 0, last: -10 })
  const collectedSet = useRef({ arr: null, set: new Set() })

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    const arr = useProgressStore.getState().stars
    if (collectedSet.current.arr !== arr) collectedSet.current = { arr, set: new Set(arr) }
    const collected = collectedSet.current.set
    const paused = useGameStore.getState().paused
    const riding = horseRide.mounted
    const r = riding ? PICK_R_HORSE : PICK_R

    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i]
      let scale = 1
      let lift = 0
      const popT = poppedAt.current.get(i)
      if (popT !== undefined) {
        const k = (t - popT) / POP_TIME
        scale = k >= 1 ? 0 : (1 - k) * 1.4
        lift = k * 1.6
      } else if (collected.has(i)) {
        scale = 0
      } else if (!paused) {
        const dx = s.x - playerPosition.x
        const dz = s.z - playerPosition.z
        const dy = s.y - (playerPosition.y + 1)
        if (dx * dx + dz * dz < r * r && Math.abs(dy) < 2.6) {
          poppedAt.current.set(i, t)
          combo.current.n = t - combo.current.last < COMBO_WINDOW ? combo.current.n + 1 : 0
          combo.current.last = t
          sfxStar(combo.current.n)
          useProgressStore.getState().collectStar(i)
        }
      }
      e.set(0, t * 2.2 + i * 0.7, 0)
      q.setFromEuler(e)
      p.set(s.x, s.y + Math.sin(t * 2 + i) * 0.12 + lift, s.z)
      sc.setScalar(scale)
      m4.compose(p, q, sc)
      mesh.setMatrixAt(i, m4)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, STARS.length]}
      frustumCulled={false}
      userData={{ noCull: true }}
    />
  )
}
