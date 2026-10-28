// Atrezo del huerto que cambia con las mejoras: cada compra del árbol se nota a simple vista.
// Los edificios pulsables (granero, tablón, árbol viejo, casa) se dibujan en landmarks.ts; aquí va lo demás.
// Cada objeto es un sprite suelto en la capa de entidades, ordenado por su base como los gnomos.
import { Sprite, Texture, type Container } from 'pixi.js';
import { BARN, BASKET, CROP_IDS, DOOR, FIELD, HOUSE, STATUE, TALENTS, TREE, WELL } from '../sim/config';
import { hasPorters } from '../sim/sim';
import type { CropId, GameState, NodeId } from '../sim/types';
import { ART, artTexture, makeCanvas } from './pixelart';

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
        tex = artTexture(this.draw(level));
        this.cache.set(level, tex);
      }
      this.sprite.texture = tex;
    }
    this.sprite.position.set(x, bottom - this.sprite.texture.height);
    this.sprite.zIndex = z;
  }
}

// ---------- dibujos ----------

// Los tamaños de lienzo se expresan en unidades del mundo; el dibujo usa píxeles de arte.
const canvas = (w: number, h: number) => makeCanvas(w * ART, h * ART);
const WOOD = '#a8723f', LIGHT = '#e5b477', SHADE = '#5a3a2a';
const GOLD = '#ffcd75', GREEN = '#38b764', WHITE = '#f4f4f4';
function box(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  rect(ctx, x, y, w, h, O);
  if (w > 2 && h > 2) rect(ctx, x + 1, y + 1, w - 2, h - 2, color);
}
/** Tabla con canto iluminado, vetas y clavos: todos los detalles tienen un píxel de arte. */
function plank(ctx: Ctx, x: number, y: number, w: number, h: number) {
  box(ctx, x, y, w, h, WOOD);
  rect(ctx, x + 1, y + 1, w - 2, 1, LIGHT);
  if (w > 7) {
    rect(ctx, x + 3, y + h - 2, w - 6, 1, SHADE);
    rect(ctx, x + 2, y + 2, 1, 1, O);
    rect(ctx, x + w - 3, y + 2, 1, 1, O);
  } else if (h > 6) rect(ctx, x + w - 2, y + 3, 1, h - 5, SHADE);
}
function leaf(ctx: Ctx, x: number, y: number, color = GREEN) {
  rect(ctx, x + 1, y, 2, 1, O);
  rect(ctx, x, y + 1, 4, 2, O);
  rect(ctx, x + 1, y + 1, 2, 2, color);
  rect(ctx, x + 1, y + 1, 1, 1, '#a7f070');
}
function coin(ctx: Ctx, x: number, y: number) {
  box(ctx, x, y, 4, 3, '#f4b41b');
  rect(ctx, x + 1, y + 1, 1, 1, GOLD);
}

/** Posiciones en el mundo; cada saco se dibuja a mano sobre una cuadrícula de 10 × 12. */
const SACK_SPOTS: [number, number][][] = [
  [], [[4, 9]], [[1, 9], [6, 9]],
  [[0, 9], [4, 9], [8, 9], [2, 5]],
  [[0, 9], [4, 9], [8, 9], [2, 5], [6, 5], [4, 1]],
];
function drawSacks(level: number): HTMLCanvasElement {
  const c = canvas(13, 15), ctx = c.getContext('2d')!;
  for (const [wx, wy] of SACK_SPOTS[level]) {
    const x = wx * ART, y = wy * ART;
    box(ctx, x + 3, y, 4, 4, '#c8925f');
    box(ctx, x + 1, y + 4, 8, 7, '#c8925f');
    rect(ctx, x, y + 6, 1, 4, O);
    rect(ctx, x + 9, y + 6, 1, 4, O);
    rect(ctx, x + 2, y + 11, 6, 1, O);
    rect(ctx, x + 2, y + 5, 1, 4, LIGHT);
    rect(ctx, x + 7, y + 6, 1, 4, WOOD);
    rect(ctx, x + 3, y + 3, 4, 1, SHADE);
    rect(ctx, x + 4, y + 7, 2, 1, SHADE);
    rect(ctx, x + 5, y + 8, 1, 2, SHADE);
    for (let sy = 5; sy < 10; sy += 2) rect(ctx, x + 8, y + sy, 1, 1, LIGHT);
  }
  return c;
}

