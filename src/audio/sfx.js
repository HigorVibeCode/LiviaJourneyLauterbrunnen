import { tone, noiseBurst, canPlay, getCtx, getMaster, resumeAudio } from './engine'

/**
 * Efeitos pontuais. Referência de estilo: os "bips" musicais de Zelda /
 * Mario, mas em volume discreto para não cansar.
 */

import { phaseAt } from '../config/world'

/** superfície do passo conforme a fase do vale */
export function surfaceAt(z) {
  const id = phaseAt(z).id
  if (id === 'snow') return 'snow'
  if (id === 'summit') return 'stone'
  return 'grass'
}

/** Reclamação curta ao pisar na água fria */
export function sfxComplaintSplash() {
  // splash
  noiseBurst({ dur: 0.12, freq: 900 + Math.random() * 400, q: 0.9, gain: 0.07 })
  noiseBurst({ time: 0.04, dur: 0.1, type: 'lowpass', freq: 280, gain: 0.05, decay: 0.5 })
  // “ai!” vocal sintético
  tone({ freq: 420, dur: 0.09, type: 'triangle', gain: 0.05, glide: 80 })
  tone({ freq: 360, time: 0.07, dur: 0.14, type: 'sine', gain: 0.04, glide: -90 })
}

export function sfxFootstep(surface, running) {
  const v = running ? 0.085 : 0.058
  if (surface === 'snow') {
    // crunch: duas camadas, grave + agudinho
    noiseBurst({ dur: 0.09, freq: 640 + Math.random() * 220, q: 0.8, gain: v })
    noiseBurst({ time: 0.028, dur: 0.05, freq: 1500, q: 1.3, gain: v * 0.45 })
  } else if (surface === 'stone') {
    noiseBurst({ dur: 0.045, type: 'highpass', freq: 1200, gain: v * 0.75 })
  } else {
    noiseBurst({ dur: 0.07, freq: 400 + Math.random() * 180, q: 0.7, gain: v })
  }
}

/**
 * Casco do galope — 4 batidas por ciclo.
 * beat 0/2 = dianteiros (mais graves); 1/3 = traseiros (mais leves).
 * @param {number} beat 0–3
 * @param {number} speedNorm 0–1
 */
export function sfxGallopHoof(beat = 0, speedNorm = 0.5) {
  const v = 0.04 + Math.min(1, Math.max(0, speedNorm)) * 0.055
  const heavy = beat === 0 || beat === 2
  noiseBurst({
    dur: heavy ? 0.065 : 0.048,
    freq: (heavy ? 260 : 400) + Math.random() * 90,
    q: 1.15,
    gain: v * (heavy ? 1 : 0.72),
  })
  noiseBurst({
    time: 0.014,
    dur: 0.032,
    type: 'highpass',
    freq: 850 + Math.random() * 350,
    gain: v * 0.32,
  })
}

/** Relincho sintético — cumprimento ao abrir o portão / empinar */
export function sfxNeigh() {
  resumeAudio()
  if (!canPlay()) return
  // “hiii-iiii” ascendente depois um pouco descendente
  tone({ freq: 420, dur: 0.18, type: 'sawtooth', gain: 0.055, glide: 180 })
  tone({ freq: 620, time: 0.12, dur: 0.35, type: 'triangle', gain: 0.07, glide: 90 })
  tone({ freq: 780, time: 0.22, dur: 0.45, type: 'sine', gain: 0.045, glide: -220 })
  tone({ freq: 520, time: 0.4, dur: 0.35, type: 'triangle', gain: 0.035, glide: -120 })
  noiseBurst({ time: 0.08, dur: 0.2, type: 'bandpass', freq: 900, q: 1.4, gain: 0.04, decay: 0.5 })
  noiseBurst({ time: 0.35, dur: 0.25, type: 'highpass', freq: 1400, gain: 0.03, decay: 0.6 })
}

export function sfxJump() {
  tone({ freq: 300, dur: 0.15, type: 'sine', gain: 0.045, glide: 270 })
}

export function sfxLand() {
  noiseBurst({ dur: 0.07, freq: 320, q: 0.7, gain: 0.06 })
}

