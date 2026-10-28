// Fondo del mundo: hierba y camino (fijos) y el bancal (se redibuja al ampliarlo).
// El granero, la casa de gnomos, el tablón y el árbol viejo son sprites aparte (landmarks.ts) porque se pueden pulsar.
import { DOOR, FIELD, HOUSE, OLD_TREE, STATUE, WORLD } from '../sim/config';
import { makeCanvas, rng } from './pixelart';

function paintGrass(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = '#38b764';
  ctx.fillRect(0, 0, w, h);
  const gr = rng(seed);
  const dot = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    // envuelve en los bordes para que la baldosa se repita sin costuras
    ctx.fillRect((x + w) % w, (y + h) % h, 1, 1);
  };
  for (let i = 0; i < (w * h) / 14; i++) {
    const x = Math.floor(gr() * w), y = Math.floor(gr() * h), k = gr();
    if (k < 0.5) { dot(x, y, '#2e9a58'); dot(x + 1, y - 1, '#2e9a58'); }
    else if (k < 0.85) dot(x, y, '#5fcf72');
    else dot(x, y, '#a7f070');
  }
}

/** Baldosa de hierba repetible para rellenar la pantalla fuera del mundo. */
export function drawGrassTile(): HTMLCanvasElement {
  const c = makeCanvas(64, 64);
  paintGrass(c.getContext('2d')!, 64, 64, 41);
  return c;
}

export function drawBackground(): HTMLCanvasElement {
  const c = makeCanvas(WORLD.w, WORLD.h);
  const ctx = c.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  paintGrass(ctx, WORLD.w, WORLD.h, 99);

  // camino del granero al bancal
  const pathW = FIELD.x - 2 - 34;
  rect(34, DOOR.y - 6, pathW, 10, '#c8925f');
  rect(34, DOOR.y - 6, pathW, 1, '#a8723f');
  rect(34, DOOR.y + 3, pathW, 1, '#a8723f');
  const pr = rng(5);
  for (let i = 0; i < 26; i++) rect(36 + Math.floor(pr() * (pathW - 4)), DOOR.y - 4 + Math.floor(pr() * 6), 1, 1, '#e0b07a');

  // sombra bajo el árbol viejo
  ctx.fillStyle = 'rgba(26,28,44,.22)';
  ctx.beginPath();
  ctx.ellipse(OLD_TREE.x + OLD_TREE.w / 2, OLD_TREE.y + OLD_TREE.h - 1, OLD_TREE.w / 2 - 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // y bajo la casa de gnomos
  ctx.beginPath();
  ctx.ellipse(HOUSE.x + HOUSE.w / 2, HOUSE.y + HOUSE.h - 1, HOUSE.w / 2 - 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // flores, lejos del granero, del árbol y de donde puede llegar a crecer el bancal
  const fx0 = FIELD.x - 8, fy0 = FIELD.y - 8;
  const fx1 = FIELD.x + FIELD.maxCols * FIELD.cell + 8, fy1 = FIELD.y + FIELD.maxRows * FIELD.cell + 8;
  const f = rng(17);
  for (let placed = 0, tries = 0; placed < 22 && tries < 400; tries++) {
    const x = 4 + Math.floor(f() * (WORLD.w - 8)), y = 4 + Math.floor(f() * (WORLD.h - 8));
    const petal = f() < 0.5 ? '#f4f4f4' : '#ef7d57';
    if (x > fx0 && x < fx1 && y > fy0 && y < fy1) continue;
    if (x < FIELD.x && y < DOOR.y + 10) continue;
    if (x >= OLD_TREE.x - 2 && x <= OLD_TREE.x + OLD_TREE.w + 2 && y >= OLD_TREE.y - 2 && y <= OLD_TREE.y + OLD_TREE.h + 2) continue;
    if (x >= HOUSE.x - 2 && x <= HOUSE.x + HOUSE.w + 2 && y >= HOUSE.y - 2 && y <= HOUSE.y + HOUSE.h + 2) continue;
    // la estatua y lo que crece a su pie (cofre, tréboles)
    if (x >= STATUE.x - 8 && y >= STATUE.y - 2 && y <= STATUE.y + STATUE.h + 10) continue;
    rect(x - 1, y, 1, 1, petal);
    rect(x + 1, y, 1, 1, petal);
    rect(x, y - 1, 1, 1, petal);
    rect(x, y + 1, 1, 1, petal);
    rect(x, y, 1, 1, '#ffcd75');
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
 * abono (0–5): cada nivel oscurece un poco la tierra y le echa más grumos de mantillo.
 * golden (talento «abono dorado», 0–5): motas de oro entre la tierra, más por nivel.
 */
export function drawField(cols: number, rows: number, abono = 0, golden = 0): HTMLCanvasElement {
  const fw = cols * FIELD.cell, fh = rows * FIELD.cell;
  const c = makeCanvas(fw + 4, fh + 4);
  const ctx = c.getContext('2d')!;
  const k = 1 - 0.05 * abono;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = darken(color, k);
    ctx.fillRect(x + 2, y + 2, w, h);
  };
  rect(-2, -2, fw + 4, fh + 4, '#3e2519');
  rect(-1, -1, fw + 2, fh + 2, '#5c3a29');
  rect(0, 0, fw, fh, '#7a4b33');
  for (let row = 0; row < rows; row++) {
    const cy = row * FIELD.cell;
    rect(0, cy + 9, fw, 1, '#a06a48');
    rect(0, cy + 10, fw, 6, '#8b5a3c');
    rect(0, cy + 16, fw, 1, '#5c3a29');
    rect(0, cy + 17, fw, 1, '#4f3022');
  }
  const sr = rng(11);
  for (let i = 0; i < (fw * fh) / 31; i++) {
    rect(Math.floor(sr() * fw), Math.floor(sr() * fh), 1, 1, sr() < 0.6 ? '#6b4430' : '#a06a48');
  }
  // grumos de mantillo
  for (let i = 0; i < ((fw * fh) / 220) * abono; i++) rect(Math.floor(sr() * fw), Math.floor(sr() * fh), 1, 1, '#3e2519');
  // motas de oro (sin oscurecer: brillan igual con mucho abono)
  const gr = rng(31);
  for (let i = 0; i < ((fw * fh) / 400) * golden; i++) {
    ctx.fillStyle = gr() < 0.7 ? '#ffcd75' : '#f4b41b';
    ctx.fillRect(2 + Math.floor(gr() * fw), 2 + Math.floor(gr() * fh), 1, 1);
  }
  // la hierba se come el borde del bancal (la hierba no se abona: sin oscurecer)
  const er = rng(23);
  const tuft = (x: number, y: number) => {
    ctx.fillStyle = '#38b764';
    ctx.fillRect(x + 2, y + 2, 1, 1);
    if (er() < 0.5) {
      ctx.fillStyle = '#5fcf72';
      ctx.fillRect(x + 2, y + 1, 1, 1);
    }
  };
  for (let x = -2; x < fw + 2; x++) {
    if (er() < 0.35) tuft(x, -2);
    if (er() < 0.2) tuft(x, -1);
    if (er() < 0.35) tuft(x, fh + 1);
    if (er() < 0.15) tuft(x, fh);
  }
  for (let y = -2; y < fh + 2; y++) {
    if (er() < 0.35) tuft(-2, y);
    if (er() < 0.2) tuft(-1, y);
    if (er() < 0.35) tuft(fw + 1, y);
    if (er() < 0.15) tuft(fw, y);
  }
  return c;
}
