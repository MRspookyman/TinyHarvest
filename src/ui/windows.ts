// Ventanas pixel art que se abren encima del huerto. Solo hay una abierta a la vez.
import { buttonImage, frameImage } from '../render/icons';
import type { GameState } from '../sim/types';
import { MENUS, UI, type MenuId } from '../textos';
import { html } from './dom';

export interface Menu {
  el: HTMLElement;
  update(s: GameState): void;
  /** se llama al abrir la ventana */
  onOpen?(): void;
}

export interface Windows {
  open(id: MenuId): void;
  close(): void;
  readonly current: MenuId | null;
  update(s: GameState): void;
}

export function createWindows(host: HTMLElement, menus: Record<MenuId, Menu>): Windows {
  // las imágenes del marco se generan por código; se pasan a CSS como variables
  document.documentElement.style.setProperty('--frame-img', `url(${frameImage})`);
  document.documentElement.style.setProperty('--button-img', `url(${buttonImage})`);

  const layer = html(`<div class="win-layer" hidden></div>`);
  host.append(layer);
  let current: MenuId | null = null;

  const shells = {} as Record<MenuId, HTMLElement>;
  for (const id of Object.keys(menus) as MenuId[]) {
    const shell = html(`
      <section class="win win-${id}" role="dialog" aria-modal="true" aria-labelledby="win-title-${id}" hidden>
        <header class="win-head">
          <div>
            <h2 id="win-title-${id}">${MENUS[id].titulo}</h2>
            <p>${MENUS[id].sub}</p>
          </div>
          <button type="button" class="win-close" aria-label="${UI.cerrar}">×</button>
        </header>
        <div class="win-body"></div>
      </section>`);
    shell.querySelector('.win-body')!.append(menus[id].el);
    shell.querySelector('.win-close')!.addEventListener('click', () => close());
    layer.append(shell);
    shells[id] = shell;
  }

  // clic fuera de la ventana: se cierra
  layer.addEventListener('pointerdown', e => {
    if (e.target === layer) close();
  });
  // Esc cierra la ventana; se marca como usada para que no cierre también la ficha del gnomo
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !current) return;
    e.preventDefault();
    close();
  });

  function open(id: MenuId) {
    if (current === id) return;
    if (current) shells[current].hidden = true;
    current = id;
    layer.hidden = false;
    shells[id].hidden = false;
    menus[id].onOpen?.();
    shells[id].querySelector<HTMLElement>('.win-close')!.focus({ preventScroll: true });
  }

  function close() {
    if (!current) return;
    shells[current].hidden = true;
    current = null;
    layer.hidden = true;
  }

  return {
    open,
    close,
    get current() {
      return current;
    },
    update(s) {
      if (current) menus[current].update(s);
    },
  };
}
