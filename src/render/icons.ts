// Iconos de interfaz dibujados a mano a resolución doble, sin interpolación.
import { SUCESOS, type Suceso } from '../sim/album';
import { CROP_IDS, JOB_IDS } from '../sim/config';
import type { CropId, JobId, NodeId, TalentId, TraitId } from '../sim/types';
import { makeCanvas, mapCanvas } from './pixelart';
import { BASE, basketCanvas, crownCanvas, SACK } from './sprites';
import { gnomeIconCanvas } from './gnome';
import { PLANT_MAPS, PLANT_PAL } from './plants';
import type { MenuId } from '../textos';

const ink = '#1a1c2c', wood = '#8b5a3c', bark = '#5a3a2a', tan = '#d9a066';
const gold = '#ffcd75', amber = '#f4b41b', ochre = '#c28a3a';
const paper = '#f4ecd2', gray = '#94b0c2', red = '#b13e53', pink = '#ef7d85';
const green = '#38b764', leaf = '#a7f070', teal = '#257179', blue = '#41a6f6';
const url = (c: HTMLCanvasElement) => c.toDataURL();

/** Herramientas de píxel: contornos de un píxel y luz desde arriba a la izquierda. */
function drawing(w: number, h: number) {
  const canvas = makeCanvas(w, h), ctx = canvas.getContext('2d')!;
  const rect = (x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, width, height);
  };
  const box = (x: number, y: number, width: number, height: number, color: string) => {
    rect(x, y, width, height, ink); rect(x + 1, y + 1, width - 2, height - 2, color);
  };
  const oval = (x: number, y: number, width: number, height: number, color: string) => {
    for (let j = 0; j < height; j++) {
      const span = Math.sqrt(Math.max(0, 1 - ((j + 0.5 - height / 2) / (height / 2)) ** 2));
      const left = Math.ceil(width / 2 - span * width / 2), right = Math.floor(width / 2 + span * width / 2);
      rect(x + left, y + j, Math.max(1, right - left), 1, color);
    }
  };
  const fruit = (x: number, y: number, w: number, h: number, color = red) => {
    oval(x, y, w, h, ink); oval(x + 1, y + 1, w - 2, h - 2, color);
    rect(x + 2, y + 2, 2, 1, paper); rect(x + (w >> 1), y - 1, 1, 3, green);
  };
  const sprig = (x: number, y: number) => {
    rect(x, y, 1, 7, teal); oval(x - 5, y, 5, 3, ink); oval(x - 4, y, 3, 2, leaf);
    oval(x + 1, y - 2, 5, 3, ink); rect(x + 2, y - 1, 3, 1, green);
  };
  const plank = (x: number, y: number, w: number, h: number, gilded = false) => {
    box(x, y, w, h, gilded ? amber : wood);
    rect(x + 1, y + 1, w - 2, 1, gilded ? gold : tan);
    rect(x + 2, y + h - 2, w - 3, 1, gilded ? ochre : bark);
    for (let row = y + 4; row < y + h - 2; row += 4) {
      rect(x + 2, row, Math.max(1, w - 5), 1, gilded ? ochre : bark);
      rect(x + 4, row - 1, Math.max(1, (w >> 1) - 3), 1, gilded ? gold : tan);
    }
  };
  return { canvas, rect, box, oval, fruit, sprig, plank };
}