const JAR_FILLS = ['#ef7d57', '#e8687d', GOLD] as const;
function drawJarShelf(level: number): HTMLCanvasElement {
  const c = canvas(9, 16), ctx = c.getContext('2d')!;
  for (const x of [0, 15]) plank(ctx, x, 0, 3, 32);
  plank(ctx, 1, 0, 16, 3);
  for (let b = 0; b < 3; b++) {
    const y = 10 + b * 10;
    plank(ctx, 1, y, 16, 2);
    if (2 - b >= level) continue;
    for (const x of [2, 10]) {
      box(ctx, x, y - 7, 6, 7, '#94b0c2');
      rect(ctx, x + 1, y - 5, 4, 4, JAR_FILLS[b]);
      rect(ctx, x + 1, y - 6, 1, 4, WHITE);
      rect(ctx, x + 2, y - 3, 2, 1, '#e5b477');
      box(ctx, x, y - 8, 6, 2, SHADE);
      rect(ctx, x + 1, y - 8, 3, 1, GOLD);
    }
  }
  return c;
}

function drawWheelbarrow(level: number): HTMLCanvasElement {
  const tw = [0, 18, 22, 24][level], w = tw + 14;
  const c = canvas(w / ART, 11), ctx = c.getContext('2d')!;
  const body = level >= 3 ? '#3b5dc9' : WOOD;
  const shade = level >= 3 ? '#29366f' : SHADE;
  for (let i = 0; i < 12; i++) {
    rect(ctx, tw + 2 + i, 8 + Math.floor(i / 2), 1, 3, O);
    rect(ctx, tw + 2 + i, 9 + Math.floor(i / 2), 1, 1, LIGHT);
  }
  plank(ctx, tw - 2, 13, 3, 9);
  for (let y = 0; y < 10; y++) {
    const x0 = 4 + Math.floor(y / 3), x1 = tw + 2 - Math.floor(y / 2);
    rect(ctx, x0, 6 + y, x1 - x0 + 1, 1, O);
    if (y > 0 && y < 9) rect(ctx, x0 + 1, 6 + y, x1 - x0 - 1, 1, y > 6 ? shade : body);
  }
  rect(ctx, 5, 7, tw - 4, 1, level >= 2 ? '#94b0c2' : LIGHT);
  for (let x = 9; x < tw; x += 5) {
    rect(ctx, x, 9, 1, 4, shade);
    rect(ctx, x + 1, 9, 1, 1, '#94b0c2');
  }
  if (level >= 2) {
    const colors = ['#ef7d57', GOLD, '#a7f070', '#e8687d'];
    for (let x = 7, i = 0; x < tw - 1; x += 4, i++) {
      box(ctx, x, 3 - i % 2, 5, 4 + i % 2, colors[i % colors.length]);
      rect(ctx, x + 1, 3 - i % 2, 2, 1, '#a7f070');
      rect(ctx, x + 1, 4 - i % 2, 1, 1, WHITE);
    }
  }
  if (level >= 3) rect(ctx, 11, 10, tw - 12, 1, GOLD);
  box(ctx, 1, 13, 8, 9, '#566c86');
  rect(ctx, 0, 15, 1, 5, O);
  rect(ctx, 9, 15, 1, 5, O);
  rect(ctx, 2, 14, 4, 1, '#94b0c2');
  rect(ctx, 4, 15, 1, 5, O);
  rect(ctx, 2, 17, 5, 1, O);
  rect(ctx, 4, 17, 2, 2, GOLD);
  return c;
}

