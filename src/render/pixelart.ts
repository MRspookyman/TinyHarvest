// Pixel art por código: un sprite es una lista de filas de caracteres; cada carácter es un color de la paleta.
export type PixelMap = readonly string[];
export type Palette = Record<string, string>;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function blit(ctx: CanvasRenderingContext2D, map: PixelMap, x: number, y: number, pal: Palette) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}

export function mapCanvas(map: PixelMap, pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(map[0].length, map.length);
  blit(c.getContext('2d')!, map, 0, 0, pal);
  return c;
}

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
