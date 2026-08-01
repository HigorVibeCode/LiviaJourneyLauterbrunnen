import * as THREE from 'three'

/**
 * Clips da Livia low-poly (idle / walk / run / jump / fall).
 * Hierarquia: Hips → LegR/L → KneeR/L; Spine → ArmR/L → ForeR/L; Head; HairBack
 */

const _euler = new THREE.Euler()
const _quat = new THREE.Quaternion()

function quatTrack(node, times, eulers) {
  const values = []
  for (let i = 0; i < eulers.length; i++) {
    const [x, y, z] = eulers[i]
    _euler.set(x, y, z)
    _quat.setFromEuler(_euler)
    values.push(_quat.x, _quat.y, _quat.z, _quat.w)
  }
  return new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, values)
}

function posTrack(node, times, positions) {
  const values = []
  for (let i = 0; i < positions.length; i++) values.push(...positions[i])
  return new THREE.VectorKeyframeTrack(`${node}.position`, times, values)
}

/** Respiração, transferência de peso, olhar curioso */
function idleClip() {
  const d = 3.6
  const t = [0, d * 0.25, d * 0.5, d * 0.75, d]
  return new THREE.AnimationClip('idle', d, [
    posTrack('Hips', t, [
      [0, 0.82, 0],
      [0, 0.835, 0],
      [0, 0.82, 0],
      [0, 0.83, 0],
      [0, 0.82, 0],
    ]),
    quatTrack('Spine', t, [
      [0.03, 0, 0],
      [-0.02, 0.06, 0.015],
      [0.03, 0, -0.012],
      [-0.015, -0.055, 0],
      [0.03, 0, 0],
    ]),
    quatTrack('Head', t, [
      [0, 0, 0],
      [0.05, 0.28, 0],
      [-0.04, 0.05, 0],
      [0.04, -0.26, 0],
      [0, 0, 0],
    ]),
    quatTrack('ArmR', t, [
      [0.08, 0, 0.28],
      [0.14, 0, 0.32],
      [0.08, 0, 0.28],
      [0.12, 0, 0.3],
      [0.08, 0, 0.28],
    ]),
    quatTrack('ArmL', t, [
      [0.08, 0, -0.28],
      [0.12, 0, -0.3],
      [0.08, 0, -0.28],
      [0.14, 0, -0.32],
      [0.08, 0, -0.28],
    ]),
    quatTrack('ForeR', t, [
      [-0.15, 0, 0],
      [-0.2, 0, 0],
      [-0.15, 0, 0],
      [-0.18, 0, 0],
      [-0.15, 0, 0],
    ]),
    quatTrack('ForeL', t, [
      [-0.15, 0, 0],
      [-0.18, 0, 0],
      [-0.15, 0, 0],
      [-0.2, 0, 0],
      [-0.15, 0, 0],
    ]),
    quatTrack('LegR', t, [
      [0.02, 0, 0.02],
      [0.04, 0, 0.02],
      [0.02, 0, 0.02],
      [0, 0, 0.02],
      [0.02, 0, 0.02],
    ]),
    quatTrack('LegL', t, [
      [0.02, 0, -0.02],
      [0, 0, -0.02],
      [0.02, 0, -0.02],
      [0.04, 0, -0.02],
      [0.02, 0, -0.02],
    ]),
    quatTrack('KneeR', t, [
      [0.08, 0, 0],
      [0.1, 0, 0],
      [0.08, 0, 0],
      [0.09, 0, 0],
      [0.08, 0, 0],
    ]),
    quatTrack('KneeL', t, [
      [0.08, 0, 0],
      [0.09, 0, 0],
      [0.08, 0, 0],
      [0.1, 0, 0],
      [0.08, 0, 0],
    ]),
    quatTrack('HairBack', t, [
      [0.06, 0, 0],
      [0.1, 0.03, 0],
      [0.06, 0, 0],
      [0.1, -0.03, 0],
      [0.06, 0, 0],
    ]),
  ])
}

/**
 * Ciclo de caminhada com joelho (flexão no avanço), contato de pé,
 * bob duplo e balanço oposto de braços.
 */