const BOOT_COLORS = ['#b13e53', '#3b5dc9', GOLD, '#257179', '#ef7d57'] as const;
const BOOT_SPOTS: [number, number][] = [[1, 12], [6, 12], [1, 8], [6, 8], [3, 4]];
function drawBootRack(level: number): HTMLCanvasElement {
  const c = canvas(11, 13), ctx = c.getContext('2d')!;
  for (const x of [0, 19]) plank(ctx, x, 0, 3, 26);
  for (const y of [8, 16, 24]) plank(ctx, 0, y, 22, 2);
  BOOT_SPOTS.slice(0, level).forEach(([wx, wy], i) => {
    for (const x of [wx * ART, wx * ART + 4]) {
      const y = wy * ART;
      box(ctx, x, y - 6, 3, 5, BOOT_COLORS[i]);
      box(ctx, x, y - 3, 4, 3, BOOT_COLORS[i]);
      rect(ctx, x + 1, y - 5, 1, 3, LIGHT);
      rect(ctx, x, y - 6, 3, 1, SHADE);
      rect(ctx, x + 1, y - 3, 1, 1, GOLD);
    }
  });
  return c;
}

function drawCoffeeTable(level: number): HTMLCanvasElement {
  const c = canvas(17, 11), ctx = c.getContext('2d')!;
  for (const x of [2, 28]) plank(ctx, x, 14, 4, 8);
  plank(ctx, 0, 10, 34, 5);
  rect(ctx, 8, 11, 1, 2, SHADE);
  rect(ctx, 22, 11, 1, 2, SHADE);
  const top = level >= 4 ? 0 : 2;
  box(ctx, 2, top, 10, 10 - top, '#566c86');
  rect(ctx, 3, top + 1, 2, 7 - top, '#94b0c2');
  rect(ctx, 4, top + 1, 5, 1, WHITE);
  box(ctx, 11, 4, 3, 4, SHADE);
  rect(ctx, 6, top, 2, 1, GOLD);
  rect(ctx, 6, 7, 4, 1, '#333c57');
  for (let i = 0; i < level; i++) {
    const x = 14 + i * 6 - (i === 3 ? 2 : 0);
    box(ctx, x, 6, 4, 4, WHITE);
    rect(ctx, x + 1, 6, 2, 1, SHADE);
    rect(ctx, x + 3, 7, 2, 2, '#94b0c2');
    rect(ctx, x, 10, 5, 1, '#94b0c2');
  }
  return c;
}
function drawSteam(frame: number): HTMLCanvasElement {
  const c = canvas(3, 4), ctx = c.getContext('2d')!;
  const xs = frame === 1 ? [1, 1, 2, 3, 3, 2, 3, 4] : [3, 2, 1, 1, 2, 3, 2, 2];
  for (let y = 0; y < 8; y++) rect(ctx, xs[y], 7 - y, y % 3 === 0 ? 2 : 1, 1, y % 3 === 0 ? '#94b0c2' : WHITE);
  return c;
}

function drawCompost(level: number): HTMLCanvasElement {
  const c = canvas(20, 13), ctx = c.getContext('2d')!;
  if (level >= 3) {
    for (const x of [0, 36]) plank(ctx, x, 2, 4, 24);
    for (const y of [8, 16]) plank(ctx, 0, y, 40, 3);
  }
  const rx = 8 + level * 2.2, ry = 4 + level * 2.8;
  const inside = (x: number, y: number) => y < 26 && ((x + .5 - 20) / rx) ** 2 + ((y + .5 - 26) / ry) ** 2 <= 1;
  for (let y = 0; y < 26; y++) for (let x = 0; x < 40; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || y === 25;
    rect(ctx, x, y, 1, 1, edge ? O : (x * 7 + y * 3) % 11 < 3 ? '#8b5a3c' : x > 23 ? '#3e2519' : '#5c3a29');
  }
  const bits: [number, number, string][] = [[18, 22, '#ef7d57'], [22, 20, '#a7f070'], [16, 20, WHITE], [24, 18, GOLD], [20, 16, '#ef7d57']];
  for (const [x, y, color] of bits.slice(0, level)) if (inside(x, y - 1)) {
    rect(ctx, x, y, 3, 1, color);
    rect(ctx, x + 2, y - 1, 1, 1, color);
  }
  if (level >= 5) {
    const y = Math.ceil(26 - ry) - 5;
    box(ctx, 19, y + 3, 3, 4, WHITE);
    box(ctx, 16, y + 1, 8, 3, '#b13e53');
    rect(ctx, 18, y, 4, 1, O);
    rect(ctx, 18, y + 1, 2, 1, '#e8687d');
    rect(ctx, 21, y + 2, 1, 1, WHITE);
  }
  return c;
}

