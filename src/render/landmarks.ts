// Edificios y monumentos del huerto: dibujo artesanal a doble resolución.
// Las medidas de configuración siguen en unidades del mundo; las coordenadas de dibujo son píxeles de arte.
import { BOARD, HOUSE, NODE_IDS, OLD_TREE, TREE, WORKS } from '../sim/config';
import type { GameState, WorkId } from '../sim/types';
import { makeCanvas } from './pixelart';
import { statueGnomeCanvas } from './gnome';

type Ctx = CanvasRenderingContext2D;
const INK = '#1a1c2c';
const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};
/** Bloque con contorno de un píxel de arte, iluminación superior izquierda. */
function panel(ctx: Ctx, x: number, y: number, w: number, h: number, body: string, light: string, shade: string) {
  rect(ctx, x, y, w, h, INK);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, body);
  rect(ctx, x + 1, y + 1, w - 2, 1, light);
  rect(ctx, x + 1, y + 2, 1, h - 3, light);
  rect(ctx, x + w - 2, y + 2, 1, h - 3, shade);
  rect(ctx, x + 2, y + h - 2, w - 3, 1, shade);
}
/** Tejas escalonadas, con juntas alternas y bisel iluminado. Coordenadas en píxeles de arte. */
function roof(ctx: Ctx, cx: number, y: number, half: number, height: number, red = false) {
  for (let row = 0; row < height; row++) {
    const spread = Math.floor((row + 1) * half / height);
    rect(ctx, cx - spread, y + row, spread * 2, 1, INK);
    if (spread > 1 && row < height - 1) {
      rect(ctx, cx - spread + 1, y + row, spread * 2 - 2, 1, red ? '#b13e53' : '#333c57');
      rect(ctx, cx - spread + 1, y + row, Math.max(1, spread - 1), 1, red ? '#e8687d' : '#566c86');
      for (let x = cx - spread + 2; x < cx + spread - 1; x++) {
        if ((x + Math.floor(row / 4) * 4) % 9 === 0) rect(ctx, x, y + row, 1, 1, red ? '#93324a' : '#1a1c2c');
        else if (row % 4 === 1) rect(ctx, x, y + row, 1, 1, red ? '#ef7d57' : '#94b0c2');
      }
    }
  }
}
/** Altura extra de la bandera, en unidades del mundo. */
const BARN_FLAG = 8;
const GOODS = ['#ef7d57', '#ffcd75', '#e8687d', '#a7f070'] as const;

