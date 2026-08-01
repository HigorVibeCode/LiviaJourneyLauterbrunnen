import {
  buildBlockedRects,
  groundHeightAt,
  isFreeSpot,
  makeRng,
  pathLateralDist,
  pathXAt,
  RIVER,
  STAIRS,
} from './world.js'

/** Altura-alvo (metros do jogo) para cada prop do pack após normalização. */
export const PROP_HEIGHTS = {
  PineTree_V1: 10.5,
  Pinetree_V2: 11.5,
  PineTree_V3: 9.5,
  Tree1: 12,
  Tree2: 11,
  Tree4: 10,
  Maple_Tree: 13,
  Willow_Tree: 11,
  Tree: 10.5,
  DeadTree1: 8.5,
  DeadTree2: 7.5,
  DeadTree3: 6.5,
  DeadTree4: 7,
  Trunk: 3.2,
  Bush: 1.35,
  Grass: 0.55,
  Lilie_Red: 0.55,
  Liliy_White: 0.5,
  Liliy_Purple: 0.52,
  Tulip_Red: 0.45,
  Tulip_Purple: 0.45,
  Dandelion_Yellow: 0.42,
  Dandelion_White: 0.4,
  Wild_Flower_Red: 0.38,
  Wild_flower_Yellow: 0.38,
  SnowDrop_white: 0.35,
  SnowDrop_Purple: 0.35,
  rock: 1.1,
  Rock2: 0.85,
  Rocks: 2.2,
  Barrel: 1.05,
  Crate: 1.1,
  Log: 0.7,
  Fence: 1.45,
  Lamp: 2.6,
  Well: 2.8,
  Table: 1.05,
  Stool: 0.55,
  Mailbox: 1.35,
  Sign: 2.2,
  Tent: 2.4,
  Fire: 1.15,
  Mushroom: 0.28,
  bulrush: 1.6,
  Axe: 0.9,
  House: 8.5,
  Gate: 4.2,
  Woddenbridge: 2.4,
  Pond: 1.8,
  Pond_Rocks: 0.9,
  Duck: 0.35,
}

/**
 * Colisão aproximada (meio-eixos do cuboide) relativa à altura-alvo.
 * `null` = só decoração (jogador atravessa).
 */
export const PROP_COLLIDERS = {
  PineTree_V1: { r: 0.32, h: 2.1 },
  Pinetree_V2: { r: 0.34, h: 2.2 },
  PineTree_V3: { r: 0.3, h: 2 },
  Tree1: { r: 0.32, h: 2.2 },
  Tree2: { r: 0.32, h: 2.1 },
  Tree4: { r: 0.3, h: 2 },
  Maple_Tree: { r: 0.36, h: 2.3 },
  Willow_Tree: { r: 0.34, h: 2.2 },
  Tree: { r: 0.32, h: 2.1 },
  DeadTree1: { r: 0.28, h: 2 },
  DeadTree2: { r: 0.26, h: 1.8 },
  DeadTree3: { r: 0.26, h: 1.7 },
  DeadTree4: { r: 0.26, h: 1.8 },
  Trunk: { r: 0.32, h: 0.9 },
  Rocks: { r: 0.85, h: 0.75 },
  rock: { r: 0.42, h: 0.38 },
  Rock2: { r: 0.32, h: 0.3 },
  Barrel: { r: 0.35, h: 0.5 },
  Crate: { r: 0.42, h: 0.5 },
  Log: { r: 0.55, h: 0.3 },
  Fence: { r: 0.85, h: 0.65, depth: 0.1 },
  Well: { r: 0.95, h: 1 },
  Table: { r: 0.6, h: 0.45 },
  Tent: { r: 1.35, h: 1.05 },
  Fire: { r: 0.55, h: 0.4 },
  Mailbox: { r: 0.22, h: 0.6 },
  Sign: { r: 0.22, h: 0.9 },
  Lamp: { r: 0.16, h: 1.1 },
  Bush: { r: 0.55, h: 0.45 },
  House: { r: 2.8, h: 2.2 },
  Gate: { r: 1.2, h: 1.4, depth: 0.35 },
  Woddenbridge: { r: 2.2, h: 0.35, depth: 8 },
  Pond: { r: 1.6, h: 0.25 },
  Pond_Rocks: { r: 0.8, h: 0.3 },
  Duck: { r: 0.18, h: 0.15 },
}

const PATH_HALF = 6.5

