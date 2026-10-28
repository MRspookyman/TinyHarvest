// Monedas que vuelan del huerto al contador de arriba (G2): para lo que se cobra a mano y las cosechas doradas.
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function flyCoins(from: { x: number; y: number }, to: HTMLElement, count: number) {
  if (reduced()) return;
  const r = to.getBoundingClientRect();
  const tx = r.left + 8, ty = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const coin = document.createElement('i');
    coin.className = 'fly-coin';
    coin.style.left = `${from.x}px`;
    coin.style.top = `${from.y}px`;
    document.body.append(coin);
    // cada moneda sale un poco hacia un lado y arriba antes de ir al contador
    const sx = (Math.random() - 0.5) * 40, sy = -20 - Math.random() * 25;
    const anim = coin.animate(
      [
        { transform: 'translate(0, 0) scale(1)' },
        { transform: `translate(${sx}px, ${sy}px) scale(1.2)`, offset: 0.3 },
        { transform: `translate(${tx - from.x}px, ${ty - from.y}px) scale(0.7)` },
      ],
      { duration: 650 + i * 70, easing: 'cubic-bezier(0.5, 0, 0.75, 0.4)', delay: i * 40 },
    );
    anim.onfinish = () => coin.remove();
  }
}
