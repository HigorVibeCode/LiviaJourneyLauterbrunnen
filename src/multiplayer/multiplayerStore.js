import { create } from 'zustand'

/**
 * Peers remotos (mutável) — o loop 3D lê daqui sem re-render a 12Hz.
 * @type {Map<string, {
 *   id: string, name: string,
 *   x: number, y: number, z: number, yaw: number,
 *   speed: number, grounded: boolean,
 *   tx: number, ty: number, tz: number, tyaw: number,
 * }>}
 */
export const remotePeers = new Map()

export const useMultiplayerStore = create((set, get) => ({
  roomId: null,
  selfId: null,
  displayName: 'Viajante',
  status: 'idle', // idle | connecting | connected | full | error
  peerCount: 0,
  error: null,

  setDisplayName: (displayName) => set({ displayName: String(displayName).slice(0, 16) }),
  setConnecting: (roomId) => set({ roomId, status: 'connecting', error: null }),
  setConnected: (selfId) => set({ selfId, status: 'connected', error: null }),
  setPeerCount: (peerCount) => set({ peerCount }),
  setFull: () => set({ status: 'full', error: 'Sala cheia (máx. 6)' }),
  setError: (error) => set({ status: 'error', error }),
  resetSession: () => {
    remotePeers.clear()
    set({
      roomId: null,
      selfId: null,
      status: 'idle',
      peerCount: 0,
      error: null,
    })
  },

  upsertPeer: (player) => {
    const existing = remotePeers.get(player.id)
    if (existing) {
      existing.name = player.name ?? existing.name
      existing.tx = player.x
      existing.ty = player.y
      existing.tz = player.z
      existing.tyaw = player.yaw ?? existing.tyaw
      existing.speed = player.speed ?? existing.speed
      existing.grounded = player.grounded ?? existing.grounded
    } else {
      remotePeers.set(player.id, {
        id: player.id,
        name: player.name || 'Viajante',
        x: player.x,
        y: player.y,
        z: player.z,
        yaw: player.yaw || 0,
        speed: player.speed || 0,
        grounded: player.grounded !== false,
        tx: player.x,
        ty: player.y,
        tz: player.z,
        tyaw: player.yaw || 0,
      })
    }
    set({ peerCount: remotePeers.size })
  },

  applyPeerState: (msg) => {
    const p = remotePeers.get(msg.id)
    if (!p) {
      // chegou state antes do join — cria placeholder
      get().upsertPeer({
        id: msg.id,
        name: 'Viajante',
        x: msg.x,
        y: msg.y,
        z: msg.z,
        yaw: msg.yaw,
        speed: msg.speed,
        grounded: msg.grounded,
      })
      return
    }
    p.tx = msg.x
    p.ty = msg.y
    p.tz = msg.z
    p.tyaw = msg.yaw
    p.speed = msg.speed
    p.grounded = msg.grounded
  },

  removePeer: (id) => {
    remotePeers.delete(id)
    set({ peerCount: remotePeers.size })
  },
}))
