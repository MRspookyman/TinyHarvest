// Tutorial (F5): pistas cortas para quien empieza, de una en una, en un bocadillo de pergamino sobre la barra.
// Cada pista apunta al botón de la barra que toca y se va sola cuando el jugador hace lo que dice.
// Lo visto se guarda aparte de la partida: borrar la partida o terminar la temporada no lo repite.
import { NODE_IDS } from '../sim/config';
import { canEndSeason } from '../sim/sim';
import type { GameState } from '../sim/types';
import { TUTORIAL, type MenuId } from '../textos';
import { html } from './dom';

const KEY = 'tiny-harvest:tutorial';

type StepId = 'plantar' | 'contratar' | 'arbol' | 'grupos' | 'ficha' | 'temporada';

/** lo que el tutorial mira además del estado: qué ventana y qué ficha hay abiertas */
export interface TutorialView {
  menu: MenuId | null;
  card: number | null;
}

interface Step {
  id: StepId;
  /** botón de la barra al que apunta (null: centrado) */
  anchor: string | null;
  /** la pista espera a que esto se cumpla para salir */
  ready?(s: GameState): boolean;
  done(s: GameState, v: TutorialView): boolean;
}

const STEPS: Step[] = [
  { id: 'plantar', anchor: '.seeds', done: s => s.manualHarvests > 0 || s.gnomes.length > 0 },
  { id: 'contratar', anchor: '[data-menu="contratar"]', done: s => s.gnomes.length > 0 },
  { id: 'arbol', anchor: '[data-menu="arbol"]', done: s => NODE_IDS.some(id => s.tree[id] > 0) },
  { id: 'grupos', anchor: '[data-menu="grupos"]', done: (s, v) => v.menu === 'grupos' || s.groups.length > 1 },
  { id: 'ficha', anchor: null, done: (_s, v) => v.card !== null },
  { id: 'temporada', anchor: '[data-menu="temporada"]', ready: canEndSeason, done: (s, v) => v.menu === 'temporada' || s.prestige.season > 1 },
];

interface Progress {
  done: StepId[];
  off: boolean;
}

function load(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '') as Progress;
    if (Array.isArray(p.done)) return { done: p.done, off: !!p.off };
  } catch {
    // sin guardar o roto: se empieza de cero
  }
  return { done: [], off: false };
}

export interface Tutorial {
  update(s: GameState, v: TutorialView): void;
}

/** @param enabled en las sesiones con atajos de desarrollo no sale (salvo con ?tutorial=1) */
export function createTutorial(stage: HTMLElement, toolbar: HTMLElement, enabled: boolean): Tutorial {
  const progress = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(progress));

  const el = html(`
    <aside class="tutorial" role="note" aria-live="polite" hidden>
      <button type="button" class="tutorial-close" data-skip aria-label="${TUTORIAL.cerrar}" data-tip="${TUTORIAL.cerrar}">×</button>
      <p data-text></p>
      <button type="button" class="link" data-off>${TUTORIAL.noMas}</button>
    </aside>`);
  stage.append(el);
  const text = el.querySelector<HTMLElement>('[data-text]')!;
  let current: Step | null = null;

  el.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-off]')) progress.off = true;
    else if (target.closest('[data-skip]') && current) progress.done.push(current.id);
    else return;
    save();
    show(null);
  });

  /** coloca el bocadillo sobre la barra, con el pico encima del botón de la pista */
  function place() {
    if (!current) return;
    const stageBox = stage.getBoundingClientRect();
    const anchor = current.anchor ? toolbar.querySelector<HTMLElement>(current.anchor) : null;
    const box = (anchor ?? toolbar).getBoundingClientRect();
    const x = box.left + box.width / 2 - stageBox.left;
    const half = el.offsetWidth / 2;
    const left = Math.min(Math.max(x, half + 8), stageBox.width - half - 8);
    el.style.left = `${left}px`;
    // offsetTop: no le afecta que el escenario se haya desplazado
    el.style.bottom = `${stage.clientHeight - toolbar.offsetTop + 14}px`;
    el.style.setProperty('--tip', `${x - left + half}px`);
    el.classList.toggle('no-tip', !anchor);
  }
  window.addEventListener('resize', place);

  function show(step: Step | null) {
    current = step;
    el.hidden = !step;
    if (!step) return;
    text.textContent = TUTORIAL[step.id];
    place();
  }

  return {
    update(s, v) {
      if (!enabled || progress.off) return;
      // lo ya hecho se marca aunque no se haya visto: quien llega con partida no repite lo que sabe
      let changed = false;
      for (const step of STEPS) {
        if (!progress.done.includes(step.id) && step.done(s, v)) {
          progress.done.push(step.id);
          changed = true;
        }
      }
      if (changed) save();
      const next = STEPS.find(step => !progress.done.includes(step.id)) ?? null;
      const ready = next && (!next.ready || next.ready(s)) ? next : null;
      if (ready !== current) show(ready);
      // con una ventana abierta, el bocadillo se aparta
      const hide = !current || v.menu !== null;
      if (el.hidden !== hide) {
        el.hidden = hide;
        place();
      }
    },
  };
}
