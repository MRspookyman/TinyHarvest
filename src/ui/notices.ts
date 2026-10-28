// Avisos que se quedan en pantalla hasta que se resuelven: partida ilegible, no se puede guardar, el juego se ha roto.
// A diferencia del aviso del diario (.ticker), no se van solos.
import { esc } from './dom';

export interface NoticeButton {
  label: string;
  onClick(): void;
}

export interface Notices {
  /** muestra (o sustituye) el aviso con ese id */
  show(id: string, text: string, buttons?: NoticeButton[]): void;
  hide(id: string): void;
}

export function createNotices(host: HTMLElement): Notices {
  const box = document.createElement('div');
  box.className = 'notices';
  box.setAttribute('role', 'alert');
  host.append(box);
  const shown = new Map<string, HTMLElement>();

  return {
    show(id, text, buttons = []) {
      shown.get(id)?.remove();
      const el = document.createElement('div');
      el.className = 'notice';
      el.innerHTML = `<p>${esc(text)}</p>${buttons.length ? '<div class="notice-actions"></div>' : ''}`;
      const actions = el.querySelector('.notice-actions');
      for (const b of buttons) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.type = 'button';
        btn.textContent = b.label;
        btn.addEventListener('click', () => b.onClick());
        actions!.append(btn);
      }
      shown.set(id, el);
      box.append(el);
    },
    hide(id) {
      shown.get(id)?.remove();
      shown.delete(id);
    },
  };
}
