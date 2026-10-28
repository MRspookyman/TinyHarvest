// Fondo del mundo: hierba y camino (fijos) y el bancal (se redibuja al ampliarlo).
// El granero, la casa de gnomos, el tablón y el árbol viejo son sprites aparte (landmarks.ts) porque se pueden pulsar.
import { BARN, BOARD, DOOR, FIELD, HOUSE, OLD_TREE, STATUE, WORLD } from '../sim/config';
import { ART, makeCanvas, rng } from './pixelart';

/** Todas las medidas de dibujo son píxeles de arte; las posiciones del mundo no cambian. */
function paintGrass(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = '#38b764';
  ctx.fillRect(0, 0, w, h);
  const gr = rng(seed);
  const dot = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    // También envuelve cada hoja y cada mancha: no hay cortes al repetir la baldosa.
    ctx.fillRect(((x % w) + w) % w, ((y % h) + h) % h, 1, 1);
  };
  // Islas de color casi iguales al fondo, con mucho espacio tranquilo entre matas.
  for (let i = 0; i < (w * h) / 1200; i++) {
    const x = Math.floor(gr() * w), y = Math.floor(gr() * h);
    const pw = 9 + Math.floor(gr() * 10), ph = 4 + Math.floor(gr() * 4);
    const color = gr() < 0.6 ? '#35b161' : '#3bbb67';
    for (let dy = 0; dy < ph; dy++) {
      const inset = dy === 0 || dy === ph - 1 ? 4 : dy === 1 || dy === ph - 2 ? 2 : 0;
      for (let dx = inset; dx < pw - inset; dx++) dot(x + dx, y + dy, color);
    }
  }
  // Briznas curvas, de alturas distintas, no píxeles sueltos repartidos por toda la hierba.
  for (let i = 0; i < (w * h) / 650; i++) {
    const x = Math.floor(gr() * w), y = Math.floor(gr() * h);
    const high = 3 + Math.floor(gr() * 3);
    for (let dx = -2; dx <= 3; dx++) dot(x + dx, y + 1, '#32a65d');
    for (let dy = 0; dy < high; dy++) dot(x, y - dy, '#2e9a58');
    dot(x - 1, y - high + 1, '#5fcf72');
    dot(x - 2, y - 1, '#2e9a58');
    dot(x - 3, y - 2, '#55c66d');
    dot(x + 2, y - 1, '#2e9a58');
    dot(x + 3, y - 2, '#49c469');
    if (gr() < 0.3) dot(x + 3, y - 3, '#78d77b');
  }
}

/** Baldosa de hierba repetible para rellenar la pantalla fuera del mundo. */
export function drawGrassTile(): HTMLCanvasElement {
  const c = makeCanvas(64 * ART, 64 * ART);
  paintGrass(c.getContext('2d')!, c.width, c.height, 41);
  return c;
}

