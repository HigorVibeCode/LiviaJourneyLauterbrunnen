import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import LiviaModel from './livia/LiviaModel'
import { remotePeers } from '../multiplayer/multiplayerStore'

function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

function RemoteAvatar({ peerId }) {
  const root = useRef(null)
  const model = useRef(null)
  const peer = remotePeers.get(peerId)
  const stateRef = useRef({
    speed: 0,
    grounded: true,
    jumping: false,
    paused: false,
    guiding: false,
    riding: false,
  })

  useFrame((_, delta) => {
    const p = remotePeers.get(peerId)
    if (!p || !root.current) return
    const dt = Math.min(delta, 0.05)
    const k = 1 - Math.exp(-14 * dt)
    p.x += (p.tx - p.x) * k
    p.y += (p.ty - p.y) * k
    p.z += (p.tz - p.z) * k
    p.yaw = lerpAngle(p.yaw, p.tyaw, k)
    root.current.position.set(p.x, p.y, p.z)
    if (model.current) model.current.rotation.y = p.yaw
    stateRef.current.speed = p.speed
    stateRef.current.grounded = p.grounded
    stateRef.current.jumping = !p.grounded && p.speed < 0.2
  })

  if (!peer) return null

  return (
    <group ref={root} position={[peer.x, peer.y, peer.z]}>
      <group ref={model} rotation={[0, peer.yaw, 0]}>
        <LiviaModel stateRef={stateRef} />
      </group>
      <Html position={[0, 2.15, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div className="mp-nameplate">{peer.name}</div>
      </Html>
    </group>
  )
}

/** Lista de avatares remotos — re-monta só quando entra/sai alguém */
export default function RemotePlayers() {
  const [ids, setIds] = useState(() => [...remotePeers.keys()])
  const tick = useRef(0)

  useFrame(() => {
    tick.current += 1
    if (tick.current % 15 !== 0) return
    const next = [...remotePeers.keys()]
    setIds((prev) => {
      if (prev.length === next.length && prev.every((id, i) => id === next[i])) return prev
      return next
    })
  })

  const list = useMemo(() => ids, [ids])

  return (
    <group>
      {list.map((id) => (
        <RemoteAvatar key={id} peerId={id} />
      ))}
    </group>
  )
}
