// Atrezo del huerto que cambia con las mejoras: cada compra del árbol se nota a simple vista.
// Los edificios pulsables (granero, tablón, árbol viejo, casa) se dibujan en landmarks.ts; aquí va lo demás.
// Cada objeto es un sprite suelto en la capa de entidades, ordenado por su base como los gnomos.
import { Sprite, Texture, type Container } from 'pixi.js';
import { BARN, BASKET, CROP_IDS, DOOR, FIELD, HOUSE, TREE, WELL } from '../sim/config';
import { hasPorters } from '../sim/sim';
import type { CropId, GameState, NodeId } from '../sim/types';
import { blit, makeCanvas, type PixelMap } from './pixelart';

type Ctx = CanvasRenderingContext2D;
const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};
const O = '#1a1c2c';

/** Un objeto del atrezo: cambia de dibujo solo cuando cambia su nivel (cada nivel se dibuja una vez). */
class Prop {
  readonly sprite = new Sprite();
  private level = 0;
  private cache = new Map<number, Texture>();

  constructor(parent: Container, private draw: (level: number) => HTMLCanvasElement) {
    this.sprite.visible = false;
    parent.addChild(this.sprite);
  }

  /** level 0 = no se ve. (x, bottom) es la esquina inferior izquierda en el mundo. */
  show(level: number, x: number, bottom: number, z = bottom) {
    this.sprite.visible = level > 0;
    if (level <= 0) return;
    if (level !== this.level) {
      this.level = level;
      let tex = this.cache.get(level);
      if (!tex) {
        tex = Texture.from(this.draw(level));
        this.cache.set(level, tex);
      }
      this.sprite.texture = tex;
    }
    this.sprite.position.set(x, bottom - this.sprite.texture.height);
    this.sprite.zIndex = z;
  }
}

// ---------- dibujos ----------

const SACK: PixelMap = ['.OtO.', '.OPO.', 'OPPPO', 'OPPpO', 'OPPpO', '.OOO.'];
const SACK_PAL = { O, P: '#c8925f', p: '#a8723f', t: '#5a3a2a' };
/** posición de cada saco del montón (esquina superior izquierda), de abajo arriba */
const SACK_SPOTS: [number, number][][] = [
  [],
  [[4, 9]],
  [[1, 9], [6, 9]],
  [[0, 9], [4, 9], [8, 9], [2, 5]],
  [[0, 9], [4, 9], [8, 9], [2, 5], [6, 5], [4, 1]],
];

/** Montón de sacos junto al granero: crece con el saco grande (1–4). */
function drawSacks(level: number): HTMLCanvasElement {
  const c = makeCanvas(13, 15);
  const ctx = c.getContext('2d')!;
  for (const [x, y] of SACK_SPOTS[level]) blit(ctx, SACK, x, y, SACK_PAL);
  return c;
}

const JAR_FILLS = ['#ef7d57', '#e8687d', '#ffcd75'] as const;
/** Estante de tarros de conserva: una balda llena más por nivel (1–3). */
function drawJarShelf(level: number): HTMLCanvasElement {
  const c = makeCanvas(9, 16);
  const ctx = c.getContext('2d')!;
  // laterales y baldas
  for (const x of [0, 8]) rect(ctx, x, 0, 1, 16, O);
  rect(ctx, 1, 0, 7, 1, '#5a3a2a');
  for (let b = 0; b < 3; b++) {
    const y = 5 + b * 5;
    rect(ctx, 1, y, 7, 1, '#8b5a3c');
    if (2 - b >= level) continue;
    // la balda de abajo se llena primero
    for (const x of [1, 5]) {
      rect(ctx, x, y - 4, 3, 1, '#5a3a2a');
      rect(ctx, x, y - 3, 3, 3, '#94b0c2');
      rect(ctx, x, y - 3, 2, 3, JAR_FILLS[b]);
      rect(ctx, x, y - 3, 1, 1, '#f4f4f4');
    }
  }
  return c;
}