function menuCanvas(kind: MenuId): HTMLCanvasElement {
  const d = drawing(32, 32), { rect: r, box: b, oval: o, plank } = d;
  if (kind === 'contratar') {
    b(3, 13, 26, 18, red);
    for (let x = 5; x < 28; x += 4) { r(x, 15, 1, 14, '#733e58'); r(x + 1, 15, 1, 12, pink); }
    for (let y = 1; y < 15; y++) { const x = Math.max(0, 15 - y); r(x, y, 32 - x * 2, 1, ink); if (y > 2) r(x + 1, y, 30 - x * 2, 1, '#333c57'); }
    for (let y = 6; y < 14; y += 3) for (let x = 16 - y; x < 16 + y; x += 5) r(x, y, 4, 1, gray);
    b(10, 20, 13, 11, paper); b(12, 21, 9, 10, bark);
    for (let y = 0; y < 8; y++) { r(12 + y, 22 + y, 1, 1, tan); r(20 - y, 22 + y, 1, 1, tan); }
    b(13, 14, 6, 5, gold); r(15, 15, 1, 3, ink);
  } else if (kind === 'grupos') {
    plank(5, 17, 4, 15); plank(23, 17, 4, 15); plank(0, 2, 32, 20);
    for (const [x, y, c] of [[3, 5, blue], [13, 5, pink], [22, 6, gold]] as const) {
      b(x, y, 7, 12, paper); r(x + 1, y + 1, 5, 3, c); r(x + 1, y + 6, 4, 1, gray); r(x + 1, y + 8, 3, 1, gray); r(x + 3, y + 1, 1, 1, ink);
    }
  } else if (kind === 'arbol') {
    plank(13, 13, 6, 18); r(10, 29, 12, 2, bark);
    for (const [x, y, w, h] of [[1, 7, 15, 14], [11, 0, 15, 17], [18, 7, 14, 14], [6, 5, 18, 17]]) {
      o(x, y, w, h, ink); o(x + 1, y + 1, w - 2, h - 2, green); o(x + 2, y + 2, w - 5, 3, leaf);
    }
    d.fruit(5, 12, 5, 5, gold); d.fruit(22, 10, 5, 5, gold); d.fruit(15, 4, 5, 5, gold);
    r(16, 21, 1, 8, tan); r(18, 24, 3, 1, bark);
  } else if (kind === 'diario') {
    b(4, 2, 24, 28, ink); b(6, 3, 22, 25, red); r(7, 4, 2, 22, pink);
    b(12, 7, 12, 9, gold); b(14, 9, 8, 5, bark); r(15, 10, 6, 1, tan);
    for (let y = 6; y < 25; y += 5) { r(4, y, 4, 2, ochre); r(4, y, 2, 1, gold); }
    r(9, 28, 17, 1, paper); r(12, 30, 5, 2, red); r(23, 19, 3, 4, ochre);
  } else if (kind === 'album') {
    b(1, 5, 15, 24, wood); b(16, 5, 15, 24, wood); r(2, 3, 13, 24, paper); r(17, 3, 13, 24, paper);
    r(14, 4, 1, 22, '#d9c49a'); r(17, 4, 1, 22, '#d9c49a');
    for (const [x, y, c] of [[4, 5, blue], [20, 6, green], [5, 16, gold], [19, 17, pink]] as const) {
      b(x, y, 8, 8, paper); r(x + 1, y + 1, 6, 5, c); r(x + 2, y + 2, 2, 1, leaf); r(x + 1, y + 6, 4, 1, gray);
    }
    for (let y = 7; y < 26; y += 6) { r(15, y, 2, 2, gray); r(15, y, 2, 1, paper); }
  } else if (kind === 'ranking') {
    b(1, 20, 10, 12, gray); b(11, 13, 10, 19, amber); b(21, 24, 10, 8, tan);
    r(2, 21, 8, 1, paper); r(12, 14, 8, 1, gold); r(22, 25, 8, 1, gold);
    r(15, 19, 2, 8, ochre); r(14, 19, 2, 1, gold);
    const crown = crownCanvas(); d.canvas.getContext('2d')!.drawImage(crown, Math.floor((32 - crown.width) / 2), 0);
  } else {
    b(4, 24, 24, 7, gray); b(10, 26, 12, 3, ochre); r(12, 27, 8, 1, gold);
    o(10, 12, 12, 9, ink); o(11, 13, 10, 7, amber); r(12, 14, 3, 2, gold);
    for (let y = 1; y < 14; y++) { const w = 2 + (y >> 1) * 2; r(16 - (w >> 1), y, w, 1, ink); if (w > 2) r(17 - (w >> 1), y, w - 2, 1, amber); }
    r(14, 5, 1, 5, gold); r(10, 13, 12, 2, ochre); r(13, 20, 6, 4, amber); r(12, 22, 8, 2, gold);
  }
  return d.canvas;
}

