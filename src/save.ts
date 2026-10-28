import { deserialize, serialize } from './sim/state';
import type { GameState, Rng } from './sim/types';

const KEY = 'tiny-harvest:partida:v1';
/** prefijo de las copias de partidas que no se pudieron leer; cada copia lleva la hora a la que se apartó */
export const BACKUP_PREFIX = 'tiny-harvest:partida:rota:';

export interface LoadResult {
  state: GameState | null;
  /**
   * Había una partida guardada que no se pudo leer (rota o de una versión que no se conoce).
   * `raw` es su texto tal cual; `backedUp` dice si se apartó una copia antes de que el autoguardado la pise.
   */
  unreadable?: { raw: string; backedUp: boolean };
}

export function loadGame(rng: Rng): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { state: null }; // sin almacenamiento: no hay nada que proteger
  }
  if (raw === null) return { state: null };
  let state: GameState | null = null;
  try {
    state = deserialize(JSON.parse(raw), rng);
  } catch {
    // JSON roto o datos que hacen fallar la carga: se trata igual que una versión desconocida
  }
  if (state) return { state };
  let backedUp = false;
  try {
    localStorage.setItem(BACKUP_PREFIX + Date.now(), raw);
    backedUp = true;
  } catch {
    // sin sitio para la copia: quien llama no debe guardar encima sin preguntar
  }
  return { state: null, unreadable: { raw, backedUp } };
}

/** Devuelve si se ha podido guardar. */
export function saveGame(s: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(s)));
    return true;
  } catch {
    return false; // modo privado, sin sitio…: se juega igual y se avisa
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}