/** Granero de 108 × 92 píxeles de arte; con bandera mide 108 × 108. */
export function drawBarn(market = 0, guild = false, gilded = false, contract = false): HTMLCanvasElement {
  const top = market >= 5 ? BARN_FLAG * 2 : 0;
  const c = makeCanvas(108, 92 + top), ctx = c.getContext('2d')!;
  if (top) {
    panel(ctx, 52, 0, 3, 23, '#8b5a3c', '#c8925f', '#5a3a2a');
    panel(ctx, 55, 1, 13, 8, '#ffcd75', '#fee3a0', '#c28a3a');
    rect(ctx, 60, 3, 2, 4, '#ef7d57');
    rect(ctx, 57, 3, 1, 2, '#f4f4f4');
  }
  panel(ctx, 4, top + 25, 100, 67, '#b13e53', '#e8687d', '#5d275d');
  rect(ctx, 92, top + 28, 10, 60, '#93324a');
  // Tablas separadas por juntas finas, nudos y vetas de la madera.
  for (let x = 9; x < 101; x += 8) {
    rect(ctx, x, top + 29, 1, 57, '#93324a');
    rect(ctx, x + 1, top + 30, 1, 55, '#e8687d');
    for (let y = 34 + x % 7; y < 84; y += 17) {
      rect(ctx, x + 4, top + y, 1, 7, '#93324a');
      rect(ctx, x + 3, top + y + 2, 3, 1, '#5d275d');
      rect(ctx, x + 3, top + y + 1, 2, 1, '#ef7d57');
    }
  }
  roof(ctx, 54, top, 53, 28);
  rect(ctx, 5, top + 28, 97, 3, '#5d275d');
  rect(ctx, 5, top + 29, 96, 1, '#93324a');
  panel(ctx, 5, top + 86, 98, 5, '#566c86', '#94b0c2', '#333c57');
  for (let x = 15; x < 100; x += 16) rect(ctx, x, top + 88, 1, 2, '#333c57');
  // Ventanuco del pajar y briznas de heno individuales.
  panel(ctx, 46, top + 31, 16, 13, gilded ? '#c28a3a' : '#333c57', gilded ? '#fee3a0' : '#e8687d', '#5d275d');
  rect(ctx, 48, top + 33, 12, 8, INK);
  for (let x = 48; x < 60; x += 2) {
    rect(ctx, x, top + 39 - x % 3, 1, 4 + x % 3, '#ffcd75');
    rect(ctx, x + 1, top + 40, 1, 3, '#c28a3a');
  }
  rect(ctx, 45, top + 44, 19, 2, gilded ? '#ffcd75' : '#e8687d');
  // Puerta de dos hojas, tablas y herrajes.
  panel(ctx, 36, top + 54, 36, 36, '#5a3a2a', '#c8925f', '#333c57');
  for (let x = 40; x < 70; x += 5) rect(ctx, x, top + 56, 1, 32, '#8b5a3c');
  rect(ctx, 54, top + 55, 1, 34, INK);
  for (let i = 0; i < 32; i++) {
    rect(ctx, 38 + i, top + 56 + i, 1, 2, '#f4f4f4');
    rect(ctx, 69 - i, top + 56 + i, 1, 2, '#94b0c2');
  }
  for (const x of [38, 65]) for (const y of [60, 80]) {
    rect(ctx, x, top + y, 5, 2, INK);
    rect(ctx, x + 1, top + y, 1, 1, '#94b0c2');
  }
  rect(ctx, 51, top + 72, 1, 3, '#ffcd75');
  rect(ctx, 57, top + 72, 1, 3, '#ffcd75');
  if (contract) {
    panel(ctx, 48, top + 60, 12, 16, '#fee3a0', '#f4f4f4', '#c8925f');
    for (let y = 64; y < 72; y += 3) rect(ctx, 50, top + y, y === 70 ? 4 : 7, 1, '#8b5a3c');
    rect(ctx, 55, top + 72, 3, 3, '#b13e53');
    rect(ctx, 55, top + 72, 1, 1, '#e8687d');
    rect(ctx, 53, top + 60, 2, 2, '#ffcd75');
  }
  if (market >= 1) {
    const ax = market >= 2 ? 6 : 12, aw = market >= 2 ? 28 : 20;
    panel(ctx, ax, top + 44, aw, 12, '#f4f4f4', gilded ? '#ffcd75' : '#fee3a0', '#566c86');
    for (let x = ax + 1; x < ax + aw - 1; x++) {
      const col = Math.floor((x - ax) / 4) % 2 ? market >= 3 ? '#41a6f6' : '#ffcd75' : '#f4f4f4';
      rect(ctx, x, top + 46, 1, 7, col);
      if ((x - ax) % 6 < 4) rect(ctx, x, top + 55, 1, 2, col);
      if ((x - ax) % 4 === 1) rect(ctx, x, top + 47, 1, 4, '#fee3a0');
    }
    if (gilded) rect(ctx, ax, top + 54, aw, 1, '#ffcd75');
    const crates = market >= 4 ? 3 : market >= 2 ? 2 : 1;
    for (let i = 0; i < crates; i++) {
      const x = 6 + i * 10;
      panel(ctx, x, top + 80, 10, 10, '#a8723f', '#e4b27a', '#5a3a2a');
      rect(ctx, x + 1, top + 85, 8, 1, '#5a3a2a');
      rect(ctx, x + 4, top + 81, 1, 8, '#8b5a3c');
      for (let j = 0; j < 3; j++) {
        rect(ctx, x + 1 + j * 3, top + 77 + j % 2, 3, 3, GOODS[(i + j) % GOODS.length]);
        rect(ctx, x + 1 + j * 3, top + 77 + j % 2, 1, 1, '#fee3a0');
        rect(ctx, x + 2 + j * 3, top + 76 + j % 2, 1, 1, '#38b764');
      }
      rect(ctx, x + 1, top + 81, 1, 1, INK);
      rect(ctx, x + 8, top + 88, 1, 1, INK);
    }
    if (market >= 3) {
      panel(ctx, ax, top + 70, aw, 4, '#8b5a3c', '#c8925f', '#5a3a2a');
      for (let x = ax + 2, i = 0; x < ax + aw - 3; x += 6, i++) {
        panel(ctx, x, top + 65, 5, 5, GOODS[i % GOODS.length], '#fee3a0', '#b13e53');
        rect(ctx, x + 2, top + 64, 1, 1, '#38b764');
      }
    }
    if (market >= 4) {
      const x = ax + Math.floor(aw / 2) - 5;
      rect(ctx, x + 5, top + 57, 1, 3, INK);
      panel(ctx, x, top + 60, 11, 6, '#c28a3a', '#ffcd75', '#8b5a3c');
      rect(ctx, x + 4, top + 61, 3, 4, '#ffcd75');
      rect(ctx, x + 5, top + 62, 1, 2, '#ef7d57');
    }
  }
  if (guild) {
    panel(ctx, 77, top + 44, 24, 3, '#8b5a3c', '#c8925f', '#5a3a2a');
    panel(ctx, 81, top + 47, 17, 21, '#3b5dc9', '#41a6f6', '#29366f');
    for (const x of [83, 94]) {
      rect(ctx, x, top + 49, 1, 17, '#ffcd75');
      rect(ctx, x, top + 68, 2, 2, '#3b5dc9');
    }
    for (let y = 50; y < 66; y += 3) rect(ctx, 96, top + y, 1, 1, '#94b0c2');
    panel(ctx, 86, top + 54, 8, 10, '#c8925f', '#ffcd75', '#8b5a3c');
    rect(ctx, 88, top + 51, 4, 3, '#ffcd75');
    rect(ctx, 87, top + 54, 6, 1, '#5a3a2a');
    rect(ctx, 89, top + 56, 1, 5, '#e4b27a');
    rect(ctx, 88, top + 66, 3, 3, '#b13e53');
  }
  return c;
}

/** Hojas del tablón: coordenadas en unidades del mundo, convertidas al dibujarlas. */
const BOARD_SHEETS: [number, number, number, number, string][] = [
  [2, 3, 5, 7, '#41a6f6'], [8, 2, 5, 6, '#e8687d'], [15, 3, 5, 6, '#ffcd75'],
  [5, 8, 4, 5, '#a7f070'], [12, 7, 5, 6, '#ef7d57'],
];
export const BOARD_ROOF_GROUPS = 6;
/** Altura del tejadillo en unidades del mundo. */
const BOARD_ROOF = 6;