/** Dibujos de las mejoras; cada objeto conserva su lienzo original multiplicado por dos. */
function objectCanvas(kind: string, gilded = false): HTMLCanvasElement {
  const sizes: Record<string, [number, number]> = {
    botas: [20, 20], cafe: [20, 20], abono: [20, 20], bancal: [20, 20], carretilla: [28, 22],
    conservas: [24, 16], mercado: [28, 24], casa: [32, 32], regadera: [28, 20], silbato: [24, 16],
    herencia: [28, 20], experiencia: [24, 24], contrato: [24, 24], semillas: [20, 24], veterano: [20, 24], suerte: [24, 20],
  };
  const [w, h] = sizes[kind], d = drawing(w, h), { rect: r, box: b, oval: o, plank } = d;
  const body = gilded ? amber : wood, shine = gilded ? gold : tan;
  if (kind === 'botas') {
    b(4, 0, 9, 12, body); b(3, 10, 16, 8, body); b(3, 16, 16, 4, bark);
    r(5, 1, 6, 2, shine); r(5, 4, 1, 8, shine);
    for (let y = 5; y < 12; y += 3) { r(9, y, 3, 1, paper); r(10, y - 1, 1, 1, ink); }
    r(5, 18, 2, 1, gray); r(10, 18, 2, 1, gray); r(15, 18, 2, 1, gray);
  } else if (kind === 'cafe') {
    b(13, 6, 7, 9, tan); b(15, 8, 3, 5, ink); b(2, 5, 14, 13, paper);
    r(3, 6, 12, 3, bark); r(4, 6, 8, 1, tan); r(4, 10, 2, 5, '#ffffff'); r(13, 10, 2, 6, gray);
    r(1, 18, 17, 1, ink); r(4, 19, 11, 1, gray); r(6, 0, 1, 2, paper); r(5, 2, 1, 2, gray); r(11, 1, 1, 3, paper);
  } else if (kind === 'abono') {
    b(4, 0, 12, 4, body); o(1, 4, 18, 16, ink); o(2, 5, 16, 14, shine);
    r(4, 5, 12, 1, bark); r(6, 3, 8, 1, ochre); r(3, 10, 1, 5, paper); r(16, 9, 1, 7, body);
    b(6, 9, 8, 7, paper); d.sprig(10, 10); r(6, 17, 8, 1, body);
  } else if (kind === 'bancal') {
    b(0, 11, 20, 9, body); r(1, 12, 18, 2, bark); r(2, 13, 3, 1, tan); r(10, 13, 2, 1, tan);
    r(1, 15, 18, 1, shine); r(1, 18, 18, 1, bark); d.sprig(10, 4); r(9, 8, 3, 4, gilded ? gold : green);
    r(3, 16, 1, 1, ink); r(16, 16, 1, 1, ink);
  } else if (kind === 'carretilla') {
    for (const x of [6, 18]) { o(x, 14, 9, 8, ink); o(x + 1, 15, 7, 6, gray); r(x + 4, 16, 1, 4, ink); r(x + 2, 18, 5, 1, ink); }
    b(1, 6, 22, 9, gray); r(2, 7, 19, 1, paper); r(3, 12, 18, 2, '#566c86'); plank(22, 8, 6, 4);
    for (let x = 4; x < 21; x += 4) { r(x, 3, 2, 4, gold); r(x + 1, 1, 1, 3, leaf); }
  } else if (kind === 'conservas') {
    d.fruit(9, 0, 8, 8); r(2, 2, 5, 1, gold); r(19, 1, 1, 5, gold); r(17, 3, 6, 1, ochre);
    b(0, 6, 24, 4, shine); b(2, 9, 20, 7, body);
    for (let y = 10; y < 15; y += 2) for (let x = 3 + (y % 4); x < 21; x += 4) r(x, y, 2, 1, shine);
  } else if (kind === 'mercado') {
    plank(2, 8, 3, 14, gilded); plank(23, 8, 3, 14, gilded); b(0, 0, 28, 8, paper);
    for (let x = 1; x < 27; x += 6) { r(x, 1, 3, 5, gilded ? amber : red); r(x, 6, 3, 1, gilded ? ochre : '#733e58'); }
    d.fruit(6, 11, 6, 6); d.fruit(12, 12, 6, 5, gold); d.sprig(20, 10); plank(0, 16, 28, 8, gilded); r(3, 18, 1, 1, gold); r(24, 18, 1, 1, gold);
  } else if (kind === 'casa') {
    b(7, 14, 20, 17, paper); r(24, 17, 2, 13, gray); b(12, 21, 10, 10, body);
    for (let x = 14; x < 21; x += 3) r(x, 22, 1, 8, bark); r(19, 25, 1, 1, gold);
    o(0, 1, 32, 21, ink); o(1, 2, 30, 18, gilded ? amber : red); r(5, 6, 7, 2, gilded ? gold : pink);
    o(6, 5, 6, 5, paper); o(20, 9, 7, 5, paper); o(13, 2, 5, 4, paper);
    r(3, 18, 26, 1, bark); b(8, 19, 5, 4, blue); r(10, 20, 1, 2, paper); d.sprig(4, 25); d.sprig(29, 25);
  } else if (kind === 'regadera') {
    b(5, 0, 13, 9, teal); b(7, 2, 9, 6, ink); b(1, 7, 19, 13, green);
    r(3, 8, 14, 1, leaf); r(3, 10, 2, 7, leaf); r(17, 10, 2, 8, teal);
    for (let i = 0; i < 6; i++) r(19 + i, 12 - i, 2, 4, teal);
    b(23, 4, 4, 5, gray); r(25, 11, 1, 2, blue); r(27, 14, 1, 2, blue); r(23, 16, 1, 2, blue);
  } else if (kind === 'silbato') {
    o(0, 5, 16, 11, ink); o(1, 6, 14, 9, amber); b(10, 5, 11, 7, gold);
    b(12, 6, 4, 3, bark); r(3, 8, 4, 1, paper); r(5, 13, 5, 1, ochre);
    r(20, 4, 2, 4, red); r(22, 1, 1, 4, pink); r(20, 0, 3, 1, red);
  } else if (kind === 'herencia') {
    plank(0, 9, 28, 11); b(2, 3, 24, 9, bark);
    for (let x = 3; x < 25; x += 4) { o(x, 1 + (x % 3), 5, 7, ink); o(x + 1, 2 + (x % 3), 3, 5, amber); r(x + 1, 3 + (x % 3), 2, 1, gold); }
    r(4, 10, 2, 9, ochre); r(22, 10, 2, 9, ochre); b(11, 11, 6, 5, gold); r(14, 13, 1, 2, ink);
  } else if (kind === 'experiencia') {
    b(2, 0, 20, 24, ochre); b(4, 2, 16, 20, gold); b(5, 3, 14, 18, blue);
    for (const [x, c] of [[7, red], [13, green]] as const) {
      r(x + 1, 7, 2, 1, ink); r(x, 8, 4, 4, c); r(x, 12, 4, 3, tan); r(x - 1, 15, 6, 4, paper); r(x + 1, 15, 1, 4, gray);
    }
    for (const x of [3, 20]) for (const y of [1, 21]) r(x, y, 1, 1, paper);
  } else if (kind === 'contrato') {
    b(5, 2, 15, 20, paper); b(1, 0, 22, 5, tan); b(1, 19, 22, 5, tan);
    r(3, 1, 2, 3, bark); r(3, 20, 2, 3, bark); r(7, 1, 13, 1, gold);
    for (let y = 7; y < 17; y += 3) { r(8, y, 9, 1, gray); r(8, y + 1, 4, 1, '#d9c49a'); }
    o(14, 14, 7, 7, ochre); o(15, 15, 5, 5, gold); r(16, 20, 1, 3, red); r(19, 20, 1, 3, red);
  } else if (kind === 'semillas') {
    b(1, 0, 18, 24, amber); r(2, 2, 16, 1, ochre); r(2, 21, 16, 1, ochre); b(3, 5, 14, 14, paper); d.sprig(10, 9);
    for (let x = 3; x < 18; x += 3) { r(x, 1, 1, 1, gold); r(x, 22, 1, 1, gold); }
    r(6, 16, 8, 1, tan);
  } else if (kind === 'veterano') {
    b(1, 0, 7, 12, red); b(12, 0, 7, 12, red); r(3, 1, 2, 8, blue); r(14, 1, 2, 8, blue);
    o(2, 8, 16, 16, ink); o(3, 9, 14, 14, ochre); o(4, 10, 12, 12, amber); o(6, 11, 6, 3, gold);
    r(9, 13, 2, 6, gold); r(7, 15, 6, 2, gold); r(8, 20, 4, 1, ochre);
  } else {
    for (const [x, y] of [[0, 0], [10, 0], [0, 8], [10, 8]]) { o(x, y, 10, 10, ink); o(x + 1, y + 1, 8, 8, green); r(x + 2, y + 2, 3, 1, leaf); }
    r(18, 14, 2, 4, teal); r(20, 17, 2, 3, teal); o(7, 6, 6, 6, ochre); r(9, 7, 2, 3, gold); r(22, 1, 1, 3, gold); r(21, 2, 3, 1, gold);
  }
  return d.canvas;
}