/** Carretilla aparcada: más grande con el nivel, cargada desde el 2 y pintada de azul en el 3. */
function drawWheelbarrow(level: number): HTMLCanvasElement {
  const tw = [0, 9, 11, 12][level];
  const w = tw + 7, h = 11;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const top = 3;
  const body = level >= 3 ? '#3b5dc9' : '#8b5a3c';
  const shade = level >= 3 ? '#29366f' : '#5a3a2a';
  // asas y pata, detrás de la caja
  for (let i = 0; i < 6; i++) rect(ctx, 1 + tw + i, top + 1 + Math.floor(i / 2), 1, 1, O);
  rect(ctx, tw - 1, top + 4, 1, h - top - 4, O);
  // caja en trapecio
  for (let r = 0; r < 5; r++) {
    const x0 = 2 + Math.floor(r / 2), x1 = 1 + tw - r;
    rect(ctx, x0, top + r, x1 - x0 + 1, 1, r === 0 || r === 4 ? O : body);
    rect(ctx, x0, top + r, 1, 1, O);
    rect(ctx, x1, top + r, 1, 1, O);
    if (r === 3) rect(ctx, x0 + 1, top + r, x1 - x0 - 1, 1, shade);
  }
  if (level >= 2) rect(ctx, 2, top, tw, 1, '#94b0c2');
  if (level >= 3) rect(ctx, 4, top + 2, tw - 5, 1, '#ffcd75');
  // carga de cosecha asomando
  if (level >= 2) {
    const load = ['#ef7d57', '#ffcd75', '#a7f070', '#e8687d'];
    for (let x = 4, i = 0; x < tw - 1; x += 2, i++) rect(ctx, x, top - 1 - (i % 2), 2, 1 + (i % 2), load[i % load.length]);
  }
  // rueda
  rect(ctx, 1, h - 5, 3, 5, O);
  rect(ctx, 0, h - 4, 5, 3, O);
  rect(ctx, 1, h - 4, 3, 3, '#566c86');
  rect(ctx, 2, h - 3, 1, 1, '#94b0c2');
  return c;
}

const BOOT_COLORS = ['#b13e53', '#3b5dc9', '#ffcd75', '#257179', '#ef7d57'] as const;
/** dónde va cada par de botas (x, y de la balda en la que se apoya) */
const BOOT_SPOTS: [number, number][] = [[1, 12], [6, 12], [1, 8], [6, 8], [3, 4]];
/** Zapatero junto a la casa con un par de botas por nivel (1–5). */
function drawBootRack(level: number): HTMLCanvasElement {
  const c = makeCanvas(11, 13);
  const ctx = c.getContext('2d')!;
  for (const x of [0, 10]) {
    rect(ctx, x, 1, 1, 12, '#5a3a2a');
    rect(ctx, x, 0, 1, 1, O);
  }
  for (const y of [4, 8, 12]) rect(ctx, 0, y, 11, 1, y === 12 ? O : '#8b5a3c');
  BOOT_SPOTS.slice(0, level).forEach(([x, y], i) => {
    const color = BOOT_COLORS[i];
    for (const bx of [x, x + 2]) {
      rect(ctx, bx, y - 3, 1, 2, color);
      rect(ctx, bx, y - 1, 2, 1, color);
      rect(ctx, bx, y - 3, 1, 1, O);
    }
  });
  return c;
}