/** Pequeñas pinturas originales de seis píxeles, no ampliaciones de los iconos antiguos. */
function cropMark(ctx: Ctx, crop: CropId, x: number, y: number) {
  if (crop === 'trigo') {
    rect(ctx, x + 2, y, 1, 6, GOLD);
    for (let i = 0; i < 3; i++) {
      rect(ctx, x + 1, y + i * 2, 1, 1, '#f4b41b');
      rect(ctx, x + 3, y + i * 2, 1, 1, GOLD);
    }
  } else {
    const color = crop === 'zanahoria' || crop === 'calabaza' ? '#ef7d57' : crop === 'melon' ? GREEN : '#e8687d';
    rect(ctx, x + 1, y + 2, 4, crop === 'zanahoria' ? 2 : 3, color);
    rect(ctx, x + 2, y + 5, crop === 'zanahoria' ? 1 : 2, 1, color);
    rect(ctx, x + 1, y + 1, 3, 1, GREEN);
    rect(ctx, x + 2, y, 1, 2, '#a7f070');
    rect(ctx, x + 1, y + 2, 1, 1, GOLD);
    if (crop === 'melon' || crop === 'calabaza') rect(ctx, x + 3, y + 3, 1, 2, crop === 'melon' ? '#257179' : '#b86f50');
    if (crop === 'fresa') rect(ctx, x + 3, y + 4, 1, 1, GOLD);
  }
}
function drawSignpost(mask: number): HTMLCanvasElement {
  const known = CROP_IDS.filter((_, i) => mask & (1 << i)), packet = (mask & SIGN_PACKET) !== 0;
  const h = 6 + 4 * known.length + (packet ? 7 : 0);
  const c = canvas(14, h), ctx = c.getContext('2d')!;
  plank(ctx, 2, 0, 8, h * ART);
  known.forEach((crop, i) => {
    const y = 2 + i * 8, len = i % 2 ? 22 : 24;
    plank(ctx, 0, y, len, 8);
    rect(ctx, len, y + 1, 1, 6, O);
    rect(ctx, len + 1, y + 2, 1, 4, O);
    rect(ctx, len - 1, y + 2, 2, 4, WOOD);
    cropMark(ctx, crop, 12, y + 1);
  });
  if (packet) {
    const y = (h - 8) * ART;
    rect(ctx, 9, y, 1, 5, SHADE);
    box(ctx, 8, y + 4, 12, 12, GOLD);
    for (let i = 0; i < 5; i++) rect(ctx, 10 + i, y + 5 + i, 1, 1, '#c28a3a');
    leaf(ctx, 12, y + 10);
    rect(ctx, 10, y + 14, 7, 1, '#f4b41b');
  }
  return c;
}