/** Un anuncio por grupo; tejadillo desde BOARD_ROOF_GROUPS y foto de veteranos opcional. */
export function drawBoard(groups = 1, photo = false): HTMLCanvasElement {
  const w = BOARD.w * 2, top = groups >= BOARD_ROOF_GROUPS ? BOARD_ROOF * 2 : 0;
  const h = BOARD.h * 2 + top, c = makeCanvas(w, h), ctx = c.getContext('2d')!;
  for (const x of [6, w - 10]) {
    panel(ctx, x - 1, top + 27, 6, h - top - 28, '#8b5a3c', '#c8925f', '#5a3a2a');
    rect(ctx, x + 2, top + 34, 1, 8, '#5a3a2a');
    rect(ctx, x - 2, h - 2, 8, 2, '#257179');
  }
  panel(ctx, 0, top, w, 32, '#a8723f', '#e4b27a', '#5a3a2a');
  for (const y of [10, 20]) rect(ctx, 1, top + y, w - 2, 1, '#5a3a2a');
  for (let y = 4; y < 29; y += 7) {
    rect(ctx, 3, top + y, 9, 1, '#c8925f');
    rect(ctx, 25, top + y + 2, 12, 1, '#8b5a3c');
  }
  for (const x of [2, w - 3]) for (const y of [2, 28]) rect(ctx, x, top + y, 1, 1, '#94b0c2');
  BOARD_SHEETS.slice(0, Math.max(1, groups)).forEach(([sx, sy, sw, sh, pin], i) => {
    const x = sx * 2, y = top + sy * 2, pw = sw * 2, ph = sh * 2;
    rect(ctx, x + 1, y + 2, pw, ph, '#5a3a2a');
    rect(ctx, x, y, pw, ph, '#fee3a0');
    rect(ctx, x, y, pw - 1, 1, '#f4f4f4');
    rect(ctx, x + pw - 2, y + ph - 2, 2, 2, '#c8925f');
    rect(ctx, x + 2, y + 3, 3, 2, pin);
    for (let ly = 7; ly < ph - 1; ly += 3) rect(ctx, x + 2, y + ly, pw - 4 - (ly + i) % 3, 1, '#8b5a3c');
    rect(ctx, x + Math.floor(pw / 2), y, 2, 2, pin);
    rect(ctx, x + Math.floor(pw / 2), y, 1, 1, '#f4f4f4');
  });
  if (photo) {
    panel(ctx, 32, top + 16, 10, 12, '#c28a3a', '#ffcd75', '#8b5a3c');
    rect(ctx, 33, top + 18, 8, 8, '#566c86');
    for (const x of [34, 38]) {
      rect(ctx, x, top + 18, 2, 2, x === 34 ? '#b13e53' : '#38b764');
      rect(ctx, x, top + 20, 2, 2, '#f2b98c');
      rect(ctx, x, top + 22, 2, 3, '#f4f4f4');
      rect(ctx, x + 1, top + 20, 1, 1, INK);
    }
  }
  if (top) roof(ctx, w / 2, 0, w / 2, 10, true);
  return c;
}

const TREE_STAGES = [0.08, 0.3, 0.55, 0.8];
const TREE_MAX_SUM = NODE_IDS.reduce((sum, id) => sum + TREE[id].max, 0);
/** Etapa 0–4 según la fracción de mejoras compradas. */
export function oldTreeStage(s: GameState): number {
  const bought = NODE_IDS.reduce((sum, id) => sum + s.tree[id], 0) / TREE_MAX_SUM;
  return TREE_STAGES.filter(f => bought >= f).length;
}

/** Copa de hojas agrupadas, corteza nudosa, flores, faroles y casita de pájaros. */
export function drawOldTree(stage = 0): HTMLCanvasElement {
  const w = OLD_TREE.w * 2, h = OLD_TREE.h * 2, c = makeCanvas(w, h), ctx = c.getContext('2d')!;
  const trunk = (x: number, y: number) => (x >= 30 && x <= 49 && y >= 50 && y < h)
    || (y >= h - 8 && y < h && x >= 22 + h - 1 - y && x <= 57 - (h - 1 - y));
  for (let y = 50; y < h; y++) for (let x = 20; x < 60; x++) {
    if (!trunk(x, y)) continue;
    const edge = !trunk(x - 1, y) || !trunk(x + 1, y) || !trunk(x, y + 1);
    rect(ctx, x, y, 1, 1, edge ? INK : x >= 43 ? '#5a3a2a' : x < 35 ? '#c8925f' : '#8b5a3c');
  }
  for (let x = 33; x < 49; x += 4) {
    rect(ctx, x, 57 + x % 4, 1, 24, '#5a3a2a');
    rect(ctx, x + 1, 59 + x % 4, 1, 17, '#a8723f');
  }
  for (const [x, y] of [[34, 78], [45, 61], [40, 84]] as const) {
    panel(ctx, x, y, 4, 6, '#8b5a3c', '#c8925f', '#5a3a2a');
    rect(ctx, x + 2, y + 2, 1, 2, '#5a3a2a');
  }
  panel(ctx, 35, 66, 11, 14, '#5a3a2a', '#a8723f', INK);
  rect(ctx, 37, 68, 7, 10, INK);
  panel(ctx, 39, 72, 4, 5, '#ffcd75', '#fee3a0', '#ef7d57');
  // Masas grandes para la silueta; cada hoja se dibuja con un nervio de un píxel.
  const blobs = stage === 0
    ? [[40, 34, 34, 26], [20, 46, 16, 12], [60, 46, 16, 12]]
    : [[40, 32, 38, 28], [18, 44, 18, 14], [62, 44, 18, 14]];
  if (stage >= 2) blobs.push([12, 34, 12, 14], [68, 34, 12, 14]);
  const inside = (x: number, y: number) => blobs.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
  for (let y = 0; y < 68; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    const light = ((x - 27) / 28) ** 2 + ((y - 23) / 23) ** 2 < 1;
    rect(ctx, x, y, 1, 1, edge ? INK : y > 48 || x > 62 ? '#1f5e57' : light ? '#38b764' : '#257179');
  }
  for (let y = 9; y < 60; y += 7) for (let x = 5 + (y % 3) * 2; x < 76; x += 9) {
    const color = x < 45 && y < 36 ? '#a7f070' : '#2e9a58';
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 6; dx++) {
      if (Math.abs(dx - 2) + Math.abs(dy - 1) > 3 || !inside(x + dx, y + dy) || !inside(x + dx + 1, y + dy + 1)) continue;
      rect(ctx, x + dx, y + dy, 1, 1, dy === 3 ? '#1f5e57' : color);
    }
    if (inside(x + 2, y + 2)) rect(ctx, x + 2, y + 2, 3, 1, '#38b764');
  }
  if (stage >= 2) for (const [x, y] of [[22, 12], [52, 12], [8, 36], [70, 38], [40, 18], [60, 30], [16, 24]] as const) {
    rect(ctx, x - 1, y, 5, 2, '#f4f4f4');
    rect(ctx, x + 1, y - 2, 2, 6, '#f4f4f4');
    rect(ctx, x + 2, y + 2, 2, 1, '#e8687d');
    rect(ctx, x + 1, y, 2, 2, '#ffcd75');
  }
  const seeds = [[24, 48], [50, 40], [64, 52], [36, 54], [12, 38], [56, 24], [30, 28]];
  for (const [x, y] of seeds.slice(0, [2, 4, 7, 7, 7][stage])) {
    rect(ctx, x + 1, y - 3, 1, 3, '#8b5a3c');
    panel(ctx, x, y, 5, 5, '#ffcd75', '#fee3a0', '#c28a3a');
    rect(ctx, x + 3, y + 2, 1, 2, '#ef7d57');
  }
  if (stage >= 3) for (const [x, y] of [[14, 58], [62, 58]] as const) {
    rect(ctx, x + 3, y, 1, 5, INK);
    panel(ctx, x, y + 4, 8, 11, '#ffcd75', '#fee3a0', '#ef7d57');
    rect(ctx, x + 1, y + 6, 6, 1, '#8b5a3c');
    rect(ctx, x + 4, y + 6, 1, 7, '#c28a3a');
    rect(ctx, x + 2, y + 15, 4, 1, INK);
  }
  if (stage >= 4) {
    panel(ctx, 58, 11, 11, 11, '#c8925f', '#e4b27a', '#8b5a3c');
    roof(ctx, 63, 6, 8, 7, true);
    panel(ctx, 62, 14, 4, 4, INK, '#5a3a2a', INK);
    rect(ctx, 61, 20, 8, 1, '#5a3a2a');
    rect(ctx, 63, 18, 1, 3, '#e4b27a');
    panel(ctx, 60, 2, 5, 5, '#41a6f6', '#73eff7', '#3b5dc9');
    rect(ctx, 58, 5, 3, 2, '#3b5dc9');
    rect(ctx, 65, 3, 2, 1, '#ffcd75');
    rect(ctx, 63, 3, 1, 1, INK);
  }
  return c;
}