/** Mesita del café: cafetera y una taza más por nivel (1–4); la cafetera crece en el 4. */
function drawCoffeeTable(level: number): HTMLCanvasElement {
  const c = makeCanvas(17, 11);
  const ctx = c.getContext('2d')!;
  // tablero y patas
  rect(ctx, 0, 5, 17, 1, '#c8925f');
  rect(ctx, 0, 6, 17, 1, '#8b5a3c');
  rect(ctx, 0, 7, 17, 1, O);
  for (const x of [1, 14]) rect(ctx, x, 8, 2, 3, '#5a3a2a');
  // cafetera
  const big = level >= 4;
  rect(ctx, 1, big ? 0 : 1, 5, big ? 5 : 4, O);
  rect(ctx, 2, big ? 1 : 2, 3, big ? 4 : 3, '#566c86');
  rect(ctx, 2, big ? 1 : 2, 1, big ? 4 : 3, '#94b0c2');
  rect(ctx, 6, 2, 1, 1, O);
  // tazas
  for (let i = 0; i < level; i++) {
    const x = 7 + i * 3 - (i === 3 ? 1 : 0);
    rect(ctx, x, 3, 2, 2, '#f4f4f4');
    rect(ctx, x, 3, 2, 1, '#5a3a2a');
  }
  return c;
}

/** Vaho de la cafetera en dos fotogramas (nivel 1 y 2 del Prop). */
function drawSteam(frame: number): HTMLCanvasElement {
  const c = makeCanvas(3, 4);
  const ctx = c.getContext('2d')!;
  const px = frame === 1 ? [[0, 3], [1, 2], [1, 1], [2, 0]] : [[1, 3], [0, 2], [1, 1], [1, 0]];
  for (const [x, y] of px) rect(ctx, x, y, 1, 1, '#f4f4f4');
  return c;
}

/** Montón de compost: crece con el abono (1–5); desde el 3 tiene cerca de tablas y en el 5 brota una seta. */
function drawCompost(level: number): HTMLCanvasElement {
  const w = 20, h = 13;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  if (level >= 3) {
    for (const x of [0, w - 2]) rect(ctx, x, 2, 2, h - 2, '#5a3a2a');
    rect(ctx, 0, 4, w, 1, '#8b5a3c');
    rect(ctx, 0, 8, w, 1, '#8b5a3c');
    for (const x of [0, w - 2]) rect(ctx, x, 1, 2, 1, O);
  }
  const rx = 4 + level * 1.1, ry = 2 + level * 1.4, cx = w / 2;
  const inHeap = (x: number, y: number) => y < h && ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - h) / ry) ** 2 <= 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inHeap(x, y)) continue;
      const edge = !inHeap(x - 1, y) || !inHeap(x + 1, y) || !inHeap(x, y - 1) || y === h - 1;
      rect(ctx, x, y, 1, 1, edge ? O : (x * 7 + y * 3) % 5 === 0 ? '#5c3a29' : '#3e2519');
    }
  }
  // mondas y cáscaras
  const bits: [number, number, string][] = [[9, 11, '#ef7d57'], [11, 10, '#a7f070'], [8, 10, '#f4f4f4'], [12, 9, '#ffcd75'], [10, 8, '#ef7d57']];
  for (const [x, y, color] of bits.slice(0, level)) if (inHeap(x, y) && inHeap(x, y - 1)) rect(ctx, x, y, 1, 1, color);
  if (level >= 5) {
    const top = Math.ceil(h - ry);
    rect(ctx, 9, top - 3, 3, 1, '#b13e53');
    rect(ctx, 10, top - 3, 1, 1, '#f4f4f4');
    rect(ctx, 10, top - 2, 1, 2, '#f4f4f4');
  }
  return c;
}