function eventCanvas(kind: Suceso): HTMLCanvasElement {
  const d = drawing(24, 24), { rect: r, box: b, oval: o } = d;
  if (kind === 'cuervo') {
    o(2, 9, 17, 12, ink); o(9, 2, 12, 13, ink); o(4, 11, 12, 7, '#333c57');
    r(14, 6, 3, 3, paper); r(16, 7, 1, 2, ink); r(20, 8, 4, 2, gold); r(20, 10, 2, 1, ochre);
    for (let x = 4; x < 13; x += 3) r(x, 13, 1, 4, '#566c86'); r(0, 14, 4, 2, ink); r(9, 20, 1, 3, ochre); r(15, 20, 1, 3, ochre); r(8, 23, 4, 1, gold); r(14, 23, 4, 1, gold);
  } else if (kind === 'caracol') {
    o(0, 5, 17, 17, ink); o(1, 6, 15, 15, tan); o(4, 9, 10, 10, bark); o(5, 10, 8, 8, wood); o(7, 12, 4, 4, tan); r(8, 12, 2, 2, bark);
    o(1, 17, 22, 7, ink); o(2, 18, 20, 5, gold); b(18, 10, 5, 10, gold); r(19, 4, 1, 7, ink); r(23, 3, 1, 9, ink); r(18, 3, 2, 2, ink); r(22, 2, 2, 2, ink); r(4, 20, 11, 1, ochre);
  } else if (kind === 'topo') {
    o(0, 15, 24, 9, ink); o(1, 16, 22, 7, wood); o(4, 1, 16, 20, ink); o(5, 2, 14, 18, '#333c57');
    r(7, 6, 3, 3, paper); r(14, 6, 3, 3, paper); r(8, 7, 2, 2, ink); r(14, 7, 2, 2, ink); o(9, 10, 6, 4, pink);
    r(6, 12, 3, 1, gray); r(15, 12, 3, 1, gray); r(10, 14, 4, 2, paper); r(3, 18, 4, 2, tan); r(17, 18, 4, 2, tan);
  } else if (kind === 'ranas') {
    o(1, 0, 9, 10, ink); o(14, 0, 9, 10, ink); o(2, 1, 7, 8, leaf); o(15, 1, 7, 8, leaf);
    b(4, 2, 4, 5, paper); b(16, 2, 4, 5, paper); r(6, 4, 1, 2, ink); r(17, 4, 1, 2, ink);
    o(0, 6, 24, 15, ink); o(1, 7, 22, 13, green); o(4, 11, 16, 8, leaf); r(5, 14, 14, 1, ink); r(6, 15, 2, 1, paper);
    b(1, 19, 7, 5, green); b(16, 19, 7, 5, green); r(4, 20, 1, 3, teal); r(19, 20, 1, 3, teal);
  } else if (kind === 'sindicato') {
    d.plank(10, 11, 4, 13); b(0, 0, 24, 15, wood); b(1, 1, 22, 12, paper);
    for (let y = 4; y < 11; y += 4) for (let x = 4; x < 21; x += 5) { r(x, y, 3, 1, red); r(x, y + 1, 1, 2, red); r(x + 2, y + 1, 1, 2, red); }
    r(2, 2, 1, 1, gold); r(21, 11, 1, 1, ochre);
  } else {
    d.plank(10, 7, 4, 17); d.plank(0, 10, 24, 4); o(7, 1, 10, 10, ink); o(8, 2, 8, 8, tan);
    r(9, 4, 1, 1, ink); r(14, 4, 1, 1, ink); r(10, 7, 4, 1, bark); b(6, 11, 12, 9, blue); r(11, 12, 1, 7, gray); r(9, 15, 1, 1, gold);
    b(4, 0, 16, 3, ochre); r(8, 0, 8, 1, gold); r(1, 14, 1, 3, gold); r(3, 14, 1, 2, gold); r(20, 14, 1, 3, gold); r(22, 14, 1, 2, gold);
  }
  return d.canvas;
}