/** Medidas de las etapas de la casa, en unidades del mundo. */
const HOUSE_TIERS = [
  { wallW: 14, wallH: 10, capW: 24, capH: 9 },
  { wallW: 18, wallH: 12, capW: 28, capH: 11 },
  { wallW: 20, wallH: 16, capW: 30, capH: 10 },
] as const;
/** Motas: desplazamientos en unidades del mundo desde el centro y lo alto del sombrero. */
const CAP_SPOTS = [[-6, 3], [4, 2], [-1, 5], [8, 5], [-10, 6], [1, 1], [-4, 7], [6, 7], [11, 7]];

/** Casa-seta: cada nivel añade motas y flores; cada etapa cambia su arquitectura. */
export function drawHouse(level: number, golden = false): HTMLCanvasElement {
  const w = HOUSE.w * 2, h = HOUSE.h * 2;
  const tier = level >= 6 ? 2 : level >= 3 ? 1 : 0;
  const dims = HOUSE_TIERS[tier], wallW = dims.wallW * 2, wallH = dims.wallH * 2;
  const capW = dims.capW * 2, capH = dims.capH * 2;
  const full = makeCanvas(w, h), ctx = full.getContext('2d')!, cx = w / 2;
  const wx = cx - wallW / 2, wallTop = h - 2 - wallH, capTop = wallTop - capH + 4;
  if (tier >= 1) {
    const x = cx + 12, y = capTop - 4;
    panel(ctx, x, y, 8, 14, '#8b5a3c', '#c8925f', '#5a3a2a');
    for (let by = 3; by < 13; by += 4) {
      rect(ctx, x + 1, y + by, 6, 1, '#5a3a2a');
      rect(ctx, x + (by % 8 === 3 ? 3 : 5), y + by - 2, 1, 2, '#5a3a2a');
    }
    panel(ctx, x - 1, y, 10, 3, '#a8723f', '#e4b27a', '#5a3a2a');
    rect(ctx, x + 4, y - 4, 2, 2, '#94b0c2');
    rect(ctx, x + 6, y - 6, 2, 1, '#c7cfcc');
  }
  if (tier === 2) {
    rect(ctx, cx - 2, 0, 2, capTop + 2, '#5a3a2a');
    panel(ctx, cx, 0, 8, 4, '#41a6f6', '#73eff7', '#3b5dc9');
    rect(ctx, cx, 4, 4, 2, '#3b5dc9');
  }
  panel(ctx, wx, wallTop, wallW, wallH, '#fee3a0', '#f4f4f4', '#94b0c2');
  rect(ctx, wx + 1, wallTop + 1, wallW - 2, 4, '#94b0c2');
  rect(ctx, wx + wallW - 5, wallTop + 5, 3, wallH - 6, '#c7cfcc');
  for (let y = wallTop + 8; y < h - 5; y += 5) {
    rect(ctx, wx + 2, y, 3, 1, '#e4b27a');
    rect(ctx, wx + wallW - 8, y + 1, 4, 1, '#94b0c2');
  }
  const doorH = tier === 0 ? 14 : 16, dx = cx - 6, dy = h - 2 - doorH;
  panel(ctx, dx, dy + 2, 12, doorH, '#8b5a3c', '#c8925f', '#5a3a2a');
  panel(ctx, dx + 2, dy, 8, 5, '#8b5a3c', '#c8925f', '#5a3a2a');
  rect(ctx, dx + 2, dy + 3, 8, 2, '#8b5a3c');
  for (let x = dx + 3; x < dx + 10; x += 3) rect(ctx, x, dy + 4, 1, doorH - 3, '#5a3a2a');
  for (const y of [dy + 5, dy + doorH - 2]) {
    rect(ctx, dx + 1, y, 4, 1, INK);
    rect(ctx, dx + 2, y, 1, 1, '#94b0c2');
  }
  panel(ctx, dx + 7, dy + Math.floor(doorH / 2), golden ? 4 : 3, golden ? 4 : 3, '#ffcd75', '#fee3a0', '#c28a3a');
  panel(ctx, dx - 2, h - 2, 16, 2, golden ? '#f4b41b' : '#94b0c2', golden ? '#fee3a0' : '#f4f4f4', '#566c86');
  for (let i = 0; i < level % 3; i++) {
    const x = i === 0 ? dx - 6 : dx + 16;
    rect(ctx, x, h - 7, 1, 5, '#257179');
    rect(ctx, x - 2, h - 5, 2, 1, '#38b764');
    rect(ctx, x - 2, h - 9, 5, 3, i === 0 ? '#ef7d57' : '#ffcd75');
    rect(ctx, x, h - 10, 1, 5, i === 0 ? '#ef7d57' : '#ffcd75');
    rect(ctx, x, h - 8, 1, 1, '#f4f4f4');
  }
  const windows: [number, number][] = [];
  if (tier >= 1) windows.push([wx + 2, h - 18], [wx + wallW - 10, h - 18]);
  if (tier === 2) {
    windows.push([wx + 6, wallTop + 4], [wx + wallW - 14, wallTop + 4]);
    rect(ctx, wx + 1, wallTop + 14, wallW - 2, 1, '#94b0c2');
  }
  for (const [x, y] of windows) {
    panel(ctx, x, y, 8, 8, '#ffcd75', '#fee3a0', '#ef7d57');
    rect(ctx, x + 4, y + 1, 1, 6, '#8b5a3c');
    rect(ctx, x + 1, y + 4, 6, 1, '#8b5a3c');
    rect(ctx, x - 1, y + 8, 10, 2, '#94b0c2');
  }
  const inCap = (x: number, y: number) => y >= capTop && y < capTop + capH
    && ((x + 0.5 - cx) / (capW / 2)) ** 2 + ((capTop + capH - 0.5 - y) / capH) ** 2 <= 1;
  for (let y = capTop; y < capTop + capH; y++) for (let x = 0; x < w; x++) {
    if (!inCap(x, y)) continue;
    const edge = !inCap(x - 1, y) || !inCap(x + 1, y) || !inCap(x, y - 1) || y === capTop + capH - 1;
    let color = '#b13e53';
    if (edge) color = INK;
    else if (y > capTop + capH - 5 || x > cx + capW / 4) color = '#93324a';
    else if (((x - cx + capW / 6) / (capW / 3)) ** 2 + ((y - capTop - capH / 3) / (capH / 2)) ** 2 < 1) color = '#e8687d';
    if (!edge && y === capTop + capH - 3 && x % 4 === 0) color = '#ef7d57';
    rect(ctx, x, y, 1, 1, color);
  }
  for (const [sx, sy] of CAP_SPOTS.slice(0, 1 + level)) {
    const x = cx + sx * 2, y = capTop + sy * 2;
    if (y >= capTop + capH - 4 || !inCap(x - 1, y) || !inCap(x + 4, y + 2)) continue;
    rect(ctx, x, y, 4, 2, '#f4f4f4');
    rect(ctx, x + 1, y - 1, 2, 1, '#fee3a0');
    rect(ctx, x + 1, y + 2, 3, 1, '#c7cfcc');
  }
  // Recorte idéntico al original en unidades del mundo, convertido a píxeles de arte.
  const top = tier === 2 ? 0 : Math.max(0, tier === 1 ? capTop - 10 : capTop);
  const c = makeCanvas(w, h - top);
  c.getContext('2d')!.drawImage(full, 0, -top);
  return c;
}

