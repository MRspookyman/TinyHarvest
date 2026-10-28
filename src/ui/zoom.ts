// Botones de zum en la esquina del huerto (+, − y volver a verlo todo) y atajos de teclado (+, −, 0).
import type { SceneView } from '../render/scene';
import { UI } from '../textos';
import { esc, setDisabled } from './dom';

export interface ZoomControls {
  update(): void;
}

export function createZoomControls(stage: HTMLElement, scene: SceneView): ZoomControls {
  const el = document.createElement('div');
  el.className = 'zoom-ctl';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', UI.zum);
  el.innerHTML = `
    <button type="button" data-zoom="in" title="${esc(UI.acercar)}" aria-label="${esc(UI.acercar)}">+</button>
    <button type="button" data-zoom="out" title="${esc(UI.alejar)}" aria-label="${esc(UI.alejar)}">−</button>
    <button type="button" data-zoom="reset" title="${esc(UI.encuadre)}" aria-label="${esc(UI.encuadre)}">⤢</button>`;
  stage.append(el);
  const btn = (k: string) => el.querySelector<HTMLButtonElement>(`[data-zoom="${k}"]`)!;

  el.addEventListener('click', e => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('[data-zoom]')?.dataset.zoom;
    if (k === 'in') scene.zoomBy(1);
    else if (k === 'out') scene.zoomBy(-1);
    else if (k === 'reset') scene.resetZoom();
  });
  window.addEventListener('keydown', e => {
    // no se roba el teclado a los campos de texto (nombres de grupo)
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.key === '+' || e.key === '=') scene.zoomBy(1);
    else if (e.key === '-') scene.zoomBy(-1);
    else if (e.key === '0') scene.resetZoom();
    else return;
    e.preventDefault();
  });

  return {
    update() {
      const r = scene.zoomRange;
      setDisabled(btn('in'), !r.canIn);
      setDisabled(btn('out'), !r.canOut);
      setDisabled(btn('reset'), !r.zoomed);
    },
  };
}
