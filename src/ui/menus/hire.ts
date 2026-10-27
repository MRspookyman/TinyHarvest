// Granero: contratar gnomos.
import { JOB_IDS, MAX_GNOMES } from '../../sim/config';
import { hireCost, jobUnlocked } from '../../sim/sim';
import type { GameState, JobId } from '../../sim/types';
import { jobIcons } from '../../render/icons';
import { ARBOL, OFICIOS, UI } from '../../textos';
import { html, pixelImg, setDisabled, setText, type GameActions } from '../dom';
import type { Menu } from '../windows';

export function createHireMenu(actions: GameActions): Menu {
  const el = html(`
    <div class="hire">
      ${JOB_IDS.map(j => `
        <article class="job" data-job="${j}">
          ${pixelImg(jobIcons[j], 'px job-icon')}
          <div class="job-text">
            <header><b>${OFICIOS[j].nombre}</b><span class="muted" data-count></span></header>
            <p>${OFICIOS[j].desc}</p>
            <p class="lock-note" data-lock hidden>${UI.bloqueadaEnArbol}: «${ARBOL.porteadores.nombre}».</p>
          </div>
          <button type="button" class="btn" data-hire="${j}"></button>
        </article>`).join('')}
    </div>`);

  el.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-hire]');
    if (btn) actions.hire(btn.dataset.hire as JobId);
  });

  return {
    el,
    update(s: GameState) {
      const full = s.gnomes.length >= MAX_GNOMES;
      for (const j of JOB_IDS) {
        const card = el.querySelector<HTMLElement>(`[data-job="${j}"]`)!;
        const unlocked = jobUnlocked(s, j);
        const cost = hireCost(s, j);
        const btn = card.querySelector<HTMLButtonElement>('[data-hire]');
        card.classList.toggle('locked', !unlocked);
        card.querySelector<HTMLElement>('[data-lock]')!.hidden = unlocked;
        setText(card.querySelector('[data-count]'), UI.tienes(s.gnomes.filter(g => g.job === j).length));
        setText(btn, full ? UI.lleno : UI.contratar(cost));
        setDisabled(btn, !unlocked || full || s.coins < cost);
      }
    },
  };
}