function walkClip(name = 'walk', d = 0.92, swing = 0.55, bob = 0.055, lean = 0.08) {
  const t = [0, d * 0.25, d * 0.5, d * 0.75, d]
  const knee = swing * 1.15
  return new THREE.AnimationClip(name, d, [
    posTrack('Hips', t, [
      [0, 0.82, 0],
      [0, 0.82 + bob, 0.02],
      [0, 0.82, 0],
      [0, 0.82 + bob, 0.02],
      [0, 0.82, 0],
    ]),
    quatTrack('Hips', t, [
      [0, 0, 0],
      [0, 0.08, 0.04],
      [0, 0, 0],
      [0, -0.08, -0.04],
      [0, 0, 0],
    ]),
    quatTrack('Spine', t, [
      [lean, 0, 0],
      [lean, -0.07, 0.02],
      [lean, 0, 0],
      [lean, 0.07, -0.02],
      [lean, 0, 0],
    ]),
    quatTrack('Head', t, [
      [-lean * 0.5, 0, 0],
      [-lean * 0.5, 0.04, 0],
      [-lean * 0.5, 0, 0],
      [-lean * 0.5, -0.04, 0],
      [-lean * 0.5, 0, 0],
    ]),
    // coxa: frente / trás
    quatTrack('LegR', t, [
      [swing, 0, 0.04],
      [0.05, 0, 0.02],
      [-swing * 0.85, 0, 0.02],
      [0.05, 0, 0.02],
      [swing, 0, 0.04],
    ]),
    quatTrack('LegL', t, [
      [-swing * 0.85, 0, -0.02],
      [0.05, 0, -0.02],
      [swing, 0, -0.04],
      [0.05, 0, -0.02],
      [-swing * 0.85, 0, -0.02],
    ]),
    // joelho flexiona no meio do avanço (passada natural)
    quatTrack('KneeR', t, [
      [0.12, 0, 0],
      [knee, 0, 0],
      [0.2, 0, 0],
      [0.35, 0, 0],
      [0.12, 0, 0],
    ]),
    quatTrack('KneeL', t, [
      [0.2, 0, 0],
      [0.35, 0, 0],
      [0.12, 0, 0],
      [knee, 0, 0],
      [0.2, 0, 0],
    ]),
    quatTrack('ArmR', t, [
      [-swing * 0.85, 0, 0.22],
      [0.05, 0, 0.26],
      [swing * 0.85, 0, 0.22],
      [0.05, 0, 0.26],
      [-swing * 0.85, 0, 0.22],
    ]),
    quatTrack('ArmL', t, [
      [swing * 0.85, 0, -0.22],
      [0.05, 0, -0.26],
      [-swing * 0.85, 0, -0.22],
      [0.05, 0, -0.26],
      [swing * 0.85, 0, -0.22],
    ]),
    quatTrack('ForeR', t, [
      [-0.25, 0, 0],
      [-0.55, 0, 0],
      [-0.2, 0, 0],
      [-0.4, 0, 0],
      [-0.25, 0, 0],
    ]),
    quatTrack('ForeL', t, [
      [-0.2, 0, 0],
      [-0.4, 0, 0],
      [-0.25, 0, 0],
      [-0.55, 0, 0],
      [-0.2, 0, 0],
    ]),
    quatTrack('HairBack', t, [
      [0.12, 0, 0],
      [0.28, 0.06, 0],
      [0.12, 0, 0],
      [0.28, -0.06, 0],
      [0.12, 0, 0],
    ]),
  ])
}

function jumpClip() {
  const d = 0.78
  const t = [0, 0.1, 0.38, d]
  return new THREE.AnimationClip('jump', d, [
    posTrack('Hips', t, [
      [0, 0.82, 0],
      [0, 0.68, 0],
      [0, 0.88, 0],
      [0, 0.82, 0],
    ]),
    quatTrack('Spine', t, [
      [0.06, 0, 0],
      [0.32, 0, 0],
      [-0.14, 0, 0],
      [0.06, 0, 0],
    ]),
    quatTrack('LegR', t, [
      [0.05, 0, 0.03],
      [0.65, 0, 0.05],
      [-0.4, 0, 0.03],
      [0.05, 0, 0.03],
    ]),
    quatTrack('LegL', t, [
      [0.05, 0, -0.03],
      [0.58, 0, -0.05],
      [0.35, 0, -0.03],
      [0.05, 0, -0.03],
    ]),
    quatTrack('KneeR', t, [
      [0.1, 0, 0],
      [1.1, 0, 0],
      [0.45, 0, 0],
      [0.1, 0, 0],
    ]),
    quatTrack('KneeL', t, [
      [0.1, 0, 0],
      [1.0, 0, 0],
      [0.55, 0, 0],
      [0.1, 0, 0],
    ]),
    quatTrack('ArmR', t, [
      [0.08, 0, 0.28],
      [0.55, 0, 0.45],
      [-1.65, 0, 0.55],
      [0.08, 0, 0.28],
    ]),
    quatTrack('ArmL', t, [
      [0.08, 0, -0.28],
      [0.55, 0, -0.45],
      [-1.65, 0, -0.55],
      [0.08, 0, -0.28],
    ]),
    quatTrack('ForeR', t, [
      [-0.2, 0, 0],
      [-0.5, 0, 0],
      [-0.35, 0, 0],
      [-0.2, 0, 0],
    ]),
    quatTrack('ForeL', t, [
      [-0.2, 0, 0],
      [-0.5, 0, 0],
      [-0.35, 0, 0],
      [-0.2, 0, 0],
    ]),
  ])
}

function fallClip() {
  const d = 0.75
  const t = [0, d * 0.5, d]
  return new THREE.AnimationClip('fall', d, [
    quatTrack('Spine', t, [
      [-0.14, 0, 0],
      [-0.1, 0.04, 0],
      [-0.14, 0, 0],
    ]),
    quatTrack('LegR', t, [
      [-0.35, 0, 0.04],
      [-0.22, 0, 0.04],
      [-0.35, 0, 0.04],
    ]),
    quatTrack('LegL', t, [
      [0.28, 0, -0.04],
      [0.38, 0, -0.04],
      [0.28, 0, -0.04],
    ]),
    quatTrack('KneeR', t, [
      [0.7, 0, 0],
      [0.55, 0, 0],
      [0.7, 0, 0],
    ]),
    quatTrack('KneeL', t, [
      [0.55, 0, 0],
      [0.7, 0, 0],
      [0.55, 0, 0],
    ]),
    quatTrack('ArmR', t, [
      [-1.25, 0, 0.65],
      [-1.4, 0, 0.72],
      [-1.25, 0, 0.65],
    ]),
    quatTrack('ArmL', t, [
      [-1.25, 0, -0.65],
      [-1.4, 0, -0.72],
      [-1.25, 0, -0.65],
    ]),
  ])
}

export function createLiviaClips() {
  return [
    idleClip(),
    walkClip('walk', 0.92, 0.55, 0.055, 0.08),
    walkClip('run', 0.58, 0.88, 0.1, 0.22),
    jumpClip(),
    fallClip(),
  ]
}
