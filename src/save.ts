import { deserialize, serialize } from './sim/state';
import type { GameState, Rng } from './sim/types';

const KEY = 'tiny-harvest:partida:v1';

export function loadGame(rng: Rng): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? deserialize(JSON.parse(raw), rng) : null;
  } catch {
    return null;
  }
}

export function saveGame(s: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(s)));
  } catch {
    // sin almacenamiento (modo privado, etc.): se juega igual, sin guardar
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}
