import { describe, expect, it } from 'vitest';
import { BASKET, CROPS, CROWN_MARGIN, FIELD, MAX_GROUPS, RIPE, ROTTEN, TREE } from './config';
import {
  basketMax, buyNode, clickPlot, createGroup, deleteGroup, fieldSize, hire, hireCost, isOpen, moveGnome, nodeCost,
  nodeReachable, plotAt, plotStand, renameGroup, setGroupColor, setGroupSeed, setPriority, tick,
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

  it('lo maduro que nadie recoge se echa a perder pasado su aguante', () => {
    const rng = seeded(3);
    const s = createState(rng);
    const p = s.plots[0];
    p.stage = RIPE;
    p.t = 0;
    run(s, CROPS.zanahoria.keep - 0.5, rng);
    expect(p.stage).toBe(RIPE);
    run(s, 1, rng);
    expect(p.stage).toBe(ROTTEN);
    expect(s.rotted).toBe(1);
    // echado a perder no da monedas: un clic lo arranca y siembra la semilla elegida
    expect(clickPlot(s, p.id, 'zanahoria')).toBe('plant');
    expect(s.coins).toBe(0);
    expect(p.stage).toBe(0);
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

  it('los recolectores no recogen lo echado a perder; los sembradores lo arrancan y replantan', () => {
    const rng = seeded(5);
    const s = createState(rng);
    for (const p of s.plots) p.stage = 0;
    const rotten = s.plots[plotId(1, 1)];
    rotten.stage = ROTTEN;
    const picker = hireFree(s, 'recolector', rng);
    tick(s, 1 / 30, rng);
    expect(picker.task?.kind).not.toBe('harvest');
    hireFree(s, 'sembrador', rng);
    run(s, 6, rng);
    expect(rotten.stage).toBeGreaterThanOrEqual(0);
    expect(rotten.stage).toBeLessThan(RIPE);
  });

  it('dos porteadores no van a por una cesta que solo da para uno', () => {
    const rng = seeded(8);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    const a = hireFree(s, 'porteador', rng);
    const b = hireFree(s, 'porteador', rng);
    s.basket = ['zanahoria', 'zanahoria', 'zanahoria'];
    tick(s, 1 / 30, rng);
    const kinds = [a, b].map(g => g.task?.kind);
    expect(kinds.filter(k => k === 'pickup')).toHaveLength(1);
    // con 6 en la cesta (más de PORTER_CAPACITY) ya hay trabajo para el segundo
    s.basket.push('zanahoria', 'zanahoria', 'zanahoria');
    const idle = a.task?.kind === 'pickup' ? b : a;
    idle.state = 'think';
    tick(s, 1 / 30, rng);
    expect(idle.task?.kind).toBe('pickup');
  });
});

describe('semilla por grupo', () => {
  it('los sembradores siembran la semilla del grupo; sin semilla, lo que había', () => {
    const rng = seeded(5);
    const s = createState(rng);
    s.tree.trigo = 1;
    s.tree.tomate = 1;
    s.tree.calabaza = 1;
    for (const p of s.plots) p.stage = 0;
    const a = s.plots[plotId(0, 0)];
    a.stage = -1;
    a.crop = 'zanahoria';
    hireFree(s, 'sembrador', rng);
    run(s, 5, rng);
    expect(a).toMatchObject({ stage: 0, crop: 'zanahoria' });

    setGroupSeed(s, s.groups[0].id, 'calabaza');
    a.stage = ROTTEN;
    // aunque esté de siesta o paseando, en 12 s vuelve; la calabaza tarda 15 s en pasar de fase
    run(s, 12, rng);
    expect(a).toMatchObject({ stage: 0, crop: 'calabaza' });
  });

  it('no deja elegir una semilla sin desbloquear', () => {
    const s = createState(seeded(1));
    setGroupSeed(s, s.groups[0].id, 'calabaza');
    expect(s.groups[0].seed).toBe(null);
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

  it('«valioso» cuenta el paseo: un tomate al lado gana a una calabaza al fondo del bancal', () => {
    const rng = seeded(6);
    const s = createState(rng);
    s.tree.bancal = TREE.bancal.max;
    for (const p of s.plots) p.stage = -1;
    setPriority(s, s.groups[0].id, 'valioso');
    const g = hireFree(s, 'recolector', rng);
    const tomato = s.plots[plotId(0, 0)];
    const pumpkin = s.plots[plotId(8, 5)];
    Object.assign(tomato, { stage: RIPE, crop: 'tomate' });
    Object.assign(pumpkin, { stage: RIPE, crop: 'calabaza' });
    Object.assign(g, plotStand(tomato));
    tick(s, 1 / 30, rng);
    expect(g.task?.plot).toBe(tomato.id);
    // a la misma distancia, gana la calabaza
    releaseAndThink(s, g);
    Object.assign(tomato, { stage: -1 });
    const nearPumpkin = s.plots[plotId(1, 0)];
    Object.assign(nearPumpkin, { stage: RIPE, crop: 'calabaza' });
    Object.assign(tomato, { stage: RIPE, crop: 'tomate' });
    const mid = { x: (plotStand(tomato).x + plotStand(nearPumpkin).x) / 2, y: plotStand(tomato).y };
    Object.assign(g, mid);
    tick(s, 1 / 30, rng);
    expect(g.task?.plot).toBe(nearPumpkin.id);
  });

  it('«urgente» va a lo que antes se va a echar a perder, aunque esté más lejos', () => {
    const rng = seeded(6);
    const s = createState(rng);
    s.tree.bancal = TREE.bancal.max;
    for (const p of s.plots) p.stage = -1;
    setPriority(s, s.groups[0].id, 'urgente');
    const g = hireFree(s, 'recolector', rng);
    const fresh = s.plots[plotId(0, 0)];
    const old = s.plots[plotId(6, 4)];
    Object.assign(fresh, { stage: RIPE, t: 0 });
    Object.assign(old, { stage: RIPE, t: CROPS.zanahoria.keep - 8 });
    Object.assign(g, plotStand(fresh));
    tick(s, 1 / 30, rng);
    expect(g.task?.plot).toBe(old.id);
  });
});

function releaseAndThink(s: GameState, g: GameState['gnomes'][number]) {
  if (g.task?.plot !== undefined) s.plots[g.task.plot].res = null;
  g.state = 'think';
  g.task = null;
}

describe('ranking', () => {
  it('los gnomos apuntan lo que hacen', () => {
    const rng = seeded(4);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    s.plots[plotId(1, 1)].stage = RIPE;
    const g = hireFree(s, 'recolector', rng);
    run(s, 30, rng);
    expect(g.stats).toMatchObject({ harvests: 1, value: CROPS.zanahoria.value, delivered: 1, tasks: 2 });
    expect(g.stats.walked).toBeGreaterThan(0);
  });

  it('la corona es del más trabajador y solo cambia de cabeza con ventaja clara', () => {
    const rng = seeded(4);
    const s = createState(rng);
    const a = hireFree(s, 'recolector', rng);
    const b = hireFree(s, 'recolector', rng);
    for (const g of [a, b]) park(g);
    tick(s, 1 / 30, rng);
    expect(s.crown).toBe(null);
    a.stats.tasks = 5;
    tick(s, 1 / 30, rng);
    expect(s.crown).toBe(a.id);
    b.stats.tasks = 5 + CROWN_MARGIN - 1;
    tick(s, 1 / 30, rng);
    expect(s.crown).toBe(a.id);
    b.stats.tasks = 5 + CROWN_MARGIN;
    tick(s, 1 / 30, rng);
    expect(s.crown).toBe(b.id);
    expect(s.log[0]).toContain(b.name);
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
    setGroupSeed(s, b.id, 'tomate');
    s.plots[4].stage = ROTTEN;
    s.rotted = 3;
    const g = hireFree(s, 'porteador', rng);
    moveGnome(s, g.id, b.id);
    g.stats.tasks = 9;
    g.stats.walked = 120;
    s.crown = g.id;
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s))), rng)!;
    expect(loaded.coins).toBe(s.coins);
    expect(loaded.tree).toEqual(s.tree);
    expect(fieldSize(loaded)).toEqual(fieldSize(s));
    expect(loaded.basket).toEqual(['trigo', 'zanahoria']);
    expect(loaded.plots[3]).toMatchObject({ crop: 'tomate', stage: 2 });
    expect(loaded.plots[4].stage).toBe(ROTTEN);
    expect(loaded.groups[1]).toEqual({ id: b.id, name: 'Los Valientes', color: 7, priority: 'solo_tomate', seed: 'tomate' });
    expect(loaded.gnomes[0]).toMatchObject({ name: g.name, job: 'porteador', group: b.id, state: 'think' });
    expect(loaded.gnomes[0].stats).toMatchObject({ tasks: 9, walked: 120 });
    expect(loaded).toMatchObject({ rotted: 3, crown: g.id });
    expect(loaded.nextId).toBe(s.nextId);
    expect(loaded.nextGroupId).toBe(s.nextGroupId);
  });

  it('carga las partidas de la iteración 3, que no tenían semilla, estadísticas ni podredumbre', () => {
    const rng = seeded(7);
    const s = createState(rng);
    const g = hireFree(s, 'recolector', rng);
    const old = JSON.parse(JSON.stringify(serialize(s)));
    delete old.rotted;
    delete old.crown;
    for (const gr of old.groups) delete gr.seed;
    for (const gn of old.gnomes) delete gn.stats;
    const loaded = deserialize(old, rng)!;
    expect(loaded.groups[0].seed).toBe(null);
    expect(loaded.gnomes[0]).toMatchObject({ name: g.name });
    expect(loaded.gnomes[0].stats.tasks).toBe(0);
    expect(loaded).toMatchObject({ rotted: 0, crown: null });
  });

  it('rechaza partidas de otra versión', () => {
    expect(deserialize(null, seeded(1))).toBe(null);
    expect(deserialize({ v: 2 }, seeded(1))).toBe(null);
  });
});
