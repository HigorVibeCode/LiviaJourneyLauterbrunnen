/** Host do PartyKit — local em dev; em produção define VITE_PARTYKIT_HOST no Vercel */
export function getPartyHost() {
  const env = import.meta.env.VITE_PARTYKIT_HOST
  if (env) return env.replace(/^https?:\/\//, '')
  if (typeof window !== 'undefined') {
    const { hostname } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${hostname}:1999`
    }
  }
  return null
}

export const SEND_HZ = 12
export const MAX_NAME_LEN = 16

export function randomRoomId() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789'
  let id = ''
  for (let i = 0; i < 6; i++) id += alphabet[(Math.random() * alphabet.length) | 0]
  return id
}

export function roomFromUrl() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('sala')
}

export function writeRoomToUrl(roomId) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (roomId) url.searchParams.set('sala', roomId)
  else url.searchParams.delete('sala')
  window.history.replaceState({}, '', url)
}
