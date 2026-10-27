// Elementos del huerto que abren menús: granero (contratar), casa de gnomos (contratar y ampliar),
// tablón (grupos) y árbol viejo (mejoras).
// Cada uno tiene su versión con contorno claro para cuando el ratón pasa por encima.
import { BOARD, HOUSE, OLD_TREE } from '../sim/config';
import { makeCanvas } from './pixelart';

type Ctx = CanvasRenderingContext2D;
const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Granero de 54 × 46. Se coloca en (BARN.x - 1, BARN.y). */
export function drawBarn(): HTMLCanvasElement {
  const c = makeCanvas(54, 46);
  const ctx = c.getContext('2d')!;
  const bx = 1, by = 0;
  for (let k = 0; k < 13; k++) {
    rect(ctx, bx + 24 - 2 * k, by + k, 4 + 4 * k, 1, k === 0 ? '#1a1c2c' : '#333c57');
    rect(ctx, bx + 23 - 2 * k, by + k, 1, 1, '#1a1c2c');
    rect(ctx, bx + 28 + 2 * k, by + k, 1, 1, '#1a1c2c');
  }
  rect(ctx, bx + 2, by + 13, 48, 32, '#b13e53');
  for (let x = bx + 5; x < bx + 50; x += 4) rect(ctx, x, by + 13, 1, 32, '#93324a');
  rect(ctx, bx + 1, by + 13, 1, 32, '#1a1c2c');
  rect(ctx, bx + 50, by + 13, 1, 32, '#1a1c2c');
  rect(ctx, bx + 1, by + 45, 50, 1, '#1a1c2c');
  rect(ctx, bx + 22, by + 15, 8, 6, '#1a1c2c');
  rect(ctx, bx + 23, by + 19, 6, 2, '#ffcd75');
  rect(ctx, bx + 25, by + 18, 2, 1, '#ffcd75');
  rect(ctx, bx + 17, by + 27, 18, 18, '#1a1c2c');
  rect(ctx, bx + 18, by + 28, 16, 17, '#5d275d');
  for (let i = 0; i < 16; i++) {
    const y = by + 28 + Math.floor((i * 17) / 16);
    rect(ctx, bx + 18 + i, y, 1, 1, '#f4f4f4');
    rect(ctx, bx + 33 - i, y, 1, 1, '#f4f4f4');
  }
  return c;
}

/** Tablón de anuncios con hojas clavadas, una por color de grupo. */
export function drawBoard(): HTMLCanvasElement {
  const { w, h } = BOARD;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  // postes
  for (const x of [3, w - 5]) {
    rect(ctx, x, 14, 2, h - 14, '#5a3a2a');
    rect(ctx, x - 1, 14, 1, h - 14, '#1a1c2c');
    rect(ctx, x + 2, 14, 1, h - 14, '#1a1c2c');
  }
  rect(ctx, 1, h - 1, w - 2, 1, '#2e9a58');
  // tabla
  rect(ctx, 0, 0, w, 16, '#1a1c2c');
  rect(ctx, 1, 1, w - 2, 14, '#a8723f');
  rect(ctx, 1, 1, w - 2, 1, '#c8925f');
  for (const y of [5, 10]) rect(ctx, 1, y, w - 2, 1, '#8b5a3c');
  // hojas con chinchetas
  const sheets: [number, number, number, number, string][] = [
    [3, 3, 5, 7, '#41a6f6'],
    [9, 2, 5, 6, '#e8687d'],
    [15, 4, 4, 7, '#ffcd75'],
  ];
  for (const [x, y, sw, sh, pin] of sheets) {
    rect(ctx, x, y, sw, sh, '#f4f4f4');
    for (let ly = y + 2; ly < y + sh - 1; ly += 2) rect(ctx, x + 1, ly, sw - 2, 1, '#94b0c2');
    rect(ctx, x + Math.floor(sw / 2), y, 1, 1, pin);
  }
  return c;
}

