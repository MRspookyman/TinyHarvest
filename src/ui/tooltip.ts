// Una sola ayuda para todos los data-tip, incluidos los controles que se crean al abrir menús.
import { ACCESSIBILITY } from '../sim/config';

export function installTooltips(): void {
  const tip = document.createElement('div');
  tip.id = 'harvest-tooltip';
  tip.className = 'pixel-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-hidden', 'true');
  document.body.append(tip);

  let target: HTMLElement | null = null;
  let delay = 0;
  let frame = 0;
  let visible = false;
  const owner = (node: EventTarget | null) => node instanceof Element
    ? node.closest<HTMLElement>('[data-tip]') : null;

  function hide(): void {
    window.clearTimeout(delay);
    cancelAnimationFrame(frame);
    if (target && visible) {
      const ids = (target.getAttribute('aria-describedby') ?? '').split(/\s+/)
        .filter(id => id && id !== tip.id);
      if (ids.length) target.setAttribute('aria-describedby', ids.join(' '));
      else target.removeAttribute('aria-describedby');
    }
    target = null;
    visible = false;
    tip.classList.remove('show');
    tip.setAttribute('aria-hidden', 'true');
  }

  function position(): boolean {
    if (!target?.isConnected || !target.dataset.tip || !target.getClientRects().length) {
      hide();
      return false;
    }
    if (tip.textContent !== target.dataset.tip) tip.textContent = target.dataset.tip;
    const rect = target.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const margin = 8;
    const gap = 12;
    const below = rect.top - height - gap < margin;
    const center = rect.left + rect.width / 2;
    const left = Math.max(margin, Math.min(center - width / 2, window.innerWidth - width - margin));
    const top = Math.max(margin, Math.min(below ? rect.bottom + gap : rect.top - height - gap,
      window.innerHeight - height - margin));
    tip.classList.toggle('below', below);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.setProperty('--tip-arrow', `${Math.max(10, Math.min(width - 10, center - left))}px`);
    return true;
  }

  function follow(): void {
    if (position()) frame = requestAnimationFrame(follow);
  }

  function show(): void {
    if (!position() || !target) return;
    visible = true;
    const ids = (target.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    if (!ids.includes(tip.id)) ids.push(tip.id);
    target.setAttribute('aria-describedby', ids.join(' '));
    tip.setAttribute('aria-hidden', 'false');
    tip.classList.add('show');
    frame = requestAnimationFrame(follow);
  }

  function activate(next: HTMLElement | null, immediate: boolean): void {
    if (next === target) {
      if (immediate && !visible) {
        window.clearTimeout(delay);
        show();
      }
      return;
    }
    hide();
    if (!next?.dataset.tip) return;
    target = next;
    if (immediate) show();
    else delay = window.setTimeout(show, 250);
  }

  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'mouse') activate(owner(e.target), false);
  });
  document.addEventListener('pointerout', e => {
    if (e.pointerType === 'mouse' && owner(e.relatedTarget) !== target) hide();
  });
  document.addEventListener('focusin', e => {
    if (e.target instanceof Element && e.target.matches(':focus-visible')) activate(owner(e.target), true);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide, true);
  // con el dedo no hay «pasar por encima»: una pulsación larga enseña la ayuda y se come el clic que viene detrás
  let press = 0;
  let pressId = -1;
  let pressX = 0;
  let pressY = 0;
  let suppressClick = false;
  const cancelPress = () => {
    window.clearTimeout(press);
    pressId = -1;
  };
  document.addEventListener('pointerdown', e => {
    cancelPress();
    suppressClick = false;
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    const el = owner(e.target);
    if (!el?.dataset.tip) return;
    pressId = e.pointerId;
    pressX = e.clientX;
    pressY = e.clientY;
    press = window.setTimeout(() => {
      pressId = -1;
      if (!el.isConnected) return;
      activate(el, true);
      suppressClick = true;
    }, ACCESSIBILITY.longPressMs);
  }, true);
  document.addEventListener('pointermove', e => {
    if (e.pointerId === pressId && Math.hypot(e.clientX - pressX, e.clientY - pressY) > ACCESSIBILITY.movePx) cancelPress();
  }, true);
  const endPress = (e: PointerEvent) => {
    if (e.pointerId === pressId) cancelPress();
  };
  document.addEventListener('pointerup', endPress, true);
  document.addEventListener('pointercancel', endPress, true);
  window.addEventListener('click', e => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  // el menú contextual de la pulsación larga taparía la ayuda
  window.addEventListener('contextmenu', e => {
    if (suppressClick) e.preventDefault();
  }, true);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);
}
