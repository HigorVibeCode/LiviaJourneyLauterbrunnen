/**
 * Motor de áudio 100% sintetizado com Web Audio — nenhum arquivo de som.
 * Tudo é gerado na hora (osciladores + ruído filtrado), o que mantém o
 * bundle leve e o estilo "console antigo" discreto que combina com o jogo.
 *
 * O AudioContext só nasce (e só toca) depois do primeiro gesto do usuário,
 * como os navegadores exigem.
 */
let ctx = null
let master = null
let noiseBuf = null
let muted = false

const MASTER_VOLUME = 0.32

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER_VOLUME
    master.connect(ctx.destination)
  }
  return ctx
}

export function getMaster() {
  getCtx()
  return master
}

/** chamada no primeiro clique/tecla para destravar o áudio */
export function resumeAudio() {
  const c = getCtx()
  if (c.state === 'suspended') c.resume()
}

export function audioRunning() {
  return Boolean(ctx) && ctx.state === 'running'
}

/** só toca se o contexto está liberado e o som está ligado */
export function canPlay() {
  return audioRunning() && !muted
}

export function setMuted(value) {
  muted = value
  if (ctx && master) {
    master.gain.setTargetAtTime(value ? 0 : MASTER_VOLUME, ctx.currentTime, 0.06)
  }
}

/** buffer de ruído branco compartilhado (base de passos, chuva, vento…) */
export function getNoiseBuffer() {
  const c = getCtx()
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

/** nota com envelope curto (a base dos jingles) */
export function tone({ freq, time = 0, dur = 0.12, type = 'triangle', gain = 0.1, glide = 0 }) {
  if (!canPlay()) return
  const c = getCtx()
  const t = c.currentTime + time
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
  osc.connect(g)
  g.connect(getMaster())
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** rajada de ruído filtrado (passos, aterrissagem, trovão) */
export function noiseBurst({
  time = 0,
  dur = 0.08,
  type = 'bandpass',
  freq = 800,
  q = 1,
  gain = 0.1,
  decay = null,
}) {
  if (!canPlay()) return
  const c = getCtx()
  const t = c.currentTime + time
  const src = c.createBufferSource()
  src.buffer = getNoiseBuffer()
  src.loop = true
  src.playbackRate.value = 0.9 + Math.random() * 0.2
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const g = c.createGain()
  const end = decay ?? dur
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0008, t + end)
  src.connect(filter)
  filter.connect(g)
  g.connect(getMaster())
  src.start(t, Math.random() * 1.5)
  src.stop(t + end + 0.1)
}