/**
 * Peças “hero” colocadas à mão perto da trilha, casa e vilarejo —
 * o ganho visual mais barato e previsível.
 */
export const HERO_PLACEMENTS = [
  // ── Pradaria / casa da Livia (bem visíveis da trilha inicial) ──
  { prop: 'Maple_Tree', x: -16, z: 96, ry: 0.4, s: 1, hero: true },
  { prop: 'House', lat: -22, z: 88, ry: 0.5, s: 1.05, hero: true },
  { prop: 'House', lat: -26, z: 52, ry: 0.35, s: 0.92, hero: true },
  { prop: 'House', lat: 24, z: -82, ry: -0.25, s: 0.88, hero: true },
  { prop: 'Tree1', x: 15, z: 98, ry: -0.6, s: 0.95, hero: true },
  { prop: 'PineTree_V1', x: -28, z: 104, ry: 1.1, s: 1.05 },
  { prop: 'Tree2', x: 26, z: 100, ry: 0.3, s: 0.9 },
  { prop: 'Bush', x: -10, z: 100, ry: 0.2, s: 1.15 },
  { prop: 'Bush', x: 10, z: 102, ry: 1.4, s: 1 },
  { prop: 'Barrel', x: -8.5, z: 92, ry: 0.5, s: 1 },
  { prop: 'Crate', x: -9.8, z: 93.5, ry: -0.4, s: 0.95 },
  { prop: 'Lamp', x: -7.2, z: 88, ry: 0, s: 1 },
  { prop: 'Lamp', x: 7.2, z: 88, ry: Math.PI, s: 1 },
  { prop: 'Maple_Tree', x: -18, z: 72, ry: 0.4, s: 1 },
  { prop: 'Tree1', x: 18, z: 78, ry: -0.6, s: 0.95 },
  { prop: 'Bush', x: -22, z: 58, ry: 0.2, s: 1.1 },
  { prop: 'Bush', x: 20, z: 60, ry: 1.4, s: 0.95 },
  { prop: 'Mailbox', x: -21, z: 58, ry: 0.3, s: 1 },
  { prop: 'Barrel', x: -28, z: 60, ry: 0.5, s: 1 },
  { prop: 'Crate', x: -29.5, z: 61.5, ry: -0.4, s: 0.9 },
  { prop: 'Fence', x: 20, z: 80, ry: 0.2, s: 1 },
  { prop: 'Fence', x: 22.6, z: 80, ry: 0.2, s: 1 },
  { prop: 'Fence', x: 25.2, z: 80, ry: 0.2, s: 1 },
  { prop: 'Tent', x: 22, z: 90, ry: -0.8, s: 0.85 },
  { prop: 'Fire', x: 19, z: 87, ry: 0.3, s: 1 },
  { prop: 'Log', x: 17.5, z: 88.5, ry: 1.2, s: 1 },
  { prop: 'Stool', x: 20.5, z: 85.5, ry: 0.5, s: 1 },
  { prop: 'Lilie_Red', x: -8, z: 95, ry: 0, s: 1.2 },
  { prop: 'Dandelion_Yellow', x: 7, z: 94, ry: 0.4, s: 1.15 },
  { prop: 'Tulip_Red', x: -7, z: 90, ry: 1, s: 1.1 },
  { prop: 'Wild_flower_Yellow', x: 8, z: 91, ry: 0.2, s: 1.15 },
  { prop: 'Liliy_White', x: -9, z: 86, ry: 0.7, s: 1.1 },
  { prop: 'Dandelion_White', x: 6.5, z: 86, ry: 0.5, s: 1.1 },
  { prop: 'rock', x: -11, z: 98, ry: 0.4, s: 1.1 },
  { prop: 'Rock2', x: 11, z: 96, ry: 1.2, s: 1.2 },
  { prop: 'Sign', x: 10, z: 38, ry: -0.35, s: 0.95 },

  // ── Saída do 1º portão / início do pasto (cavalo ao lado) ──
  { prop: 'Fence', x: 8.5, z: 12, ry: 0.1, s: 1 },
  { prop: 'Fence', x: 11.1, z: 12, ry: 0.1, s: 1 },
  { prop: 'Fence', x: -8.5, z: 12, ry: -0.1, s: 1 },
  { prop: 'Lamp', x: -6.5, z: 11.5, ry: 0, s: 1 },
  { prop: 'Lamp', x: 6.5, z: 11.5, ry: Math.PI, s: 1 },

  // ── Pasto / rancho (heroes densos) ──
  { prop: 'Fence', x: -22, z: -10, ry: Math.PI / 2, s: 1, hero: true },
  { prop: 'Fence', x: -22, z: -12.6, ry: Math.PI / 2, s: 1, hero: true },
  { prop: 'Fence', x: -22, z: -15.2, ry: Math.PI / 2, s: 1, hero: true },
  { prop: 'Fence', x: -22, z: -17.8, ry: Math.PI / 2, s: 1, hero: true },
  { prop: 'Fence', x: 24, z: -40, ry: 0.2, s: 1, hero: true },
  { prop: 'Fence', x: 26.6, z: -40, ry: 0.2, s: 1, hero: true },
  { prop: 'Fence', x: 29.2, z: -40, ry: 0.2, s: 1, hero: true },
  { prop: 'Fence', x: 31.8, z: -40, ry: 0.2, s: 1, hero: true },
  { prop: 'Barrel', x: -28, z: -25, ry: 0.4, s: 1, hero: true },
  { prop: 'Crate', x: -29.5, z: -26.5, ry: -0.5, s: 0.95, hero: true },
  { prop: 'Barrel', x: -27, z: -55, ry: 0.6, s: 1, hero: true },
  { prop: 'Crate', x: -28.5, z: -56.5, ry: 0.3, s: 0.95, hero: true },
  { prop: 'Barrel', x: 26, z: -95, ry: 0.2, s: 1, hero: true },
  { prop: 'Crate', x: 27.5, z: -96.5, ry: -0.4, s: 1, hero: true },
  { prop: 'Log', x: -24, z: -70, ry: 0.9, s: 1.1, hero: true },
  { prop: 'Log', x: 22, z: -130, ry: 1.2, s: 1, hero: true },
  { prop: 'Fence', x: -20, z: -180, ry: 0, s: 1, hero: true },
  { prop: 'Fence', x: -17.4, z: -180, ry: 0, s: 1, hero: true },
  { prop: 'Fence', x: -14.8, z: -180, ry: 0, s: 1, hero: true },
  { prop: 'Fence', x: 20, z: -220, ry: Math.PI / 2, s: 1, hero: true },
  { prop: 'Fence', x: 20, z: -222.6, ry: Math.PI / 2, s: 1, hero: true },
  { prop: 'Barrel', x: 14, z: -45, ry: 0.35, s: 1, hero: true },
  { prop: 'Crate', x: 15.5, z: -46.5, ry: -0.3, s: 0.95, hero: true },
  { prop: 'Fence', x: -18, z: -48, ry: 0.15, s: 1, hero: true },
  { prop: 'Fence', x: -15.4, z: -48, ry: 0.15, s: 1, hero: true },
  { prop: 'Barrel', x: -12, z: -115, ry: 0.55, s: 1, hero: true },
  { prop: 'Crate', x: -13.5, z: -116.5, ry: 0.2, s: 0.95, hero: true },
  { prop: 'Fence', x: 16, z: -150, ry: Math.PI / 2, s: 1, hero: true },
  { prop: 'Fence', x: 16, z: -152.6, ry: Math.PI / 2, s: 1, hero: true },
  { prop: 'Barrel', x: -10, z: -185, ry: 0.7, s: 1, hero: true },
  { prop: 'Crate', x: 12, z: -210, ry: -0.45, s: 1, hero: true },
  { prop: 'Maple_Tree', x: -26, z: -60, ry: 0.4, s: 1 },
  { prop: 'Tree1', x: 28, z: -120, ry: -0.5, s: 0.95 },
  { prop: 'PineTree_V1', x: -32, z: -180, ry: 0.8, s: 1 },
  { prop: 'Tree2', x: 30, z: -240, ry: -0.3, s: 0.9 },
  { prop: 'Bush', x: -14, z: -90, ry: 0.2, s: 1.1 },
  { prop: 'Bush', x: 16, z: -160, ry: 1.1, s: 1 },
  { prop: 'Lilie_Red', x: -8, z: -30, ry: 0, s: 1.2 },
  { prop: 'Dandelion_Yellow', x: 9, z: -70, ry: 0.4, s: 1.15 },
  { prop: 'Tulip_Red', x: -10, z: -140, ry: 0.8, s: 1.1 },
  { prop: 'Wild_flower_Yellow', x: 8, z: -200, ry: 0.3, s: 1.15 },
  { prop: 'Barrel', x: -28, z: -25, ry: 0.4, s: 1 },
  { prop: 'Crate', x: -29.5, z: -26.5, ry: -0.5, s: 0.95 },
  { prop: 'Maple_Tree', x: -18, z: -105, ry: 0.3, s: 1, hero: true },
  { prop: 'Lamp', x: -8, z: -145, ry: 0, s: 1, hero: true },
  { prop: 'Fence', x: 18, z: -165, ry: 0.1, s: 1, hero: true },
  { prop: 'Fence', x: 20.6, z: -165, ry: 0.1, s: 1, hero: true },
  { prop: 'Barrel', x: 22, z: -88, ry: 0.5, s: 1, hero: true },
  { prop: 'Bush', x: -16, z: -200, ry: 0.5, s: 1.1, hero: true },
  { prop: 'Tent', x: 26, z: -100, ry: -0.7, s: 0.85 },
  { prop: 'Fire', x: 23, z: -97, ry: 0.2, s: 1 },
  { prop: 'Log', x: 21, z: -99, ry: 1.1, s: 1 },
  { prop: 'Sign', x: 9, z: -275, ry: -0.25, s: 0.95 },

  // ── Entrada do vilarejo / vale das águas (shift −300) ──
  { prop: 'Pond', lat: -12, z: -330, ry: 0.3, s: 1.2, hero: true },
  { prop: 'Pond_Rocks', lat: -10, z: -328, ry: 0.8, s: 1, hero: true },
  { prop: 'Duck', lat: -11, z: -329, ry: 1.2, s: 1.1, hero: true },
  { prop: 'Woddenbridge', lat: 0, z: -585, ry: 0, s: 0.95, hero: true },
  { prop: 'Lamp', x: -7.5, z: -292, ry: 0, s: 1 },
  { prop: 'Lamp', x: 7.5, z: -292, ry: Math.PI, s: 1 },
  { prop: 'Barrel', x: -28, z: -306, ry: 0.3, s: 1 },
  { prop: 'Barrel', x: -26.5, z: -307.5, ry: 1.1, s: 0.95 },
  { prop: 'Crate', x: 27, z: -308, ry: -0.5, s: 1 },
  { prop: 'Crate', x: 28.5, z: -309.5, ry: 0.8, s: 0.9 },
  { prop: 'Table', x: -8, z: -328, ry: 0.2, s: 1 },
  { prop: 'Stool', x: -9.5, z: -326.5, ry: 0.4, s: 1 },
  { prop: 'Stool', x: -6.2, z: -329.5, ry: -0.6, s: 1 },
  { prop: 'Well', x: 8, z: -342, ry: 0.5, s: 0.9 },
  { prop: 'Fence', x: -36, z: -312, ry: Math.PI / 2, s: 1 },
  { prop: 'Fence', x: -36, z: -314.6, ry: Math.PI / 2, s: 1 },
  { prop: 'Fence', x: 36, z: -314, ry: Math.PI / 2, s: 1 },
  { prop: 'Axe', x: 28, z: -312, ry: 0.7, s: 1 },
  { prop: 'Log', x: -24, z: -336, ry: 0.9, s: 1.1 },
  { prop: 'Mushroom', x: -20, z: -350, ry: 0, s: 1.2 },
  { prop: 'Mushroom', x: -21.2, z: -351, ry: 1, s: 0.9 },

  // ── Fundo do vale noturno ──
  { prop: 'DeadTree1', x: -30, z: -450, ry: 0.5, s: 1 },
  { prop: 'DeadTree2', x: 28, z: -470, ry: -0.6, s: 1 },
  { prop: 'DeadTree3', x: -36, z: -490, ry: 0.9, s: 1.05 },
  { prop: 'PineTree_V3', x: 34, z: -455, ry: -0.4, s: 1 },
  { prop: 'Pinetree_V2', x: -40, z: -500, ry: 0.3, s: 1 },
  { prop: 'Lamp', x: -8, z: -460, ry: 0, s: 1 },
  { prop: 'Lamp', x: 8, z: -460, ry: Math.PI, s: 1 },
  { prop: 'Lamp', x: -8, z: -505, ry: 0, s: 1 },
  { prop: 'Lamp', x: 8, z: -505, ry: Math.PI, s: 1 },
  { prop: 'Mushroom', x: -18, z: -480, ry: 0.2, s: 1.3 },
  { prop: 'Mushroom', x: 16, z: -495, ry: 1.1, s: 1.1 },
  { prop: 'Fire', x: -24, z: -440, ry: 0.3, s: 1 },
  { prop: 'Log', x: 20, z: -448, ry: 0.8, s: 1 },
  { prop: 'Rocks', x: -44, z: -485, ry: 0.5, s: 0.9 },



  // ── Vale das águas ──
  { prop: 'Willow_Tree', x: -28, z: -540, ry: 0.5, s: 1 },
  { prop: 'Willow_Tree', x: 32, z: -610, ry: -0.4, s: 0.95 },
  { prop: 'Tree2', x: -40, z: -560, ry: 0.8, s: 1 },
  { prop: 'PineTree_V3', x: 42, z: -580, ry: -1, s: 1.05 },
  { prop: 'Pinetree_V2', x: -44, z: -620, ry: 0.3, s: 1 },
  { prop: 'Rocks', x: -48, z: -600, ry: 0.6, s: 0.85 },
  { prop: 'rock', x: 10, z: -558, ry: 0.2, s: 1 },
  { prop: 'Rock2', x: -12, z: -572, ry: 1.1, s: 1.1 },
  { prop: 'bulrush', x: -30, z: -534, ry: 0.3, s: 1 },
  { prop: 'bulrush', x: -32, z: -538, ry: 1.2, s: 0.9 },
  { prop: 'bulrush', x: 34, z: -606, ry: 0.5, s: 1.05 },
  { prop: 'bulrush', x: 38, z: -612, ry: -0.7, s: 0.95 },
  { prop: 'Lamp', x: -7.2, z: -590, ry: 0.1, s: 1 },
  { prop: 'Lamp', x: 7.2, z: -590, ry: Math.PI, s: 1 },
  { prop: 'Barrel', x: 24, z: -568, ry: 0.4, s: 1 },
  { prop: 'Tent', x: -40, z: -630, ry: 0.9, s: 0.9 },
  { prop: 'Fire', x: -37, z: -628, ry: 0.2, s: 1 },
  { prop: 'Bush', x: -14, z: -565, ry: 0.4, s: 1.15, hero: true },
  { prop: 'Wild_Flower_Red', x: 12, z: -555, ry: 0.2, s: 1.2, hero: true },
  { prop: 'Lamp', x: -10, z: -600, ry: 0, s: 1, hero: true },
  { prop: 'Maple_Tree', x: 20, z: -595, ry: -0.4, s: 1, hero: true },
  { prop: 'Fence', x: -16, z: -548, ry: 0, s: 1, hero: true },
  { prop: 'Fence', x: -13.4, z: -548, ry: 0, s: 1, hero: true },

  // ── Passo nevado ──
  { prop: 'DeadTree1', x: -28, z: -680, ry: 0.4, s: 1 },
  { prop: 'DeadTree2', x: 30, z: -698, ry: -0.7, s: 1 },
  { prop: 'DeadTree3', x: -34, z: -730, ry: 1.1, s: 1.05 },
  { prop: 'DeadTree4', x: 26, z: -750, ry: 0.2, s: 0.95 },
  { prop: 'PineTree_V1', x: -40, z: -714, ry: 0.6, s: 1 },
  { prop: 'Pinetree_V2', x: 38, z: -734, ry: -0.5, s: 1 },
  { prop: 'Rocks', x: 16, z: -720, ry: 0.8, s: 0.9 },
  { prop: 'rock', x: -14, z: -740, ry: 0.3, s: 1.15 },
  { prop: 'Trunk', x: -22, z: -690, ry: 1.3, s: 1 },
  { prop: 'Log', x: 20, z: -705, ry: 0.5, s: 1 },
  { prop: 'SnowDrop_white', x: -8, z: -670, ry: 0, s: 1.2 },
  { prop: 'SnowDrop_Purple', x: 9, z: -672, ry: 0.5, s: 1.1 },
  { prop: 'Lamp', x: -7, z: -760, ry: 0, s: 1 },
  { prop: 'Lamp', x: 7, z: -760, ry: Math.PI, s: 1 },

  // ── Subida / mirante (laterais da escadaria) ──
  { prop: 'DeadTree2', x: -28, z: -930, ry: 0.4, s: 0.9 },
  { prop: 'DeadTree1', x: 30, z: -945, ry: -0.6, s: 0.95 },
  { prop: 'rock', x: -30, z: -940, ry: 0.7, s: 1.1 },
  { prop: 'Rock2', x: 29, z: -958, ry: 0.2, s: 1 },
  { prop: 'Rocks', x: -32, z: -980, ry: 1.1, s: 1 },
  { prop: 'PineTree_V3', x: 31, z: -972, ry: -0.3, s: 0.9 },
  { prop: 'PineTree_V1', x: -33, z: -1000, ry: 0.5, s: 0.85 },
  { prop: 'Pinetree_V2', x: 32, z: -1008, ry: -0.8, s: 0.9 },
  { prop: 'Lamp', x: -26, z: -950, ry: 0, s: 1 },
  { prop: 'Lamp', x: 26, z: -950, ry: Math.PI, s: 1 },
  { prop: 'Lamp', x: -26, z: -990, ry: 0, s: 1 },
  { prop: 'Lamp', x: 26, z: -990, ry: Math.PI, s: 1 },
  { prop: 'Barrel', x: -27, z: -965, ry: 0.4, s: 1 },
  { prop: 'Crate', x: 28, z: -982, ry: 0.9, s: 1 },
  { prop: 'SnowDrop_white', x: -29, z: -935, ry: 0, s: 1.2 },
  { prop: 'SnowDrop_Purple', x: 29, z: -938, ry: 0.4, s: 1.1 },
  { prop: 'Trunk', x: -31, z: -1015, ry: 1.2, s: 1 },
  { prop: 'Log', x: 30, z: -1020, ry: 0.3, s: 1 },

  // ── Prado florido (heroes extras) ──
  { prop: 'Wild_flower_Yellow', x: -12, z: -855, ry: 0.3, s: 1.2, hero: true },
  { prop: 'Tulip_Purple', x: 14, z: -868, ry: 0.5, s: 1.15, hero: true },
  { prop: 'Maple_Tree', x: -22, z: -875, ry: 0.6, s: 1, hero: true },
  { prop: 'Lamp', x: 8, z: -842, ry: Math.PI, s: 1, hero: true },

]