export function drawBackground(): HTMLCanvasElement {
  const c = makeCanvas(WORLD.w * ART, WORLD.h * ART);
  const ctx = c.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  paintGrass(ctx, c.width, c.height, 99);

  // Camino continuo con peldaños irregulares y un pequeño labio de tierra pisada.
  const left = 34 * ART, right = (FIELD.x - 2) * ART;
  const pr = rng(5);
  for (let x = left; x < right; x += 7) {
    const width = Math.min(7, right - x);
    const top = (DOOR.y - 6) * ART + Math.floor(pr() * 4);
    const bottom = (DOOR.y + 3) * ART - Math.floor(pr() * 3);
    rect(x, top - 1, width, 1, '#2e9a58');
    rect(x, top, width, bottom - top + 1, '#c8925f');
    rect(x, top, width, 1, '#e0b07a');
    rect(x, top + 1, width, 1, '#d5a06a');
    rect(x, bottom - 1, width, 1, '#b6804c');
    rect(x, bottom, width, 1, '#8d603b');
    if (pr() < 0.55) rect(x + 2, bottom + 1, Math.min(3, width - 2), 1, '#2e9a58');
  }
  // Grava menuda: brillo superior izquierdo y sombra de contacto de un píxel.
  for (let i = 0; i < 18; i++) {
    const x = left + 5 + Math.floor(pr() * (right - left - 10));
    const y = (DOOR.y - 3) * ART + Math.floor(pr() * 7);
    const size = pr() < 0.7 ? 2 : 3;
    rect(x + 1, y + 2, size, 1, '#a8723f');
    rect(x, y, size, 2, '#d9ad7d');
    rect(x, y, size - 1, 1, '#efd0a0');
    rect(x + size - 1, y + 1, 1, 1, '#b17b4e');
  }
  for (let i = 0; i < 10; i++) {
    const x = left + 3 + Math.floor(pr() * (right - left - 6));
    const y = (DOOR.y - 4) * ART + Math.floor(pr() * 10);
    rect(x, y, 3 + Math.floor(pr() * 3), 1, '#bc8654');
  }

  // Sombras de contacto en bandas escalonadas, sin desenfoque ni degradado.
  const contact = (x: number, bottom: number, width: number) => {
    const sx = x * ART, sy = bottom * ART, sw = width * ART;
    rect(sx + 3, sy - 2, sw - 2, 2, 'rgba(26,28,44,.25)');
    rect(sx + 5, sy, sw - 3, 2, 'rgba(26,28,44,.18)');
    rect(sx + 8, sy + 2, sw - 8, 1, 'rgba(26,28,44,.11)');
  };
  contact(BARN.x + 2, BARN.y + BARN.h, BARN.w - 4);
  contact(BOARD.x + 2, BOARD.y + BOARD.h, BOARD.w - 4);
  contact(OLD_TREE.x + 5, OLD_TREE.y + OLD_TREE.h, OLD_TREE.w - 10);
  contact(HOUSE.x + 4, HOUSE.y + HOUSE.h, HOUSE.w - 8);
  contact(STATUE.x, STATUE.y + STATUE.h, STATUE.w - 2);

  // Flores pequeñas y espaciadas, fuera de edificios, camino y futuras ampliaciones.
  const fx0 = FIELD.x - 8, fy0 = FIELD.y - 8;
  const fx1 = FIELD.x + FIELD.maxCols * FIELD.cell + 8, fy1 = FIELD.y + FIELD.maxRows * FIELD.cell + 8;
  const f = rng(17);
  for (let placed = 0, tries = 0; placed < 12 && tries < 400; tries++) {
    const x = 4 + Math.floor(f() * (WORLD.w - 8)), y = 4 + Math.floor(f() * (WORLD.h - 8));
    const white = f() < 0.5;
    if (x > fx0 && x < fx1 && y > fy0 && y < fy1) continue;
    if (x < FIELD.x && y < DOOR.y + 10) continue;
    if (x >= OLD_TREE.x - 2 && x <= OLD_TREE.x + OLD_TREE.w + 2 && y >= OLD_TREE.y - 2 && y <= OLD_TREE.y + OLD_TREE.h + 2) continue;
    if (x >= HOUSE.x - 2 && x <= HOUSE.x + HOUSE.w + 2 && y >= HOUSE.y - 2 && y <= HOUSE.y + HOUSE.h + 2) continue;
    if (x >= STATUE.x - 8 && y >= STATUE.y - 2 && y <= STATUE.y + STATUE.h + 10) continue;
    const px = x * ART, py = y * ART;
    rect(px, py + 2, 1, 4, '#257d49');
    rect(px - 2, py + 4, 2, 1, '#66cb70');
    rect(px + 1, py + 3, 2, 1, '#2e9a58');
    const petal = white ? '#f4f4e8' : '#ef7d57';
    const shade = white ? '#cad3bd' : '#c95750';
    rect(px - 1, py - 3, 2, 2, petal);
    rect(px - 3, py - 1, 2, 2, petal);
    rect(px + 1, py - 1, 2, 2, petal);
    rect(px - 1, py + 1, 2, 2, shade);
    rect(px - 1, py - 1, 2, 2, '#e5a840');
    rect(px - 1, py - 1, 1, 1, '#ffdf8b');
    placed++;
  }
  return c;
}

/** Oscurece un color #rrggbb multiplicando sus canales: la tierra abonada se ve más negra y rica. */
function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * k).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/**
 * Bancal continuo de cols × rows con surcos de lado a lado. Se coloca en (FIELD.x - 2, FIELD.y - 2).
 * abono (0–5): cada nivel oscurece un poco la tierra y añade grumos de mantillo.
 * golden (talento «abono dorado», 0–5): motas de oro entre la tierra, más por nivel.
 */