/** Ancho del monumento en unidades del mundo, NO en píxeles de arte. */
export const STATUE_DRAW_W = 20;
export const statueTier = (season: number) => (season >= 4 ? 2 : season >= 2 ? 1 : 0);

/** Pedestal de piedra, figura dorada saludando y, desde la última etapa, laurel y aureola. */
export function drawStatue(tier: number): HTMLCanvasElement {
  const w = STATUE_DRAW_W * 2, pedH = tier === 0 ? 10 : 18, rays = tier === 2 ? 4 : 0;
  const h = rays + 34 + pedH, top = h - pedH;
  const c = makeCanvas(w, h), ctx = c.getContext('2d')!;
  const block = (x: number, y: number, bw: number, bh: number) => {
    panel(ctx, x, y, bw, bh, '#94b0c2', '#f4f4f4', '#566c86');
    rect(ctx, x + bw - 4, y + 2, 2, Math.max(1, bh - 4), '#566c86');
    if (bw > 24) rect(ctx, x + 5, y + bh - 2, 4, 1, '#c7cfcc');
  };
  if (tier === 0) {
    block(4, top + 4, 32, 6);
    block(6, top, 28, 6);
  } else {
    block(2, top + 12, 36, 6);
    block(6, top + 4, 28, 10);
    block(2, top, 36, 6);
    for (const x of [8, 30]) rect(ctx, x, top + 6, 1, 6, '#566c86');
    const px = tier === 2 ? 14 : 12, pw = tier === 2 ? 12 : 16;
    panel(ctx, px, top + 6, pw, 6, '#f4b41b', '#fee3a0', '#c28a3a');
    rect(ctx, px + 2, top + 8, pw - 4, 1, '#8b5a3c');
    rect(ctx, px + 3, top + 10, pw - 6, 1, '#c28a3a');
    if (tier === 2) for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = side < 0 ? 9 + i % 2 : 29 - i % 2, y = top + 11 - i * 2;
        rect(ctx, x, y, 1, 3, '#257179');
        rect(ctx, x + side, y - 1, 2, 2, '#38b764');
        rect(ctx, x + side, y - 1, 1, 1, '#a7f070');
      }
    }
  }
  // Aureola detrás del gorro: contorno pixelado, sin transparencia ni degradados.
  if (rays) {
    for (let y = 1; y < 23; y++) for (let x = 7; x < 33; x++) {
      const d = ((x - 20) / 11) ** 2 + ((y - 12) / 10) ** 2;
      if (d > 0.77 && d <= 1) rect(ctx, x, y, 1, 1, x < 20 ? '#ffcd75' : '#c28a3a');
    }
  }
  ctx.drawImage(statueGnomeCanvas(), 4, top - 34);
  if (rays) for (const [x, y, rw, rh] of [[18, 0, 1, 3], [21, 0, 1, 2], [6, 6, 2, 1], [32, 4, 1, 3], [2, 16, 3, 1], [35, 14, 2, 1]]) {
    rect(ctx, x, y, rw, rh, '#ffcd75');
  }
  return c;
}