/** icono pintado en la tabla de cada cultivo del poste */
const CROP_ICONS: Record<CropId, PixelMap> = {
  zanahoria: ['.g.', 'ooo', '.o.'],
  trigo: ['y.y', 'yyy', '.y.'],
  fresa: ['ggg', 'ryr', '.r.'],
  tomate: ['.g.', 'rrr', 'rrr'],
  calabaza: ['.g.', 'ooo', 'OOO'],
  melon: ['GdG', 'GdG', '.G.'],
};
const ICON_PAL = { g: '#38b764', o: '#ef7d57', O: '#b86f50', y: '#ffcd75', r: '#b13e53', G: '#38b764', d: '#257179' };
/** Poste indicador del bancal: una tabla pintada por cultivo conocido (mask = bits de CROP_IDS conocidos). */
function drawSignpost(mask: number): HTMLCanvasElement {
  const known = CROP_IDS.filter((_, i) => mask & (1 << i));
  const w = 14, h = 6 + 4 * known.length;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  rect(ctx, 1, 0, 4, h, O);
  rect(ctx, 2, 1, 2, h - 1, '#8b5a3c');
  rect(ctx, 3, 1, 1, h - 1, '#5a3a2a');
  known.forEach((crop, i) => {
    const y = 1 + i * 4, flip = i % 2 === 1;
    // tablas en flecha hacia el bancal, alternando un poco el largo
    const len = flip ? 11 : 12;
    rect(ctx, 0, y, len, 4, O);
    rect(ctx, len, y + 1, 1, 2, O);
    rect(ctx, 1, y + 1, len - 1, 2, '#c8925f');
    rect(ctx, len - 1, y + 1, 1, 2, '#c8925f');
    blit(ctx, CROP_ICONS[crop], 6, y, ICON_PAL);
  });
  return c;
}

/** alto máximo del dibujo del pozo (con tejadillo); scene.ts lo usa para el encuadre */
export const WELL_DRAW_H = 26;
/**
 * Pozo del regador, 16 × WELL_DRAW_H, apoyado en la base de WELL. level = 1 + regadera:
 * 1 brocal de piedra con torno, 2 tejadillo, 3 cubo colgando, 4 flores al pie, 5 hiedra entre las piedras.
 */
function drawWell(level: number): HTMLCanvasElement {
  const H = WELL_DRAW_H;
  const c = makeCanvas(16, H);
  const ctx = c.getContext('2d')!;
  // postes y travesaño con el torno
  for (const x of [1, 12]) {
    rect(ctx, x, H - 20, 3, 11, O);
    rect(ctx, x + 1, H - 19, 1, 10, '#8b5a3c');
  }
  rect(ctx, 1, H - 20, 14, 2, O);
  rect(ctx, 2, H - 19, 12, 1, '#c8925f');
  rect(ctx, 15, H - 19, 1, 3, O);
  // cuerda (y cubo, desde el nivel 3)
  rect(ctx, 8, H - 18, 1, level >= 3 ? 4 : 7, '#d9a066');
  if (level >= 3) {
    rect(ctx, 6, H - 14, 5, 4, O);
    rect(ctx, 7, H - 13, 3, 2, '#8b5a3c');
    rect(ctx, 7, H - 12, 3, 1, '#94b0c2');
  }
  // brocal: boca oscura con un brillo de agua y piedras
  rect(ctx, 0, H - 10, 16, 10, O);
  rect(ctx, 1, H - 9, 14, 2, '#333c57');
  rect(ctx, 4, H - 9, 3, 1, '#41a6f6');
  rect(ctx, 1, H - 7, 14, 6, '#94b0c2');
  for (const [x, y] of [[4, 7], [9, 7], [13, 7], [1, 5], [6, 5], [11, 5], [4, 3], [9, 3], [13, 3]]) rect(ctx, x, H - y, 1, 2, '#566c86');
  for (const y of [5, 3]) rect(ctx, 1, H - y + 1, 14, 1, '#566c86');
  if (level >= 2) {
    // tejadillo a dos aguas
    for (let i = 0; i < 6; i++) {
      rect(ctx, 7 - i, H - 26 + i, 2 + 2 * i, 1, O);
      if (i > 0) rect(ctx, 8 - i, H - 26 + i, 2 * i, 1, i % 2 ? '#b13e53' : '#8e2f44');
    }
    rect(ctx, 0, H - 21, 16, 1, O);
  }
  if (level >= 4) {
    for (const [x, color] of [[0, '#e8687d'], [2, '#ffcd75'], [13, '#f4f4f4'], [15, '#e8687d']] as const) {
      rect(ctx, x, H - 2, 1, 1, color);
      rect(ctx, x, H - 1, 1, 1, '#38b764');
    }
  }
  if (level >= 5) for (const [x, y] of [[2, 6], [3, 5], [3, 4], [12, 6], [11, 4], [12, 3]]) rect(ctx, x, H - y, 1, 1, '#38b764');
  return c;
}

