import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_PREFIX, loadGame, saveGame } from './save';
import { createState, SAVE_VERSION, serialize } from './sim/state';

/** localStorage de mentira; `full` hace que cualquier escritura falle como si no quedara sitio */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const store = {
    full: false,
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (store.full) throw new DOMException('lleno', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
  vi.stubGlobal('localStorage', store);
  return store;
}

const KEY = 'tiny-harvest:partida:v1';
const rng = () => 0.5;
const backups = (data: Map<string, string>) => [...data].filter(([k]) => k.startsWith(BACKUP_PREFIX)).map(([, v]) => v);

describe('guardado', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin partida empieza de cero sin avisar', () => {
    fakeStorage();
    expect(loadGame(rng)).toEqual({ state: null });
  });

  it('carga una partida buena', () => {
    const s = createState(rng);
    s.coins = 1234;
    fakeStorage({ [KEY]: JSON.stringify(serialize(s)) });
    expect(loadGame(rng).state?.coins).toBe(1234);
  });

  it.each([
    ['JSON roto', '{"v": 6, "coins": 1'],
    ['versión futura', JSON.stringify({ ...serialize(createState(rng)), v: SAVE_VERSION + 1 })],
    ['versión demasiado vieja', JSON.stringify({ v: 1, coins: 50 })],
  ])('una partida ilegible (%s) se aparta antes de que se pueda pisar', (_, raw) => {
    const store = fakeStorage({ [KEY]: raw });
    const r = loadGame(rng);
    expect(r.state).toBeNull();
    expect(r.unreadable).toEqual({ raw, backedUp: true });
    expect(backups(store.data)).toEqual([raw]);
    // el autoguardado del huerto nuevo pisa la clave, pero la copia sigue ahí
    expect(saveGame(createState(rng))).toBe(true);
    expect(backups(store.data)).toEqual([raw]);
  });

  it('sin sitio para la copia lo dice, para que no se guarde encima', () => {
    const store = fakeStorage({ [KEY]: 'basura' });
    store.full = true;
    expect(loadGame(rng).unreadable).toEqual({ raw: 'basura', backedUp: false });
    expect(store.data.get(KEY)).toBe('basura');
  });

  it('guardar devuelve false cuando el navegador no deja', () => {
    const store = fakeStorage();
    store.full = true;
    expect(saveGame(createState(rng))).toBe(false);
  });
});