/** Dimensiones públicas en unidades del mundo, nunca en píxeles de arte. */
export const WELL_DRAW_H = 26;
function drawWell(level: number): HTMLCanvasElement {
  const c = canvas(16, WELL_DRAW_H), ctx = c.getContext('2d')!;
  for (const x of [2, 24]) plank(ctx, x, 12, 6, 22);
  plank(ctx, 2, 12, 28, 4);
  box(ctx, 29, 14, 3, 6, '#94b0c2');
  for (let y = 16; y < (level >= 3 ? 24 : 32); y++) rect(ctx, 16, y, 1, 1, y % 2 ? LIGHT : '#c8925f');
  if (level >= 3) {
    box(ctx, 12, 23, 10, 3, '#94b0c2');
    box(ctx, 12, 26, 10, 7, WOOD);
    rect(ctx, 13, 27, 8, 1, '#94b0c2');
    rect(ctx, 14, 28, 1, 4, LIGHT);
    rect(ctx, 18, 28, 1, 4, SHADE);
    rect(ctx, 13, 31, 8, 1, '#566c86');
  }
  box(ctx, 0, 32, 32, 20, '#566c86');
  rect(ctx, 2, 33, 28, 5, '#333c57');
  rect(ctx, 8, 34, 6, 1, '#41a6f6');
  rect(ctx, 11, 35, 8, 1, '#73eff7');
  for (let row = 0; row < 3; row++) {
    const y = 39 + row * 4;
    for (let x = row % 2 ? -3 : 1; x < 31; x += 9) {
      const left = Math.max(1, x), right = Math.min(31, x + 8);
      rect(ctx, left, y, right - left, 3, '#94b0c2');
      rect(ctx, left, y, right - left, 1, '#c0cbdc');
      if (right - left > 5) rect(ctx, right - 2, y + 2, 1, 1, '#566c86');
    }
  }
  if (level >= 2) {
    for (let y = 0; y < 12; y++) {
      const x = 15 - y, w = 2 + y * 2;
      rect(ctx, x, y, w, 1, O);
      if (y > 0) {
        rect(ctx, x + 1, y, w - 2, 1, y % 4 === 0 ? '#8e2f44' : '#b13e53');
        for (let tx = x + 3 + (Math.floor(y / 4) % 2) * 3; tx < x + w - 1; tx += 6) rect(ctx, tx, y, 1, 1, '#e8687d');
      }
    }
    box(ctx, 0, 11, 32, 2, SHADE);
  }
  if (level >= 4) for (const [x, color] of [[0, '#e8687d'], [5, GOLD], [25, WHITE], [29, '#e8687d']] as const) {
    rect(ctx, x + 1, 48, 1, 4, GREEN);
    rect(ctx, x, 47, 3, 2, color);
    rect(ctx, x + 1, 46, 1, 4, color);
    rect(ctx, x + 1, 47, 1, 1, GOLD);
  }
  if (level >= 5) for (const [x, y] of [[3, 39], [5, 42], [4, 46], [25, 40], [23, 43], [25, 47]]) {
    rect(ctx, x + 1, y, 1, 5, '#257179');
    leaf(ctx, x, y);
  }
  return c;
}

export const TOWER = { x: 176, y: 19, w: 17, h: 36 } as const;
function drawTower(level: number): HTMLCanvasElement {
  const c = canvas(TOWER.w, TOWER.h), ctx = c.getContext('2d')!;
  for (const x of [2, 26]) plank(ctx, x, 42, 6, 30);
  for (let i = 0; i < 19; i++) {
    rect(ctx, 8 + i, 46 + i, 2, 2, SHADE);
    rect(ctx, 25 - i, 46 + i, 2, 2, SHADE);
  }
  for (const x of [12, 20]) plank(ctx, x, 42, 3, 30);
  for (let y = 46; y < 72; y += 6) plank(ctx, 14, y, 7, 3);
  for (const x of [4, 26]) plank(ctx, x, 24, 4, 15);
  plank(ctx, 4, 30, 26, 4);
  for (const x of [9, 15, 21]) plank(ctx, x, 33, 2, 6);
  plank(ctx, 0, 38, 34, 6);
  rect(ctx, 2, 42, 30, 1, SHADE);
  for (let y = 0; y < 14; y++) {
    const x = 15 - y, w = 4 + y * 2;
    rect(ctx, x, 10 + y, w, 1, O);
    if (y > 0) {
      rect(ctx, x + 1, 10 + y, w - 2, 1, y % 4 === 3 ? '#333c57' : '#566c86');
      if (y % 4 === 0) rect(ctx, x + 1, 10 + y, w - 2, 1, '#94b0c2');
      for (let tx = x + 4 + (Math.floor(y / 4) % 2) * 3; tx < x + w - 1; tx += 7) rect(ctx, tx, 10 + y, 1, 1, '#333c57');
    }
  }
  box(ctx, 0, 24, 34, 2, SHADE);
  if (level >= 2) {
    rect(ctx, 16, 0, 1, 10, O);
    for (let y = 0; y < 6; y++) {
      rect(ctx, 17, y, 7 - y, 1, O);
      if (y < 4) rect(ctx, 18, y + 1, 4 - y, 1, y === 0 ? '#e8687d' : '#b13e53');
    }
    rect(ctx, 15, 0, 3, 1, GOLD);
  }
  if (level >= 3) {
    rect(ctx, 16, 26, 1, 2, SHADE);
    box(ctx, 14, 28, 6, 5, GOLD);
    rect(ctx, 13, 32, 8, 1, O);
    rect(ctx, 15, 29, 1, 2, WHITE);
    rect(ctx, 16, 33, 2, 1, '#f4b41b');
  }
  if (level >= 4) {
    const colors = ['#b13e53', GOLD, '#41a6f6', GREEN];
    for (let x = 6, i = 0; x < 28; x += 4, i++) {
      const y = 34 + (x > 10 && x < 23 ? 1 : 0);
      rect(ctx, x, y, 4, 1, SHADE);
      rect(ctx, x, y + 1, 3, 2, colors[i % colors.length]);
      rect(ctx, x + 1, y + 3, 1, 1, colors[i % colors.length]);
    }
  }
  return c;
}

