// Dibuja el estado de la simulación con PixiJS. No cambia el estado: solo lo lee.
import { Application, Container, Graphics, Sprite, Text, Texture, TilingSprite, type FederatedPointerEvent } from 'pixi.js';
import { BARN, BASKET, BOARD, FIELD, GROUP_PALETTE, IDLE_AREA, OLD_TREE, RIPE } from '../sim/config';
import { basketMax, fieldSize, groupOf, hasPorters, isOpen, plotAt, plotOrigin } from '../sim/sim';
import type { GameState, Gnome } from '../sim/types';
import { MENUS, OFICIOS, type MenuId } from '../textos';
import { drawBackground, drawField, drawGrassTile } from './background';
import { drawBarn, drawBoard, drawOldTree, outlined } from './landmarks';
import { frameIndex, type Atlas } from './sprites';

const FONT = ['Pixelify Sans', 'monospace'];
const BASKET_SPRITE_W = 12;
const BASKET_SPRITE_H = 9;

/** Elemento del huerto que abre un menú al pulsarlo. */
interface Landmark {
  menu: MenuId;
  sprite: Sprite;
  normal: Texture;
  hover: Texture;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GnomeView {
  root: Container;
  ring: Sprite;
  body: Sprite;
  item: Sprite;
  bubble: Sprite;
}

interface Float {
  text: Text;
  x: number;
  y: number;
  t: number;
}

export class SceneView {
  onPlotClick: (id: number) => void = () => {};
  onOpenMenu: (menu: MenuId) => void = () => {};

  private world = new Container();
  /** hierba que rellena la pantalla alrededor del mundo */
  private grass = new TilingSprite({ texture: Texture.from(drawGrassTile()), width: 1, height: 1 });
  private field = new Sprite();
  private entities = new Container();
  private marks = new Graphics();
  private hover = new Graphics();
  private overlay = new Container();
  private plants: Sprite[] = [];
  private sparkles: Sprite[] = [];
  private basket: Sprite;
  private basketCount: Text;
  private landmarks: Landmark[] = [];
  private hovered: Landmark | null = null;
  private gnomes = new Map<number, GnomeView>();
  private floats: Float[] = [];
  private nameTag: Text;
  private pointer: { x: number; y: number } | null = null;
  private state: GameState | null = null;
  private scale = 1;
  private layoutKey = '';
  private fieldKey = '';
  private time = 0;

