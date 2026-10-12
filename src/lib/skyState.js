import * as THREE from 'three'

/**
 * Cores do céu/clima atuais (interpoladas pela Lighting a cada frame).
 * SkyDome, montanhas de fundo e nuvens leem daqui.
 */
export const skyState = {
  top: new THREE.Color('#3d8fe0'),
  horizon: new THREE.Color('#bfe3ff'),
  sunColor: new THREE.Color('#fff0cc'),
  sunDir: new THREE.Vector3(0.42, 0.58, 0.26).normalize(),
  /** multiplica as cores das montanhas/nuvens distantes (escurece à noite) */
  farTint: new THREE.Color('#ffffff'),
  stars: 0,
}