export function drawField(cols: number, rows: number, abono = 0, golden = 0): HTMLCanvasElement {
  const fw = cols * FIELD.cell * ART, fh = rows * FIELD.cell * ART;
  const margin = 2 * ART;
  const c = makeCanvas(fw + margin * 2, fh + margin * 2);
  const ctx = c.getContext('2d')!;
  const k = 1 - 0.05 * abono;
  // Paleta calculada una sola vez: cada terrón usa las mismas bandas de luz.
  const earth = {
    outline: '#1a1c2c', edge: '#3e2519', shadow: '#4f3022', deep: '#5c3a29',
    base: '#7a4b33', ridge: '#8b5a3c', light: '#a06a48', glint: '#b67b51', clod: '#6b4430',
  };
  const soil = Object.fromEntries(Object.entries(earth).map(([name, color]) => [name, darken(color, k)]));
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + margin, y + margin, w, h);
  };
  rect(-margin, -margin, fw + margin * 2, fh + margin * 2, earth.outline);
  rect(-3, -3, fw + 6, fh + 6, soil.edge);
  rect(-2, -2, fw + 4, fh + 4, soil.deep);
  rect(0, 0, fw, fh, soil.base);
  rect(-2, -2, fw + 3, 1, soil.light);
  rect(-2, -1, 1, fh + 1, soil.ridge);
  rect(0, fh, fw + 2, 2, soil.edge);

  for (let row = 0; row < rows; row++) {
    const cy = row * FIELD.cell * ART;
    // Cresta ancha, surco bajo y pequeños cortes que evitan el aspecto de rayado perfecto.
    rect(0, cy + 18, fw, 1, soil.light);
    rect(0, cy + 19, fw, 2, soil.glint);
    rect(0, cy + 21, fw, 9, soil.ridge);
    rect(0, cy + 30, fw, 2, soil.base);
    rect(0, cy + 32, fw, 2, soil.deep);
    rect(0, cy + 34, fw, 2, soil.shadow);
    for (let x = 5 + row % 3; x < fw - 3; x += 17) {
      rect(x, cy + 18, 3, 1, soil.base);
      rect(x + 2, cy + 20, 4, 1, soil.light);
      rect(x + 5, cy + 31, 3, 1, soil.deep);
      rect(x - 1, cy + 34, 2, 1, soil.edge);
    }
  }
  const sr = rng(11);
  // Terrones con volumen de dos o tres píxeles; el resto de la tierra queda despejado.
  for (let i = 0; i < (fw * fh) / 230; i++) {
    const x = Math.floor(sr() * (fw - 3)), y = Math.floor(sr() * (fh - 2));
    const width = sr() < 0.6 ? 2 : 3;
    rect(x, y, width, 1, soil.light);
    rect(x + 1, y + 1, width, 1, soil.clod);
    if (width === 3) rect(x + 2, y + 2, 1, 1, soil.deep);
  }
  // Materia orgánica oscura: más abundante con cada nivel de abono.
  for (let i = 0; i < ((fw * fh) / 880) * abono; i++) {
    const x = Math.floor(sr() * (fw - 3)), y = Math.floor(sr() * (fh - 2));
    rect(x, y, 2, 1, soil.deep);
    rect(x + 1, y + 1, 2, 1, soil.edge);
  }
  // Oro sin oscurecer: una cara iluminada y otra ocre, incluso con abono máximo.
  const gr = rng(31);
  for (let i = 0; i < ((fw * fh) / 1600) * golden; i++) {
    const x = Math.floor(gr() * (fw - 2)), y = Math.floor(gr() * (fh - 2));
    rect(x, y, 2, 1, '#ffcd75');
    rect(x + 1, y + 1, 1, 1, '#c58a32');
    if (gr() < 0.25) rect(x, y - 1, 1, 1, '#fff1b0');
  }
  // La hierba invade solo unos puntos del marco, sin tapar los surcos.
  const er = rng(23);
  const tuft = (x: number, y: number) => {
    rect(x - 1, y, 4, 1, '#257d49');
    rect(x, y - 2, 1, 3, '#38b764');
    rect(x - 1, y - 3, 1, 2, '#5fcf72');
    rect(x + 2, y - 1, 1, 2, '#38b764');
    rect(x + 3, y - 2, 1, 1, '#49c469');
  };
  for (let x = 2; x < fw - 2; x += 9) {
    if (er() < 0.55) tuft(x, -1);
    if (er() < 0.5) tuft(x + 1, fh + 3);
  }
  for (let y = 4; y < fh; y += 10) {
    if (er() < 0.5) tuft(-2, y);
    if (er() < 0.5) tuft(fw + 1, y + 1);
  }
  return c;
}