/** Obras del pueblo, del tamaño de su caja: solar con cerca y cartel a nivel 0; cada nivel añade parte del edificio. */
export function drawWork(id: WorkId, level: number): HTMLCanvasElement {
  const w = WORKS[id].w * 2, h = WORKS[id].h * 2;
  const c = makeCanvas(w, h), ctx = c.getContext('2d')!;
  if (level <= 0) drawLot(ctx, id, w, h);
  else if (id === 'molino') drawMill(ctx, level, w, h);
  else if (id === 'invernadero') drawGreenhouse(ctx, level, w, h);
  else drawFountain(ctx, level, w, h);
  return c;
}

/** Solar de tierra removida, cartel con el dibujo de la obra y cerca delante. */
function drawLot(ctx: Ctx, id: WorkId, w: number, h: number) {
  rect(ctx, 2, h - 12, w - 4, 10, INK);
  rect(ctx, 3, h - 11, w - 6, 8, '#8b5a3c');
  rect(ctx, 3, h - 11, w - 6, 1, '#a8723f');
  for (let x = 6; x < w - 6; x += 7) {
    rect(ctx, x, h - 8 + x % 3, 3, 1, '#5a3a2a');
    rect(ctx, x + 1, h - 9 + x % 3, 1, 1, '#c8925f');
  }
  // Cartel: dos renglones de letra y el dibujo de lo que se va a construir.
  const sx = Math.floor(w / 2) - 11, sy = h - 34, ix = sx + 15, iy = sy + 3;
  panel(ctx, sx + 10, sy + 10, 3, 18, '#8b5a3c', '#c8925f', '#5a3a2a');
  panel(ctx, sx, sy, 22, 12, '#e4b27a', '#fee3a0', '#a8723f');
  rect(ctx, sx + 3, sy + 4, 10, 1, '#8b5a3c');
  rect(ctx, sx + 3, sy + 7, 7, 1, '#8b5a3c');
  if (id === 'molino') {
    for (let i = 0; i < 5; i++) {
      rect(ctx, ix + i, iy + i, 1, 1, '#566c86');
      rect(ctx, ix + 4 - i, iy + i, 1, 1, '#566c86');
    }
    rect(ctx, ix + 2, iy + 2, 1, 1, '#5a3a2a');
  } else if (id === 'invernadero') {
    rect(ctx, ix + 2, iy, 1, 1, '#f4f4f4');
    rect(ctx, ix + 1, iy + 1, 3, 1, '#f4f4f4');
    rect(ctx, ix, iy + 2, 5, 4, '#41a6f6');
    rect(ctx, ix + 2, iy + 2, 1, 4, '#f4f4f4');
  } else {
    rect(ctx, ix + 2, iy, 1, 1, '#41a6f6');
    rect(ctx, ix + 1, iy + 1, 3, 2, '#41a6f6');
    rect(ctx, ix, iy + 3, 5, 2, '#41a6f6');
    rect(ctx, ix + 1, iy + 5, 3, 1, '#3b5dc9');
    rect(ctx, ix + 1, iy + 3, 1, 1, '#73eff7');
  }
  // Cerca: dos travesaños y postes repartidos de punta a punta.
  for (const y of [h - 13, h - 8]) {
    rect(ctx, 2, y, w - 4, 2, '#5a3a2a');
    rect(ctx, 3, y, w - 6, 1, '#c8925f');
  }
  const posts = Math.round((w - 7) / 8);
  for (let i = 0; i <= posts; i++) {
    const x = 2 + Math.round(i * (w - 7) / posts);
    panel(ctx, x, h - 16, 3, 13, '#a8723f', '#e4b27a', '#5a3a2a');
  }
}

