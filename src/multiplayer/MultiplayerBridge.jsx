import { useEffect, useRef } from 'react'
import PartySocket from 'partysocket'
import { getPartyHost, SEND_HZ, roomFromUrl, writeRoomToUrl } from './config'
import { playerPose } from './playerPose'
import { useMultiplayerStore } from './multiplayerStore'

/**
 * Mantém a ligação PartyKit e envia a pose local a ~12 Hz.
 * UI chama joinRoom / leaveRoom via store actions expostas em window helpers internos.
 */
export default function MultiplayerBridge() {
  const socketRef = useRef(null)
  const joinedRef = useRef(false)

  useEffect(() => {
    const store = useMultiplayerStore.getState()

    const handleMessage = (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      const s = useMultiplayerStore.getState()
      switch (msg.type) {
        case 'snapshot':
          s.setConnected(msg.selfId)
          for (const p of msg.players || []) {
            if (p.id !== msg.selfId) s.upsertPeer(p)
          }
          break
        case 'joined':
          s.setConnected(msg.player?.id || s.selfId)
          break
        case 'peer-join':
          if (msg.player?.id && msg.player.id !== s.selfId) s.upsertPeer(msg.player)
          break
        case 'peer-state':
          if (msg.id && msg.id !== s.selfId) s.applyPeerState(msg)
          break
        case 'peer-leave':
          s.removePeer(msg.id)
          break
        case 'room-full':
          s.setFull()
          socketRef.current?.close()
          socketRef.current = null
          joinedRef.current = false
          break
        default:
          break
      }
    }

    const connect = (roomId, displayName) => {
      const host = getPartyHost()
      if (!host) {
        useMultiplayerStore.getState().setError(
          'Falta VITE_PARTYKIT_HOST. Corre: npx partykit deploy',
        )
        return
      }
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
      joinedRef.current = false
      useMultiplayerStore.getState().setConnecting(roomId)
      writeRoomToUrl(roomId)

      const socket = new PartySocket({ host, room: roomId, party: 'main' })
      socketRef.current = socket

      socket.addEventListener('open', () => {
        joinedRef.current = true
        socket.send(
          JSON.stringify({
            type: 'join',
            name: displayName || useMultiplayerStore.getState().displayName,
            x: playerPose.x,
            y: playerPose.y,
            z: playerPose.z,
            yaw: playerPose.yaw,
          }),
        )
      })
      socket.addEventListener('message', handleMessage)
      socket.addEventListener('error', () => {
        useMultiplayerStore.getState().setError('Falha ao ligar à sala')
      })
      socket.addEventListener('close', () => {
        if (useMultiplayerStore.getState().status === 'connecting') {
          useMultiplayerStore.getState().setError('Ligação fechada')
        }
      })
    }

    const leave = () => {
      socketRef.current?.close()
      socketRef.current = null
      joinedRef.current = false
      writeRoomToUrl(null)
      useMultiplayerStore.getState().resetSession()
    }

    // API usada pelo painel UI
    window.__liviaMp = { connect, leave }

    // Auto-join se URL já tem ?sala=
    const fromUrl = roomFromUrl()
    if (fromUrl) {
      connect(fromUrl, store.displayName)
    }

    const interval = setInterval(() => {
      const sock = socketRef.current
      if (!sock || sock.readyState !== WebSocket.OPEN || !joinedRef.current) return
      if (useMultiplayerStore.getState().status !== 'connected') return
      sock.send(
        JSON.stringify({
          type: 'state',
          x: playerPose.x,
          y: playerPose.y,
          z: playerPose.z,
          yaw: playerPose.yaw,
          speed: playerPose.speed,
          grounded: playerPose.grounded,
        }),
      )
    }, 1000 / SEND_HZ)

    return () => {
      clearInterval(interval)
      delete window.__liviaMp
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [])

  return null
}