/** Atalaya del guardián, a la derecha del poste indicador; GUARD.post (en sim) está a su pie. */
export const TOWER = { x: 176, y: 19, w: 17, h: 36 } as const;
/**
 * Atalaya de madera con escalera y tejado de pizarra. level = 1 + silbato:
 * 2 banderín en la punta, 3 campana bajo el tejado, 4 guirnalda en la barandilla.
 */
function drawTower(level: number): HTMLCanvasElement {
  const { w, h } = TOWER;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const y0 = 5;
  // patas, riostras y escalera
  for (const x of [1, 13]) {
    rect(ctx, x, y0 + 16, 3, h - y0 - 16, O);
    rect(ctx, x + 1, y0 + 16, 1, h - y0 - 16, '#8b5a3c');
  }
  for (let i = 0; i < 9; i++) {
    rect(ctx, 4 + i, y0 + 18 + i, 1, 1, '#5a3a2a');
    rect(ctx, 12 - i, y0 + 18 + i, 1, 1, '#5a3a2a');
  }
  rect(ctx, 6, y0 + 16, 1, h - y0 - 16, '#a8723f');
  rect(ctx, 10, y0 + 16, 1, h - y0 - 16, '#a8723f');
  for (let y = y0 + 18; y < h; y += 3) rect(ctx, 7, y, 3, 1, '#c8925f');
  // garita: postes, barandilla y suelo
  for (const x of [2, 13]) {
    rect(ctx, x, y0 + 7, 2, 8, O);
    rect(ctx, x + (x === 2 ? 1 : 0), y0 + 8, 1, 6, '#8b5a3c');
  }
  rect(ctx, 2, y0 + 10, 13, 2, O);
  rect(ctx, 3, y0 + 10, 11, 1, '#8b5a3c');
  rect(ctx, 0, y0 + 14, w, 3, O);
  rect(ctx, 1, y0 + 15, w - 2, 1, '#c8925f');
  // tejado de pizarra
  for (let i = 0; i < 7; i++) {
    rect(ctx, 7 - i, y0 + i, 3 + 2 * i, 1, O);
    if (i > 0) rect(ctx, 8 - i, y0 + i, 1 + 2 * i, 1, i % 2 ? '#566c86' : '#94b0c2');
  }
  rect(ctx, 0, y0 + 7, w, 1, O);
  if (level >= 2) {
    rect(ctx, 8, 0, 1, y0, O);
    rect(ctx, 9, 0, 3, 1, '#b13e53');
    rect(ctx, 9, 1, 2, 1, '#b13e53');
    rect(ctx, 9, 2, 1, 1, '#b13e53');
  }
  if (level >= 3) {
    rect(ctx, 7, y0 + 8, 3, 2, '#ffcd75');
    rect(ctx, 8, y0 + 10, 1, 1, '#f4b41b');
  }
  if (level >= 4) {
    const flags = ['#b13e53', '#ffcd75', '#41a6f6', '#38b764'];
    for (let x = 3; x <= 13; x += 2) rect(ctx, x, y0 + 12, 1, 1, flags[(x >> 1) % flags.length]);
  }
  return c;
}

