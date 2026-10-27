// Utilidades pequeñas para la interfaz HTML.
import type { CropId, JobId, NodeId, Priority } from '../sim/types';

/** Lo que la interfaz puede pedirle al juego. main.ts lo conecta con la simulación. */
export interface GameActions {
  hire(job: JobId): void;
  buyNode(id: NodeId): void;
  buyHouse(): void;
  createGroup(): void;
  renameGroup(id: number, name: string): void;
  setGroupColor(id: number, color: number): void;
  setPriority(id: number, p: Priority): void;
  setGroupSeed(id: number, seed: CropId | null): void;
  deleteGroup(id: number): void;
  moveGnome(gnomeId: number, groupId: number): void;
  selectSeed(crop: CropId): void;
  reset(): void;
}

export const esc = (t: string) =>
  t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function setText(el: Element | null, v: string) {
  if (el && el.textContent !== v) el.textContent = v;
}

export function setDisabled(el: HTMLButtonElement | HTMLOptionElement | null, v: boolean) {
  if (el && el.disabled !== v) el.disabled = v;
}

export function toggleClass(el: Element | null, cls: string, on: boolean) {
  if (el && el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}

export function html(markup: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as HTMLElement;
}

export const pixelImg = (src: string, cls = 'px') => `<img class="${cls}" src="${src}" alt="" draggable="false">`;