/** Molino: torre de piedra (1), aspas de tela (2) y tejado rojo con veleta (3). */
function drawMill(ctx: Ctx, level: number, w: number, h: number) {
  const cx = w / 2, top = 34, bottom = h - 5;
  // Torre un poco más ancha abajo, con hiladas de piedra alternas.
  rect(ctx, cx - 12, top - 1, 24, 1, INK);
  for (let y = top; y < bottom; y++) {
    const half = 11 + Math.floor((y - top) * 5 / (bottom - top)), row = y - top;
    rect(ctx, cx - half - 1, y, half * 2 + 2, 1, INK);
    rect(ctx, cx - half, y, half * 2, 1, '#94b0c2');
    if (row % 6 === 5) rect(ctx, cx - half, y, half * 2, 1, '#566c86');
    else for (let x = cx - half + 4 + (Math.floor(row / 6) % 2 ? 3 : 0); x < cx + half - 1; x += 7) rect(ctx, x, y, 1, 1, '#566c86');
    rect(ctx, cx - half, y, 2, 1, '#c7cfcc');
    rect(ctx, cx + half - 3, y, 3, 1, '#566c86');
  }
  panel(ctx, 6, h - 6, w - 12, 4, '#566c86', '#94b0c2', '#333c57');
  // Puerta de tablas y ventanuco con luz.
  panel(ctx, cx - 5, bottom - 14, 10, 14, '#8b5a3c', '#c8925f', '#5a3a2a');
  rect(ctx, cx, bottom - 13, 1, 12, '#5a3a2a');
  rect(ctx, cx + 2, bottom - 7, 1, 1, '#ffcd75');
  panel(ctx, cx - 3, top + 10, 6, 7, '#333c57', '#566c86', INK);
  rect(ctx, cx - 2, top + 11, 4, 5, '#ffcd75');
  rect(ctx, cx, top + 11, 1, 5, '#8b5a3c');
  if (level >= 3) {
    roof(ctx, cx, top - 20, 15, 21, true);
    rect(ctx, cx - 1, top - 25, 2, 5, INK);
    rect(ctx, cx + 1, top - 25, 5, 3, INK);
    rect(ctx, cx + 1, top - 24, 4, 1, '#ffcd75');
  } else {
    for (const x of [cx - 12, cx - 5, cx + 2, cx + 8]) panel(ctx, x, top - 4, 4, 4, '#94b0c2', '#c7cfcc', '#566c86');
  }
  if (level < 2) return;
  // Aspas en aspa: primero el contorno de las telas, luego las telas y encima los largueros.
  const hx = cx, hy = top + 2, ARM = 22, CLOTH = 4;
  const arms = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
  for (const pass of [0, 1]) for (const [dx, dy] of arms) for (let i = 8; i <= ARM; i++) for (let k = 1; k <= CLOTH; k++) {
    const px = hx + dx * i - dy * k, py = hy + dy * i + dx * k;
    if (pass === 0) rect(ctx, px - 2, py - 2, 4, 4, INK);
    else rect(ctx, px - 1, py - 1, 2, 2, i % 4 === 0 || k === CLOTH ? '#c7cfcc' : '#f4f4f4');
  }
  for (const [dx, dy] of arms) for (let i = 3; i <= ARM; i++) rect(ctx, hx + dx * i - 1, hy + dy * i - 1, 2, 2, '#5a3a2a');
  panel(ctx, hx - 3, hy - 3, 6, 6, '#8b5a3c', '#c8925f', '#5a3a2a');
  rect(ctx, hx - 1, hy - 1, 2, 2, '#ffcd75');
}

const GREENHOUSE_FLOWERS = ['#ef7d57', '#ffcd75', '#e8687d', '#f4f4f4'] as const;
/** Invernadero: armazón blanco con cristales por poner (1), cristales (2) y flores dentro (3). */
function drawGreenhouse(ctx: Ctx, level: number, w: number, h: number) {
  const x0 = 4, x1 = w - 4, cx = w / 2, apex = 10, wallTop = 30, floor = h - 8;
  const half = (x1 - x0) / 2, H = wallTop - apex;
  const spread = (row: number) => Math.floor((row + 1) * half / H);
  panel(ctx, x0 - 1, floor, x1 - x0 + 2, 6, '#94b0c2', '#c7cfcc', '#566c86');
  for (let x = x0 + 5; x < x1; x += 8) rect(ctx, x, floor + 2, 1, 3, '#566c86');
  rect(ctx, x0 + 2, floor - 4, x1 - x0 - 4, 4, '#8b5a3c');
  rect(ctx, x0 + 2, floor - 4, x1 - x0 - 4, 1, '#a8723f');
  const glass = (x: number, y: number) => rect(ctx, x, y, 1, 1, (x + y) % 11 < 2 ? '#f4f4f4' : y > floor - 10 ? '#41a6f6' : '#73eff7');
  if (level >= 2) {
    for (let y = wallTop; y < floor - 4; y++) for (let x = x0; x < x1; x++) glass(x, y);
    for (let row = 0; row < H; row++) for (let x = cx - spread(row); x < cx + spread(row); x++) glass(x, apex + row);
  }
  if (level >= 3) {
    for (let i = 0, x = x0 + 5; x < x1 - 4; i++, x += 7) {
      const top = floor - 13 + (i % 2) * 3;
      rect(ctx, x, top, 1, floor - 4 - top, '#257179');
      rect(ctx, x - 2, floor - 8, 2, 1, '#38b764');
      rect(ctx, x + 1, floor - 10 + (i % 2), 2, 1, '#38b764');
      rect(ctx, x - 1, top - 1, 3, 3, GREENHOUSE_FLOWERS[i % GREENHOUSE_FLOWERS.length]);
      rect(ctx, x, top, 1, 1, '#fee3a0');
    }
  }
  // Armazón: vigas del tejado, alero, postes y montantes hasta la cumbrera.
  for (let row = 0; row < H; row++) {
    const y = apex + row, sp = spread(row);
    rect(ctx, cx - sp, y, 3, 1, INK);
    rect(ctx, cx - sp + 1, y, 1, 1, '#f4f4f4');
    rect(ctx, cx + sp - 3, y, 3, 1, INK);
    rect(ctx, cx + sp - 2, y, 1, 1, '#f4f4f4');
  }
  for (const x of [x0 + 19, cx - 1, x1 - 22]) {
    const y = apex + Math.max(0, Math.ceil(Math.abs(x - cx) * H / half) - 1);
    rect(ctx, x, y, 1, wallTop - y, '#f4f4f4');
    rect(ctx, x + 1, y, 1, wallTop - y, '#94b0c2');
  }
  panel(ctx, x0 - 1, wallTop - 1, x1 - x0 + 2, 3, '#f4f4f4', '#f4f4f4', '#94b0c2');
  for (let x = x0; x <= x1 - 3; x += 19) panel(ctx, x, wallTop + 1, 3, floor - wallTop - 1, '#f4f4f4', '#f4f4f4', '#94b0c2');
  if (level >= 2) rect(ctx, x0, wallTop + 12, x1 - x0, 1, '#f4f4f4');
  // Puerta en el centro y, mientras faltan cristales, un montón de ellos esperando.
  panel(ctx, cx - 6, floor - 16, 2, 16, '#f4f4f4', '#f4f4f4', '#94b0c2');
  panel(ctx, cx + 4, floor - 16, 2, 16, '#f4f4f4', '#f4f4f4', '#94b0c2');
  panel(ctx, cx - 6, floor - 17, 12, 2, '#f4f4f4', '#f4f4f4', '#94b0c2');
  rect(ctx, cx + 2, floor - 8, 1, 2, '#ffcd75');
  if (level === 1) {
    panel(ctx, x0 + 6, floor - 8, 8, 8, '#73eff7', '#f4f4f4', '#41a6f6');
    panel(ctx, x0 + 8, floor - 10, 8, 10, '#73eff7', '#f4f4f4', '#41a6f6');
  }
  rect(ctx, cx - 1, apex - 2, 2, 2, INK);
}