/** arpejo "item get" — a conquista pequena */
export function sfxPickup() {
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
  notes.forEach((f, i) => {
    tone({ freq: f, time: i * 0.085, dur: 0.18, type: 'triangle', gain: 0.07 })
    tone({ freq: f * 2, time: i * 0.085, dur: 0.1, type: 'sine', gain: 0.018 })
  })
}

/** fanfarra curta e grave do portão + madeira rangendo */
export function sfxGate() {
  const notes = [196, 261.63, 329.63, 392] // G3 C4 E4 G4
  notes.forEach((f, i) => tone({ freq: f, time: i * 0.16, dur: 0.5, type: 'triangle', gain: 0.065 }))
  // rangido das dobradiças
  noiseBurst({ dur: 0.5, freq: 210, q: 2.4, gain: 0.05, decay: 1.4 })
  noiseBurst({ time: 0.9, dur: 0.3, type: 'lowpass', freq: 180, gain: 0.07, decay: 0.7 })
}

/** fanfarra do tesouro — a conquista grande */
export function sfxTreasure() {
  const run = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5]
  run.forEach((f, i) => tone({ freq: f, time: i * 0.11, dur: 0.22, type: 'triangle', gain: 0.065 }))
  const chordAt = run.length * 0.11 + 0.06
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f) =>
    tone({ freq: f, time: chordAt, dur: 1.5, type: 'triangle', gain: 0.04 }),
  )
}

/** escorregão suave do respawn */
export function sfxRespawn() {
  tone({ freq: 400, dur: 0.4, type: 'sine', gain: 0.05, glide: -240 })
}

/** piado curto de pássaro (2 a 4 notas) */
export function sfxChirp() {
  const n = 2 + Math.floor(Math.random() * 3)
  const base = 2300 + Math.random() * 900
  for (let i = 0; i < n; i++) {
    tone({
      freq: base + Math.random() * 350,
      time: i * (0.085 + Math.random() * 0.06),
      dur: 0.07,
      type: 'sine',
      gain: 0.026,
      glide: 380,
    })
  }
}

/** Coruja — “uh-UH” grave no vale noturno */
export function sfxOwl() {
  resumeAudio()
  if (!canPlay()) return
  const base = 380 + Math.random() * 60
  tone({ freq: base, dur: 0.22, type: 'triangle', gain: 0.045, glide: -40 })
  tone({ freq: base * 0.72, time: 0.28, dur: 0.45, type: 'sine', gain: 0.055, glide: -30 })
  tone({ freq: base * 1.05, time: 0.55, dur: 0.2, type: 'triangle', gain: 0.03, glide: 50 })
  noiseBurst({ time: 0.3, dur: 0.15, type: 'bandpass', freq: 900, q: 1.2, gain: 0.018, decay: 0.5 })
}

/** Uivo de lobo — longo, descendente */
export function sfxWolfHowl() {
  resumeAudio()
  if (!canPlay()) return
  const start = 520 + Math.random() * 80
  tone({ freq: start, dur: 0.9, type: 'sawtooth', gain: 0.028, glide: 90 })
  tone({ freq: start * 1.15, time: 0.35, dur: 1.4, type: 'triangle', gain: 0.05, glide: -180 })
  tone({ freq: start * 0.85, time: 1.1, dur: 1.1, type: 'sine', gain: 0.04, glide: -120 })
  noiseBurst({ time: 0.5, dur: 0.8, type: 'bandpass', freq: 700, q: 0.8, gain: 0.025, decay: 1.4 })
}

/** trovão distante (fase da chuva) */
export function sfxThunder() {
  noiseBurst({ dur: 0.3, type: 'lowpass', freq: 130, q: 0.5, gain: 0.2, decay: 2.6 })
  tone({ freq: 52, dur: 2.2, type: 'sine', gain: 0.09, glide: -16 })
}

/**
 * Mugido sintético expressivo — "muuuuu" grave com glide, vibrato e harmônicos.
 * @param {'chase'|'catch'|'normal'} [mode]
 */