/** Superposición de 16 × 11 unidades; conserva su registro con la cesta de la escena. */
function drawBasketBands(level: number): HTMLCanvasElement {
  const c = canvas(16, 11), ctx = c.getContext('2d')!;
  for (const x of [10, 20]) {
    box(ctx, x, 10, 3, 6, '#94b0c2');
    rect(ctx, x + 1, 11, 1, 3, WHITE);
    rect(ctx, x + 1, 15, 1, 1, '#566c86');
  }
  if (level >= 2) for (const x of [0, 28]) {
    box(ctx, x, 9, 4, 7, '#94b0c2');
    rect(ctx, x + 1, 11, 2, 3, O);
    rect(ctx, x + 1, 10, 2, 1, WHITE);
  }
  if (level >= 3) {
    box(ctx, 6, 8, 20, 3, GOLD);
    rect(ctx, 7, 9, 18, 1, '#f4b41b');
    for (const x of [9, 15, 21]) rect(ctx, x, 9, 1, 1, WHITE);
    plank(ctx, 0, 18, 32, 3);
    for (const x of [2, 14, 26]) rect(ctx, x, 21, 4, 1, O);
  }
  return c;
}

function drawFenceCorner(bottom: boolean, right: boolean, golden = false): HTMLCanvasElement {
  const c = canvas(16, 16), ctx = c.getContext('2d')!;
  const post = (x: number, y: number) => {
    plank(ctx, x, y + 1, 6, 11);
    rect(ctx, x + 1, y, 4, 1, O);
    if (golden) {
      box(ctx, x, y + 1, 6, 4, GOLD);
      rect(ctx, x + 1, y + 2, 2, 1, WHITE);
    }
  };
  const ry = bottom ? 20 : 0;
  plank(ctx, 2, bottom ? 2 : 6, 3, 24);
  post(0, bottom ? 0 : 10);
  if (!bottom) post(0, 20);
  for (const y of [ry + 2, ry + 6]) plank(ctx, 4, y, 26, 4);
  post(0, ry);
  post(26, ry);
  if (!right) return c;
  const mirrored = canvas(16, 16), mctx = mirrored.getContext('2d')!;
  mctx.translate(mirrored.width, 0);
  mctx.scale(-1, 1);
  mctx.drawImage(c, 0, 0);
  return mirrored;
}
function drawGatePost(withDoor: boolean): HTMLCanvasElement {
  const c = canvas(12, 10), ctx = c.getContext('2d')!;
  if (withDoor) {
    for (const y of [6, 12]) plank(ctx, 0, y, 19, 4);
    plank(ctx, 0, 4, 3, 12);
    for (let i = 0; i < 14; i++) rect(ctx, 3 + i, 6 + Math.floor(i / 2), 1, 2, SHADE);
    for (const y of [6, 12]) rect(ctx, 15, y + 1, 4, 1, '#94b0c2');
  }
  plank(ctx, 16, 3, 8, 17);
  box(ctx, 17, 1, 6, 4, GOLD);
  rect(ctx, 18, 0, 4, 1, O);
  rect(ctx, 18, 2, 2, 1, WHITE);
  return c;
}