/** Refuerzos de la cesta (sobre su dibujo de 12 × 9; el lienzo empieza 2 px a su izquierda): aros, asas y tarima. */
function drawBasketBands(level: number): HTMLCanvasElement {
  const c = makeCanvas(16, 11);
  const ctx = c.getContext('2d')!;
  // aros de hierro
  for (const x of [5, 10]) {
    rect(ctx, x, 5, 1, 3, '#94b0c2');
    rect(ctx, x, 7, 1, 1, '#566c86');
  }
  // asas a los lados
  if (level >= 2) {
    for (const [a, b] of [[1, 0], [14, 15]]) {
      rect(ctx, a, 4, 1, 1, O);
      rect(ctx, b, 5, 1, 2, O);
      rect(ctx, a, 7, 1, 1, O);
    }
  }
  // borde dorado y tarima de madera
  if (level >= 3) {
    rect(ctx, 3, 4, 10, 1, '#ffcd75');
    rect(ctx, 1, 9, 14, 1, '#8b5a3c');
    rect(ctx, 0, 9, 1, 1, O);
    rect(ctx, 15, 9, 1, 1, O);
    for (const x of [1, 7, 13]) rect(ctx, x, 10, 2, 1, O);
  }
  return c;
}

/**
 * Esquina de la cerca del bancal: tramo horizontal arriba o abajo y postes bajando o subiendo por el lateral.
 * Se dibuja para el lado izquierdo; la derecha es la misma en espejo.
 */
function drawFenceCorner(bottom: boolean, right: boolean): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  const post = (x: number, y: number) => {
    rect(ctx, x, y, 3, 6, O);
    rect(ctx, x + 1, y + 1, 1, 4, '#c8925f');
  };
  const ry = bottom ? 10 : 0;
  // lateral: un listón que baja (o sube) entre postes
  rect(ctx, 1, bottom ? 1 : 3, 1, 12, '#8b5a3c');
  post(0, bottom ? 0 : 5);
  if (!bottom) post(0, 10);
  // tramo horizontal
  for (const y of [ry + 1, ry + 3]) {
    rect(ctx, 2, y, 13, 1, '#c8925f');
    rect(ctx, 2, y + 1, 13, 1, '#5a3a2a');
  }
  post(0, ry);
  post(13, ry);
  if (!right) return c;
  const m = makeCanvas(16, 16);
  const mctx = m.getContext('2d')!;
  mctx.scale(-1, 1);
  mctx.drawImage(c, -16, 0);
  return m;
}

/** Poste alto de la cancela, con bola dorada; el de arriba lleva la puerta abierta hacia el camino. */
function drawGatePost(withDoor: boolean): HTMLCanvasElement {
  const c = makeCanvas(12, 10);
  const ctx = c.getContext('2d')!;
  if (withDoor) {
    for (const y of [3, 6]) {
      rect(ctx, 0, y, 9, 1, '#c8925f');
      rect(ctx, 0, y + 1, 9, 1, '#5a3a2a');
    }
    rect(ctx, 0, 2, 1, 6, O);
  }
  rect(ctx, 8, 1, 4, 9, O);
  rect(ctx, 9, 2, 2, 7, '#8b5a3c');
  rect(ctx, 9, 2, 1, 7, '#c8925f');
  rect(ctx, 9, 0, 2, 1, '#ffcd75');
  return c;
}

// ---------- vista ----------

/** Cultivos que conoce el huerto como bits de CROP_IDS: los que no tienen nodo en el árbol se conocen desde el principio. */
const knownCrops = (s: GameState) =>
  CROP_IDS.reduce((mask, c, i) => (!(c in TREE) || s.tree[c as NodeId] > 0 ? mask | (1 << i) : mask), 0);

export class DecorView {
  private sacks: Prop;
  private jars: Prop;
  private barrow: Prop;
  private boots: Prop;
  private coffee: Prop;
  private steam: Prop;
  private compost: Prop;
  private sign: Prop;
  private bands: Prop;
  private fence: Prop[];
  private gate: Prop[];
  private well: Prop;
  private tower: Prop;

