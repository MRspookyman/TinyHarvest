// Diario del huerto: todo lo que ha pasado, y el botón para empezar de cero.
import type { GameState } from '../../sim/types';
import { UI } from '../../textos';
import { esc, html, type GameActions } from '../dom';
import type { Menu } from '../windows';

export function createDiaryMenu(actions: GameActions): Menu {
  const el = html(`
    <div class="diary">
      <ul data-log></ul>
      <footer><button type="button" class="link" data-reset>${UI.borrar}</button></footer>
    </div>`);
  const ul = el.querySelector<HTMLElement>('[data-log]')!;
  const reset = el.querySelector<HTMLButtonElement>('[data-reset]')!;
  let sig = '';
  let armTimer = 0;

  reset.addEventListener('click', () => {
    if (armTimer) {
      clearTimeout(armTimer);
      armTimer = 0;
      reset.textContent = UI.borrar;
      actions.reset();
      sig = '';
      return;
    }
    reset.textContent = UI.borrarSeguro;
    armTimer = window.setTimeout(() => {
      armTimer = 0;
      reset.textContent = UI.borrar;
    }, 3000);
  });

  return {
    el,
    update(s: GameState) {
      const next = `${s.log.length}|${s.log[0] ?? ''}`;
      if (next === sig) return;
      sig = next;
      ul.innerHTML = s.log.map(l => `<li>${esc(l)}</li>`).join('');
    },
  };
}
