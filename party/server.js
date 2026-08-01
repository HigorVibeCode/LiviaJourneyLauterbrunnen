/**
 * Sala multijogador — sync leve de pose entre clientes.
 * Deploy: npx partykit deploy
 * Local:  npx partykit dev
 */

const MAX_PLAYERS = 6

export default class GameRoom {
  constructor(room) {
    this.room = room
    /** @type {Map<string, object>} */
    this.players = new Map()
  }

  onConnect(conn) {
    conn.send(
      JSON.stringify({
        type: 'snapshot',
        selfId: conn.id,
        players: [...this.players.values()],
        full: this.players.size >= MAX_PLAYERS,
      }),
    )
  }

  onMessage(message, sender) {
    let msg
    try {
      msg = typeof message === 'string' ? JSON.parse(message) : null
    } catch {
      return
    }
    if (!msg || typeof msg.type !== 'string') return

    if (msg.type === 'join') {
      if (this.players.has(sender.id)) return
      if (this.players.size >= MAX_PLAYERS) {
        sender.send(JSON.stringify({ type: 'room-full' }))
        return
      }
      const player = {
        id: sender.id,
        name: sanitizeName(msg.name),
        x: num(msg.x, 0),
        y: num(msg.y, 2.5),
        z: num(msg.z, 96),
        yaw: num(msg.yaw, 0),
        speed: 0,
        grounded: true,
      }
      this.players.set(sender.id, player)
      sender.send(JSON.stringify({ type: 'joined', player, count: this.players.size }))
      this.room.broadcast(JSON.stringify({ type: 'peer-join', player }), [sender.id])
      return
    }

    if (msg.type === 'state') {
      const prev = this.players.get(sender.id)
      if (!prev) return
      prev.x = num(msg.x, prev.x)
      prev.y = num(msg.y, prev.y)
      prev.z = num(msg.z, prev.z)
      prev.yaw = num(msg.yaw, prev.yaw)
      prev.speed = num(msg.speed, 0)
      prev.grounded = Boolean(msg.grounded)
      this.room.broadcast(
        JSON.stringify({
          type: 'peer-state',
          id: sender.id,
          x: prev.x,
          y: prev.y,
          z: prev.z,
          yaw: prev.yaw,
          speed: prev.speed,
          grounded: prev.grounded,
        }),
        [sender.id],
      )
    }
  }

  onClose(conn) {
    if (!this.players.has(conn.id)) return
    this.players.delete(conn.id)
    this.room.broadcast(JSON.stringify({ type: 'peer-leave', id: conn.id }))
  }

  onError(conn) {
    this.onClose(conn)
  }
}

function sanitizeName(name) {
  const n = String(name || 'Viajante')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 16)
  return n || 'Viajante'
}

function num(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
