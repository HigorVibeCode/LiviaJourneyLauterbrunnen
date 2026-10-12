import { getCtx, canPlay, tone } from './engine'

/**
 * Trilha sonora gerada na hora: caixinha de música sobre acordes suaves.
 * Cada região do vale tem tom, escala e andamento próprios; a melodia é
 * um passeio aleatório pela escala pentatônica (nunca desafina).
 *
 * Agendamento "lookahead": a cada 120 ms marcamos as notas dos próximos
 * ~0.4 s no relógio do AudioContext — ritmo firme mesmo com o jogo pesado.
 */
const MIDI = (n) => 440 * 2 ** ((n - 69) / 12)

const MOODS = {
  day: {
    root: 60,
    scale: [0, 2, 4, 7, 9],
    // I – vi – IV – V
    prog: [
      [0, 4, 7],
      [-3, 0, 4],
      [-7, -3, 0],
      [-5, -1, 2],
    ],
    bpm: 88,
    density: 0.55,
  },
  night: {
    // canção de ninar em lá menor
    root: 57,
    scale: [0, 3, 5, 7, 10],
    prog: [
      [0, 3, 7],
      [-4, 0, 3],
      [-9, -5, -2],
      [-5, -2, 2],
    ],
    bpm: 66,
    density: 0.4,
  },
  water: {
    root: 62,
    scale: [0, 2, 4, 7, 9],
    prog: [
      [0, 4, 7],
      [5, 9, 12],
      [-3, 0, 4],
      [7, 11, 14],
    ],
    bpm: 80,
    density: 0.5,
  },
  snow: {
    root: 64,
    scale: [0, 2, 4, 7, 11],
    prog: [
      [0, 4, 7],
      [-3, 0, 4],
      [5, 9, 12],
      [7, 11, 14],
    ],
    bpm: 76,
    density: 0.45,
  },
  summit: {
    root: 62,
    scale: [0, 2, 4, 7, 9],
    prog: [
      [0, 4, 7],
      [5, 9, 12],
      [7, 11, 14],
      [0, 4, 7],
    ],
    bpm: 100,
    density: 0.65,
  },
}

const MUSIC_GAIN = 0.026

let mood = 'day'
let running = false
let timer = null
let nextTime = 0
let step = 0
let melodyIdx = 5
let volume = 1

export function setMusicMood(id) {
  if (MOODS[id]) mood = id
}

/** 0..1 — abaixa durante a pausa / tela de vitória, por exemplo */
export function setMusicVolume(v) {
  volume = Math.max(0, Math.min(1, v))
}

export function startMusic() {
  if (running) return
  running = true
  nextTime = 0
  timer = setInterval(schedule, 120)
}

export function stopMusic() {
  running = false
  if (timer) clearInterval(timer)
  timer = null
}

function schedule() {
  if (!canPlay() || volume <= 0.01) {
    nextTime = 0
    return
  }
  const c = getCtx()
  const m = MOODS[mood]
  const eighth = 60 / m.bpm / 2
  if (nextTime < c.currentTime) nextTime = c.currentTime + 0.05

  while (nextTime < c.currentTime + 0.45) {
    playStep(m, nextTime - c.currentTime, eighth)
    nextTime += eighth
    step = (step + 1) % 32
  }
}

function playStep(m, at, eighth) {
  const g = MUSIC_GAIN * volume
  const bar = Math.floor(step / 8) % m.prog.length
  const chord = m.prog[bar]

  // acorde: notas longas e macias no começo de cada compasso
  if (step % 8 === 0) {
    chord.forEach((iv) =>
      tone({ freq: MIDI(m.root + iv - 12), time: at, dur: eighth * 7.5, type: 'sine', gain: g * 0.55 }),
    )
    tone({ freq: MIDI(m.root + chord[0] - 24), time: at, dur: eighth * 7, type: 'triangle', gain: g * 0.6 })
  }
  // baixo no tempo 3
  if (step % 8 === 4) {
    tone({ freq: MIDI(m.root + chord[2] - 24), time: at, dur: eighth * 3, type: 'triangle', gain: g * 0.4 })
  }

  // melodia: caixinha de música (passeio aleatório na escala)
  const strong = step % 2 === 0
  if (Math.random() < (strong ? m.density + 0.15 : m.density * 0.45)) {
    melodyIdx += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]
    melodyIdx = Math.max(0, Math.min(11, melodyIdx))
    const octave = Math.floor(melodyIdx / m.scale.length)
    const note = m.root + 12 + octave * 12 + m.scale[melodyIdx % m.scale.length]
    tone({ freq: MIDI(note), time: at, dur: eighth * 1.8, type: 'triangle', gain: g * 0.9 })
    tone({ freq: MIDI(note + 12), time: at, dur: eighth * 1.2, type: 'sine', gain: g * 0.25 })
  }
}