function traitCanvas(kind: TraitId): HTMLCanvasElement {
  const d = drawing(24, 20), { rect: r, box: b, oval: o } = d;
  if (kind === 'perezoso') {
    o(6, 1, 15, 16, ink); o(7, 2, 13, 14, tan); o(10, 5, 9, 10, bark); o(11, 6, 7, 8, wood); o(13, 8, 4, 4, tan); r(14, 9, 2, 1, bark);
    o(0, 13, 24, 7, ink); o(1, 14, 22, 5, leaf); r(2, 8, 1, 7, ink); r(5, 9, 1, 5, ink); r(1, 7, 2, 2, ink); r(4, 8, 2, 2, ink); r(8, 17, 12, 1, green);
  } else if (kind === 'nervioso') {
    for (let y = 0; y < 20; y++) {
      const x = y < 8 ? 13 - y : y < 11 ? 3 : 17 - Math.floor((y - 10) * 1.15);
      const w = y < 8 ? 8 : y < 11 ? 18 : 5;
      r(x, y, w, 1, ink); if (y > 0 && y < 19) r(x + 1, y, w - 2, 1, amber);
    }
    r(13, 2, 3, 1, gold); r(7, 8, 2, 1, gold); r(13, 12, 1, 3, gold);
  } else if (kind === 'gloton') {
    d.fruit(3, 3, 18, 17); o(17, 5, 8, 7, '#00000000');
    // Le mordemos el borde sin pintar un falso fondo opaco.
    d.canvas.getContext('2d')!.clearRect(19, 5, 5, 5); d.canvas.getContext('2d')!.clearRect(17, 7, 7, 2);
    r(17, 6, 2, 1, ink); r(16, 7, 1, 2, ink); r(17, 9, 2, 1, ink); r(7, 8, 1, 5, pink); d.sprig(12, 1);
  } else if (kind === 'cotilla') {
    b(0, 2, 24, 13, paper); r(4, 15, 6, 1, ink); r(4, 16, 4, 1, ink); r(4, 17, 2, 1, ink); r(5, 14, 3, 2, paper);
    for (const x of [5, 11, 17]) { o(x, 7, 3, 3, ink); r(x, 7, 1, 1, gray); } r(2, 4, 18, 1, '#ffffff');
  } else if (kind === 'dormilon') {
    o(1, 0, 18, 20, ink); o(2, 1, 16, 18, amber);
    const ctx = d.canvas.getContext('2d')!; ctx.globalCompositeOperation = 'destination-out'; o(8, -2, 14, 17, ink); ctx.globalCompositeOperation = 'source-over';
    r(4, 4, 1, 8, gold); r(17, 2, 6, 1, gray); r(21, 3, 1, 1, gray); r(19, 4, 2, 1, gray); r(17, 5, 1, 1, gray); r(17, 6, 6, 1, gray);
  } else {
    d.plank(10, 6, 5, 14); b(3, 1, 18, 8, gray); r(4, 2, 15, 1, paper); r(4, 6, 15, 2, '#566c86'); r(16, 3, 1, 3, ink); r(11, 10, 1, 7, tan);
  }
  return d.canvas;
}

