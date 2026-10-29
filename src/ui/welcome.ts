// Bienvenida al volver tras un rato fuera: cuánto se ha estado fuera y lo que han sacado los gnomos a medio gas.
import { AWAY } from '../sim/config';
import { BIENVENIDA, TEMPORADA } from '../textos';
import { esc, html } from './dom';
import { focusOwner, isTopLayer, restoreFocus, trapTab } from './focus';

export interface Welcome {
  show(seconds: number, coins: number): void;
}

/** Misma estructura que el resumen de fin de temporada (season.ts): capa propia, Esc, Tab atrapado y foco en el botón. */
export function createWelcome(host: HTMLElement): Welcome {
  const layer = html(`<div class="win-layer summary-layer" hidden></div>`);
  host.append(layer);
  let opener: HTMLElement | null = null;
  const close = () => {
    if (layer.hidden) return;
    layer.hidden = true;
    const back = opener;
    opener = null;
    restoreFocus(back);
  };
  layer.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target === layer || target.closest('[data-ok]')) close();
  });
  // Esc lo cierra antes que nada (se registra antes que la ficha); Tab no sale de él
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || !isTopLayer(layer)) return;
    if (e.key === 'Tab') trapTab(e, layer);
    if (e.key !== 'Escape') return;
    e.preventDefault();
    close();
  });

  return {
    show(seconds, coins) {
      const capped = seconds > AWAY.maxSeconds;
      const away = TEMPORADA.duracion(Math.min(seconds, AWAY.maxSeconds));
      const frase = BIENVENIDA.frases[Math.floor(Math.random() * BIENVENIDA.frases.length)];
      layer.innerHTML = `
        <section class="win summary" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <header class="win-head"><div><h2 id="welcome-title">${BIENVENIDA.titulo}</h2><p>${esc(BIENVENIDA.fuera(away))}${capped ? ` ${esc(BIENVENIDA.tope)}` : ''}</p></div></header>
          <div class="summary-body">
            <p class="summary-seeds"><i class="coin" aria-hidden="true"></i>${esc(BIENVENIDA.monedas(coins))}</p>
            <p class="muted">${esc(frase)}</p>
            <footer><button type="button" class="btn gold" data-ok>${BIENVENIDA.seguir}</button></footer>
          </div>
        </section>`;
      if (layer.hidden) opener = focusOwner();
      layer.hidden = false;
      layer.querySelector<HTMLElement>('[data-ok]')!.focus({ preventScroll: true });
    },
  };
}