/** Perfis de espalhamento leve — reforçam biomas sem competir com Vegetation. */
const SCATTER_PROFILES = [
  {
    seed: 77001,
    zFrom: 20,
    zTo: 110,
    halfX: 48,
    counts: {
      Bush: 14,
      Grass: 18,
      Lilie_Red: 10,
      Liliy_White: 8,
      Tulip_Red: 8,
      Dandelion_Yellow: 12,
      Wild_Flower_Red: 8,
      rock: 6,
      Rock2: 6,
      PineTree_V1: 4,
      Tree4: 3,
      Mushroom: 6,
    },
  },
  {
    seed: 77015,
    zFrom: -280,
    zTo: 8,
    halfX: 48,
    counts: {
      Bush: 18,
      Grass: 28,
      Lilie_Red: 14,
      Liliy_White: 12,
      Tulip_Red: 12,
      Dandelion_Yellow: 18,
      Wild_Flower_Red: 12,
      Fence: 22,
      Barrel: 10,
      Crate: 8,
      Log: 8,
      rock: 8,
      Rock2: 8,
      Tree1: 4,
      Tree4: 4,
      Maple_Tree: 3,
    },
  },
  // vale noturno
  {
    seed: 77018,
    zFrom: -510,
    zTo: -300,
    halfX: 48,
    counts: {
      DeadTree1: 5,
      DeadTree2: 4,
      DeadTree3: 3,
      PineTree_V3: 6,
      Pinetree_V2: 5,
      Bush: 8,
      rock: 10,
      Rock2: 8,
      Rocks: 4,
      Log: 6,
      Lamp: 12,
      Fire: 4,
      Barrel: 3,
      Crate: 3,
      Mushroom: 8,
    },
  },
  // vale das águas
  {
    seed: 77002,
    zFrom: -648,
    zTo: -528,
    halfX: 48,
    counts: {
      Bush: 10,
      Tree1: 3,
      Tree2: 3,
      PineTree_V3: 4,
      Pinetree_V2: 3,
      rock: 8,
      Rock2: 8,
      Rocks: 3,
      bulrush: 16,
      Mushroom: 12,
      Log: 4,
      Barrel: 4,
      Crate: 3,
      Grass: 8,
    },
  },
  // neve
  {
    seed: 77003,
    zFrom: -772,
    zTo: -660,
    halfX: 48,
    counts: {
      DeadTree1: 3,
      DeadTree2: 3,
      DeadTree3: 2,
      DeadTree4: 2,
      PineTree_V1: 3,
      rock: 8,
      Rock2: 6,
      Rocks: 3,
      Trunk: 3,
      Log: 3,
      SnowDrop_white: 10,
      SnowDrop_Purple: 8,
      Bush: 4,
    },
  },
  // prado florido
  {
    seed: 77019,
    zFrom: -908,
    zTo: -788,
    halfX: 48,
    counts: {
      Maple_Tree: 5,
      Tree1: 4,
      Tree2: 4,
      Willow_Tree: 3,
      Bush: 16,
      Lilie_Red: 18,
      Liliy_White: 16,
      Liliy_Purple: 14,
      Tulip_Red: 16,
      Tulip_Purple: 14,
      Dandelion_Yellow: 20,
      Dandelion_White: 14,
      Wild_Flower_Red: 16,
      Wild_flower_Yellow: 16,
      Grass: 20,
      Lamp: 6,
      Fence: 8,
      rock: 4,
    },
  },
  // laterais da escadaria
  {
    seed: 77004,
    zFrom: -1020,
    zTo: -920,
    halfX: 52,
    counts: {
      DeadTree1: 2,
      DeadTree2: 2,
      PineTree_V1: 3,
      PineTree_V3: 3,
      Pinetree_V2: 2,
      rock: 10,
      Rock2: 8,
      Rocks: 4,
      Trunk: 3,
      Log: 3,
      SnowDrop_white: 12,
      SnowDrop_Purple: 8,
      Lamp: 4,
      Barrel: 3,
      Crate: 3,
    },
  },
]

