/**
 * Paleta "fofa e colorida" (estilo Animal Crossing).
 *
 * Regras do estilo:
 *  — cores claras e saturadas, nunca marrom-escuro ou preto (sombra = tom
 *    mais escuro da MESMA cor, não cinza)
 *  — formas arredondadas e "gordinhas": esferas, cápsulas, cilindros com
 *    muitos lados; cantos de caixa evitados (use RoundedBox do drei)
 *  — proporções de brinquedo: cabeças grandes, telhados grandes, portas largas
 *  — poucos detalhes, bem legíveis de longe
 */
export const PAL = {
  // natureza
  grass: '#8fd46a',
  grassLight: '#a8e07c',
  grassDark: '#74c25a',
  path: '#f2d9a6',
  pathEdge: '#e6c88e',
  dirt: '#d9a86c',
  cliffSide: '#d8a878',
  cliffBand: '#c4935f',
  sand: '#f6e3b4',
  water: '#5fd0e8',
  waterDeep: '#3fb3d8',
  foam: '#ffffff',
  rock: '#b9c4cf',
  rockDark: '#9aa8b6',
  snow: '#f4f9ff',
  snowShade: '#dcebfa',
  ice: '#bfeaff',

  // árvores
  leaf: '#6cc85a',
  leafLight: '#8ddc6c',
  leafDark: '#57b04c',
  pine: '#4fb378',
  pineDark: '#3f9f68',
  trunk: '#b9835a',
  trunkDark: '#a06e48',
  cherry: '#ffb7d0',
  autumn: '#ffb04a',
  fruitRed: '#ff5a5a',
  fruitOrange: '#ffa23a',

  // flores
  flowers: ['#ff7aa8', '#ffd45a', '#ffffff', '#b48cff', '#ff8a5c', '#6ec8ff'],
  flowerCenter: '#ffd23f',

  // casas (paredes / telhados)
  walls: ['#fff4dc', '#ffe3e8', '#e3f3ff', '#fff6c8', '#e8ffe0'],
  roofs: ['#ff6b6b', '#4aa3ff', '#46c37b', '#ffb43a', '#b07cff', '#ff8fb8'],
  wood: '#d9a26a',
  woodDark: '#b9824e',
  door: '#a8673e',
  window: '#bfe8ff',
  windowNight: '#ffe08a',

  // noite / luz
  lamp: '#ffd97a',
  night: '#2f4f8a',
}