export const menuIcons = Object.fromEntries(
  (['contratar', 'grupos', 'arbol', 'diario', 'ranking', 'temporada', 'album'] as MenuId[]).map(k => [k, url(menuCanvas(k))]),
) as Record<MenuId, string>;
export const eventIcons = Object.fromEntries(SUCESOS.map(k => [k, url(eventCanvas(k))])) as Record<Suceso, string>;
export const crownIcon = url(crownCanvas());
export const houseIcon = url(objectCanvas('casa'));
export const cropIcons = Object.fromEntries(CROP_IDS.map(c => [c, url(mapCanvas(PLANT_MAPS[c][4], PLANT_PAL))])) as Record<CropId, string>;
export const jobIcons = Object.fromEntries(JOB_IDS.map(j => [j, url(gnomeIconCanvas(j))])) as Record<JobId, string>;
export const rootIcon = url(mapCanvas(PLANT_MAPS.zanahoria[1], PLANT_PAL));
export const nodeIcons: Record<NodeId, string> = {
  botas: url(objectCanvas('botas')), cafe: url(objectCanvas('cafe')), saco: url(mapCanvas(SACK, BASE)),
  porteadores: jobIcons.porteador, cesta: url(basketCanvas(3)), carretilla: url(objectCanvas('carretilla')),
  bancal: url(objectCanvas('bancal')), trigo: cropIcons.trigo, abono: url(objectCanvas('abono')), tomate: cropIcons.tomate,
  calabaza: cropIcons.calabaza, conservas: url(objectCanvas('conservas')), mercado: url(objectCanvas('mercado')),
  guardianes: jobIcons.guardian, silbato: url(objectCanvas('silbato')), regadores: jobIcons.regador,
  regadera: url(objectCanvas('regadera')), fresa: cropIcons.fresa, melon: cropIcons.melon,
};
export const talentIcons: Record<TalentId, string> = {
  abonoDorado: url(objectCanvas('abono', true)), mercadoDorado: url(objectCanvas('mercado', true)),
  herencia: url(objectCanvas('herencia')), experiencia: url(objectCanvas('experiencia')), contrato: url(objectCanvas('contrato')),
  bancalHeredado: url(objectCanvas('bancal', true)), casaHeredada: url(objectCanvas('casa', true)),
  semillasConocidas: url(objectCanvas('semillas')), veterano: url(objectCanvas('veterano')), suerte: url(objectCanvas('suerte')),
};
export const traitIcons = Object.fromEntries(
  (['perezoso', 'nervioso', 'gloton', 'cotilla', 'dormilon', 'currante'] as TraitId[]).map(k => [k, url(traitCanvas(k))]),
) as Record<TraitId, string>;

