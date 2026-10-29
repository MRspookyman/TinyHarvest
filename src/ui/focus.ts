// Foco de las capas modales: Tab no se escapa, Esc solo afecta a la de arriba y al cerrar se vuelve a donde se estaba.
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Lo que se puede enfocar dentro de `root`: sin desactivados ni ocultos (tampoco por un antepasado). */
export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el =>
    !el.matches(':disabled') && !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
}

/** Tab y Mayús+Tab dan la vuelta dentro de `root`. */
export function trapTab(e: KeyboardEvent, root: HTMLElement): void {
  if (e.key !== 'Tab' || e.defaultPrevented) return;
  e.preventDefault();
  const list = focusables(root);
  if (!list.length) return;
  const at = list.indexOf(document.activeElement as HTMLElement);
  const next = e.shiftKey
    ? (at <= 0 ? list.length - 1 : at - 1)
    : (at < 0 || at === list.length - 1 ? 0 : at + 1);
  list[next].focus();
}

/** ¿Es `layer` la capa modal visible más alta de su contenedor? Las que se añaden después quedan encima. */
export function isTopLayer(layer: HTMLElement): boolean {
  if (layer.hidden || !layer.parentElement) return false;
  const open = layer.parentElement.querySelectorAll(':scope > .win-layer:not([hidden])');
  return open[open.length - 1] === layer;
}

/** El elemento con foco, para devolvérselo al cerrar (el cuerpo no cuenta). */
export function focusOwner(): HTMLElement | null {
  const el = document.activeElement;
  return el instanceof HTMLElement && el !== document.body ? el : null;
}

export function restoreFocus(el: HTMLElement | null): void {
  if (el?.isConnected) el.focus({ preventScroll: true });
}