export function sfxMoo(mode = 'normal') {
  resumeAudio()
  if (!canPlay()) return

  const c = getCtx()
  const master = getMaster()
  const t0 = c.currentTime + 0.01

  const short = mode === 'chase'
  const loud = mode === 'catch'
  const dur = short ? 0.55 + Math.random() * 0.25 : loud ? 1.35 + Math.random() * 0.2 : 1.0 + Math.random() * 0.3
  const base = short ? 155 + Math.random() * 25 : 105 + Math.random() * 18
  const peakGain = short ? 0.11 : loud ? 0.2 : 0.15
  const vibratoHz = short ? 7.5 : 5.2
  const vibratoDepth = short ? 9 : 14

  // envelope: ataque rápido → sustain “uuu” → fade
  const env = c.createGain()
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(peakGain, t0 + (short ? 0.04 : 0.08))
  env.gain.setValueAtTime(peakGain * 0.92, t0 + dur * 0.45)
  env.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
  env.connect(master)

  // filtro formante (muzzle / “mu”)
  const formant = c.createBiquadFilter()
  formant.type = 'bandpass'
  formant.frequency.setValueAtTime(short ? 420 : 320, t0)
  formant.frequency.linearRampToValueAtTime(short ? 280 : 210, t0 + dur * 0.7)
  formant.Q.value = 2.4
  formant.connect(env)

  const lowShelf = c.createBiquadFilter()
  lowShelf.type = 'lowshelf'
  lowShelf.frequency.value = 180
  lowShelf.gain.value = loud ? 8 : 5
  lowShelf.connect(formant)

  // LFO de vibrato
  const lfo = c.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = vibratoHz
  const lfoGain = c.createGain()
  lfoGain.gain.value = vibratoDepth
  lfo.connect(lfoGain)

  const layers = [
    { type: 'sawtooth', mult: 1, gain: 0.55, glide: short ? -22 : -38 },
    { type: 'sine', mult: 1, gain: 0.85, glide: short ? -16 : -28 },
    { type: 'triangle', mult: 2, gain: 0.22, glide: short ? -30 : -48 },
    { type: 'sine', mult: 3, gain: 0.1, glide: short ? -40 : -60 },
  ]

  for (const layer of layers) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = layer.type
    const f0 = base * layer.mult
    const f1 = Math.max(40, f0 + layer.glide)
    osc.frequency.setValueAtTime(f0, t0)
    // “mu” sobe um pouco no ataque e desce no sustain
    osc.frequency.linearRampToValueAtTime(f0 * 1.08, t0 + dur * 0.12)
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.85)
    lfoGain.connect(osc.frequency)
    g.gain.value = layer.gain
    osc.connect(g)
    g.connect(lowShelf)
    osc.start(t0)
    osc.stop(t0 + dur + 0.08)
  }

  lfo.start(t0)
  lfo.stop(t0 + dur + 0.08)

  // sopro / ruído de garganta
  noiseBurst({
    time: 0.02,
    dur: short ? 0.18 : 0.35,
    type: 'lowpass',
    freq: short ? 360 : 260,
    q: 0.9,
    gain: peakGain * 0.35,
    decay: short ? 0.45 : 0.9,
  })

  if (loud) {
    // eco no vale ao pegar a Livia
    const echoDelays = [0.28, 0.55]
    echoDelays.forEach((delay, i) => {
      const echoGain = peakGain * (0.35 - i * 0.12)
      tone({
        freq: base * 0.92,
        time: delay,
        dur: dur * 0.7,
        type: 'sine',
        gain: echoGain * 0.45,
        glide: -22,
      })
      tone({
        freq: base * 1.85,
        time: delay + 0.02,
        dur: dur * 0.5,
        type: 'triangle',
        gain: echoGain * 0.12,
        glide: -30,
      })
      noiseBurst({
        time: delay,
        dur: 0.25,
        type: 'lowpass',
        freq: 200,
        q: 0.7,
        gain: echoGain * 0.2,
        decay: 0.7,
      })
    })
  }
}

/** Mugido curto/agitado durante a perseguição */
export function sfxMooChase() {
  sfxMoo('chase')
}

/** Mugido longo e forte ao alcançar a Livia */
export function sfxMooCatch() {
  sfxMoo('catch')
}