/** Semilla de prestigio con hendidura y reflejo facetado. */
export const goldenSeedIcon = (() => {
  const d = drawing(16, 20); d.oval(0, 0, 16, 20, ink); d.oval(1, 1, 14, 18, ochre); d.oval(2, 2, 11, 14, amber);
  d.rect(4, 4, 3, 2, gold); d.rect(3, 6, 2, 4, paper);
  for (let y = 4; y < 17; y++) d.rect(8 + Math.floor((y - 4) / 5), y, 1, 1, ochre);
  d.rect(5, 16, 3, 1, gold); return url(d.canvas);
})();
/** Estrella facetada, contorno de un solo píxel. */
export const legendIcon = (() => {
  const d = drawing(18, 18);
  const rows = [[8, 2], [8, 2], [7, 4], [7, 4], [6, 6], [0, 18], [1, 16], [2, 14], [3, 12], [4, 10], [4, 10], [3, 12], [3, 12], [2, 14], [2, 5], [11, 5], [2, 3], [13, 3]];
  rows.forEach(([x, w], y) => { d.rect(x, y, w, 1, ink); if (w > 2 && y > 0) d.rect(x + 1, y, w - 2, 1, y < 9 ? gold : amber); });
  d.rect(7, 6, 2, 3, paper); d.rect(5, 7, 2, 1, paper); d.rect(10, 10, 2, 2, ochre); return url(d.canvas);
})();
/** Megáfono de latón con remaches y cordón rojo. */
export const rallyIcon = (() => {
  const d = drawing(32, 32); d.plank(9, 19, 5, 11);
  for (let x = 3; x < 26; x++) {
    const y = x < 12 ? 12 : 12 - Math.floor((x - 11) / 2), h = 7 + (12 - y) * 2;
    d.rect(x, y, 1, h, ink); if (x > 3 && x < 25) d.rect(x, y + 1, 1, h - 2, x < 19 ? amber : ochre);
    if (x > 5 && x < 23) d.rect(x, y + 2, 1, 1, gold);
  }
  d.box(24, 4, 3, 24, gold); d.rect(5, 15, 5, 1, paper); d.rect(14, 12, 1, 1, ink); d.rect(14, 18, 1, 1, ink);
  d.rect(29, 5, 1, 4, gold); d.rect(29, 15, 3, 1, gold); d.rect(29, 23, 1, 4, gold); return url(d.canvas);
})();