const SIGN_PACKET = 1 << 6;
function drawGoldenStake(): HTMLCanvasElement {
  const c = canvas(7, 12), ctx = c.getContext('2d')!;
  plank(ctx, 2, 4, 6, 20);
  box(ctx, 0, 0, 10, 8, GOLD);
  rect(ctx, 1, 1, 5, 1, WHITE);
  rect(ctx, 7, 3, 2, 4, '#c28a3a');
  rect(ctx, 3, 3, 3, 1, '#f4b41b');
  box(ctx, 8, 8, 6, 6, '#f4b41b');
  rect(ctx, 9, 9, 3, 1, GOLD);
  rect(ctx, 12, 12, 2, 2, O);
  return c;
}
function drawCoinChest(level: number): HTMLCanvasElement {
  const c = canvas(12, 9), ctx = c.getContext('2d')!;
  plank(ctx, 2, 6, 20, 12);
  for (const x of [5, 16]) {
    box(ctx, x, 7, 3, 10, '#c28a3a');
    rect(ctx, x + 1, 8, 1, 7, GOLD);
  }
  if (level < 3) {
    plank(ctx, 2, 2, 20, 6);
    for (const x of [5, 16]) rect(ctx, x, 3, 3, 4, GOLD);
  } else {
    plank(ctx, 4, 0, 16, 4);
    rect(ctx, 5, 3, 14, 3, SHADE);
    for (let x = 5; x < 18; x += 3) coin(ctx, x, 4);
  }
  box(ctx, 10, 8, 4, 5, GOLD);
  rect(ctx, 11, 10, 1, 2, O);
  if (level >= 2) coin(ctx, 20, 14);
  if (level >= 4) coin(ctx, 0, 15);
  if (level >= 5) {
    for (const x of [6, 10, 14]) coin(ctx, x, 2);
    rect(ctx, 12, 1, 1, 3, WHITE);
    rect(ctx, 11, 2, 3, 1, WHITE);
  }
  return c;
}
function drawClovers(level: number): HTMLCanvasElement {
  const c = canvas(13, 6), ctx = c.getContext('2d')!;
  for (let i = 0; i < level; i++) {
    const x = 2 + i * 8, y = (i % 2) * 2;
    rect(ctx, x + 3, y + 3, 1, 9 - y, '#257179');
    for (const [dx, dy] of [[0, 0], [4, 0], [0, 4], [4, 4]]) {
      if (i > 0 && dx === 0 && dy === 4) continue;
      leaf(ctx, x + dx, y + dy, '#38b764');
      rect(ctx, x + dx + 1, y + dy + 2, 1, 1, '#a7f070');
    }
    rect(ctx, x + 3, y + 3, 1, 1, i === 0 ? GOLD : '#a7f070');
  }
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
  private stake: Prop;
  private chest: Prop;
  private clovers: Prop;

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
    // nivel 1 cerca normal, 2 con remates de oro
    this.fence = [false, true].flatMap(bottom => [false, true].map(right => new Prop(parent, level => drawFenceCorner(bottom, right, level === 2))));
    this.gate = [true, false].map(door => new Prop(parent, () => drawGatePost(door)));
    this.well = new Prop(parent, drawWell);
    this.tower = new Prop(parent, drawTower);
    this.stake = new Prop(parent, drawGoldenStake);
    this.chest = new Prop(parent, drawCoinChest);
    this.clovers = new Prop(parent, drawClovers);
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
    const talents = s.prestige.talents;
    this.sign.show(knownCrops(s) | (talents.semillasConocidas > 0 ? SIGN_PACKET : 0), FIELD.x + 44, FIELD.y - 2);
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
    // «bancal heredado»: estaca dorada en la esquina del bancal, o remates de oro en la cerca si ya está
    const inherited = talents.bancalHeredado > 0;
    this.fence.forEach((p, i) => {
      const bottom = i >= 2, right = i % 2 === 1;
      p.show(full && inherited ? 2 : full, right ? R - 11 : L - 5, bottom ? B + 6 : T + 10, bottom ? B + 6 : T);
    });
    this.stake.show(inherited && !full ? 1 : 0, FIELD.x - 8, FIELD.y + 6);
    // cancela a ambos lados del camino que entra en el bancal (el camino va de DOOR.y - 6 a DOOR.y + 3)
    this.gate[0].show(full, L - 13, DOOR.y - 7);
    this.gate[1].show(full, L - 13, DOOR.y + 14);
    // al pie de la estatua: cofre de la herencia a la derecha y tréboles de la suerte a la izquierda
    const statueBottom = STATUE.y + STATUE.h;
    this.chest.show(Math.min(talents.herencia, TALENTS.herencia.max), STATUE.x + 8, statueBottom + 8);
    this.clovers.show(Math.min(talents.suerte, 3), STATUE.x - 5, statueBottom + 7);
  }
}