/** Árbol viejo con un hueco en el tronco y semillas doradas colgando entre las hojas. */
export function drawOldTree(): HTMLCanvasElement {
  const { w, h } = OLD_TREE;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const blobs: [number, number, number, number][] = [[20, 16, 19, 14], [9, 22, 9, 7], [31, 22, 9, 7]];
  const inCanopy = (x: number, y: number) => blobs.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);

  // tronco y raíces
  const trunk = (x: number, y: number) => (x >= 15 && x <= 24 && y >= 26) || (y >= h - 4 && x >= 11 + (h - 1 - y) && x <= 28 - (h - 1 - y));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!trunk(x, y)) continue;
      const edge = !trunk(x - 1, y) || !trunk(x + 1, y) || !trunk(x, y + 1);
      rect(ctx, x, y, 1, 1, edge ? '#1a1c2c' : x >= 21 ? '#5a3a2a' : '#8b5a3c');
    }
  }
  for (let y = 30; y < h - 4; y += 3) rect(ctx, 17 + (y % 2), y, 1, 2, '#5a3a2a');
  // hueco con farolillo
  rect(ctx, 18, 33, 4, 6, '#1a1c2c');
  rect(ctx, 17, 34, 1, 4, '#1a1c2c');
  rect(ctx, 22, 34, 1, 4, '#1a1c2c');
  rect(ctx, 19, 36, 2, 2, '#ffcd75');

  // copa
  for (let y = 0; y < 34; y++) {
    for (let x = 0; x < w; x++) {
      if (!inCanopy(x, y)) continue;
      const edge = !inCanopy(x - 1, y) || !inCanopy(x + 1, y) || !inCanopy(x, y - 1) || !inCanopy(x, y + 1);
      let color = '#257179';
      if (edge) color = '#1c3b33';
      else if (x + y < 20) color = '#38b764';
      else if (y > 24) color = '#1f5e57';
      rect(ctx, x, y, 1, 1, color);
    }
  }
  const speckles: [number, number][] = [[10, 9], [14, 5], [22, 4], [7, 15], [27, 9], [12, 19], [33, 17], [19, 12]];
  for (const [x, y] of speckles) rect(ctx, x, y, 1, 1, '#a7f070');
  // semillas doradas colgando: el árbol da mejoras
  for (const [x, y] of [[12, 24], [25, 20], [32, 26], [18, 27]] as const) {
    rect(ctx, x, y - 1, 1, 1, '#1c3b33');
    rect(ctx, x, y, 2, 2, '#ffcd75');
    rect(ctx, x + 1, y + 1, 1, 1, '#ef7d57');
  }
  return c;
}

/** Medidas de la casa-seta según lo ampliada que esté: choza, casita con chimenea y casa de dos pisos. */
const HOUSE_TIERS = [
  { wallW: 14, wallH: 10, capW: 24, capH: 9 },
  { wallW: 18, wallH: 12, capW: 28, capH: 11 },
  { wallW: 20, wallH: 16, capW: 30, capH: 10 },
] as const;
/** motas blancas del sombrero, en orden de aparición (dx desde el centro, dy desde lo alto del sombrero) */
const CAP_SPOTS: [number, number][] = [[-6, 3], [4, 2], [-1, 5], [8, 5], [-10, 6], [1, 1], [-4, 7], [6, 7], [11, 7]];

/**
 * Casa de gnomos con forma de seta, HOUSE.w de ancho y como mucho HOUSE.h de alto.
 * Niveles 0–2: choza; 3–5: más grande, con chimenea y ventana; 6–8: dos pisos y banderín.
 * Dentro de cada etapa, cada nivel añade una mota al sombrero y una flor junto a la puerta.
 * Se recorta por arriba: se coloca con la base en HOUSE.y + HOUSE.h.
 */
