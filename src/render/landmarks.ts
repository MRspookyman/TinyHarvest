// Elementos del huerto que abren menús: granero (contratar), tablón (grupos) y árbol viejo (mejoras).
// Cada uno tiene su versión con contorno claro para cuando el ratón pasa por encima.
import { BOARD, OLD_TREE } from '../sim/config';
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