/** Fuente: pila de piedra con agua (1), columna con chorro (2) y estatuilla de gnomo encima (3). */
function drawFountain(ctx: Ctx, level: number, w: number, h: number) {
  const cx = w / 2, by = h - 16, colTop = level >= 3 ? 22 : 20;
  panel(ctx, 0, h - 4, w, 4, '#566c86', '#94b0c2', '#333c57');
  if (level >= 2) {
    panel(ctx, cx - 4, colTop, 8, by + 2 - colTop, '#94b0c2', '#c7cfcc', '#566c86');
    rect(ctx, cx + 1, colTop + 3, 1, by - colTop - 3, '#566c86');
  }
  // Pila: pared delantera con juntas, borde claro y el agua dentro.
  panel(ctx, 3, by + 4, w - 6, 10, '#94b0c2', '#c7cfcc', '#566c86');
  for (let x = 8; x < w - 6; x += 8) rect(ctx, x, by + 6, 1, 6, '#566c86');
  panel(ctx, 1, by, w - 2, 5, '#c7cfcc', '#f4f4f4', '#94b0c2');
  rect(ctx, 4, by + 1, w - 8, 2, '#41a6f6');
  rect(ctx, 6, by + 1, 8, 1, '#73eff7');
  rect(ctx, w - 14, by + 2, 5, 1, '#73eff7');
  if (level >= 2) {
    panel(ctx, cx - 4, by - 1, 8, 3, '#94b0c2', '#c7cfcc', '#566c86');
    panel(ctx, cx - 6, colTop - 2, 12, 3, '#c7cfcc', '#f4f4f4', '#94b0c2');
    // Dos chorros en arco que caen a la pila.
    const k = (by - colTop + 4) / 81;
    for (const side of [-1, 1]) {
      for (let t = 0; t <= 12; t++) {
        const x = cx + side * (5 + t) - (side < 0 ? 1 : 0), y = colTop - 4 + Math.round((t - 3) ** 2 * k);
        rect(ctx, x, y, 1, 2, '#73eff7');
        rect(ctx, x, y + 2, 1, 1, '#41a6f6');
      }
      rect(ctx, cx + side * 19 - (side < 0 ? 1 : 0), by - 1, 1, 1, '#f4f4f4');
      rect(ctx, cx + side * 15 - (side < 0 ? 1 : 0), by - 2, 1, 1, '#f4f4f4');
    }
  }
  if (level === 2) {
    rect(ctx, cx - 1, colTop - 16, 2, 14, '#73eff7');
    rect(ctx, cx - 1, colTop - 16, 1, 14, '#f4f4f4');
    rect(ctx, cx - 3, colTop - 17, 6, 2, '#73eff7');
    for (const [dx, dy] of [[-5, -15], [4, -16], [-3, -19], [2, -20]]) rect(ctx, cx + dx, colTop + dy, 1, 1, '#f4f4f4');
  }
  if (level >= 3) {
    // Estatuilla: gorro rojo, cara, barba blanca y chaqueta azul, sentada en la taza.
    const gy = colTop - 18;
    for (let r = 0; r < 8; r++) {
      const hw = 1 + Math.floor(r / 2);
      rect(ctx, cx - hw - 1, gy + r, hw * 2 + 2, 1, INK);
      rect(ctx, cx - hw, gy + r, hw * 2, 1, '#b13e53');
      rect(ctx, cx - hw, gy + r, 1, 1, '#e8687d');
    }
    panel(ctx, cx - 4, gy + 7, 8, 4, '#e4b27a', '#fee3a0', '#c8925f');
    rect(ctx, cx - 2, gy + 8, 1, 1, INK);
    rect(ctx, cx + 1, gy + 8, 1, 1, INK);
    panel(ctx, cx - 5, gy + 13, 10, 5, '#3b5dc9', '#41a6f6', '#29366f');
    panel(ctx, cx - 4, gy + 10, 8, 5, '#f4f4f4', '#f4f4f4', '#c7cfcc');
    for (const side of [-1, 1]) rect(ctx, cx + side * 6 - (side < 0 ? 1 : 0), gy + 13, 1, 3, '#e4b27a');
  }
}

/** Silueta de un color; conserva exactamente el tamaño del lienzo de arte recibido. */
export function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height), ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  rect(ctx, 0, 0, c.width, c.height, color);
  return c;
}

/** Contorno de un píxel de arte; margen de dos por lado para conservar el desplazamiento de un mundo. */
export function outlined(src: HTMLCanvasElement, color = '#f4f4f4'): HTMLCanvasElement {
  const w = src.width + 4, h = src.height + 4, c = makeCanvas(w, h), ctx = c.getContext('2d')!;
  ctx.drawImage(src, 2, 2);
  const data = ctx.getImageData(0, 0, w, h).data;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
  ctx.fillStyle = color;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!opaque(x, y) && (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1))) ctx.fillRect(x, y, 1, 1);
  }
  return c;
}