/** Marco de 48 × 48, corte de 16: veta fina, uniones y clavos de latón. */
export const frameImage = (() => {
  const d = drawing(48, 48), { rect: r } = d;
  d.box(0, 0, 48, 48, wood); r(0, 0, 1, 1, '#00000000');
  r(1, 1, 46, 1, tan); r(1, 1, 1, 46, tan); r(1, 46, 46, 1, bark); r(46, 1, 1, 46, bark);
  d.box(11, 11, 26, 26, ink); r(12, 12, 24, 24, '#f0e2c0'); r(12, 12, 24, 1, '#d9c49a');
  for (let i = 3; i < 10; i += 3) {
    r(9, i, 30, 1, bark); r(11, i - 1, 19, 1, tan); r(9, 47 - i, 30, 1, bark);
    r(i, 10, 1, 28, bark); r(i - 1, 12, 1, 15, tan); r(47 - i, 10, 1, 28, bark);
  }
  for (const [x, y] of [[4, 4], [39, 4], [4, 39], [39, 39]]) {
    d.box(x, y, 5, 5, ochre); r(x + 1, y + 1, 3, 2, gold); r(x + 2, y + 2, 1, 2, bark); r(x + 1, y + 1, 1, 1, paper);
  }
  r(8, 8, 2, 1, bark); r(9, 9, 2, 1, bark); r(37, 9, 2, 1, bark); r(38, 8, 2, 1, bark);
  return url(d.canvas);
})();
/** Botón de 24 × 24, corte de 8: bisel fino y veta que se repite. */
export const buttonImage = (() => {
  const d = drawing(24, 24), { rect: r } = d;
  d.box(0, 0, 24, 24, tan); r(1, 1, 22, 1, '#f0c78b'); r(1, 2, 1, 19, '#e0b07a');
  r(2, 21, 21, 2, wood); r(22, 2, 1, 20, bark); r(2, 20, 20, 1, '#a8723f');
  r(3, 5, 6, 1, '#c8925f'); r(12, 4, 8, 1, '#c8925f'); r(4, 14, 8, 1, '#c8925f'); r(14, 15, 6, 1, '#c8925f');
  r(3, 6, 4, 1, '#e0b07a'); r(15, 16, 5, 1, '#e0b07a'); r(3, 3, 1, 1, gold); r(20, 19, 1, 1, bark);
  return url(d.canvas);
})();