  constructor(private app: Application, private atlas: Atlas) {
    this.world.addChild(new Sprite(Texture.from(drawBackground())));
    this.field.position.set(FIELD.x - 2, FIELD.y - 2);
    this.entities.sortableChildren = true;
    this.world.addChild(this.field, this.marks, this.entities, this.hover);
    app.stage.addChild(this.grass, this.world, this.overlay);

    for (let i = 0; i < FIELD.maxCols * FIELD.maxRows; i++) {
      const plant = new Sprite(atlas.hole);
      const sparkle = new Sprite(atlas.sparkle);
      sparkle.visible = false;
      this.plants.push(plant);
      this.sparkles.push(sparkle);
      this.entities.addChild(plant, sparkle);
    }

    const addLandmark = (menu: MenuId, canvas: HTMLCanvasElement, x: number, y: number) => {
      const normal = Texture.from(canvas);
      const hover = Texture.from(outlined(canvas));
      const sprite = new Sprite(normal);
      sprite.position.set(x, y);
      sprite.zIndex = y + canvas.height;
      this.entities.addChild(sprite);
      this.landmarks.push({ menu, sprite, normal, hover, x, y, w: canvas.width, h: canvas.height });
    };
    addLandmark('contratar', drawBarn(), BARN.x - 1, BARN.y);
    addLandmark('grupos', drawBoard(), BOARD.x, BOARD.y);
    addLandmark('arbol', drawOldTree(), OLD_TREE.x, OLD_TREE.y);

    this.basket = new Sprite(atlas.basket[0]);
    this.basket.position.set(BASKET.x - BASKET_SPRITE_W / 2, BASKET.y - 4 - BASKET_SPRITE_H);
    this.basket.zIndex = BASKET.y - 4;
    this.entities.addChild(this.basket);

    const tagStyle = { fontFamily: FONT, fontSize: 14, fill: '#f4f4f4', stroke: { color: '#1a1c2c', width: 4 }, align: 'center' as const };
    this.basketCount = new Text({ text: '', style: tagStyle });
    this.basketCount.anchor.set(0.5, 1);
    this.nameTag = new Text({ text: '', style: tagStyle });
    this.nameTag.anchor.set(0.5, 1);
    this.nameTag.visible = false;
    this.overlay.addChild(this.basketCount, this.nameTag);

    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointertap', (e: FederatedPointerEvent) => {
      if (!this.state) return;
      const l = this.world.toLocal(e.global);
      const lm = this.landmarkAt(l.x, l.y);
      if (lm) return this.onOpenMenu(lm.menu);
      const id = plotAt(this.state, l.x, l.y);
      if (id !== null) this.onPlotClick(id);
    });
    app.stage.on('pointermove', (e: FederatedPointerEvent) => {
      const l = this.world.toLocal(e.global);
      this.pointer = { x: l.x, y: l.y };
    });
    app.stage.on('pointerleave', () => (this.pointer = null));
  }

  /** Borra las vistas de los gnomos (al empezar partida nueva). */
  reset() {
    for (const v of this.gnomes.values()) v.root.destroy({ children: true });
    this.gnomes.clear();
    for (const f of this.floats) f.text.destroy();
    this.floats = [];
  }

  sync(s: GameState, dt: number) {
    this.state = s;
    this.time += dt;
    this.syncField(s);
    this.layout(s);
    this.syncPlants(s);
    this.syncBasket(s);
    this.syncGnomes(s);
    this.syncMarks(s);
    this.syncFloats(s, dt);
    this.syncHover(s);
  }

  private syncField(s: GameState) {
    const f = fieldSize(s);
    const key = `${f.cols}x${f.rows}`;
    if (key === this.fieldKey) return;
    this.fieldKey = key;
    const old = this.field.texture;
    this.field.texture = Texture.from(drawField(f.cols, f.rows));
    if (old !== Texture.EMPTY) old.destroy(true);
  }

  /** Elemento pulsable bajo un punto del mundo (por su caja, con un pequeño margen). */
  private landmarkAt(x: number, y: number): Landmark | null {
    return this.landmarks.find(l => x >= l.x - 1 && x <= l.x + l.w && y >= l.y - 1 && y <= l.y + l.h) ?? null;
  }

  /** La cámara encuadra el granero y el bancal abierto con la mayor escala entera que quepa. */
  private layout(s: GameState) {
    const { width: w, height: h } = this.app.screen;
    const key = `${w}x${h}|${this.fieldKey}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;

    const f = fieldSize(s);
    const x0 = OLD_TREE.x - 4, y0 = BARN.y - 12;
    const x1 = FIELD.x + f.cols * FIELD.cell + 12;
    const y1 = Math.max(FIELD.y + f.rows * FIELD.cell + 14, IDLE_AREA.y1 + 8, OLD_TREE.y + OLD_TREE.h + 4);
    const bw = x1 - x0, bh = y1 - y0;
    this.scale = Math.max(1, Math.floor(Math.min(w / bw, h / bh)));
    const S = this.scale;
    this.world.scale.set(S);
    this.world.position.set(Math.floor((w - bw * S) / 2 - x0 * S), Math.floor((h - bh * S) / 2 - y0 * S));

    this.grass.width = w;
    this.grass.height = h;
    this.grass.tileScale.set(S);
    this.grass.tilePosition.set(this.world.x, this.world.y);

    for (const t of [this.nameTag, this.basketCount]) {
      t.style.fontSize = Math.max(12, 4 * S);
      t.style.stroke = { color: '#1a1c2c', width: Math.max(3, S) };
    }
  }

  private toScreen(x: number, y: number) {
    return { x: this.world.x + x * this.scale, y: this.world.y + y * this.scale };
  }

  private syncPlants(s: GameState) {
    for (const p of s.plots) {
      const sp = this.plants[p.id];
      const sparkle = this.sparkles[p.id];
      const open = isOpen(s, p);
      sp.visible = open;
      sparkle.visible = open && p.stage === RIPE && Math.sin(this.time * 2.3 + p.id * 2.1) > 0.93;
      if (!open) continue;
      const o = plotOrigin(p);
      sp.zIndex = o.y + 15;
      if (p.stage < 0) {
        sp.texture = this.atlas.hole;
        sp.anchor.set(0, 0);
        sp.scale.x = 1;
        sp.position.set(o.x + 6, o.y + 12);
      } else {
        sp.texture = this.atlas.plants[p.crop][p.stage];
        sp.anchor.set(0.5, 0);
        // parte de las plantas en espejo, para que el bancal no parezca copiado y pegado
        sp.scale.x = (p.id * 7) % 3 === 0 ? -1 : 1;
        const bounce = p.stage === RIPE && Math.sin(this.time * 5 + p.id * 1.7) > 0.6 ? -1 : 0;
        sp.position.set(o.x + 9, o.y + 2 + bounce);
      }
      sparkle.position.set(o.x + 12, o.y + 1);
      sparkle.zIndex = o.y + 16;
    }
  }

  private syncBasket(s: GameState) {
    const show = hasPorters(s) || s.basket.length > 0;
    this.basket.visible = show;
    this.basketCount.visible = show;
    if (!show) return;
    const max = basketMax(s);
    const fill = s.basket.length / max;
    const level = s.basket.length === 0 ? 0 : fill <= 0.25 ? 1 : fill <= 0.5 ? 2 : fill < 0.9 ? 3 : 4;
    this.basket.texture = this.atlas.basket[level];
    this.basketCount.text = `${s.basket.length}/${max}`;
    this.basketCount.style.fill = fill >= 1 ? '#e8687d' : '#f4f4f4';
    const p = this.toScreen(BASKET.x, BASKET.y - 4 - BASKET_SPRITE_H - 1);
    this.basketCount.position.set(p.x, p.y);
  }

  private makeGnomeView(): GnomeView {
    const root = new Container();
    const shadow = new Sprite(this.atlas.shadow);
    shadow.position.set(-5, 0);
    const ring = new Sprite(this.atlas.rings[0]);
    ring.position.set(-6, -1);
    const body = new Sprite();
    body.anchor.set(0.5, 1);
    const item = new Sprite();
    const bubble = new Sprite();
    root.addChild(shadow, ring, body, item, bubble);
    this.entities.addChild(root);
    return { root, ring, body, item, bubble };
  }

  private syncGnomes(s: GameState) {
    const alive = new Set<number>();
    for (const g of s.gnomes) {
      alive.add(g.id);
      let v = this.gnomes.get(g.id);
      if (!v) {
        v = this.makeGnomeView();
        this.gnomes.set(g.id, v);
      }
      this.drawGnome(s, g, v);
    }
    for (const [id, v] of this.gnomes) {
      if (alive.has(id)) continue;
      v.root.destroy({ children: true });
      this.gnomes.delete(id);
    }
  }

  private drawGnome(s: GameState, g: Gnome, v: GnomeView) {
    v.root.position.set(Math.round(g.x), Math.round(g.y));
    v.root.zIndex = g.y;
    v.ring.texture = this.atlas.rings[groupOf(s, g).color];
    const frames = this.atlas.gnome[g.job][g.pose];
    const idx = frameIndex(g.pose, g.t) % frames.length;
    v.body.texture = frames[idx];
    v.body.scale.x = g.flip ? -1 : 1;

    // al recoger, el cultivo asoma en la mano en el segundo fotograma
    const plot = g.task?.kind === 'harvest' && g.task.plot !== undefined ? s.plots[g.task.plot] : null;
    v.item.visible = g.pose === 'harvest' && idx === 1 && plot !== null;
    if (plot) {
      v.item.texture = this.atlas.items[plot.crop];
      v.item.position.set(g.flip ? -7 : 4, -9);
    }

    v.bubble.visible = g.bubble !== null;
    if (g.bubble === 'zz') {
      v.bubble.texture = this.atlas.zz;
      v.bubble.position.set(5, -20 - (Math.floor(g.t * 2) % 2));
    } else if (g.bubble === 'alert') {
      v.bubble.texture = this.atlas.alert;
      v.bubble.position.set(4, -24);
    }
  }

  /** Esquinas del color del grupo en la parcela a la que va cada gnomo: así se ve la prioridad en acción. */
  private syncMarks(s: GameState) {
    const m = this.marks;
    m.clear();
    for (const g of s.gnomes) {
      if (g.task?.plot === undefined || (g.task.kind !== 'harvest' && g.task.kind !== 'plant')) continue;
      const o = plotOrigin(s.plots[g.task.plot]);
      const x0 = o.x, y0 = o.y, x1 = o.x + FIELD.cell - 1, y1 = o.y + FIELD.cell - 1;
      const L = 4;
      for (const [x, y, w, h] of [
        [x0, y0, L, 1], [x0, y0, 1, L], [x1 - L + 1, y0, L, 1], [x1, y0, 1, L],
        [x0, y1, L, 1], [x0, y1 - L + 1, 1, L], [x1 - L + 1, y1, L, 1], [x1, y1 - L + 1, 1, L],
      ]) {
        m.rect(x, y, w, h);
      }
      m.fill({ color: GROUP_PALETTE[groupOf(s, g).color], alpha: 0.95 });
    }
  }

  private syncFloats(s: GameState, dt: number) {
    for (const e of s.events) {
      if (e.type !== 'coins') continue;
      const text = new Text({
        text: `+${e.amount}`,
        style: { fontFamily: FONT, fontSize: 8 * this.scale, fontWeight: '600', fill: '#ffcd75', stroke: { color: '#1a1c2c', width: this.scale * 1.2 } },
      });
      text.anchor.set(0.5);
      this.overlay.addChild(text);
      this.floats.push({ text, x: e.x, y: e.y, t: 0 });
    }
    s.events.length = 0;

    for (const f of this.floats) {
      f.t += dt;
      f.text.alpha = Math.max(0, 1 - f.t / 1.2);
      const p = this.toScreen(f.x, f.y - f.t * 12);
      f.text.position.set(p.x, p.y);
    }
    const done = this.floats.filter(f => f.t > 1.2);
    for (const f of done) f.text.destroy();
    if (done.length) this.floats = this.floats.filter(f => f.t <= 1.2);
  }

  private setHovered(lm: Landmark | null) {
    if (lm === this.hovered) return;
    if (this.hovered) {
      this.hovered.sprite.texture = this.hovered.normal;
      this.hovered.sprite.position.set(this.hovered.x, this.hovered.y);
    }
    this.hovered = lm;
    if (lm) {
      lm.sprite.texture = lm.hover;
      lm.sprite.position.set(lm.x - 1, lm.y - 1);
    }
  }

  private syncHover(s: GameState) {
    this.hover.clear();
    this.nameTag.visible = false;
    let cursor = 'default';
    let lm: Landmark | null = null;
    const pt = this.pointer;
    if (pt) {
      // nombre del gnomo bajo el ratón (va antes que los edificios, que pueden estar detrás)
      const g = s.gnomes.find(g => Math.abs(pt.x - g.x) <= 6 && pt.y <= g.y && pt.y >= g.y - 16);
      lm = g ? null : this.landmarkAt(pt.x, pt.y);
      if (g) {
        this.nameTag.text = `${g.name}\n${OFICIOS[g.job].nombre} · ${groupOf(s, g).name}`;
        const p = this.toScreen(g.x, g.y - 18);
        this.nameTag.position.set(p.x, p.y);
        this.nameTag.visible = true;
      } else if (lm) {
        this.nameTag.text = `${MENUS[lm.menu].lugar}\n${MENUS[lm.menu].sub}`;
        const p = this.toScreen(lm.x + lm.w / 2, lm.y - 2);
        this.nameTag.position.set(p.x, p.y);
        this.nameTag.visible = true;
        cursor = 'pointer';
      } else {
        const id = plotAt(s, pt.x, pt.y);
        const p = id !== null ? s.plots[id] : null;
        if (p && (p.stage === RIPE || p.stage === -1)) {
          const o = plotOrigin(p);
          this.hover.rect(o.x + 0.5, o.y + 0.5, FIELD.cell - 1, FIELD.cell - 1).stroke({ width: 1, color: 0xf4f4f4, alpha: 0.5 });
          cursor = 'pointer';
        }
      }
    }
    this.setHovered(lm);
    this.app.canvas.style.cursor = cursor;
  }
}
