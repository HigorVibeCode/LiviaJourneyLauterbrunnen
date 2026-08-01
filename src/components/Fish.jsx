import { useMemo, useRef } from 'react'
import ToonMat from '../materials/ToonMat'
import { useFrame } from '@react-three/fiber'
import {
  RIVER,
  PONDS,
  STREAMS,
  CORRIDOR_HALF,
  makeRng,
  pathXAt,
  resolveOnPath,
} from '../config/world'
import { useGameStore } from '../store/gameStore'

const JUMP_DURATION = 1.15

/**
 * Peixes saltando da água (rio, riachos e lagos da fase 2).
 * Cada peixe fica submerso (invisível) e periodicamente descreve um arco
 * fora d'água — barato e dá muita vida às águas.
 */
export default function Fish() {
  const paused = useGameStore((s) => s.paused)

  const fishes = useMemo(() => {
    const rng = makeRng(2626)
    const list = []

    const add = (x, z, baseY, scale, jumpH) =>
      list.push({
        x,
        z,
        baseY,
        scale,
        jumpH,
        period: 3.5 + rng() * 6,
        phase: rng() * 12,
        dir: rng() * Math.PI * 2,
        travel: 0.9 + rng() * 1.4,
        color: rng() > 0.5 ? '#8fb4c4' : '#a8c4b0',
      })

    // rio do desfiladeiro (centrado na trilha)
    const riverCx = pathXAt((RIVER.zFrom + RIVER.zTo) / 2)
    for (let i = 0; i < 7; i++) {
      add(
        riverCx + (rng() * 2 - 1) * (RIVER.gapHalfX - 2),
        RIVER.zFrom + 4 + rng() * (RIVER.zTo - RIVER.zFrom - 8),
        RIVER.waterY + 0.55,
        0.8 + rng() * 0.5,
        1.6 + rng() * 1,
      )
    }

    // riachos
    STREAMS.forEach((s) => {
      const cx = pathXAt(s.z)
      for (let i = 0; i < 4; i++) {
        const lat = (rng() * 2 - 1) * (CORRIDOR_HALF - 10)
        if (Math.abs(lat) < 4) continue
        add(cx + lat, s.z + (rng() - 0.5) * s.halfZ, 0.1, 0.5 + rng() * 0.3, 0.8 + rng() * 0.5)
      }
    })

    // lagos (menos o congelado)
    PONDS.filter((p) => !p.frozen).forEach((p) => {
      const world = resolveOnPath(p)
      for (let i = 0; i < 4; i++) {
        const a = rng() * Math.PI * 2
        const r = rng() * (p.r - 2)
        add(world.x + Math.cos(a) * r, world.z + Math.sin(a) * r, 0.12, 0.7 + rng() * 0.4, 1.1 + rng() * 0.8)
      }
    })

    return list
  }, [])

  const refs = useRef([])

  useFrame((state) => {
    if (paused) return
    const t = state.clock.elapsedTime

    for (let i = 0; i < fishes.length; i++) {
      const group = refs.current[i]
      const f = fishes[i]
      if (!group) continue

      const cycle = (t + f.phase) % f.period
      if (cycle >= JUMP_DURATION) {
        group.visible = false
        continue
      }

      const k = cycle / JUMP_DURATION
      const arc = Math.sin(k * Math.PI)
      group.visible = true
      group.position.set(
        f.x + Math.cos(f.dir) * (k - 0.5) * f.travel,
        f.baseY + arc * f.jumpH,
        f.z + Math.sin(f.dir) * (k - 0.5) * f.travel,
      )
      // nariz para cima na subida, mergulho de cabeça na descida
      group.rotation.set(0, -f.dir, (k * 2 - 1) * 1.9)
    }
  })

  return (
    <group>
      {fishes.map((f, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          visible={false}
          scale={f.scale}
        >
          {/* corpo */}
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.12, 0.3, 4, 6]} />
            <ToonMat
              color={f.color}/>
          </mesh>
          {/* barriga clara */}
          <mesh position={[0, -0.05, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.8, 0.9, 0.8]}>
            <capsuleGeometry args={[0.11, 0.26, 3, 6]} />
            <ToonMat color="#e8eef0"/>
          </mesh>
          {/* cauda */}
          <mesh position={[-0.32, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.11, 0.18, 4]} />
            <ToonMat color={f.color}/>
          </mesh>
          {/* barbatana dorsal */}
          <mesh position={[0.02, 0.13, 0]} rotation={[0, 0, -0.5]}>
            <coneGeometry args={[0.05, 0.12, 4]} />
            <ToonMat color={f.color}/>
          </mesh>
          {/* olho */}
          <mesh position={[0.2, 0.03, 0.09]}>
            <sphereGeometry args={[0.024, 5, 4]} />
            <ToonMat color="#20242a"/>
          </mesh>
        </group>
      ))}
    </group>
  )
}