  /** Los sprites van directos a `parent` (la capa de entidades) para ordenarse con los gnomos. */
  constructor(parent: Container) {
    this.sacks = new Prop(parent, drawSacks);
    this.jars = new Prop(parent, drawJarShelf);
    this.barrow = new Prop(parent, drawWheelbarrow);
    this.boots = new Prop(parent, drawBootRack);
    this.coffee = new Prop(parent, drawCoffeeTable);
    this.steam = new Prop(parent, drawSteam);
    this.compost = new Prop(parent, drawCompost);
    this.sign = new Prop(parent, drawSignpost);
    this.bands = new Prop(parent, drawBasketBands);
    this.fence = [false, true].flatMap(bottom => [false, true].map(right => new Prop(parent, () => drawFenceCorner(bottom, right))));
    this.gate = [true, false].map(door => new Prop(parent, () => drawGatePost(door)));
    this.well = new Prop(parent, drawWell);
    this.tower = new Prop(parent, drawTower);
  }

  sync(s: GameState) {
    const t = s.tree;
    const barnBottom = BARN.y + 46;
    // junto al granero: sacos a la izquierda, conservas en el hueco de la derecha, carretilla delante
    this.sacks.show(t.saco, BARN.x - 13, barnBottom);
    this.jars.show(t.conservas, BARN.x + 53, barnBottom);
    this.barrow.show(t.carretilla, BARN.x, barnBottom + 15);
    // junto a la casa: zapatero a la izquierda, mesita del café a la derecha
    const houseBottom = HOUSE.y + HOUSE.h;
    this.boots.show(t.botas, HOUSE.x - 11, houseBottom);
    this.coffee.show(t.cafe, HOUSE.x + HOUSE.w + 2, houseBottom - 1);
    // el vaho sube a ratos sobre la cafetera
    const puff = t.cafe > 0 && Math.floor(performance.now() / 400) % 3 !== 2;
    this.steam.show(puff ? 1 + (Math.floor(performance.now() / 400) % 2) : 0, HOUSE.x + HOUSE.w + 4, houseBottom - 1 - 11 + (t.cafe >= 4 ? 0 : 1), houseBottom);
    // sobre el bancal, en la hierba de arriba, donde no pasa nadie
    this.compost.show(t.abono, FIELD.x + 12, FIELD.y - 3);
    this.sign.show(knownCrops(s), FIELD.x + 44, FIELD.y - 2);
    // pozo del regador y atalaya del guardián: aparecen con su oficio y se adornan con su mejora
    this.well.show(t.regadores > 0 ? 1 + t.regadera : 0, WELL.x - 2, WELL.y + WELL.h);
    this.tower.show(t.guardianes > 0 ? 1 + t.silbato : 0, TOWER.x, TOWER.y + TOWER.h);
    // la cesta solo se ve con porteadores (como en scene.ts); los refuerzos van justo encima
    const basketTop = BASKET.y - 4 - 9;
    this.bands.show(hasPorters(s) || s.basket.length > 0 ? t.cesta : 0, BASKET.x - 8, basketTop + 11, BASKET.y - 4 + 0.5);
    // cerca y cancela cuando el bancal está al máximo
    const full = t.bancal >= TREE.bancal.max ? 1 : 0;
    const L = FIELD.x - 2, R = FIELD.x + FIELD.maxCols * FIELD.cell + 2;
    const T = FIELD.y - 2, B = FIELD.y + FIELD.maxRows * FIELD.cell + 2;
    this.fence.forEach((p, i) => {
      const bottom = i >= 2, right = i % 2 === 1;
      p.show(full, right ? R - 11 : L - 5, bottom ? B + 6 : T + 10, bottom ? B + 6 : T);
    });
    // cancela a ambos lados del camino que entra en el bancal (el camino va de DOOR.y - 6 a DOOR.y + 3)
    this.gate[0].show(full, L - 13, DOOR.y - 7);
    this.gate[1].show(full, L - 13, DOOR.y + 14);
  }
}
