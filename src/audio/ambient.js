import { getCtx, getMaster, getNoiseBuffer, audioRunning } from './engine'

/**
 * Camadas de ambiente em loop (ruído filtrado), com o volume de cada uma
 * controlado por fase do vale:
 *
 *  vento  → sempre presente, mais forte na neve e no mirante
 *  chuva  → só no Vale das Águas (com os trovões pontuais do sfx)
 *  água   → murmúrio grave de rio/cachoeira no Vale das Águas
 */
let layers = null

function buildLayers() {
  const c = getCtx()

  const makeLoop = (type, freq, q = 0.8) => {
    const src = c.createBufferSource()
    src.buffer = getNoiseBuffer()
    src.loop = true
    const filter = c.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    const gain = c.createGain()
    gain.gain.value = 0
    src.connect(filter)
    filter.connect(gain)
    gain.connect(getMaster())
    src.start(0, Math.random())
    return { filter, gain }
  }

  layers = {
    wind: makeLoop('lowpass', 320),
    rain: makeLoop('bandpass', 2600, 0.4),
    water: makeLoop('lowpass', 620),
    // tensão do mirante: zumbido grave + agudo estreito
    tension: makeLoop('bandpass', 90, 2.2),
    tensionHi: makeLoop('bandpass', 740, 4.5),
  }

  // o vento "respira": um LFO lento varia o corte do filtro
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.13
  const lfoGain = c.createGain()
  lfoGain.gain.value = 110
  lfo.connect(lfoGain)
  lfoGain.connect(layers.wind.filter.frequency)
  lfo.start()

  return layers
}

/** transição suave (~2s) entre os volumes-alvo de cada camada */
export function setAmbientTargets({ wind, rain, water, tension = 0 }) {
  if (!audioRunning()) return
  const c = getCtx()
  if (!layers) buildLayers()
  layers.wind.gain.gain.setTargetAtTime(wind, c.currentTime, 0.9)
  layers.rain.gain.gain.setTargetAtTime(rain, c.currentTime, 0.9)
  layers.water.gain.gain.setTargetAtTime(water, c.currentTime, 0.9)
  layers.tension.gain.gain.setTargetAtTime(tension, c.currentTime, 0.7)
  layers.tensionHi.gain.gain.setTargetAtTime(tension * 0.45, c.currentTime, 0.7)
}