export function drawHouse(level: number): HTMLCanvasElement {
  const { w, h } = HOUSE;
  const tier = level >= 6 ? 2 : level >= 3 ? 1 : 0;
  const { wallW, wallH, capW, capH } = HOUSE_TIERS[tier];
  const full = makeCanvas(w, h);
  const ctx = full.getContext('2d')!;
  const cx = w / 2;
  const wx0 = cx - wallW / 2, wx1 = cx + wallW / 2 - 1;
  const wallTop = h - 1 - wallH;
  const capTop = wallTop - capH + 2;

  // chimenea (detrás del sombrero, que tapa su base)
  if (tier >= 1) {
    const chx = cx + 6, chTop = capTop - 2;
    rect(ctx, chx, chTop, 4, 7, '#1a1c2c');
    rect(ctx, chx + 1, chTop + 1, 2, 6, '#8b5a3c');
    rect(ctx, chx + 1, chTop + 3, 2, 1, '#5a3a2a');
    rect(ctx, chx + 2, chTop - 2, 1, 1, '#94b0c2');
    rect(ctx, chx + 3, chTop - 3, 1, 1, '#94b0c2');
  }
  // banderín en lo alto
  if (tier === 2) {
    rect(ctx, cx - 1, 0, 1, capTop + 1, '#5a3a2a');
    rect(ctx, cx, 0, 4, 1, '#41a6f6');
    rect(ctx, cx, 1, 2, 1, '#41a6f6');
    rect(ctx, cx + 2, 1, 1, 1, '#3b5dc9');
    rect(ctx, cx, 2, 1, 1, '#3b5dc9');
  }

  // paredes: el pie de la seta
  rect(ctx, wx0, wallTop, wallW, wallH, '#1a1c2c');
  rect(ctx, wx0 + 1, wallTop, wallW - 2, wallH - 1, '#f4f4f4');
  rect(ctx, wx1 - 2, wallTop, 2, wallH - 1, '#94b0c2');
  rect(ctx, wx0 - 1, h - 1, wallW + 2, 1, '#2e9a58');
  // puerta redondeada con pomo
  const doorH = tier === 0 ? 7 : 8;
  const dx = cx - 3, dy = h - 1 - doorH;
  rect(ctx, dx + 1, dy, 4, 1, '#1a1c2c');
  rect(ctx, dx, dy + 1, 6, doorH, '#1a1c2c');
  rect(ctx, dx + 1, dy + 1, 4, doorH - 1, '#8b5a3c');
  rect(ctx, dx + 3, dy + 1, 2, doorH - 1, '#5a3a2a');
  rect(ctx, dx + 3, dy + Math.floor(doorH / 2) + 1, 1, 1, '#ffcd75');
  rect(ctx, dx - 1, h - 1, 8, 1, '#94b0c2');
  // flores junto a la puerta: una por nivel dentro de la etapa
  const flowers = level % 3;
  for (let i = 0; i < flowers; i++) {
    const fx = i === 0 ? dx - 3 : dx + 8;
    rect(ctx, fx, h - 3, 1, 2, '#257179');
    rect(ctx, fx - 1, h - 4, 3, 1, i === 0 ? '#ef7d57' : '#ffcd75');
    rect(ctx, fx, h - 5, 1, 1, i === 0 ? '#ef7d57' : '#ffcd75');
    rect(ctx, fx, h - 4, 1, 1, '#f4f4f4');
  }
  // ventanas con luz: una a cada lado desde la casita; dos más arriba en la de dos pisos
  const windows: [number, number][] = [];
  if (tier >= 1) windows.push([wx0 + 1, h - 9], [wx1 - 4, h - 9]);
  if (tier === 2) {
    windows.push([wx0 + 3, wallTop + 2], [wx1 - 6, wallTop + 2]);
    rect(ctx, wx0 + 1, wallTop + 7, wallW - 2, 1, '#94b0c2');
  }
  for (const [x, y] of windows) {
    rect(ctx, x, y, 4, 4, '#1a1c2c');
    rect(ctx, x + 1, y + 1, 2, 2, '#ffcd75');
  }

  // sombrero rojo con motas
  const inCap = (x: number, y: number) => {
    if (y < capTop || y >= capTop + capH) return false;
    const dy = (capTop + capH - 0.5 - y) / capH;
    return ((x + 0.5 - cx) / (capW / 2)) ** 2 + dy * dy <= 1;
  };
  for (let y = capTop; y < capTop + capH; y++) {
    for (let x = 0; x < w; x++) {
      if (!inCap(x, y)) continue;
      const edge = !inCap(x - 1, y) || !inCap(x + 1, y) || !inCap(x, y - 1) || y === capTop + capH - 1;
      let color = '#b13e53';
      if (edge) color = '#1a1c2c';
      else if (y === capTop + capH - 2) color = '#93324a';
      else if (x < cx - 2 && y < capTop + 3) color = '#e8687d';
      rect(ctx, x, y, 1, 1, color);
    }
  }
  for (const [sx, sy] of CAP_SPOTS.slice(0, 1 + level)) {
    const x = Math.round(cx + sx), y = capTop + sy;
    if (y >= capTop + capH - 2 || !inCap(x - 1, y) || !inCap(x + 2, y)) continue;
    rect(ctx, x, y, 2, 1, '#f4f4f4');
  }

  // recorta lo vacío de arriba para que la caja de la casa se ajuste a lo dibujado
  const top = tier === 2 ? 0 : Math.max(0, tier === 1 ? capTop - 5 : capTop);
  const c = makeCanvas(w, h - top);
  c.getContext('2d')!.drawImage(full, 0, -top);
  return c;
}

/** Copia con un contorno de 1 px alrededor de lo opaco, para el resalte al pasar el ratón. */
export function outlined(src: HTMLCanvasElement, color = '#f4f4f4'): HTMLCanvasElement {
  const w = src.width + 2, h = src.height + 2;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 1, 1);
  const data = ctx.getImageData(0, 0, w, h).data;
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
  ctx.fillStyle = color;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}