/**
 * Gera posições determinísticas para o scatter do pack.
 * Respeita caminho central, casas, portões, rio e escadaria.
 */
export function generateAdventureScatter(density = 1) {
  const blocked = buildBlockedRects()
  const out = []

  for (const zone of SCATTER_PROFILES) {
    const rng = makeRng(zone.seed)
    for (const [prop, baseCount] of Object.entries(zone.counts)) {
      const count = Math.max(0, Math.round(baseCount * density))
      let placed = 0
      let guard = 0
      const keepPathClear = !['Grass', 'Lilie_Red', 'Liliy_White', 'Tulip_Red', 'Dandelion_Yellow', 'Wild_Flower_Red', 'SnowDrop_white', 'SnowDrop_Purple', 'Mushroom', 'bulrush'].includes(prop)
      const margin = PROP_COLLIDERS[prop] ? 2.5 : 1

      while (placed < count && guard < count * 40) {
        guard++
        const z = zone.zFrom + rng() * (zone.zTo - zone.zFrom)
        const latMax = Math.min(zone.halfX, 41)
        const lat = keepPathClear
          ? (rng() * 2 - 1) * latMax
          : (rng() ** 0.58) * (rng() < 0.5 ? -1 : 1) * Math.min(latMax, 28)
        const x = pathXAt(z) + lat
        const latDist = pathLateralDist(x, z)
        if (keepPathClear && latDist < PATH_HALF) continue
        if (!keepPathClear && latDist > 34 && rng() > 0.42) continue
        if (z < RIVER.zTo + 5 && z > RIVER.zFrom - 5 && pathLateralDist(x, z) < RIVER.gapHalfX + 8) continue
        if (z < STAIRS.zStart + 2 && z > STAIRS.zStart - STAIRS.steps * STAIRS.stepDepth - 2 && Math.abs(x) < STAIRS.halfWidth + 2) continue
        if (!isFreeSpot(x, z, blocked, margin)) continue

        out.push({
          prop,
          x,
          z,
          y: groundHeightAt(x, z),
          ry: rng() * Math.PI * 2,
          s: 0.85 + rng() * 0.35,
        })
        placed++
      }
    }
  }

  return out
}

/** Une hero + scatter e assenta no chão. */
export function buildAdventurePlacements(density = 1) {
  const heroes = HERO_PLACEMENTS.map((p) => {
    // x nos heroes = offset lateral da trilha (não X mundial absoluto)
    const lat = p.lat ?? p.x
    const x = pathXAt(p.z) + lat
    return {
      ...p,
      x,
      y: groundHeightAt(x, p.z),
      s: p.s ?? 1,
    }
  })
  return heroes.concat(generateAdventureScatter(density))
}
