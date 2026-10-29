// Obras del pueblo: tres obras de fin de temporada que se abren con el árbol completo.
import { WORK_IDS, WORKS } from '../../sim/config';
import { treeComplete, workCost } from '../../sim/sim';
import type { GameState, WorkId } from '../../sim/types';
import { OBRA, OBRAS, UI } from '../../textos';
import { html, setDisabled, setText, toggleClass, type GameActions } from '../dom';
import type { Menu } from '../windows';

export function createWorksMenu(actions: GameActions): Menu {
  const el = html(`
    <div class="hire works">
      <p class="lock-note" data-works-lock hidden>${OBRA.bloqueada}</p>
      ${WORK_IDS.map(id => `
        <article class="job work" data-work="${id}">
          <div class="job-text">
            <header><b>${OBRAS[id].nombre}</b><span class="muted" data-level></span></header>
            <p>${OBRAS[id].desc}</p>
            <p class="muted" data-seeds></p>
          </div>
          <button type="button" class="btn" data-build="${id}"></button>
        </article>`).join('')}
    </div>`);

  el.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-build]');
    if (btn) actions.buyWork(btn.dataset.build as WorkId);
  });

  const lock = el.querySelector<HTMLElement>('[data-works-lock]')!;

  return {
    el,
    update(s: GameState) {
      const open = treeComplete(s);
      lock.hidden = open;
      for (const id of WORK_IDS) {
        const card = el.querySelector<HTMLElement>(`[data-work="${id}"]`)!;
        const level = s.works[id];
        const max = WORKS[id].costs.length;
        const maxed = level >= max;
        const btn = card.querySelector<HTMLButtonElement>('[data-build]');
        toggleClass(card, 'locked', !open);
        setText(card.querySelector('[data-level]'), UI.nivel(level, max));
        setText(card.querySelector('[data-seeds]'), level > 0 ? OBRA.semillas(level) : '');
        setText(btn, maxed ? UI.alMaximo : OBRA.construir(workCost(s, id)));
        setDisabled(btn, !open || maxed || s.coins < workCost(s, id));
      }
    },
  };
}
