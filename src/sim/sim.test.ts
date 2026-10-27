import { describe, expect, it } from 'vitest';
import { BASKET, CROPS, FIELD, MAX_GROUPS, RIPE, TREE } from './config';
import {
  basketMax, buyNode, clickPlot, createGroup, deleteGroup, fieldSize, hire, hireCost, isOpen, moveGnome, nodeCost,
  nodeReachable, plotAt, plotStand, renameGroup, setGroupColor, setPriority, tick,
} from './sim';
import { createState, deserialize, serialize } from './state';
import type { GameState, JobId, Rng } from './types';

function seeded(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(s: GameState, seconds: number, rng: Rng) {
  for (let i = 0; i < seconds * 30; i++) tick(s, 1 / 30, rng);
}

function hireFree(s: GameState, job: JobId, rng: Rng) {
  s.coins += hireCost(s, job);
  if (job === 'porteador') s.tree.porteadores = 1;
  hire(s, job, rng);
  return s.gnomes[s.gnomes.length - 1];
}

function park(g: { state: string; timer: number; task: unknown }) {
  g.state = 'work';
  g.timer = 9999;
  g.task = { kind: 'nap' };
}

const plotId = (col: number, row: number) => row * FIELD.maxCols + col;

describe('contratar', () => {
  it('el coste sube un 18 % por gnomo del mismo oficio', () => {
    const s = createState(seeded(1));
    expect(hireCost(s, 'recolector')).toBe(12);
    s.hired.recolector = 5;
    expect(hireCost(s, 'recolector')).toBe(Math.floor(12 * 1.18 ** 5));
  });

  it('no se puede contratar sin monedas', () => {
    const s = createState(seeded(1));
    expect(hire(s, 'recolector', seeded(2))).toBe(false);
    s.coins = 12;
    expect(hire(s, 'recolector', seeded(2))).toBe(true);
    expect(s.coins).toBe(0);
  });

  it('los porteadores se desbloquean en el árbol', () => {
    const s = createState(seeded(1));
    s.coins = 1e6;
    expect(hire(s, 'porteador', seeded(2))).toBe(false);
    buyNode(s, 'botas');
    buyNode(s, 'saco');
    expect(buyNode(s, 'porteadores')).toBe(true);
    expect(hire(s, 'porteador', seeded(2))).toBe(true);
  });
});

describe('árbol de mejoras', () => {
  it('un nodo necesita a su padre', () => {
    const s = createState(seeded(1));
    s.coins = 1e6;
    expect(nodeReachable(s, 'cafe')).toBe(false);
    expect(buyNode(s, 'cafe')).toBe(false);
    expect(buyNode(s, 'botas')).toBe(true);
    expect(buyNode(s, 'cafe')).toBe(true);
  });

  it('el coste crece con el nivel y hay un máximo', () => {
    const s = createState(seeded(1));
    s.coins = 1e9;
    expect(nodeCost(s, 'botas')).toBe(30);
    buyNode(s, 'botas');
    expect(nodeCost(s, 'botas')).toBe(60);
    while (buyNode(s, 'botas'));
    expect(s.tree.botas).toBe(TREE.botas.max);
  });

  it('los cultivos nuevos se desbloquean en el árbol', () => {
    const s = createState(seeded(1));
    expect(clickPlot(s, 0, 'trigo')).toBe(null);
    s.coins = 60;
    expect(buyNode(s, 'trigo')).toBe(true);
    expect(clickPlot(s, 0, 'trigo')).toBe('plant');
  });

  it('la cesta grande guarda más', () => {
    const s = createState(seeded(1));
    expect(basketMax(s)).toBe(BASKET.base);
    s.tree.cesta = 2;
    expect(basketMax(s)).toBe(BASKET.base + 2 * BASKET.perLevel);
  });
});

describe('bancal', () => {
  it('empieza en 3 × 3 y no se puede plantar fuera', () => {
    const s = createState(seeded(1));
    expect(s.plots.filter(p => isOpen(s, p))).toHaveLength(9);
    expect(clickPlot(s, plotId(3, 0), 'zanahoria')).toBe(null);
    expect(plotAt(s, FIELD.x + 3 * FIELD.cell + 1, FIELD.y + 1)).toBe(null);
  });

  it('crece alternando columnas y filas hasta 9 × 6', () => {
    const s = createState(seeded(1));
    s.coins = 1e9;
    buyNode(s, 'bancal');
    expect(fieldSize(s)).toEqual({ cols: 4, rows: 3 });
    buyNode(s, 'bancal');
    expect(fieldSize(s)).toEqual({ cols: 4, rows: 4 });
    while (buyNode(s, 'bancal'));
    expect(fieldSize(s)).toEqual({ cols: 9, rows: 6 });
  });
});

describe('cultivos', () => {
  it('una zanahoria madura en su tiempo de crecimiento', () => {
    const rng = seeded(3);
    const s = createState(rng);
    const p = s.plots[0];
    clickPlot(s, p.id, 'zanahoria');
    run(s, CROPS.zanahoria.grow - 0.5, rng);
    expect(p.stage).toBeLessThan(RIPE);
    run(s, 1, rng);
    expect(p.stage).toBe(RIPE);
  });

  it('recoger a mano da monedas y deja la parcela vacía', () => {
    const s = createState(seeded(1));
    s.plots[0].stage = RIPE;
    expect(clickPlot(s, 0, 'zanahoria')).toBe('harvest');
    expect(s.coins).toBe(CROPS.zanahoria.value);
    expect(s.plots[0].stage).toBe(-1);
  });
});

describe('gnomos', () => {
  it('sin porteadores, el recolector lleva la cosecha al granero', () => {
    const rng = seeded(4);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    s.plots[plotId(1, 1)].stage = RIPE;
    hireFree(s, 'recolector', rng);
    run(s, 30, rng);
    expect(s.coins).toBe(CROPS.zanahoria.value);
  });

  it('con porteadores, la cosecha pasa por la cesta', () => {
    const rng = seeded(8);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    hireFree(s, 'recolector', rng);
    const porter = hireFree(s, 'porteador', rng);
    park(porter);
    s.plots[plotId(0, 0)].stage = RIPE;
    s.plots[plotId(1, 0)].stage = RIPE;
    run(s, 30, rng);
    expect(s.basket).toHaveLength(2);
    expect(s.coins).toBe(0);
    porter.timer = 0;
    run(s, 30, rng);
    expect(s.basket).toHaveLength(0);
    expect(s.coins).toBe(2 * CROPS.zanahoria.value);
  });

  it('con la cesta llena, el recolector espera con el saco', () => {
    const rng = seeded(9);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    s.basket = Array(basketMax(s)).fill('zanahoria');
    park(hireFree(s, 'porteador', rng));
    const picker = hireFree(s, 'recolector', rng);
    s.plots[0].stage = RIPE;
    run(s, 20, rng);
    expect(picker.carry).toHaveLength(1);
    expect(['wait', 'drop']).toContain(picker.task?.kind);
  });

  it('un sembrador replanta solo el bancal abierto', () => {
    const rng = seeded(5);
    const s = createState(rng);
    hireFree(s, 'sembrador', rng);
    run(s, 40, rng);
    expect(s.plots.filter(p => isOpen(s, p)).every(p => p.stage >= 0)).toBe(true);
    expect(s.plots.filter(p => !isOpen(s, p)).every(p => p.stage === -1)).toBe(true);
  });
});

describe('grupos', () => {
  it('se crean con nombre y color distintos y hay un máximo', () => {
    const s = createState(seeded(1));
    const g = createGroup(s)!;
    expect(g.name).not.toBe(s.groups[0].name);
    expect(g.color).not.toBe(s.groups[0].color);
    while (createGroup(s));
    expect(s.groups).toHaveLength(MAX_GROUPS);
  });

  it('se renombran y cambian de color', () => {
    const s = createState(seeded(1));
    const id = s.groups[0].id;
    expect(renameGroup(s, id, '   Los   Valientes  ')).toBe(true);
    expect(s.groups[0].name).toBe('Los Valientes');
    expect(renameGroup(s, id, '   ')).toBe(false);
    setGroupColor(s, id, 5);
    expect(s.groups[0].color).toBe(5);
  });

  it('al borrar un grupo sus gnomos pasan al primero, y el último no se borra', () => {
    const rng = seeded(1);
    const s = createState(rng);
    const b = createGroup(s)!;
    const g = hireFree(s, 'recolector', rng);
    expect(moveGnome(s, g.id, b.id)).toBe(true);
    expect(deleteGroup(s, b.id)).toBe(true);
    expect(g.group).toBe(s.groups[0].id);
    expect(deleteGroup(s, s.groups[0].id)).toBe(false);
  });

  it('cada grupo sigue su prioridad', () => {
    const rng = seeded(6);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    const valiosos = createGroup(s)!;
    setPriority(s, valiosos.id, 'valioso');
    const g = hireFree(s, 'recolector', rng);
    moveGnome(s, g.id, valiosos.id);
    const carrot = s.plots[plotId(0, 0)];
    const tomato = s.plots[plotId(2, 2)];
    carrot.stage = RIPE;
    tomato.stage = RIPE;
    tomato.crop = 'tomate';
    const c = plotStand(carrot);
    g.x = c.x;
    g.y = c.y;
    tick(s, 1 / 30, rng);
    expect(g.task?.plot).toBe(tomato.id);

    setPriority(s, valiosos.id, 'solo_trigo');
    tick(s, 1 / 30, rng);
    expect(g.task?.kind).not.toBe('harvest');
  });
});

describe('guardado', () => {
  it('serializar y cargar conserva lo importante', () => {
    const rng = seeded(7);
    const s = createState(rng);
    s.coins = 123;
    s.tree.botas = 2;
    s.tree.tomate = 1;
    s.tree.bancal = 3;
    s.basket = ['trigo', 'zanahoria'];
    s.plots[3].crop = 'tomate';
    s.plots[3].stage = 2;
    const b = createGroup(s)!;
    renameGroup(s, b.id, 'Los Valientes');
    setGroupColor(s, b.id, 7);
    setPriority(s, b.id, 'solo_tomate');
    const g = hireFree(s, 'porteador', rng);
    moveGnome(s, g.id, b.id);
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s))), rng)!;
    expect(loaded.coins).toBe(s.coins);
    expect(loaded.tree).toEqual(s.tree);
    expect(fieldSize(loaded)).toEqual(fieldSize(s));
    expect(loaded.basket).toEqual(['trigo', 'zanahoria']);
    expect(loaded.plots[3]).toMatchObject({ crop: 'tomate', stage: 2 });
    expect(loaded.groups[1]).toEqual({ id: b.id, name: 'Los Valientes', color: 7, priority: 'solo_tomate' });
    expect(loaded.gnomes[0]).toMatchObject({ name: g.name, job: 'porteador', group: b.id, state: 'think' });
    expect(loaded.nextId).toBe(s.nextId);
    expect(loaded.nextGroupId).toBe(s.nextGroupId);
  });

  it('rechaza partidas de otra versión', () => {
    expect(deserialize(null, seeded(1))).toBe(null);
    expect(deserialize({ v: 2 }, seeded(1))).toBe(null);
  });
});
